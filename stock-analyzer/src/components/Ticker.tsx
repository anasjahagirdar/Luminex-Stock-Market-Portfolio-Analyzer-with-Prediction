import { usePortfolioStore } from '../store/portfolioStore'
import type { Stock } from '../types/stock'

type CurrencyCode = 'INR' | 'USD'

const getCurrencyCode = (stock: Stock): CurrencyCode => {
  const raw = String((stock as any).currency ?? '').trim().toUpperCase()
  if (raw === 'INR' || raw.includes('RUPEE')) return 'INR'
  if (raw === 'USD' || raw.includes('DOLLAR')) return 'USD'
  return stock.symbol.endsWith('.BSE') || stock.symbol.endsWith('.NSE') ? 'INR' : 'USD'
}

const getCurrencySymbol = (code: CurrencyCode) => (code === 'INR' ? '₹' : '$')

export default function Ticker() {
  const { stocks } = usePortfolioStore()

  const baseItems = stocks.slice(0, 12)
  const tickerItems = [...baseItems, ...baseItems]

  return (
    <div
      style={{
        height: '28px',
        background: 'rgba(0,0,0,0.4)',
        borderBottom: '1px solid rgba(245,197,24,0.1)',
        overflow: 'hidden',
        position: 'fixed',
        top: '60px',
        left: 0,
        right: 0,
        zIndex: 99,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {tickerItems.length === 0 ? (
        <div
          style={{
            padding: '0 16px',
            fontSize: '0.6rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
          }}
        >
          Loading market tape...
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            animation: 'ticker-scroll 40s linear infinite',
            whiteSpace: 'nowrap',
            gap: '0',
          }}
        >
          {tickerItems.map((stock, i) => {
            const code = getCurrencyCode(stock)
            const symbol = getCurrencySymbol(code)

            return (
              <div
                key={`${stock.id}-${i}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 24px',
                  borderRight: '1px solid rgba(245,197,24,0.08)',
                }}
              >
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: '#F5C518',
                    letterSpacing: '0.1em',
                  }}
                >
                  {stock.symbol}
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  {symbol}
                  {stock.currentPrice.toFixed(2)} {code}
                </span>
                <span
                  style={{
                    fontSize: '0.6rem',
                    color: stock.changePercent >= 0 ? '#4CAF50' : '#F44336',
                  }}
                >
                  {stock.changePercent >= 0 ? '+' : ''}
                  {stock.changePercent}%
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
