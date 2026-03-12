import { useEffect } from 'react'
import { usePortfolioStore } from './store/portfolioStore'
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import Ticker from './components/Ticker'
import Dashboard from './pages/Dashboard'
import Compare from './pages/Compare'
import ML from './pages/ML'
import International from './pages/International'
import IndianStocks from './pages/IndianStocks'
import Health from './pages/Health'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import { useAuthStore } from './store/authStore'
import './index.css'


function NavTabs() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const tabs = [
    { label: 'DASHBOARD', path: '/dashboard' },
    { label: 'COMPARE', path: '/compare' },
    { label: 'ML ANALYSIS', path: '/ml' },
    { label: 'INTERNATIONAL', path: '/international' },
    { label: 'INDIAN STOCKS', path: '/indian' },
    { label: 'PORTFOLIO HEALTH', path: '/health' },
  ]

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid rgba(245,197,24,0.1)',
      marginLeft: '260px',
    }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
        {tabs.map(tab => (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              padding: '10px 20px',
              fontSize: '0.65rem',
              letterSpacing: '0.2em',
              background: 'transparent',
              border: 'none',
              borderBottom: location.pathname === tab.path
                ? '2px solid #F5C518'
                : '2px solid transparent',
              color: location.pathname === tab.path
                ? '#F5C518'
                : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily: 'JetBrains Mono, monospace',
            }}
            onMouseEnter={e => {
              if (location.pathname !== tab.path) {
                e.currentTarget.style.color = 'rgba(245,197,24,0.7)'
              }
            }}
            onMouseLeave={e => {
              if (location.pathname !== tab.path) {
                e.currentTarget.style.color = 'var(--text-muted)'
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* User info + logout */}
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{
            fontSize: '0.6rem',
            color: 'rgba(245,197,24,0.6)',
            letterSpacing: '0.15em',
          }}>
            {user.username.toUpperCase()}
          </span>
          <button
            onClick={() => {
              logout()
              navigate('/')
            }}
            style={{
              padding: '4px 12px',
              background: 'transparent',
              border: '1px solid rgba(245,197,24,0.2)',
              borderRadius: '4px',
              color: 'var(--text-muted)',
              fontSize: '0.55rem',
              letterSpacing: '0.15em',
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(245,197,24,0.4)'
              e.currentTarget.style.color = '#F5C518'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(245,197,24,0.2)'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            SIGN OUT
          </button>
        </div>
      )}
    </div>
  )
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  return (
    <div
      key={location.pathname}
      className="page-enter"
      style={{ minHeight: 'calc(100vh - 130px)' }}
    >
      {children}
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  if (!user) {
    navigate('/auth')
    return null
  }

  return <>{children}</>
}

function AppLayout() {
  const location = useLocation()
  const isLanding = location.pathname === '/'
  const isAuth = location.pathname === '/auth'

  if (isLanding) return <Landing />
  if (isAuth) return <Auth />

  const { initializeSidebarData } = usePortfolioStore()
  const { user } = useAuthStore()

  useEffect(() => {
    if (user) {
      void initializeSidebarData()
    }
  }, [user, initializeSidebarData])

  return (
    <div
      className="scanlines noise"
      style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}
    >
      <Navbar />
      <Ticker />
      <div style={{ paddingTop: '88px' }}>
        <NavTabs />
        <div style={{ display: 'flex' }}>
          <Sidebar />
          <main style={{ marginLeft: '260px', flex: 1 }}>
            <PageWrapper>
              <Routes>
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/compare" element={<ProtectedRoute><Compare /></ProtectedRoute>} />
                <Route path="/ml" element={<ProtectedRoute><ML /></ProtectedRoute>} />
                <Route path="/international" element={<ProtectedRoute><International /></ProtectedRoute>} />
                <Route path="/indian" element={<ProtectedRoute><IndianStocks /></ProtectedRoute>} />
                <Route path="/health" element={<ProtectedRoute><Health /></ProtectedRoute>} />
              </Routes>
            </PageWrapper>
          </main>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </Router>
  )
}

export default App