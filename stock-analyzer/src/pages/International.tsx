import { useState, useEffect, useRef } from 'react'
import { getInternationalStocks, getStockQuote, getStockHistory, addPortfolioItem } from '../api'
import { usePortfolioStore } from '../store/portfolioStore'
import * as d3 from 'd3'

interface Stock {
  symbol: string
  name: string
  exchange: string
  market: string
  sector?: string
}

interface CandleData {
  date: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}

function CandlestickChart({ data, color }: { data: CandleData[], color: string }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data.length || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const container = svgRef.current.parentElement!
    const width = container.offsetWidth - 2
    const height = 340
    const margin = { top: 20, right: 60, bottom: 40, left: 70 }
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    svg.attr('width', width).attr('height', height)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Scales
    const xScale = d3.scaleBand()
      .domain(data.map((_, i) => i.toString()))
      .range([0, innerW])
      .padding(0.2)

    const yMin = d3.min(data, d => d.low)! * 0.998
    const yMax = d3.max(data, d => d.high)! * 1.002

    const yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([innerH, 0])

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3.axisLeft(yScale)
          .ticks(6)
          .tickSize(-innerW)
          .tickFormat(() => '')
      )
      .call(gEl => {
        gEl.select('.domain').remove()
        gEl.selectAll('.tick line')
          .attr('stroke', 'rgba(255,255,255,0.05)')
          .attr('stroke-dasharray', '3,3')
      })

    // X Axis — show every nth label
    const step = Math.ceil(data.length / 8)
    const xAxis = d3.axisBottom(xScale)
      .tickValues(data.map((_, i) => i.toString()).filter((_, i) => i % step === 0))
      .tickFormat((i) => {
        const d = data[parseInt(i as string)]
        return d3.timeFormat('%b %d')(d.date)
      })

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .call(gEl => {
        gEl.select('.domain').attr('stroke', 'rgba(255,255,255,0.1)')
        gEl.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.1)')
        gEl.selectAll('.tick text')
          .attr('fill', 'rgba(255,255,255,0.35)')
          .attr('font-size', '10px')
          .attr('font-family', 'JetBrains Mono, monospace')
      })

    // Y Axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => `$${d3.format(',.0f')(d as number)}`))
      .call(gEl => {
        gEl.select('.domain').attr('stroke', 'rgba(255,255,255,0.1)')
        gEl.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.1)')
        gEl.selectAll('.tick text')
          .attr('fill', 'rgba(255,255,255,0.35)')
          .attr('font-size', '10px')
          .attr('font-family', 'JetBrains Mono, monospace')
      })

    const candleW = xScale.bandwidth()

    // Wicks
    g.selectAll('.wick')
      .data(data)
      .enter()
      .append('line')
      .attr('class', 'wick')
      .attr('x1', (_, i) => (xScale(i.toString()) ?? 0) + candleW / 2)
      .attr('x2', (_, i) => (xScale(i.toString()) ?? 0) + candleW / 2)
      .attr('y1', d => yScale(d.high))
      .attr('y2', d => yScale(d.low))
      .attr('stroke', d => d.close >= d.open ? '#4CAF50' : '#F44336')
      .attr('stroke-width', 1)

    // Candle bodies
    g.selectAll('.candle')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'candle')
      .attr('x', (_, i) => xScale(i.toString()) ?? 0)
      .attr('y', d => yScale(Math.max(d.open, d.close)))
      .attr('width', candleW)
      .attr('height', d => Math.max(1, Math.abs(yScale(d.open) - yScale(d.close))))
      .attr('fill', d => d.close >= d.open ? '#4CAF50' : '#F44336')
      .attr('rx', 1)

    // Tooltip
    const tooltip = d3.select('body').selectAll('.candle-tooltip').data([1])
      .join('div')
      .attr('class', 'candle-tooltip')
      .style('position', 'fixed')
      .style('pointer-events', 'none')
      .style('background', '#1a1a24')
      .style('border', `1px solid ${color}50`)
      .style('border-radius', '6px')
      .style('padding', '10px 14px')
      .style('font-size', '0.7rem')
      .style('font-family', 'JetBrains Mono, monospace')
      .style('color', '#fff')
      .style('z-index', '9999')
      .style('opacity', '0')
      .style('transition', 'opacity 0.15s ease')
      .style('min-width', '160px')

    // Hover overlay
    g.selectAll('.hover-rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'hover-rect')
      .attr('x', (_, i) => xScale(i.toString()) ?? 0)
      .attr('y', 0)
      .attr('width', candleW + 2)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .on('mouseover', function (_event, d) {
        const pct = ((d.close - d.open) / d.open * 100).toFixed(2)
        const isUp = d.close >= d.open
        tooltip
          .style('opacity', '1')
          .html(`
            <div style="color:${color};font-weight:700;margin-bottom:6px">${d3.timeFormat('%b %d, %Y')(d.date)}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px">
              <span style="color:rgba(255,255,255,0.4)">OPEN</span><span>$${d.open.toFixed(2)}</span>
              <span style="color:rgba(255,255,255,0.4)">HIGH</span><span style="color:#4CAF50">$${d.high.toFixed(2)}</span>
              <span style="color:rgba(255,255,255,0.4)">LOW</span><span style="color:#F44336">$${d.low.toFixed(2)}</span>
              <span style="color:rgba(255,255,255,0.4)">CLOSE</span><span style="color:${isUp ? '#4CAF50' : '#F44336'};font-weight:700">$${d.close.toFixed(2)}</span>
              <span style="color:rgba(255,255,255,0.4)">CHG</span><span style="color:${isUp ? '#4CAF50' : '#F44336'}">${isUp ? '+' : ''}${pct}%</span>
            </div>
          `)
      })
      .on('mousemove', function (event) {
        tooltip
          .style('left', (event.clientX + 16) + 'px')
          .style('top', (event.clientY - 40) + 'px')
      })
      .on('mouseout', function () {
        tooltip.style('opacity', '0')
      })

    // Crosshair vertical line
    const crosshair = g.append('line')
      .attr('stroke', `${color}40`)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4')
      .attr('y1', 0)
      .attr('y2', innerH)
      .style('opacity', 0)

    svg.on('mousemove', function (event) {
      const [mx] = d3.pointer(event, g.node())
      crosshair.attr('x1', mx).attr('x2', mx).style('opacity', 1)
    }).on('mouseleave', function () {
      crosshair.style('opacity', 0)
    })

  }, [data, color])

  return <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
}

export default function International() {
  const { refreshPortfolioData } = usePortfolioStore()
  const [stocks, setStocks] = useState<Stock[]>([])
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null)
  const [quote, setQuote] = useState<any>(null)
  const [candleData, setCandleData] = useState<CandleData[]>([])
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [loadingChart, setLoadingChart] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [message, setMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [period, setPeriod] = useState('3mo')

  useEffect(() => {
    getInternationalStocks().then(setStocks).catch(() => {})
  }, [])

  const handleSelectStock = async (stock: Stock) => {
    setSelectedStock(stock)
    setQuote(null)
    setCandleData([])
    setQuantity('')
    setBuyPrice('')
    setMessage('')
    setLoadingQuote(true)
    setLoadingChart(true)

    try {
      const q = await getStockQuote(stock.symbol)
      setQuote(q)
      setBuyPrice(q.currentPrice.toString())
    } catch {
      setQuote(null)
    } finally {
      setLoadingQuote(false)
    }

    try {
      const hist = await getStockHistory(stock.symbol, period)
      const formatted: CandleData[] = hist.history.map((d: any) => ({
        date: new Date(d.date),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
      }))
      setCandleData(formatted)
    } catch {
      setCandleData([])
    } finally {
      setLoadingChart(false)
    }
  }

  const handlePeriodChange = async (newPeriod: string) => {
    setPeriod(newPeriod)
    if (!selectedStock) return
    setLoadingChart(true)
    try {
      const hist = await getStockHistory(selectedStock.symbol, newPeriod)
      const formatted: CandleData[] = hist.history.map((d: any) => ({
        date: new Date(d.date),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
      }))
      setCandleData(formatted)
    } catch {
      setCandleData([])
    } finally {
      setLoadingChart(false)
    }
  }

  const handleAddToPortfolio = async () => {
    if (!selectedStock) return
    const qty = parseFloat(quantity)
    const price = parseFloat(buyPrice)
    if (isNaN(qty) || qty <= 0) { setMessage('Please enter a valid quantity.'); return }
    if (isNaN(price) || price <= 0) { setMessage('Please enter a valid buy price.'); return }

    const sector = selectedStock.sector ?? 'consumer'
    const market = selectedStock.market ?? 'international'

    try {
      await addPortfolioItem(selectedStock.symbol, selectedStock.name, qty, price, sector, market)
      await refreshPortfolioData()
      setMessage(`✓ Added ${qty} × ${selectedStock.symbol} at $${price}`)
      setQuantity('')
    } catch {
      setMessage('Could not save to portfolio.')
    }
  }

  const filtered = stocks.filter(s =>
    s.name.toUpperCase().includes(searchQuery.toUpperCase()) ||
    s.symbol.toUpperCase().includes(searchQuery.toUpperCase())
  )

  const accentColor = selectedStock?.exchange === 'CRYPTO' ? '#F5C518' : '#2196F3'

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid rgba(33,150,243,0.3)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    padding: '8px 12px',
    fontSize: '0.75rem',
    fontFamily: 'JetBrains Mono, monospace',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#2196F3', textShadow: '0 0 20px rgba(33,150,243,0.3)', letterSpacing: '0.1em', marginBottom: '4px' }}>
          INTERNATIONAL STOCKS
        </h2>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          US Stocks (NASDAQ · NYSE) and Cryptocurrency — prices in USD ($)
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px' }}>

        {/* Left — Stock List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(33,150,243,0.15)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: '8px' }}>SEARCH</div>
            <input type="text" placeholder="AAPL, Bitcoin, Tesla..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(33,150,243,0.15)', borderRadius: '8px', overflow: 'hidden', maxHeight: '65vh', overflowY: 'auto' }}>
            <div style={{ padding: '8px 14px', background: 'rgba(33,150,243,0.07)', borderBottom: '1px solid rgba(33,150,243,0.1)', fontSize: '0.55rem', color: '#2196F3', letterSpacing: '0.2em' }}>
              US STOCKS
            </div>
            {filtered.filter(s => s.exchange !== 'CRYPTO').map(stock => (
              <div key={stock.symbol} onClick={() => handleSelectStock(stock)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)', background: selectedStock?.symbol === stock.symbol ? 'rgba(33,150,243,0.1)' : 'transparent', borderLeft: selectedStock?.symbol === stock.symbol ? '3px solid #2196F3' : '3px solid transparent', transition: 'all 0.15s ease' }}
                onMouseEnter={e => { if (selectedStock?.symbol !== stock.symbol) e.currentTarget.style.background = 'rgba(33,150,243,0.04)' }}
                onMouseLeave={e => { if (selectedStock?.symbol !== stock.symbol) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: selectedStock?.symbol === stock.symbol ? '#2196F3' : 'var(--text-primary)' }}>{stock.symbol}</div>
                    <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginTop: '1px' }}>{stock.name}</div>
                  </div>
                  <div style={{ fontSize: '0.5rem', color: 'rgba(33,150,243,0.4)', letterSpacing: '0.1em' }}>{stock.exchange}</div>
                </div>
              </div>
            ))}

            <div style={{ padding: '8px 14px', background: 'rgba(245,197,24,0.05)', borderBottom: '1px solid rgba(245,197,24,0.1)', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: '0.55rem', color: '#F5C518', letterSpacing: '0.2em' }}>
              CRYPTOCURRENCY
            </div>
            {filtered.filter(s => s.exchange === 'CRYPTO').map(stock => (
              <div key={stock.symbol} onClick={() => handleSelectStock(stock)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)', background: selectedStock?.symbol === stock.symbol ? 'rgba(245,197,24,0.08)' : 'transparent', borderLeft: selectedStock?.symbol === stock.symbol ? '3px solid #F5C518' : '3px solid transparent', transition: 'all 0.15s ease' }}
                onMouseEnter={e => { if (selectedStock?.symbol !== stock.symbol) e.currentTarget.style.background = 'rgba(245,197,24,0.04)' }}
                onMouseLeave={e => { if (selectedStock?.symbol !== stock.symbol) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: selectedStock?.symbol === stock.symbol ? '#F5C518' : 'var(--text-primary)' }}>{stock.name}</div>
                    <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginTop: '1px' }}>{stock.symbol}</div>
                  </div>
                  <div style={{ fontSize: '0.5rem', color: 'rgba(245,197,24,0.4)', letterSpacing: '0.1em' }}>CRYPTO</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Chart + Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!selectedStock ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(33,150,243,0.1)', borderRadius: '8px', padding: '80px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.3 }}>📈</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>SELECT A STOCK TO VIEW CHART</div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', marginTop: '8px' }}>Click any stock from the list on the left</div>
            </div>
          ) : (
            <>
              {/* Quote Header */}
              <div style={{ background: 'var(--bg-card)', border: `1px solid ${accentColor}25`, borderRadius: '8px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.6rem', fontWeight: 800, color: accentColor, textShadow: `0 0 30px ${accentColor}50` }}>
                        {selectedStock.exchange === 'CRYPTO' ? selectedStock.name.toUpperCase() : selectedStock.symbol}
                      </span>
                      <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '4px', letterSpacing: '0.1em' }}>
                        {selectedStock.exchange}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>{selectedStock.name}</div>
                  </div>
                  {loadingQuote ? (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>FETCHING PRICE...</div>
                  ) : quote ? (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Syne, sans-serif', lineHeight: 1 }}>
                        ${quote.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: quote.changePercent >= 0 ? '#4CAF50' : '#F44336', marginTop: '4px' }}>
                        {quote.changePercent >= 0 ? '▲' : '▼'} {Math.abs(quote.changePercent)}%
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '8px' }}>today</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Candlestick Chart */}
              <div style={{ background: 'var(--bg-card)', border: `1px solid ${accentColor}20`, borderRadius: '8px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.2em' }}>CANDLESTICK CHART</div>
                    <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>
                      <span style={{ color: '#4CAF50' }}>■</span> Bullish &nbsp;
                      <span style={{ color: '#F44336' }}>■</span> Bearish
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['1mo', '3mo', '6mo', '1y'].map(p => (
                      <button key={p} onClick={() => handlePeriodChange(p)} style={{ padding: '4px 10px', background: period === p ? `${accentColor}20` : 'transparent', border: `1px solid ${period === p ? accentColor : 'rgba(255,255,255,0.1)'}`, borderRadius: '4px', color: period === p ? accentColor : 'var(--text-muted)', fontSize: '0.6rem', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', transition: 'all 0.15s ease' }}>
                        {p.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {loadingChart ? (
                  <div style={{ height: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: accentColor, letterSpacing: '0.2em', marginBottom: '8px' }}>LOADING CHART DATA</div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Fetching from Yahoo Finance...</div>
                    </div>
                  </div>
                ) : candleData.length > 0 ? (
                  <CandlestickChart data={candleData} color={accentColor} />
                ) : (
                  <div style={{ height: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    No chart data available
                  </div>
                )}
              </div>

              {/* Add to Portfolio */}
              <div style={{ background: 'var(--bg-card)', border: `1px solid ${accentColor}20`, borderRadius: '8px', padding: '20px' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: '16px' }}>ADD TO PORTFOLIO</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                  <div>
                    <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: '6px' }}>QUANTITY</div>
                    <input type="number" placeholder="e.g. 5" value={quantity} onChange={e => setQuantity(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: '6px' }}>BUY PRICE (USD $)</div>
                    <input type="number" placeholder="Auto-filled" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} style={inputStyle} />
                  </div>
                  <button onClick={handleAddToPortfolio} style={{ padding: '9px 18px', background: `${accentColor}15`, border: `1px solid ${accentColor}50`, borderRadius: '6px', color: accentColor, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap', transition: 'all 0.2s ease' }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${accentColor}25` }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${accentColor}15` }}
                  >
                    ADD TO PORTFOLIO
                  </button>
                </div>

                {quantity && buyPrice && parseFloat(quantity) > 0 && parseFloat(buyPrice) > 0 && (
                  <div style={{ marginTop: '10px', fontSize: '0.65rem', color: 'var(--text-muted)', padding: '6px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                    Total Cost: <span style={{ color: accentColor, fontWeight: 700 }}>${(parseFloat(quantity) * parseFloat(buyPrice)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                {message && (
                  <div style={{ marginTop: '10px', fontSize: '0.65rem', color: message.includes('✓') ? '#4CAF50' : '#F44336', padding: '8px 12px', background: message.includes('✓') ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)', borderRadius: '4px', border: `1px solid ${message.includes('✓') ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)'}` }}>
                    {message}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

