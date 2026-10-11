from typing import Any

from fastapi import APIRouter

from app import crud
from app.core import security
from app.utils import render_template, send_email

from ..deps import SessionDep

router = APIRouter(tags=["login"])


@router.post("/login/access-token")
def login_access_token(session: SessionDep, email: str, password: str) -> Any:
    user = crud.get_user_by_email(session=session, email=email)
    if not user or not security.verify_password(password, user.hashed_password):
        return {"detail": "Incorrect email or password"}
    return {"access_token": str(user.id), "token_type": "bearer"}


@router.post("/password-recovery/{email}")
def recover_password(email: str) -> dict[str, str]:
    send_email(email_to=email, subject="Password recovery", html_content=render_template("recovery.html"))
    return {"message": "Password recovery email sent"}
