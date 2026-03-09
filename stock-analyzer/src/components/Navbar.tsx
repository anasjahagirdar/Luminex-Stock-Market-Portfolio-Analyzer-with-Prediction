import { useEffect, useState } from 'react'
import { usePortfolioStore } from '../store/portfolioStore'
import { useAuthStore } from '../store/authStore'
import { getPortfolio, getStockQuote } from '../api'
import { formatCurrency } from '../utils/currency'

export default function Navbar() {
  const { portfolio } = usePortfolioStore()
  const { user } = useAuthStore()
  const [realPortfolioValue, setRealPortfolioValue] = useState<number>(0)

  useEffect(() => {
    if (!user) return

    const calculateValue = async () => {
      try {
        const holdings = await getPortfolio()
        if (!holdings || holdings.length === 0) {
          setRealPortfolioValue(0)
          return
        }

        const quoteResults = await Promise.all(
          holdings.map(async (item: any) => {
            try {
              const quote = await getStockQuote(item.symbol)
              return item.quantity * quote.currentPrice
            } catch {
              return item.quantity * item.avg_buy_price
            }
          })
        )

        const total = quoteResults.reduce((sum, v) => sum + v, 0)
        setRealPortfolioValue(total)
      } catch {
        setRealPortfolioValue(0)
      }
    }

    void calculateValue()
  }, [user])

  return (
    <nav
      style={{
        height: '60px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid rgba(245,197,24,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: '1.4rem',
            fontWeight: 800,
            color: '#F5C518',
            textShadow: '0 0 20px rgba(245,197,24,0.6)',
            letterSpacing: '0.2em',
          }}
        >
          LUMINEX
        </span>
        <span
          style={{
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.15em',
            borderLeft: '1px solid rgba(245,197,24,0.2)',
            paddingLeft: '12px',
          }}
        >
          PORTFOLIO ANALYZER
        </span>
      </div>

      {/* Center — Indian market indices */}
      <div style={{ display: 'flex', gap: '24px' }}>
        {['NIFTY 50', 'SENSEX', 'BANK NIFTY'].map((index, i) => {
          const values = ['+1.2%', '+1.8%', '+0.9%']
          return (
            <div key={index} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                {index}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#4CAF50', fontWeight: 600 }}>
                {values[i]}
              </div>
            </div>
          )
        })}
      </div>

      {/* Right — real portfolio value */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          PORTFOLIO VALUE
        </div>
        <div
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: '#F5C518',
            textShadow: '0 0 10px rgba(245,197,24,0.4)',
          }}
        >
          {realPortfolioValue > 0
            ? formatCurrency(realPortfolioValue)
            : portfolio?.totalValue
              ? formatCurrency(portfolio.totalValue)
              : '₹0.00 INR'}
        </div>
      </div>
    </nav>
  )
}
