from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, HTTPException
from sqlmodel import Session

from app.core.db import engine
from app.models import User


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]


def get_current_user(session: SessionDep, user_id: str) -> User:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
