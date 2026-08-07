from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.health import Patient, SensorData, Notification
from app.schemas.schemas import SensorDataCreate, SensorDataOut
from app.ml.predictor import predict_health_state
from app.ml.recommender import generate_recommendations

router = APIRouter(prefix="/api/sensors", tags=["sensors"])


class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}

    async def connect(self, patient_id: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(patient_id, []).append(ws)

    def disconnect(self, patient_id: str, ws: WebSocket):
        if patient_id in self.active and ws in self.active[patient_id]:
            self.active[patient_id].remove(ws)

    async def broadcast(self, patient_id: str, message: dict):
        for ws in self.active.get(patient_id, []):
            await ws.send_json(message)


manager = ConnectionManager()


@router.post("", response_model=SensorDataOut, status_code=201)
def ingest_sensor_data(payload: SensorDataCreate, db: Session = Depends(get_db)):
    """Ingest a reading. Called by the backend's MQTT bridge or directly by ESP32 via HTTP fallback."""
    patient = None
    if payload.patient_id:
        patient = db.query(Patient).filter(Patient.id == payload.patient_id).first()
    elif payload.device_id:
        patient = db.query(Patient).filter(Patient.device_id == payload.device_id).first()

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found for given patient_id/device_id")

    reading = SensorData(
        patient_id=patient.id,
        heart_rate=payload.heart_rate,
        spo2=payload.spo2,
        temperature=payload.temperature,
        steps=payload.steps,
        calories=payload.calories,
        sleep_hours=payload.sleep_hours,
        water_intake_ml=payload.water_intake_ml,
        activity_state=payload.activity_state,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    _check_emergency(db, patient, reading)
    _run_prediction_pipeline(db, patient, reading)

    return reading


def _check_emergency(db: Session, patient: Patient, reading: SensorData):
    alerts = []
    if reading.heart_rate is not None and (reading.heart_rate > settings.HEART_RATE_HIGH or reading.heart_rate < settings.HEART_RATE_LOW):
        alerts.append(f"Abnormal heart rate: {reading.heart_rate} bpm")
    if reading.spo2 is not None and reading.spo2 < settings.SPO2_LOW:
        alerts.append(f"Low SpO2: {reading.spo2}%")
    if reading.temperature is not None and reading.temperature > settings.TEMPERATURE_HIGH:
        alerts.append(f"High temperature: {reading.temperature}°C")

    for alert in alerts:
        db.add(Notification(user_id=patient.user_id, type="emergency", title="Emergency Alert", message=alert))
    if alerts:
        db.commit()


def _run_prediction_pipeline(db: Session, patient: Patient, reading: SensorData):
    from app.models.health import Prediction, Recommendation

    label, probability, explanation = predict_health_state(reading)
    prediction = Prediction(
        patient_id=patient.id,
        sensor_data_id=reading.id,
        label=label,
        probability=probability,
        explanation=explanation,
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)

    for title, body in generate_recommendations(label, reading):
        db.add(Recommendation(patient_id=patient.id, prediction_id=prediction.id, title=title, body=body))
    db.commit()


@router.get("/{patient_id}", response_model=List[SensorDataOut])
def get_sensor_history(
    patient_id: str,
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(SensorData).filter(SensorData.patient_id == patient_id).order_by(desc(SensorData.recorded_at))
    return query.offset(offset).limit(limit).all()


@router.websocket("/ws/{patient_id}")
async def sensor_ws(websocket: WebSocket, patient_id: str):
    await manager.connect(patient_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive / ping
    except WebSocketDisconnect:
        manager.disconnect(patient_id, websocket)
