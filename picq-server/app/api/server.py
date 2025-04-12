from fastapi import FastAPI
import os

from ..core.config import get_settings
from ..core.logging_config import setup_logging
from ..core.database import get_supabase_client
from ..api.middleware import add_middleware, add_process_time_header
from ..api.exception_handlers import add_exception_handlers
from ..api.openapi import setup_openapi
from ..api.routes.health import router as health_router  # Import the router object directly

# Initialize core components
settings = get_settings()
logger = setup_logging()
supabase_client = get_supabase_client()

# Create FastAPI instance
app = FastAPI(
    title=settings.APP_TITLE,
    description=settings.APP_DESCRIPTION,
    version=settings.APP_VERSION,
    docs_url=None if settings.ENV == "prod" else "/docs",
    redoc_url=None if settings.ENV == "prod" else "/redoc"
)

# Set up application components
add_middleware(app)
app.middleware("http")(add_process_time_header)
add_exception_handlers(app)
setup_openapi(app)

# Include routers
app.include_router(health_router)  # Use the router object, not the module

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    logger.info(f"Starting picQ API in {settings.ENV} environment")
    logger.info(f"CORS allowed origins: {settings.ALLOWED_ORIGINS}")
    
    # Ensure logs directory exists
    os.makedirs("logs", exist_ok=True)
    
    if supabase_client:
        logger.info("Supabase client initialized successfully")
    else:
        logger.warning("Supabase client not initialized - check your environment variables")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down picQ API")