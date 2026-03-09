import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { usePortfolioStore } from '../store/portfolioStore'
import type { Stock } from '../types/stock'

interface PEChartProps {
  stock: Stock
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
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
          P/E: {Number(payload[0].value).toFixed(1)}
        </div>
      </div>
    )
  }
  return null
}

export default function PEChart({ stock }: PEChartProps) {
  const { sectors } = usePortfolioStore()

  const sector = sectors.find((s) => s.id === stock.sector)
  const sectorStocks = sector?.stocks ?? []

  const data = sectorStocks
    .filter((s) => Number.isFinite(s.peRatio) && s.peRatio > 0)
    .map((s) => ({
      symbol: s.symbol,
      pe: s.peRatio,
      isCurrent: s.id === stock.id,
    }))

  const avgPE =
    data.length > 0 ? data.reduce((sum, d) => sum + d.pe, 0) / data.length : 0

  const hasPEData = data.length > 0 && avgPE > 0
  const isCurrentOvervalued = hasPEData ? stock.peRatio > avgPE : false

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid rgba(245,197,24,0.15)',
        borderRadius: '8px',
        padding: '24px',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            fontSize: '0.6rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.2em',
            marginBottom: '4px',
          }}
        >
          P/E RATIO COMPARISON
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: '1rem',
              fontWeight: 700,
              color: '#F5C518',
            }}
          >
            {stock.symbol} vs Sector
          </span>
          <span
            style={{
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              padding: '2px 8px',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px',
            }}
          >
            Sector Avg: {hasPEData ? avgPE.toFixed(1) : '--'}
          </span>
          <span
            style={{
              fontSize: '0.65rem',
              color: hasPEData ? (isCurrentOvervalued ? '#F44336' : '#4CAF50') : 'var(--text-muted)',
              padding: '2px 8px',
              border: `1px solid ${
                hasPEData
                  ? isCurrentOvervalued
                    ? '#F44336'
                    : '#4CAF50'
                  : 'rgba(255,255,255,0.15)'
              }`,
              borderRadius: '4px',
            }}
          >
            {hasPEData
              ? isCurrentOvervalued
                ? 'OVERVALUED vs SECTOR'
                : 'UNDERVALUED vs SECTOR'
              : 'P/E DATA UNAVAILABLE'}
          </span>
        </div>
      </div>

      {!hasPEData ? (
        <div
          style={{
            height: '180px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
          }}
        >
          No valid P/E data for this sector.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="symbol"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={35}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={avgPE}
              stroke="rgba(245,197,24,0.4)"
              strokeDasharray="4 4"
              label={{
                value: `Avg ${avgPE.toFixed(1)}`,
                fill: 'rgba(245,197,24,0.6)',
                fontSize: 10,
              }}
            />
            <Bar
              dataKey="pe"
              radius={[4, 4, 0, 0]}
              fill="rgba(245,197,24,0.3)"
              stroke="rgba(245,197,24,0.6)"
              strokeWidth={1}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
