from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Sequence, Tuple


def _extract(row: Any, key: str) -> Any:
    if isinstance(row, dict):
        return row.get(key)
    return getattr(row, key, None)


def _to_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()

    text = str(value).strip()
    if not text:
        return None

    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except Exception:
        pass

    try:
        return datetime.strptime(text[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def _to_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        n = float(value)
        if n != n:  # NaN
            return None
        return n
    except Exception:
        return None


def _normalize_history_rows(history_rows: Sequence[Any]) -> List[Tuple[date, float]]:
    by_date: Dict[date, float] = {}
    for row in history_rows:
        d = _to_date(_extract(row, "date"))
        c = _to_float(_extract(row, "close"))
        if d is None or c is None or c <= 0:
            continue
        by_date[d] = c
    return sorted(by_date.items(), key=lambda x: x[0])


def _linear_regression_xy(points: Sequence[Tuple[float, float]]) -> Tuple[float, float, float]:
    """
    Returns (slope, intercept, r2).
    """
    n = len(points)
    if n < 2:
        y0 = points[0][1] if n == 1 else 0.0
        return 0.0, y0, 0.0

    sum_x = sum(p[0] for p in points)
    sum_y = sum(p[1] for p in points)
    sum_xy = sum(p[0] * p[1] for p in points)
    sum_xx = sum(p[0] * p[0] for p in points)

    denom = n * sum_xx - sum_x * sum_x
    if denom == 0:
        return 0.0, sum_y / n, 0.0

    slope = (n * sum_xy - sum_x * sum_y) / denom
    intercept = (sum_y - slope * sum_x) / n

    mean_y = sum_y / n
    ss_tot = sum((p[1] - mean_y) ** 2 for p in points)
    ss_res = sum((p[1] - (slope * p[0] + intercept)) ** 2 for p in points)

    r2 = 0.0 if ss_tot == 0 else max(0.0, 1.0 - (ss_res / ss_tot))
    return slope, intercept, r2


def build_linear_regression_predictions(
    symbol: str,
    history_rows: Sequence[Any],
    lookback_days: int = 180,
    horizon_days: int = 3,
) -> dict:
    """
    Train simple linear regression on close prices and forecast next N steps.
    Returns:
    {
      symbol, model, slope, intercept, r2, data_points,
      forecasts: [{prediction_date, predicted_price, confidence}]
    }
    """
    rows = _normalize_history_rows(history_rows)
    if not rows:
        return {
            "symbol": symbol,
            "model": "linear_regression",
            "slope": 0.0,
            "intercept": 0.0,
            "r2": 0.0,
            "data_points": 0,
            "forecasts": [],
        }

    if lookback_days > 0 and len(rows) > lookback_days:
        rows = rows[-lookback_days:]

    # X as monotonic index, Y as close
    points = [(float(i + 1), close) for i, (_, close) in enumerate(rows)]
    slope, intercept, r2 = _linear_regression_xy(points)

    last_date = rows[-1][0]
    n = len(rows)
    forecasts = []

    for step in range(1, max(1, horizon_days) + 1):
        x = float(n + step)
        pred = slope * x + intercept
        pred = max(0.0, pred)

        forecasts.append(
            {
                "symbol": symbol,
                "model": "linear_regression",
                "prediction_date": last_date + timedelta(days=step),
                "predicted_price": round(pred, 4),
                "confidence": round(r2, 6),
                "created_at": datetime.utcnow(),
            }
        )

    return {
        "symbol": symbol,
        "model": "linear_regression",
        "slope": slope,
        "intercept": intercept,
        "r2": r2,
        "data_points": len(rows),
        "forecasts": forecasts,
    }
