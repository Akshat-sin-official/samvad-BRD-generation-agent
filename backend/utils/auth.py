import os
from typing import Optional

import firebase_admin
from firebase_admin import auth, credentials
from fastapi import Depends, HTTPException, Request, status

from ..config import FIREBASE_PROJECT_ID
from ..services.firestore_client import upsert_user


def init_firebase():
    """Initialize Firebase Admin SDK against the correct Firebase project."""
    try:
        firebase_admin.get_app()
    except ValueError:
        options = (
            {"projectId": FIREBASE_PROJECT_ID}
            if FIREBASE_PROJECT_ID and FIREBASE_PROJECT_ID != "your-project-id"
            else {}
        )
        key_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "service_account_key.json")
        if os.path.exists(key_path):
            print(f"[Firebase] Using service account key (project={FIREBASE_PROJECT_ID})")
            cred = credentials.Certificate(key_path)
            firebase_admin.initialize_app(cred, options=options)
        else:
            print(f"[Firebase] Using Application Default Credentials (project={FIREBASE_PROJECT_ID})")
            firebase_admin.initialize_app(options=options)


class CurrentUser:
    def __init__(self, user_id: str, email: Optional[str], display_name: Optional[str], photo_url: Optional[str]):
        self.user_id = user_id
        self.email = email
        self.display_name = display_name
        self.photo_url = photo_url


async def get_current_user(request: Request) -> CurrentUser:
    init_firebase()
    
    auth_header: str = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )

    token = auth_header.split(" ", 1)[1]
    try:
        # Verify the ID token using Firebase Admin SDK
        decoded = auth.verify_id_token(token)
    except Exception as e:
        print(f"Token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid ID token: {str(e)}",
        )

    user_id = decoded.get("uid")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Enforce email verification for password-based sign-in
    sign_in_provider = decoded.get("firebase", {}).get("sign_in_provider", "")
    if sign_in_provider == "password" and not decoded.get("email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email address before accessing this resource.",
        )

    email = decoded.get("email")
    display_name = decoded.get("name")
    photo_url = decoded.get("picture")

    user = CurrentUser(
        user_id=user_id,
        email=email,
        display_name=display_name,
        photo_url=photo_url,
    )

    upsert_user(
        {
            "user_id": user.user_id,
            "email": user.email,
            "display_name": user.display_name,
            "photo_url": user.photo_url,
        }
    )

    return user


CurrentUserDep = Depends(get_current_user)


async def get_optional_current_user(request: Request) -> Optional[CurrentUser]:
    auth_header: str = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    try:
        return await get_current_user(request)
    except Exception as e:
        print(f"[Auth] Optional auth check failed: {e}")
        return None


OptionalCurrentUserDep = Depends(get_optional_current_user)
