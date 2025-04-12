from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from ..core.config import get_settings

settings = get_settings()

def setup_openapi(app: FastAPI) -> None:
    """Configure OpenAPI schema for FastAPI application"""
    
    def custom_openapi():
        if app.openapi_schema:
            return app.openapi_schema
        
        openapi_schema = get_openapi(
            title=settings.APP_TITLE,
            version=settings.APP_VERSION,
            description=settings.APP_DESCRIPTION,
            routes=app.routes,
        )
        
        # Additional OpenAPI customization can go here
        
        app.openapi_schema = openapi_schema
        return app.openapi_schema

    app.openapi = custom_openapi