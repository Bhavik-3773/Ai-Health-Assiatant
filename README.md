# AI Powered Personalized Health Assistant

A real-time health monitoring platform combining IoT sensors (ESP32), a machine-learning
prediction engine, and a full-stack web application.

## Architecture

```
ESP32 (MAX30102 + DS18B20 + MPU6050)
   │  MQTT (health/sensors/<device_id>)
   ▼
Mosquitto Broker  ──►  mqtt-bridge (Python) ──► FastAPI /api/sensors
                                                     │
                                          ┌──────────┴──────────┐
                                          ▼                     ▼
                                   ML Predictor          Emergency Check
                                  (RandomForest)         (threshold rules)
                                          │
                                          ▼
                                  Recommendation Engine
                                          │
                                          ▼
                                    PostgreSQL
                                          │
                                          ▼
                              Next.js Dashboard (REST + WebSocket)
```

## Repository Layout

```
backend/         FastAPI application (auth, patients, sensors, predictions)
frontend/        Next.js 15 + React 19 + Tailwind dashboard
ml/              Dataset generation + RandomForest training pipeline
esp32/           Arduino firmware for the sensor node
database/        PostgreSQL schema (schema.sql)
docker/          Dockerfiles (backend, frontend, mqtt-bridge) + Mosquitto config
.github/         CI workflow (backend tests, frontend build, ML pipeline)
```

## Exact Setup (Windows / Docker Desktop / VS Code)

Run these commands **in order**, from the project root, in a VS Code terminal:

```powershell
# 1. Backend Python deps (only needed locally to run the ML training scripts below;
#    inside Docker the backend installs its own deps automatically)
pip install -r backend/requirements.txt

# 2. Generate the synthetic dataset and train the ML model.
#    This MUST run before `docker compose build` — the backend image copies
#    ml/models/*.joblib in at build time.
python ml/training/generate_dataset.py
python ml/training/train_model.py

# 3. Build and start every service (Postgres, Mosquitto, backend, mqtt-bridge, frontend)
docker compose up --build

# 4. In a second terminal, once the containers are healthy, seed demo data
docker compose exec backend python -m app.seed
```

Then open:
- Frontend: http://localhost:3000
- Backend Swagger docs: http://localhost:8000/api/docs
- Backend health check: http://localhost:8000/api/health

Demo logins after seeding:
| Role    | Email                       | Password       |
|---------|------------------------------|----------------|
| Admin   | admin@healthassistant.io    | Admin@12345    |
| Doctor  | doctor@healthassistant.io   | Doctor@12345   |
| Patient | patient@healthassistant.io  | Patient@12345  |

### Optional: override the JWT secret

By default `docker-compose.yml` falls back to a placeholder `SECRET_KEY`. To
set your own: `copy .env.example .env` and edit the value — Compose reads
`.env` automatically for variable substitution (no restart flags needed).

## Local Development (without Docker)

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# run Postgres locally (or via `docker run` — see below), then:
uvicorn app.main:app --reload
```

Quick standalone Postgres for local (non-Compose) backend dev:
```bash
docker run --name health-db -e POSTGRES_USER=health_user -e POSTGRES_PASSWORD=health_pass -e POSTGRES_DB=health_db -p 5432:5432 -d postgres:16-alpine
```

**Frontend**
```bash
cd frontend
npm install --legacy-peer-deps
copy .env.local.example .env.local
npm run dev
```

**Tests**
```bash
cd backend && pytest -v
```

## A note on `package-lock.json`

This repository ships `frontend/package.json` but not a hand-authored
`package-lock.json` — lock files should always be the output of an actual
`npm install` against the live npm registry (they contain integrity hashes
per resolved version), not something to fabricate by hand. Run `npm install`
once locally (step above, or the first `docker compose build` of the
frontend service) and commit the `package-lock.json` it generates if you
want `npm ci` reproducibility in CI. `npm run build` and `docker compose
build` both work with just `package.json` present.

## ESP32 Firmware

`esp32/health_monitor/health_monitor.ino` reads heart rate + SpO2 (MAX30102),
temperature (DS18B20), and activity state (MPU6050), then publishes a JSON
payload to `health/sensors/<device_id>` every 5 seconds. Update `WIFI_SSID`,
`WIFI_PASSWORD`, `MQTT_BROKER`, and `DEVICE_ID` at the top of the file, and
install the libraries listed in the file header via the Arduino Library Manager.

The `device_id` must match a `patients.device_id` row in the database (the
seed script creates `ESP32-DEMO-001`).

## Emergency Thresholds

Configurable via environment variables (see `backend/.env.example`):
heart rate, SpO2, and temperature out-of-range readings create an
`emergency` notification row immediately on ingestion.

## What Was Fixed in This Pass

- `frontend/public/` was missing entirely, which broke the Docker
  `COPY --from=builder /app/public ./public` step — added, and switched the
  frontend image to Next.js's `output: "standalone"` build for a smaller,
  more reliable production image.
- `NEXT_PUBLIC_API_URL` was set as a container **runtime** env var, which
  Next.js ignores for production builds (`NEXT_PUBLIC_*` vars are inlined at
  **build** time) — now passed as a Docker build ARG via
  `docker-compose.yml`'s `build.args`.
- `passlib[bcrypt]==1.7.4` is incompatible with `bcrypt>=4.1` (a removed
  `__about__.__version__` attribute) — replaced with direct `bcrypt` calls.
- `pydantic.EmailStr` was used without the required `email-validator`
  package installed, which raises an `ImportError` at startup — added to
  `requirements.txt`.
- `docker-compose.yml`'s obsolete `version:` key removed.
- PostgreSQL native `ENUM` types in `schema.sql` vs. plain `String` columns
  in the SQLAlchemy models were a fragile, easy-to-break mismatch —
  `schema.sql` now uses `VARCHAR` + `CHECK` constraints that match the ORM
  models exactly.
- Added a root `.dockerignore` so a locally-built `node_modules` or
  `.venv` can never leak into the Linux build context and break native
  bindings.
- `mqtt-bridge` now builds from its own minimal Dockerfile
  (`docker/mqtt-bridge.Dockerfile`) instead of the full backend image —
  faster build, no unused ML dependencies.
- Removed the unused `xgboost` dependency from the backend (never imported).
- Added real health checks for `db` and `backend` in `docker-compose.yml`,
  and made `frontend`/`mqtt-bridge` wait on `backend`'s health check rather
  than just container start.
- Wired the already-configured `slowapi` rate limiter onto `/api/auth/signup`
  and `/api/auth/login` (previously configured but never applied to a route).
- `main.py` now uses FastAPI's `lifespan` context manager (the modern
  replacement for the deprecated `@app.on_event("startup")`) and logs
  unhandled exception tracebacks to stdout so `docker compose logs backend`
  shows real errors instead of a silent generic 500.

## Roadmap / What's Not Yet Built

This foundation implements the core platform end-to-end (auth, DB, backend,
ML, ESP32 firmware, live dashboard). Still to build on top of it:
- Doctor dashboard (patient list, PDF report export)
- Admin dashboard (user management, system logs, analytics)
- RAG-based AI chat assistant (OpenAI-compatible API + vector store)
- Password reset flow, refresh tokens
- SMS/email emergency delivery (currently stored as in-app notifications only)
- Full frontend test suite, dark mode, loading skeletons
- Alembic migrations (currently using `create_all` as a dev-time safety net;
  `schema.sql` is the real source of truth applied on first Postgres init)

Tell me which of these to build next and I'll implement it fully.
