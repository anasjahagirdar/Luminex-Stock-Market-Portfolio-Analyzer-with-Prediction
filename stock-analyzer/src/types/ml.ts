export interface DataPoint {
  x: number
  y: number
  label?: string
}

export interface RegressionResult {
  slope: number
  intercept: number
  r2: number
  predictions: DataPoint[]
}

export interface MLModel {
  id: string
  name: string
  type: 'linear' | 'logistic' | 'kmeans'
  trainedOn: string
  accuracy: number
  lastUpdated: string
}

export interface PricePrediction {
  symbol: string
  currentPrice: number
  predictedPrice: number
  confidence: number
  direction: 'up' | 'down' | 'neutral'
  changePercent: number
}

export interface ClusterPoint {
  x: number
  y: number
  clusterId: number
  label: string
}