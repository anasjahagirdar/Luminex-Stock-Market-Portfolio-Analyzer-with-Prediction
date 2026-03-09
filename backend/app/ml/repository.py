from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Optional, Sequence

from sqlalchemy.orm import Session

from app.models import MLFeature, MLPrediction, StockHistory


def get_stock_history_rows(
    db: Session,
    symbol: str,
    limit: Optional[int] = None,
) -> List[StockHistory]:
    q = (
        db.query(StockHistory)
        .filter(StockHistory.symbol == symbol)
        .order_by(StockHistory.date.asc())
    )
    if limit and limit > 0:
        # Need the latest N in ascending date order.
        rows_desc = (
            db.query(StockHistory)
            .filter(StockHistory.symbol == symbol)
            .order_by(StockHistory.date.desc())
            .limit(limit)
            .all()
        )
        return list(sorted(rows_desc, key=lambda r: r.date))
    return q.all()


def upsert_ml_features(db: Session, symbol: str, feature_rows: Sequence[dict]) -> int:
    if not feature_rows:
        return 0

    dates = [row["date"] for row in feature_rows if row.get("date")]
    if not dates:
        return 0

    min_d = min(dates)
    max_d = max(dates)

    existing = (
        db.query(MLFeature)
        .filter(
            MLFeature.symbol == symbol,
            MLFeature.date >= min_d,
            MLFeature.date <= max_d,
        )
        .all()
    )
    existing_by_date = {r.date: r for r in existing}

    affected = 0
    now = datetime.utcnow()

    for row in feature_rows:
        d = row.get("date")
        if not d:
            continue

        rec = existing_by_date.get(d)
        if rec:
            rec.lag_1 = row.get("lag_1")
            rec.lag_7 = row.get("lag_7")
            rec.rolling_mean_7 = row.get("rolling_mean_7")
            rec.rolling_std_7 = row.get("rolling_std_7")
            rec.momentum = row.get("momentum")
            rec.volatility = row.get("volatility")
        else:
            db.add(
                MLFeature(
                    symbol=symbol,
                    date=d,
                    lag_1=row.get("lag_1"),
                    lag_7=row.get("lag_7"),
                    rolling_mean_7=row.get("rolling_mean_7"),
                    rolling_std_7=row.get("rolling_std_7"),
                    momentum=row.get("momentum"),
                    volatility=row.get("volatility"),
                    created_at=row.get("created_at") or now,
                )
            )
        affected += 1

    return affected


def get_ml_features(
    db: Session,
    symbol: str,
    limit: Optional[int] = None,
) -> List[MLFeature]:
    q = (
        db.query(MLFeature)
        .filter(MLFeature.symbol == symbol)
        .order_by(MLFeature.date.asc())
    )
    if limit and limit > 0:
        rows_desc = (
            db.query(MLFeature)
            .filter(MLFeature.symbol == symbol)
            .order_by(MLFeature.date.desc())
            .limit(limit)
            .all()
        )
        return list(sorted(rows_desc, key=lambda r: r.date))
    return q.all()


def replace_predictions_for_model(
    db: Session,
    symbol: str,
    model: str,
    prediction_rows: Sequence[dict],
) -> int:
    # Replace same symbol+model predictions for simplicity and consistency.
    db.query(MLPrediction).filter(
        MLPrediction.symbol == symbol,
        MLPrediction.model == model,
    ).delete(synchronize_session=False)

    created = 0
    now = datetime.utcnow()

    for row in prediction_rows:
        p_date = row.get("prediction_date")
        p_price = row.get("predicted_price")

        if not p_date or p_price is None:
            continue

        db.add(
            MLPrediction(
                symbol=symbol,
                model=model,
                prediction_date=p_date,
                predicted_price=float(p_price),
                confidence=row.get("confidence"),
                created_at=row.get("created_at") or now,
            )
        )
        created += 1

    return created


def get_predictions(
    db: Session,
    symbol: str,
    model: Optional[str] = None,
    limit: Optional[int] = None,
) -> List[MLPrediction]:
    q = db.query(MLPrediction).filter(MLPrediction.symbol == symbol)
    if model:
        q = q.filter(MLPrediction.model == model)

    q = q.order_by(MLPrediction.prediction_date.asc(), MLPrediction.id.asc())
    rows = q.all()

    if limit and limit > 0 and len(rows) > limit:
        rows = rows[-limit:]

    return rows
