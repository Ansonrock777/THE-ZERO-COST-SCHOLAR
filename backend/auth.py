# backend/auth.py
from fastapi import HTTPException, Header
from jose import jwt, JWTError
import httpx
import os

SUPABASE_URL = os.getenv('SUPABASE_URL')
JWKS_URL = f'{SUPABASE_URL}/auth/v1/.well-known/jwks.json'

_jwks_cache = None


def _get_signing_key(kid: str):
    """Fetch and cache Supabase's public JWKS, find the key matching kid."""
    global _jwks_cache
    if _jwks_cache is None:
        response = httpx.get(JWKS_URL, timeout=10)
        response.raise_for_status()
        _jwks_cache = response.json()['keys']
    return next((k for k in _jwks_cache if k['kid'] == kid), None)


def get_current_user(authorization: str = Header(...)):
    """Extract and verify the Supabase JWT from the Authorization header.

    Supabase signs tokens with an asymmetric key (ES256/RS256) by default,
    so verification uses the project's public JWKS rather than a shared secret.
    """
    try:
        token = authorization.replace('Bearer ', '')
        unverified_header = jwt.get_unverified_header(token)
        signing_key = _get_signing_key(unverified_header.get('kid'))
        if signing_key is None:
            raise HTTPException(status_code=401, detail='Signing key not found')

        payload = jwt.decode(
            token,
            signing_key,
            algorithms=[unverified_header['alg']],
            options={'verify_aud': False}  # Supabase doesn't use 'aud'
        )
        user_id = payload.get('sub')  # 'sub' is the user's UUID
        if not user_id:
            raise HTTPException(status_code=401, detail='Invalid token')
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail='Token expired or invalid')
