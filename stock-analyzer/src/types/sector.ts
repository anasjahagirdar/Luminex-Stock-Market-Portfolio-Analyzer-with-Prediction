import type { Stock } from './stock'
import type { ComponentType } from 'react'

export interface Sector {
  id: string
  name: string
  icon: ComponentType<{ size?: number; color?: string }>
  stocks: Stock[]
  performance: number
  totalMarketCap: number
  averagePE: number
}

export interface SectorSummary {
  sectorId: string
  sectorName: string
  stockCount: number
  topPerformer: string
  worstPerformer: string
  averageChange: number
}