import type { Stock } from '../types/stock'

interface PricePredictorProps {
  stock: Stock
}

type CurrencyCode = 'INR' | 'USD'

function getCurrencyCode(stock: Stock): CurrencyCode {
  const raw = String((stock as any).currency ?? '').trim().toUpperCase()
  if (raw === 'INR' || raw.includes('RUPEE')) return 'INR'
  if (raw === 'USD' || raw.includes('DOLLAR')) return 'USD'
  return stock.symbol.endsWith('.BSE') || stock.symbol.endsWith('.NSE') ? 'INR' : 'USD'
}

function getCurrencySymbol(code: CurrencyCode) {
  return code === 'INR' ? '₹' : '$'
}

function predictNextDay(stock: Stock): {
  predictedPrice: number
  confidence: number
  direction: 'up' | 'down' | 'neutral'
  changePercent: number
  hasEnoughData: boolean
} {
  const history = [...(stock.priceHistory ?? [])]
    .filter((h) => Number.isFinite(h.close) && h.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)

  const prices = history.map((h) => h.close)

  const n = prices.length
  if (n < 3 || stock.currentPrice <= 0) {
    return {
      predictedPrice: stock.currentPrice,
      confidence: 0,
      direction: 'neutral',
      changePercent: 0,
      hasEnoughData: false,
    }
  }

  const xValues = prices.map((_, i) => i)
  const yValues = prices

  const sumX = xValues.reduce((a, b) => a + b, 0)
  const sumY = yValues.reduce((a, b) => a + b, 0)
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0)
  const sumXX = xValues.reduce((sum, x) => sum + x * x, 0)

  const denominator = n * sumXX - sumX * sumX
  if (denominator === 0) {
    return {
      predictedPrice: stock.currentPrice,
      confidence: 0,
      direction: 'neutral',
      changePercent: 0,
      hasEnoughData: false,
    }
  }

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n
  const predictedPrice = Math.max(0, slope * n + intercept)

  const meanY = sumY / n
  const ssTot = yValues.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0)
  const ssRes = yValues.reduce((sum, y, i) => {
    const predicted = slope * xValues[i] + intercept
    return sum + Math.pow(y - predicted, 2)
  }, 0)

  const r2 = ssTot === 0 ? 0 : Math.max(0, Math.min(1, 1 - ssRes / ssTot))
  const confidence = Math.round(r2 * 100)

  const changePercent = ((predictedPrice - stock.currentPrice) / stock.currentPrice) * 100
  const direction = changePercent > 0.1 ? 'up' : changePercent < -0.1 ? 'down' : 'neutral'

  return { predictedPrice, confidence, direction, changePercent, hasEnoughData: true }
}

export default function PricePredictor({ stock }: PricePredictorProps) {
  const { predictedPrice, confidence, direction, changePercent, hasEnoughData } =
    predictNextDay(stock)

  const currencyCode = getCurrencyCode(stock)
  const currencySymbol = getCurrencySymbol(currencyCode)

  const directionColor =
    direction === 'up' ? '#4CAF50' : direction === 'down' ? '#F44336' : '#FF9800'

  const directionArrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '—'

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
        NEXT-DAY PRICE PREDICTION
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              marginBottom: '4px',
              letterSpacing: '0.1em',
            }}
          >
            PREDICTED PRICE
          </div>
          <div
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              color: directionColor,
              textShadow: `0 0 20px ${directionColor}40`,
              fontFamily: 'Syne, sans-serif',
            }}
          >
            {currencySymbol}
            {predictedPrice.toFixed(2)} {currencyCode}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '2.5rem',
              color: directionColor,
              textShadow: `0 0 20px ${directionColor}60`,
              lineHeight: 1,
            }}
          >
            {directionArrow}
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: directionColor,
              marginTop: '4px',
            }}
          >
            {changePercent >= 0 ? '+' : ''}
            {changePercent.toFixed(2)}%
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              marginBottom: '4px',
              letterSpacing: '0.1em',
            }}
          >
            CURRENT PRICE
          </div>
          <div
            style={{
              fontSize: '1.2rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            {currencySymbol}
            {stock.currentPrice.toFixed(2)} {currencyCode}
          </div>
        </div>
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.6rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.1em',
            marginBottom: '6px',
          }}
        >
          <span>MODEL CONFIDENCE</span>
          <span style={{ color: directionColor }}>{confidence}%</span>
        </div>
        <div
          style={{
            height: '4px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${confidence}%`,
              background: `linear-gradient(to right, ${directionColor}80, ${directionColor})`,
              borderRadius: '2px',
              boxShadow: `0 0 8px ${directionColor}60`,
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: '12px',
          fontSize: '0.55rem',
          color: 'rgba(255,255,255,0.2)',
          letterSpacing: '0.05em',
        }}
      >
        {hasEnoughData
          ? 'Based on 30-point linear regression. Not financial advice.'
          : 'Not enough historical data yet. Prediction will appear after more data is loaded.'}
      </div>
    </div>
  )
}
