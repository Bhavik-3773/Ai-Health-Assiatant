from datetime import date
from pathlib import Path
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role, can_access_patient
from app.models.user import User
from app.models.health import Patient, SensorData, Prediction, Notification
from app.schemas.schemas import (
    PatientCreate,
    PatientOut,
    PatientBrief,
    AlertActivityOut,
    PredictionActivityOut,
    SensorActivityOut,
    DoctorOverviewOut,
)

router = APIRouter(prefix="/api/patients", tags=["patients"])

# Where uploaded profile photos are stored on disk; served back out via the
# /static mount registered in app/main.py.
AVATAR_DIR = Path(__file__).resolve().parent.parent / "static" / "avatars"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_PHOTO_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_PHOTO_BYTES = 5 * 1024 * 1024  # 5MB


def _calculate_age(dob: Optional[date]) -> Optional[int]:
    if dob is None:
        return None
    today = date.today()
    years = today.year - dob.year
    if (today.month, today.day) < (dob.month, dob.day):
        years -= 1
    return years


def _to_patient_out(
    patient: Patient,
    full_name: Optional[str] = None,
    status: Optional[dict] = None,
) -> PatientOut:
    """NEW (Doctor Dashboard): full_name/status are optional and default to
    None, so every pre-existing call site (get_my_patient_profile,
    update_my_patient_profile, upload_my_photo) is completely unaffected —
    they call this with just `patient` exactly as before and get back the
    exact same PatientOut they always did (the new fields simply stay at
    their schema defaults)."""
    status = status or {}
    return PatientOut(
        id=patient.id,
        user_id=patient.user_id,
        date_of_birth=patient.date_of_birth,
        age=_calculate_age(patient.date_of_birth),
        gender=patient.gender,
        height_cm=patient.height_cm,
        weight_kg=patient.weight_kg,
        device_id=patient.device_id,
        phone_number=patient.phone_number,
        blood_group=patient.blood_group,
        medical_history=patient.medical_history,
        emergency_contact_name=patient.emergency_contact_name,
        emergency_contact_phone=patient.emergency_contact_phone,
        photo_url=patient.photo_url,
        full_name=full_name,
        latest_heart_rate=status.get("latest_heart_rate"),
        latest_spo2=status.get("latest_spo2"),
        latest_temperature=status.get("latest_temperature"),
        latest_activity_state=status.get("latest_activity_state"),
        latest_reading_at=status.get("latest_reading_at"),
        latest_prediction_label=status.get("latest_prediction_label"),
        latest_prediction_probability=status.get("latest_prediction_probability"),
        unread_alert_count=status.get("unread_alert_count", 0),
    )


def _get_patient_status(db: Session, patient: Patient) -> dict:
    """NEW (Doctor Dashboard). Latest vital reading + latest ML prediction +
    unread emergency-notification count for one patient — reuses the exact
    same SensorData/Prediction/Notification tables the patient-facing routes
    already read from GET /api/sensors, GET /api/predictions, and
    GET /api/notifications; no new table or duplicated data source."""
    latest_reading = (
        db.query(SensorData)
        .filter(SensorData.patient_id == patient.id)
        .order_by(desc(SensorData.recorded_at))
        .first()
    )
    latest_prediction = (
        db.query(Prediction)
        .filter(Prediction.patient_id == patient.id)
        .order_by(desc(Prediction.created_at))
        .first()
    )
    unread_alert_count = (
        db.query(Notification)
        .filter(
            Notification.user_id == patient.user_id,
            Notification.type == "emergency",
            Notification.is_read.is_(False),
        )
        .count()
    )
    return {
        "latest_heart_rate": latest_reading.heart_rate if latest_reading else None,
        "latest_spo2": latest_reading.spo2 if latest_reading else None,
        "latest_temperature": latest_reading.temperature if latest_reading else None,
        "latest_activity_state": latest_reading.activity_state if latest_reading else None,
        "latest_reading_at": latest_reading.recorded_at if latest_reading else None,
        "latest_prediction_label": latest_prediction.label if latest_prediction else None,
        "latest_prediction_probability": (
            float(latest_prediction.probability) if latest_prediction else None
        ),
        "unread_alert_count": unread_alert_count,
    }


@router.get("/me", response_model=PatientOut)
def get_my_patient_profile(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return _to_patient_out(patient)


@router.put("/me", response_model=PatientOut)
def update_my_patient_profile(
    payload: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)
    db.commit()
    db.refresh(patient)
    return _to_patient_out(patient)


@router.post("/me/photo", response_model=PatientOut)
async def upload_my_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    if file.content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(status_code=400, detail="Photo must be JPEG, PNG, or WEBP")

    contents = await file.read()
    if len(contents) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=400, detail="Photo must be smaller than 5MB")

    # Remove any previously uploaded photo for this patient (possibly a different extension)
    for existing in AVATAR_DIR.glob(f"{patient.id}.*"):
        existing.unlink(missing_ok=True)

    extension = ALLOWED_PHOTO_TYPES[file.content_type]
    filename = f"{patient.id}{extension}"
    (AVATAR_DIR / filename).write_bytes(contents)

    patient.photo_url = f"/static/avatars/{filename}"
    db.commit()
    db.refresh(patient)
    return _to_patient_out(patient)


@router.get("", response_model=List[PatientOut])
def list_patients(
    search: Optional[str] = Query(default=None, description="Search by device_id or gender"),
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    include_status: bool = Query(
        default=False,
        description=(
            "NEW (Doctor Dashboard). When true, attaches each patient's latest "
            "vitals/prediction/unread-alert-count (extra queries per row — off "
            "by default so this stays cheap for any other caller)."
        ),
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor")),
):
    query = db.query(Patient)
    # NEW (Doctor Dashboard): a doctor only sees patients assigned to them
    # via Patient.doctor_id. Admin behavior is completely unchanged (still
    # sees every patient) — this only tightens what a doctor can list,
    # which nothing relied on before since no frontend caller of this
    # endpoint existed prior to this feature.
    if current_user.role == "doctor":
        query = query.filter(Patient.doctor_id == current_user.id)
    if search:
        query = query.filter(Patient.device_id.ilike(f"%{search}%"))
    patients = query.offset(offset).limit(limit).all()

    if not patients:
        return []

    # Batch-fetch full names in one query instead of one-per-patient.
    user_ids = [p.user_id for p in patients]
    names = {u.id: u.full_name for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    return [
        _to_patient_out(
            p,
            full_name=names.get(p.user_id),
            status=_get_patient_status(db, p) if include_status else None,
        )
        for p in patients
    ]


@router.get("/overview", response_model=DoctorOverviewOut)
def get_patients_overview(
    alert_limit: int = Query(default=10, le=50),
    prediction_limit: int = Query(default=10, le=50),
    activity_limit: int = Query(default=10, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor")),
):
    """NEW (Doctor Dashboard). Aggregate summary for the Overview screen:
    total assigned patients, how many need attention, and recent alerts/
    predictions/activity across all of them. Reuses the exact same doctor
    scoping as list_patients() and reads from the existing SensorData/
    Prediction/Notification tables — no existing single endpoint could
    safely provide this cross-patient aggregation without many extra
    round trips from the frontend (one call per patient), which is why
    this is a new endpoint rather than reusing an existing one.

    IMPORTANT: this literal path must be declared before /{patient_id}
    below, or FastAPI/Starlette would try to match "overview" as a
    patient_id instead.
    """
    patients_query = db.query(Patient)
    if current_user.role == "doctor":
        patients_query = patients_query.filter(Patient.doctor_id == current_user.id)
    patients = patients_query.all()
    total_patients = len(patients)

    if total_patients == 0:
        return DoctorOverviewOut(
            total_patients=0,
            attention_count=0,
            recent_alerts=[],
            recent_predictions=[],
            recent_activity=[],
        )

    patient_ids = [p.id for p in patients]
    user_ids = [p.user_id for p in patients]
    names = {u.id: u.full_name for u in db.query(User).filter(User.id.in_(user_ids)).all()}
    patients_by_id = {p.id: p for p in patients}

    def brief(patient: Patient) -> PatientBrief:
        return PatientBrief(
            id=patient.id,
            full_name=names.get(patient.user_id, "Unknown"),
            device_id=patient.device_id,
        )

    alert_rows = (
        db.query(Notification, Patient)
        .join(Patient, Patient.user_id == Notification.user_id)
        .filter(Patient.id.in_(patient_ids), Notification.type == "emergency")
        .order_by(desc(Notification.created_at))
        .limit(alert_limit)
        .all()
    )
    recent_alerts = [
        AlertActivityOut(
            id=n.id, patient=brief(p), type=n.type, title=n.title, message=n.message,
            created_at=n.created_at,
        )
        for n, p in alert_rows
    ]

    prediction_rows = (
        db.query(Prediction)
        .filter(Prediction.patient_id.in_(patient_ids))
        .order_by(desc(Prediction.created_at))
        .limit(prediction_limit)
        .all()
    )
    recent_predictions = [
        PredictionActivityOut(
            id=pr.id,
            patient=brief(patients_by_id[pr.patient_id]),
            label=pr.label,
            probability=float(pr.probability),
            created_at=pr.created_at,
        )
        for pr in prediction_rows
    ]

    activity_rows = (
        db.query(SensorData)
        .filter(SensorData.patient_id.in_(patient_ids))
        .order_by(desc(SensorData.recorded_at))
        .limit(activity_limit)
        .all()
    )
    recent_activity = [
        SensorActivityOut(
            id=s.id,
            patient=brief(patients_by_id[s.patient_id]),
            heart_rate=s.heart_rate,
            spo2=s.spo2,
            temperature=s.temperature,
            activity_state=s.activity_state,
            recorded_at=s.recorded_at,
        )
        for s in activity_rows
    ]

    # "Requires attention": latest prediction is one of the two labels that
    # sensors.py's own emergency thresholds correlate with (fever/heart risk),
    # OR the patient has at least one unread emergency notification.
    HIGH_RISK_LABELS = {"heart_risk", "fever_risk"}
    attention_count = 0
    for p in patients:
        latest_pred = (
            db.query(Prediction)
            .filter(Prediction.patient_id == p.id)
            .order_by(desc(Prediction.created_at))
            .first()
        )
        has_unread_alert = (
            db.query(Notification)
            .filter(
                Notification.user_id == p.user_id,
                Notification.type == "emergency",
                Notification.is_read.is_(False),
            )
            .first()
            is not None
        )
        if (latest_pred and latest_pred.label in HIGH_RISK_LABELS) or has_unread_alert:
            attention_count += 1

    return DoctorOverviewOut(
        total_patients=total_patients,
        attention_count=attention_count,
        recent_alerts=recent_alerts,
        recent_predictions=recent_predictions,
        recent_activity=recent_activity,
    )


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor")),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    # NEW (Doctor Dashboard): a doctor may only fetch patients assigned to
    # them (admin unrestricted, unchanged). Returns the same 404 used for
    # "doesn't exist" rather than a 403, so this doesn't reveal whether a
    # patient_id belongs to someone else's panel.
    if not can_access_patient(current_user, patient):
        raise HTTPException(status_code=404, detail="Patient not found")
    full_name = db.query(User.full_name).filter(User.id == patient.user_id).scalar()
    return _to_patient_out(patient, full_name=full_name, status=_get_patient_status(db, patient))