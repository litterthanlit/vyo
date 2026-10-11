from sqlmodel import Session, select

from app.core.security import hash_password
from app.models import Item, ItemCreate, User, UserCreate


def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_user = User.model_validate(user_create, update={"hashed_password": hash_password(user_create.password)})
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(*, session: Session, email: str) -> User | None:
    return session.exec(select(User).where(User.email == email)).first()


def create_item(*, session: Session, item_in: ItemCreate, owner_id: str) -> Item:
    db_item = Item.model_validate(item_in, update={"owner_id": owner_id})
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item
