from datetime import date
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User
from app.models.health import Patient
from app.schemas.schemas import PatientCreate, PatientOut

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


def _to_patient_out(patient: Patient) -> PatientOut:
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
    )


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
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor")),
):
    query = db.query(Patient)
    if search:
        query = query.filter(Patient.device_id.ilike(f"%{search}%"))
    patients = query.offset(offset).limit(limit).all()
    return [_to_patient_out(p) for p in patients]


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "doctor")),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return _to_patient_out(patient)