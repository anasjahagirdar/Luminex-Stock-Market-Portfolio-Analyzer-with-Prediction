import { usePortfolioStore } from '../store/portfolioStore'
import PriceChart from '../components/PriceChart'
import PEChart from '../components/PEChart'
import OpportunityChart from '../components/OpportunityChart'
import PricePredictor from '../components/PricePredictor'
import { formatCurrency } from '../utils/currency'
import type { Stock } from '../types/stock'

type CurrencyCode = 'INR' | 'USD'

function getCurrencyCode(stock: Stock): CurrencyCode {
  const raw = String((stock as any).currency ?? '').trim().toUpperCase()
  if (raw === 'INR' || raw.includes('RUPEE')) return 'INR'
  if (raw === 'USD' || raw.includes('DOLLAR')) return 'USD'
  if (stock.symbol.endsWith('.BSE') || stock.symbol.endsWith('.NSE')) return 'INR'
  return 'USD'
}

function getCurrencySymbol(code: CurrencyCode) {
  return code === 'INR' ? '₹' : '$'
}

function formatMoney(value: number, code: CurrencyCode) {
  return `${getCurrencySymbol(code)}${value.toFixed(2)} ${code}`
}

export default function Dashboard() {
  const { selectedStock, portfolio, isSidebarLoading, sidebarError } = usePortfolioStore()

  return (
    <div style={{ padding: '24px' }}>
      {/* Page Title */}
      <div style={{ marginBottom: '24px' }}>
        <h2
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#F5C518',
            textShadow: '0 0 20px rgba(245,197,24,0.3)',
            letterSpacing: '0.1em',
          }}
        >
          DASHBOARD
        </h2>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Stats Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {[
          {
            label: 'TOTAL VALUE',
            value: portfolio?.totalValue ? formatCurrency(portfolio.totalValue) : '₹0.00 INR',
            color: '#F5C518',
          },
          {
            label: 'PROFIT / LOSS',
            value: portfolio?.totalProfitLoss
              ? formatCurrency(portfolio.totalProfitLoss)
              : '₹0.00 INR',
            color: (portfolio?.totalProfitLoss ?? 0) >= 0 ? '#4CAF50' : '#F44336',
          },
          {
            label: 'HEALTH SCORE',
            value: `${portfolio?.health.overall ?? 0}/100`,
            color: '#2196F3',
          },
          {
            label: 'RISK LEVEL',
            value: portfolio?.health.riskLevel ?? 'N/A',
            color: '#FF9800',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(245,197,24,0.1)',
              borderRadius: '8px',
              padding: '16px',
              transition: 'border-color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(245,197,24,0.4)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(245,197,24,0.1)')}
          >
            <div
              style={{
                fontSize: '0.55rem',
                color: 'var(--text-muted)',
                letterSpacing: '0.2em',
                marginBottom: '8px',
              }}
            >
              {stat.label}
            </div>
            <div
              style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                color: stat.color,
                textShadow: `0 0 10px ${stat.color}40`,
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {!selectedStock && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(245,197,24,0.1)',
            borderRadius: '8px',
            padding: '28px',
            marginBottom: '24px',
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            textAlign: 'center',
          }}
        >
          {isSidebarLoading
            ? 'Loading real market data...'
            : sidebarError
              ? sidebarError
              : 'Select a stock from the sidebar to view dashboard analytics.'}
        </div>
      )}

      {/* Price Chart — full width */}
      {selectedStock && <PriceChart stock={selectedStock} />}

      {/* Bottom Grid — 3 columns */}
      {selectedStock && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <PEChart stock={selectedStock} />
          <OpportunityChart stock={selectedStock} />
          <PricePredictor stock={selectedStock} />
        </div>
      )}

      {/* Portfolio Holdings */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(245,197,24,0.1)',
          borderRadius: '8px',
          padding: '24px',
        }}
      >
        <div
          style={{
            fontSize: '0.6rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.2em',
            marginBottom: '16px',
          }}
        >
          PORTFOLIO HOLDINGS
        </div>
        {portfolio?.items.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
            }}
          >
            No holdings yet. Add stocks from the Portfolio Health page.
          </div>
        ) : (
          portfolio?.items.map((item) => {
            const code = getCurrencyCode(item.stock)
            return (
              <div
                key={item.stock.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <span style={{ color: '#F5C518', fontWeight: 600 }}>{item.stock.symbol}</span>
                <span style={{ color: 'var(--text-muted)' }}>{item.quantity} shares</span>
                <span style={{ color: 'var(--text-primary)' }}>{formatMoney(item.currentValue, code)}</span>
                <span style={{ color: item.profitLoss >= 0 ? '#4CAF50' : '#F44336' }}>
                  {item.profitLoss >= 0 ? '+' : '-'}
                  {formatMoney(Math.abs(item.profitLoss), code)}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
