from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
import uuid
import re


def new_id() -> str:
    return uuid.uuid4().hex


USERNAME_RE = re.compile(r'^[A-Za-z0-9_]{3,20}$')

# Reserved usernames that conflict with app routes or are sensitive.
# These cannot be used as usernames at signup or via profile update.
RESERVED_USERNAMES = {
    'home', 'login', 'logout', 'signin', 'signup', 'register',
    'explore', 'notifications', 'messages', 'bookmarks', 'profile',
    'settings', 'admin', 'administrator', 'mod', 'moderator',
    'tweet', 'tweets', 'post', 'posts', 'status', 'statuses',
    'api', 'app', 'www', 'mail', 'email', 'support', 'help',
    'about', 'contact', 'terms', 'privacy', 'policy', 'tos',
    'search', 'discover', 'trending', 'topic', 'topics', 'tag', 'tags',
    'user', 'users', 'me', 'you', 'null', 'undefined', 'true', 'false',
    'ksa1', 'official', 'verified', 'staff', 'team',
    'u',  # avoid collision with legacy /u/:username route
}


def _validate_username_str(v: str) -> str:
    v = v.strip().lstrip('@')
    if not USERNAME_RE.match(v):
        raise ValueError('username must be 3-20 chars: letters, digits, underscore')
    if v.lower() in RESERVED_USERNAMES:
        raise ValueError('username is reserved')
    return v.lower()


class SignupStart(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    username: str
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)

    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        if v is None:
            return v
        return _validate_username_str(v)


class SignupVerify(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuth(BaseModel):
    name: str
    email: EmailStr
    avatar: Optional[str] = ''


class ForgotPasswordStart(BaseModel):
    email: EmailStr


class ForgotPasswordVerify(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=6, max_length=100)


class UpdateProfile(BaseModel):
    name: Optional[str] = Field(default=None, max_length=50)
    username: Optional[str] = None
    bio: Optional[str] = Field(default=None, max_length=160)
    location: Optional[str] = Field(default=None, max_length=30)
    avatar: Optional[str] = None
    cover: Optional[str] = None

    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        if v is None:
            return v
        return _validate_username_str(v)


class TweetCreate(BaseModel):
    content: str = Field(min_length=1, max_length=280)
    image: Optional[str] = None
    parent_id: Optional[str] = None


class UsernameCheck(BaseModel):
    username: str
