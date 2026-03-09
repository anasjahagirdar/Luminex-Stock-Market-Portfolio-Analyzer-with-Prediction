from __future__ import annotations

from datetime import date, datetime
from math import sqrt
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

    # Supports YYYY-MM-DD and datetime-ish strings.
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
        if n != n:  # NaN check
            return None
        return n
    except Exception:
        return None


def _mean(values: Sequence[float]) -> Optional[float]:
    if not values:
        return None
    return sum(values) / len(values)


def _stddev(values: Sequence[float]) -> Optional[float]:
    n = len(values)
    if n < 2:
        return None
    mu = _mean(values)
    if mu is None:
        return None
    var = sum((v - mu) ** 2 for v in values) / (n - 1)
    return sqrt(var)


def _normalize_history_rows(history_rows: Sequence[Any]) -> List[Tuple[date, float]]:
    # Deduplicate by date; latest row wins.
    by_date: Dict[date, float] = {}

    for row in history_rows:
        d = _to_date(_extract(row, "date"))
        c = _to_float(_extract(row, "close"))
        if d is None or c is None or c <= 0:
            continue
        by_date[d] = c

    return sorted(by_date.items(), key=lambda x: x[0])


def compute_ml_features(symbol: str, history_rows: Sequence[Any]) -> List[dict]:
    """
    Build ML feature rows from stock history.

    Returned row format matches MLFeature columns:
    - symbol, date, lag_1, lag_7, rolling_mean_7, rolling_std_7, momentum, volatility
    """
    rows = _normalize_history_rows(history_rows)
    if not rows:
        return []

    closes = [c for _, c in rows]
    out: List[dict] = []

    for i, (d, close_i) in enumerate(rows):
        lag_1 = closes[i - 1] if i >= 1 else None
        lag_7 = closes[i - 7] if i >= 7 else None

        # Full 7-close rolling window ending at i.
        rolling_window = closes[i - 6 : i + 1] if i >= 6 else []
        rolling_mean_7 = _mean(rolling_window) if len(rolling_window) == 7 else None
        rolling_std_7 = _stddev(rolling_window) if len(rolling_window) == 7 else None

        # 7-step momentum (%).
        momentum = None
        if lag_7 and lag_7 > 0:
            momentum = ((close_i - lag_7) / lag_7) * 100.0

        # Volatility: stdev of daily returns (%) over latest 7 returns.
        volatility = None
        if i >= 7:
            close_window = closes[i - 7 : i + 1]  # 8 closes -> 7 returns
            returns: List[float] = []
            for j in range(1, len(close_window)):
                prev = close_window[j - 1]
                curr = close_window[j]
                if prev > 0:
                    returns.append(((curr - prev) / prev) * 100.0)
            volatility = _stddev(returns) if len(returns) >= 2 else None

        out.append(
            {
                "symbol": symbol,
                "date": d,
                "lag_1": lag_1,
                "lag_7": lag_7,
                "rolling_mean_7": rolling_mean_7,
                "rolling_std_7": rolling_std_7,
                "momentum": momentum,
                "volatility": volatility,
                "created_at": datetime.utcnow(),
            }
        )

    return out
