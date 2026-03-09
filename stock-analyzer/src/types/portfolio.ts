import type { Stock } from './stock'

export interface PortfolioItem {
  stock: Stock
  quantity: number
  avgBuyPrice: number
  totalInvested: number
  currentValue: number
  profitLoss: number
  profitLossPercent: number
  weight: number
}

export interface HealthScore {
  overall: number
  diversification: number
  riskLevel: 'Low' | 'Medium' | 'High' | 'Very High'
  volatility: number
  sharpeRatio: number
  weaknesses: string[]
  strengths: string[]
}

export interface Portfolio {
  id: string
  name: string
  items: PortfolioItem[]
  totalValue: number
  totalInvested: number
  totalProfitLoss: number
  totalProfitLossPercent: number
  health: HealthScore
  createdAt: string
  updatedAt: string
}