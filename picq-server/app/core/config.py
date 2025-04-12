import os
from typing import List
from functools import lru_cache
from pydantic_settings import BaseSettings

class Settings(BaseSettings, extra="allow"):
    ENV: str = "dev"
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    ALLOWED_ORIGINS: List[str] = []  # empty default
    APP_VERSION: str = "1.0.0"
    APP_TITLE: str = "picQ API"
    APP_DESCRIPTION: str = "API for picture querying and analysis"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.ALLOWED_ORIGINS = (
            ["http://localhost:3000", "https://www.picq.ravichandra.dev"]
            if self.ENV == "dev"
            else ["https://www.picq.ravichandra.dev", "https://picq-api.ravichandra.dev"]
        )

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()