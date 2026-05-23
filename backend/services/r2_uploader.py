"""Cloudflare R2 uploader.

When R2 credentials are configured, the worker uploads the finished
MP4 + thumbnail to an R2 bucket and writes the CDN URL onto the Video
row. Without credentials, this module is a no-op and the worker keeps
serving from the local /media/videos route.

R2 is S3-compatible, so this just uses boto3 pointed at the R2
endpoint. The "public URL" needs to come from R2_PUBLIC_URL_BASE
(your CDN domain or workers.dev URL) since R2 doesn't expose bucket
contents on a default URL.

Required env vars to enable:
  R2_ACCOUNT_ID         — Cloudflare account ID
  R2_ACCESS_KEY_ID      — R2 API token's access key
  R2_SECRET_ACCESS_KEY  — R2 API token's secret
  R2_BUCKET             — Bucket name (e.g. "phantom-prod")
  R2_PUBLIC_URL_BASE    — Public base URL with trailing slash, e.g.
                          "https://cdn.phantom.video/" or the
                          "<bucket>.r2.dev" workers domain.

All five must be set; if any is missing, `is_enabled()` returns False
and `upload()` becomes a no-op.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def is_enabled() -> bool:
    required = (
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET",
        "R2_PUBLIC_URL_BASE",
    )
    return all(os.environ.get(k) for k in required)


def _client():
    """Lazy boto3 client. Errors out cleanly if boto3 isn't installed."""
    import boto3  # type: ignore

    account_id = os.environ["R2_ACCOUNT_ID"]
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )


def upload(local_path: Path, remote_key: str, content_type: str) -> Optional[str]:
    """Upload `local_path` to R2 under `remote_key`. Returns the public
    URL on success, None on failure (so the caller can fall back to
    the local URL silently)."""
    if not is_enabled():
        return None
    try:
        client = _client()
        bucket = os.environ["R2_BUCKET"]
        with open(local_path, "rb") as fp:
            client.put_object(
                Bucket=bucket,
                Key=remote_key,
                Body=fp,
                ContentType=content_type,
                # Long cache — files are content-addressed by job_id so
                # they never change after upload.
                CacheControl="public, max-age=31536000, immutable",
            )
        base = os.environ["R2_PUBLIC_URL_BASE"].rstrip("/") + "/"
        return base + remote_key
    except Exception as exc:
        logger.warning("R2 upload failed for %s: %s", remote_key, exc)
        return None
