from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.health import UserSettings
from app.schemas.schemas import UserSettingsOut, UserSettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _get_or_create(db: Session, user_id) -> UserSettings:
    """Lazily creates a default settings row on first access instead of
    hooking into signup (see routers/auth.py) — keeps the existing auth
    flow completely untouched, per project rules."""
    row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if row is None:
        row = UserSettings(user_id=user_id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("/me", response_model=UserSettingsOut)
def get_my_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _get_or_create(db, current_user.id)


@router.put("/me", response_model=UserSettingsOut)
def update_my_settings(
    payload: UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = _get_or_create(db, current_user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row