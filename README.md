Stock Market Portfolio Analyzer with Prediction
Real-time data · ML Forecasting · Indian & International Markets

Overview
LUMINEX is a full-stack stock market portfolio analyzer built for investors who track both Indian (BSE) and international (NASDAQ/NYSE) markets, including cryptocurrency. It provides real-time price tracking, interactive candlestick charts, sector-based portfolio analytics, and machine learning–driven price forecasting — all inside a dark terminal-style trading dashboard.

Screenshots

MAIN PAGE : file:///C:/Users/Anas/OneDrive/Pictures/Screenshots%201/Screenshot%202026-03-04%20104058.png


Features
📈 Market Coverage

Indian Stocks — 30 BSE-listed stocks with real price data via Alpha Vantage
International Stocks — 20 US stocks (NASDAQ/NYSE) via Yahoo Finance
Cryptocurrency — Bitcoin, Ethereum, Solana, XRP, and more
Commodities — Gold and Silver (GC=F, SI=F) for ML analysis

📊 Interactive Charting

Custom D3.js candlestick charts with OHLC hover tooltips and crosshair
Period selectors: 1M / 3M / 6M / 1Y
Bullish/bearish color coding (green/red candles)
Recharts area charts, radar charts, radial gauges, and donut charts

🗂 Portfolio Management

Add stocks from dedicated Indian or International pages
Holdings stored in SQLite per user account
Real-time portfolio value, P&L, and cost basis tracking
Flag icons (🇮🇳 🌍) distinguishing Indian vs international holdings

💹 Portfolio Health

Overall health score (0–100 radial gauge)
Risk metrics: volatility, Sharpe ratio, diversification score
Dual sector diversification — separate pie charts for Indian vs international allocation
Indian/international split progress bars

🤖 ML Analysis

Linear Regression — price forecasting with R² confidence score
K-Means Clustering — group stocks by P/E ratio and momentum
Bitcoin Forecasting — XGBoost + LSTM time series models (in progress)
3-month forward forecast with actual vs predicted scatter plot

🔐 Authentication

JWT-based login/register
Password reset via security question (no email server needed)
Protected routes — all pages require login

🏗 Architecture

Sector-grouped sidebar (Technology / Finance / Healthcare / Energy / Consumer)
Real-time quote fetching with in-memory caching + stale fallback
Batch stock quote endpoint to minimize API calls
Alpha Vantage throttle guard for free-tier safety


Tech Stack
LayerTechnologyFrontend FrameworkReact 19 + TypeScript + ViteState ManagementZustandChartsRecharts + D3.js (custom candlestick)HTTP ClientAxiosRoutingReact Router DOM v6Backend FrameworkFastAPI + UvicornDatabaseSQLite + SQLAlchemy ORMAuthenticationJWT (python-jose) + bcryptIndian Stock DataAlpha Vantage API (BSE symbols)International DataYahoo Finance via curl_cffiML (Frontend)ml-regression + vanilla K-MeansML (Backend)XGBoost + TensorFlow/Keras LSTMFontsSyne + JetBrains Mono

Getting Started
Prerequisites

Node.js 18+
Python 3.11+
A free Alpha Vantage API key

1. Clone the Repository
bashgit clone https://github.com/yourusername/luminex.git
cd luminex
2. Backend Setup
bashcd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Set your Alpha Vantage API key (optional — default key included for demo)
# Edit backend/app/routes/stocks.py → ALPHA_VANTAGE_KEY

# Run backend
uvicorn app.main:app --reload --port 8000

⚠️ Windows SSL Note: If you encounter SSL certificate errors with Yahoo Finance, copy your Python certifi certificate to a path without spaces:
bashcopy "venv\Lib\site-packages\certifi\cacert.pem" "C:\Users\YourName\cacert.pem"
Then update CERT in backend/app/routes/stocks.py to point to this path.

3. Frontend Setup
bashcd stock-analyzer

# Install dependencies
npm install

# Run dev server
npm run dev
4. Open in Browser
http://localhost:5173
Register an account and start adding stocks from the Indian Stocks or International Stocks pages.

Project Structure
luminex/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + router registration
│   │   ├── database.py          # SQLite engine + session
│   │   ├── core/auth.py         # JWT + bcrypt utilities
│   │   ├── models/models.py     # SQLAlchemy models
│   │   ├── routes/
│   │   │   ├── auth.py          # /auth/* endpoints
│   │   │   ├── portfolio.py     # /portfolio/* endpoints
│   │   │   ├── stocks.py        # /stocks/* (Yahoo + Alpha Vantage)
│   │   │   └── ml.py            # /ml/* endpoints
│   │   └── ml/
│   │       ├── features.py      # Feature engineering
│   │       ├── predictors.py    # Model training + prediction
│   │       └── repository.py   # ML data persistence
│   ├── scripts/
│   │   └── migrate_portfolio_items.py
│   └── requirements.txt
│
└── stock-analyzer/
    └── src/
        ├── api.ts               # All API functions (single source)
        ├── App.tsx              # Routes + navigation
        ├── components/
        │   ├── Navbar.tsx
        │   ├── Sidebar.tsx      # Real-time sector stock list
        │   ├── PriceChart.tsx
        │   ├── PEChart.tsx
        │   ├── OpportunityChart.tsx
        │   └── PricePredictor.tsx
        ├── pages/
        │   ├── Dashboard.tsx
        │   ├── International.tsx  # US + Crypto + D3 candlestick
        │   ├── IndianStocks.tsx   # BSE stocks + D3 candlestick
        │   ├── Compare.tsx
        │   ├── ML.tsx
        │   ├── Health.tsx
        │   ├── Landing.tsx
        │   └── Auth.tsx
        ├── store/
        │   ├── authStore.ts
        │   └── portfolioStore.ts  # Real stock data + sector grouping
        └── utils/currency.ts

API Endpoints
Authentication
MethodEndpointDescriptionPOST/auth/registerRegister new userPOST/auth/loginLogin + receive JWTPOST/auth/forgot-passwordReset password via security questionGET/auth/security-question/{username}Get security question
Portfolio (JWT required)
MethodEndpointDescriptionGET/portfolio/Get all holdingsPOST/portfolio/addAdd/update holdingDELETE/portfolio/remove/{symbol}Remove holding
Stocks
MethodEndpointDescriptionGET/stocks/quote?symbol=Single stock quoteGET/stocks/quotes?symbols=Batch quotes (comma-separated)GET/stocks/history?symbol=&period=OHLCV price historyGET/stocks/search?q=&market=Autocomplete searchGET/stocks/indianFull BSE stock listGET/stocks/internationalFull US + crypto listGET/stocks/commodity?type=Gold or silver dataGET/stocks/sector-mapSymbol → sector mapping

Data Sources
MarketSourceData Type🇮🇳 Indian BSEAlpha VantageEnd-of-day (free tier)🌍 US StocksYahoo FinanceNear real-time₿ CryptocurrencyYahoo FinanceNear real-time🥇 CommoditiesYahoo FinanceWeekly (GC=F, SI=F)

Note: Alpha Vantage free tier provides end-of-day data (updated once daily after market close). This is sufficient for portfolio tracking purposes.


ML Models
Linear Regression (Frontend)

Trains on selected stock's historical close prices
Outputs in-sample fit + 3-month forward forecast
Displays R² confidence score

K-Means Clustering (Frontend)

Features: change%, volatility, momentum, market cap, P/E proxy, sector
3 clusters visualized on scatter plot (volatility vs momentum)
Color coded: gold / blue / green

Bitcoin Forecasting — XGBoost + LSTM (In Progress)

Historical BTC-USD data via yfinance
XGBoost: lag features (1–7 days), rolling mean/std, day-of-week
LSTM: 60-day sequence window, 2-layer architecture, MinMaxScaler normalization
30-day forward forecast with MAE, RMSE, R² metrics


Environment Variables
No .env file is required for local development. The following can be customized in backend/app/routes/stocks.py:
pythonALPHA_VANTAGE_KEY = "your_api_key_here"   # Free at alphavantage.co
CERT = "C:/path/to/cacert.pem"            # Only needed on Windows with spaces in path

Known Limitations

Alpha Vantage free tier — 5 API calls/minute, 500/day. The backend throttles calls automatically.
Indian stock data — End-of-day only (not real-time). Prices update once per day after BSE market close.
Yahoo Finance — May geo-block Indian NSE/BSE symbols from certain networks/regions. BSE format (.BSE) is used as workaround.
ML training — Models run in-memory and results are not persisted across backend restarts.


Contributing

Fork the repository
Create a feature branch: git checkout -b feature/your-feature
Commit your changes: git commit -m 'Add your feature'
Push to the branch: git push origin feature/your-feature
Open a Pull Request


License
This project is licensed under the MIT License — see the LICENSE file for details.

<div align="center">
Built with ❤️ for investors tracking both Indian and global markets
LUMINEX — See the market clearly.
</div>