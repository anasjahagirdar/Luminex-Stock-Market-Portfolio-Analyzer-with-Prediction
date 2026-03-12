const fs = require('fs')
const path = require('path')

const rootDir = __dirname
const backendDir = path.join(rootDir, 'backend')
const frontendDir = path.join(rootDir, 'stock-analyzer')
const logsDir = path.join(rootDir, 'logs')

const isWin = process.platform === 'win32'
const pythonInterpreterCandidates = [
  path.join(backendDir, 'venv', 'Scripts', 'python.exe'),
  path.join(backendDir, 'venv', 'bin', 'python3'),
  path.join(backendDir, 'venv', 'bin', 'python'),
]

const pythonInterpreter =
  pythonInterpreterCandidates.find((candidate) => fs.existsSync(candidate)) ||
  (isWin ? 'python' : 'python3')

fs.mkdirSync(logsDir, { recursive: true })

module.exports = {
  apps: [
    {
      name: 'luminex-backend',
      cwd: backendDir,
      script: pythonInterpreter,
      args: [
        '-m',
        'uvicorn',
        'app.main:app',
        '--host',
        '0.0.0.0',
        '--port',
        process.env.BACKEND_PORT || process.env.PORT || '8000',
      ],
      interpreter: 'none',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        PORT: process.env.BACKEND_PORT || process.env.PORT || '8000',
        ALPHA_VANTAGE_API_KEY:
          process.env.ALPHA_VANTAGE_API_KEY || process.env.ALPHA_VANTAGE_KEY || '',
        ALPHA_VANTAGE_KEY:
          process.env.ALPHA_VANTAGE_KEY || process.env.ALPHA_VANTAGE_API_KEY || '',
        JWT_SECRET: process.env.JWT_SECRET || '',
        LUMINEX_SECRET_KEY: process.env.LUMINEX_SECRET_KEY || process.env.JWT_SECRET || '',
        LUMINEX_CORS_ORIGINS:
          process.env.LUMINEX_CORS_ORIGINS ||
          'http://localhost:4173,http://127.0.0.1:4173',
      },
      error_file: path.join(logsDir, 'backend-error.log'),
      out_file: path.join(logsDir, 'backend.log'),
      time: true,
    },
    {
      name: 'luminex-frontend',
      cwd: frontendDir,
      script: 'node',
      args: ['scripts/pm2-frontend.mjs'],
      interpreter: 'none',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        PORT: process.env.FRONTEND_PORT || '4173',
        FRONTEND_PORT: process.env.FRONTEND_PORT || '4173',
        FRONTEND_HOST: process.env.FRONTEND_HOST || '0.0.0.0',
        VITE_API_BASE_URL:
          process.env.VITE_API_BASE_URL ||
          `http://127.0.0.1:${process.env.BACKEND_PORT || process.env.PORT || '8000'}`,
      },
      error_file: path.join(logsDir, 'frontend-error.log'),
      out_file: path.join(logsDir, 'frontend.log'),
      time: true,
    },
  ],
}
