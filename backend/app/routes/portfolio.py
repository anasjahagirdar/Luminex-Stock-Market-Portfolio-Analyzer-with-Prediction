from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.auth import decode_token
from app.database import get_db
from app.models import Portfolio, PortfolioItem, User

router = APIRouter(prefix="/portfolio", tags=["portfolio"])
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


def get_or_create_default_portfolio(db: Session, user_id: int) -> Portfolio:
    portfolio = (
        db.query(Portfolio)
        .filter(Portfolio.user_id == user_id, Portfolio.name == "My Portfolio")
        .first()
    )
    if portfolio:
        return portfolio

    existing_any = (
        db.query(Portfolio)
        .filter(Portfolio.user_id == user_id)
        .order_by(Portfolio.id.asc())
        .first()
    )
    if existing_any:
        return existing_any

    portfolio = Portfolio(
        user_id=user_id,
        name="My Portfolio",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(portfolio)
    db.commit()
    db.refresh(portfolio)
    return portfolio


def infer_market_from_symbol(symbol: str) -> str:
    s = (symbol or "").upper()
    if s.endswith(".BSE") or s.endswith(".NSE"):
        return "india"
    return "international"


def normalize_sector(value: Optional[str]) -> str:
    v = (value or "").strip().lower()
    return v if v else "unknown"


def raise_schema_drift_if_needed(error: OperationalError) -> None:
    msg = str(error).lower()
    drift_markers = [
        "portfolio_items.portfolio_id",
        "portfolio_items.market",
        "has no column named portfolio_id",
        "has no column named market",
    ]
    if "no such column" in msg or "has no column named" in msg:
        if any(marker in msg for marker in drift_markers):
            raise HTTPException(
                status_code=500,
                detail="Database schema drift detected for portfolio_items. Run the portfolio_items migration script to add portfolio_id and market columns.",
            )


class PortfolioItemRequest(BaseModel):
    symbol: str
    name: str
    quantity: float = Field(gt=0)
    avg_buy_price: float = Field(gt=0)
    sector: Optional[str] = None
    market: Optional[str] = None


class PortfolioItemResponse(BaseModel):
    id: int
    symbol: str
    name: str
    quantity: float
    avg_buy_price: float
    sector: Optional[str] = None
    market: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=List[PortfolioItemResponse])
def get_portfolio(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    portfolio = get_or_create_default_portfolio(db, current_user.id)

    try:
        items = (
            db.query(PortfolioItem)
            .filter(PortfolioItem.portfolio_id == portfolio.id)
            .order_by(PortfolioItem.created_at.desc(), PortfolioItem.id.desc())
            .all()
        )
    except OperationalError as e:
        raise_schema_drift_if_needed(e)
        raise

    return items


@router.post("/add", response_model=PortfolioItemResponse)
def add_portfolio_item(
    request: PortfolioItemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    portfolio = get_or_create_default_portfolio(db, current_user.id)

    symbol = request.symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")

    market = (request.market or "").strip().lower() or infer_market_from_symbol(symbol)
    sector = normalize_sector(request.sector)

    try:
        existing = (
            db.query(PortfolioItem)
            .filter(
                PortfolioItem.portfolio_id == portfolio.id,
                PortfolioItem.symbol == symbol,
            )
            .first()
        )
    except OperationalError as e:
        raise_schema_drift_if_needed(e)
        raise

    if existing:
        old_qty = float(existing.quantity)
        new_qty = float(request.quantity)
        total_qty = old_qty + new_qty

        if total_qty > 0:
            existing.avg_buy_price = (
                (old_qty * float(existing.avg_buy_price))
                + (new_qty * float(request.avg_buy_price))
            ) / total_qty

        existing.quantity = total_qty
        existing.name = request.name
        existing.sector = sector
        existing.market = market
        portfolio.updated_at = datetime.utcnow()

        try:
            db.commit()
            db.refresh(existing)
        except OperationalError as e:
            db.rollback()
            raise_schema_drift_if_needed(e)
            raise
        except Exception:
            db.rollback()
            raise

        return existing

    new_item = PortfolioItem(
        portfolio_id=portfolio.id,
        user_id=current_user.id,
        symbol=symbol,
        name=request.name,
        quantity=request.quantity,
        avg_buy_price=request.avg_buy_price,
        sector=sector,
        market=market,
        created_at=datetime.utcnow(),
    )
    db.add(new_item)
    portfolio.updated_at = datetime.utcnow()

    try:
        db.commit()
        db.refresh(new_item)
    except OperationalError as e:
        db.rollback()
        raise_schema_drift_if_needed(e)
        raise
    except Exception:
        db.rollback()
        raise

    return new_item


@router.delete("/remove/{symbol}")
def remove_portfolio_item(
    symbol: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    portfolio = get_or_create_default_portfolio(db, current_user.id)
    normalized = symbol.strip().upper()

    try:
        item = (
            db.query(PortfolioItem)
            .filter(
                PortfolioItem.portfolio_id == portfolio.id,
                PortfolioItem.symbol == normalized,
            )
            .first()
        )
    except OperationalError as e:
        raise_schema_drift_if_needed(e)
        raise

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stock not found in portfolio",
        )

    db.delete(item)
    portfolio.updated_at = datetime.utcnow()

    try:
        db.commit()
    except OperationalError as e:
        db.rollback()
        raise_schema_drift_if_needed(e)
        raise
    except Exception:
        db.rollback()
        raise

    return {"message": f"{normalized} removed from portfolio"}
