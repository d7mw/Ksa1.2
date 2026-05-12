import os
import jwt
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

pwd_ctx = CryptContext(schemes=['bcrypt'], deprecated='auto')
bearer = HTTPBearer(auto_error=False)

SECRET = os.environ.get('JWT_SECRET', 'change-me')
EXPIRE_DAYS = int(os.environ.get('JWT_EXPIRE_DAYS', '30'))
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', '').lower()


def hash_password(pw: str) -> str:
    return pwd_ctx.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return pwd_ctx.verify(pw, hashed)
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {
        'sub': user_id,
        'iat': datetime.now(timezone.utc),
        'exp': datetime.now(timezone.utc) + timedelta(days=EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET, algorithm='HS256')


def decode_token(token: str) -> str:
    try:
        data = jwt.decode(token, SECRET, algorithms=['HS256'])
        return data['sub']
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, 'Token expired')
    except Exception:
        raise HTTPException(401, 'Invalid token')


async def get_db():
    from server import db
    return db


async def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    if not creds:
        raise HTTPException(401, 'Not authenticated')
    user_id = decode_token(creds.credentials)
    from server import db
    user = await db.users.find_one({'id': user_id})
    if not user:
        raise HTTPException(401, 'User not found')
    user['is_admin'] = (user.get('email', '').lower() == ADMIN_EMAIL)
    return user


async def optional_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    if not creds:
        return None
    try:
        return await current_user(creds)
    except Exception:
        return None


async def require_admin(user=Depends(current_user)):
    if not user.get('is_admin'):
        raise HTTPException(403, 'Admin only')
    return user


def public_user(u: dict, viewer_id: str | None = None) -> dict:
    if not u:
        return None
    return {
        'id': u['id'],
        'name': u.get('name', ''),
        'username': u.get('username', ''),
        'email': u.get('email', '') if viewer_id == u['id'] else None,
        'bio': u.get('bio', ''),
        'location': u.get('location', ''),
        'avatar': u.get('avatar', ''),
        'cover': u.get('cover', ''),
        'verified': u.get('verified', False),
        'verification_requested': u.get('verification_requested', False),
        'is_admin': u.get('email', '').lower() == ADMIN_EMAIL,
        'is_private': u.get('is_private', False),
        'email_notifications_disabled': u.get('email_notifications_disabled', False) if viewer_id == u['id'] else None,
        'followers_count': u.get('followers_count', 0),
        'following_count': u.get('following_count', 0),
        'created_at': u.get('created_at'),
    }
