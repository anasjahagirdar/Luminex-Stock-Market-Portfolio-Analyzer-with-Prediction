import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { usePortfolioStore } from '../store/portfolioStore'
import type { Stock } from '../types/stock'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

type CurrencyCode = 'INR' | 'USD'

function normalize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || max === min) return 50
  const clamped = Math.max(min, Math.min(max, value))
  return Math.round(((clamped - min) / (max - min)) * 100)
}

function get52wPosition(stock: Stock): number {
  const range = stock.week52High - stock.week52Low
  if (!Number.isFinite(range) || range <= 0) return 0.5
  return (stock.currentPrice - stock.week52Low) / range
}

function getRadarData(stockA: Stock, stockB: Stock) {
  return [
    {
      metric: 'P/E',
      A: normalize(stockA.peRatio > 0 ? 1 / stockA.peRatio : 0, 1 / 80, 1 / 5),
      B: normalize(stockB.peRatio > 0 ? 1 / stockB.peRatio : 0, 1 / 80, 1 / 5),
    },
    { metric: 'EPS', A: normalize(stockA.eps, 0, 40), B: normalize(stockB.eps, 0, 40) },
    {
      metric: 'DIV',
      A: normalize(stockA.dividendYield, 0, 6),
      B: normalize(stockB.dividendYield, 0, 6),
    },
    {
      metric: 'MOMENTUM',
      A: normalize(stockA.changePercent, -5, 5),
      B: normalize(stockB.changePercent, -5, 5),
    },
    {
      metric: '52W POS',
      A: normalize(get52wPosition(stockA), 0, 1),
      B: normalize(get52wPosition(stockB), 0, 1),
    },
  ]
}

function getCurrencyCode(stock: Stock): CurrencyCode {
  const apiCurrency = String((stock as any).currency ?? '')
    .trim()
    .toUpperCase()

  if (apiCurrency === 'INR' || apiCurrency === 'USD') return apiCurrency
  if (stock.symbol.endsWith('.BSE') || stock.symbol.endsWith('.NSE')) return 'INR'
  return 'USD'
}

function getCurrencySymbol(code: CurrencyCode): string {
  return code === 'INR' ? '₹' : '$'
}

function formatMoney(value: number, code: CurrencyCode): string {
  return `${getCurrencySymbol(code)}${value.toFixed(2)} ${code}`
}

function formatTrillion(value: number, code: CurrencyCode): string {
  return `${getCurrencySymbol(code)}${(value / 1e12).toFixed(2)}T ${code}`
}

function MetricRow({
  label,
  valueA,
  valueB,
  format = (v: number) => v.toString(),
  formatA,
  formatB,
  higherIsBetter = true,
  compareEnabled = true,
}: {
  label: string
  valueA: number
  valueB: number
  format?: (v: number) => string
  formatA?: (v: number) => string
  formatB?: (v: number) => string
  higherIsBetter?: boolean
  compareEnabled?: boolean
}) {
  const aWins = compareEnabled && (higherIsBetter ? valueA > valueB : valueA < valueB)
  const bWins = compareEnabled && (higherIsBetter ? valueB > valueA : valueB < valueA)
  const tie = !compareEnabled || valueA === valueB

  const renderA = formatA ?? format
  const renderB = formatB ?? format

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        gap: '16px',
      }}
    >
      <div
        style={{
          textAlign: 'right',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: aWins ? '#4CAF50' : tie ? 'var(--text-primary)' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '8px',
        }}
      >
        {aWins && (
          <span
            style={{
              fontSize: '0.55rem',
              background: 'rgba(76,175,80,0.15)',
              border: '1px solid rgba(76,175,80,0.4)',
              color: '#4CAF50',
              padding: '1px 6px',
              borderRadius: '3px',
              letterSpacing: '0.1em',
            }}
          >
            BETTER
          </span>
        )}
        {renderA(valueA)}
      </div>
      <div
        style={{
          fontSize: '0.55rem',
          color: 'var(--text-muted)',
          letterSpacing: '0.15em',
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
      <div
        style={{
          textAlign: 'left',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: bWins ? '#4CAF50' : tie ? 'var(--text-primary)' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {renderB(valueB)}
        {bWins && (
          <span
            style={{
              fontSize: '0.55rem',
              background: 'rgba(76,175,80,0.15)',
              border: '1px solid rgba(76,175,80,0.4)',
              color: '#4CAF50',
              padding: '1px 6px',
              borderRadius: '3px',
              letterSpacing: '0.1em',
            }}
          >
            BETTER
          </span>
        )}
      </div>
    </div>
  )
}

export default function Compare() {
  const { stocks } = usePortfolioStore()

  const [stockAId, setStockAId] = useState('')
  const [stockBId, setStockBId] = useState('')

  useEffect(() => {
    if (stocks.length === 0) return
    if (!stockAId) setStockAId(stocks[0].id)
    if (!stockBId) setStockBId(stocks[1]?.id ?? stocks[0].id)
  }, [stocks, stockAId, stockBId])

  const stockA = useMemo(
    () => stocks.find((s) => s.id === stockAId) ?? stocks[0] ?? null,
    [stocks, stockAId]
  )
  const stockB = useMemo(
    () => stocks.find((s) => s.id === stockBId) ?? stocks[1] ?? stocks[0] ?? null,
    [stocks, stockBId]
  )

  if (!stockA || !stockB) {
    return (
      <div style={{ padding: '24px' }}>
        <h2
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#F5C518',
            textShadow: '0 0 20px rgba(245,197,24,0.3)',
            letterSpacing: '0.1em',
            marginBottom: '4px',
          }}
        >
          STOCK COMPARISON
        </h2>
        <div
          style={{
            marginTop: '16px',
            background: 'var(--bg-card)',
            border: '1px solid rgba(245,197,24,0.1)',
            borderRadius: '8px',
            padding: '24px',
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            textAlign: 'center',
          }}
        >
          Real stock data is loading. Please wait...
        </div>
      </div>
    )
  }

  const currencyA = getCurrencyCode(stockA)
  const currencyB = getCurrencyCode(stockB)
  const sameCurrency = currencyA === currencyB

  const radarData = getRadarData(stockA, stockB)

  const priceDataA = (stockA.priceHistory ?? [])
    .slice(-90)
    .map((p) => ({ date: p.date.slice(5), price: p.close }))
  const priceDataB = (stockB.priceHistory ?? [])
    .slice(-90)
    .map((p) => ({ date: p.date.slice(5), price: p.close }))

  const selectStyle: CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid rgba(245,197,24,0.3)',
    borderRadius: '6px',
    color: '#F5C518',
    padding: '8px 12px',
    fontSize: '0.75rem',
    cursor: 'pointer',
    outline: 'none',
    fontFamily: 'JetBrains Mono, monospace',
    width: '100%',
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#F5C518',
            textShadow: '0 0 20px rgba(245,197,24,0.3)',
            letterSpacing: '0.1em',
            marginBottom: '4px',
          }}
        >
          STOCK COMPARISON
        </h2>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Select two stocks to compare side by side
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: '16px',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <select value={stockAId} onChange={(e) => setStockAId(e.target.value)} style={selectStyle}>
          {stocks.map((s) => (
            <option key={s.id} value={s.id} style={{ background: '#111118' }}>
              {s.symbol} — {s.name}
            </option>
          ))}
        </select>
        <div
          style={{
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.2em',
            padding: '0 8px',
          }}
        >
          VS
        </div>
        <select value={stockBId} onChange={(e) => setStockBId(e.target.value)} style={selectStyle}>
          {stocks.map((s) => (
            <option key={s.id} value={s.id} style={{ background: '#111118' }}>
              {s.symbol} — {s.name}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {[
          { stock: stockA, data: priceDataA, color: '#F5C518' },
          { stock: stockB, data: priceDataB, color: '#2196F3' },
        ].map(({ stock, data, color }) => {
          const currency = getCurrencyCode(stock)
          return (
            <div
              key={stock.id}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${color}30`,
                borderRadius: '8px',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <span
                    style={{
                      fontFamily: 'Syne, sans-serif',
                      fontSize: '1.2rem',
                      fontWeight: 800,
                      color,
                      textShadow: `0 0 15px ${color}50`,
                    }}
                  >
                    {stock.symbol}
                  </span>
                  <span style={{ marginLeft: '8px', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {stock.name}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatMoney(stock.currentPrice, currency)}
                  </div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: stock.changePercent >= 0 ? '#4CAF50' : '#F44336',
                    }}
                  >
                    {stock.changePercent >= 0 ? '+' : ''}
                    {stock.changePercent}%
                  </div>
                </div>
              </div>

              {data.length === 0 ? (
                <div
                  style={{
                    height: '140px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.7rem',
                  }}
                >
                  No chart data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`grad-${stock.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-card)',
                        border: `1px solid ${color}40`,
                        borderRadius: '6px',
                        fontSize: '0.7rem',
                      }}
                      formatter={(v: any) => [formatMoney(Number(v), currency), 'Price']}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={color}
                      strokeWidth={2}
                      fill={`url(#grad-${stock.id})`}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          )
        })}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.5fr',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
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
              marginBottom: '8px',
            }}
          >
            RADAR COMPARISON
          </div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.65rem', color: '#F5C518' }}>— {stockA.symbol}</span>
            <span style={{ fontSize: '0.65rem', color: '#2196F3' }}>— {stockB.symbol}</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <Radar name={stockA.symbol} dataKey="A" stroke="#F5C518" fill="#F5C518" fillOpacity={0.15} strokeWidth={2} />
              <Radar name={stockB.symbol} dataKey="B" stroke="#2196F3" fill="#2196F3" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(245,197,24,0.1)',
            borderRadius: '8px',
            padding: '24px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', marginBottom: '8px' }}>
            <div
              style={{
                textAlign: 'right',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#F5C518',
                textShadow: '0 0 10px rgba(245,197,24,0.4)',
              }}
            >
              {stockA.symbol}
            </div>
            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
              METRIC
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#2196F3',
                textShadow: '0 0 10px rgba(33,150,243,0.4)',
              }}
            >
              {stockB.symbol}
            </div>
          </div>

          <MetricRow
            label="PRICE"
            valueA={stockA.currentPrice}
            valueB={stockB.currentPrice}
            formatA={(v) => formatMoney(v, currencyA)}
            formatB={(v) => formatMoney(v, currencyB)}
            higherIsBetter={false}
            compareEnabled={sameCurrency}
          />
          <MetricRow
            label="CHANGE %"
            valueA={stockA.changePercent}
            valueB={stockB.changePercent}
            format={(v) => `${v > 0 ? '+' : ''}${v}%`}
          />
          <MetricRow
            label="P/E RATIO"
            valueA={stockA.peRatio}
            valueB={stockB.peRatio}
            format={(v) => v.toFixed(1)}
            higherIsBetter={false}
          />
          <MetricRow
            label="EPS"
            valueA={stockA.eps}
            valueB={stockB.eps}
            formatA={(v) => formatMoney(v, currencyA)}
            formatB={(v) => formatMoney(v, currencyB)}
            compareEnabled={sameCurrency}
          />
          <MetricRow
            label="DIV YIELD"
            valueA={stockA.dividendYield}
            valueB={stockB.dividendYield}
            format={(v) => `${v}%`}
          />
          <MetricRow
            label="MKT CAP"
            valueA={stockA.marketCap}
            valueB={stockB.marketCap}
            formatA={(v) => formatTrillion(v, currencyA)}
            formatB={(v) => formatTrillion(v, currencyB)}
            compareEnabled={sameCurrency}
          />
          <MetricRow
            label="52W HIGH"
            valueA={stockA.week52High}
            valueB={stockB.week52High}
            formatA={(v) => formatMoney(v, currencyA)}
            formatB={(v) => formatMoney(v, currencyB)}
            compareEnabled={sameCurrency}
          />
        </div>
      </div>
    </div>
  )
}
