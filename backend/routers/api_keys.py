"""API key management. Pro+ users create + manage personal access tokens
for programmatic access to /api/v1/generate.

Endpoints:
  POST  /api/v1/api-keys           — create a new key (returns plaintext ONCE)
  GET   /api/v1/api-keys           — list user's keys (no plaintext)
  DELETE /api/v1/api-keys/{id}     — revoke a key
"""
from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models import ApiKey, User, generate_key, get_db
from routers.users import require_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["api-keys"])


class CreateKeyBody(BaseModel):
    name: str


@router.post("/api-keys")
def create_api_key(
    body: CreateKeyBody,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict:
    name = (body.name or "").strip()[:120] or "Untitled key"
    plaintext, prefix, key_hash = generate_key()
    record = ApiKey(
        user_id=user.id,
        key_hash=key_hash,
        key_prefix=prefix,
        name=name,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    logger.info("Created API key %s for user %s (name=%s)", record.id, user.id, name)

    # plaintext shown ONCE — caller is responsible for storing it.
    return {
        "key": plaintext,
        "id": record.id,
        "prefix": prefix,
        "name": name,
        "created_at": record.created_at.isoformat(),
    }


@router.get("/api-keys")
def list_api_keys(
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict:
    keys = (
        db.query(ApiKey)
        .filter(ApiKey.user_id == user.id)
        .order_by(ApiKey.created_at.desc())
        .all()
    )
    return {"keys": [k.to_dict() for k in keys]}


@router.delete("/api-keys/{key_id}")
def revoke_api_key(
    key_id: str,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict:
    record = (
        db.query(ApiKey)
        .filter(ApiKey.id == key_id, ApiKey.user_id == user.id)
        .one_or_none()
    )
    if record is None:
        raise HTTPException(status_code=404, detail="Key not found")
    if record.revoked_at is None:
        record.revoked_at = datetime.utcnow()
        db.commit()
    return {"ok": True}
