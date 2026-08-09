import uuid

from sqlalchemy import Column, String, Numeric, Integer, DateTime, ForeignKey, BigInteger, Date, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date_of_birth = Column(Date)
    gender = Column(String(20))
    height_cm = Column(Numeric(5, 2))
    weight_kg = Column(Numeric(5, 2))
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    device_id = Column(String(100), unique=True)
    phone_number = Column(String(20))
    blood_group = Column(String(5))
    medical_history = Column(Text)
    emergency_contact_name = Column(String(255))
    emergency_contact_phone = Column(String(20))
    photo_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sensor_readings = relationship("SensorData", back_populates="patient", cascade="all, delete-orphan")


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    specialization = Column(String(255))
    license_number = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SensorData(Base):
    __tablename__ = "sensor_data"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    heart_rate = Column(Numeric(5, 2))
    spo2 = Column(Numeric(5, 2))
    temperature = Column(Numeric(5, 2))
    steps = Column(Integer)
    calories = Column(Numeric(6, 2))
    sleep_hours = Column(Numeric(4, 2))
    water_intake_ml = Column(Integer)
    activity_state = Column(String(50))
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    patient = relationship("Patient", back_populates="sensor_readings")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    sensor_data_id = Column(BigInteger, ForeignKey("sensor_data.id"))
    label = Column(String(50), nullable=False)
    probability = Column(Numeric(5, 4), nullable=False)
    explanation = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    prediction_id = Column(BigInteger, ForeignKey("predictions.id"))
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(20), nullable=False, default="info")
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())