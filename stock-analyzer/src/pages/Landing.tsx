import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import GridBackground from '../components/GridBackground'

export default function Landing() {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setVisible(true), 100)
  }, [])

  const features = [
    { label: 'REAL-TIME CHARTS', desc: 'Price history with volume analysis' },
    { label: 'ML FORECASTING', desc: 'Linear regression price predictions' },
    { label: 'STOCK COMPARISON', desc: 'Side-by-side radar analysis' },
    { label: 'PORTFOLIO HEALTH', desc: 'Risk, diversification and scoring' },
  ]

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% 40%, #1a1500 0%, #0A0A0F 65%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 3D Grid Background */}
      <GridBackground />

      {/* Gradient overlay to fade grid at top */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '50%',
        background: 'linear-gradient(to bottom, #0A0A0F 0%, transparent 100%)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* Gradient overlay to fade grid at bottom */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '30%',
        background: 'linear-gradient(to top, #0A0A0F 0%, transparent 100%)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* Corner decorations */}
      <div style={{
        position: 'absolute',
        top: '24px',
        left: '24px',
        width: '40px',
        height: '40px',
        borderTop: '1px solid rgba(245,197,24,0.3)',
        borderLeft: '1px solid rgba(245,197,24,0.3)',
        zIndex: 2,
      }} />
      <div style={{
        position: 'absolute',
        top: '24px',
        right: '24px',
        width: '40px',
        height: '40px',
        borderTop: '1px solid rgba(245,197,24,0.3)',
        borderRight: '1px solid rgba(245,197,24,0.3)',
        zIndex: 2,
      }} />
      <div style={{
        position: 'absolute',
        bottom: '24px',
        left: '24px',
        width: '40px',
        height: '40px',
        borderBottom: '1px solid rgba(245,197,24,0.3)',
        borderLeft: '1px solid rgba(245,197,24,0.3)',
        zIndex: 2,
      }} />
      <div style={{
        position: 'absolute',
        bottom: '24px',
        right: '24px',
        width: '40px',
        height: '40px',
        borderBottom: '1px solid rgba(245,197,24,0.3)',
        borderRight: '1px solid rgba(245,197,24,0.3)',
        zIndex: 2,
      }} />

      {/* Main content */}
      <div
        style={{
          textAlign: 'center',
          position: 'relative',
          zIndex: 3,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.8s ease, transform 0.8s ease',
        }}
      >
        {/* Version badge */}
        <div style={{
          display: 'inline-block',
          padding: '4px 16px',
          border: '1px solid rgba(245,197,24,0.3)',
          borderRadius: '20px',
          fontSize: '0.6rem',
          color: 'rgba(245,197,24,0.6)',
          letterSpacing: '0.3em',
          marginBottom: '32px',
          background: 'rgba(245,197,24,0.05)',
        }}>
          V 1.0 — PORTFOLIO ANALYZER
        </div>

        {/* Main title */}
        <h1
          className="animate-pulse-glow"
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 'clamp(4rem, 10vw, 8rem)',
            fontWeight: 800,
            color: '#F5C518',
            letterSpacing: '0.3em',
            lineHeight: 1,
            marginBottom: '16px',
          }}
        >
          LUMINEX
        </h1>

        {/* Tagline */}
        <p style={{
          fontSize: '0.8rem',
          color: 'rgba(245,197,24,0.4)',
          letterSpacing: '0.4em',
          marginBottom: '48px',
          textTransform: 'uppercase',
        }}>
          Stock Market Portfolio Analyzer
        </p>

        {/* Glowing divider */}
        <div style={{
          height: '1px',
          width: '300px',
          margin: '0 auto 48px',
          background: 'linear-gradient(to right, transparent, #F5C518, transparent)',
          boxShadow: '0 0 10px rgba(245,197,24,0.6)',
        }} />

        {/* Feature pills */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: '56px',
          maxWidth: '700px',
        }}>
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                padding: '10px 20px',
                border: '1px solid rgba(245,197,24,0.15)',
                borderRadius: '6px',
                background: 'rgba(10,10,15,0.8)',
                backdropFilter: 'blur(10px)',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                cursor: 'default',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(245,197,24,0.4)'
                e.currentTarget.style.background = 'rgba(245,197,24,0.07)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(245,197,24,0.15)'
                e.currentTarget.style.background = 'rgba(10,10,15,0.8)'
              }}
            >
              <div style={{
                fontSize: '0.55rem',
                color: '#F5C518',
                letterSpacing: '0.2em',
                marginBottom: '3px',
              }}>
                {f.label}
              </div>
              <div style={{
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
              }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>

        {/* Enter button */}
        <button
          onClick={() => navigate('/auth')}
          style={{
            padding: '16px 48px',
            background: 'rgba(245,197,24,0.08)',
            border: '1px solid rgba(245,197,24,0.5)',
            borderRadius: '4px',
            color: '#F5C518',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.3em',
            cursor: 'pointer',
            fontFamily: 'JetBrains Mono, monospace',
            transition: 'all 0.2s ease',
            boxShadow: '0 0 20px rgba(245,197,24,0.1)',
            backdropFilter: 'blur(10px)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(245,197,24,0.15)'
            e.currentTarget.style.boxShadow = '0 0 40px rgba(245,197,24,0.25)'
            e.currentTarget.style.letterSpacing = '0.4em'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(245,197,24,0.08)'
            e.currentTarget.style.boxShadow = '0 0 20px rgba(245,197,24,0.1)'
            e.currentTarget.style.letterSpacing = '0.3em'
          }}
        >
          LOGIN / SIGN IN
        </button>

        {/* Bottom hint */}
        <div style={{
          marginTop: '24px',
          fontSize: '0.55rem',
          color: 'rgba(255,255,255,0.15)',
          letterSpacing: '0.2em',
        }}>
          POWERED BY REACT — TYPESCRIPT — RECHARTS — ML REGRESSION
        </div>
      </div>
    </div>
  )
}