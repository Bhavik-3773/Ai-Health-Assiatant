"""Rule-based personalized recommendation engine, keyed off the prediction label."""

RECOMMENDATIONS = {
    "fever_risk": [
        ("Monitor Temperature", "Recheck your temperature every 2 hours. Stay hydrated and rest."),
        ("Consult a Doctor", "If temperature stays above 38°C for more than 24 hours, consult a doctor."),
    ],
    "heart_risk": [
        ("Low Oxygen Saturation", "Sit upright, breathe slowly and deeply, and avoid exertion."),
        ("Consult a Doctor", "Persistent low SpO2 readings should be evaluated by a medical professional promptly."),
    ],
    "stress": [
        ("Elevated Heart Rate", "Drink water, avoid caffeine, and take a short rest."),
        ("Breathing Exercise", "Try 4-7-8 breathing: inhale 4s, hold 7s, exhale 8s, repeat 4 times."),
        ("Consult a Doctor", "If elevated heart rate recurs frequently at rest, consult a doctor."),
    ],
    "sleep_deprivation": [
        ("Improve Sleep Hygiene", "Aim for 7-9 hours; keep a consistent bedtime and limit screens before bed."),
        ("Avoid Stimulants", "Limit caffeine intake after early afternoon."),
    ],
    "dehydration": [
        ("Increase Water Intake", "Drink at least 2-2.5 liters of water throughout the day."),
        ("Track Intake", "Set reminders every 2 hours to log a glass of water."),
    ],
    "fatigue": [
        ("Rest and Recover", "Prioritize a full night's sleep and reduce strenuous activity today."),
        ("Nutrition Check", "Ensure balanced meals with adequate protein and iron intake."),
    ],
    "healthy": [
        ("Keep It Up", "Your vitals look good — maintain your current activity and sleep routine."),
    ],
}


def generate_recommendations(label: str, reading) -> list[tuple[str, str]]:
    return RECOMMENDATIONS.get(label, RECOMMENDATIONS["healthy"])
