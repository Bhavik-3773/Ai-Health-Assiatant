"""
Generates a labeled synthetic health-vitals dataset for training.
Each row simulates one sensor reading with a ground-truth health label
derived from clinically-motivated rules plus noise, so the trained
model learns realistic decision boundaries rather than pure lookup rules.

Output: ml/data/health_dataset.csv
"""
import numpy as np
import pandas as pd

RNG = np.random.default_rng(42)
N_SAMPLES = 20000

LABELS = ["healthy", "fatigue", "stress", "fever_risk", "heart_risk", "sleep_deprivation", "dehydration"]


def label_row(hr, spo2, temp, steps, sleep, water):
    if temp >= 38.0:
        return "fever_risk"
    if spo2 < 94:
        return "heart_risk"
    if hr > 100:
        return "stress"
    if sleep < 5:
        return "sleep_deprivation"
    if water < 1200:
        return "dehydration"
    if hr > 90 or sleep < 6:
        return "fatigue"
    return "healthy"


def generate():
    rows = []
    for _ in range(N_SAMPLES):
        hr = float(np.clip(RNG.normal(78, 18), 40, 180))
        spo2 = float(np.clip(RNG.normal(97, 3), 80, 100))
        temp = float(np.clip(RNG.normal(36.9, 0.6), 35, 41))
        steps = int(np.clip(RNG.normal(4000, 3000), 0, 25000))
        sleep = float(np.clip(RNG.normal(6.8, 1.6), 2, 10))
        water = int(np.clip(RNG.normal(1900, 700), 300, 4000))

        label = label_row(hr, spo2, temp, steps, sleep, water)
        rows.append([hr, spo2, temp, steps, sleep, water, label])

    df = pd.DataFrame(rows, columns=["heart_rate", "spo2", "temperature", "steps", "sleep_hours", "water_intake_ml", "label"])
    return df


if __name__ == "__main__":
    df = generate()
    df.to_csv("ml/data/health_dataset.csv", index=False)
    print(f"Generated {len(df)} rows -> ml/data/health_dataset.csv")
    print(df["label"].value_counts())
