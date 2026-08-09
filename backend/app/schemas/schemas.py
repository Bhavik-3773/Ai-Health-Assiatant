import re
import uuid
from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

PHONE_REGEX = re.compile(r"^\+?[0-9\-\s()]{7,20}$")
BLOOD_GROUPS = ("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")


# ---------- Auth / Users ----------

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    role: str = "patient"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """Used by PUT /api/auth/me. Deliberately only exposes full_name —
    email is the login identifier for the existing auth system and is not
    editable here; changing it would require a re-verification flow that's
    out of scope for this feature."""
    full_name: str = Field(min_length=1, max_length=255)


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Patients ----------

class PatientCreate(BaseModel):
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    height_cm: Optional[float] = Field(default=None, ge=30, le=300)
    weight_kg: Optional[float] = Field(default=None, ge=2, le=500)
    device_id: Optional[str] = None
    phone_number: Optional[str] = Field(default=None, max_length=20)
    blood_group: Optional[str] = None
    medical_history: Optional[str] = Field(default=None, max_length=4000)
    emergency_contact_name: Optional[str] = Field(default=None, max_length=255)
    emergency_contact_phone: Optional[str] = Field(default=None, max_length=20)

    @field_validator("date_of_birth")
    @classmethod
    def date_of_birth_not_in_future(cls, v: Optional[date]) -> Optional[date]:
        if v is not None and v > date.today():
            raise ValueError("date_of_birth cannot be in the future")
        return v

    @field_validator("blood_group")
    @classmethod
    def validate_blood_group(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if v not in BLOOD_GROUPS:
            raise ValueError(f"blood_group must be one of: {', '.join(BLOOD_GROUPS)}")
        return v

    @field_validator("phone_number", "emergency_contact_phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if not PHONE_REGEX.match(v):
            raise ValueError("Invalid phone number format")
        return v


class PatientOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    date_of_birth: Optional[date]
    age: Optional[int] = None
    gender: Optional[str]
    height_cm: Optional[float]
    weight_kg: Optional[float]
    device_id: Optional[str]
    phone_number: Optional[str]
    blood_group: Optional[str]
    medical_history: Optional[str]
    emergency_contact_name: Optional[str]
    emergency_contact_phone: Optional[str]
    photo_url: Optional[str]

    class Config:
        from_attributes = True


# ---------- Sensor Data ----------

class SensorDataCreate(BaseModel):
    patient_id: Optional[uuid.UUID] = None
    device_id: Optional[str] = None
    heart_rate: Optional[float] = None
    spo2: Optional[float] = None
    temperature: Optional[float] = None
    steps: Optional[int] = None
    calories: Optional[float] = None
    sleep_hours: Optional[float] = None
    water_intake_ml: Optional[int] = None
    activity_state: Optional[str] = None


class SensorDataOut(BaseModel):
    id: int
    patient_id: uuid.UUID
    heart_rate: Optional[float]
    spo2: Optional[float]
    temperature: Optional[float]
    steps: Optional[int]
    calories: Optional[float]
    sleep_hours: Optional[float]
    water_intake_ml: Optional[int]
    activity_state: Optional[str]
    recorded_at: datetime

    class Config:
        from_attributes = True


# ---------- Predictions ----------

class PredictionOut(BaseModel):
    id: int
    patient_id: uuid.UUID
    label: str
    probability: float
    explanation: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class RecommendationOut(BaseModel):
    id: int
    patient_id: uuid.UUID
    title: str
    body: str
    created_at: datetime

    class Config:
        from_attributes = True