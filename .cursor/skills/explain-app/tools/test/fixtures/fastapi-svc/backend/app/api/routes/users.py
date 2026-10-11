from typing import Any

from fastapi import APIRouter

from app import crud
from app.models import UserCreate

from .. import deps

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/")
def read_users(session: deps.SessionDep) -> Any:
    return {"data": []}


@router.get("/me")
def read_user_me(current_user: deps.CurrentUser) -> Any:
    return current_user


@router.post("/signup")
def register_user(session: deps.SessionDep, user_in: UserCreate) -> Any:
    return crud.create_user(session=session, user_create=user_in)
