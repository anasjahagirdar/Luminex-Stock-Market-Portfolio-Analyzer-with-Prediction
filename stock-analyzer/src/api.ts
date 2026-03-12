import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000'
const QUOTE_TTL_MS = 60_000
const HISTORY_TTL_MS = 5 * 60_000
const LIST_TTL_MS = 30 * 60_000
const COMMODITY_TTL_MS = 10 * 60_000

type CacheEntry<T> = {
  expiresAt: number
  value: T
}

const responseCache = new Map<string, CacheEntry<unknown>>()
const inflightRequests = new Map<string, Promise<unknown>>()

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('luminex_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

const getCachedValue = <T>(key: string): T | null => {
  const cached = responseCache.get(key)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(key)
    return null
  }
  return cached.value as T
}

const setCachedValue = <T>(key: string, value: T, ttlMs: number) => {
  responseCache.set(key, { value, expiresAt: Date.now() + ttlMs })
}

const cachedRequest = async <T>(key: string, ttlMs: number, loader: () => Promise<T>) => {
  const cached = getCachedValue<T>(key)
  if (cached !== null) return cached

  const inflight = inflightRequests.get(key) as Promise<T> | undefined
  if (inflight) return inflight

  const request = loader()
    .then((value) => {
      setCachedValue(key, value, ttlMs)
      inflightRequests.delete(key)
      return value
    })
    .catch((error) => {
      inflightRequests.delete(key)
      throw error
    })

  inflightRequests.set(key, request)
  return request
}

const normalizeSymbols = (symbols: string[]) =>
  Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)))

export type MarketFilter = 'all' | 'india' | 'international'

export interface StockListItem {
  symbol: string
  name: string
  exchange: string
  market: string
  sector?: string
}

export interface StockQuoteResponse {
  symbol: string
  currentPrice: number
  previousClose?: number
  change: number
  changePercent: number
  currency?: string
  exchange?: string
  market?: string
  marketCap?: number
  peRatio?: number
  eps?: number
  dividendYield?: number
  week52High?: number
  week52Low?: number
  sector?: string
}

export interface StockHistoryPoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface StockHistoryResponse {
  symbol: string
  history: StockHistoryPoint[]
}

export interface CommodityPoint {
  day: number
  price: number
  label: string
}

export interface CommodityResponse {
  type: 'gold' | 'silver'
  data: CommodityPoint[]
}

// Auth
export const registerUser = async (
  username: string,
  email: string,
  password: string,
  security_question: string,
  security_answer: string
) => {
  const res = await api.post('/auth/register', {
    username,
    email,
    password,
    security_question,
    security_answer,
  })
  return res.data
}

export const getSecurityQuestion = async (username: string) => {
  const res = await api.get(`/auth/security-question/${username}`)
  return res.data
}

export const forgotPassword = async (
  username: string,
  security_answer: string,
  new_password: string
) => {
  const res = await api.post('/auth/forgot-password', {
    username,
    security_answer,
    new_password,
  })
  return res.data
}

export const loginUser = async (username: string, password: string) => {
  const res = await api.post('/auth/login', { username, password })
  return res.data
}

// Portfolio
export const getPortfolio = async () => {
  const res = await api.get('/portfolio/')
  return res.data
}

export const addPortfolioItem = async (
  symbol: string,
  name: string,
  quantity: number,
  avg_buy_price: number,
  sector: string,
  market?: string
) => {
  const res = await api.post('/portfolio/add', {
    symbol,
    name,
    quantity,
    avg_buy_price,
    sector,
    market,
  })
  return res.data
}

export const removePortfolioItem = async (symbol: string) => {
  const res = await api.delete(`/portfolio/remove/${symbol}`)
  return res.data
}

// Stock search and data
export const searchStocks = async (query: string, market: MarketFilter = 'all') => {
  const res = await api.get('/stocks/search', {
    params: { q: query, market },
  })
  return (res.data?.results ?? []) as StockListItem[]
}

export const getStockQuote = async (symbol: string) => {
  const normalized = symbol.trim().toUpperCase()
  return cachedRequest(`quote:${normalized}`, QUOTE_TTL_MS, async () => {
    const res = await api.get('/stocks/quote', {
      params: { symbol: normalized },
    })
    return res.data as StockQuoteResponse
  })
}

export const getStockQuotes = async (symbols: string[]) => {
  const normalized = normalizeSymbols(symbols)
  if (!normalized.length) return {} as Record<string, StockQuoteResponse>

  const cachedQuotes: Record<string, StockQuoteResponse> = {}
  const missingSymbols: string[] = []

  normalized.forEach((symbol) => {
    const cached = getCachedValue<StockQuoteResponse>(`quote:${symbol}`)
    if (cached) {
      cachedQuotes[symbol] = cached
    } else {
      missingSymbols.push(symbol)
    }
  })

  if (!missingSymbols.length) {
    return cachedQuotes
  }

  const batchKey = `quotes:${missingSymbols.slice().sort().join(',')}`
  const fetchedQuotes = await cachedRequest(batchKey, QUOTE_TTL_MS, async () => {
    const res = await api.get('/stocks/quotes', {
      params: { symbols: missingSymbols.join(',') },
    })
    return (res.data?.quotes ?? {}) as Record<string, StockQuoteResponse>
  })

  Object.entries(fetchedQuotes).forEach(([symbol, quote]) => {
    setCachedValue(`quote:${symbol}`, quote, QUOTE_TTL_MS)
  })

  return { ...cachedQuotes, ...fetchedQuotes }
}

export const getSectorMap = async () => {
  const res = await api.get('/stocks/sector-map')
  return (res.data?.mapping ?? {}) as Record<string, string>
}

export const getStockHistory = async (symbol: string, period: string = '1y') => {
  const normalized = symbol.trim().toUpperCase()
  const normalizedPeriod = (period || '1y').toLowerCase()
  return cachedRequest(`history:${normalized}:${normalizedPeriod}`, HISTORY_TTL_MS, async () => {
    const res = await api.get('/stocks/history', {
      params: { symbol: normalized, period: normalizedPeriod },
    })
    return res.data as StockHistoryResponse
  })
}

export const getCommodityData = async (type: 'gold' | 'silver') => {
  return cachedRequest(`commodity:${type}`, COMMODITY_TTL_MS, async () => {
    const res = await api.get('/stocks/commodity', {
      params: { type },
    })
    return res.data as CommodityResponse
  })
}

// Stock lists
export const getIndianStocks = async () => {
  return cachedRequest('stocks:india', LIST_TTL_MS, async () => {
    const res = await api.get('/stocks/indian')
    return (res.data?.stocks ?? []) as StockListItem[]
  })
}

export const getInternationalStocks = async () => {
  return cachedRequest('stocks:international', LIST_TTL_MS, async () => {
    const res = await api.get('/stocks/international')
    return (res.data?.stocks ?? []) as StockListItem[]
  })
}

export interface MLFeatureRow {
  symbol: string
  date: string
  lag_1: number | null
  lag_7: number | null
  rolling_mean_7: number | null
  rolling_std_7: number | null
  momentum: number | null
  volatility: number | null
  created_at?: string | null
}

export interface GenerateMLFeaturesResponse {
  symbol: string
  generated_count: number
  latest_features: MLFeatureRow[]
}

export interface MLFeaturesResponse {
  symbol: string
  count: number
  features: MLFeatureRow[]
}

export interface MLPredictionRow {
  symbol: string
  model: string
  prediction_date: string
  predicted_price: number
  confidence?: number | null
  created_at?: string | null
}

export interface LinearRegressionPredictionResponse {
  symbol: string
  model: 'linear_regression'
  slope: number
  intercept: number
  r2: number
  data_points: number
  forecasts: MLPredictionRow[]
  persisted_count: number
  features_generated?: number
}

export interface MLPredictionsResponse {
  symbol: string
  model?: string | null
  count: number
  predictions: MLPredictionRow[]
}

export const generateMLFeatures = async (symbol: string) => {
  const res = await api.post('/ml/features/generate', null, {
    params: { symbol },
  })
  return res.data as GenerateMLFeaturesResponse
}

export const getMLFeatures = async (symbol: string, limit: number = 100) => {
  const res = await api.get('/ml/features', {
    params: { symbol, limit },
  })
  return res.data as MLFeaturesResponse
}

export const predictLinearRegression = async (
  symbol: string,
  lookback_days: number = 180,
  horizon_days: number = 3,
  persist: boolean = true
) => {
  const res = await api.post('/ml/predict/linear-regression', null, {
    params: { symbol, lookback_days, horizon_days, persist },
  })
  return res.data as LinearRegressionPredictionResponse
}

export const getMLPredictions = async (
  symbol: string,
  model?: string,
  limit: number = 100
) => {
  const res = await api.get('/ml/predictions', {
    params: { symbol, model, limit },
  })
  return res.data as MLPredictionsResponse
}

export default api
