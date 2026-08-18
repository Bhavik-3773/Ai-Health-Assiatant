from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.core.security import get_current_user, can_access_patient
from app.models.user import User
from app.models.health import Prediction, Recommendation, Notification, Patient
from app.schemas.schemas import PredictionOut, RecommendationOut, NotificationOut

router = APIRouter(prefix="/api", tags=["predictions"])


@router.get("/predictions/{patient_id}", response_model=List[PredictionOut])
def get_predictions(
    patient_id: uuid.UUID,
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # NEW (Doctor Dashboard security requirement): same ownership rule as
    # GET /api/sensors/{patient_id} and GET /api/patients/{patient_id}.
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient or not can_access_patient(current_user, patient):
        raise HTTPException(status_code=404, detail="Patient not found")

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
    patient_id: uuid.UUID,
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # NEW (Doctor Dashboard security requirement): same ownership rule as
    # the sibling read routes above.
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient or not can_access_patient(current_user, patient):
        raise HTTPException(status_code=404, detail="Patient not found")

    return (
        db.query(Recommendation)
        .filter(Recommendation.patient_id == patient_id)
        .order_by(desc(Recommendation.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/notifications", response_model=List[NotificationOut])
def get_notifications(
    unread_only: bool = False,
    patient_id: Optional[uuid.UUID] = Query(
        default=None,
        description=(
            "NEW (Doctor Dashboard). Doctor/admin only: view a specific "
            "patient's own notifications (e.g. emergency alerts) instead of "
            "the caller's own. Ignored for the patient role and when unset, "
            "so every existing caller keeps getting exactly their own "
            "notifications exactly as before."
        ),
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_user_id = current_user.id
    if patient_id is not None and current_user.role in ("doctor", "admin"):
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient or not can_access_patient(current_user, patient):
            raise HTTPException(status_code=404, detail="Patient not found")
        target_user_id = patient.user_id

    query = db.query(Notification).filter(Notification.user_id == target_user_id)
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


@router.delete("/notifications/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # NEW endpoint — did not exist before. Mirrors mark_notification_read's
    # lookup/ownership pattern exactly: scoped to current_user.id so a user
    # can only delete their own notifications, and is a no-op (not a 404)
    # if the id doesn't belong to them or no longer exists, consistent with
    # the existing mark-as-read endpoint's style.
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if notif:
        db.delete(notif)
        db.commit()
    return {"ok": True}