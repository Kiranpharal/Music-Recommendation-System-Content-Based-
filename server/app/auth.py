# server/app/auth.py

from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone  # Added timezone

SECRET_KEY = "YOUR_SECRET_KEY"  # change to a secure random key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60*24  # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ─── Password Hashing ───
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)

# ─── JWT Token ───
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    # Use timezone-aware UTC datetime instead of deprecated utcnow()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
