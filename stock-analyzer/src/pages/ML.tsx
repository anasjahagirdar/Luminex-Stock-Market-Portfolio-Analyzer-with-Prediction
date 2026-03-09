import { useEffect, useMemo, useState } from 'react'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { getStockHistory, predictLinearRegression } from '../api'
import { usePortfolioStore } from '../store/portfolioStore'
import type { Stock } from '../types/stock'

type RegressionPoint = {
  label: string
  actual: number | null
  predicted: number
}

type ClusterPoint = {
  x: number // volatility
  y: number // momentum
  label: string
  sector: string
  marketCap: number
  features: number[]
  cluster?: number
}

type CurrencyCode = 'INR' | 'USD'
type HistoryRow = { date: string; close: number }

type BackendRegression = {
  slope: number
  intercept: number
  r2: number
  forecasts: { prediction_date: string; predicted_price: number }[]
}

const SECTOR_ORDER = ['technology', 'finance', 'healthcare', 'energy', 'consumer'] as const
const LOOKBACKS = [
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1y' },
] as const

const LOOKBACK_TO_DAYS: Record<(typeof LOOKBACKS)[number]['value'], number> = {
  '3mo': 90,
  '6mo': 180,
  '1y': 365,
}

function getCurrencyCode(stock?: Stock | null): CurrencyCode {
  const raw = String((stock as any)?.currency ?? '').trim().toUpperCase()
  if (raw === 'INR' || raw.includes('RUPEE')) return 'INR'
  if (raw === 'USD' || raw.includes('DOLLAR')) return 'USD'
  const symbol = stock?.symbol ?? ''
  return symbol.endsWith('.BSE') || symbol.endsWith('.NSE') ? 'INR' : 'USD'
}

function getCurrencySymbol(code: CurrencyCode) {
  return code === 'INR' ? '₹' : '$'
}

function linearRegression(data: { x: number; y: number }[]) {
  const n = data.length
  if (n < 2) return { slope: 0, intercept: data[0]?.y ?? 0, r2: 0 }

  const sumX = data.reduce((s, d) => s + d.x, 0)
  const sumY = data.reduce((s, d) => s + d.y, 0)
  const sumXY = data.reduce((s, d) => s + d.x * d.y, 0)
  const sumXX = data.reduce((s, d) => s + d.x * d.x, 0)

  const denominator = n * sumXX - sumX * sumX
  if (denominator === 0) return { slope: 0, intercept: sumY / n, r2: 0 }

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  const meanY = sumY / n
  const ssTot = data.reduce((s, d) => s + Math.pow(d.y - meanY, 2), 0)
  const ssRes = data.reduce((s, d) => s + Math.pow(d.y - (slope * d.x + intercept), 2), 0)
  const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot)

  return { slope, intercept, r2 }
}

function stdDev(values: number[]) {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function normalizeFeatures(points: ClusterPoint[]): ClusterPoint[] {
  if (points.length === 0) return points
  const dims = points[0].features.length

  const mins = Array.from({ length: dims }, (_, i) => Math.min(...points.map((p) => p.features[i])))
  const maxs = Array.from({ length: dims }, (_, i) => Math.max(...points.map((p) => p.features[i])))

  return points.map((p) => ({
    ...p,
    features: p.features.map((v, i) => {
      const range = maxs[i] - mins[i]
      return range === 0 ? 0 : (v - mins[i]) / range
    }),
  }))
}

function initCentroids(points: ClusterPoint[], k: number): number[][] {
  const centroids: number[][] = []
  centroids.push([...points[0].features])

  while (centroids.length < k) {
    let bestIdx = 0
    let bestDist = -1

    points.forEach((p, idx) => {
      const nearest = Math.min(
        ...centroids.map((c) => p.features.reduce((sum, v, dim) => sum + Math.pow(v - c[dim], 2), 0))
      )
      if (nearest > bestDist) {
        bestDist = nearest
        bestIdx = idx
      }
    })

    centroids.push([...points[bestIdx].features])
  }

  return centroids
}

function kMeansClustering(points: ClusterPoint[], k = 3, iterations = 50) {
  if (points.length === 0) return []
  const clusters = Math.max(1, Math.min(k, points.length))

  let centroids = initCentroids(points, clusters)
  let assignments: number[] = new Array(points.length).fill(0)

  for (let iter = 0; iter < iterations; iter++) {
    assignments = points.map((p) => {
      let minDist = Infinity
      let closest = 0

      centroids.forEach((c, i) => {
        const dist = p.features.reduce((sum, v, idx) => sum + Math.pow(v - c[idx], 2), 0)
        if (dist < minDist) {
          minDist = dist
          closest = i
        }
      })

      return closest
    })

    centroids = centroids.map((currentCentroid, i) => {
      const clusterPoints = points.filter((_, j) => assignments[j] === i)
      if (clusterPoints.length === 0) return currentCentroid

      return currentCentroid.map((__, dim) => {
        return clusterPoints.reduce((sum, p) => sum + p.features[dim], 0) / clusterPoints.length
      })
    })
  }

  return points.map((p, i) => ({ ...p, cluster: assignments[i] }))
}

function getSectorOneHot(sector: string): number[] {
  return SECTOR_ORDER.map((s) => (s === sector ? 1 : 0))
}

function getClosesFromRows(rows: HistoryRow[]): number[] {
  return rows.map((r) => Number(r.close)).filter((v) => Number.isFinite(v) && v > 0)
}

function toClosesFromStock(stock: Stock): number[] {
  return (stock.priceHistory ?? []).map((h) => Number(h.close)).filter((v) => Number.isFinite(v) && v > 0)
}

function getVolatilityAndMomentum(closes: number[]) {
  if (closes.length < 2) return { volatility: 0, momentum: 0 }

  const returns = closes
    .slice(1)
    .map((v, i) => ((v - closes[i]) / closes[i]) * 100)
    .filter((r) => Number.isFinite(r))

  const volatility = stdDev(returns)
  const momentum = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100

  return { volatility, momentum }
}

export default function ML() {
  const { stocks, selectedStock } = usePortfolioStore()

  const [selectedSymbol, setSelectedSymbol] = useState('')
  const [lookback, setLookback] = useState<(typeof LOOKBACKS)[number]['value']>('6mo')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([])
  const [backendRegression, setBackendRegression] = useState<BackendRegression | null>(null)
  const [clusterHistoryMap, setClusterHistoryMap] = useState<Record<string, HistoryRow[]>>({})

  useEffect(() => {
    if (selectedSymbol) return
    const fallback = selectedStock?.symbol ?? stocks[0]?.symbol ?? ''
    if (fallback) setSelectedSymbol(fallback)
  }, [stocks, selectedStock, selectedSymbol])

  useEffect(() => {
    if (!selectedSymbol) return

    const loadHistory = async () => {
      setHistoryLoading(true)
      setHistoryError(null)

      const lookbackDays = LOOKBACK_TO_DAYS[lookback] ?? 180

      const [historyResult, regressionResult] = await Promise.allSettled([
        getStockHistory(selectedSymbol, lookback),
        predictLinearRegression(selectedSymbol, lookbackDays, 3, true),
      ])

      if (historyResult.status === 'fulfilled') {
        const rows = (historyResult.value?.history ?? [])
          .map((r: any) => ({ date: String(r.date), close: Number(r.close) }))
          .filter((r: HistoryRow) => Number.isFinite(r.close) && r.close > 0)
          .sort((a: HistoryRow, b: HistoryRow) => a.date.localeCompare(b.date))
        setHistoryRows(rows)
      } else {
        setHistoryRows([])
        setHistoryError('Could not fetch historical data for regression.')
      }

      if (regressionResult.status === 'fulfilled') {
        const data = regressionResult.value
        setBackendRegression({
          slope: Number(data?.slope ?? 0),
          intercept: Number(data?.intercept ?? 0),
          r2: Number(data?.r2 ?? 0),
          forecasts: Array.isArray(data?.forecasts) ? data.forecasts : [],
        })
      } else {
        setBackendRegression(null)
      }

      setHistoryLoading(false)
    }

    void loadHistory()
  }, [selectedSymbol, lookback])

  useEffect(() => {
    const needed = stocks
      .filter((s) => (s.priceHistory?.length ?? 0) < 20)
      .map((s) => s.symbol)
      .filter((sym) => !clusterHistoryMap[sym])
      .slice(0, 16)

    if (needed.length === 0) return

    let cancelled = false

    const loadClusterHistories = async () => {
      const results = await Promise.all(
        needed.map(async (symbol) => {
          try {
            const res = await getStockHistory(symbol, '6mo')
            const rows = (res?.history ?? [])
              .map((r: any) => ({ date: String(r.date), close: Number(r.close) }))
              .filter((r: HistoryRow) => Number.isFinite(r.close) && r.close > 0)
              .sort((a: HistoryRow, b: HistoryRow) => a.date.localeCompare(b.date))
            return [symbol, rows] as const
          } catch {
            return [symbol, []] as const
          }
        })
      )

      if (cancelled) return

      setClusterHistoryMap((prev) => {
        const next: Record<string, HistoryRow[]> = { ...prev }

        for (const [symbol, rows] of results as Array<readonly [string, HistoryRow[]]>) {
          if (!next[symbol]) {
            next[symbol] = rows
          }
        }

        return next
      })
    }

    void loadClusterHistories()

    return () => {
      cancelled = true
    }
  }, [stocks, clusterHistoryMap])

  const activeStock = useMemo(
    () => stocks.find((s) => s.symbol === selectedSymbol) ?? selectedStock ?? null,
    [stocks, selectedSymbol, selectedStock]
  )

  const regressionInput = useMemo(() => historyRows.map((d, i) => ({ x: i + 1, y: d.close })), [historyRows])

  const localRegression = useMemo(() => linearRegression(regressionInput), [regressionInput])
  const { slope, intercept, r2 } = backendRegression ?? localRegression

  const regressionLine: RegressionPoint[] = useMemo(
    () =>
      historyRows.map((d, i) => ({
        label: d.date.slice(5),
        actual: d.close,
        predicted: parseFloat((slope * (i + 1) + intercept).toFixed(2)),
      })),
    [historyRows, slope, intercept]
  )

  const predictions: RegressionPoint[] = useMemo(() => {
    if (backendRegression?.forecasts?.length) {
      return backendRegression.forecasts.map((f, idx) => ({
        label: `+${idx + 1}`,
        actual: null,
        predicted: parseFloat(Number(f.predicted_price).toFixed(2)),
      }))
    }

    if (historyRows.length === 0) return []
    const n = historyRows.length
    return [1, 2, 3].map((step) => ({
      label: `+${step}`,
      actual: null,
      predicted: parseFloat((slope * (n + step) + intercept).toFixed(2)),
    }))
  }, [backendRegression, historyRows, slope, intercept])

  const fullChartData = useMemo(() => [...regressionLine, ...predictions], [regressionLine, predictions])

  const validationScatterData = useMemo(() => {
    return regressionInput.map((p, idx) => ({
      x: p.y,
      y: parseFloat((slope * (idx + 1) + intercept).toFixed(2)),
      label: `D${idx + 1}`,
    }))
  }, [regressionInput, slope, intercept])

  const clusterInputRaw: ClusterPoint[] = useMemo(() => {
    return stocks
      .map((s) => {
        const closesFromStore = toClosesFromStock(s)
        const closesFromFetched = getClosesFromRows(clusterHistoryMap[s.symbol] ?? [])
        const closes = closesFromStore.length >= 20 ? closesFromStore : closesFromFetched

        if (closes.length < 20) return null

        const { volatility, momentum } = getVolatilityAndMomentum(closes)
        const marketCapLog = Math.log10(Math.max(1, s.marketCap || 1))
        const peRatioSafe = Number.isFinite(s.peRatio) && s.peRatio > 0 ? s.peRatio : 0
        const peUndervaluationScore = peRatioSafe > 0 ? 1 / peRatioSafe : 0

        const features = [
          Number.isFinite(s.changePercent) ? s.changePercent : 0,
          volatility,
          momentum,
          marketCapLog,
          peUndervaluationScore,
          ...getSectorOneHot(s.sector),
        ]

        return {
          x: volatility,
          y: momentum,
          label: s.symbol,
          sector: s.sector,
          marketCap: s.marketCap || 0,
          features,
        } as ClusterPoint
      })
      .filter((p): p is ClusterPoint => !!p)
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
  }, [stocks, clusterHistoryMap])

  const clusterInput = useMemo(() => normalizeFeatures(clusterInputRaw), [clusterInputRaw])
  const clustered = useMemo(() => kMeansClustering(clusterInput, 3), [clusterInput])

  const clusterMeta = useMemo(() => {
    return [0, 1, 2].map((clusterId) => {
      const points = clustered.filter((p) => p.cluster === clusterId)
      const avgVol = points.length ? points.reduce((s, p) => s + p.x, 0) / points.length : 0
      const avgMom = points.length ? points.reduce((s, p) => s + p.y, 0) / points.length : 0
      return { clusterId, points, avgVol, avgMom, score: avgMom - avgVol }
    })
  }, [clustered])

  const ranked = useMemo(() => [...clusterMeta].sort((a, b) => b.score - a.score), [clusterMeta])

  const labelByCluster = useMemo(() => {
    const map: Record<number, string> = {}
    if (ranked[0]) map[ranked[0].clusterId] = 'Growth Cluster'
    if (ranked[1]) map[ranked[1].clusterId] = 'Balanced Cluster'
    if (ranked[2]) map[ranked[2].clusterId] = 'Defensive Cluster'
    return map
  }, [ranked])

  const colorByCluster = useMemo(() => {
    const map: Record<number, string> = {}
    if (ranked[0]) map[ranked[0].clusterId] = '#F5C518'
    if (ranked[1]) map[ranked[1].clusterId] = '#2196F3'
    if (ranked[2]) map[ranked[2].clusterId] = '#4CAF50'
    return map
  }, [ranked])

  const clusterGroups = useMemo(() => {
    return [0, 1, 2].map((id) => clustered.filter((p) => p.cluster === id))
  }, [clustered])

  const currencyCode = getCurrencyCode(activeStock)
  const currencySymbol = getCurrencySymbol(currencyCode)

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
          ML ANALYSIS
        </h2>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Real-data linear regression and K-Means clustering
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', marginBottom: '24px' }}>
        <select
          value={selectedSymbol}
          onChange={(e) => setSelectedSymbol(e.target.value)}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(245,197,24,0.3)',
            borderRadius: '6px',
            color: '#F5C518',
            padding: '8px 12px',
            fontSize: '0.75rem',
            outline: 'none',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {stocks.map((s) => (
            <option key={s.symbol} value={s.symbol} style={{ background: '#111118' }}>
              {s.symbol} — {s.name}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: '8px' }}>
          {LOOKBACKS.map((p) => (
            <button
              key={p.value}
              onClick={() => setLookback(p.value)}
              style={{
                padding: '8px 14px',
                fontSize: '0.65rem',
                letterSpacing: '0.2em',
                background: lookback === p.value ? 'rgba(245,197,24,0.1)' : 'transparent',
                border:
                  lookback === p.value
                    ? '1px solid rgba(245,197,24,0.5)'
                    : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px',
                color: lookback === p.value ? '#F5C518' : 'var(--text-muted)',
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {[
          { label: 'STOCK', value: activeStock?.symbol ?? 'N/A', color: '#F5C518' },
          { label: 'DATA POINTS', value: String(historyRows.length), color: 'var(--text-primary)' },
          { label: 'SLOPE', value: slope.toFixed(4), color: 'var(--text-primary)' },
          {
            label: 'R² SCORE',
            value: `${(r2 * 100).toFixed(1)}%`,
            color: r2 > 0.7 ? '#4CAF50' : '#FF9800',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(245,197,24,0.1)',
              borderRadius: '8px',
              padding: '16px',
            }}
          >
            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '8px' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(245,197,24,0.15)',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '4px' }}>
            LINEAR REGRESSION — PRICE FORECAST
          </div>
          <div style={{ display: 'flex', gap: '20px', fontSize: '0.65rem' }}>
            <span style={{ color: '#F5C518' }}>— Actual Price</span>
            <span style={{ color: '#F44336' }}>— Predicted / Forecast</span>
          </div>
        </div>

        {historyLoading ? (
          <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Loading historical data...
          </div>
        ) : historyError ? (
          <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F44336', fontSize: '0.75rem' }}>
            {historyError}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={fullChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={70}
                tickFormatter={(v) => `${currencySymbol}${Number(v).toFixed(0)}`}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid rgba(245,197,24,0.3)',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                }}
                formatter={(v: any) => [`${currencySymbol}${Number(v).toFixed(2)} ${currencyCode}`, '']}
              />
              <Legend wrapperStyle={{ fontSize: '0.65rem', color: 'var(--text-muted)' }} />
              <Line type="monotone" dataKey="actual" stroke="#F5C518" strokeWidth={2} dot={{ r: 3, fill: '#F5C518' }} connectNulls={false} name="Actual" />
              <Line type="monotone" dataKey="predicted" stroke="#F44336" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: '#F44336' }} connectNulls={true} name="Predicted" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(245,197,24,0.15)',
            borderRadius: '8px',
            padding: '24px',
          }}
        >
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '16px' }}>
            SCATTER PLOT — ACTUAL VS PREDICTED
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="x" name="Actual" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis dataKey="y" name="Predicted" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickLine={false} axisLine={false} width={65} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid rgba(245,197,24,0.3)',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                }}
                formatter={(v: any) => [`${currencySymbol}${Number(v).toFixed(2)} ${currencyCode}`, '']}
              />
              <Scatter data={validationScatterData} fill="#F5C518" fillOpacity={0.8} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(245,197,24,0.15)',
            borderRadius: '8px',
            padding: '24px',
          }}
        >
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '8px' }}>
            K-MEANS CLUSTERING — VOLATILITY vs MOMENTUM
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {[0, 1, 2].map((id) => (
              <span
                key={id}
                style={{
                  fontSize: '0.55rem',
                  color: colorByCluster[id] ?? '#888',
                  letterSpacing: '0.05em',
                }}
              >
                — {labelByCluster[id] ?? `Cluster ${id + 1}`}
              </span>
            ))}
          </div>

          {clusterInput.length === 0 ? (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Waiting for real stock features.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="x"
                  name="Volatility"
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: 'Volatility', fill: 'rgba(255,255,255,0.2)', fontSize: 9, position: 'insideBottom', offset: -2 }}
                />
                <YAxis
                  dataKey="y"
                  name="Momentum"
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  label={{ value: 'Momentum%', fill: 'rgba(255,255,255,0.2)', fontSize: 9, angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid rgba(245,197,24,0.3)',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                  }}
                  formatter={(value: any, _name: any, props: any) => {
                    if (props?.name === 'Momentum') return [`${Number(value).toFixed(2)}%`, 'Momentum']
                    if (props?.name === 'Volatility') return [`${Number(value).toFixed(2)}%`, 'Volatility']
                    return [value, '']
                  }}
                  labelFormatter={() => ''}
                />
                {clusterGroups.map((group, i) => (
                  <Scatter
                    key={i}
                    data={group}
                    fill={colorByCluster[i] ?? '#999'}
                    fillOpacity={0.85}
                    name={labelByCluster[i] ?? `Cluster ${i + 1}`}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(245,197,24,0.1)',
          borderRadius: '8px',
          padding: '24px',
        }}
      >
        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '16px' }}>
          NEXT 3 TRADING STEPS FORECAST
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {predictions.map((p, i) => {
            const lastActual = historyRows[historyRows.length - 1]?.close ?? p.predicted
            const change = lastActual > 0 ? ((p.predicted - lastActual) / lastActual) * 100 : 0
            const isUp = change >= 0
            return (
              <div
                key={i}
                style={{
                  padding: '16px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '6px',
                  border: '1px solid rgba(245,197,24,0.2)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '8px' }}>
                  {p.label} FORECAST
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#F5C518', marginBottom: '4px' }}>
                  {currencySymbol}
                  {p.predicted.toFixed(2)} {currencyCode}
                </div>
                <div style={{ fontSize: '0.7rem', color: isUp ? '#4CAF50' : '#F44336' }}>
                  {isUp ? '+' : ''}
                  {change.toFixed(2)}% vs current
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
