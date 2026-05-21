"""Clone a GitHub repo and extract a structured analysis.

Output schema (returned as a plain dict, JSON-serializable):

    {
      "repo": {owner, name, description, stars, primary_language, default_branch},
      "file_count": int,
      "total_bytes": int,
      "languages": {ext: percent_float},
      "top_files": [{path, bytes, language}],
      "entry_points": [path, ...],
      "config_files": {filename: content_excerpt},
      "directories": [{path, file_count}],
      "architecture_hint": "monolith" | "microservices" | "library" | "frontend-app" | ...,
      "modules": [{name, path, role, description}],
    }
"""
from __future__ import annotations

import json
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import git

from config import get_settings
from utils.github_client import RepoMetadata, fetch_metadata, parse_github_url

# Extensions we treat as source code, mapped to a display label.
LANGUAGE_BY_EXT: dict[str, str] = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".kt": "Kotlin",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".swift": "Swift",
    ".c": "C",
    ".h": "C",
    ".cpp": "C++",
    ".hpp": "C++",
    ".m": "Objective-C",
    ".scala": "Scala",
    ".sh": "Shell",
    ".sql": "SQL",
    ".html": "HTML",
    ".css": "CSS",
    ".vue": "Vue",
    ".svelte": "Svelte",
}

CONFIG_FILES = {
    "package.json",
    "requirements.txt",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    "Gemfile",
    "composer.json",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "tsconfig.json",
    "next.config.js",
    "vite.config.ts",
    "README.md",
    "readme.md",
}

ENTRY_HINTS = {
    "main.py",
    "app.py",
    "manage.py",
    "server.py",
    "index.js",
    "index.ts",
    "main.go",
    "main.rs",
    "src/main.ts",
    "src/index.ts",
    "src/main.py",
}

IGNORE_DIRS = {
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    "target",
    "__pycache__",
    "venv",
    ".venv",
    ".mypy_cache",
    ".pytest_cache",
    "vendor",
}

MAX_FILE_BYTES_INSPECT = 200_000  # don't read excerpts larger than this


@dataclass
class FileSummary:
    path: str
    bytes: int
    language: str


@dataclass
class AnalysisResult:
    repo: dict
    file_count: int = 0
    total_bytes: int = 0
    languages: dict[str, float] = field(default_factory=dict)
    top_files: list[dict] = field(default_factory=list)
    entry_points: list[str] = field(default_factory=list)
    config_files: dict[str, str] = field(default_factory=dict)
    directories: list[dict] = field(default_factory=list)
    architecture_hint: str = "unknown"
    modules: list[dict] = field(default_factory=list)
    readme_excerpt: str = ""
    code_excerpt: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "repo": self.repo,
            "file_count": self.file_count,
            "total_bytes": self.total_bytes,
            "languages": self.languages,
            "top_files": self.top_files,
            "entry_points": self.entry_points,
            "config_files": self.config_files,
            "directories": self.directories,
            "architecture_hint": self.architecture_hint,
            "modules": self.modules,
            "readme_excerpt": self.readme_excerpt,
            "code_excerpt": self.code_excerpt,
        }

    @property
    def summary(self) -> dict[str, Any]:
        return {
            "file_count": self.file_count,
            "primary_language": max(self.languages, key=self.languages.get)
            if self.languages
            else "Unknown",
            "module_count": len(self.modules),
            "architecture_hint": self.architecture_hint,
        }


def analyze(repo_url: str) -> AnalysisResult:
    """Clone the repo into a temp dir and analyze it. Cleans up on completion."""
    settings = get_settings()
    owner, name = parse_github_url(repo_url)
    metadata = fetch_metadata(repo_url)

    target_dir = Path(settings.repos_dir) / f"{owner}__{name}"
    if target_dir.exists():
        shutil.rmtree(target_dir, ignore_errors=True)
    target_dir.parent.mkdir(parents=True, exist_ok=True)

    try:
        _clone(metadata, target_dir)
        return _analyze_local(target_dir, metadata)
    finally:
        shutil.rmtree(target_dir, ignore_errors=True)


def _clone(metadata: RepoMetadata, target: Path) -> None:
    git.Repo.clone_from(
        metadata.clone_url,
        target,
        depth=1,
        single_branch=True,
        branch=metadata.default_branch,
    )


def _analyze_local(root: Path, metadata: RepoMetadata) -> AnalysisResult:
    files: list[FileSummary] = []
    lang_bytes: dict[str, int] = {}
    config_files: dict[str, str] = {}
    entry_points: list[str] = []
    dir_counts: dict[str, int] = {}
    readme_excerpt = ""

    for path in root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(root)
        rel_str = rel.as_posix()
        if any(part in IGNORE_DIRS for part in rel.parts):
            continue
        try:
            size = path.stat().st_size
        except OSError:
            continue

        ext = path.suffix.lower()
        lang = LANGUAGE_BY_EXT.get(ext, "")
        if lang:
            lang_bytes[lang] = lang_bytes.get(lang, 0) + size
        files.append(FileSummary(path=rel_str, bytes=size, language=lang))

        if path.name in CONFIG_FILES and path.name not in config_files:
            try:
                if size <= MAX_FILE_BYTES_INSPECT:
                    config_files[path.name] = path.read_text(
                        encoding="utf-8", errors="ignore"
                    )[:4000]
            except OSError:
                pass

        if rel_str in ENTRY_HINTS or path.name in ENTRY_HINTS:
            entry_points.append(rel_str)

        if path.name.lower() == "readme.md" and not readme_excerpt:
            try:
                readme_excerpt = path.read_text(encoding="utf-8", errors="ignore")[:6000]
            except OSError:
                pass

        top_dir = rel.parts[0] if len(rel.parts) > 1 else "(root)"
        dir_counts[top_dir] = dir_counts.get(top_dir, 0) + 1

    total_source_bytes = sum(lang_bytes.values()) or 1
    languages_pct = {
        lang: round(b / total_source_bytes * 100, 1) for lang, b in lang_bytes.items()
    }

    # Top files by size, filtered to source files.
    source_files = [f for f in files if f.language]
    source_files.sort(key=lambda f: f.bytes, reverse=True)
    top_files = [
        {"path": f.path, "bytes": f.bytes, "language": f.language} for f in source_files[:10]
    ]

    directories = sorted(
        [{"path": d, "file_count": c} for d, c in dir_counts.items()],
        key=lambda d: d["file_count"],
        reverse=True,
    )[:12]

    architecture_hint = _guess_architecture(root, config_files, directories)
    modules = _extract_modules(root, directories, config_files)
    code_excerpt = _read_code_excerpt(root, top_files)

    return AnalysisResult(
        repo={
            "owner": metadata.owner,
            "name": metadata.name,
            "description": metadata.description,
            "stars": metadata.stars,
            "forks": metadata.forks,
            "primary_language": metadata.primary_language
            or (max(lang_bytes, key=lang_bytes.get) if lang_bytes else ""),
            "default_branch": metadata.default_branch,
            "created_at": metadata.created_at,
            "pushed_at": metadata.pushed_at,
        },
        file_count=len(files),
        total_bytes=sum(f.bytes for f in files),
        languages=languages_pct,
        top_files=top_files,
        entry_points=sorted(set(entry_points)),
        config_files=config_files,
        directories=directories,
        architecture_hint=architecture_hint,
        modules=modules,
        readme_excerpt=readme_excerpt,
        code_excerpt=code_excerpt,
    )


def _guess_architecture(
    root: Path, configs: dict[str, str], directories: list[dict]
) -> str:
    dir_names = {d["path"] for d in directories}
    if "docker-compose.yml" in configs or "docker-compose.yaml" in configs:
        try:
            compose = configs.get("docker-compose.yml") or configs.get(
                "docker-compose.yaml", ""
            )
            if compose.count("services:") and compose.count("image:") + compose.count(
                "build:"
            ) >= 3:
                return "microservices"
        except Exception:
            pass
    if "next.config.js" in configs or "vite.config.ts" in configs:
        return "frontend-app"
    if "pages" in dir_names or "app" in dir_names and "package.json" in configs:
        return "frontend-app"
    if "src" in dir_names and ("Cargo.toml" in configs or "pyproject.toml" in configs):
        return "library"
    if "backend" in dir_names and "frontend" in dir_names:
        return "monorepo"
    return "monolith"


def _extract_modules(
    root: Path, directories: list[dict], configs: dict[str, str]
) -> list[dict]:
    """Build a lightweight module list from top-level directories.

    The script generator will later flesh these out with Claude-derived descriptions.
    """
    role_hints = {
        "api": "HTTP API surface",
        "backend": "Server-side application code",
        "frontend": "Client-side application code",
        "src": "Primary source tree",
        "services": "Business / domain services",
        "models": "Data models and schemas",
        "routers": "HTTP route handlers",
        "workers": "Async background workers",
        "utils": "Shared utilities",
        "components": "UI components",
        "pages": "Page routes",
        "app": "App entry / routes",
        "lib": "Reusable library code",
        "tests": "Test suites",
        "scripts": "Operational scripts",
        "docs": "Documentation",
    }
    modules: list[dict] = []
    for d in directories[:8]:
        name = d["path"]
        if name == "(root)":
            continue
        modules.append(
            {
                "name": name,
                "path": name,
                "role": role_hints.get(name.lower(), "Module"),
                "description": role_hints.get(
                    name.lower(), f"{name} module containing {d['file_count']} files"
                ),
                "file_count": d["file_count"],
            }
        )
    if not modules and "package.json" in configs:
        try:
            pkg = json.loads(configs["package.json"])
            modules.append(
                {
                    "name": pkg.get("name", "app"),
                    "path": ".",
                    "role": "Application root",
                    "description": pkg.get("description", "Application package"),
                    "file_count": 0,
                }
            )
        except Exception:
            pass
    return modules


EXCERPT_MAX_LINES = 80
EXCERPT_MAX_BYTES = 8_000
EXCERPT_MAX_LINE_LENGTH = 80  # cap individual lines so they fit the code panel


def _truncate_line(line: str, limit: int = EXCERPT_MAX_LINE_LENGTH) -> str:
    """Truncate at a word boundary near `limit` chars and append '…' if the
    line is too long for the renderer's code panel. Preserves leading
    indentation. If no natural break exists, hard-truncates."""
    if len(line) <= limit:
        return line
    indent_len = len(line) - len(line.lstrip())
    indent = line[:indent_len]
    body = line[indent_len:]
    cap = limit - indent_len - 1  # leave room for "…"
    if cap <= 1:
        return indent + "…"
    # Try a graceful break at the last whitespace/punctuation before the cap.
    breakable = max(
        body.rfind(" ", 0, cap),
        body.rfind(",", 0, cap),
        body.rfind(";", 0, cap),
        body.rfind("(", 0, cap),
    )
    if breakable >= cap * 0.5:
        return indent + body[:breakable].rstrip() + " …"
    return indent + body[:cap] + "…"


def _read_code_excerpt(root: Path, top_files: list[dict]) -> dict[str, Any]:
    """Read up to ~80 lines of the most prominent source file. Eighty lines
    is enough that the script generator has room to discuss real content
    (the previous 28-line cap forced Claude to make up locations it
    couldn't see). The renderer still only displays an 18-line focus
    window — `focus_start_line`, set by the script generator, decides
    where that window lands.

    Lines longer than EXCERPT_MAX_LINE_LENGTH characters are truncated at
    a word boundary with a trailing ellipsis, so the code panel never has
    to deal with overflow.

    Picks the largest source file that is plausibly hand-written (skips
    lockfiles, minified bundles, generated proto stubs)."""
    for entry in top_files:
        path = entry.get("path", "")
        if not path or _looks_generated(path):
            continue
        absolute = root / path
        if not absolute.is_file():
            continue
        try:
            text = absolute.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        raw_lines = text.splitlines()[:EXCERPT_MAX_LINES]
        lines = [_truncate_line(ln) for ln in raw_lines]
        code = "\n".join(lines)[:EXCERPT_MAX_BYTES]
        return {
            "path": path,
            "language": entry.get("language", ""),
            "code": code,
            "line_count": len(lines),
        }
    return {}


def _looks_generated(path: str) -> bool:
    lower = path.lower()
    bad_suffixes = (".min.js", ".min.css", ".lock", ".sum", "_pb.py", "_pb.go")
    bad_substrings = ("dist/", "build/", "generated/", "__generated__")
    return any(lower.endswith(s) for s in bad_suffixes) or any(
        s in lower for s in bad_substrings
    )


def mock_analysis(repo_url: str) -> AnalysisResult:
    """Used when cloning is impossible (e.g., private repo, no network) so the
    rest of the pipeline can still produce a demo video."""
    try:
        owner, name = parse_github_url(repo_url)
    except ValueError:
        owner, name = "demo", "repository"
    return AnalysisResult(
        repo={
            "owner": owner,
            "name": name,
            "description": "Could not clone this repository — showing a demo analysis.",
            "stars": 0,
            "forks": 0,
            "primary_language": "TypeScript",
            "default_branch": "main",
            "created_at": "",
            "pushed_at": "",
        },
        file_count=42,
        total_bytes=512_000,
        languages={"TypeScript": 72.0, "Python": 18.0, "CSS": 10.0},
        top_files=[
            {"path": "src/index.ts", "bytes": 4200, "language": "TypeScript"},
            {"path": "src/server.ts", "bytes": 3800, "language": "TypeScript"},
        ],
        entry_points=["src/index.ts"],
        config_files={},
        directories=[
            {"path": "src", "file_count": 24},
            {"path": "tests", "file_count": 12},
            {"path": "scripts", "file_count": 4},
        ],
        architecture_hint="monolith",
        modules=[
            {"name": "src", "path": "src", "role": "Primary source tree",
             "description": "Main application code", "file_count": 24},
            {"name": "tests", "path": "tests", "role": "Test suites",
             "description": "Unit and integration tests", "file_count": 12},
        ],
        readme_excerpt="",
        code_excerpt={
            "path": "src/index.ts",
            "language": "TypeScript",
            "code": (
                "import { createServer } from \"./server\";\n"
                "import { loadConfig } from \"./config\";\n\n"
                "const config = loadConfig();\n"
                "const server = createServer(config);\n\n"
                "server.listen(config.port, () => {\n"
                "  console.log(`listening on :${config.port}`);\n"
                "});\n"
            ),
            "line_count": 8,
        },
    )
