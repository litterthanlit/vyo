class Settings:
    PROJECT_NAME: str = "Items service"
    API_V1_STR: str = "/api/v1"
    SENTRY_DSN: str | None = None
    REDIS_URL: str = "redis://localhost:6379/0"
    DATABASE_URL: str = "postgresql+psycopg://app:app@localhost/app"
    EMAILS_FROM: str = "hello@items.example"
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587


settings = Settings()
