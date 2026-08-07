import uuid
from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


# ---------- Auth / Users ----------

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    role: str = "patient"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


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
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    device_id: Optional[str] = None


class PatientOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    date_of_birth: Optional[date]
    gender: Optional[str]
    height_cm: Optional[float]
    weight_kg: Optional[float]
    device_id: Optional[str]

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
