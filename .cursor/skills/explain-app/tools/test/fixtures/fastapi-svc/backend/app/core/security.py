import hashlib
import secrets


def hash_password(password: str) -> str:
    salt = secrets.token_hex(8)
    return salt + "$" + hashlib.sha256((salt + password).encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    salt, _, digest = hashed.partition("$")
    return hashlib.sha256((salt + password).encode()).hexdigest() == digest
