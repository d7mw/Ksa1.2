from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime
import uuid
import re


def new_id() -> str:
    return uuid.uuid4().hex


USERNAME_RE = re.compile(r'^[A-Za-z0-9_]{3,20}$')


class SignupStart(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    username: str
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str):
        v = v.strip().lstrip('@')
        if not USERNAME_RE.match(v):
            raise ValueError('username must be 3-20 chars: letters, digits, underscore')
        return v.lower()


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
        v = v.strip().lstrip('@')
        if not USERNAME_RE.match(v):
            raise ValueError('username must be 3-20 chars: letters, digits, underscore')
        return v.lower()


class TweetCreate(BaseModel):
    content: str = Field(min_length=1, max_length=280)
    image: Optional[str] = None
    parent_id: Optional[str] = None


class UsernameCheck(BaseModel):
    username: str
