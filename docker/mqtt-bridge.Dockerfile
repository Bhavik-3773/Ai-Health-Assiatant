# Lightweight image for the MQTT-to-REST bridge only.
# Avoids pulling in FastAPI/scikit-learn/pandas which the bridge never uses.
FROM python:3.12-slim
WORKDIR /app

RUN pip install --no-cache-dir paho-mqtt==2.1.0 httpx==0.27.2

COPY backend/app/__init__.py ./app/__init__.py
COPY backend/app/mqtt_bridge.py ./app/mqtt_bridge.py

CMD ["python", "-m", "app.mqtt_bridge"]
