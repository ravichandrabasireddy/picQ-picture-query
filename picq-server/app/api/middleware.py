import os
import time
from datetime import datetime
from fastapi import Request, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ..core.config import get_settings

settings = get_settings()

def add_middleware(app: FastAPI) -> None:
    """Add middleware to FastAPI application"""
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],  #
        allow_headers=["*"],
    )

# Request timing middleware
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    
    # Update the last active timestamp file
    try:
        os.makedirs("logs", exist_ok=True)
        with open(os.path.join("logs", "last_active"), "w") as f:
            current_time = datetime.now().isoformat()
            f.write(current_time)
    except Exception as e:
        # Log the error but don't interrupt the request
        print(f"Failed to update last active timestamp: {str(e)}")
        
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response