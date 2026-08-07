"""
Subscribes to MQTT topic `health/sensors/<device_id>` published by ESP32 devices
and forwards each reading into the REST ingestion endpoint, which in turn
runs the ML prediction pipeline and stores the reading.

Run standalone: python -m app.mqtt_bridge
"""
import json
import os
import logging

import paho.mqtt.client as mqtt
import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mqtt_bridge")

MQTT_BROKER = os.getenv("MQTT_BROKER", "mqtt-broker")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "health/sensors/#")
BACKEND_URL = os.getenv("BACKEND_INTERNAL_URL", "http://backend:8000")


def on_connect(client, userdata, flags, reason_code, properties=None):
    logger.info("Connected to MQTT broker with result code %s", reason_code)
    client.subscribe(MQTT_TOPIC)


def on_message(client, userdata, msg):
    try:
        device_id = msg.topic.split("/")[-1]
        payload = json.loads(msg.payload.decode())
        payload["device_id"] = device_id
        resp = httpx.post(f"{BACKEND_URL}/api/sensors", json=payload, timeout=10.0)
        resp.raise_for_status()
        logger.info("Forwarded reading from %s -> %s", device_id, resp.status_code)
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to process MQTT message on %s: %s", msg.topic, exc)


def main():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
    client.loop_forever()


if __name__ == "__main__":
    main()
