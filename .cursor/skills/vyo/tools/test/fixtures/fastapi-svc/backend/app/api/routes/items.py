import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from app import crud
from app.models import Item, ItemCreate, ItemPublic

from ..deps import CurrentUser, SessionDep

router = APIRouter(prefix="/items", tags=["items"])


@router.get("/", response_model=list[ItemPublic])
def read_items(session: SessionDep, current_user: CurrentUser) -> Any:
    return session.exec(select(Item).where(Item.owner_id == current_user.id)).all()


@router.get("/{id}", response_model=ItemPublic)
def read_item(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    item = session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.post("/", response_model=ItemPublic)
def create_item(*, session: SessionDep, current_user: CurrentUser, item_in: ItemCreate) -> Any:
    return crud.create_item(session=session, item_in=item_in, owner_id=str(current_user.id))


@router.put("/{id}", response_model=ItemPublic)
def update_item(*, session: SessionDep, current_user: CurrentUser, id: uuid.UUID, item_in: ItemCreate) -> Any:
    item = session.get(Item, id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.sqlmodel_update(item_in.model_dump())
    session.add(item)
    session.commit()
    return item


@router.delete("/{id}")
def delete_item(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> dict[str, str]:
    item = session.get(Item, id)
    if item:
        session.delete(item)
        session.commit()
    return {"message": "Item deleted"}
