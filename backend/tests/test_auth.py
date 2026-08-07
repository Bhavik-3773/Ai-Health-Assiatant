import os
os.environ["DATABASE_URL"] = "sqlite:///./test.db"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db

engine = create_engine("sqlite:///./test.db", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True, scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test.db"):
        os.remove("./test.db")


client = TestClient(app)


def test_signup_and_login():
    resp = client.post(
        "/api/auth/signup",
        json={"email": "test@example.com", "password": "Password123", "full_name": "Test User", "role": "patient"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["user"]["email"] == "test@example.com"
    assert "access_token" in data

    resp2 = client.post("/api/auth/login", json={"email": "test@example.com", "password": "Password123"})
    assert resp2.status_code == 200
    assert "access_token" in resp2.json()


def test_login_wrong_password():
    resp = client.post(
        "/api/auth/signup",
        json={"email": "test2@example.com", "password": "Password123", "full_name": "Test Two", "role": "patient"},
    )
    assert resp.status_code == 201

    resp2 = client.post("/api/auth/login", json={"email": "test2@example.com", "password": "wrongpass"})
    assert resp2.status_code == 401


def test_me_requires_auth():
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_health_check():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
