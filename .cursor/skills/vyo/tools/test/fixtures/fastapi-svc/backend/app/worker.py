from celery import Celery

from app.core.config import settings
from app.utils import send_email

celery_app = Celery("worker", broker=settings.REDIS_URL)


@celery_app.task(name="send_weekly_digest")
def send_weekly_digest(email_to: str) -> None:
    """Emails each user a short list of what they saved this week."""
    send_email(email_to=email_to, subject="Your week in items", html_content="<p>Here is your week.</p>")
