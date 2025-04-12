import uuid
from fastapi import Request, status, FastAPI
from fastapi.responses import JSONResponse
from ..core.logging_config import setup_logging
from ..core.config import get_settings

logger = setup_logging()
settings = get_settings()

def add_exception_handlers(app: FastAPI) -> None:
    """Register exception handlers with FastAPI application"""
    
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        error_id = str(uuid.uuid4())
        logger.error(f"Global error handler caught: {str(exc)}", exc_info=True, extra={
            "error_id": error_id,
            "request_path": request.url.path,
            "request_method": request.method
        })

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal server error",
                "error_id": error_id,
                "message": str(exc) if settings.ENV == "dev" else "An unexpected error occurred",
            },
        )