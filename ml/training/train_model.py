"""
Trains a RandomForestClassifier on ml/data/health_dataset.csv and saves the
model + label encoder as joblib artifacts consumed by the backend at inference time.

Usage:
    python ml/training/generate_dataset.py   # once, to create the dataset
    python ml/training/train_model.py
"""
import os

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score

DATA_PATH = "ml/data/health_dataset.csv"
MODEL_DIR = "ml/models"
FEATURES = ["heart_rate", "spo2", "temperature", "steps", "sleep_hours", "water_intake_ml"]


def main():
    df = pd.read_csv(DATA_PATH)
    X = df[FEATURES]
    y_raw = df["label"]

    encoder = LabelEncoder()
    y = encoder.fit_transform(y_raw)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=12,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"Test accuracy: {acc:.4f}")
    print(classification_report(y_test, y_pred, target_names=encoder.classes_))

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(model, os.path.join(MODEL_DIR, "health_model.joblib"))
    joblib.dump(encoder, os.path.join(MODEL_DIR, "label_encoder.joblib"))
    print(f"Saved model artifacts to {MODEL_DIR}/")


if __name__ == "__main__":
    main()
