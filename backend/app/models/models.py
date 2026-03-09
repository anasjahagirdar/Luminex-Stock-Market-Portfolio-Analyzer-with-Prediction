from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship, synonym

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)

    # Map password_hash attribute to existing DB column name "hashed_password"
    # so old users can still log in without migration.
    password_hash = Column("hashed_password", String, nullable=False)

    # Backward-compat alias for existing code that still uses `hashed_password`
    hashed_password = synonym("password_hash")

    security_question = Column(String, nullable=True)
    security_answer = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    portfolios = relationship(
        "Portfolio",
        back_populates="owner",
        cascade="all, delete-orphan",
    )

    # Legacy compatibility: existing routes may still use user -> portfolio_items directly
    portfolio_items = relationship("PortfolioItem", back_populates="owner")


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    name = Column(String, nullable=False, default="My Portfolio")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="portfolios")
    items = relationship(
        "PortfolioItem",
        back_populates="portfolio",
        cascade="all, delete-orphan",
    )


class PortfolioItem(Base):
    __tablename__ = "portfolio_items"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), index=True, nullable=False)

    # Legacy compatibility (old schema used user_id directly on items)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)

    symbol = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    avg_buy_price = Column(Float, nullable=False)
    sector = Column(String, nullable=True)
    market = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    portfolio = relationship("Portfolio", back_populates="items")
    owner = relationship("User", back_populates="portfolio_items")


class Stock(Base):
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    exchange = Column(String, nullable=True)
    market = Column(String, nullable=True)
    sector = Column(String, nullable=True)
    currency = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class StockHistory(Base):
    __tablename__ = "stock_history"
    __table_args__ = (
        Index("ix_stock_history_symbol_date", "symbol", "date"),
        UniqueConstraint("symbol", "date", name="uq_stock_history_symbol_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True, nullable=False)
    date = Column(Date, index=True, nullable=False)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(BigInteger, nullable=False, default=0)
    source = Column(String, nullable=True)  # yahoo | alphavantage | cache
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SectorMapping(Base):
    __tablename__ = "sector_mapping"
    __table_args__ = (
        UniqueConstraint("symbol", name="uq_sector_mapping_symbol"),
    )

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True, nullable=False)
    sector = Column(String, nullable=False)
    market = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class MLFeature(Base):
    __tablename__ = "ml_features"
    __table_args__ = (
        Index("ix_ml_features_symbol_date", "symbol", "date"),
        UniqueConstraint("symbol", "date", name="uq_ml_features_symbol_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True, nullable=False)
    date = Column(Date, index=True, nullable=False)
    lag_1 = Column(Float, nullable=True)
    lag_7 = Column(Float, nullable=True)
    rolling_mean_7 = Column(Float, nullable=True)
    rolling_std_7 = Column(Float, nullable=True)
    momentum = Column(Float, nullable=True)
    volatility = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class MLPrediction(Base):
    __tablename__ = "ml_predictions"
    __table_args__ = (
        Index("ix_ml_predictions_symbol_model_date", "symbol", "model", "prediction_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True, nullable=False)
    model = Column(String, index=True, nullable=False)  # linear_regression | kmeans | xgboost | lstm
    prediction_date = Column(Date, index=True, nullable=False)
    predicted_price = Column(Float, nullable=False)
    confidence = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class APICache(Base):
    __tablename__ = "api_cache"
    __table_args__ = (
        Index("ix_api_cache_endpoint_symbol", "endpoint", "symbol"),
        Index("ix_api_cache_expires_at", "expires_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    endpoint = Column(String, index=True, nullable=False)
    symbol = Column(String, index=True, nullable=True)
    response_json = Column(Text, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
