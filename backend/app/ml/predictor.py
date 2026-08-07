"""
Loads the trained scikit-learn model (produced by ml/training/train_model.py)
and exposes predict_health_state(reading) -> (label, probability, explanation).

Falls back to a transparent rule-based classifier if no trained model
artifact is present on disk yet (e.g. first run before training).
"""
import os
import joblib
import numpy as np

MODEL_PATH = os.getenv("MODEL_PATH", "/app/ml_artifacts/health_model.joblib")
LABEL_ENCODER_PATH = os.getenv("LABEL_ENCODER_PATH", "/app/ml_artifacts/label_encoder.joblib")

FEATURE_ORDER = ["heart_rate", "spo2", "temperature", "steps", "sleep_hours", "water_intake_ml"]

_model = None
_label_encoder = None
_model_loaded = False


def _try_load_model():
    global _model, _label_encoder, _model_loaded
    if _model_loaded:
        return
    _model_loaded = True
    if os.path.exists(MODEL_PATH) and os.path.exists(LABEL_ENCODER_PATH):
        _model = joblib.load(MODEL_PATH)
        _label_encoder = joblib.load(LABEL_ENCODER_PATH)


def _rule_based(reading) -> tuple[str, float, str]:
    hr = float(reading.heart_rate) if reading.heart_rate is not None else 70.0
    spo2 = float(reading.spo2) if reading.spo2 is not None else 98.0
    temp = float(reading.temperature) if reading.temperature is not None else 36.8
    sleep = float(reading.sleep_hours) if reading.sleep_hours is not None else 7.0
    water = float(reading.water_intake_ml) if reading.water_intake_ml is not None else 2000.0

    if temp >= 38.0:
        return "fever_risk", 0.82, f"Temperature {temp}°C is above the normal range (>=38.0°C), indicating possible fever."
    if spo2 < 94:
        return "heart_risk", 0.78, f"SpO2 {spo2}% is below the healthy threshold (94%), which can indicate cardiovascular or respiratory stress."
    if hr > 100:
        return "stress", 0.7, f"Heart rate {hr} bpm is elevated at rest, a common marker of physiological stress."
    if sleep < 5:
        return "sleep_deprivation", 0.75, f"Only {sleep}h of sleep logged, below the recommended 7-9h range."
    if water < 1200:
        return "dehydration", 0.68, f"Water intake of {water}ml is below the recommended daily minimum."
    if hr > 90 or sleep < 6:
        return "fatigue", 0.6, "Combination of elevated heart rate and reduced sleep suggests fatigue."
    return "healthy", 0.9, "All monitored vitals (heart rate, SpO2, temperature, sleep, hydration) are within normal ranges."


def predict_health_state(reading) -> tuple[str, float, str]:
    _try_load_model()
    if _model is None or _label_encoder is None:
        return _rule_based(reading)

    features = np.array([[
        float(reading.heart_rate or 0),
        float(reading.spo2 or 0),
        float(reading.temperature or 0),
        float(reading.steps or 0),
        float(reading.sleep_hours or 0),
        float(reading.water_intake_ml or 0),
    ]])

    proba = _model.predict_proba(features)[0]
    idx = int(np.argmax(proba))
    label = _label_encoder.inverse_transform([idx])[0]
    probability = float(proba[idx])

    # Feature-importance based explanation (works for RandomForest/XGBoost)
    explanation = "Model prediction based on: "
    if hasattr(_model, "feature_importances_"):
        importances = _model.feature_importances_
        top_idx = np.argsort(importances)[::-1][:2]
        top_features = [FEATURE_ORDER[i] for i in top_idx]
        explanation += ", ".join(top_features) + " were the strongest contributing factors."
    else:
        explanation += "trained classifier output."

    return label, probability, explanation
