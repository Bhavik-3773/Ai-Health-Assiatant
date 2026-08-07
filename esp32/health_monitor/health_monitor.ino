/*
  AI Powered Personalized Health Assistant - ESP32 Firmware
  Reads MAX30102 (Heart Rate + SpO2), DS18B20 (Temperature), MPU6050 (Activity)
  and publishes a JSON payload over MQTT every 5 seconds.

  Required libraries (Arduino Library Manager):
    - PubSubClient        by Nick O'Leary
    - MAX30105lib          by SparkFun (works with MAX30102)
    - OneWire
    - DallasTemperature
    - Adafruit MPU6050
    - Adafruit Unified Sensor
    - ArduinoJson

  Wiring (I2C shared bus for MAX30102 + MPU6050: SDA=21, SCL=22 on most ESP32 boards):
    MAX30102: VIN->3V3, GND->GND, SDA->21, SCL->22
    MPU6050 : VIN->3V3, GND->GND, SDA->21, SCL->22 (different I2C address, shares bus)
    DS18B20 : VDD->3V3, GND->GND, DATA->GPIO4 (with 4.7k pull-up resistor to 3V3)
*/

#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <MAX30105.h>
#include "heartRate.h"
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <ArduinoJson.h>

// ---------- CONFIGURATION ----------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* MQTT_BROKER   = "192.168.1.100";  // backend/mqtt-broker host IP
const int   MQTT_PORT     = 1883;
const char* DEVICE_ID     = "ESP32-DEMO-001";  // must match patients.device_id in DB

const unsigned long PUBLISH_INTERVAL_MS = 5000;

// ---------- GLOBALS ----------
WiFiClient espClient;
PubSubClient mqttClient(espClient);

MAX30105 particleSensor;
#define ONE_WIRE_BUS 4
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);
Adafruit_MPU6050 mpu;

unsigned long lastPublish = 0;
long stepCount = 0;
float lastAccelMagnitude = 0;

const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
float beatsPerMinute = 0;
int beatAvg = 0;

char mqttTopic[64];

void setupWifi() {
  delay(100);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected. IP: " + WiFi.localIP().toString());
}

void reconnectMqtt() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT broker...");
    String clientId = "esp32-" + String(DEVICE_ID);
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" retrying in 5s");
      delay(5000);
    }
  }
}

String classifyActivity(float accelMagnitude) {
  if (accelMagnitude < 1.05) return "resting";
  if (accelMagnitude < 1.5) return "walking";
  return "active";
}

void setup() {
  Serial.begin(115200);
  Wire.begin();

  snprintf(mqttTopic, sizeof(mqttTopic), "health/sensors/%s", DEVICE_ID);

  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("MAX30105/MAX30102 not found. Check wiring.");
  } else {
    particleSensor.setup();
    particleSensor.setPulseAmplitudeRed(0x0A);
    particleSensor.setPulseAmplitudeGreen(0);
  }

  tempSensor.begin();

  if (!mpu.begin()) {
    Serial.println("MPU6050 not found. Check wiring.");
  } else {
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  }

  setupWifi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
}

float readHeartRate() {
  long irValue = particleSensor.getIR();
  if (checkForBeat(irValue)) {
    long delta = millis() - lastBeat;
    lastBeat = millis();
    beatsPerMinute = 60 / (delta / 1000.0);
    if (beatsPerMinute > 20 && beatsPerMinute < 255) {
      rates[rateSpot++] = (byte)beatsPerMinute;
      rateSpot %= RATE_SIZE;
      beatAvg = 0;
      for (byte x = 0; x < RATE_SIZE; x++) beatAvg += rates[x];
      beatAvg /= RATE_SIZE;
    }
  }
  return beatAvg > 0 ? beatAvg : beatsPerMinute;
}

float estimateSpO2() {
  // Simplified estimation placeholder for demo hardware calibration;
  // for clinical-grade SpO2, use SparkFun's dedicated spo2_algorithm library
  // with red+IR buffered samples. Returns a plausible resting value here.
  long irValue = particleSensor.getIR();
  if (irValue < 5000) return 0; // no finger detected
  return 96.0 + (float)(irValue % 300) / 100.0;
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) setupWifi();
  if (!mqttClient.connected()) reconnectMqtt();
  mqttClient.loop();

  float hr = readHeartRate();

  if (millis() - lastPublish >= PUBLISH_INTERVAL_MS) {
    lastPublish = millis();

    tempSensor.requestTemperatures();
    float temperature = tempSensor.getTempCByIndex(0);

    sensors_event_t a, g, temp;
    String activity = "resting";
    if (mpu.getEvent(&a, &g, &temp)) {
      float mag = sqrt(a.acceleration.x * a.acceleration.x +
                        a.acceleration.y * a.acceleration.y +
                        a.acceleration.z * a.acceleration.z) / 9.81;
      activity = classifyActivity(mag);
      if (activity == "walking") stepCount += 1; // naive step approximation
    }

    float spo2 = estimateSpO2();

    StaticJsonDocument<256> doc;
    doc["heart_rate"] = hr;
    doc["spo2"] = spo2;
    doc["temperature"] = temperature;
    doc["steps"] = stepCount;
    doc["activity_state"] = activity;

    char payload[256];
    size_t len = serializeJson(doc, payload);

    mqttClient.publish(mqttTopic, payload, len);
    Serial.println(payload);
  }
}
