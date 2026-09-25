"""
Application configuration management using Pydantic Settings.
"""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Determine project root directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_FILE = PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    APP_ENV: str = "development"
    APP_HOST: str = "127.0.0.1"
    APP_PORT: int = 8000
    DEBUG: bool = False
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/sih26011_dev"
    ANALYSIS_SRID: int = 32644

    model_config = SettingsConfigDict(
        env_file=[str(ENV_FILE), ".env"],
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    @property
    def database_url(self) -> str:
        return self.DATABASE_URL

    @property
    def debug(self) -> bool:
        return self.DEBUG

    @property
    def app_env(self) -> str:
        return self.APP_ENV

    @property
    def app_host(self) -> str:
        return self.APP_HOST

    @property
    def app_port(self) -> int:
        return self.APP_PORT

    @property
    def analysis_srid(self) -> int:
        return self.ANALYSIS_SRID


settings = Settings()
