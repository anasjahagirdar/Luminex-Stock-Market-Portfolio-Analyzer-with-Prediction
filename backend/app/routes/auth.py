import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models import Portfolio, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/auth', tags=['auth'])

SECURITY_QUESTIONS = [
    'What was the name of your first pet?',
    "What is your mother's maiden name?",
    'What city were you born in?',
    'What was the name of your first school?',
    'What is your favorite movie?',
]


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6, max_length=256)
    security_question: str
    security_answer: str = Field(min_length=1, max_length=256)


class LoginRequest(BaseModel):
    username: str
    password: str


class ForgotPasswordRequest(BaseModel):
    username: str
    security_answer: str
    new_password: str = Field(min_length=6, max_length=256)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    username: str
    user_id: int


@router.get('/security-questions')
def get_security_questions():
    return {'questions': SECURITY_QUESTIONS}


@router.get('/security-question/{username}')
def get_user_security_question(username: str, db: Session = Depends(get_db)):
    normalized_username = username.strip()

    user = (
        db.query(User)
        .filter(func.lower(User.username) == normalized_username.lower())
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='User not found',
        )
    return {'security_question': user.security_question}


@router.post('/register', response_model=TokenResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    username = request.username.strip()
    email = request.email.strip().lower()

    logger.info('REGISTER_ATTEMPT username=%s email=%s', username, email)

    if request.security_question not in SECURITY_QUESTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Invalid security question',
        )

    existing_user = (
        db.query(User)
        .filter(func.lower(User.username) == username.lower())
        .first()
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Username already exists',
        )

    existing_email = (
        db.query(User)
        .filter(func.lower(User.email) == email.lower())
        .first()
    )
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Email already registered',
        )

    hashed_password = hash_password(request.password)
    hashed_answer = hash_password(request.security_answer.lower().strip())

    new_user = User(
        username=username,
        email=email,
        password_hash=hashed_password,
        security_question=request.security_question,
        security_answer=hashed_answer,
        created_at=datetime.utcnow(),
    )
    db.add(new_user)

    try:
        db.flush()

        default_portfolio = Portfolio(
            user_id=new_user.id,
            name='My Portfolio',
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(default_portfolio)

        db.commit()
        db.refresh(new_user)
    except Exception:
        db.rollback()
        logger.exception('REGISTER_FAILED username=%s', username)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Registration failed',
        )

    token = create_access_token({'sub': str(new_user.id), 'username': new_user.username})
    logger.info('REGISTER_SUCCESS username=%s user_id=%s', new_user.username, new_user.id)

    return TokenResponse(
        access_token=token,
        token_type='bearer',
        username=new_user.username,
        user_id=new_user.id,
    )


@router.post('/login', response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    username = request.username.strip()
    logger.info('LOGIN_ATTEMPT username=%s', username)

    user = (
        db.query(User)
        .filter(func.lower(User.username) == username.lower())
        .first()
    )

    if not user:
        logger.info('LOGIN_USER_NOT_FOUND username=%s', username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid username or password',
        )

    logger.info('LOGIN_USER_FOUND username=%s user_id=%s', user.username, user.id)

    if not verify_password(request.password, user.password_hash):
        logger.info('LOGIN_PASSWORD_INVALID username=%s user_id=%s', user.username, user.id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid username or password',
        )

    logger.info('LOGIN_PASSWORD_VERIFIED username=%s user_id=%s', user.username, user.id)
    token = create_access_token({'sub': str(user.id), 'username': user.username})
    logger.info('LOGIN_TOKEN_GENERATED username=%s user_id=%s', user.username, user.id)

    return TokenResponse(
        access_token=token,
        token_type='bearer',
        username=user.username,
        user_id=user.id,
    )


@router.post('/forgot-password')
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    username = request.username.strip()

    user = (
        db.query(User)
        .filter(func.lower(User.username) == username.lower())
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='User not found',
        )

    answer = request.security_answer.lower().strip()
    if not user.security_answer or not verify_password(answer, user.security_answer):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Incorrect security answer',
        )

    user.password_hash = hash_password(request.new_password)

    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception('FORGOT_PASSWORD_FAILED username=%s', username)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Password reset failed',
        )

    logger.info('FORGOT_PASSWORD_SUCCESS username=%s user_id=%s', user.username, user.id)
    return {'message': 'Password reset successful'}
