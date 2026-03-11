import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SQLITE_PATH = BASE_DIR / 'luminex.db'

load_dotenv(BASE_DIR / '.env')

SQLALCHEMY_DATABASE_URL = os.getenv(
    'DATABASE_URL',
    f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}",
)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={'check_same_thread': False},
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)

Base = declarative_base()


def init_db() -> None:
    # Import models here so SQLAlchemy metadata is fully registered before create_all.
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
