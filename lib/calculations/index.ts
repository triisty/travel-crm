import type { Booking, BookingFormData } from '../types'

export function calcCommissionAmount(sellPrice: number, commissionPercent: number, buyPrice: number = 0): number {
  const grossProfit = sellPrice - buyPrice
  if (grossProfit <= 0 || commissionPercent <= 0) return 0
  return Math.round((grossProfit * commissionPercent) / 100 * 100) / 100
}

export function calcProfit(sellPrice: number, buyPrice: number, commissionAmount: number): number {
  // Profit = grossProfit - commissionAmount (agent's share)
  const grossProfit = sellPrice - buyPrice
  return Math.round((grossProfit - commissionAmount) * 100) / 100
}

export function applyCalculations(data: BookingFormData): Omit<Booking, 'id' | 'createdAt' | 'updatedAt'> {
  const commissionAmount = calcCommissionAmount(data.sellPrice, data.commissionPercent, data.buyPrice)
  const profit = calcProfit(data.sellPrice, data.buyPrice, commissionAmount)
  return { ...data, commissionAmount, profit }
}

export function formatCurrency(amount: number, currency = 'AZN'): string {
  return new Intl.NumberFormat('az-AZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' ' + currency
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}
