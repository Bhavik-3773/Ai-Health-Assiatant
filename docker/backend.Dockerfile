FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app

# Trained model artifacts. Run `python ml/training/generate_dataset.py &&
# python ml/training/train_model.py` before `docker compose build` so this
# directory contains health_model.joblib / label_encoder.joblib. If it's
# empty, predictor.py transparently falls back to a rule-based classifier
# instead of failing.
COPY ml/models ./ml_artifacts

ENV MODEL_PATH=/app/ml_artifacts/health_model.joblib
ENV LABEL_ENCODER_PATH=/app/ml_artifacts/label_encoder.joblib

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
