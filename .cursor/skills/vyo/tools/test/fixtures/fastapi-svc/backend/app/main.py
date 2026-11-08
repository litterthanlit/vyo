import sentry_sdk
from fastapi import FastAPI

from app.api.main import api_router
from app.core.config import settings

if settings.SENTRY_DSN:
    sentry_sdk.init(dsn=settings.SENTRY_DSN, enable_tracing=True)

app = FastAPI(title=settings.PROJECT_NAME, openapi_url="/api/v1/openapi.json")

app.include_router(api_router, prefix="/api/v1")
