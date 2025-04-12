import os
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from ...core.config import get_settings
from ...core.logging_config import setup_logging

logger = setup_logging()
settings = get_settings()
router = APIRouter(tags=["System"])

class HealthResponse(BaseModel):
    status: str
    env: str
    version: str
    last_active: str | None  # Changed from last_ingest to last_active

@router.get("/health", response_model=HealthResponse)
@router.get("/", response_model=HealthResponse)
async def health_check():
    try:
        # Check last activity timestamp
        last_active = None
        last_active_file = os.path.join("logs", "last_active")

        if os.path.exists(last_active_file):
            with open(last_active_file, "r") as f:
                last_active = f.read().strip()

        return {
            "status": "healthy", 
            "env": settings.ENV, 
            "version": settings.APP_VERSION,
            "last_active": last_active
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail="Service health check failed"
        )