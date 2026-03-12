import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
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


def ensure_performance_indexes() -> None:
    statements = [
        """
        CREATE INDEX IF NOT EXISTS ix_portfolios_user_name
        ON portfolios (user_id, name)
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_portfolio_items_portfolio_symbol
        ON portfolio_items (portfolio_id, symbol)
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_api_cache_endpoint_symbol_expires
        ON api_cache (endpoint, symbol, expires_at)
        """,
    ]

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def init_db() -> None:
    # Import models here so SQLAlchemy metadata is fully registered before create_all.
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    ensure_performance_indexes()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
