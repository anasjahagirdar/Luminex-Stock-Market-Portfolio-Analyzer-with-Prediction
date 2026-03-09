export const formatCurrency = (value: number): string => {
  return `₹${value.toFixed(2)} INR`
}

export const formatCurrencyCompact = (value: number): string => {
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)}Cr INR`
  } else if (value >= 100000) {
    return `₹${(value / 100000).toFixed(2)}L INR`
  } else if (value >= 1000) {
    return `₹${(value / 1000).toFixed(2)}K INR`
  }
  return `₹${value.toFixed(2)} INR`
}

export const CURRENCY_SYMBOL = '₹'
export const CURRENCY_LABEL = 'INR'