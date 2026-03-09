import type { Sector } from '../types/sector'
import { mockStocks } from './mockStocks'
import {
  Microchip,
  Landmark,
  HeartPulse,
  Zap,
  ShoppingBag,
} from 'lucide-react'

export const mockSectors: Sector[] = [
  {
    id: 'technology',
    name: 'Technology',
    icon: Microchip,
    stocks: mockStocks.filter(s => s.sector === 'technology'),
    performance: 2.18,
    totalMarketCap: 8210000000000,
    averagePE: 32.1,
  },
  {
    id: 'finance',
    name: 'Finance',
    icon: Landmark,
    stocks: mockStocks.filter(s => s.sector === 'finance'),
    performance: 1.27,
    totalMarketCap: 718000000000,
    averagePE: 12.5,
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    icon: HeartPulse,
    stocks: mockStocks.filter(s => s.sector === 'healthcare'),
    performance: 1.39,
    totalMarketCap: 527000000000,
    averagePE: 13.85,
  },
  {
    id: 'energy',
    name: 'Energy',
    icon: Zap,
    stocks: mockStocks.filter(s => s.sector === 'energy'),
    performance: 2.17,
    totalMarketCap: 450000000000,
    averagePE: 13.9,
  },
  {
    id: 'consumer',
    name: 'Consumer',
    icon: ShoppingBag,
    stocks: mockStocks.filter(s => s.sector === 'consumer'),
    performance: 1.77,
    totalMarketCap: 2692000000000,
    averagePE: 67.25,
  },
]