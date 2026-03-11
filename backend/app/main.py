import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routes import auth, portfolio, stocks, ml

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s [%(name)s] %(message)s',
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info('APP_STARTUP_BEGIN')
    init_db()
    logger.info('APP_STARTUP_COMPLETE')
    yield


app = FastAPI(
    title='Luminex API',
    description='Stock Market Portfolio Analyzer Backend',
    version='1.0.0',
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'http://localhost:5173',
        'http://localhost:4173',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:4173',
    ],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(auth.router)
app.include_router(portfolio.router)
app.include_router(stocks.router)
app.include_router(ml.router)


@app.get('/')
def root():
    return {'message': 'Luminex API is running', 'version': '1.0.0'}


@app.get('/health')
def health_check():
    return {'status': 'healthy'}
