export interface StockPrice {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type CurrencyCode = 'INR' | 'USD'

export interface Stock {
  id: string
  symbol: string
  name: string
  sector: string
  currentPrice: number
  previousClose: number
  change: number
  changePercent: number
  marketCap: number
  peRatio: number
  eps: number
  dividendYield: number
  week52High: number
  week52Low: number
  priceHistory: StockPrice[]
  currency?: CurrencyCode
  exchange?: string
}

export interface StockComparison {
  stockA: Stock
  stockB: Stock
  metrics: ComparisonMetric[]
}

export interface ComparisonMetric {
  label: string
  valueA: number
  valueB: number
  winner: 'A' | 'B' | 'tie'
}
