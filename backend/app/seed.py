"""Seed the database with an admin, a doctor, and a demo patient with sample readings.

Run: python -m app.seed
"""
import random
from datetime import datetime, timedelta

from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.health import Patient, Doctor, SensorData


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == "admin@healthassistant.io").first():
            print("Seed data already exists, skipping.")
            return

        admin = User(
            email="admin@healthassistant.io",
            hashed_password=get_password_hash("Admin@12345"),
            full_name="System Administrator",
            role=UserRole.admin.value,
        )
        doctor_user = User(
            email="doctor@healthassistant.io",
            hashed_password=get_password_hash("Doctor@12345"),
            full_name="Dr. Asha Verma",
            role=UserRole.doctor.value,
        )
        patient_user = User(
            email="patient@healthassistant.io",
            hashed_password=get_password_hash("Patient@12345"),
            full_name="Rahul Sharma",
            role=UserRole.patient.value,
        )
        db.add_all([admin, doctor_user, patient_user])
        db.commit()
        db.refresh(doctor_user)
        db.refresh(patient_user)

        doctor = Doctor(user_id=doctor_user.id, specialization="General Physician", license_number="MH-12345")
        patient = Patient(
            user_id=patient_user.id,
            gender="male",
            height_cm=175,
            weight_kg=72,
            doctor_id=doctor_user.id,
            device_id="ESP32-DEMO-001",
        )
        db.add_all([doctor, patient])
        db.commit()
        db.refresh(patient)

        now = datetime.utcnow()
        for i in range(50):
            db.add(
                SensorData(
                    patient_id=patient.id,
                    heart_rate=round(random.uniform(60, 100), 1),
                    spo2=round(random.uniform(95, 99), 1),
                    temperature=round(random.uniform(36.4, 37.2), 1),
                    steps=random.randint(0, 500),
                    calories=round(random.uniform(20, 80), 1),
                    sleep_hours=round(random.uniform(5, 8.5), 1),
                    water_intake_ml=random.randint(100, 400),
                    activity_state=random.choice(["resting", "walking", "active"]),
                    recorded_at=now - timedelta(minutes=5 * (50 - i)),
                )
            )
        db.commit()
        print("Seed data created:")
        print("  admin@healthassistant.io / Admin@12345")
        print("  doctor@healthassistant.io / Doctor@12345")
        print("  patient@healthassistant.io / Patient@12345")
    finally:
        db.close()


if __name__ == "__main__":
    run()
