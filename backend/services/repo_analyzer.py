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
      "monorepo": {
        "is_monorepo": bool, "type": str, "primary_package": str,
        "primary_package_name": str, "workspace_count": int, "notes": str
      } | None,
    }
"""
from __future__ import annotations

import json
import logging
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import git

from config import get_settings
from utils.github_client import RepoMetadata, fetch_metadata, parse_github_url

logger = logging.getLogger(__name__)

# Extensions we treat as source code, mapped to a display label.
LANGUAGE_BY_EXT: dict[str, str] = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
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

# Directories that exist in source trees but aren't themselves source modules.
# Used by is_source_directory() to filter out config/asset folders that would
# otherwise show up in the architecture diagram.
NON_SOURCE_DIRS = {
    # Hidden / config
    ".github", ".vscode", ".configs", ".husky", ".changeset",
    ".circleci", ".gitlab", ".idea", ".devcontainer", ".turbo",
    # Build artifacts
    "node_modules", "dist", "build", "coverage", "out",
    ".next", ".nuxt", "target", "vendor",
    # Non-source content
    "docs", "doc", "examples", "example", "scripts", "tools",
    "logo", "logos", "assets", "images", "img", "public", "static",
    "media", "fonts",
    # Tests
    "test", "tests", "__tests__", "spec", "__mocks__", "fixtures",
    "e2e", "cypress", "playwright", "benchmarks", "benchmark", "bench",
    # Generated
    "generated", "__generated__", "gen", "auto-generated",
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
    monorepo: Optional[dict] = None

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
            "monorepo": self.monorepo,
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


# --- Monorepo detection ----------------------------------------------------

@dataclass
class MonorepoLayout:
    type: str  # 'pnpm', 'npm-workspaces', 'lerna', 'turbo', 'nx', 'convention'
    workspace_dirs: list[Path]
    primary_package: Path
    primary_package_name: str
    notes: str


def detect_monorepo_layout(repo_path: Path, repo_name: str) -> Optional[MonorepoLayout]:
    """Detect a monorepo and pick its 'primary' package.

    Signals (any of these flips us into monorepo mode):
      - pnpm-workspace.yaml at the root
      - root package.json with a `workspaces` field
      - lerna.json / turbo.json / nx.json
      - a `packages/` (or `apps/`) directory containing 2+ subdirs each with
        a package.json — the convention fallback

    Primary-package selection priority (first match wins):
      1. Package whose name (in its package.json) matches the repo name
      2. Package whose directory name matches the repo name
      3. Largest package by source-file count
      4. First package alphabetically
    """
    if not repo_path.is_dir():
        return None

    layout_type: Optional[str] = None
    workspace_globs: list[str] = []

    # 1. pnpm-workspace.yaml
    pnpm_file = repo_path / "pnpm-workspace.yaml"
    if pnpm_file.exists():
        layout_type = "pnpm"
        try:
            text = pnpm_file.read_text(encoding="utf-8", errors="ignore")
            # Cheap parse — grab anything quoted under `packages:`
            in_packages = False
            for line in text.splitlines():
                stripped = line.strip()
                if stripped.startswith("packages:"):
                    in_packages = True
                    continue
                if in_packages:
                    m = re.match(r"-\s*['\"]?([^'\"]+?)['\"]?\s*$", stripped)
                    if m:
                        workspace_globs.append(m.group(1))
                    elif stripped and not stripped.startswith("#"):
                        break
        except OSError:
            pass

    # 2. root package.json with workspaces field
    root_pkg = repo_path / "package.json"
    if root_pkg.exists():
        try:
            pkg_data = json.loads(root_pkg.read_text(encoding="utf-8", errors="ignore"))
            workspaces = pkg_data.get("workspaces")
            if workspaces:
                layout_type = layout_type or "npm-workspaces"
                if isinstance(workspaces, list):
                    workspace_globs.extend(workspaces)
                elif isinstance(workspaces, dict):
                    packages = workspaces.get("packages") or []
                    if isinstance(packages, list):
                        workspace_globs.extend(packages)
        except (json.JSONDecodeError, OSError):
            pass

    # 3. lerna / turbo / nx (signal-only; we still rely on packages/ scan)
    for marker, mtype in (
        ("lerna.json", "lerna"),
        ("turbo.json", "turbo"),
        ("nx.json", "nx"),
    ):
        if (repo_path / marker).exists():
            layout_type = layout_type or mtype

    # 4. Convention fallback — packages/ or apps/ with 2+ package.json files
    packages_dir = repo_path / "packages"
    apps_dir = repo_path / "apps"
    convention_candidates: list[Path] = []
    for candidate_dir in (packages_dir, apps_dir):
        if candidate_dir.is_dir():
            for sub in candidate_dir.iterdir():
                if sub.is_dir() and (sub / "package.json").exists():
                    convention_candidates.append(sub)
    if not layout_type and len(convention_candidates) >= 2:
        layout_type = "convention"

    if not layout_type:
        return None

    # Resolve workspace globs (or use convention candidates) into actual dirs.
    workspace_dirs: list[Path] = list(convention_candidates)
    for glob in workspace_globs:
        # Simple glob expansion — handles `packages/*` and `apps/*`. Reject
        # negation patterns ("!exclude/me") which would need a real matcher.
        if glob.startswith("!"):
            continue
        glob = glob.rstrip("/")
        if "*" in glob:
            parent_str, _, _ = glob.partition("*")
            parent = repo_path / parent_str.rstrip("/")
            if parent.is_dir():
                for sub in parent.iterdir():
                    if sub.is_dir() and (sub / "package.json").exists():
                        workspace_dirs.append(sub)
        else:
            candidate = repo_path / glob
            if candidate.is_dir() and (candidate / "package.json").exists():
                workspace_dirs.append(candidate)

    # Dedupe (preserves first-seen order).
    seen: set[Path] = set()
    workspace_dirs = [d for d in workspace_dirs if not (d in seen or seen.add(d))]

    if not workspace_dirs:
        return None

    # Pick the primary package.
    def package_name(pkg_dir: Path) -> str:
        try:
            data = json.loads((pkg_dir / "package.json").read_text(
                encoding="utf-8", errors="ignore"
            ))
            return (data.get("name") or pkg_dir.name).rsplit("/", 1)[-1]
        except (json.JSONDecodeError, OSError):
            return pkg_dir.name

    repo_name_norm = repo_name.lower()
    primary: Optional[Path] = None
    primary_name = ""

    # Priority 1: package name matches repo name
    for pkg_dir in workspace_dirs:
        n = package_name(pkg_dir)
        if n.lower() == repo_name_norm:
            primary = pkg_dir
            primary_name = n
            break

    # Priority 2: directory name matches repo name
    if primary is None:
        for pkg_dir in workspace_dirs:
            if pkg_dir.name.lower() == repo_name_norm:
                primary = pkg_dir
                primary_name = package_name(pkg_dir)
                break

    # Priority 3: largest by source-file count
    if primary is None:
        def source_count(pkg_dir: Path) -> int:
            count = 0
            for ext in (".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go"):
                count += len(list(pkg_dir.rglob(f"*{ext}")))
            return count

        ranked = sorted(workspace_dirs, key=source_count, reverse=True)
        if ranked and source_count(ranked[0]) > 0:
            primary = ranked[0]
            primary_name = package_name(primary)

    # Priority 4: first alphabetically
    if primary is None:
        primary = sorted(workspace_dirs, key=lambda p: p.name)[0]
        primary_name = package_name(primary)

    notes = (
        f"{repo_name} is a {layout_type} monorepo with {len(workspace_dirs)} "
        f"workspaces. Core code lives in {primary.relative_to(repo_path).as_posix()}."
    )

    return MonorepoLayout(
        type=layout_type,
        workspace_dirs=workspace_dirs,
        primary_package=primary,
        primary_package_name=primary_name,
        notes=notes,
    )


def is_source_directory(path: Path) -> bool:
    """Return True if `path` is plausibly a source-code module directory.

    Filters out config / asset / test directories that the architecture
    diagram should not feature. Caller still gets to apply finer
    heuristics (e.g. minimum file count) on top.
    """
    name = path.name
    if name in NON_SOURCE_DIRS:
        return False
    if name.startswith("."):
        return False
    if not path.is_dir():
        return False
    # `lib` next to `src` is usually a build output. If both exist as siblings,
    # `lib` loses.
    if name == "lib" and (path.parent / "src").is_dir():
        return False
    # Must contain at least one source file (recursively).
    for ext in (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".rs", ".go"):
        if next(path.rglob(f"*{ext}"), None) is not None:
            return True
    # Or have a clear entry file at the root.
    for entry_ext in ("ts", "js", "tsx", "jsx", "py", "rs", "go"):
        if (path / f"index.{entry_ext}").exists() or (path / f"main.{entry_ext}").exists():
            return True
    return False


# --- Main analysis ---------------------------------------------------------

def _analyze_local(root: Path, metadata: RepoMetadata) -> AnalysisResult:
    """Top-level analysis. Detects monorepo first, then either descends into
    the primary package or analyzes the repo root directly."""
    monorepo = detect_monorepo_layout(root, metadata.name)
    monorepo_info: Optional[dict] = None
    source_root = root

    if monorepo is not None:
        monorepo_info = {
            "is_monorepo": True,
            "type": monorepo.type,
            "primary_package": monorepo.primary_package.relative_to(root).as_posix(),
            "primary_package_name": monorepo.primary_package_name,
            "workspace_count": len(monorepo.workspace_dirs),
            "notes": monorepo.notes,
        }
        source_root = monorepo.primary_package
        logger.info(
            "Monorepo detected (%s): %d workspaces, primary=%s",
            monorepo.type, len(monorepo.workspace_dirs), monorepo_info["primary_package"],
        )

    return _scan_source_root(root, source_root, metadata, monorepo_info)


def _scan_source_root(
    repo_root: Path,
    source_root: Path,
    metadata: RepoMetadata,
    monorepo_info: Optional[dict],
) -> AnalysisResult:
    """Walk source_root (which is either repo_root or the monorepo's primary
    package), aggregate language / file / directory stats, and pick the
    walkthrough file. Config files are read from repo_root regardless — the
    monorepo's primary package may not have its own README or Dockerfile."""
    files: list[FileSummary] = []
    lang_bytes: dict[str, int] = {}
    config_files: dict[str, str] = {}
    entry_points: list[str] = []
    dir_counts: dict[str, int] = {}
    readme_excerpt = ""

    # First: collect config files + README from the REPO ROOT (not the
    # primary package). Top-level metadata still wins for the intro card.
    for path in repo_root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(repo_root)
        if any(part in IGNORE_DIRS for part in rel.parts):
            continue
        if path.name in CONFIG_FILES and path.name not in config_files:
            try:
                if path.stat().st_size <= MAX_FILE_BYTES_INSPECT:
                    config_files[path.name] = path.read_text(
                        encoding="utf-8", errors="ignore"
                    )[:4000]
            except OSError:
                pass
        if path.name.lower() == "readme.md" and not readme_excerpt:
            try:
                readme_excerpt = path.read_text(encoding="utf-8", errors="ignore")[:6000]
            except OSError:
                pass

    # Second: aggregate source files from the SOURCE ROOT only.
    for path in source_root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(source_root)
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

        if rel_str in ENTRY_HINTS or path.name in ENTRY_HINTS:
            entry_points.append(rel_str)

        top_dir = rel.parts[0] if len(rel.parts) > 1 else "(root)"
        dir_counts[top_dir] = dir_counts.get(top_dir, 0) + 1

    total_source_bytes = sum(lang_bytes.values()) or 1
    languages_pct = {
        lang: round(b / total_source_bytes * 100, 1) for lang, b in lang_bytes.items()
    }

    # Top files — used as walkthrough candidates. Filtered by source-quality
    # heuristics (no test files, no type-only files, prefer the entry, prefer
    # high in-degree).
    source_files = [f for f in files if f.language]
    source_files.sort(key=lambda f: f.bytes, reverse=True)
    walkthrough_path = select_walkthrough_file(source_root, source_files, entry_points)
    top_files = _order_top_files(source_files, walkthrough_path)

    # Top-level directories under source_root. Filter to real source modules
    # before exposing to the architecture diagram.
    raw_directories = sorted(
        [{"path": d, "file_count": c} for d, c in dir_counts.items()],
        key=lambda d: d["file_count"],
        reverse=True,
    )[:20]
    directories = []
    for d in raw_directories:
        if d["path"] == "(root)":
            directories.append(d)
            continue
        sub = source_root / d["path"]
        if is_source_directory(sub):
            directories.append(d)
    directories = directories[:12]

    architecture_hint = _guess_architecture(repo_root, config_files, directories)
    modules = _extract_modules(source_root, directories, config_files)
    # If the surface-level module list is too shallow (one umbrella src/),
    # drill into its subdirectories so the architecture scene has real
    # internal structure to show.
    modules = _enrich_with_subdirs(source_root, modules)
    code_excerpt = _read_code_excerpt(source_root, top_files, walkthrough_path)

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
        monorepo=monorepo_info,
    )


def _is_test_file(path: str) -> bool:
    lower = path.lower()
    if any(seg in lower for seg in (
        "/test/", "/tests/", "/__tests__/", "/spec/", "/e2e/", "/benchmark/",
        "/benchmarks/", "/bench/",
    )):
        return True
    if lower.startswith(("test/", "tests/", "__tests__/", "spec/", "e2e/", "benchmark/")):
        return True
    base = path.rsplit("/", 1)[-1].lower()
    return (
        base.endswith(".test.ts") or base.endswith(".test.tsx")
        or base.endswith(".test.js") or base.endswith(".test.jsx")
        or base.endswith(".spec.ts") or base.endswith(".spec.tsx")
        or base.endswith(".spec.js") or base.endswith(".spec.jsx")
        or base.endswith("_test.py") or base.endswith("_test.go")
        or base.endswith(".bench.ts") or base.endswith(".bench.js")
    )


def _is_example_or_doc_file(path: str) -> bool:
    """Files under examples/, docs/, scripts/ — never the walkthrough."""
    lower = path.lower()
    if any(seg in lower for seg in (
        "/examples/", "/example/", "/docs/", "/doc/",
        "/scripts/", "/tools/", "/fixtures/", "/mocks/", "/__mocks__/",
    )):
        return True
    return lower.startswith((
        "examples/", "example/", "docs/", "doc/",
        "scripts/", "tools/", "fixtures/", "mocks/", "__mocks__/",
    ))


def _is_type_only_file(path: str) -> bool:
    base = path.rsplit("/", 1)[-1].lower()
    return base.endswith(".d.ts") or base in {"types.ts", "types.d.ts"}


def _is_pure_reexport(source_root: Path, file_path: str) -> bool:
    """A file is 'pure re-export' when every non-comment, non-blank line is
    just `export ... from "..."` or `export *`. These are barrel files —
    boring walkthrough material. Used to skip locales/index.ts-style picks."""
    try:
        text = (source_root / file_path).read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return False
    meaningful = 0
    reexport = 0
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith(("//", "/*", "*", "#")):
            continue
        meaningful += 1
        if stripped.startswith("export") and (" from " in stripped or stripped.startswith("export *")):
            reexport += 1
    return meaningful >= 3 and reexport / meaningful > 0.8


def _count_imports_to(source_root: Path, files: list[FileSummary], target_path: str) -> int:
    """Cheap heuristic for module in-degree: count files whose contents include
    a `from "..target.."` or `require(".target.")` reference. Off-the-cuff, but
    good enough to rank files by importance without running a real parser."""
    # Strip the extension and use the basename — this catches `from "./foo"`
    # for both `foo.ts` and `foo/index.ts`.
    base = target_path.rsplit("/", 1)[-1]
    stem = base.rsplit(".", 1)[0] if "." in base else base
    if len(stem) < 3 or stem in {"index", "main"}:
        return 0  # too generic to count reliably
    pattern = re.compile(
        rf'(?:from\s+["\'][^"\']*{re.escape(stem)}["\']|require\(["\'][^"\']*{re.escape(stem)}["\']\))',
    )
    count = 0
    for f in files:
        if f.path == target_path or not f.language:
            continue
        try:
            text = (source_root / f.path).read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if pattern.search(text):
            count += 1
    return count


def select_walkthrough_file(
    source_root: Path,
    source_files: list[FileSummary],
    entry_points: list[str],
) -> Optional[str]:
    """Pick the file that best represents this codebase for a walkthrough."""
    if not source_files:
        return None

    candidates = [
        f for f in source_files
        if not _is_test_file(f.path)
        and not _is_type_only_file(f.path)
        and not _is_example_or_doc_file(f.path)
        and f.bytes >= 400  # smaller than ~10-20 lines is rarely interesting
        and f.bytes < 50_000  # ~500 lines — anything bigger is hard to feature
        and not _is_pure_reexport(source_root, f.path)
    ]
    if not candidates:
        candidates = [
            f for f in source_files
            if not _is_test_file(f.path) and not _is_example_or_doc_file(f.path)
        ][:5]
    if not candidates:
        return None

    entry_set = set(entry_points)

    def score(f: FileSummary) -> float:
        s = 0.0
        base = f.path.rsplit("/", 1)[-1]
        if base in {"index.ts", "index.js", "main.py", "main.rs", "mod.rs", "main.go"}:
            s += 30
        if f.path in entry_set:
            s += 80
        # In-degree: how many other files import this one. Cheap heuristic
        # — capped at 10 imports counted to keep runtime bounded.
        s += min(10, _count_imports_to(source_root, source_files[:30], f.path)) * 10
        # Prefer substantive but not enormous files. Sweet spot ~80-300 lines
        # (2-10 KB at typical density).
        if f.bytes < 1500:
            s += f.bytes / 100  # 0-15
        elif f.bytes < 10_000:
            s += 15 + (f.bytes - 1500) / 400  # 15-36
        else:
            s += 36 - (f.bytes - 10_000) / 2000  # taper down past 10 KB
        # Penalize deeply-nested utility files — the prime walkthrough file is
        # usually at or near the source root.
        s -= f.path.count("/") * 4
        return s

    scored = sorted(candidates, key=score, reverse=True)
    return scored[0].path if scored else None


def _order_top_files(
    source_files: list[FileSummary], walkthrough_path: Optional[str]
) -> list[dict]:
    """Return top_files with the walkthrough pick first, ALL test / example /
    doc files filtered out, so downstream consumers (script generator, code
    excerpt reader) naturally pick the same file. Test files don't represent
    the codebase — they shouldn't show up as "biggest files in the project."
    """
    real_source = [
        f for f in source_files
        if not _is_test_file(f.path)
        and not _is_example_or_doc_file(f.path)
        and not _is_type_only_file(f.path)
    ]
    top = real_source[:10]
    if walkthrough_path:
        existing = next((f for f in top if f.path == walkthrough_path), None)
        if existing:
            top = [existing] + [f for f in top if f.path != walkthrough_path]
        else:
            match = next((f for f in source_files if f.path == walkthrough_path), None)
            if match:
                top = [match] + top[:9]
    return [{"path": f.path, "bytes": f.bytes, "language": f.language} for f in top]


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
    """Build a lightweight module list from top-level source directories.

    The script generator will later flesh these out with Claude-derived
    descriptions. We've already filtered out non-source directories upstream
    via is_source_directory(), so the list passed in here is trustable."""
    role_hints = {
        "api": "HTTP API surface",
        "backend": "Server-side application code",
        "frontend": "Client-side application code",
        "src": "Source root",
        "source": "Source root",
        "services": "Business / domain services",
        "models": "Data models and schemas",
        "routers": "HTTP route handlers",
        "workers": "Async background workers",
        "utils": "Shared utilities",
        "components": "UI components",
        "pages": "Page routes",
        "app": "App entry / routes",
        "lib": "Library code",
        "core": "Core engine / runtime",
        "parser": "Parser / lexer",
        "parsers": "Parsing primitives",
        "schemas": "Schema definitions",
        "errors": "Error types and propagation",
        "middleware": "Request middleware",
        "router": "Routing primitives",
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
                    name.lower(), f"{name} ({d['file_count']} files)"
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


def _enrich_with_subdirs(source_root: Path, modules: list[dict]) -> list[dict]:
    """When the analyzer found only one umbrella source directory (`src/` or
    `source/`), peek inside and surface its subdirectories as real modules so
    the architecture diagram has internal structure. Keeps the umbrella as
    module[0] (entry) when present."""
    if len(modules) > 2:
        return modules  # already has structure, don't fight the analyzer
    umbrella_names = {"src", "source", "lib", "app", "packages"}

    enriched: list[dict] = []
    for m in modules:
        name = m.get("name", "")
        path = m.get("path", "")
        if name not in umbrella_names:
            enriched.append(m)
            continue
        umbrella_path = source_root / path
        if not umbrella_path.is_dir():
            enriched.append(m)
            continue

        sub_modules: list[dict] = []
        for sub in sorted(umbrella_path.iterdir()):
            if not sub.is_dir():
                continue
            if not is_source_directory(sub):
                continue
            sub_rel = sub.relative_to(source_root).as_posix()
            sub_files = sum(
                1 for ext in (".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go")
                for _ in sub.rglob(f"*{ext}")
            )
            if sub_files == 0:
                continue
            sub_modules.append({
                "name": sub.name,
                "path": sub_rel,
                "role": _role_for(sub.name),
                "description": _description_for(sub.name, sub_files),
                "file_count": sub_files,
            })

        if sub_modules:
            # Keep the umbrella as the entry box, then add real subdirs.
            enriched.append(m)
            # Sort sub-modules by file count desc, take top 6
            sub_modules.sort(key=lambda x: x["file_count"], reverse=True)
            enriched.extend(sub_modules[:6])
        else:
            enriched.append(m)
    return enriched[:8]


def _role_for(name: str) -> str:
    """One-line role for a subdirectory. Best-effort hint for the script
    generator; Claude can override in the narration."""
    n = name.lower()
    hints = {
        "core": "Core types / engine",
        "schemas": "Schema definitions",
        "parsers": "Parsing primitives",
        "parser": "Parser",
        "errors": "Error types",
        "utils": "Shared utilities",
        "helpers": "Helper functions",
        "middleware": "Request middleware",
        "router": "Route matching",
        "routers": "Route handlers",
        "models": "Data models",
        "components": "UI components",
        "hooks": "Custom hooks",
        "services": "Domain services",
        "store": "State store",
        "stores": "State stores",
        "api": "API surface",
        "client": "Client interface",
        "server": "Server runtime",
        "plugins": "Plugin system",
        "locales": "i18n strings",
        "mini": "Minimal variant",
        "v3": "Legacy v3 API",
        "v4": "Current v4 API",
        "classic": "Classic API",
        "core": "Core runtime",
    }
    return hints.get(n, f"{name} module")


def _description_for(name: str, file_count: int) -> str:
    role = _role_for(name)
    if role.endswith("module"):
        return f"{name} ({file_count} files)"
    return role


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
    breakable = max(
        body.rfind(" ", 0, cap),
        body.rfind(",", 0, cap),
        body.rfind(";", 0, cap),
        body.rfind("(", 0, cap),
    )
    if breakable >= cap * 0.5:
        return indent + body[:breakable].rstrip() + " …"
    return indent + body[:cap] + "…"


def _read_code_excerpt(
    root: Path, top_files: list[dict], walkthrough_path: Optional[str]
) -> dict[str, Any]:
    """Read up to ~80 lines of the selected walkthrough file. Top-files have
    already been ordered so the walkthrough pick is first, so the first
    plausibly hand-written file in the list IS the walkthrough.

    Lines longer than EXCERPT_MAX_LINE_LENGTH characters are truncated at
    a word boundary with a trailing ellipsis."""
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
    bad_suffixes = (".min.js", ".min.css", ".lock", ".sum", "_pb.py", "_pb.go", ".d.ts")
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
        monorepo=None,
    )
