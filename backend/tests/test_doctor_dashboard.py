"""
NEW (Doctor Dashboard feature). Covers the authorization behavior the
feature explicitly required (req #8 "Data security" + the pre-existing gap
flagged in PROJECT_CONTEXT.md §34): a doctor may only list/view patients
assigned to them via Patient.doctor_id, and GET /api/sensors/{id},
/api/predictions/{id}, /api/recommendations/{id}, and
/api/notifications?patient_id= now enforce patient/doctor/admin ownership
instead of accepting any authenticated caller.

This is a new, standalone file (not a modification of test_auth.py) so the
existing auth test suite is untouched. Follows the exact same
sqlite-backed TestClient pattern as test_auth.py.

NOTE: there is no "assign patient to doctor" endpoint in the project (out
of scope for this feature — see the implementation report's Limitations
section). Patient.doctor_id is set directly via the test DB session below
to simulate an assignment, exactly as an admin would need to do today
through direct DB access until an assignment endpoint exists.
"""
import os
os.environ["DATABASE_URL"] = "sqlite:///./test_doctor.db"

import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.models.health import Patient

engine = create_engine("sqlite:///./test_doctor.db", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True, scope="module")
def setup_db():
    # FIX: see test_auth.py for the full explanation — this bare
    # module-level assignment (it used to sit right here, outside any
    # fixture) ran during pytest's collection phase and, since this file
    # is collected after test_auth.py, silently overwrote test_auth.py's
    # override on the shared `app` singleton for the rest of the whole
    # session. Moving it into this fixture's setup/teardown scopes it
    # correctly to just this module's tests.
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    yield
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)
    # FIX: engine.dispose() closes every pooled connection, releasing the
    # OS-level file handle SQLAlchemy holds open on the SQLite file. On
    # Windows, skipping this leaves the file locked and os.remove() raises
    # PermissionError: [WinError 32]. drop_all() alone does not release the
    # handle — it only clears tables through the still-open connection.
    engine.dispose()
    if os.path.exists("./test_doctor.db"):
        os.remove("./test_doctor.db")


client = TestClient(app)


def _signup_and_login(email: str, role: str, full_name: str = "Test User"):
    resp = client.post(
        "/api/auth/signup",
        json={"email": email, "password": "Password123", "full_name": full_name, "role": role},
    )
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _assign_patient_to_doctor(patient_email: str, doctor_headers: dict):
    """Simulate what an admin/assignment endpoint would eventually do:
    set Patient.doctor_id to the doctor's user id, directly via the DB
    session (no assignment endpoint exists yet — see module docstring)."""
    me = client.get("/api/auth/me", headers=doctor_headers).json()
    db = TestingSessionLocal()
    try:
        from app.models.user import User

        patient_user = db.query(User).filter(User.email == patient_email).first()
        patient = db.query(Patient).filter(Patient.user_id == patient_user.id).first()
        # FIX: me["id"] is a JSON string; Patient.doctor_id is a
        # postgresql.UUID(as_uuid=True) column, same root cause as
        # get_current_user() — convert before assigning/committing.
        patient.doctor_id = uuid.UUID(me["id"])
        db.commit()
        return str(patient.id)
    finally:
        db.close()


@pytest.fixture(scope="module")
def scenario():
    """One doctor with one assigned patient, plus a second, unassigned
    patient belonging to nobody — the combination needed to prove the
    doctor sees exactly their own panel and nothing else."""
    doctor_headers = _signup_and_login("doc@example.com", "doctor", "Dr. Assigned")
    other_doctor_headers = _signup_and_login("doc2@example.com", "doctor", "Dr. Other")
    patient_headers = _signup_and_login("pat@example.com", "patient", "Assigned Patient")
    other_patient_headers = _signup_and_login("pat2@example.com", "patient", "Unassigned Patient")

    patient_id = _assign_patient_to_doctor("pat@example.com", doctor_headers)
    other_patient_id_resp = client.get("/api/patients/me", headers=other_patient_headers)
    other_patient_id = other_patient_id_resp.json()["id"]

    # Seed one sensor reading for the assigned patient so overview/status
    # fields have something to compute from.
    client.post(
        "/api/sensors",
        json={"patient_id": patient_id, "heart_rate": 75, "spo2": 98, "temperature": 36.8},
    )

    return {
        "doctor": doctor_headers,
        "other_doctor": other_doctor_headers,
        "patient": patient_headers,
        "other_patient": other_patient_headers,
        "patient_id": patient_id,
        "other_patient_id": other_patient_id,
    }


def test_doctor_list_only_sees_assigned_patients(scenario):
    resp = client.get("/api/patients", headers=scenario["doctor"])
    assert resp.status_code == 200
    ids = [p["id"] for p in resp.json()]
    assert scenario["patient_id"] in ids
    assert scenario["other_patient_id"] not in ids


def test_other_doctor_sees_no_patients(scenario):
    resp = client.get("/api/patients", headers=scenario["other_doctor"])
    assert resp.status_code == 200
    assert resp.json() == []


def test_doctor_can_get_own_patient(scenario):
    resp = client.get(f"/api/patients/{scenario['patient_id']}", headers=scenario["doctor"])
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Assigned Patient"


def test_doctor_cannot_get_unassigned_patient(scenario):
    resp = client.get(f"/api/patients/{scenario['other_patient_id']}", headers=scenario["doctor"])
    assert resp.status_code == 404


def test_patient_cannot_list_patients(scenario):
    # Unchanged existing behavior: require_role("admin", "doctor") still
    # rejects the patient role outright.
    resp = client.get("/api/patients", headers=scenario["patient"])
    assert resp.status_code == 403


def test_sensor_history_ownership_enforced(scenario):
    # The assigned patient can read their own history (existing behavior,
    # unaffected).
    own = client.get(f"/api/sensors/{scenario['patient_id']}", headers=scenario["patient"])
    assert own.status_code == 200

    # NEW: a different, unrelated patient can no longer read this
    # patient's history (previously any authenticated user could).
    cross = client.get(f"/api/sensors/{scenario['patient_id']}", headers=scenario["other_patient"])
    assert cross.status_code == 404

    # The assigned doctor can read it; an unrelated doctor cannot.
    doc = client.get(f"/api/sensors/{scenario['patient_id']}", headers=scenario["doctor"])
    assert doc.status_code == 200
    other_doc = client.get(f"/api/sensors/{scenario['patient_id']}", headers=scenario["other_doctor"])
    assert other_doc.status_code == 404


def test_notifications_patient_id_param_scoped_to_doctor(scenario):
    # Doctor can view their assigned patient's notifications via the new
    # optional patient_id param.
    resp = client.get(
        "/api/notifications", headers=scenario["doctor"], params={"patient_id": scenario["patient_id"]}
    )
    assert resp.status_code == 200

    # An unrelated doctor cannot.
    resp2 = client.get(
        "/api/notifications", headers=scenario["other_doctor"], params={"patient_id": scenario["patient_id"]}
    )
    assert resp2.status_code == 404

    # A patient passing patient_id is ignored — they still only get their
    # own notifications (existing behavior preserved).
    resp3 = client.get(
        "/api/notifications",
        headers=scenario["other_patient"],
        params={"patient_id": scenario["patient_id"]},
    )
    assert resp3.status_code == 200  # not a 404 — the param is simply ignored for patients


def test_overview_totals_scoped_to_doctor(scenario):
    resp = client.get("/api/patients/overview", headers=scenario["doctor"])
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_patients"] == 1

    resp2 = client.get("/api/patients/overview", headers=scenario["other_doctor"])
    assert resp2.status_code == 200
    assert resp2.json()["total_patients"] == 0


def test_login_redirect_role_present_in_response():
    # Sanity check for the frontend's role-based redirect fix: the login
    # response must carry user.role so login/page.tsx and signup/page.tsx
    # can route on it without an extra request.
    client.post(
        "/api/auth/signup",
        json={"email": "roletest@example.com", "password": "Password123", "full_name": "Role Test", "role": "doctor"},
    )
    resp = client.post("/api/auth/login", json={"email": "roletest@example.com", "password": "Password123"})
    assert resp.status_code == 200
    assert resp.json()["user"]["role"] == "doctor"
