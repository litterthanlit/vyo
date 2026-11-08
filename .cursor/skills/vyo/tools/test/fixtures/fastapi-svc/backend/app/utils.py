from pathlib import Path

import emails

from app.core.config import settings


def send_email(*, email_to: str, subject: str = "", html_content: str = "") -> None:
    message = emails.Message(subject=subject, html=html_content, mail_from=(settings.PROJECT_NAME, settings.EMAILS_FROM))
    message.send(to=email_to, smtp={"host": settings.SMTP_HOST, "port": settings.SMTP_PORT})


def render_template(name: str) -> str:
    return (Path(__file__).parent / "email-templates" / name).read_text()
