import { create } from 'zustand'
import {
  Microchip,
  Landmark,
  HeartPulse,
  Zap,
  ShoppingBag,
} from 'lucide-react'
import {
  getPortfolio,
  getIndianStocks,
  getInternationalStocks,
  getStockHistory,
  getStockQuote,
  getStockQuotes,
} from '../api'
import type { Stock } from '../types/stock'
import type { Sector } from '../types/sector'
import type { Portfolio } from '../types/portfolio'

type PortfolioHoldingResponse = {
  id: number
  symbol: string
  name: string
  quantity: number
  avg_buy_price: number
  sector?: string | null
  market?: string | null
  created_at?: string
}

type StockListItem = {
  symbol: string
  name: string
  exchange: string
  market: string
  sector?: string
}

type SectorConfig = {
  id: string
  name: string
  icon: Sector['icon']
}

const SECTOR_LAYOUT: SectorConfig[] = [
  { id: 'technology', name: 'Technology', icon: Microchip },
  { id: 'finance', name: 'Finance', icon: Landmark },
  { id: 'healthcare', name: 'Healthcare', icon: HeartPulse },
  { id: 'energy', name: 'Energy', icon: Zap },
  { id: 'consumer', name: 'Consumer', icon: ShoppingBag },
]

const SYMBOL_SECTOR_MAP: Record<string, string> = {
  AAPL: 'technology',
  MSFT: 'technology',
  GOOGL: 'technology',
  META: 'technology',
  NVDA: 'technology',
  AMD: 'technology',
  INTC: 'technology',
  'TCS.BSE': 'technology',
  'INFY.BSE': 'technology',
  'WIPRO.BSE': 'technology',
  'HCLTECH.BSE': 'technology',
  'TECHM.BSE': 'technology',

  JPM: 'finance',
  GS: 'finance',
  BAC: 'finance',
  V: 'finance',
  PYPL: 'finance',
  'HDFCBANK.BSE': 'finance',
  'ICICIBANK.BSE': 'finance',
  'SBIN.BSE': 'finance',
  'AXISBANK.BSE': 'finance',
  'KOTAKBANK.BSE': 'finance',
  'BAJFINANCE.BSE': 'finance',
  'BTC-USD': 'finance',
  'ETH-USD': 'finance',
  'BNB-USD': 'finance',
  'SOL-USD': 'finance',
  'XRP-USD': 'finance',
  'ADA-USD': 'finance',
  'DOGE-USD': 'finance',

  JNJ: 'healthcare',
  PFE: 'healthcare',
  'SUNPHARMA.BSE': 'healthcare',
  'DRREDDY.BSE': 'healthcare',

  XOM: 'energy',
  'ONGC.BSE': 'energy',
  'NTPC.BSE': 'energy',
  'TATAPOWER.BSE': 'energy',
  'POWERGRID.BSE': 'energy',

  AMZN: 'consumer',
  TSLA: 'consumer',
  WMT: 'consumer',
  DIS: 'consumer',
  NFLX: 'consumer',
  'RELIANCE.BSE': 'consumer',
  'TATAMOTORS.BSE': 'consumer',
  'TATASTEEL.BSE': 'consumer',
  'HINDUNILVR.BSE': 'consumer',
  'MARUTI.BSE': 'consumer',
  'ADANIENT.BSE': 'consumer',
  'ITC.BSE': 'consumer',
  'BHARTIARTL.BSE': 'consumer',
  'ASIANPAINT.BSE': 'consumer',
  'TITAN.BSE': 'consumer',
  'NESTLEIND.BSE': 'consumer',
  'ULTRACEMCO.BSE': 'consumer',
  'LT.BSE': 'consumer',
}

const safeNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const round2 = (value: number) => Math.round(value * 100) / 100
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const isIndianSymbol = (symbol: string) =>
  symbol.endsWith('.BSE') || symbol.endsWith('.NSE')

const inferExchange = (symbol: string, market?: string | null) => {
  if (symbol.endsWith('.BSE')) return 'BSE'
  if (symbol.endsWith('.NSE')) return 'NSE'
  if (symbol.endsWith('-USD')) return 'CRYPTO'
  return market === 'india' ? 'BSE' : 'NASDAQ'
}

const normalizeCurrency = (value: unknown, symbol: string): 'INR' | 'USD' => {
  const raw = String(value ?? '').trim().toUpperCase()
  if (raw === 'INR' || raw.includes('RUPEE')) return 'INR'
  if (raw === 'USD' || raw.includes('DOLLAR')) return 'USD'
  return isIndianSymbol(symbol) ? 'INR' : 'USD'
}

const getSectorBySymbol = (symbol: string, name = '', apiSector?: string): string => {
  if (apiSector && apiSector.trim()) return apiSector
  if (SYMBOL_SECTOR_MAP[symbol]) return SYMBOL_SECTOR_MAP[symbol]

  const upper = name.toUpperCase()
  if (upper.includes('BANK') || upper.includes('FINANCE') || upper.includes('INSURANCE')) return 'finance'
  if (upper.includes('PHARMA') || upper.includes('HEALTH')) return 'healthcare'
  if (upper.includes('POWER') || upper.includes('ENERGY') || upper.includes('OIL')) return 'energy'
  if (
    upper.includes('TECH') ||
    upper.includes('SOFTWARE') ||
    upper.includes('SEMICONDUCTOR') ||
    upper.includes('COMPUTER')
  ) return 'technology'
  return 'consumer'
}

const normalizeHistory = (rows: any[]): Stock['priceHistory'] => {
  if (!Array.isArray(rows)) return []

  return rows
    .map((row) => ({
      date: String(row?.date ?? ''),
      open: safeNumber(row?.open),
      high: safeNumber(row?.high),
      low: safeNumber(row?.low),
      close: safeNumber(row?.close),
      volume: safeNumber(row?.volume),
    }))
    .filter((row) => row.date && row.close > 0)
}

const enrichWithHistory = (stock: Stock, historyRows: any[]): Stock => {
  const history = normalizeHistory(historyRows)
  if (history.length === 0) return stock

  const highs = history.map((h) => h.high).filter((v) => v > 0)
  const lows = history.map((h) => h.low).filter((v) => v > 0)

  const week52High = highs.length > 0 ? Math.max(...highs) : stock.week52High
  const week52Low = lows.length > 0 ? Math.min(...lows) : stock.week52Low

  return {
    ...stock,
    priceHistory: history,
    week52High: round2(week52High),
    week52Low: round2(week52Low),
  }
}

const buildStock = ({
  meta,
  sector: _sector,
  quote,
  existing,
}: {
  meta: StockListItem
  sector: string
  quote?: any
  existing?: Stock
}): Stock => {
  const resolvedSector = getSectorBySymbol(meta.symbol, meta.name, quote?.sector ?? meta.sector)

  const currentPrice = safeNumber(quote?.currentPrice, existing?.currentPrice ?? 0)
  const change = safeNumber(quote?.change, existing?.change ?? 0)
  const previousClose = safeNumber(quote?.previousClose, currentPrice - change)
  const changePercent = safeNumber(quote?.changePercent, existing?.changePercent ?? 0)

  const fallbackHigh = currentPrice > 0 ? currentPrice * 1.12 : existing?.week52High ?? 0
  const fallbackLow = currentPrice > 0 ? currentPrice * 0.88 : existing?.week52Low ?? 0

  return {
    id: meta.symbol,
    symbol: meta.symbol,
    name: meta.name,
    sector: resolvedSector,
    currentPrice: round2(currentPrice),
    previousClose: round2(previousClose),
    change: round2(change),
    changePercent: round2(changePercent),

    marketCap: safeNumber(quote?.marketCap, existing?.marketCap ?? 0),
    peRatio: safeNumber(quote?.peRatio, existing?.peRatio ?? 20),
    eps: safeNumber(quote?.eps, existing?.eps ?? 0),
    dividendYield: safeNumber(quote?.dividendYield, existing?.dividendYield ?? 0),
    week52High: round2(safeNumber(quote?.week52High, existing?.week52High ?? fallbackHigh)),
    week52Low: round2(safeNumber(quote?.week52Low, existing?.week52Low ?? fallbackLow)),

    priceHistory: existing?.priceHistory ?? [],
    exchange: String(quote?.exchange ?? meta.exchange ?? existing?.exchange ?? ''),
    currency: normalizeCurrency(quote?.currency ?? existing?.currency, meta.symbol),
  }
}

const toStockListItem = (stock: Stock): StockListItem => ({
  symbol: stock.symbol,
  name: stock.name,
  exchange: stock.exchange ?? '',
  market: isIndianSymbol(stock.symbol) ? 'india' : 'international',
  sector: stock.sector,
})

const buildSectors = (stocks: Stock[]): Sector[] => {
  const sectorRank = new Map(SECTOR_LAYOUT.map((s, i) => [s.id, i]))

  const orderedStocks = [...stocks].sort((a, b) => {
    const ra = sectorRank.get(a.sector) ?? 999
    const rb = sectorRank.get(b.sector) ?? 999
    if (ra !== rb) return ra - rb
    return a.symbol.localeCompare(b.symbol)
  })

  return SECTOR_LAYOUT.map((cfg) => {
    const sectorStocks = orderedStocks.filter((s) => s.sector === cfg.id)
    const performance =
      sectorStocks.length > 0
        ? round2(sectorStocks.reduce((sum, s) => sum + s.changePercent, 0) / sectorStocks.length)
        : 0

    const totalMarketCap = sectorStocks.reduce((sum, s) => sum + (s.marketCap || 0), 0)

    const peValues = sectorStocks.map((s) => s.peRatio).filter((v) => v > 0)
    const averagePE =
      peValues.length > 0
        ? round2(peValues.reduce((sum, v) => sum + v, 0) / peValues.length)
        : 0

    return {
      id: cfg.id,
      name: cfg.name,
      icon: cfg.icon,
      stocks: sectorStocks,
      performance,
      totalMarketCap,
      averagePE,
    }
  })
}

const buildQuoteMeta = (stock: Stock): StockListItem => ({
  symbol: stock.symbol,
  name: stock.name,
  exchange: stock.exchange ?? '',
  market: isIndianSymbol(stock.symbol) ? 'india' : 'international',
  sector: stock.sector,
})

let sidebarBootstrapPromise: Promise<void> | null = null

const DEFAULT_PORTFOLIO: Portfolio = {
  id: '1',
  name: 'My Portfolio',
  items: [],
  totalValue: 0,
  totalInvested: 0,
  totalProfitLoss: 0,
  totalProfitLossPercent: 0,
  health: {
    overall: 0,
    diversification: 0,
    riskLevel: 'Low',
    volatility: 0,
    sharpeRatio: 0,
    weaknesses: [],
    strengths: [],
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const buildKnownQuoteMap = (
  holdings: PortfolioHoldingResponse[],
  stocks: Stock[],
  portfolio?: Portfolio | null
): Record<string, any> => {
  const stockMap = new Map(stocks.map((stock) => [stock.symbol, stock]))
  const portfolioMap = new Map((portfolio?.items ?? []).map((item) => [item.stock.symbol, item.stock]))
  const quotes: Record<string, any> = {}
  for (const holding of holdings) {
    const source = stockMap.get(holding.symbol) ?? portfolioMap.get(holding.symbol)
    if (!source || source.currentPrice <= 0) continue
    quotes[holding.symbol] = {
      currentPrice: source.currentPrice,
      previousClose: source.previousClose,
      change: source.change,
      changePercent: source.changePercent,
      currency: source.currency,
      exchange: source.exchange,
      marketCap: source.marketCap,
      peRatio: source.peRatio,
      eps: source.eps,
      dividendYield: source.dividendYield,
      week52High: source.week52High,
      week52Low: source.week52Low,
      sector: holding.sector ?? source.sector,
      market: holding.market ?? (isIndianSymbol(holding.symbol) ? 'india' : 'international'),
    }
  }
  return quotes
}
const buildHealthScore = (
  items: Portfolio['items'],
  totalValue: number,
  totalProfitLossPercent: number
): Portfolio['health'] => {
  if (!items.length || totalValue <= 0) {
    return {
      overall: 0,
      diversification: 0,
      riskLevel: 'Low',
      volatility: 0,
      sharpeRatio: 0,
      weaknesses: ['No holdings added yet'],
      strengths: [],
    }
  }

  const sectorTotals = new Map<string, number>()
  let maxWeight = 0
  let weightedAbsChange = 0

  for (const item of items) {
    const sector = item.stock.sector || 'consumer'
    sectorTotals.set(sector, (sectorTotals.get(sector) ?? 0) + item.currentValue)
    maxWeight = Math.max(maxWeight, item.weight)
    weightedAbsChange += Math.abs(item.stock.changePercent || 0) * (item.weight / 100)
  }

  const hhi = Array.from(sectorTotals.values()).reduce((sum, value) => {
    const weight = value / totalValue
    return sum + weight * weight
  }, 0)

  const diversification = Math.round(clamp((1 - hhi) * 125, 0, 100))
  const volatility = round2(weightedAbsChange * 4)

  let riskLevel: Portfolio['health']['riskLevel'] = 'Low'
  if (volatility >= 30) {
    riskLevel = 'Very High'
  } else if (volatility >= 20) {
    riskLevel = 'High'
  } else if (volatility >= 10) {
    riskLevel = 'Medium'
  }

  const sharpeRatio = round2(totalProfitLossPercent / Math.max(volatility || 1, 1))
  const pnlScore = clamp(50 + totalProfitLossPercent * 5, 0, 100)
  const stabilityScore = clamp(100 - volatility, 0, 100)
  const overall = Math.round(
    clamp(diversification * 0.45 + stabilityScore * 0.35 + pnlScore * 0.2, 0, 100)
  )

  const strengths: string[] = []
  const weaknesses: string[] = []

  if (diversification >= 70) {
    strengths.push('Diversified across multiple sectors')
  } else {
    weaknesses.push('Portfolio is concentrated in a small number of sectors')
  }

  if (maxWeight <= 45) {
    strengths.push('No single holding dominates allocation')
  } else {
    weaknesses.push('One holding dominates portfolio allocation')
  }

  if (totalProfitLossPercent >= 0) {
    strengths.push('Portfolio is currently profitable')
  } else {
    weaknesses.push('Portfolio is currently in drawdown')
  }

  if (volatility < 10) {
    strengths.push('Low day-to-day portfolio volatility')
  } else if (volatility < 20) {
    strengths.push('Moderate portfolio volatility')
  } else {
    weaknesses.push('Elevated portfolio volatility')
  }

  return {
    overall,
    diversification,
    riskLevel,
    volatility,
    sharpeRatio,
    weaknesses,
    strengths,
  }
}

const buildLivePortfolio = (
  holdings: PortfolioHoldingResponse[],
  stocks: Stock[],
  quoteBySymbol: Record<string, any>
): Portfolio => {
  const createdAt = holdings[0]?.created_at ?? new Date().toISOString()

  if (!holdings.length) {
    return {
      ...DEFAULT_PORTFOLIO,
      createdAt,
      updatedAt: new Date().toISOString(),
    }
  }

  const items = holdings.map((holding) => {
    const existingStock = stocks.find((stock) => stock.symbol === holding.symbol)
    const fallbackMeta: StockListItem = {
      symbol: holding.symbol,
      name: holding.name,
      exchange: existingStock?.exchange ?? inferExchange(holding.symbol, holding.market),
      market: holding.market ?? (isIndianSymbol(holding.symbol) ? 'india' : 'international'),
      sector: holding.sector ?? existingStock?.sector,
    }

    const stock = buildStock({
      meta: fallbackMeta,
      sector: getSectorBySymbol(holding.symbol, holding.name, holding.sector ?? existingStock?.sector),
      quote: quoteBySymbol[holding.symbol],
      existing: existingStock,
    })

    const totalInvested = round2(holding.quantity * holding.avg_buy_price)
    const currentValue = round2(holding.quantity * stock.currentPrice)
    const profitLoss = round2(currentValue - totalInvested)
    const profitLossPercent = totalInvested > 0 ? round2((profitLoss / totalInvested) * 100) : 0

    return {
      stock,
      quantity: holding.quantity,
      avgBuyPrice: holding.avg_buy_price,
      totalInvested,
      currentValue,
      profitLoss,
      profitLossPercent,
      weight: 0,
    }
  })

  const totalValue = round2(items.reduce((sum, item) => sum + item.currentValue, 0))
  const totalInvested = round2(items.reduce((sum, item) => sum + item.totalInvested, 0))
  const totalProfitLoss = round2(totalValue - totalInvested)
  const totalProfitLossPercent =
    totalInvested > 0 ? round2((totalProfitLoss / totalInvested) * 100) : 0

  const itemsWithWeight = items.map((item) => ({
    ...item,
    weight: totalValue > 0 ? round2((item.currentValue / totalValue) * 100) : 0,
  }))

  return {
    id: '1',
    name: 'My Portfolio',
    items: itemsWithWeight,
    totalValue,
    totalInvested,
    totalProfitLoss,
    totalProfitLossPercent,
    health: buildHealthScore(itemsWithWeight, totalValue, totalProfitLossPercent),
    createdAt,
    updatedAt: new Date().toISOString(),
  }
}

const fetchQuotesMap = async (symbols: string[]): Promise<Record<string, any>> => {
  const unique = Array.from(new Set(symbols.map((s) => s.trim()).filter(Boolean)))
  if (unique.length === 0) return {}

  try {
    const batch = await getStockQuotes(unique)
    if (batch && typeof batch === 'object' && Object.keys(batch).length > 0) {
      return batch
    }
  } catch {
    // fall back to single-quote calls below
  }

  const pairs = await Promise.all(
    unique.map(async (symbol) => {
      try {
        const quote = await getStockQuote(symbol)
        return [symbol, quote] as const
      } catch {
        return [symbol, null] as const
      }
    })
  )

  const out: Record<string, any> = {}
  for (const [symbol, quote] of pairs) {
    if (quote) out[symbol] = quote
  }
  return out
}

interface PortfolioStore {
  sectors: Sector[]
  stocks: Stock[]
  selectedStock: Stock | null
  selectedSector: string | null
  portfolio: Portfolio | null
  portfolioHoldings: PortfolioHoldingResponse[]
  isSidebarLoading: boolean
  sidebarError: string | null
  initializeSidebarData: () => Promise<void>
  refreshPortfolioData: (holdings?: PortfolioHoldingResponse[]) => Promise<void>
  refreshSidebarQuotes: () => Promise<void>
  selectStockAndLoadHistory: (stock: Stock) => Promise<void>
  setSelectedStock: (stock: Stock) => void
  setSelectedSector: (sectorId: string) => void
  addToPortfolio: (stock: Stock, quantity: number, buyPrice: number) => void
  removeFromPortfolio: (stockId: string) => void
}

export const usePortfolioStore = create<PortfolioStore>((set, get) => ({
  sectors: [],
  stocks: [],
  selectedStock: null,
  selectedSector: 'technology',
  isSidebarLoading: false,
  sidebarError: null,

  portfolio: { ...DEFAULT_PORTFOLIO },
  portfolioHoldings: [],

  initializeSidebarData: async () => {
    const state = get()

    if (state.isSidebarLoading && sidebarBootstrapPromise) {
      return sidebarBootstrapPromise
    }

    if (state.stocks.length > 0 && state.sectors.length > 0) {
      return
    }

    set({ isSidebarLoading: true, sidebarError: null })

    sidebarBootstrapPromise = (async () => {
      try {
        const [intlList, indianList] = await Promise.all([
          getInternationalStocks(),
          getIndianStocks(),
        ])

        const metaMap = new Map<string, StockListItem>()
        ;[...intlList, ...indianList].forEach((item: StockListItem) => {
          if (!metaMap.has(item.symbol)) metaMap.set(item.symbol, item)
        })

        const mergedMeta = Array.from(metaMap.values())

        let stocks = mergedMeta.map((meta) =>
          buildStock({
            meta,
            sector: getSectorBySymbol(meta.symbol, meta.name, meta.sector),
          })
        )

        const prefetchSymbols = stocks
          .filter((s) => !isIndianSymbol(s.symbol))
          .slice(0, 12)
          .map((s) => s.symbol)

        const quoteBySymbol = await fetchQuotesMap(prefetchSymbols)

        stocks = stocks.map((stock) => {
          const quote = quoteBySymbol[stock.symbol]
          if (!quote) return stock
          return buildStock({
            meta: toStockListItem(stock),
            sector: stock.sector,
            quote,
            existing: stock,
          })
        })

        const sectors = buildSectors(stocks)

        const preferredSymbols = ['AAPL', 'MSFT', 'RELIANCE.BSE', 'TCS.BSE']
        const selectedStock =
          stocks.find((s) => preferredSymbols.includes(s.symbol)) ??
          stocks[0] ??
          null

        const selectedSector = selectedStock?.sector ?? 'technology'

        set({
          stocks,
          sectors,
          selectedStock,
          selectedSector,
          isSidebarLoading: false,
          sidebarError: null,
        })

        void get().refreshPortfolioData()

        if (selectedStock) {
          void get().selectStockAndLoadHistory(selectedStock)
        }
      } catch {
        set({
          stocks: [],
          sectors: [],
          selectedStock: null,
          selectedSector: 'technology',
          isSidebarLoading: false,
          sidebarError: 'Failed to load real market data.',
        })
      } finally {
        sidebarBootstrapPromise = null
      }
    })()

    return sidebarBootstrapPromise
  },


  refreshPortfolioData: async (holdings) => {
    try {
      const state = get()
      const portfolioHoldings = holdings ?? await getPortfolio() as PortfolioHoldingResponse[]
      const knownQuoteBySymbol = buildKnownQuoteMap(portfolioHoldings, state.stocks, state.portfolio)
      const missingSymbols = portfolioHoldings
        .map((holding) => holding.symbol)
        .filter((symbol) => !(knownQuoteBySymbol[symbol]?.currentPrice > 0))
      const fetchedQuoteBySymbol = missingSymbols.length > 0 ? await fetchQuotesMap(missingSymbols) : {}
      const portfolio = buildLivePortfolio(
        portfolioHoldings,
        state.stocks,
        { ...knownQuoteBySymbol, ...fetchedQuoteBySymbol }
      )
      set({ portfolio, portfolioHoldings })
    } catch {
      set((state) => ({
        portfolioHoldings: holdings ?? state.portfolioHoldings,
        portfolio: state.portfolio?.items.length ? state.portfolio : { ...DEFAULT_PORTFOLIO },
      }))
    }
  },


  refreshSidebarQuotes: async () => {
    const currentStocks = get().stocks
    if (currentStocks.length === 0) return

    const selectedSymbol = get().selectedStock?.symbol

    const intlSymbols = currentStocks
      .filter((s) => !isIndianSymbol(s.symbol))
      .slice(0, 10)
      .map((s) => s.symbol)

    // Refresh fast by default; only include selected symbol
    // (if user selected Indian, it still refreshes).
    const symbols = Array.from(
      new Set([...intlSymbols, ...(selectedSymbol ? [selectedSymbol] : [])])
    )

    const quoteBySymbol = await fetchQuotesMap(symbols)

    set((state) => {
      const stocks = state.stocks.map((stock) => {
        const quote = quoteBySymbol[stock.symbol]
        if (!quote) return stock
        return buildStock({
          meta: toStockListItem(stock),
          sector: stock.sector,
          quote,
          existing: stock,
        })
      })

      const sectors = buildSectors(stocks)
      const selectedId = state.selectedStock?.id
      const selectedStock = selectedId ? stocks.find((s) => s.id === selectedId) ?? null : null

      return { stocks, sectors, selectedStock }
    })
  },

  selectStockAndLoadHistory: async (stock) => {
    set({ selectedStock: stock, selectedSector: stock.sector })

    const [quoteResult, historyResult] = await Promise.allSettled([
      getStockQuote(stock.symbol),
      getStockHistory(stock.symbol, '1y'),
    ])

    set((state) => {
      const current = state.stocks.find((s) => s.id === stock.id) ?? stock
      let updated = current

      if (quoteResult.status === 'fulfilled') {
        updated = buildStock({
          meta: buildQuoteMeta(updated),
          sector: updated.sector,
          quote: quoteResult.value,
          existing: updated,
        })
      }

      if (historyResult.status === 'fulfilled') {
        updated = enrichWithHistory(updated, historyResult.value?.history ?? [])
      }

      const exists = state.stocks.some((s) => s.id === updated.id)
      const stocks = exists
        ? state.stocks.map((s) => (s.id === updated.id ? updated : s))
        : [...state.stocks, updated]

      const sectors = buildSectors(stocks)

      return {
        stocks,
        sectors,
        selectedStock: updated,
        selectedSector: updated.sector,
      }
    })
  },

  setSelectedStock: (stock) => {
    set({ selectedStock: stock, selectedSector: stock.sector })
    void get().selectStockAndLoadHistory(stock)
  },

  setSelectedSector: (sectorId) => set({ selectedSector: sectorId }),

  addToPortfolio: (stock, quantity, buyPrice) => {
    const { portfolio } = get()
    if (!portfolio) return

    const totalInvested = quantity * buyPrice
    const currentValue = quantity * stock.currentPrice
    const profitLoss = currentValue - totalInvested
    const profitLossPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0

    const newItem = {
      stock,
      quantity,
      avgBuyPrice: buyPrice,
      totalInvested,
      currentValue,
      profitLoss,
      profitLossPercent,
      weight: 0,
    }

    const updatedItems = [...portfolio.items, newItem]
    const newTotalValue = updatedItems.reduce((sum, item) => sum + item.currentValue, 0)

    const itemsWithWeight = updatedItems.map((item) => ({
      ...item,
      weight: newTotalValue > 0 ? (item.currentValue / newTotalValue) * 100 : 0,
    }))

    const totalInvestedAll = updatedItems.reduce((sum, item) => sum + item.totalInvested, 0)
    const totalProfitLossAll = updatedItems.reduce((sum, item) => sum + item.profitLoss, 0)
    const totalProfitLossPercentAll =
      totalInvestedAll > 0 ? (totalProfitLossAll / totalInvestedAll) * 100 : 0

    set({
      portfolio: {
        ...portfolio,
        items: itemsWithWeight,
        totalValue: newTotalValue,
        totalInvested: totalInvestedAll,
        totalProfitLoss: totalProfitLossAll,
        totalProfitLossPercent: totalProfitLossPercentAll,
        health: buildHealthScore(itemsWithWeight, newTotalValue, totalProfitLossPercentAll),
        updatedAt: new Date().toISOString(),
      },
    })
  },

  removeFromPortfolio: (stockId) => {
    const { portfolio } = get()
    if (!portfolio) return

    const updatedItems = portfolio.items.filter((item) => item.stock.id !== stockId)
    const totalValue = updatedItems.reduce((sum, item) => sum + item.currentValue, 0)
    const totalInvested = updatedItems.reduce((sum, item) => sum + item.totalInvested, 0)
    const totalProfitLoss = updatedItems.reduce((sum, item) => sum + item.profitLoss, 0)
    const totalProfitLossPercent =
      totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0

    const itemsWithWeight = updatedItems.map((item) => ({
      ...item,
      weight: totalValue > 0 ? (item.currentValue / totalValue) * 100 : 0,
    }))

    set({
      portfolio: {
        ...portfolio,
        items: itemsWithWeight,
        totalValue,
        totalInvested,
        totalProfitLoss,
        totalProfitLossPercent,
        health: buildHealthScore(itemsWithWeight, totalValue, totalProfitLossPercent),
        updatedAt: new Date().toISOString(),
      },
    })
  },
}))



