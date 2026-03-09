from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routes import auth, portfolio, stocks, ml


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Ensure all model metadata is loaded and tables exist.
    init_db()
    yield


app = FastAPI(
    title="Luminex API",
    description="Stock Market Portfolio Analyzer Backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(portfolio.router)
app.include_router(stocks.router)
app.include_router(ml.router)


@app.get("/")
def root():
    return {"message": "Luminex API is running", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
