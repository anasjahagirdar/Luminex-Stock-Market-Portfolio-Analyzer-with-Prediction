import { useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import type { Stock } from '../types/stock'

interface PriceChartProps {
  stock: Stock
}

type CurrencyCode = 'INR' | 'USD'

const PERIODS: { label: string; days: number }[] = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
]

const getCurrencyCode = (stock: Stock): CurrencyCode => {
  const raw = String((stock as any).currency ?? '').trim().toUpperCase()
  if (raw === 'INR' || raw.includes('RUPEE')) return 'INR'
  if (raw === 'USD' || raw.includes('DOLLAR')) return 'USD'
  return stock.symbol.endsWith('.BSE') || stock.symbol.endsWith('.NSE') ? 'INR' : 'USD'
}

const getCurrencySymbol = (code: CurrencyCode) => (code === 'INR' ? '₹' : '$')

const formatMoney = (value: number, code: CurrencyCode, decimals = 2) =>
  `${getCurrencySymbol(code)}${value.toFixed(decimals)} ${code}`

const formatMaybeMoney = (value: number, code: CurrencyCode, decimals = 2) =>
  Number.isFinite(value) ? formatMoney(value, code, decimals) : '--'

const CustomTooltip = ({
  active,
  payload,
  label,
  currencyCode,
}: any) => {
  if (active && payload && payload.length) {
    const price = Number(payload[0].value)
    return (
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(245,197,24,0.3)',
          borderRadius: '6px',
          padding: '10px 14px',
          fontSize: '0.7rem',
        }}
      >
        <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
        <div style={{ color: '#F5C518', fontWeight: 700 }}>
          {Number.isFinite(price) ? formatMoney(price, currencyCode) : '--'}
        </div>
      </div>
    )
  }
  return null
}

const VolumeTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const vol = Number(payload[0].value)
    return (
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(245,197,24,0.2)',
          borderRadius: '6px',
          padding: '8px 12px',
          fontSize: '0.65rem',
        }}
      >
        <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
        <div style={{ color: 'rgba(245,197,24,0.7)' }}>
          Vol: {Number.isFinite(vol) ? (vol / 1000000).toFixed(2) : '0.00'}M
        </div>
      </div>
    )
  }
  return null
}

export default function PriceChart({ stock }: PriceChartProps) {
  const [activePeriod, setActivePeriod] = useState<number>(90)

  const currencyCode = getCurrencyCode(stock)
  const currencySymbol = getCurrencySymbol(currencyCode)

  const rawHistory = Array.isArray(stock.priceHistory) ? stock.priceHistory : []

  const data = rawHistory
    .filter((p) => Number.isFinite(p.close))
    .slice(-activePeriod)
    .map((p) => ({
      date: p.date?.length >= 7 ? p.date.slice(5) : p.date,
      price: Number(p.close),
      high: Number(p.high),
      low: Number(p.low),
      volume: Number(p.volume),
    }))

  const firstPrice = data[0]?.price ?? 0
  const lastPrice = data[data.length - 1]?.price ?? 0
  const periodChange = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0
  const isPositive = periodChange >= 0

  const tickInterval = data.length > 6 ? Math.floor(data.length / 6) : 0

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid rgba(245,197,24,0.15)',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: '1.6rem',
                fontWeight: 800,
                color: '#F5C518',
                textShadow: '0 0 20px rgba(245,197,24,0.4)',
              }}
            >
              {stock.symbol}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{stock.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '8px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatMoney(stock.currentPrice, currencyCode)}
            </span>
            <span
              style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: stock.changePercent >= 0 ? '#4CAF50' : '#F44336',
              }}
            >
              {stock.changePercent >= 0 ? '+' : ''}
              {stock.changePercent}%
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                color: isPositive ? '#4CAF50' : '#F44336',
              }}
            >
              ({isPositive ? '+' : ''}
              {periodChange.toFixed(2)}% this period)
            </span>
          </div>
        </div>

        {/* Period Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {PERIODS.map(({ label, days }) => (
            <button
              key={label}
              onClick={() => setActivePeriod(days)}
              style={{
                padding: '4px 12px',
                fontSize: '0.65rem',
                background: activePeriod === days ? 'rgba(245,197,24,0.15)' : 'transparent',
                border:
                  activePeriod === days
                    ? '1px solid rgba(245,197,24,0.5)'
                    : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px',
                color: activePeriod === days ? '#F5C518' : 'var(--text-muted)',
                cursor: 'pointer',
                letterSpacing: '0.1em',
                transition: 'all 0.15s ease',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div
        style={{
          display: 'flex',
          gap: '24px',
          marginBottom: '16px',
          padding: '12px 16px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '6px',
          fontSize: '0.7rem',
        }}
      >
        {[
          { label: '52W HIGH', value: formatMaybeMoney(stock.week52High, currencyCode) },
          { label: '52W LOW', value: formatMaybeMoney(stock.week52Low, currencyCode) },
          { label: 'P/E RATIO', value: Number.isFinite(stock.peRatio) ? stock.peRatio.toFixed(2) : '--' },
          { label: 'EPS', value: formatMaybeMoney(stock.eps, currencyCode) },
          {
            label: 'DIV YIELD',
            value: Number.isFinite(stock.dividendYield) ? `${stock.dividendYield}%` : '--',
          },
          {
            label: 'PERIOD CHANGE',
            value: `${isPositive ? '+' : ''}${periodChange.toFixed(2)}%`,
            color: isPositive ? '#4CAF50' : '#F44336',
          },
        ].map((item) => (
          <div key={item.label}>
            <div
              style={{
                color: 'var(--text-muted)',
                marginBottom: '4px',
                letterSpacing: '0.1em',
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                color: (item as any).color ?? 'var(--text-primary)',
                fontWeight: 600,
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {data.length === 0 ? (
        <div
          style={{
            height: '320px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            borderTop: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          No historical data available for this stock.
        </div>
      ) : (
        <>
          {/* Price Chart */}
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F5C518" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F5C518" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${currencySymbol}${Number(v).toFixed(0)}`}
                domain={['auto', 'auto']}
                width={65}
              />
              <Tooltip content={<CustomTooltip currencyCode={currencyCode} />} />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#F5C518"
                strokeWidth={2}
                fill="url(#priceGradient)"
                dot={false}
                activeDot={{
                  r: 4,
                  fill: '#F5C518',
                  stroke: 'rgba(245,197,24,0.5)',
                  strokeWidth: 6,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Volume Chart */}
          <div
            style={{
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div
              style={{
                fontSize: '0.55rem',
                color: 'var(--text-muted)',
                letterSpacing: '0.2em',
                marginBottom: '6px',
              }}
            >
              VOLUME
            </div>
            <ResponsiveContainer width="100%" height={60}>
              <BarChart data={data} margin={{ top: 0, right: 5, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip content={<VolumeTooltip />} />
                <Bar dataKey="volume" fill="rgba(245,197,24,0.25)" radius={[1, 1, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
