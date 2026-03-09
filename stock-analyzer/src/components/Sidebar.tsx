import { useEffect, useMemo, useState } from 'react'
import { usePortfolioStore } from '../store/portfolioStore'
import type { Sector } from '../types/sector'
import type { Stock } from '../types/stock'

type CurrencyCode = 'INR' | 'USD'

const isIndianSymbol = (symbol: string) =>
  symbol.endsWith('.BSE') || symbol.endsWith('.NSE')

const getCurrencyCode = (stock: Stock): CurrencyCode => {
  const raw = String((stock as any).currency ?? '').trim().toUpperCase()
  if (raw === 'INR' || raw.includes('RUPEE')) return 'INR'
  if (raw === 'USD' || raw.includes('DOLLAR')) return 'USD'
  return isIndianSymbol(stock.symbol) ? 'INR' : 'USD'
}

const getCurrencySymbol = (code: CurrencyCode) => (code === 'INR' ? '₹' : '$')

const displaySymbol = (symbol: string) => {
  if (symbol.endsWith('.BSE')) return symbol.replace('.BSE', '')
  if (symbol.endsWith('.NSE')) return symbol.replace('.NSE', '')
  return symbol
}

export default function Sidebar() {
  const {
    sectors,
    selectedStock,
    selectedSector,
    setSelectedStock,
    setSelectedSector,
    initializeSidebarData,
    isSidebarLoading,
    sidebarError,
  } = usePortfolioStore()

  const [expandedSector, setExpandedSector] = useState<string>('technology')

  useEffect(() => {
    void initializeSidebarData()
  }, [initializeSidebarData])

  useEffect(() => {
    if (selectedSector) setExpandedSector(selectedSector)
  }, [selectedSector])

  const totalStockCount = useMemo(
    () => sectors.reduce((sum, s) => sum + s.stocks.length, 0),
    [sectors]
  )

  const handleSectorClick = (sector: Sector) => {
    const isSame = expandedSector === sector.id
    setExpandedSector(isSame ? '' : sector.id)
    setSelectedSector(sector.id)
  }

  const handleStockClick = (stock: Stock) => {
    setSelectedStock(stock)
  }

  return (
    <aside
      style={{
        width: '260px',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid rgba(245,197,24,0.1)',
        height: '100vh',
        position: 'fixed',
        top: '60px',
        left: 0,
        overflowY: 'auto',
        paddingTop: '16px',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '0 16px 16px',
          borderBottom: '1px solid rgba(245,197,24,0.1)',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            fontSize: '0.6rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.2em',
          }}
        >
          MARKET SECTORS
        </div>
      </div>

      {isSidebarLoading && (
        <div style={{ padding: '12px 16px', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          Loading real market data...
        </div>
      )}

      {sidebarError && !isSidebarLoading && (
        <div style={{ padding: '12px 16px', fontSize: '0.65rem', color: '#F44336' }}>
          {sidebarError}
        </div>
      )}

      {!isSidebarLoading && !sidebarError && totalStockCount === 0 && (
        <div style={{ padding: '12px 16px', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          No stocks available.
        </div>
      )}

      {/* Sectors */}
      {!isSidebarLoading &&
        !sidebarError &&
        sectors.map((sector) => (
          <div key={sector.id}>
            {/* Sector Header */}
            <div
              onClick={() => handleSectorClick(sector)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background:
                  selectedSector === sector.id ? 'rgba(245,197,24,0.05)' : 'transparent',
                borderLeft:
                  selectedSector === sector.id ? '2px solid #F5C518' : '2px solid transparent',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <sector.icon
                  size={16}
                  color={selectedSector === sector.id ? '#F5C518' : '#6B6B80'}
                />
                <div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: selectedSector === sector.id ? '#F5C518' : 'var(--text-primary)',
                    }}
                  >
                    {sector.name}
                  </div>
                  <div
                    style={{
                      fontSize: '0.6rem',
                      color: sector.performance >= 0 ? '#4CAF50' : '#F44336',
                    }}
                  >
                    {sector.performance >= 0 ? '+' : ''}
                    {sector.performance.toFixed(2)}%
                  </div>
                </div>
              </div>
              <span
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.7rem',
                  transform: expandedSector === sector.id ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform 0.2s ease',
                }}
              >
                ▼
              </span>
            </div>

            {/* Stocks List */}
            {expandedSector === sector.id && (
              <div style={{ background: 'rgba(0,0,0,0.2)' }}>
                {sector.stocks.map((stock) => {
                  const currencyCode = getCurrencyCode(stock)
                  const currencySymbol = getCurrencySymbol(currencyCode)
                  const price = Number(stock.currentPrice)

                  return (
                    <div
                      key={stock.id}
                      onClick={() => handleStockClick(stock)}
                      style={{
                        padding: '10px 16px 10px 40px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background:
                          selectedStock?.id === stock.id
                            ? 'rgba(245,197,24,0.08)'
                            : 'transparent',
                        borderLeft:
                          selectedStock?.id === stock.id
                            ? '2px solid rgba(245,197,24,0.5)'
                            : '2px solid transparent',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color:
                              selectedStock?.id === stock.id
                                ? '#F5C518'
                                : 'var(--text-primary)',
                          }}
                        >
                          {displaySymbol(stock.symbol)}
                        </div>
                        <div
                          style={{
                            fontSize: '0.6rem',
                            color: 'var(--text-muted)',
                            maxWidth: '120px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {stock.name}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-primary)' }}>
                          {Number.isFinite(price) ? `${currencySymbol}${price.toFixed(2)}` : '--'}
                        </div>
                        <div
                          style={{
                            fontSize: '0.6rem',
                            color: stock.changePercent >= 0 ? '#4CAF50' : '#F44336',
                          }}
                        >
                          {stock.changePercent >= 0 ? '+' : ''}
                          {stock.changePercent}%
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
    </aside>
  )
}
