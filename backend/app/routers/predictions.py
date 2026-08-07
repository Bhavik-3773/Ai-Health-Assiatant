from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.health import Prediction, Recommendation, Notification
from app.schemas.schemas import PredictionOut, RecommendationOut

router = APIRouter(prefix="/api", tags=["predictions"])


@router.get("/predictions/{patient_id}", response_model=List[PredictionOut])
def get_predictions(
    patient_id: str,
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Prediction)
        .filter(Prediction.patient_id == patient_id)
        .order_by(desc(Prediction.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/recommendations/{patient_id}", response_model=List[RecommendationOut])
def get_recommendations(
    patient_id: str,
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Recommendation)
        .filter(Recommendation.patient_id == patient_id)
        .order_by(desc(Recommendation.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/notifications")
def get_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))
    return query.order_by(desc(Notification.created_at)).limit(100).all()


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if notif:
        notif.is_read = True
        db.commit()
    return {"ok": True}
