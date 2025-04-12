from functools import lru_cache
from supabase import create_client, Client
from .config import get_settings
from .logging_config import setup_logging

logger = setup_logging()

@lru_cache()
def get_supabase_client() -> Client:
    """Initialize and return Supabase client"""
    settings = get_settings()
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        logger.warning("Supabase credentials not found. Supabase functionality will be unavailable.")
        return None
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)