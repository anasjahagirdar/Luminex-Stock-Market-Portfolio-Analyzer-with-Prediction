import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
} from 'recharts'
import type { Stock } from '../types/stock'

interface OpportunityChartProps {
  stock: Stock
}

function getOpportunityScore(stock: Stock): {
  score: number
  label: string
  color: string
  reasons: string[]
} {
  let score = 50
  const reasons: string[] = []

  // P/E based scoring
  if (Number.isFinite(stock.peRatio) && stock.peRatio > 0) {
    if (stock.peRatio < 15) {
      score += 20
      reasons.push('Low P/E ratio — potentially undervalued')
    } else if (stock.peRatio > 40) {
      score -= 15
      reasons.push('High P/E ratio — priced for high growth')
    }
  }

  // Price vs 52W low
  if (Number.isFinite(stock.week52Low) && stock.week52Low > 0) {
    const distFromLow = ((stock.currentPrice - stock.week52Low) / stock.week52Low) * 100
    if (distFromLow < 20) {
      score += 15
      reasons.push('Near 52-week low — potential entry point')
    } else if (distFromLow > 80) {
      score -= 10
      reasons.push('Near 52-week high — limited upside')
    }
  }

  // Dividend yield
  if (Number.isFinite(stock.dividendYield) && stock.dividendYield > 3) {
    score += 10
    reasons.push('Strong dividend yield')
  }

  // Recent momentum
  if (Number.isFinite(stock.changePercent) && stock.changePercent > 0) {
    score += 5
    reasons.push('Positive recent momentum')
  }

  score = Math.max(10, Math.min(95, score))

  let label = 'NEUTRAL'
  let color = '#FF9800'
  if (score >= 70) {
    label = 'STRONG BUY'
    color = '#4CAF50'
  } else if (score >= 55) {
    label = 'BUY'
    color = '#8BC34A'
  } else if (score <= 30) {
    label = 'AVOID'
    color = '#F44336'
  } else if (score <= 44) {
    label = 'WEAK'
    color = '#FF5722'
  }

  if (reasons.length === 0) {
    reasons.push('Limited fundamentals available — score based on available data')
  }

  return { score, label, color, reasons }
}

export default function OpportunityChart({ stock }: OpportunityChartProps) {
  const { score, label, color, reasons } = getOpportunityScore(stock)

  const data = [
    { name: 'score', value: score, fill: color },
    { name: 'remaining', value: 100 - score, fill: 'rgba(255,255,255,0.05)' },
  ]

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid rgba(245,197,24,0.15)',
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
        OPPORTUNITY SCORE
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        {/* Radial Chart */}
        <div style={{ position: 'relative', width: '140px', height: '140px', flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="90%"
              data={data}
              startAngle={90}
              endAngle={-270}
            >
              <RadialBar dataKey="value" cornerRadius={4} />
            </RadialBarChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                color: color,
                textShadow: `0 0 10px ${color}60`,
                lineHeight: 1,
              }}
            >
              {score}
            </div>
            <div
              style={{
                fontSize: '0.5rem',
                color: 'var(--text-muted)',
                letterSpacing: '0.1em',
              }}
            >
              /100
            </div>
          </div>
        </div>

        {/* Right side */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              background: `${color}20`,
              border: `1px solid ${color}60`,
              borderRadius: '4px',
              color: color,
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.15em',
              marginBottom: '12px',
            }}
          >
            {label}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {reasons.map((reason, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  fontSize: '0.65rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span style={{ color: color, marginTop: '1px' }}>—</span>
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
