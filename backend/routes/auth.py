from fastapi import APIRouter, HTTPException, Response, Request, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import httpx
import uuid
import random
import logging

from models.auth import (
    UserCreate, UserInDB, UserResponse, LoginRequest,
    NicknameSet, AuthResponse, NicknameCheckResponse, SessionCreate
)

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Router
router = APIRouter(prefix="/auth", tags=["Authentication"])

# Session expiry (7 days)
SESSION_EXPIRY_DAYS = 7

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def create_session_token() -> str:
    """Generate a secure session token"""
    return f"token_{uuid.uuid4().hex}{uuid.uuid4().hex[:8]}"

async def get_user_by_email(db: AsyncIOMotorDatabase, email: str) -> dict | None:
    """Get user by email (case-insensitive)"""
    return await db.users.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 0}
    )

async def get_user_by_id(db: AsyncIOMotorDatabase, user_id: str) -> dict | None:
    """Get user by user_id"""
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})

async def get_user_by_nickname(db: AsyncIOMotorDatabase, nickname: str) -> dict | None:
    """Get user by nickname (case-insensitive)"""
    return await db.users.find_one(
        {"nickname": {"$regex": f"^{nickname}$", "$options": "i"}},
        {"_id": 0}
    )

async def create_user_session(db: AsyncIOMotorDatabase, user_id: str) -> str:
    """Create a new session for user and return session token"""
    session_token = create_session_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
    
    session = SessionCreate(
        user_id=user_id,
        session_token=session_token,
        expires_at=expires_at
    )
    
    session_dict = session.model_dump()
    session_dict['expires_at'] = session_dict['expires_at'].isoformat()
    session_dict['created_at'] = session_dict['created_at'].isoformat()
    
    await db.user_sessions.insert_one(session_dict)
    return session_token

async def validate_session(db: AsyncIOMotorDatabase, session_token: str) -> dict | None:
    """Validate session token and return user if valid"""
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session:
        return None
    
    # Check expiry
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        # Session expired, delete it
        await db.user_sessions.delete_one({"session_token": session_token})
        return None
    
    # Get user
    user = await get_user_by_id(db, session["user_id"])
    return user

def set_session_cookie(response: Response, session_token: str):
    """Set httpOnly session cookie"""
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60
    )

def clear_session_cookie(response: Response):
    """Clear session cookie"""
    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )

def generate_nickname_suggestions(base: str) -> list[str]:
    """Generate alternative nickname suggestions"""
    suggestions = []
    for _ in range(5):
        suffix = random.randint(1, 999)
        suggestion = f"{base}{suffix}"
        if len(suggestion) <= 20:
            suggestions.append(suggestion)
    return suggestions

# Dependency to get database
def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db

# ==================== ROUTES ====================

@router.post("/register", response_model=AuthResponse)
async def register_email(
    user_data: UserCreate,
    response: Response,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Register a new user with email and password.
    After registration, user must set a unique nickname.
    """
    # Check if email already exists
    existing_user = await get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists"
        )
    
    # Create user
    user = UserInDB(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        auth_provider="email",
        nickname_set=False
    )
    
    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    user_dict['updated_at'] = user_dict['updated_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Create session
    session_token = await create_user_session(db, user.user_id)
    set_session_cookie(response, session_token)
    
    user_response = UserResponse(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        nickname=user.nickname,
        picture=user.picture,
        auth_provider=user.auth_provider,
        nickname_set=user.nickname_set,
        created_at=user.created_at
    )
    
    return AuthResponse(
        user=user_response,
        requires_nickname=True,
        message="Registration successful. Please choose a nickname."
    )

@router.post("/login", response_model=AuthResponse)
async def login_email(
    login_data: LoginRequest,
    response: Response,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Login with email and password.
    """
    # Get user - use generic error message for security
    user = await get_user_by_email(db, login_data.email)
    
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )
    
    # Check if user registered with Google
    if user.get("auth_provider") == "google" and not user.get("password_hash"):
        raise HTTPException(
            status_code=401,
            detail="This account uses Google Sign-In. Please login with Google."
        )
    
    # Verify password
    if not verify_password(login_data.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )
    
    # Create session
    session_token = await create_user_session(db, user["user_id"])
    set_session_cookie(response, session_token)
    
    # Parse created_at
    created_at = user.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    
    user_response = UserResponse(
        user_id=user["user_id"],
        email=user["email"],
        name=user.get("name"),
        nickname=user.get("nickname"),
        picture=user.get("picture"),
        auth_provider=user.get("auth_provider", "email"),
        nickname_set=user.get("nickname_set", False),
        created_at=created_at
    )
    
    requires_nickname = not user.get("nickname_set", False)
    
    return AuthResponse(
        user=user_response,
        requires_nickname=requires_nickname,
        message="Login successful"
    )

@router.post("/google/callback", response_model=AuthResponse)
async def google_callback(
    request: Request,
    response: Response,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Handle Google OAuth callback.
    Exchange session_id for user data from Emergent Auth.
    """
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    # Exchange session_id for user data from Emergent Auth
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    try:
        async with httpx.AsyncClient() as client:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
                timeout=10.0
            )
            
            if auth_response.status_code != 200:
                logger.error(f"Emergent Auth error: {auth_response.status_code} - {auth_response.text}")
                raise HTTPException(status_code=401, detail="Authentication failed")
            
            google_data = auth_response.json()
    except httpx.RequestError as e:
        logger.error(f"Emergent Auth request error: {e}")
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    email = google_data.get("email")
    name = google_data.get("name")
    picture = google_data.get("picture")
    
    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google")
    
    # Check if user exists
    existing_user = await get_user_by_email(db, email)
    
    if existing_user:
        # Update existing user with Google info
        await db.users.update_one(
            {"user_id": existing_user["user_id"]},
            {
                "$set": {
                    "name": name or existing_user.get("name"),
                    "picture": picture or existing_user.get("picture"),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        user_id = existing_user["user_id"]
        nickname_set = existing_user.get("nickname_set", False)
        nickname = existing_user.get("nickname")
        created_at = existing_user.get("created_at")
    else:
        # Create new user
        user = UserInDB(
            email=email,
            name=name,
            picture=picture,
            auth_provider="google",
            nickname_set=False
        )
        
        user_dict = user.model_dump()
        user_dict['created_at'] = user_dict['created_at'].isoformat()
        user_dict['updated_at'] = user_dict['updated_at'].isoformat()
        
        await db.users.insert_one(user_dict)
        user_id = user.user_id
        nickname_set = False
        nickname = None
        created_at = user.created_at
    
    # Create session
    session_token = await create_user_session(db, user_id)
    set_session_cookie(response, session_token)
    
    # Parse created_at
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    
    user_response = UserResponse(
        user_id=user_id,
        email=email,
        name=name,
        nickname=nickname,
        picture=picture,
        auth_provider="google",
        nickname_set=nickname_set,
        created_at=created_at
    )
    
    return AuthResponse(
        user=user_response,
        requires_nickname=not nickname_set,
        message="Google authentication successful"
    )

@router.post("/nickname", response_model=AuthResponse)
async def set_nickname(
    nickname_data: NicknameSet,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Set unique nickname for authenticated user.
    Called after registration (email or Google).
    """
    # Get current user from session
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = await validate_session(db, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    
    nickname = nickname_data.nickname
    
    # Check if nickname is taken (case-insensitive)
    existing = await get_user_by_nickname(db, nickname)
    if existing and existing["user_id"] != user["user_id"]:
        suggestions = generate_nickname_suggestions(nickname)
        raise HTTPException(
            status_code=400,
            detail={
                "message": f"Nickname '{nickname}' is already taken",
                "suggestions": suggestions
            }
        )
    
    # Update user nickname
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "nickname": nickname,
                "nickname_set": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Parse created_at
    created_at = user.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    
    user_response = UserResponse(
        user_id=user["user_id"],
        email=user["email"],
        name=user.get("name"),
        nickname=nickname,
        picture=user.get("picture"),
        auth_provider=user.get("auth_provider", "email"),
        nickname_set=True,
        created_at=created_at
    )
    
    return AuthResponse(
        user=user_response,
        requires_nickname=False,
        message="Nickname set successfully"
    )

@router.get("/nickname/check", response_model=NicknameCheckResponse)
async def check_nickname(
    nickname: str,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Check if a nickname is available.
    """
    # Validate format
    if len(nickname) < 3 or len(nickname) > 20:
        return NicknameCheckResponse(
            available=False,
            message="Nickname must be 3-20 characters"
        )
    
    import re
    if not re.match(r'^[a-zA-Z0-9_]+$', nickname):
        return NicknameCheckResponse(
            available=False,
            message="Nickname can only contain letters, numbers, and underscores"
        )
    
    # Check if taken
    existing = await get_user_by_nickname(db, nickname)
    if existing:
        suggestions = generate_nickname_suggestions(nickname)
        return NicknameCheckResponse(
            available=False,
            message=f"Nickname '{nickname}' is already taken",
            suggestions=suggestions
        )
    
    return NicknameCheckResponse(
        available=True,
        message=f"Nickname '{nickname}' is available"
    )

@router.get("/me", response_model=UserResponse)
async def get_current_user(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Get current authenticated user.
    Checks session_token from cookies first, then Authorization header.
    """
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = await validate_session(db, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    
    # Parse created_at
    created_at = user.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    
    return UserResponse(
        user_id=user["user_id"],
        email=user["email"],
        name=user.get("name"),
        nickname=user.get("nickname"),
        picture=user.get("picture"),
        auth_provider=user.get("auth_provider", "email"),
        nickname_set=user.get("nickname_set", False),
        created_at=created_at
    )

@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Logout user - delete session and clear cookie.
    """
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if session_token:
        # Delete session from database
        await db.user_sessions.delete_many({"session_token": session_token})
    
    # Clear cookie
    clear_session_cookie(response)
    
    return {"message": "Logged out successfully"}
