import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import Base, engine
from app.core.limiter import limiter
from app.routers import auth, patients, sensors, predictions
from app.routers import settings as settings_router  # aliased: `settings` is
# already bound above to app.core.config's settings object — importing the
# new router under the same name would silently shadow it and break every
# settings.PROJECT_NAME / settings.CORS_ORIGINS reference below.

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("health_assistant")

# Local static file storage — currently used for patient profile photo
# uploads (see routers/patients.py). Note: this is ephemeral inside a
# Docker container unless a volume is mounted onto this path; fine as-is
# for local/non-Docker dev, where it persists normally on disk.
STATIC_DIR = Path(__file__).resolve().parent / "static"
(STATIC_DIR / "avatars").mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # In production, prefer Alembic migrations over create_all. schema.sql
    # (run automatically by the Postgres container on first init) is the
    # source of truth; create_all here is a no-op safety net for anyone
    # running the backend against a fresh DB without the init script
    # (e.g. local sqlite dev/tests).
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified.")
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Real-time IoT + ML powered personalized health monitoring platform.",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # allow_headers governs REQUEST headers; without expose_headers the
    # browser silently hides custom RESPONSE headers from JS even though
    # they're present on the wire. Needed for the Sensor History page's
    # pagination (X-Total-Count).
    expose_headers=["X-Total-Count"],
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Log the full traceback to stdout (visible via `docker compose logs backend`)
    # while still returning a generic message to the client.
    logger.exception("Unhandled error on %s %s", request.method, request.url)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(sensors.router)
app.include_router(predictions.router)
app.include_router(settings_router.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": settings.PROJECT_NAME}