"""
Settings Routes - Account settings management
"""
from fastapi import APIRouter, HTTPException, Request, Depends, UploadFile, File
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, field_validator
import os
import uuid
import re
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Router
router = APIRouter(prefix="/settings", tags=["Settings"])

# Upload directory for profile pictures
UPLOAD_DIR = Path("/app/backend/uploads/avatars")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Allowed file types and max size
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB

# ==================== Models ====================

class ChangeEmailRequest(BaseModel):
    """Request to change email"""
    new_email: EmailStr
    current_password: str

class ChangePasswordRequest(BaseModel):
    """Request to change password"""
    current_password: str
    new_password: str
    confirm_password: str
    
    @field_validator('new_password')
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
        if 'new_password' in info.data and v != info.data['new_password']:
            raise ValueError('Passwords do not match')
        return v

class ChangeNicknameRequest(BaseModel):
    """Request to change nickname (one-time only)"""
    new_nickname: str
    
    @field_validator('new_nickname')
    @classmethod
    def validate_nickname(cls, v):
        if len(v) < 3 or len(v) > 20:
            raise ValueError('Nickname must be 3-20 characters')
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Nickname can only contain letters, numbers, and underscores')
        if ' ' in v:
            raise ValueError('Nickname cannot contain spaces')
        return v

class SettingsResponse(BaseModel):
    """Generic settings response"""
    success: bool
    message: str
    data: dict = None

class OnlineVisibilityRequest(BaseModel):
    """Toggle online visibility"""
    visible: bool

class NotificationSoundRequest(BaseModel):
    """Toggle notification sounds"""
    enabled: bool

class ReadReceiptsRequest(BaseModel):
    """Toggle read receipts"""
    enabled: bool

class DeliveryStatusRequest(BaseModel):
    """Toggle delivery status visibility"""
    enabled: bool

# ==================== Helper Functions ====================

def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return pwd_context.hash(password)

async def get_current_user(request: Request, db: AsyncIOMotorDatabase) -> dict:
    """Get current authenticated user from session"""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Validate session
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    
    # Check expiry
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        await db.user_sessions.delete_one({"session_token": session_token})
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

# ==================== Routes ====================

@router.get("/profile", response_model=SettingsResponse)
async def get_settings_profile(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get user settings profile data"""
    user = await get_current_user(request, db)
    
    return SettingsResponse(
        success=True,
        message="Profile loaded",
        data={
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user.get("name"),
            "nickname": user.get("nickname"),
            "picture": user.get("picture"),
            "auth_provider": user.get("auth_provider", "email"),
            "nickname_set": user.get("nickname_set", False),
            "nickname_changed": user.get("nickname_changed", False),
            "can_change_nickname": user.get("nickname_set", False) and not user.get("nickname_changed", False),
            "is_google_user": user.get("auth_provider") == "google",
            "created_at": user.get("created_at")
        }
    )

@router.post("/email", response_model=SettingsResponse)
async def change_email(
    data: ChangeEmailRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Change user email address.
    Requires current password for security.
    """
    user = await get_current_user(request, db)
    
    # Google users cannot change email
    if user.get("auth_provider") == "google":
        raise HTTPException(
            status_code=400,
            detail="Google account users cannot change their email address"
        )
    
    # Verify current password
    if not user.get("password_hash"):
        raise HTTPException(status_code=400, detail="No password set for this account")
    
    if not verify_password(data.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Check if new email is the same as current
    if data.new_email.lower() == user["email"].lower():
        raise HTTPException(status_code=400, detail="New email is the same as current email")
    
    # Check if email is already taken
    existing = await db.users.find_one(
        {"email": {"$regex": f"^{data.new_email}$", "$options": "i"}},
        {"_id": 0}
    )
    if existing and existing["user_id"] != user["user_id"]:
        raise HTTPException(status_code=400, detail="Email address is already in use")
    
    # Update email
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "email": data.new_email,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    logger.info(f"User {user['user_id']} changed email from {user['email']} to {data.new_email}")
    
    return SettingsResponse(
        success=True,
        message="Email updated successfully",
        data={"email": data.new_email}
    )

@router.post("/password", response_model=SettingsResponse)
async def change_password(
    data: ChangePasswordRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Change user password.
    Requires current password for security.
    """
    user = await get_current_user(request, db)
    
    # Google users cannot change password
    if user.get("auth_provider") == "google" and not user.get("password_hash"):
        raise HTTPException(
            status_code=400,
            detail="Google account users must set a password first via 'Set Password' flow"
        )
    
    # Verify current password
    if not user.get("password_hash"):
        raise HTTPException(status_code=400, detail="No password set for this account")
    
    if not verify_password(data.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Check new password is different
    if verify_password(data.new_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="New password must be different from current password")
    
    # Hash and update password
    new_password_hash = hash_password(data.new_password)
    
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "password_hash": new_password_hash,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    logger.info(f"User {user['user_id']} changed their password")
    
    return SettingsResponse(
        success=True,
        message="Password updated successfully"
    )

@router.post("/nickname", response_model=SettingsResponse)
async def change_nickname(
    data: ChangeNicknameRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Change nickname - ONE TIME ONLY.
    After changing once, nickname_changed is set to True and cannot be changed again.
    """
    user = await get_current_user(request, db)
    
    # Check if nickname was already set initially
    if not user.get("nickname_set", False):
        raise HTTPException(
            status_code=400,
            detail="Please set your initial nickname first"
        )
    
    # Check if nickname was already changed (one-time rule)
    if user.get("nickname_changed", False):
        raise HTTPException(
            status_code=400,
            detail="You have already used your one-time nickname change. Nickname cannot be changed again."
        )
    
    # Check if new nickname is the same as current
    if data.new_nickname.lower() == (user.get("nickname") or "").lower():
        raise HTTPException(status_code=400, detail="New nickname is the same as current nickname")
    
    # Check if nickname is taken
    existing = await db.users.find_one(
        {"nickname": {"$regex": f"^{data.new_nickname}$", "$options": "i"}},
        {"_id": 0}
    )
    if existing and existing["user_id"] != user["user_id"]:
        raise HTTPException(status_code=400, detail=f"Nickname '{data.new_nickname}' is already taken")
    
    # Update nickname and set nickname_changed to True (one-time rule)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "nickname": data.new_nickname,
                "nickname_changed": True,  # Mark as changed - cannot change again
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    logger.info(f"User {user['user_id']} changed nickname from {user.get('nickname')} to {data.new_nickname} (one-time change used)")
    
    return SettingsResponse(
        success=True,
        message="Nickname updated successfully. Note: This was your one-time nickname change.",
        data={
            "nickname": data.new_nickname,
            "nickname_changed": True,
            "can_change_nickname": False
        }
    )

@router.post("/avatar", response_model=SettingsResponse)
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Upload profile avatar image.
    Accepts: jpg, jpeg, png, webp
    Max size: 2MB
    """
    user = await get_current_user(request, db)
    
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower() if file.filename else ''
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Read and validate file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    # Validate it's actually an image by checking magic bytes
    image_signatures = {
        b'\xff\xd8\xff': 'jpg',
        b'\x89PNG\r\n\x1a\n': 'png',
        b'RIFF': 'webp'  # WebP starts with RIFF
    }
    
    is_valid_image = False
    for sig in image_signatures.keys():
        if contents[:len(sig)] == sig:
            is_valid_image = True
            break
    
    # Also check for WebP specifically (RIFF....WEBP)
    if contents[:4] == b'RIFF' and contents[8:12] == b'WEBP':
        is_valid_image = True
    
    if not is_valid_image:
        raise HTTPException(status_code=400, detail="Invalid image file")
    
    # Generate unique filename
    filename = f"{user['user_id']}_{uuid.uuid4().hex[:8]}{file_ext}"
    file_path = UPLOAD_DIR / filename
    
    # Delete old avatar if exists (different from current)
    old_picture = user.get("picture")
    if old_picture and old_picture.startswith("/api/uploads/avatars/"):
        old_filename = old_picture.split("/")[-1]
        old_file_path = UPLOAD_DIR / old_filename
        if old_file_path.exists() and old_file_path != file_path:
            try:
                old_file_path.unlink()
                logger.info(f"Deleted old avatar: {old_filename}")
            except Exception as e:
                logger.warning(f"Could not delete old avatar: {e}")
    
    # Save new file
    with open(file_path, 'wb') as f:
        f.write(contents)
    
    # Generate URL path for the avatar
    avatar_url = f"/api/uploads/avatars/{filename}"
    
    # Update user picture in database
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "picture": avatar_url,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    logger.info(f"User {user['user_id']} uploaded new avatar: {filename}")
    
    return SettingsResponse(
        success=True,
        message="Profile picture updated successfully",
        data={"picture": avatar_url}
    )

@router.delete("/avatar", response_model=SettingsResponse)
async def remove_avatar(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Remove profile avatar"""
    user = await get_current_user(request, db)
    
    old_picture = user.get("picture")
    
    # Delete file if it's a local upload
    if old_picture and old_picture.startswith("/api/uploads/avatars/"):
        old_filename = old_picture.split("/")[-1]
        old_file_path = UPLOAD_DIR / old_filename
        if old_file_path.exists():
            try:
                old_file_path.unlink()
                logger.info(f"Deleted avatar file: {old_filename}")
            except Exception as e:
                logger.warning(f"Could not delete avatar file: {e}")
    
    # Clear picture in database
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "picture": None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return SettingsResponse(
        success=True,
        message="Profile picture removed"
    )

@router.get("/nickname/status", response_model=SettingsResponse)
async def get_nickname_change_status(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Check if user can change nickname (one-time rule)"""
    user = await get_current_user(request, db)
    
    nickname_set = user.get("nickname_set", False)
    nickname_changed = user.get("nickname_changed", False)
    can_change = nickname_set and not nickname_changed
    
    return SettingsResponse(
        success=True,
        message="Nickname change status retrieved",
        data={
            "current_nickname": user.get("nickname"),
            "nickname_set": nickname_set,
            "nickname_changed": nickname_changed,
            "can_change_nickname": can_change
        }
    )


@router.post("/online-visibility", response_model=SettingsResponse)
async def set_online_visibility(
    data: OnlineVisibilityRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Toggle online/offline visibility to other users"""
    user = await get_current_user(request, db)

    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"online_visibility": data.visible, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    return SettingsResponse(
        success=True,
        message=f"Online visibility {'enabled' if data.visible else 'disabled'}",
        data={"online_visibility": data.visible}
    )

@router.get("/online-visibility", response_model=SettingsResponse)
async def get_online_visibility(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get current online visibility setting"""
    user = await get_current_user(request, db)

    return SettingsResponse(
        success=True,
        message="Online visibility status",
        data={"online_visibility": user.get("online_visibility", True)}
    )

@router.post("/notification-sound", response_model=SettingsResponse)
async def set_notification_sound(
    data: NotificationSoundRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Toggle notification sounds"""
    user = await get_current_user(request, db)

    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"notification_sound": data.enabled, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    return SettingsResponse(
        success=True,
        message=f"Notification sounds {'enabled' if data.enabled else 'disabled'}",
        data={"notification_sound": data.enabled}
    )

@router.get("/notification-sound", response_model=SettingsResponse)
async def get_notification_sound(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get notification sound setting"""
    user = await get_current_user(request, db)

    return SettingsResponse(
        success=True,
        message="Notification sound status",
        data={"notification_sound": user.get("notification_sound", True)}
    )

@router.get("/preferences", response_model=SettingsResponse)
async def get_all_preferences(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get all user preferences at once"""
    user = await get_current_user(request, db)

    return SettingsResponse(
        success=True,
        message="Preferences loaded",
        data={
            "online_visibility": user.get("online_visibility", True),
            "notification_sound": user.get("notification_sound", True),
            "read_receipts_enabled": user.get("read_receipts_enabled", True),
            "delivery_status_enabled": user.get("delivery_status_enabled", True)
        }
    )

@router.post("/read-receipts", response_model=SettingsResponse)
async def set_read_receipts(
    data: ReadReceiptsRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Toggle read receipts - if disabled, sender cannot see when you read messages"""
    user = await get_current_user(request, db)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"read_receipts_enabled": data.enabled, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return SettingsResponse(
        success=True,
        message=f"Read receipts {'enabled' if data.enabled else 'disabled'}",
        data={"read_receipts_enabled": data.enabled}
    )

@router.post("/delivery-status", response_model=SettingsResponse)
async def set_delivery_status(
    data: DeliveryStatusRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Toggle delivery status visibility"""
    user = await get_current_user(request, db)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"delivery_status_enabled": data.enabled, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return SettingsResponse(
        success=True,
        message=f"Delivery status {'enabled' if data.enabled else 'disabled'}",
        data={"delivery_status_enabled": data.enabled}
    )
