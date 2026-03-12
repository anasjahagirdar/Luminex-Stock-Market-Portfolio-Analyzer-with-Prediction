from concurrent.futures import ThreadPoolExecutor, as_completed
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timedelta
import json
import os
import threading
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlencode
from urllib.request import Request, urlopen

try:
    import requests
except Exception:
    requests = None

try:
    from curl_cffi import requests as curl_requests
except Exception:
    curl_requests = None

from sqlalchemy.orm import Session

from app.database import get_db

try:
    # Preferred import path if models are exported from app.models
    from app.models import Stock, StockHistory, SectorMapping, APICache
except Exception:
    # Backward-compatible import path used in some existing files
    from app.models.models import Stock, StockHistory, SectorMapping, APICache


ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_API_KEY") or os.getenv("ALPHA_VANTAGE_KEY") or "NADZEPD7XDEV74YR"
CERT = os.getenv("LUMINEX_CERT", "C:/Users/Anas/cacert.pem")
VERIFY_CERT: Any = CERT if CERT and os.path.exists(CERT) else True

if isinstance(VERIFY_CERT, str):
    os.environ["CURL_CA_BUNDLE"] = VERIFY_CERT
    os.environ["SSL_CERT_FILE"] = VERIFY_CERT

router = APIRouter(prefix="/stocks", tags=["stocks"])

# -----------------------------
# Caching + Alpha rate limiting
# -----------------------------
CACHE_TTL_QUOTE = 60          # seconds
CACHE_TTL_HISTORY = 300       # seconds
CACHE_TTL_OVERVIEW = 43200    # 12 hours
ALPHA_MIN_INTERVAL = 12.5     # free tier safe interval

_quote_cache: Dict[str, Tuple[float, dict]] = {}
_history_cache: Dict[str, Tuple[float, dict]] = {}
_overview_cache: Dict[str, Tuple[float, dict]] = {}

_cache_lock = threading.Lock()
_alpha_lock = threading.Lock()
_alpha_last_call = 0.0


def _cache_get(
    cache: Dict[str, Tuple[float, dict]],
    key: str,
    ttl: int,
    allow_stale: bool = False,
) -> Optional[dict]:
    with _cache_lock:
        item = cache.get(key)
    if not item:
        return None
    ts, value = item
    if allow_stale or (time.time() - ts <= ttl):
        return value
    return None


def _cache_set(cache: Dict[str, Tuple[float, dict]], key: str, value: dict) -> None:
    with _cache_lock:
        cache[key] = (time.time(), value)


def _to_float(v: Any, default: float = 0.0) -> float:
    try:
        if v is None or v == "":
            return default
        return float(str(v).replace(",", ""))
    except Exception:
        return default


def _to_int(v: Any, default: int = 0) -> int:
    try:
        if v is None or v == "":
            return default
        return int(float(str(v).replace(",", "")))
    except Exception:
        return default


def _normalize_symbol(symbol: str) -> str:
    return (symbol or "").strip().upper()


def _http_get_json(
    url: str,
    params: Optional[dict] = None,
    headers: Optional[dict] = None,
    timeout: int = 20,
) -> dict:
    if requests is not None:
        response = requests.get(
            url,
            params=params,
            headers=headers,
            timeout=timeout,
            verify=VERIFY_CERT,
        )
        return response.json()

    query = urlencode(params or {})
    full_url = f"{url}?{query}" if query else url
    request = Request(full_url, headers=headers or {})
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode('utf-8'))


def _throttled_alpha_get(params: dict) -> dict:
    global _alpha_last_call
    with _alpha_lock:
        now = time.time()
        wait = ALPHA_MIN_INTERVAL - (now - _alpha_last_call)
        if wait > 0:
            time.sleep(wait)
        _alpha_last_call = time.time()

    payload = {**params, "apikey": ALPHA_VANTAGE_KEY}
    return _http_get_json("https://www.alphavantage.co/query", params=payload, timeout=20)


def fetch_yahoo(symbol: str, params: dict) -> dict:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
    }

    def _plain_get(target_url: str) -> dict:
        return _http_get_json(
            target_url,
            params=params,
            headers=headers,
            timeout=15,
        )

    try:
        if curl_requests is not None:
            res = curl_requests.get(
                url,
                params=params,
                headers=headers,
                timeout=15,
                impersonate="chrome110",
                verify=VERIFY_CERT,
            )
            return res.json()
        return _plain_get(url)
    except Exception:
        url2 = f"https://query2.finance.yahoo.com/v8/finance/chart/{symbol}"
        if curl_requests is not None:
            res = curl_requests.get(
                url2,
                params=params,
                headers=headers,
                timeout=15,
                impersonate="chrome110",
                verify=VERIFY_CERT,
            )
            return res.json()
        return _plain_get(url2)


# -----------------------------
# Sector mapping support
# -----------------------------
SECTOR_MAP = {
    # Technology
    "AAPL": "technology",
    "MSFT": "technology",
    "GOOGL": "technology",
    "META": "technology",
    "NVDA": "technology",
    "AMD": "technology",
    "INTC": "technology",
    "TCS.BSE": "technology",
    "INFY.BSE": "technology",
    "WIPRO.BSE": "technology",
    "HCLTECH.BSE": "technology",
    "TECHM.BSE": "technology",

    # Finance
    "JPM": "finance",
    "GS": "finance",
    "BAC": "finance",
    "V": "finance",
    "PYPL": "finance",
    "HDFCBANK.BSE": "finance",
    "ICICIBANK.BSE": "finance",
    "SBIN.BSE": "finance",
    "AXISBANK.BSE": "finance",
    "KOTAKBANK.BSE": "finance",
    "BAJFINANCE.BSE": "finance",
    "BTC-USD": "finance",
    "ETH-USD": "finance",
    "BNB-USD": "finance",
    "SOL-USD": "finance",
    "XRP-USD": "finance",
    "ADA-USD": "finance",
    "DOGE-USD": "finance",

    # Healthcare
    "JNJ": "healthcare",
    "PFE": "healthcare",
    "SUNPHARMA.BSE": "healthcare",
    "DRREDDY.BSE": "healthcare",

    # Energy
    "XOM": "energy",
    "ONGC.BSE": "energy",
    "NTPC.BSE": "energy",
    "TATAPOWER.BSE": "energy",
    "POWERGRID.BSE": "energy",

    # Consumer
    "AMZN": "consumer",
    "TSLA": "consumer",
    "WMT": "consumer",
    "DIS": "consumer",
    "NFLX": "consumer",
    "RELIANCE.BSE": "consumer",
    "TATAMOTORS.BSE": "consumer",
    "TATASTEEL.BSE": "consumer",
    "HINDUNILVR.BSE": "consumer",
    "MARUTI.BSE": "consumer",
    "ADANIENT.BSE": "consumer",
    "ITC.BSE": "consumer",
    "BHARTIARTL.BSE": "consumer",
    "ASIANPAINT.BSE": "consumer",
    "TITAN.BSE": "consumer",
    "NESTLEIND.BSE": "consumer",
    "ULTRACEMCO.BSE": "consumer",
    "LT.BSE": "consumer",
}


def _sector_for(symbol: str, name: str = "") -> str:
    if symbol in SECTOR_MAP:
        return SECTOR_MAP[symbol]

    n = (name or "").upper()
    if "BANK" in n or "FINANCE" in n or "INSURANCE" in n:
        return "finance"
    if "PHARMA" in n or "HEALTH" in n:
        return "healthcare"
    if "POWER" in n or "ENERGY" in n or "OIL" in n or "GAS" in n:
        return "energy"
    if "TECH" in n or "SOFTWARE" in n or "SEMICONDUCTOR" in n:
        return "technology"
    return "consumer"


def _is_indian(symbol: str) -> bool:
    return symbol.endswith(".BSE") or symbol.endswith(".NSE")


def _market_for_symbol(symbol: str, fallback: str = "international") -> str:
    if _is_indian(symbol):
        return "india"
    if symbol.endswith("-USD"):
        return "international"
    return fallback


def _currency_for_symbol(symbol: str, api_currency: Optional[str] = None) -> str:
    raw = (api_currency or "").strip().upper()
    if raw == "INR":
        return "INR"
    if raw == "USD":
        return "USD"
    return "INR" if _is_indian(symbol) else "USD"


# -----------------------------
# Stock Lists
# -----------------------------
INDIAN_STOCKS = [
    {"symbol": "TCS.BSE", "name": "Tata Consultancy Services", "exchange": "BSE", "market": "india"},
    {"symbol": "TATAMOTORS.BSE", "name": "Tata Motors", "exchange": "BSE", "market": "india"},
    {"symbol": "TATASTEEL.BSE", "name": "Tata Steel", "exchange": "BSE", "market": "india"},
    {"symbol": "TATAPOWER.BSE", "name": "Tata Power", "exchange": "BSE", "market": "india"},
    {"symbol": "RELIANCE.BSE", "name": "Reliance Industries", "exchange": "BSE", "market": "india"},
    {"symbol": "INFY.BSE", "name": "Infosys", "exchange": "BSE", "market": "india"},
    {"symbol": "HDFCBANK.BSE", "name": "HDFC Bank", "exchange": "BSE", "market": "india"},
    {"symbol": "ICICIBANK.BSE", "name": "ICICI Bank", "exchange": "BSE", "market": "india"},
    {"symbol": "SBIN.BSE", "name": "State Bank of India", "exchange": "BSE", "market": "india"},
    {"symbol": "WIPRO.BSE", "name": "Wipro", "exchange": "BSE", "market": "india"},
    {"symbol": "HINDUNILVR.BSE", "name": "Hindustan Unilever", "exchange": "BSE", "market": "india"},
    {"symbol": "BAJFINANCE.BSE", "name": "Bajaj Finance", "exchange": "BSE", "market": "india"},
    {"symbol": "MARUTI.BSE", "name": "Maruti Suzuki", "exchange": "BSE", "market": "india"},
    {"symbol": "ADANIENT.BSE", "name": "Adani Enterprises", "exchange": "BSE", "market": "india"},
    {"symbol": "SUNPHARMA.BSE", "name": "Sun Pharmaceutical", "exchange": "BSE", "market": "india"},
    {"symbol": "DRREDDY.BSE", "name": "Dr. Reddy's Laboratories", "exchange": "BSE", "market": "india"},
    {"symbol": "ONGC.BSE", "name": "Oil and Natural Gas Corp", "exchange": "BSE", "market": "india"},
    {"symbol": "NTPC.BSE", "name": "NTPC Limited", "exchange": "BSE", "market": "india"},
    {"symbol": "HCLTECH.BSE", "name": "HCL Technologies", "exchange": "BSE", "market": "india"},
    {"symbol": "AXISBANK.BSE", "name": "Axis Bank", "exchange": "BSE", "market": "india"},
    {"symbol": "KOTAKBANK.BSE", "name": "Kotak Mahindra Bank", "exchange": "BSE", "market": "india"},
    {"symbol": "ITC.BSE", "name": "ITC Limited", "exchange": "BSE", "market": "india"},
    {"symbol": "BHARTIARTL.BSE", "name": "Bharti Airtel", "exchange": "BSE", "market": "india"},
    {"symbol": "ASIANPAINT.BSE", "name": "Asian Paints", "exchange": "BSE", "market": "india"},
    {"symbol": "TITAN.BSE", "name": "Titan Company", "exchange": "BSE", "market": "india"},
    {"symbol": "NESTLEIND.BSE", "name": "Nestle India", "exchange": "BSE", "market": "india"},
    {"symbol": "ULTRACEMCO.BSE", "name": "UltraTech Cement", "exchange": "BSE", "market": "india"},
    {"symbol": "POWERGRID.BSE", "name": "Power Grid Corporation", "exchange": "BSE", "market": "india"},
    {"symbol": "LT.BSE", "name": "Larsen & Toubro", "exchange": "BSE", "market": "india"},
    {"symbol": "TECHM.BSE", "name": "Tech Mahindra", "exchange": "BSE", "market": "india"},
]

INTERNATIONAL_STOCKS = [
    {"symbol": "AAPL", "name": "Apple Inc.", "exchange": "NASDAQ", "market": "international"},
    {"symbol": "MSFT", "name": "Microsoft Corporation", "exchange": "NASDAQ", "market": "international"},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "exchange": "NASDAQ", "market": "international"},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "exchange": "NASDAQ", "market": "international"},
    {"symbol": "TSLA", "name": "Tesla Inc.", "exchange": "NASDAQ", "market": "international"},
    {"symbol": "META", "name": "Meta Platforms Inc.", "exchange": "NASDAQ", "market": "international"},
    {"symbol": "NVDA", "name": "NVIDIA Corporation", "exchange": "NASDAQ", "market": "international"},
    {"symbol": "JPM", "name": "JPMorgan Chase & Co.", "exchange": "NYSE", "market": "international"},
    {"symbol": "JNJ", "name": "Johnson & Johnson", "exchange": "NYSE", "market": "international"},
    {"symbol": "V", "name": "Visa Inc.", "exchange": "NYSE", "market": "international"},
    {"symbol": "WMT", "name": "Walmart Inc.", "exchange": "NYSE", "market": "international"},
    {"symbol": "XOM", "name": "Exxon Mobil Corporation", "exchange": "NYSE", "market": "international"},
    {"symbol": "GS", "name": "Goldman Sachs Group", "exchange": "NYSE", "market": "international"},
    {"symbol": "PFE", "name": "Pfizer Inc.", "exchange": "NYSE", "market": "international"},
    {"symbol": "BAC", "name": "Bank of America Corp.", "exchange": "NYSE", "market": "international"},
    {"symbol": "NFLX", "name": "Netflix Inc.", "exchange": "NASDAQ", "market": "international"},
    {"symbol": "AMD", "name": "Advanced Micro Devices", "exchange": "NASDAQ", "market": "international"},
    {"symbol": "INTC", "name": "Intel Corporation", "exchange": "NASDAQ", "market": "international"},
    {"symbol": "DIS", "name": "Walt Disney Co.", "exchange": "NYSE", "market": "international"},
    {"symbol": "PYPL", "name": "PayPal Holdings", "exchange": "NASDAQ", "market": "international"},
    {"symbol": "BTC-USD", "name": "Bitcoin", "exchange": "CRYPTO", "market": "international"},
    {"symbol": "ETH-USD", "name": "Ethereum", "exchange": "CRYPTO", "market": "international"},
    {"symbol": "BNB-USD", "name": "Binance Coin", "exchange": "CRYPTO", "market": "international"},
    {"symbol": "SOL-USD", "name": "Solana", "exchange": "CRYPTO", "market": "international"},
    {"symbol": "XRP-USD", "name": "XRP", "exchange": "CRYPTO", "market": "international"},
    {"symbol": "ADA-USD", "name": "Cardano", "exchange": "CRYPTO", "market": "international"},
    {"symbol": "DOGE-USD", "name": "Dogecoin", "exchange": "CRYPTO", "market": "international"},
]

ALL_STOCKS = INDIAN_STOCKS + INTERNATIONAL_STOCKS
STOCK_BY_SYMBOL = {s["symbol"]: s for s in ALL_STOCKS}


# -----------------------------
# DB helpers (stocks / sector_mapping / stock_history / api_cache)
# -----------------------------
def _db_cache_get(
    db: Session,
    endpoint: str,
    symbol: Optional[str],
    allow_stale: bool = False,
) -> Optional[dict]:
    row = (
        db.query(APICache)
        .filter(APICache.endpoint == endpoint, APICache.symbol == symbol)
        .order_by(APICache.created_at.desc(), APICache.id.desc())
        .first()
    )
    if not row:
        return None

    if not allow_stale and row.expires_at and row.expires_at < datetime.utcnow():
        return None

    try:
        return json.loads(row.response_json)
    except Exception:
        return None


def _db_cache_set(
    db: Session,
    endpoint: str,
    symbol: Optional[str],
    payload: dict,
    ttl_seconds: int,
) -> None:
    now = datetime.utcnow()
    expires_at = now + timedelta(seconds=ttl_seconds)

    row = (
        db.query(APICache)
        .filter(APICache.endpoint == endpoint, APICache.symbol == symbol)
        .order_by(APICache.created_at.desc(), APICache.id.desc())
        .first()
    )

    if row:
        row.response_json = json.dumps(payload)
        row.expires_at = expires_at
        row.created_at = now
    else:
        db.add(
            APICache(
                endpoint=endpoint,
                symbol=symbol,
                response_json=json.dumps(payload),
                expires_at=expires_at,
                created_at=now,
            )
        )


def _db_cache_get_many(
    db: Session,
    endpoint: str,
    symbols: List[str],
    allow_stale: bool = False,
) -> Dict[str, dict]:
    unique_symbols = [symbol for symbol in dict.fromkeys(symbols) if symbol]
    if not unique_symbols:
        return {}

    rows = (
        db.query(APICache)
        .filter(
            APICache.endpoint == endpoint,
            APICache.symbol.in_(unique_symbols),
        )
        .order_by(APICache.symbol.asc(), APICache.created_at.desc(), APICache.id.desc())
        .all()
    )

    now = datetime.utcnow()
    payloads: Dict[str, dict] = {}

    for row in rows:
        if not row.symbol or row.symbol in payloads:
            continue
        if not allow_stale and row.expires_at and row.expires_at < now:
            continue
        try:
            payloads[row.symbol] = json.loads(row.response_json)
        except Exception:
            continue

    return payloads


def _upsert_stock_and_sector(
    db: Session,
    symbol: str,
    name: str,
    exchange: Optional[str],
    market: Optional[str],
    sector: Optional[str],
    currency: Optional[str],
) -> None:
    stock = db.query(Stock).filter(Stock.symbol == symbol).first()
    if stock:
        stock.name = name or stock.name
        stock.exchange = exchange or stock.exchange
        stock.market = market or stock.market
        stock.sector = sector or stock.sector
        stock.currency = currency or stock.currency
    else:
        db.add(
            Stock(
                symbol=symbol,
                name=name or symbol,
                exchange=exchange,
                market=market,
                sector=sector,
                currency=currency,
                created_at=datetime.utcnow(),
            )
        )

    if sector:
        mapping = db.query(SectorMapping).filter(SectorMapping.symbol == symbol).first()
        if mapping:
            mapping.sector = sector
            mapping.market = market
            mapping.updated_at = datetime.utcnow()
        else:
            db.add(
                SectorMapping(
                    symbol=symbol,
                    sector=sector,
                    market=market,
                    updated_at=datetime.utcnow(),
                )
            )


def _upsert_history_rows(db: Session, symbol: str, history: List[dict], source: str) -> None:
    if not history:
        return

    parsed_rows: List[Tuple[datetime.date, dict]] = []
    for row in history:
        try:
            d = datetime.strptime(row["date"], "%Y-%m-%d").date()
            parsed_rows.append((d, row))
        except Exception:
            continue

    if not parsed_rows:
        return

    min_d = min(d for d, _ in parsed_rows)
    max_d = max(d for d, _ in parsed_rows)

    existing = (
        db.query(StockHistory)
        .filter(
            StockHistory.symbol == symbol,
            StockHistory.date >= min_d,
            StockHistory.date <= max_d,
        )
        .all()
    )
    by_date = {r.date: r for r in existing}

    for d, row in parsed_rows:
        open_v = _to_float(row.get("open"))
        high_v = _to_float(row.get("high"))
        low_v = _to_float(row.get("low"))
        close_v = _to_float(row.get("close"))
        volume_v = _to_int(row.get("volume"))

        if d in by_date:
            rec = by_date[d]
            rec.open = open_v
            rec.high = high_v
            rec.low = low_v
            rec.close = close_v
            rec.volume = volume_v
            rec.source = source
        else:
            db.add(
                StockHistory(
                    symbol=symbol,
                    date=d,
                    open=open_v,
                    high=high_v,
                    low=low_v,
                    close=close_v,
                    volume=volume_v,
                    source=source,
                    created_at=datetime.utcnow(),
                )
            )


# -----------------------------
# Existing helpers
# -----------------------------
def _with_sector(s: dict) -> dict:
    return {**s, "sector": _sector_for(s["symbol"], s.get("name", ""))}


def _period_days(period: str) -> int:
    mapping = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730}
    return mapping.get(period, 90)


def _filter_history(history: List[dict], period: str) -> List[dict]:
    if not history:
        return history

    days = _period_days(period)
    cutoff = datetime.utcnow().date() - timedelta(days=days)

    filtered: List[dict] = []
    for row in history:
        d = row.get("date")
        try:
            dt = datetime.strptime(d, "%Y-%m-%d").date()
            if dt >= cutoff:
                filtered.append(row)
        except Exception:
            continue

    return filtered or history[-min(len(history), days):]


def _period_to_yahoo_params(period: str) -> Tuple[str, str]:
    period_map = {
        "1mo": ("1d", "1mo"),
        "3mo": ("1d", "3mo"),
        "6mo": ("1d", "6mo"),
        "1y": ("1d", "1y"),
        "2y": ("1d", "2y"),
    }
    return period_map.get(period, ("1d", "3mo"))


def _fetch_yahoo_history_rows(yahoo_symbol: str, period: str) -> List[dict]:
    try:
        interval, range_ = _period_to_yahoo_params(period)
        data = fetch_yahoo(yahoo_symbol, {"interval": interval, "range": range_})
        result = data.get("chart", {}).get("result", [])
        if not result:
            return []

        timestamps = result[0].get("timestamp", [])
        quotes = result[0].get("indicators", {}).get("quote", [{}])[0]
        closes = quotes.get("close", [])
        highs = quotes.get("high", [])
        lows = quotes.get("low", [])
        opens = quotes.get("open", [])
        volumes = quotes.get("volume", [])

        history: List[dict] = []
        for i, ts in enumerate(timestamps):
            if i < len(closes) and closes[i] is not None:
                history.append({
                    "date": datetime.fromtimestamp(ts).strftime("%Y-%m-%d"),
                    "open": round(float(opens[i] or 0), 2),
                    "high": round(float(highs[i] or 0), 2),
                    "low": round(float(lows[i] or 0), 2),
                    "close": round(float(closes[i]), 2),
                    "volume": int(volumes[i] or 0),
                })

        return history
    except Exception:
        return []


def _indian_yahoo_candidates(symbol: str) -> List[str]:
    base = symbol.split(".")[0].strip().upper()
    if not base:
        return []
    if symbol.endswith(".BSE"):
        return [f"{base}.BO", f"{base}.NS"]
    if symbol.endswith(".NSE"):
        return [f"{base}.NS", f"{base}.BO"]
    return [symbol]


def _fetch_history_from_db(db: Session, symbol: str, period: str) -> List[dict]:
    days = _period_days(period)
    cutoff = datetime.utcnow().date() - timedelta(days=days)

    rows = (
        db.query(StockHistory)
        .filter(
            StockHistory.symbol == symbol,
            StockHistory.date >= cutoff,
        )
        .order_by(StockHistory.date.asc())
        .all()
    )

    if not rows:
        rows = (
            db.query(StockHistory)
            .filter(StockHistory.symbol == symbol)
            .order_by(StockHistory.date.asc())
            .all()
        )
        if len(rows) > days:
            rows = rows[-days:]

    return [
        {
            "date": r.date.strftime("%Y-%m-%d"),
            "open": round(float(r.open or 0), 2),
            "high": round(float(r.high or 0), 2),
            "low": round(float(r.low or 0), 2),
            "close": round(float(r.close or 0), 2),
            "volume": int(r.volume or 0),
        }
        for r in rows
    ]


def _alpha_overview(symbol: str) -> dict:
    key = f"ov:{symbol}"
    cached = _cache_get(_overview_cache, key, CACHE_TTL_OVERVIEW)
    if cached:
        return cached

    data = _throttled_alpha_get({"function": "OVERVIEW", "symbol": symbol})
    if data.get("Note") or data.get("Information"):
        stale = _cache_get(_overview_cache, key, CACHE_TTL_OVERVIEW, allow_stale=True)
        return stale or {}
    _cache_set(_overview_cache, key, data)
    return data


def _build_indian_quote(symbol: str) -> dict:
    meta = STOCK_BY_SYMBOL.get(symbol, {})
    data = _throttled_alpha_get({"function": "GLOBAL_QUOTE", "symbol": symbol})
    q = data.get("Global Quote", {})

    if not q or not q.get("05. price"):
        raise HTTPException(status_code=404, detail="Indian stock not found")

    current_price = _to_float(q.get("05. price"))
    prev_price = _to_float(q.get("08. previous close"), current_price)
    change = _to_float(q.get("09. change"), current_price - prev_price)
    change_pct = _to_float(str(q.get("10. change percent", "0")).replace("%", ""))

    overview = _alpha_overview(symbol)
    pe_ratio = _to_float(overview.get("PERatio"), 0)
    eps = _to_float(overview.get("EPS"), 0)
    market_cap = _to_int(overview.get("MarketCapitalization"), 0)
    div_yield = _to_float(overview.get("DividendYield"), 0.0)
    if 0 < div_yield <= 1:
        div_yield *= 100

    week52_high = _to_float(overview.get("52WeekHigh"), 0)
    week52_low = _to_float(overview.get("52WeekLow"), 0)

    if week52_high <= 0:
        week52_high = current_price * 1.12
    if week52_low <= 0:
        week52_low = current_price * 0.88

    return {
        "symbol": symbol,
        "name": meta.get("name", symbol),
        "sector": _sector_for(symbol, meta.get("name", "")),
        "currentPrice": round(current_price, 2),
        "previousClose": round(prev_price, 2),
        "change": round(change, 2),
        "changePercent": round(change_pct, 2),
        "currency": "INR",
        "exchange": meta.get("exchange", "BSE"),
        "market": "india",
        "marketCap": market_cap,
        "peRatio": pe_ratio,
        "eps": eps,
        "dividendYield": round(div_yield, 4),
        "week52High": round(week52_high, 2),
        "week52Low": round(week52_low, 2),
    }


def _build_indian_quote_from_yahoo(symbol: str) -> dict:
    meta_info = STOCK_BY_SYMBOL.get(symbol, {})
    candidates = _indian_yahoo_candidates(symbol)

    for yahoo_symbol in candidates:
        try:
            data = fetch_yahoo(yahoo_symbol, {"interval": "1d", "range": "5d"})
            result = data.get("chart", {}).get("result", [])
            if not result:
                continue

            meta = result[0].get("meta", {})
            current_price = meta.get("regularMarketPrice") or meta.get("previousClose")
            prev_price = meta.get("chartPreviousClose") or meta.get("previousClose") or current_price

            if current_price is None:
                continue

            current_price = float(current_price)
            prev_price = float(prev_price) if prev_price is not None else current_price
            change = current_price - prev_price
            change_pct = round((change / prev_price) * 100, 2) if prev_price else 0.0

            market_cap = _to_int(meta.get("marketCap"), 0)
            pe_ratio = _to_float(meta.get("trailingPE"), 0)
            eps = _to_float(meta.get("trailingEps"), 0)

            div_yield = _to_float(meta.get("trailingAnnualDividendYield"), 0)
            if 0 < div_yield <= 1:
                div_yield *= 100

            week52_high = _to_float(meta.get("fiftyTwoWeekHigh"), 0)
            week52_low = _to_float(meta.get("fiftyTwoWeekLow"), 0)

            if week52_high <= 0:
                week52_high = current_price * 1.12
            if week52_low <= 0:
                week52_low = current_price * 0.88

            return {
                "symbol": symbol,
                "name": meta_info.get("name", symbol),
                "sector": _sector_for(symbol, meta_info.get("name", "")),
                "currentPrice": round(current_price, 2),
                "previousClose": round(prev_price, 2),
                "change": round(change, 2),
                "changePercent": change_pct,
                "currency": "INR",
                "exchange": meta_info.get("exchange", "BSE"),
                "market": "india",
                "marketCap": market_cap,
                "peRatio": pe_ratio,
                "eps": eps,
                "dividendYield": round(div_yield, 4),
                "week52High": round(week52_high, 2),
                "week52Low": round(week52_low, 2),
            }
        except Exception:
            continue

    raise HTTPException(status_code=404, detail="Indian stock not found")


def _build_yahoo_quote(symbol: str) -> dict:
    meta_info = STOCK_BY_SYMBOL.get(symbol, {})
    data = fetch_yahoo(symbol, {"interval": "1d", "range": "5d"})
    result = data.get("chart", {}).get("result", [])
    if not result:
        raise HTTPException(status_code=404, detail="Stock not found")

    meta = result[0].get("meta", {})
    current_price = meta.get("regularMarketPrice") or meta.get("previousClose")
    prev_price = meta.get("chartPreviousClose") or meta.get("previousClose") or current_price
    if current_price is None:
        raise HTTPException(status_code=404, detail="Price not available")

    current_price = float(current_price)
    prev_price = float(prev_price) if prev_price is not None else current_price
    change = current_price - prev_price
    change_pct = round((change / prev_price) * 100, 2) if prev_price else 0.0

    market_cap = _to_int(meta.get("marketCap"), 0)
    pe_ratio = _to_float(meta.get("trailingPE"), 0)
    eps = _to_float(meta.get("trailingEps"), 0)

    div_yield = _to_float(meta.get("trailingAnnualDividendYield"), 0)
    if 0 < div_yield <= 1:
        div_yield *= 100

    week52_high = _to_float(meta.get("fiftyTwoWeekHigh"), 0)
    week52_low = _to_float(meta.get("fiftyTwoWeekLow"), 0)
    if week52_high <= 0:
        week52_high = current_price * 1.12
    if week52_low <= 0:
        week52_low = current_price * 0.88

    return {
        "symbol": symbol,
        "name": meta_info.get("name", symbol),
        "sector": _sector_for(symbol, meta_info.get("name", "")),
        "currentPrice": round(current_price, 2),
        "previousClose": round(prev_price, 2),
        "change": round(change, 2),
        "changePercent": change_pct,
        "currency": _currency_for_symbol(symbol, meta.get("currency")),
        "exchange": meta_info.get("exchange", "NASDAQ"),
        "market": _market_for_symbol(symbol, meta_info.get("market", "international")),
        "marketCap": market_cap,
        "peRatio": pe_ratio,
        "eps": eps,
        "dividendYield": round(div_yield, 4),
        "week52High": round(week52_high, 2),
        "week52Low": round(week52_low, 2),
    }


def _get_cached_quote_payload(
    symbol: str,
    db: Session,
    allow_stale: bool = False,
) -> Optional[dict]:
    cache_key = f"q:{symbol}"
    cached_mem = _cache_get(_quote_cache, cache_key, CACHE_TTL_QUOTE, allow_stale=allow_stale)
    if cached_mem:
        return cached_mem

    cached_db = _db_cache_get(db, "/stocks/quote", symbol, allow_stale=allow_stale)
    if cached_db:
        _cache_set(_quote_cache, cache_key, cached_db)
        return cached_db

    return None


def _load_quote_payload(symbol: str) -> dict:
    if _is_indian(symbol):
        try:
            return _build_indian_quote(symbol)
        except Exception:
            return _build_indian_quote_from_yahoo(symbol)
    return _build_yahoo_quote(symbol)


def _persist_quote_payloads(db: Session, payloads: Dict[str, dict]) -> None:
    if not payloads:
        return

    try:
        for symbol, payload in payloads.items():
            _upsert_stock_and_sector(
                db,
                symbol=symbol,
                name=payload.get("name", symbol),
                exchange=payload.get("exchange"),
                market=payload.get("market"),
                sector=payload.get("sector"),
                currency=payload.get("currency"),
            )
            _db_cache_set(db, "/stocks/quote", symbol, payload, CACHE_TTL_QUOTE)
        db.commit()
    except Exception:
        db.rollback()


def _get_quote_payload(symbol: str, db: Session) -> dict:
    cache_key = f"q:{symbol}"
    cached = _get_cached_quote_payload(symbol, db)
    if cached:
        return cached

    payload = _load_quote_payload(symbol)
    _cache_set(_quote_cache, cache_key, payload)
    _persist_quote_payloads(db, {symbol: payload})
    return payload


def _get_history_payload(symbol: str, period: str, db: Session) -> dict:
    cache_key = f"h:{symbol}:{period}"
    endpoint_key = f"/stocks/history:{period}"

    cached_mem = _cache_get(_history_cache, cache_key, CACHE_TTL_HISTORY)
    if cached_mem:
        return cached_mem

    cached_db = _db_cache_get(db, endpoint_key, symbol, allow_stale=False)
    if cached_db:
        _cache_set(_history_cache, cache_key, cached_db)
        return cached_db

    history: List[dict] = []
    source = ""

    if _is_indian(symbol):
        # 1) Try Alpha Vantage first
        try:
            outputsize = "full" if period in {"6mo", "1y", "2y"} else "compact"
            data = _throttled_alpha_get({
                "function": "TIME_SERIES_DAILY",
                "symbol": symbol,
                "outputsize": outputsize,
            })

            ts = data.get("Time Series (Daily)", {})
            alpha_problem = data.get("Note") or data.get("Information") or data.get("Error Message")

            if ts and not alpha_problem:
                for date_str, values in sorted(ts.items()):
                    history.append({
                        "date": date_str,
                        "open": round(_to_float(values.get("1. open")), 2),
                        "high": round(_to_float(values.get("2. high")), 2),
                        "low": round(_to_float(values.get("3. low")), 2),
                        "close": round(_to_float(values.get("4. close")), 2),
                        "volume": _to_int(values.get("5. volume")),
                    })
                history = _filter_history(history, period)
                source = "alphavantage"
        except Exception:
            history = []

        # 2) Fallback: Yahoo mapped symbols (.BO / .NS)
        if not history:
            for y_symbol in _indian_yahoo_candidates(symbol):
                y_history = _fetch_yahoo_history_rows(y_symbol, period)
                if y_history:
                    history = y_history
                    source = f"yahoo:{y_symbol}"
                    break

        # 3) Fallback: existing DB rows
        if not history:
            history = _fetch_history_from_db(db, symbol, period)
            if history:
                source = "db_fallback"

        if not history:
            raise HTTPException(status_code=404, detail="No history found")

        payload = {"symbol": symbol, "history": history}

    else:
        history = _fetch_yahoo_history_rows(symbol, period)
        if not history:
            raise HTTPException(status_code=404, detail="No history found")

        payload = {"symbol": symbol, "history": history}
        source = "yahoo"

    _cache_set(_history_cache, cache_key, payload)

    try:
        static_meta = STOCK_BY_SYMBOL.get(symbol, {})
        _upsert_stock_and_sector(
            db,
            symbol=symbol,
            name=static_meta.get("name", symbol),
            exchange=static_meta.get("exchange"),
            market=static_meta.get("market", _market_for_symbol(symbol)),
            sector=_sector_for(symbol, static_meta.get("name", "")),
            currency=_currency_for_symbol(symbol),
        )

        # Only upsert when source is external; skip rewriting rows when using db fallback.
        if source != "db_fallback":
            _upsert_history_rows(db, symbol, payload["history"], source=source)

        _db_cache_set(db, endpoint_key, symbol, payload, CACHE_TTL_HISTORY)
        db.commit()
    except Exception:
        db.rollback()

    return payload


# -----------------------------
# Endpoints
# -----------------------------
@router.get("/sector-map")
def get_sector_map():
    return {
        "sectors": [
            {"id": "technology", "name": "Technology"},
            {"id": "finance", "name": "Finance"},
            {"id": "healthcare", "name": "Healthcare"},
            {"id": "energy", "name": "Energy"},
            {"id": "consumer", "name": "Consumer"},
        ],
        "mapping": SECTOR_MAP,
    }


@router.get("/search")
def search_stocks(q: str, market: str = "all"):
    if not q:
        return {"results": []}

    q_upper = q.upper().strip()
    source = (
        INDIAN_STOCKS
        if market == "india"
        else INTERNATIONAL_STOCKS
        if market == "international"
        else ALL_STOCKS
    )
    results = [
        _with_sector(s)
        for s in source
        if q_upper in s["symbol"].upper() or q_upper in s["name"].upper()
    ]
    return {"results": results[:12]}


@router.get("/indian")
def get_indian_stocks():
    return {"stocks": [_with_sector(s) for s in INDIAN_STOCKS]}


@router.get("/international")
def get_international_stocks():
    return {"stocks": [_with_sector(s) for s in INTERNATIONAL_STOCKS]}


@router.get("/quote")
def get_quote(symbol: str, db: Session = Depends(get_db)):
    symbol = _normalize_symbol(symbol)
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")

    cache_key = f"q:{symbol}"
    endpoint_key = "/stocks/quote"

    try:
        return _get_quote_payload(symbol, db)
    except HTTPException:
        stale_mem = _cache_get(_quote_cache, cache_key, CACHE_TTL_QUOTE, allow_stale=True)
        if stale_mem:
            return stale_mem
        stale_db = _db_cache_get(db, endpoint_key, symbol, allow_stale=True)
        if stale_db:
            return stale_db
        raise
    except Exception as e:
        stale_mem = _cache_get(_quote_cache, cache_key, CACHE_TTL_QUOTE, allow_stale=True)
        if stale_mem:
            return stale_mem
        stale_db = _db_cache_get(db, endpoint_key, symbol, allow_stale=True)
        if stale_db:
            return stale_db
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quotes")
def get_quotes(
    symbols: str = Query(..., description="Comma-separated symbols"),
    db: Session = Depends(get_db),
):
    symbol_list = [_normalize_symbol(s) for s in symbols.split(",") if s.strip()]
    symbol_list = list(dict.fromkeys(symbol_list))[:50]

    quotes: Dict[str, dict] = {}
    errors: List[dict] = []
    fetched: Dict[str, dict] = {}
    endpoint_key = "/stocks/quote"

    for sym in symbol_list:
        cached = _cache_get(_quote_cache, f"q:{sym}", CACHE_TTL_QUOTE)
        if cached:
            quotes[sym] = cached

    missing_symbols = [sym for sym in symbol_list if sym not in quotes]
    cached_db_quotes = _db_cache_get_many(db, endpoint_key, missing_symbols, allow_stale=False)
    for sym, payload in cached_db_quotes.items():
        _cache_set(_quote_cache, f"q:{sym}", payload)
        quotes[sym] = payload

    remaining_symbols = [sym for sym in symbol_list if sym not in quotes]
    indian_symbols = [sym for sym in remaining_symbols if _is_indian(sym)]
    international_symbols = [sym for sym in remaining_symbols if not _is_indian(sym)]

    for sym in indian_symbols:
        try:
            payload = _load_quote_payload(sym)
            _cache_set(_quote_cache, f"q:{sym}", payload)
            quotes[sym] = payload
            fetched[sym] = payload
        except HTTPException as e:
            stale = _get_cached_quote_payload(sym, db, allow_stale=True)
            if stale:
                quotes[sym] = stale
            else:
                errors.append({"symbol": sym, "status": e.status_code, "detail": e.detail})
        except Exception as e:
            stale = _get_cached_quote_payload(sym, db, allow_stale=True)
            if stale:
                quotes[sym] = stale
            else:
                errors.append({"symbol": sym, "status": 500, "detail": str(e)})

    if international_symbols:
        max_workers = min(8, len(international_symbols))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_map = {
                executor.submit(_load_quote_payload, sym): sym
                for sym in international_symbols
            }
            for future in as_completed(future_map):
                sym = future_map[future]
                try:
                    payload = future.result()
                    _cache_set(_quote_cache, f"q:{sym}", payload)
                    quotes[sym] = payload
                    fetched[sym] = payload
                except HTTPException as e:
                    stale = _get_cached_quote_payload(sym, db, allow_stale=True)
                    if stale:
                        quotes[sym] = stale
                    else:
                        errors.append({"symbol": sym, "status": e.status_code, "detail": e.detail})
                except Exception as e:
                    stale = _get_cached_quote_payload(sym, db, allow_stale=True)
                    if stale:
                        quotes[sym] = stale
                    else:
                        errors.append({"symbol": sym, "status": 500, "detail": str(e)})

    _persist_quote_payloads(db, fetched)

    return {"quotes": quotes, "errors": errors, "count": len(quotes)}


@router.get("/history")
def get_history(symbol: str, period: str = "3mo", db: Session = Depends(get_db)):
    symbol = _normalize_symbol(symbol)
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")

    period = (period or "3mo").lower()
    if period not in {"1mo", "3mo", "6mo", "1y", "2y"}:
        period = "3mo"

    cache_key = f"h:{symbol}:{period}"
    endpoint_key = f"/stocks/history:{period}"

    try:
        return _get_history_payload(symbol, period, db)
    except HTTPException:
        stale_mem = _cache_get(_history_cache, cache_key, CACHE_TTL_HISTORY, allow_stale=True)
        if stale_mem:
            return stale_mem
        stale_db = _db_cache_get(db, endpoint_key, symbol, allow_stale=True)
        if stale_db:
            return stale_db
        raise
    except Exception as e:
        stale_mem = _cache_get(_history_cache, cache_key, CACHE_TTL_HISTORY, allow_stale=True)
        if stale_mem:
            return stale_mem
        stale_db = _db_cache_get(db, endpoint_key, symbol, allow_stale=True)
        if stale_db:
            return stale_db
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/commodity")
def get_commodity(type: str = "gold"):
    try:
        symbol = "GC=F" if type == "gold" else "SI=F"
        data = fetch_yahoo(symbol, {"interval": "1wk", "range": "2y"})
        result = data.get("chart", {}).get("result", [])
        if not result:
            raise HTTPException(status_code=404, detail="Commodity data not found")

        timestamps = result[0].get("timestamp", [])
        closes = result[0].get("indicators", {}).get("quote", [{}])[0].get("close", [])

        commodity_data = []
        for i, ts in enumerate(timestamps):
            if i < len(closes) and closes[i] is not None:
                commodity_data.append({
                    "day": i + 1,
                    "price": round(float(closes[i]), 2),
                    "label": datetime.fromtimestamp(ts).strftime("%b %Y"),
                })

        return {"type": type, "data": commodity_data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
