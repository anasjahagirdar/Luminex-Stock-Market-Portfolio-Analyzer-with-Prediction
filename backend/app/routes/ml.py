from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.ml.features import compute_ml_features
from app.ml.predictors import build_linear_regression_predictions
from app.ml.repository import (
    get_ml_features,
    get_predictions,
    get_stock_history_rows,
    replace_predictions_for_model,
    upsert_ml_features,
)

router = APIRouter(prefix="/ml", tags=["ml"])


def _feature_row_to_dict(row: Any) -> dict:
    return {
        "symbol": row.symbol,
        "date": str(row.date),
        "lag_1": row.lag_1,
        "lag_7": row.lag_7,
        "rolling_mean_7": row.rolling_mean_7,
        "rolling_std_7": row.rolling_std_7,
        "momentum": row.momentum,
        "volatility": row.volatility,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _prediction_row_to_dict(row: Any) -> dict:
    return {
        "symbol": row.symbol,
        "model": row.model,
        "prediction_date": str(row.prediction_date),
        "predicted_price": row.predicted_price,
        "confidence": row.confidence,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.post("/features/generate")
def generate_features(
    symbol: str = Query(..., description="Stock symbol"),
    db: Session = Depends(get_db),
):
    normalized = symbol.strip().upper()
    if not normalized:
        raise HTTPException(status_code=400, detail="Symbol is required")

    history_rows = get_stock_history_rows(db, normalized)
    if not history_rows:
        raise HTTPException(
            status_code=404,
            detail="No stock history found for symbol. Fetch /stocks/history first.",
        )

    feature_rows = compute_ml_features(normalized, history_rows)

    try:
        affected = upsert_ml_features(db, normalized, feature_rows)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to persist features: {e}")

    latest = get_ml_features(db, normalized, limit=5)

    return {
        "symbol": normalized,
        "generated_count": affected,
        "latest_features": [_feature_row_to_dict(r) for r in latest],
    }


@router.get("/features")
def list_features(
    symbol: str = Query(..., description="Stock symbol"),
    limit: int = Query(100, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    normalized = symbol.strip().upper()
    rows = get_ml_features(db, normalized, limit=limit)
    return {
        "symbol": normalized,
        "count": len(rows),
        "features": [_feature_row_to_dict(r) for r in rows],
    }


@router.post("/predict/linear-regression")
def predict_linear_regression(
    symbol: str = Query(..., description="Stock symbol"),
    lookback_days: int = Query(180, ge=20, le=2000),
    horizon_days: int = Query(3, ge=1, le=30),
    persist: bool = Query(True, description="Store predictions in ml_predictions"),
    db: Session = Depends(get_db),
):
    normalized = symbol.strip().upper()
    if not normalized:
        raise HTTPException(status_code=400, detail="Symbol is required")

    history_rows = get_stock_history_rows(db, normalized)
    if not history_rows:
        raise HTTPException(
            status_code=404,
            detail="No stock history found for symbol. Fetch /stocks/history first.",
        )

    # Always refresh engineered features from current history.
    feature_rows = compute_ml_features(normalized, history_rows)

    result = build_linear_regression_predictions(
        symbol=normalized,
        history_rows=history_rows,
        lookback_days=lookback_days,
        horizon_days=horizon_days,
    )

    try:
        features_count = upsert_ml_features(db, normalized, feature_rows)
        persisted_count = 0

        if persist:
            persisted_count = replace_predictions_for_model(
                db=db,
                symbol=normalized,
                model="linear_regression",
                prediction_rows=result["forecasts"],
            )

        db.commit()
        result["features_generated"] = features_count
        result["persisted_count"] = persisted_count
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed ML pipeline transaction: {e}")

    return result


@router.get("/predictions")
def list_predictions(
    symbol: str = Query(..., description="Stock symbol"),
    model: Optional[str] = Query(None, description="Model name, e.g. linear_regression"),
    limit: int = Query(100, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    normalized = symbol.strip().upper()
    rows = get_predictions(db, normalized, model=model, limit=limit)

    return {
        "symbol": normalized,
        "model": model,
        "count": len(rows),
        "predictions": [_prediction_row_to_dict(r) for r in rows],
    }
