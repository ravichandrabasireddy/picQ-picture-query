import logging
from .config import get_settings

settings = get_settings()

def setup_logging():
    """Configure application logging"""
    logging.basicConfig(
        level=logging.INFO if settings.ENV != "prod" else logging.WARNING,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    return logging.getLogger("picq")