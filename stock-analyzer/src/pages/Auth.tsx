import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getSecurityQuestion, forgotPassword } from '../api'

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "What city were you born in?",
  "What was the name of your first school?",
  "What is your favorite movie?",
]

export default function Auth() {
  const navigate = useNavigate()
  const { login, register, isLoading, error } = useAuthStore()
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')

  // Login / Register fields
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0])
  const [securityAnswer, setSecurityAnswer] = useState('')

  // Forgot password fields
  const [forgotUsername, setForgotUsername] = useState('')
  const [forgotAnswer, setForgotAnswer] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [forgotQuestion, setForgotQuestion] = useState('')
  const [forgotStep, setForgotStep] = useState<1 | 2>(1)
  const [forgotMessage, setForgotMessage] = useState('')
  const [forgotError, setForgotError] = useState('')

  const handleSubmit = async () => {
    let success = false
    if (mode === 'login') {
      success = await login(username, password)
    } else {
      success = await register(username, email, password, securityQuestion, securityAnswer)
    }
    if (success) navigate('/dashboard')
  }

  const handleForgotStep1 = async () => {
    if (!forgotUsername) {
      setForgotError('Please enter your username.')
      return
    }
    try {
      const data = await getSecurityQuestion(forgotUsername)
      setForgotQuestion(data.security_question)
      setForgotStep(2)
      setForgotError('')
    } catch {
      setForgotError('Username not found.')
    }
  }

  const handleForgotStep2 = async () => {
    if (!forgotAnswer || !newPassword) {
      setForgotError('Please fill in all fields.')
      return
    }
    try {
      await forgotPassword(forgotUsername, forgotAnswer, newPassword)
      setForgotMessage('Password reset successful! You can now sign in.')
      setForgotError('')
      setTimeout(() => {
        setMode('login')
        setForgotStep(1)
        setForgotMessage('')
        setForgotUsername('')
        setForgotAnswer('')
        setNewPassword('')
        setForgotQuestion('')
      }, 2000)
    } catch {
      setForgotError('Incorrect security answer. Please try again.')
    }
  }

  const inputStyle = {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(245,197,24,0.2)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    padding: '12px 16px',
    fontSize: '0.8rem',
    fontFamily: 'JetBrains Mono, monospace',
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.2s ease',
  }

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 40%, #1a1500 0%, #0A0A0F 65%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    }}>
      {/* Corner decorations */}
      {[
        { top: '24px', left: '24px', borderTop: '1px solid rgba(245,197,24,0.3)', borderLeft: '1px solid rgba(245,197,24,0.3)' },
        { top: '24px', right: '24px', borderTop: '1px solid rgba(245,197,24,0.3)', borderRight: '1px solid rgba(245,197,24,0.3)' },
        { bottom: '24px', left: '24px', borderBottom: '1px solid rgba(245,197,24,0.3)', borderLeft: '1px solid rgba(245,197,24,0.3)' },
        { bottom: '24px', right: '24px', borderBottom: '1px solid rgba(245,197,24,0.3)', borderRight: '1px solid rgba(245,197,24,0.3)' },
      ].map((style, i) => (
        <div key={i} style={{ position: 'absolute', width: '40px', height: '40px', ...style }} />
      ))}

      <div style={{ width: '100%', maxWidth: '440px', padding: '0 24px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1
            className="animate-pulse-glow"
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: '2.5rem',
              fontWeight: 800,
              color: '#F5C518',
              letterSpacing: '0.3em',
              marginBottom: '8px',
            }}
          >
            LUMINEX
          </h1>
          <p style={{
            fontSize: '0.6rem',
            color: 'rgba(245,197,24,0.4)',
            letterSpacing: '0.3em',
          }}>
            PORTFOLIO ANALYZER
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(17,17,24,0.9)',
          border: '1px solid rgba(245,197,24,0.15)',
          borderRadius: '12px',
          padding: '32px',
          backdropFilter: 'blur(20px)',
        }}>

          {/* ── FORGOT PASSWORD FLOW ── */}
          {mode === 'forgot' ? (
            <div>
              <div style={{
                fontSize: '0.6rem',
                color: '#F5C518',
                letterSpacing: '0.2em',
                marginBottom: '20px',
              }}>
                RESET PASSWORD — STEP {forgotStep} OF 2
              </div>

              {forgotStep === 1 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <div style={{
                      fontSize: '0.55rem',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.2em',
                      marginBottom: '6px',
                    }}>
                      USERNAME
                    </div>
                    <input
                      type="text"
                      placeholder="Enter your username"
                      value={forgotUsername}
                      onChange={e => setForgotUsername(e.target.value)}
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'rgba(245,197,24,0.5)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(245,197,24,0.2)')}
                    />
                  </div>

                  {forgotError && (
                    <div style={{
                      fontSize: '0.65rem',
                      color: '#F44336',
                      padding: '8px 12px',
                      background: 'rgba(244,67,54,0.1)',
                      borderRadius: '4px',
                      border: '1px solid rgba(244,67,54,0.3)',
                    }}>
                      {forgotError}
                    </div>
                  )}

                  <button
                    onClick={handleForgotStep1}
                    style={{
                      padding: '12px',
                      background: 'rgba(245,197,24,0.1)',
                      border: '1px solid rgba(245,197,24,0.4)',
                      borderRadius: '6px',
                      color: '#F5C518',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      letterSpacing: '0.2em',
                      cursor: 'pointer',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    FIND ACCOUNT
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{
                    padding: '12px',
                    background: 'rgba(245,197,24,0.05)',
                    border: '1px solid rgba(245,197,24,0.15)',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                  }}>
                    {forgotQuestion}
                  </div>

                  <div>
                    <div style={{
                      fontSize: '0.55rem',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.2em',
                      marginBottom: '6px',
                    }}>
                      YOUR ANSWER
                    </div>
                    <input
                      type="text"
                      placeholder="Enter your answer"
                      value={forgotAnswer}
                      onChange={e => setForgotAnswer(e.target.value)}
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'rgba(245,197,24,0.5)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(245,197,24,0.2)')}
                    />
                  </div>

                  <div>
                    <div style={{
                      fontSize: '0.55rem',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.2em',
                      marginBottom: '6px',
                    }}>
                      NEW PASSWORD
                    </div>
                    <input
                      type="password"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'rgba(245,197,24,0.5)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(245,197,24,0.2)')}
                    />
                  </div>

                  {forgotError && (
                    <div style={{
                      fontSize: '0.65rem',
                      color: '#F44336',
                      padding: '8px 12px',
                      background: 'rgba(244,67,54,0.1)',
                      borderRadius: '4px',
                      border: '1px solid rgba(244,67,54,0.3)',
                    }}>
                      {forgotError}
                    </div>
                  )}

                  {forgotMessage && (
                    <div style={{
                      fontSize: '0.65rem',
                      color: '#4CAF50',
                      padding: '8px 12px',
                      background: 'rgba(76,175,80,0.1)',
                      borderRadius: '4px',
                      border: '1px solid rgba(76,175,80,0.3)',
                    }}>
                      {forgotMessage}
                    </div>
                  )}

                  <button
                    onClick={handleForgotStep2}
                    style={{
                      padding: '12px',
                      background: 'rgba(245,197,24,0.1)',
                      border: '1px solid rgba(245,197,24,0.4)',
                      borderRadius: '6px',
                      color: '#F5C518',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      letterSpacing: '0.2em',
                      cursor: 'pointer',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    RESET PASSWORD
                  </button>
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button
                  onClick={() => {
                    setMode('login')
                    setForgotStep(1)
                    setForgotError('')
                    setForgotMessage('')
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.6rem',
                    letterSpacing: '0.15em',
                    cursor: 'pointer',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  BACK TO SIGN IN
                </button>
              </div>
            </div>

          ) : (
            /* ── LOGIN / REGISTER FLOW ── */
            <div>
              {/* Mode Toggle */}
              <div style={{
                display: 'flex',
                marginBottom: '28px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '6px',
                padding: '4px',
              }}>
                {(['login', 'register'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      fontSize: '0.65rem',
                      letterSpacing: '0.2em',
                      background: mode === m ? 'rgba(245,197,24,0.1)' : 'transparent',
                      border: mode === m ? '1px solid rgba(245,197,24,0.3)' : '1px solid transparent',
                      borderRadius: '4px',
                      color: mode === m ? '#F5C518' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontFamily: 'JetBrains Mono, monospace',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {m === 'login' ? 'SIGN IN' : 'REGISTER'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Username */}
                <div>
                  <div style={{
                    fontSize: '0.55rem',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.2em',
                    marginBottom: '6px',
                  }}>
                    USERNAME
                  </div>
                  <input
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'rgba(245,197,24,0.5)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(245,197,24,0.2)')}
                  />
                </div>

                {/* Email — register only */}
                {mode === 'register' && (
                  <div>
                    <div style={{
                      fontSize: '0.55rem',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.2em',
                      marginBottom: '6px',
                    }}>
                      EMAIL
                    </div>
                    <input
                      type="email"
                      placeholder="Enter email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'rgba(245,197,24,0.5)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(245,197,24,0.2)')}
                    />
                  </div>
                )}

                {/* Password */}
                <div>
                  <div style={{
                    fontSize: '0.55rem',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.2em',
                    marginBottom: '6px',
                  }}>
                    PASSWORD
                  </div>
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'rgba(245,197,24,0.5)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(245,197,24,0.2)')}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  />
                </div>

                {/* Security Question — register only */}
                {mode === 'register' && (
                  <>
                    <div>
                      <div style={{
                        fontSize: '0.55rem',
                        color: 'var(--text-muted)',
                        letterSpacing: '0.2em',
                        marginBottom: '6px',
                      }}>
                        SECURITY QUESTION
                      </div>
                      <select
                        value={securityQuestion}
                        onChange={e => setSecurityQuestion(e.target.value)}
                        style={selectStyle}
                      >
                        {SECURITY_QUESTIONS.map(q => (
                          <option key={q} value={q}>{q}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div style={{
                        fontSize: '0.55rem',
                        color: 'var(--text-muted)',
                        letterSpacing: '0.2em',
                        marginBottom: '6px',
                      }}>
                        YOUR ANSWER
                      </div>
                      <input
                        type="text"
                        placeholder="Enter your answer"
                        value={securityAnswer}
                        onChange={e => setSecurityAnswer(e.target.value)}
                        style={inputStyle}
                        onFocus={e => (e.target.style.borderColor = 'rgba(245,197,24,0.5)')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(245,197,24,0.2)')}
                      />
                    </div>
                  </>
                )}

                {/* Error */}
                {error && (
                  <div style={{
                    fontSize: '0.65rem',
                    color: '#F44336',
                    padding: '8px 12px',
                    background: 'rgba(244,67,54,0.1)',
                    borderRadius: '4px',
                    border: '1px solid rgba(244,67,54,0.3)',
                  }}>
                    {typeof error === 'string' ? error : 'An error occurred'}
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  style={{
                    padding: '14px',
                    background: 'rgba(245,197,24,0.1)',
                    border: '1px solid rgba(245,197,24,0.4)',
                    borderRadius: '6px',
                    color: '#F5C518',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    letterSpacing: '0.2em',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    fontFamily: 'JetBrains Mono, monospace',
                    transition: 'all 0.2s ease',
                    opacity: isLoading ? 0.7 : 1,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(245,197,24,0.2)'
                    e.currentTarget.style.boxShadow = '0 0 20px rgba(245,197,24,0.2)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(245,197,24,0.1)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {isLoading ? 'PLEASE WAIT...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                </button>

                {/* Forgot password link */}
                {mode === 'login' && (
                  <div style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => setMode('forgot')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(245,197,24,0.5)',
                        fontSize: '0.6rem',
                        letterSpacing: '0.15em',
                        cursor: 'pointer',
                        fontFamily: 'JetBrains Mono, monospace',
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#F5C518')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,197,24,0.5)')}
                    >
                      FORGOT PASSWORD?
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Back to landing */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.6rem',
              letterSpacing: '0.15em',
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            BACK TO HOME
          </button>
        </div>
      </div>
    </div>
  )
}