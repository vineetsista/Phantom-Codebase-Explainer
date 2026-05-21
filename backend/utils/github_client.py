import re
from dataclasses import dataclass

import httpx

from config import get_settings


@dataclass
class RepoMetadata:
    owner: str
    name: str
    description: str
    stars: int
    forks: int
    primary_language: str
    default_branch: str
    clone_url: str
    # ISO-8601 timestamps. Empty string when unknown (network failure, stub).
    created_at: str
    pushed_at: str


_GITHUB_URL_RE = re.compile(
    r"^https?://github\.com/(?P<owner>[\w.\-]+)/(?P<name>[\w.\-]+?)(?:\.git)?/?$"
)


def parse_github_url(url: str) -> tuple[str, str]:
    match = _GITHUB_URL_RE.match(url.strip())
    if not match:
        raise ValueError(f"Not a valid GitHub repository URL: {url}")
    return match.group("owner"), match.group("name")


def fetch_metadata(repo_url: str) -> RepoMetadata:
    """Fetch repo metadata from the public GitHub REST API.

    Falls back to a minimal stub if the network call fails or rate-limits.
    """
    owner, name = parse_github_url(repo_url)
    settings = get_settings()
    headers = {"Accept": "application/vnd.github+json"}
    if settings.github_token and not settings.github_token.startswith("your_"):
        headers["Authorization"] = f"Bearer {settings.github_token}"

    try:
        with httpx.Client(timeout=15) as client:
            response = client.get(
                f"https://api.github.com/repos/{owner}/{name}", headers=headers
            )
            response.raise_for_status()
            data = response.json()
        return RepoMetadata(
            owner=owner,
            name=name,
            description=data.get("description") or "",
            stars=int(data.get("stargazers_count") or 0),
            forks=int(data.get("forks_count") or 0),
            primary_language=data.get("language") or "",
            default_branch=data.get("default_branch") or "main",
            clone_url=data.get("clone_url") or f"https://github.com/{owner}/{name}.git",
            # GitHub returns ISO-8601 with a trailing Z. Empty string when
            # the repo is brand new and these fields are null.
            created_at=data.get("created_at") or "",
            pushed_at=data.get("pushed_at") or "",
        )
    except Exception:
        return RepoMetadata(
            owner=owner,
            name=name,
            description="",
            stars=0,
            forks=0,
            primary_language="",
            default_branch="main",
            clone_url=f"https://github.com/{owner}/{name}.git",
            created_at="",
            pushed_at="",
        )
