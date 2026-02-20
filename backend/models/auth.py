from pydantic import BaseModel, Field, EmailStr, field_validator, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid
import re

# User Models
class UserBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    email: EmailStr
    name: Optional[str] = None
    picture: Optional[str] = None

class UserCreate(BaseModel):
    """Email/Password registration"""
    email: EmailStr
    password: str
    confirm_password: str
    
    @field_validator('password')
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        return v
    
    @field_validator('confirm_password')
    @classmethod
    def passwords_match(cls, v, info):
        if 'password' in info.data and v != info.data['password']:
            raise ValueError('Passwords do not match')
        return v

class UserInDB(UserBase):
    """User stored in database"""
    user_id: str = Field(default_factory=lambda: f"user_{uuid.uuid4().hex[:12]}")
    nickname: Optional[str] = None
    password_hash: Optional[str] = None  # None for OAuth users
    auth_provider: str = "email"  # "email" or "google"
    nickname_set: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(BaseModel):
    """User data returned to frontend"""
    model_config = ConfigDict(extra="ignore")
    
    user_id: str
    email: str
    name: Optional[str] = None
    nickname: Optional[str] = None
    picture: Optional[str] = None
    auth_provider: str
    nickname_set: bool
    nickname_changed: bool = False
    created_at: datetime
    points: int = 0
    level: int = 0
    role: Optional[str] = None  # Only populated for the user's own /me response

class NicknameSet(BaseModel):
    """Nickname selection request"""
    nickname: str
    
    @field_validator('nickname')
    @classmethod
    def validate_nickname(cls, v):
        # Check length
        if len(v) < 3 or len(v) > 20:
            raise ValueError('Nickname must be 3-20 characters')
        
        # Check allowed characters (letters, numbers, underscore only)
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Nickname can only contain letters, numbers, and underscores')
        
        # Check no spaces
        if ' ' in v:
            raise ValueError('Nickname cannot contain spaces')
        
        return v

class LoginRequest(BaseModel):
    """Email/Password login"""
    email: EmailStr
    password: str

class SessionCreate(BaseModel):
    """Session stored in database"""
    model_config = ConfigDict(extra="ignore")
    
    session_id: str = Field(default_factory=lambda: f"sess_{uuid.uuid4().hex}")
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AuthResponse(BaseModel):
    """Response after successful authentication"""
    user: UserResponse
    requires_nickname: bool = False
    message: str = "Authentication successful"

class NicknameCheckResponse(BaseModel):
    """Response for nickname availability check"""
    available: bool
    message: str
    suggestions: Optional[list[str]] = None
