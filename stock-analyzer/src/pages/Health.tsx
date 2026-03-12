import { useState } from 'react'
import { removePortfolioItem } from '../api'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  RadialBarChart,
  RadialBar,
} from 'recharts'
import { usePortfolioStore } from '../store/portfolioStore'
import { formatCurrency } from '../utils/currency'

const SECTOR_COLORS = ['#F5C518', '#2196F3', '#4CAF50', '#FF9800', '#E91E63']
const INTL_COLORS = ['#2196F3', '#4CAF50', '#FF9800', '#E91E63', '#9C27B0']

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(245,197,24,0.3)', borderRadius: '6px', padding: '10px 14px', fontSize: '0.7rem' }}>
        <div style={{ color: '#F5C518', fontWeight: 700 }}>{payload[0].name}</div>
        <div style={{ color: 'var(--text-muted)' }}>{payload[0].value.toFixed(1)}%</div>
      </div>
    )
  }
  return null
}

const CustomIntlTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(33,150,243,0.3)', borderRadius: '6px', padding: '10px 14px', fontSize: '0.7rem' }}>
        <div style={{ color: '#2196F3', fontWeight: 700 }}>{payload[0].name}</div>
        <div style={{ color: 'var(--text-muted)' }}>{payload[0].value.toFixed(1)}%</div>
      </div>
    )
  }
  return null
}

export default function Health() {
  const { portfolio, portfolioHoldings, refreshPortfolioData } = usePortfolioStore()
  const [message, setMessage] = useState('')
  const dbHoldings = portfolioHoldings

  // Split holdings into Indian and International
  const indianHoldings = dbHoldings.filter((h) => h.symbol.endsWith('.BSE') || h.symbol.endsWith('.NSE'))
  const intlHoldings = dbHoldings.filter((h) => !h.symbol.endsWith('.BSE') && !h.symbol.endsWith('.NSE'))

  // Indian sector diversification — group by exchange/sector
  const indianSectorMap: Record<string, number> = {}
  indianHoldings.forEach((h) => {
    const key = h.sector || 'BSE'
    indianSectorMap[key] = (indianSectorMap[key] || 0) + (h.quantity * h.avg_buy_price)
  })
  const indianTotal = Object.values(indianSectorMap).reduce((a, b) => a + b, 0)
  const indianPieData = Object.entries(indianSectorMap).map(([name, value], i) => ({
    name,
    value: indianTotal > 0 ? (value / indianTotal) * 100 : 0,
    color: SECTOR_COLORS[i % SECTOR_COLORS.length],
  }))

  // International diversification — group by exchange
  const intlSectorMap: Record<string, number> = {}
  intlHoldings.forEach((h) => {
    const key = h.sector || 'INTL'
    intlSectorMap[key] = (intlSectorMap[key] || 0) + (h.quantity * h.avg_buy_price)
  })
  const intlTotal = Object.values(intlSectorMap).reduce((a, b) => a + b, 0)
  const intlPieData = Object.entries(intlSectorMap).map(([name, value], i) => ({
    name,
    value: intlTotal > 0 ? (value / intlTotal) * 100 : 0,
    color: INTL_COLORS[i % INTL_COLORS.length],
  }))

  // Fallback placeholder data
  const indianDisplay = indianPieData.length > 0 ? indianPieData : [
    { name: 'No Indian Holdings', value: 100, color: 'rgba(245,197,24,0.2)' },
  ]
  const intlDisplay = intlPieData.length > 0 ? intlPieData : [
    { name: 'No Intl Holdings', value: 100, color: 'rgba(33,150,243,0.2)' },
  ]

  const healthScore = portfolio?.health.overall ?? 0
  const gaugeData = [
    { value: healthScore, fill: healthScore >= 70 ? '#4CAF50' : healthScore >= 50 ? '#FF9800' : '#F44336' },
    { value: 100 - healthScore, fill: 'rgba(255,255,255,0.05)' },
  ]

  const totalValue = dbHoldings.reduce((sum, item) => sum + item.quantity * item.avg_buy_price, 0)
  const indianValue = indianHoldings.reduce((sum, item) => sum + item.quantity * item.avg_buy_price, 0)
  const intlValue = intlHoldings.reduce((sum, item) => sum + item.quantity * item.avg_buy_price, 0)

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#F5C518', textShadow: '0 0 20px rgba(245,197,24,0.3)', letterSpacing: '0.1em', marginBottom: '4px' }}>
          PORTFOLIO HEALTH
        </h2>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Health score, risk metrics and portfolio diversification analysis
        </p>
      </div>

      {/* Top Row — Health + Risk + Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {/* Health Score */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(245,197,24,0.15)', borderRadius: '8px', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '12px' }}>OVERALL HEALTH SCORE</div>
          <div style={{ position: 'relative', height: '160px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="55%" outerRadius="85%" data={gaugeData} startAngle={90} endAngle={-270}>
                <RadialBar dataKey="value" cornerRadius={6} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: healthScore >= 70 ? '#4CAF50' : '#FF9800', fontFamily: 'Syne, sans-serif', lineHeight: 1 }}>
                {healthScore}
              </div>
              <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>/ 100</div>
            </div>
          </div>
        </div>

        {/* Risk Metrics */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(245,197,24,0.15)', borderRadius: '8px', padding: '24px' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '16px' }}>RISK METRICS</div>
          {[
            { label: 'RISK LEVEL', value: portfolio?.health.riskLevel ?? 'Medium', color: portfolio?.health.riskLevel === 'Low' ? '#4CAF50' : portfolio?.health.riskLevel === 'High' ? '#F44336' : '#FF9800' },
            { label: 'VOLATILITY', value: `${portfolio?.health.volatility ?? 18.4}%`, color: 'var(--text-primary)' },
            { label: 'SHARPE RATIO', value: portfolio?.health.sharpeRatio ?? 1.24, color: '#2196F3' },
            { label: 'DIVERSIFICATION', value: `${portfolio?.health.diversification ?? 65}/100`, color: '#F5C518' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{item.label}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Portfolio Summary */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(245,197,24,0.15)', borderRadius: '8px', padding: '24px' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '16px' }}>PORTFOLIO SUMMARY</div>
          {[
            { label: 'TOTAL VALUE', value: formatCurrency(totalValue), color: '#F5C518' },
            { label: 'INDIAN STOCKS', value: formatCurrency(indianValue), color: '#F5C518' },
            { label: 'INTL + CRYPTO', value: `$${intlValue.toFixed(2)}`, color: '#2196F3' },
            { label: 'TOTAL HOLDINGS', value: `${dbHoldings.length} stocks`, color: 'var(--text-primary)' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{item.label}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dual Diversification Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {/* Indian Diversification */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(245,197,24,0.15)', borderRadius: '8px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '1rem' }}>🇮🇳</span>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.2em' }}>INDIAN STOCKS DIVERSIFICATION</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <ResponsiveContainer width="55%" height={180}>
              <PieChart>
                <Pie data={indianDisplay} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                  {indianDisplay.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {indianDisplay.map((entry, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.62rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: entry.color, flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-muted)', flex: 1 }}>{entry.name}</span>
                  <span style={{ color: entry.color, fontWeight: 600 }}>{entry.value.toFixed(1)}%</span>
                </div>
              ))}
              <div style={{ marginTop: '12px', padding: '6px 10px', background: 'rgba(245,197,24,0.05)', borderRadius: '4px', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                Total: <span style={{ color: '#F5C518', fontWeight: 700 }}>{formatCurrency(indianValue)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* International Diversification */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(33,150,243,0.15)', borderRadius: '8px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '1rem' }}>🌍</span>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.2em' }}>INTERNATIONAL + CRYPTO DIVERSIFICATION</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <ResponsiveContainer width="55%" height={180}>
              <PieChart>
                <Pie data={intlDisplay} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                  {intlDisplay.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                </Pie>
                <Tooltip content={<CustomIntlTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {intlDisplay.map((entry, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.62rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: entry.color, flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-muted)', flex: 1 }}>{entry.name}</span>
                  <span style={{ color: entry.color, fontWeight: 600 }}>{entry.value.toFixed(1)}%</span>
                </div>
              ))}
              <div style={{ marginTop: '12px', padding: '6px 10px', background: 'rgba(33,150,243,0.05)', borderRadius: '4px', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                Total: <span style={{ color: '#2196F3', fontWeight: 700 }}>${intlValue.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(245,197,24,0.15)', borderRadius: '8px', padding: '24px' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '16px' }}>STRENGTHS AND WEAKNESSES</div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '0.6rem', color: '#4CAF50', letterSpacing: '0.15em', marginBottom: '8px' }}>STRENGTHS</div>
            {portfolio?.health.strengths.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                <span style={{ color: '#4CAF50' }}>+</span><span>{s}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: '0.6rem', color: '#F44336', letterSpacing: '0.15em', marginBottom: '8px' }}>WEAKNESSES</div>
            {portfolio?.health.weaknesses.map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                <span style={{ color: '#F44336' }}>—</span><span>{w}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Holdings breakdown */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(245,197,24,0.15)', borderRadius: '8px', padding: '24px' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '16px' }}>ALLOCATION BREAKDOWN</div>
          {dbHoldings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
              No holdings yet. Add stocks from Indian Stocks or International Stocks pages.
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>🇮🇳 INDIAN</span>
                  <span style={{ fontSize: '0.6rem', color: '#F5C518' }}>{totalValue > 0 ? ((indianValue / totalValue) * 100).toFixed(1) : 0}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${totalValue > 0 ? (indianValue / totalValue) * 100 : 0}%`, background: '#F5C518', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>🌍 INTERNATIONAL + CRYPTO</span>
                  <span style={{ fontSize: '0.6rem', color: '#2196F3' }}>{totalValue > 0 ? ((intlValue / totalValue) * 100).toFixed(1) : 0}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${totalValue > 0 ? (intlValue / totalValue) * 100 : 0}%`, background: '#2196F3', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Holdings Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(245,197,24,0.1)', borderRadius: '8px', padding: '24px' }}>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '16px' }}>CURRENT HOLDINGS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr 1fr 0.8fr 0.8fr auto', padding: '8px 0', borderBottom: '1px solid rgba(245,197,24,0.1)', marginBottom: '4px' }}>
          {['SYMBOL', 'QTY', 'BUY PRICE', 'TOTAL COST', 'MARKET', 'ADDED', ''].map((h) => (
            <div key={h} style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.15em' }}>{h}</div>
          ))}
        </div>

        {dbHoldings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            No holdings yet. Add stocks from the Indian Stocks or International Stocks pages.
          </div>
        ) : (
          dbHoldings.map((item: any) => {
            const isIndian = item.symbol.endsWith('.BSE') || item.symbol.endsWith('.NSE')
            const totalCost = item.quantity * item.avg_buy_price
            const displaySymbol = isIndian ? item.symbol.replace('.BSE', '').replace('.NSE', '') : item.symbol
            return (
              <div key={item.symbol} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr 1fr 0.8fr 0.8fr auto', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.7rem' }}>{isIndian ? '🇮🇳' : '🌍'}</span>
                    <span style={{ color: '#F5C518', fontWeight: 700, fontSize: '0.85rem' }}>{displaySymbol}</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.58rem', marginTop: '1px' }}>{item.name}</div>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{item.quantity}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {isIndian ? `₹${item.avg_buy_price.toFixed(2)}` : `$${item.avg_buy_price.toFixed(2)}`}
                </span>
                <span style={{ color: '#F5C518', fontSize: '0.75rem', fontWeight: 600 }}>
                  {isIndian ? formatCurrency(totalCost) : `$${totalCost.toFixed(2)}`}
                </span>
                <span style={{ fontSize: '0.6rem', color: isIndian ? '#F5C518' : '#2196F3', letterSpacing: '0.05em' }}>
                  {isIndian ? 'BSE' : item.sector}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                  {new Date(item.created_at).toLocaleDateString('en-IN')}
                </span>
                <button
                  onClick={async () => {
                    try {
                      await removePortfolioItem(item.symbol)
                      await refreshPortfolioData()
                      setMessage(`${displaySymbol} removed`)
                    } catch {
                      setMessage('Could not remove.')
                    }
                  }}
                  style={{ padding: '4px 10px', background: 'transparent', border: '1px solid rgba(244,67,54,0.3)', borderRadius: '4px', color: '#F44336', fontSize: '0.55rem', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', transition: 'all 0.15s ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(244,67,54,0.1)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  REMOVE
                </button>
              </div>
            )
          })
        )}

        {dbHoldings.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr 1fr 0.8fr 0.8fr auto', padding: '12px 0', marginTop: '4px', borderTop: '1px solid rgba(245,197,24,0.2)' }}>
            <span style={{ fontSize: '0.65rem', color: '#F5C518', letterSpacing: '0.1em', fontWeight: 700 }}>TOTAL</span>
            <span /><span />
            <span style={{ color: '#F5C518', fontWeight: 700, fontSize: '0.75rem' }}>{formatCurrency(totalValue)}</span>
            <span /><span /><span />
          </div>
        )}
      </div>

      {message && (
        <div style={{ marginTop: '12px', fontSize: '0.65rem', color: '#4CAF50', padding: '8px 12px', background: 'rgba(76,175,80,0.1)', borderRadius: '4px', border: '1px solid rgba(76,175,80,0.3)' }}>
          {message}
        </div>
      )}
    </div>
  )
}

