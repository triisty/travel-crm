"use client"
import * as XLSX from "xlsx"
import { useUserRole } from "@/lib/hooks/useUserRole"
import { useState, useMemo, useEffect, useCallback } from "react"
import { useBookingsStore } from "@/lib/store/bookingsStore"
import { supabase } from "@/lib/supabase"
import type { Booking, BookingFilters, BookingFormData, BookingType, IATAPeriod } from "@/lib/types"
import { formatCurrency, formatDate } from "@/lib/calculations"
import { logActivity } from "@/lib/activityLogger"
import {
  Plus, Search, Plane, Hotel, Palmtree, Ship, Car, Luggage,
  Armchair, Star, Shield, TrendingUp, TrendingDown, DollarSign,
  Filter, X, ChevronDown, CheckCircle2, Clock, XCircle, AlertCircle,
  Edit3, Trash2, MoreHorizontal, SlidersHorizontal, ArrowUpRight, FileText, Eye, Calendar, User, Phone, Mail, MapPin, CreditCard, Hash
} from "lucide-react"

const MANAGERS = ["Miraslan Abbasov", "Rəhimə Qasımlı", "Ayxan Elxanlı", "Mircəmil Abbasov", "Məryəmxanım Əliyeva", "Günel", "Günel Haciyeva", "Gulnare", "Aysel Nəsirova", "Fidan", "Jalə", "Nigar", "Şəlalə", "Telman"]

const BOOKING_TYPES = [
  { value: "bilet",     label: "Aviabilet", Icon: Plane,    color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  { value: "otel",      label: "Otel",       Icon: Hotel,    color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  { value: "tur",       label: "Tur",        Icon: Palmtree, color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  { value: "kruiz",     label: "Kruiz",      Icon: Ship,     color: "#06b6d4", bg: "rgba(6,182,212,0.12)" },
  { value: "transfer",  label: "Transfer",   Icon: Car,      color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  { value: "bagaj",     label: "Bagaj",      Icon: Luggage,  color: "#eab308", bg: "rgba(234,179,8,0.12)" },
  { value: "yer_secimi",label: "Yer seçimi", Icon: Armchair, color: "#ec4899", bg: "rgba(236,72,153,0.12)" },
  { value: "cip",       label: "CIP",        Icon: Star,     color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  { value: "sigorta",   label: "Sığorta",    Icon: Shield,   color: "#14b8a6", bg: "rgba(20,184,166,0.12)" },
  { value: "viza", label: "Viza", Icon: CreditCard, color: "#0ea5e9", bg: "rgba(14,165,233,0.12)" },
]

const EMPTY_FILTERS: BookingFilters = {
  search: "", status: "all", manager: "", iataPeriod: "all", bookingType: "all", dateFrom: "", dateTo: ""
}

function getTypeInfo(value: string) {
  return BOOKING_TYPES.find(t => t.value === value) ?? BOOKING_TYPES[0]
}

function SkeletonRow() {
  return (
    <tr className="border-b" style={{ borderColor: "var(--border-color)" }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-4 rounded-lg animate-pulse" style={{ background: "var(--bg-glass)", width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
    confirmed: { label: "Təsdiqlənib", color: "#22c55e", bg: "rgba(34,197,94,0.12)", Icon: CheckCircle2 },
    pending:   { label: "Gözləyir",    color: "#f59e0b", bg: "rgba(245,158,11,0.12)", Icon: Clock },
    completed: { label: "Tamamlandı",  color: "#6366f1", bg: "rgba(99,102,241,0.12)", Icon: CheckCircle2 },
    cancelled: { label: "Ləğv edildi", color: "#6b7280", bg: "var(--bg-glass)",        Icon: XCircle },
  }
  const s = map[status] ?? map.pending
  const Icon = s.Icon
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ background: s.bg, color: s.color }}>
      <Icon size={10} />{s.label}
    </span>
  )
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    paid:    { label: "Ödənilib",    color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    partial: { label: "Qismən",      color: "#f97316", bg: "rgba(249,115,22,0.12)" },
    unpaid:  { label: "Ödənilməyib", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  }
  const s = map[status] ?? map.unpaid
  return (
    <span className="inline-flex text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ background: s.bg, color: s.color }}>{s.label}</span>
  )
}

function EmptyState({ onAdd, isManager }: { onAdd: () => void; isManager: boolean }) {
  return (
    <tr><td colSpan={14}>
      <div className="flex flex-col items-center justify-center py-24 px-6">
        <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
          style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(249,115,22,0.15))" }}>
          <Plane size={28} style={{ color: "#ef4444" }} />
        </div>
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Sifariş tapılmadı</h3>
        <p className="text-sm mb-6 text-center max-w-xs" style={{ color: "var(--text-muted)" }}>Filtrləri dəyişin və ya yeni sifariş əlavə edin</p>
        <button onClick={onAdd}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95"
          style={{ background: "linear-gradient(135deg, #ef4444, #f97316)", boxShadow: "0 4px 20px rgba(239,68,68,0.35)" }}>
          <Plus size={15} />{isManager ? "Sifariş göndər" : "Yeni sifariş"}
        </button>
      </div>
    </td></tr>
  )
}

function KpiCard({ label, value, sub, gradient, icon: Icon, trend }: any) {
  if (gradient) return (
    <div className="relative p-5 rounded-3xl text-white overflow-hidden"
      style={{ background: gradient, boxShadow: "0 8px 32px rgba(239,68,68,0.25)" }}>
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-15" style={{ background: "white" }} />
      <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full opacity-10" style={{ background: "white" }} />
      <div className="relative">
        <p className="text-xs font-medium opacity-75 mb-3 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold mb-1 tabular-nums">{value}</p>
        {sub && <p className="text-xs opacity-60">{sub}</p>}
      </div>
    </div>
  )
  return (
    <div className="p-5 rounded-3xl transition-all hover:scale-[1.01]"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", backdropFilter: "blur(20px)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
        {Icon && <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-glass)" }}>
          <Icon size={14} style={{ color: "var(--text-secondary)" }} />
        </div>}
      </div>
      <p className="text-xl font-bold tabular-nums" style={{ color: trend === "up" ? "#22c55e" : trend === "down" ? "#ef4444" : "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  )
}
// ─── Number to AZ words ────────────────────────────────────────────────────────
function numToAzWords(n: number): string {
  const ones = ["","bir","iki","üç","dörd","beş","altı","yeddi","səkkiz","doqquz"]
  const tens = ["","on","iyirmi","otuz","qırx","əlli","altmış","yetmiş","səksən","doxsan"]
  const h = ["","yüz","iki yüz","üç yüz","dörd yüz","beş yüz","altı yüz","yeddi yüz","səkkiz yüz","doqquz yüz"]
  if (n <= 0) return "Sıfır manat."
  let res = ""
  const int = Math.floor(n)
  const dec = Math.round((n - int) * 100)
  if (int >= 1000) { const t = Math.floor(int/1000); res += (t===1?"min ":numToAzWords(t).replace(" manat.","")+" min ") }
  const r = int % 1000
  if (r >= 100) res += h[Math.floor(r/100)] + " "
  const r2 = r % 100
  if (r2 >= 10) res += tens[Math.floor(r2/10)] + " "
  res += ones[r2 % 10]
  res = res.trim()
  if (dec > 0) res += " manat " + (dec < 10 ? "0"+dec : dec) + " qəpik."
  else res += " manat."
  return res.charAt(0).toUpperCase() + res.slice(1)
}

// ─── Üzləşmə Aktı Export ──────────────────────────────────────────────────────
function exportUzlesme(bookings: any[], _clientBalances: Record<string, number>) {
  const uniqueClients = [...new Set(bookings.map((b:any) => b.clientName))]
  const clientName = uniqueClients[0] || "Müştəri"
  const clientBookings = bookings
    .filter((b:any) => b.clientName === clientName)
    .sort((a:any,b:any) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime())
  const today = new Date()
  const todayStr = today.toLocaleDateString("az-AZ",{day:"2-digit",month:"2-digit",year:"numeric"})
  const dates = clientBookings.map((b:any) => b.departureDate).filter(Boolean)
  const dateFrom = dates[0] || todayStr
  const dateTo = dates[dates.length-1] || todayStr
  const totalDebit = clientBookings.reduce((s:number,b:any)=>s+b.sellPrice,0)
  const totalCredit = clientBookings.reduce((s:number,b:any)=>s+(b.paidAmount??0),0)
  const balance = Math.max(0, totalDebit - totalCredit)
  type Row = (string|number|null)[]
  const rows: Row[] = []
  const push = (...cols: (string|number|null)[]) => rows.push(cols)
  push("Üzləşmə aktı")
  push(`Dövr: ${dateFrom} — ${dateTo}`)
  push(null)
  push(`Biz, aşağıda imza edənlər, El Art Travel MMC (itstour), bir tərəfdən, və ${clientName}, digər tərəfdən, bu tutuşdurulma aktını təşkil etmişik ki:`)
  push(null)
  push("El Art Travel MMC (itstour), məlumatına görə  AZN",null,null,null,null,null,null,null,`${clientName}, məlumatına görə  AZN`)
  push("Tarix","Sənəd",null,"Debet",null,"Kredit",null,null,"Tarix","Sənəd",null,"Debet",null,null,"Kredit")
  push("Başlanğıc saldo",null,null,null,null,0.00,null,null,"Başlanğıc saldo",null,null,0.00)
  let runD = 0, runC = 0
  clientBookings.forEach((b:any) => {
    const d = b.departureDate || ""
    const desc = `${b.destination||b.bookingType}${b.ticketNumber?" ("+b.ticketNumber+")":""}`
    runD += b.sellPrice
    push(d,desc,null,b.sellPrice,null,null,null,null,d,desc,null,null,null,null,b.sellPrice)
    if ((b.paidAmount??0)>0) {
      runC += b.paidAmount
      push(d,`Ödəniş: ${b.clientName}`,null,null,null,b.paidAmount,null,null,d,`Ödəniş: ${b.clientName}`,null,b.paidAmount)
    }
  })
  push("Dövriyyə (Dövr)",null,null,runD,null,runC,null,null,"Dövriyyə (Dövr)")
  push("Sonuncu saldo",null,null,balance,null,null,null,null,"Sonuncu saldo")
  push(null); push(null)
  push("El Art Travel MMC (itstour) məlumatına görə")
  push(`${dateTo} tarixinə ${clientName} ${balance.toFixed(2)} AZN`)
  push(numToAzWords(balance))
  push(null); push("Qaynar xətt: 0505550097"); push("itstour.az  |  it@itstour.az"); push(null)
  push("El Art Travel MMC",null,null,null,null,null,null,null,clientName)
  push(null); push("________________",null,null,null,null,null,null,null,"________________")
  push(null); push("(Elxan Həsənov)",null,null,null,null,null,null,null,"(_______________________)")
  push(null); push("M.Y.",null,null,null,null,null,null,null,"M.Y.")
  push(null); push(null); push(null)
  push("itstour CRM • El Art Travel MMC • Powered by VARK TECHNOLOGIES")
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = [{wch:12},{wch:36},{wch:4},{wch:12},{wch:4},{wch:12},{wch:4},{wch:4},{wch:12},{wch:36},{wch:4},{wch:12},{wch:4},{wch:4},{wch:12}]
  ws["!merges"] = [{s:{r:0,c:0},e:{r:0,c:14}},{s:{r:1,c:0},e:{r:1,c:14}},{s:{r:3,c:0},e:{r:3,c:14}}]
  const wb2 = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb2, ws, "Üzləşmə Aktı")
  XLSX.writeFile(wb2, `uzlesme-akti-${clientName.replace(/\s+/g,"-")}-${today.toISOString().slice(0,10)}.xlsx`)
}
// ─── PDF Export ───────────────────────────────────────────────────────────────
function exportToPDF(bookings: any[], clientBalances: Record<string, number>) {
  const date = new Date().toLocaleDateString("az-AZ", { day: "numeric", month: "long", year: "numeric" })
  const typeLabels: Record<string, string> = {
    bilet:"Aviabilet",otel:"Otel",tur:"Tur",kruiz:"Kruiz",
    transfer:"Transfer",bagaj:"Bagaj",yer_secimi:"Yer seçimi",cip:"CIP",sigorta:"Sığorta",viza:"Viza"
  }

  const uniqueClients = [...new Set(bookings.map((b: any) => b.clientName))]

  const clientSections = uniqueClients.map((clientName: any) => {
    const cb = bookings.filter((b: any) => b.clientName === clientName)
    const totalSell = cb.reduce((s: number, b: any) => s + b.sellPrice, 0)
    const totalPaid = cb.reduce((s: number, b: any) => s + (b.paidAmount ?? 0), 0)
    const totalDebt = cb
  .filter((b: any) => b.paymentStatus !== "paid")
  .reduce((s: number, b: any) => s + Math.max(0, b.sellPrice - (b.paidAmount ?? 0)), 0)
const isFullyPaid = totalDebt <= 0 && totalSell > 0 && cb.every((b: any) => b.paymentStatus === "paid")

    const rows = cb.map((b: any, i: number) => {
      const paid = b.paidAmount ?? 0
      const debt = Math.max(0, b.sellPrice - paid)
      const isPaid = b.paymentStatus === "paid"
      const isPartial = b.paymentStatus === "partial"

      const payBadge = isPaid
        ? `<span style="background:#dcfce7;color:#16a34a;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">✓ Ödənilib</span>`
        : isPartial
        ? `<span style="background:#fff7ed;color:#ea580c;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">⚡ Qismən (${paid.toFixed(2)} AZN)</span>`
        : `<span style="background:#fef2f2;color:#dc2626;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">✗ Ödənilməyib</span>`

      return `
      <tr style="border-bottom:1px solid #f0f0f0;background:${i%2===0?'white':'#fafafa'}">
        <td style="padding:10px 14px;font-size:13px;color:#374151">
          <div style="font-weight:600">${b.destination || "—"}</div>
          ${b.ticketNumber ? `<div style="font-size:11px;color:#6366f1;margin-top:2px;font-family:monospace">✈ ${b.ticketNumber}</div>` : ""}
          ${b.pnr ? `<div style="font-size:11px;color:#9ca3af;margin-top:1px">PNR: ${b.pnr}</div>` : ""}
        </td>
        <td style="padding:10px 14px">
          <span style="background:#eff6ff;color:#3b82f6;padding:2px 8px;border-radius:6px;font-size:11px">
            ${typeLabels[b.bookingType]??b.bookingType}
          </span>
        </td>
        <td style="padding:10px 14px;font-size:12px;color:#6b7280">${b.departureDate || "—"}</td>
        <td style="padding:10px 14px;font-size:14px;font-weight:700;text-align:right;color:#1f2937">${b.sellPrice.toFixed(2)} AZN</td>
        <td style="padding:10px 14px;text-align:center">${payBadge}</td>
        <td style="padding:10px 14px;text-align:right;font-weight:700;font-size:13px;color:${isPaid?'#16a34a':'#dc2626'}">
          ${isPaid ? `0.00 AZN` : `${debt.toFixed(2)} AZN`}
        </td>
      </tr>`
    }).join("")

    return `
      <div style="margin-bottom:28px;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;page-break-inside:avoid">
        <div style="background:#f8fafc;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb">
          <div>
            <div style="font-size:16px;font-weight:700;color:#1f2937">${clientName}</div>
            ${cb[0]?.clientPhone ? `<div style="font-size:12px;color:#9ca3af;margin-top:2px">📞 ${cb[0].clientPhone}</div>` : ""}
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Ödəniş statusu</div>
            ${isFullyPaid
              ? `<div style="font-size:15px;font-weight:800;color:#16a34a;background:#dcfce7;padding:6px 14px;border-radius:10px">✓ Tam ödənilib</div>`
              : `<div style="font-size:15px;font-weight:800;color:#dc2626;background:#fef2f2;padding:6px 14px;border-radius:10px">✗ Borc: ${totalDebt.toFixed(2)} AZN</div>`
            }
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#1f2937">
              <th style="padding:10px 14px;text-align:left;color:white;font-size:11px;font-weight:600;text-transform:uppercase">Xidmət / Bilet №</th>
              <th style="padding:10px 14px;text-align:left;color:white;font-size:11px;font-weight:600;text-transform:uppercase">Növ</th>
              <th style="padding:10px 14px;text-align:left;color:white;font-size:11px;font-weight:600;text-transform:uppercase">Tarix</th>
              <th style="padding:10px 14px;text-align:right;color:white;font-size:11px;font-weight:600;text-transform:uppercase">Qiymət</th>
              <th style="padding:10px 14px;text-align:center;color:white;font-size:11px;font-weight:600;text-transform:uppercase">Status</th>
              <th style="padding:10px 14px;text-align:right;color:white;font-size:11px;font-weight:600;text-transform:uppercase">Borc</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:#f8fafc;border-top:2px solid #e5e7eb">
              <td colspan="3" style="padding:12px 14px;font-size:13px;font-weight:600;color:#374151">Cəmi</td>
              <td style="padding:12px 14px;text-align:right;font-size:15px;font-weight:800;color:#1f2937">${totalSell.toFixed(2)} AZN</td>
              <td style="padding:12px 14px;text-align:center;font-size:13px;font-weight:700;color:#16a34a">${totalPaid.toFixed(2)} AZN ödənilib</td>
              <td style="padding:12px 14px;text-align:right;font-size:15px;font-weight:800;color:${isFullyPaid?'#16a34a':'#dc2626'}">${isFullyPaid?'0.00':totalDebt.toFixed(2)} AZN</td>
            </tr>
          </tfoot>
        </table>
      </div>`
  }).join("")

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Hesabat — itstour</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#1f2937;background:white}
    .page{padding:40px;max-width:960px;margin:0 auto}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;padding-bottom:24px;border-bottom:3px solid #ef4444}
    .logo{font-size:32px;font-weight:bold;color:#ef4444}
    .logo span{color:#1f2937}
    .footer{margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#9ca3af}
    @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="logo">its<span>tour</span></div>
      <div style="font-size:11px;color:#9ca3af;margin-top:3px">infinity tourism services</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:13px;color:#6b7280">Xidmətlər Hesabatı</div>
      <div style="font-size:20px;font-weight:bold;color:#1f2937;margin:4px 0">${date}</div>
      <div style="font-size:12px;color:#9ca3af">${bookings.length} sifariş · ${uniqueClients.length} müştəri</div>
    </div>
  </div>

  ${clientSections}

  <!-- Stamp and Signature -->
  <div style="display:flex;justify-content:flex-end;align-items:flex-end;gap:40px;padding:0 20px;margin-top:24px">
    <div style="text-align:center">
      <div style="font-size:11px;color:#9ca3af;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">İmza</div>
      <img src="data:image/png;base64,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" style="width:220px;height:110px;object-fit:contain" />
      <div style="border-top:1px solid #e5e7eb;margin-top:8px;padding-top:6px;font-size:11px;color:#9ca3af">El Art Travel MMC</div>
    </div>
    <div style="text-align:center">
      <div style="font-size:11px;color:#9ca3af;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">Möhür</div>
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAs4AAAIPCAYAAABjWFg9AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAAFxEAABcRAcom8z8AAP+lSURBVHhe7N0FdBXX+jbwOScJWqAtdade3EKIu0NwCe7u7u5Q3N1dgoW4u7u7uwsR5vneSc+/3+1todD29ra972+tWeecPXv22GHlmWHO3gJjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOM/TMB+FYURfXg+h+mJ1mi+iG3cvUVF2LUN95IVN92N1X9rm/2VMeIgrWn/WvUHWm+Y6qonkrL0HI9Fc0wxhhjjDH290NhWPn/Jgq3ZsWiOMK9snHEhcjGEdf8C2+dcknx3Poo1XPxpUzPyQeTasYeSofx+gQYLIuC1vxwdJkShC/G+uBLmr4Z74+vJ/jjq3F+6DI9FH1mR0F9fiz0V0Rg+M5oGKyP9hm0L8Vz+KEEz9nXUzx3u+R53vAp9DzjnHt+z4OyESm0btqGL/5vexSbyBhjjDHG2J+LQmn79JKGAall9SvPelatPOFQdfmSU1HK2us5KaN25qfMOFiOoZvzoLU4BT1mJ+GtQV5oYeEEuYU7ZP39IBj5QjAOhaAXDEHNE0IvVwh93CD09VBM7hA0qFxd8b6rI4TuLvSellUPgGAYCZlFPJoNTIVS/xC0HOaH1pZOeGOQC76eEgD91eEwWB5ePnBrVMrq6wmJm58Ub3HMhR6F6PcUu8AYY4wxxtgfi0LyN4mlYk/fmJpFHrGFp+cciz47cldwvtZcF2jN9cN3k8Px7rBINDeLgEwvhsJtLIQekTSFUPgNo0Abi5b9gvHmCKo3KgofTIjH25OS0W50LN6fkoovZqXj25kJ6DwzGj3mRKPT9Eh8NTmGAnAsPh8fgS8mRqPr8ix8tTAV70xNxFuTU/HulFy8P7UMb44rw2vWOVDpH0XrpfCt40WBPAiCQSAEs3AIprQN/cLRfmwcOs2NwZCdsVXWmxNsdl7POv3Qs3RSIO0X7d+nil1ljDHGGGPs1VCY7OSZJh5ZfznDafjqiKcG8+Lw3eggfDPVH20HOkLodQ/Cd1cgdLkNoc8TCKqO+HhqLjTXV6PTzCD03xWPBWfzGtbeKS8Yd67oyuw7hSd3+5SdvB5SfdIxof7kxYDyk0fc808+iqvd75UtmsQ1iIZZomhYSlMavY8vFPem5It3Q9OfbYrJrLNJeipe9KsWTx6Iqz65xq/s5LbQ6jOHY2uvr3IruT7mVNGNEbtLHWafyRONNyfhu7nJ+GxuOlqOjIbyqFQIo3IgWFCwNg2lcO2GFmaheGtwDL4ck4Ce0/0xZEtsyV77YqdrHkX3Y6vFIbTvGorDwBhjjDHG2P9HQbEtTeY+pY0LjzzOc991KyHObJFnzXcTAtBSzxVCVycI3XwgqEl3kEOgZByKrpPjYbQ8HRqLIrIMV0WlzbiQlHYyuv5aOjCtTBTfpPak6WuaetD0YZIoTnyQ0Dhxh0fjxOH7Syear8uYOGZ/0cQJB9PmnHHO9znlWuC337nQf9uTfP8NT/L8tjoX+u13L/U75lnmd86rwm/p0YJt674vnfggoHFiQrk4sQEYCEBJmhS7Ie1H03rjC0Qdm7SqdVseFDuvvpebZ3UwrWjo0XIY7CpDuxEREPQDIZjEQDCOhaBLn42iqDwDbw4Ih+6KZFhvT8PqmxUPLgeXLqwRRU1aRyvFKhhjjDHG2P8SCoLtKGB2Cs4RzY67lx6ZfCIue/jhLAqWxWht6QEl9QcQOt+A0OM22o8IwJezoqG6MhED9pRg8K4SbL7/NCSgRJxN7UjhVeodQ7MU0EsoeLbthGv2hunbU7YPXRG9Y9BqD7uB657kmyzwaOg60QNfjfLGJxND8OmkMHw0ygOfj3bFp2Nc8PqQJ2jZ7xE+me6Pz+cE4u1RDnjT2h7vTvLA+xPd8c54V3w7KgAao0JhPDMcZvMCYDnfA2qjrsNygW310iN+hf2X2h43XuC8Y+6xxO0XglI3e6SKZrRdXWj73qBJid4PyRHFsXs9qy5NPJcRMuxAXlG3JWl4Y3I6Wk7IgjAyA4IZhWkD6fGOSLw3MR+dZ8XDakMklp1Pir8dXnXQI03UpHa+VBxGxhhjjDH2T0SBr41/rWh2LaLwwiqbtMSRh3zRY2YoPhufCkEvAIJxBIT+8ZAPjcK381MweH86Zp3PLdgTWHbRJkMcRKFTCqLStK5MFNee88+4oL/S7fzo9S4Z/ZfaQW2MIyznhtMUBf0pYdCdEYh+q3zRf50zxu7zx6wjERi1I7ho8Brv4PknEp4csU16csEpmV5Tniw7G/9k9PbIJzPPZI5bc69w4C2/7PsnXRKenHFPe2ITlPvkll8Wvc9+svZK8pMFJ2KeTNkb8mTIGl87jUn3nPsvvF9nsMQNPeYHoPtcX3Se7YVO05zReeJjGCx7BO3Zj3wtF3vcnrTT7fz2a0kTKETr0T60pukj/3zR9EBQ+c0ZD8r8Jtyshuq+KnyyshotJhdAMI+C0McHQm93CIb+6DotCb0memHqzsinxx4Vni2t4i7xGGOMMcb+MSgcNs8TxTF2+U+Xr7ybmay7JgLvTwiEYGFHYfkWBC1vCoXJeN06E6Z76zD8WFrhfrcqd+8KcSgt25kmgxJRHH3ZvW7jVps8V7VVUW56m+KLu6+IwvtT3fDpNAd0nf4AI7fYVs/b4xK88mj4sasOeUfdgguOPvItmZciit2ojX+dPqLg+od2DUftfR5JbR/3FnVcYsuPbn+UeXTYVu9TY3Y6F3Ude7n6qyFXYLQ4ASZLk9BzYgB0Zruj+1j7jH4bQ9z3upSMp236VLorTa9dPUSx4/mohp3Tz5Zfs9gYXdFpShA+so6B3CASgkYMhWh/CL0c8Y6lJwxmejQsOxgf/CSgdjYt21qxOYwxxhhj7O+EgmCv88GVu6acSI3WX5eALvMS0MzID0IXNwjd6FUtCB+MSIf1kTzsdCjIPB5Yc6YYGEYB8DsKyqvvpJesmnM16YHFRp8C3eUR6DQlAB1GuKHXNE+YLvfG1NNRSYecsqP2eJStdkxvlMLnO390IP69aJveTKLtuhpW0MOrUFz6JE1ceuB+9v2JOz2SLBc51fZfGQzt2d5Qn+SGnmMdC6bvj3zyILrcnPbjdVq2DU3N/UsqRx9zq9w080hkvOnGSHSanUIXGyEQ+iRQkPaHkq49ek32x5iNwQlnHYp20TLqitUzxhhjjLG/KinsST1SnPGsuj5ib+qzDjPiIbeU+kgOgNA3sKmv5DcHR8N8dR5WnS5/euC+eJKWMVeExK7HXUpmzz+ZmKS5MATfTfBDh7He6LHID0N3hZevu53kds0z+5FtWONIqqtD4VJOk0yx6r8VxbZ/4pcsDt1wOnrf2APxXsbLvRv7zHCgIP0AahPOYd73bgXfX41d42UjfqNYTKgCup8If7p61LGCzI7TiiCYRELQ84GgTRcjuo74fLQnRm7wwIpzMbaPY5/Op3W8oViUMcYYY4z9FUgBLbxKXHrItThp8K40vDOUAl1vaUARj6ZBReSGruixKhnDD0c3bHUpvkjBV5uW0aOQPfSAY+XJ6ecyvPuvi4bW/GjozArA8NU+tUuP5Ibtul94IFAU1aju54pV/WPRMfkqNBcT9tyMPD9gzu24PkPvisaTfWEwwhnGE+3DV56L9bnqVyk9ktGcjsfr+4OqZ82+nBvXf082PpmWAsGALk6636cLlDtoZngbXSd4YOjaoLQrXmWraZl3FKthjDHGGGP/DRTgPrGLqlmx7Xp6hu62fLQcFQP58FQIZtEQNH3wpqn0KEI8Fp7LjHcpeLqIApwFTZNOeRWeHvm9U4rGMmd8vSAKOtuyMf5YwrNtj4quBeWJU6nOh1JAVKzmfw7te8v4IvHDu/7FM8du873bZ+odfDnSCd+N8YPFEu/CEw8Lr9NFRw/p+FPdHofcytaNOZCZ3WteEgQjNwrR9hA03KCk7oXO4zyx9X5GrmNu4whF84wxxhhj7M8UWSoeXnwhs67nrGC0sPCCoB0OQT8CQr8oCIPCMPBw3rOLHvWnUhswkMLdl0G1mLD8Ynqo4aIQdBznjK6Tn2D6schnZwNLb0SI4mgKgb0UTbN/EyaKasedi5duvZaRrDHVB18MohBtdR+jt/oknAgsmkPHTkWafLPEmcuu5CT1WZsE5QHeFKDpvPR9DLmpM3ouDsawA+FeXgXiNjofPEohY4wxxth/EoWzZhd9yoatv5LtZ742F4JmAIVlCsomSRA0EtGmXwK6LU/AZu/qymxRPOFdjGmzT0TZ6C29m6a2xA5fWd/HoFVejZuvp9k8iBFNKMB1UzTNXgIdr7ZRheLs9bcyH/Sd5tz47siH6DjXCRZLbhXtux66Rrr7TFNrnypx3Hzbwohum6Lw7qwUupih89M/GcpDItB5aTjmn4ssvOGVN4bO51/qx5SMMcYYY397FMbe98oWD0+6kJ36zaxwtDCjwNzTjcKyJwQjL3SZl4Rx+3Jzdzg8PRIsijk2WfVPhxyNTfhwhDPeMHGG4QxbrDzkkXDMNn0htdVB0exfCoXIv9XIfLnAZ2diqmdvvJN2x2TOjcpOw29CdewtmC5xfXzCE1rS/tCx/vJSZN2xaedza/puzcfrs5IhDKRzZh6A72bkYcrRnLDT7kUTqF5LRbOMMcYYY+y3oPD1WjEwbcuV0hjT1flQtgyDYOAHQUd6NMMV702NwoSLmWmB5U3//T/ZPkO8YLIxvlbQeYzXjB+g+/jH2HyvyDYfTUGumaLZv5R7zskbNp1JPbl4m1vsok2P/VecDbk295Dv6W2XI3bFFJR/raj2Iyn4r9jnq3bZNunURbusiYlVYs+wgqoeN2/e/K/tH21T+123km6O2hKA3tOcYbTcHwaz3INWnojdR/P0aeoajbpha11KL1ofKaj7fGo8XfTch6Blg07jvTBmZ1zMOY/CQ6miqE7nqYWiWcYYY4wx9jLSRFHzkGed97DdxWhvGo9m6pFQ0aTgrOqO10dHw/p8Xu2NXPFovihOPB/19Nqw3f4N7w+yQ4cB/rBeHVe/9Urmw3uBpYcpiKkomvyPo3UpP44WzdecCTt04lG01yXXOPcVRx3G3guqHphbJvZRVPuJUbPuZ7+t+Rivq93Dgj0hoQvP+CeZb/DEdwNOYu6mW/6Kak0yG0SDVWe8yy3n22L+4XhM3ZMI83k3aX+P4Ogjz5/0/HHXOdTkrEOgBW3Tn9JlHq1H3iCKxuf9RJNlFyMv6U9/6NdvsQsMZthg9ErfJ1fuQkuqJwX/1dfyZ/bf6vH0jcFOdD49IZgm4r0xUdBd5YNj3jkuVKdtU6OMMcYYY+z5KDS1sQmr3TpgfyJeGxEDQTcCgnYkhB6eaGXgB9OtudjuXnuD6u07E173qM9c1/rXTe7h25EPMGqDe9IVj+rd0h1ORXN/miN3vC0HzL+S2MP6AbpPDcSy08FZu6/65ozdZoduw85h5ZGAXAqXryuq/2jQ/JAo4buH6D4vBoF0sSCVuRZi4JwNLoGzl15zbqpEpGVXHAyK+8zyCvY551yupQBqF1ez3HrtdaiP2IqE/NovFFWbbD/ls1t7zA1oW9+JW7zX23PZCb8lqWWNM/6sIC3xTCyZvWy3Z+yA6ZEwHBOGKZsCY+1jGzbSNrSgc/Tp8rtFx9W2Z6P5tEwIQ+g896ULn8lhWHQr28etSrRQNMMYY4wxxv4dBao3zng0uKsvTafA7A3BIhqCYQCUzLygvTYRm2zL/StFcX6EKM6beSqm6l3Ly/jG8g5GrwgsfRT27JAUxhRN/ekCkgrMNSddhvDhKWhvLAJtiw5Nzc945x1sa3Lz2VfD3fEwsGytovqPhq6PiRL6PEK3pYGIFEXV0rC0DtHOKdIQ2Eqhrqk/Bm36/MnYZe6V8g67MXyDfRC13UYqdwxPXnjmbnhxdbX4UVNFhdP2dRM+NfRD8052GL8xtHzSNgeYTn+M5XvCpYuOP62rPWldToHi5Nk7gyI7jbqNnnO9YL3GL5zKmwZWsRdFg9HXUkI7zAuiiyM7yHWC0WpCJNSWh+KoZ9FjqsdDeTPGGGOM/avkGnH0TufS2K9nJkPQcoegF0KvgfhkWsyzZQ8KXMspLJdQaJ55JtFd6h3jfdNLmLPLt8Q9om4nhauf3G39I0QkNxglZohfKj6+lEGr3ePlqg74YGwGbqbWHZDKnoriV9/MjK+Rm/pi083MB00V/8WgjRFR0p3W94d7Yr9nscf8zc6xY6efb1r2303aHHartdpZtFHfjwk7/cOlMC2V0/7/7IJh46WUJ210A6C3MJ0OnfiNX0b90m+tHuMzTRscuJJwTlGtyZOQtHkPXeIf3nuSsv2GXcYr7fPLom1VOeactmfgMtcgrZGPYDTkFDaeCrxM2/aVFI6X3M5dYbg4BK2MXCAYOUPQeYT3rN2xwSY/MqxIHKJohjHGGGPsf1etKOofeFR8z3xlMFpbUWgylIKTN9qPTcbII1XwKURZYKm4beLhhMCuExzRRvM69Ca74PijMuluZG9FM3+oI9dcbk1efhsLN9xeqih6KXMOBYYr61Po1wmH7prwuusRjetX3y5PbDskAp8tSKo5FFhrrKj6oxHbIqMENT+oaAXjXWN3vK57G52HXt+qmP0TV7xyFnWd6Ajhuyto0dMZ5vMT8r9/kDtPMfsnFh4LS26pew/mm2P8pM+xotjfaG4YlDtcwYRl7uFNlQgF2laLD7pGvad2HJ+qnsGCdY9iqazph4Z0fNsWVNX1pNc2VPaHdB1H7Sjd8q60HrzoTklny+OwmHMHe+7GX5HCc3qdOHzDvdxg7YW0nYZPIPR5iJbmHugzw1m845t3g5blHw4yxhhj7H+PFM6ckp5tt94d8+ztAYEQejlD6OqG10wjobM5rfZoVNWDZ6LoeD+tER2GRUD45j46Dn6I769nJ+Q1iD8LoL8VBbYvafrJHesdJ2yPfaqzB0Pn2txWFL2UiRtdlr3X3x+CbhyF/zB8NKUBbw6qhaAdgYknMqVnnJvuEP+roWtjowTVaCjpRGDgtpgGw3nu6D3syk7F7J85cTd1pfVSv7I36OJCUHVGh5EOWHw2bCW1/eOPIKX3Q+b5Jwtf38bATZGRtH/vf3838lY7jTPoPsAORy8l7lBUler2GrHCAcKnu9HG+Jq44KD/Wipreg7aMaFmtPnca/XDl5wveuQWNrhpgT8IbdMHFx7G3e474TreMDqNqfuD832LRXMqb+mWIQ6asDcqpcOomB+6Hez5BH1mhWD7ozKPCmDgv+4rY4wxxtg/GgWf12xj62ytNiVDULeF0NcFQncXvDcyFJtca4PKRHGdXYl4bMLJojIl9et4V/cOVp/OqgzKeHaMgtUf8sxrdgXeWrL7jt2YFTeeTV1t37DmQMhtz3TRmLbtdVpH82l7vP0nbHB6VlFfr61Y5FcdcayY9eXoSAiaCei6olzsNjeHwi0FafUATDjQ9NxzT0XVH03emRQl9AzGmwMTcS7y2V670IrvLzvkHZHm0bbolZb+8INCab+lbVO8/3rTzQKnT8bSBUfXo+i35BFyS/9//9SPw4pndBlqR2H4HKxWeSKmsPr6msO2WaNXPMw/cCt3A7XzhqKqcNs1dce3ltchdDkCk03eddT2u4pZwuEnxdZf9r8E7VGHa3acePCz0P9HcEhpHDZhm2NclxGX0Wf0HSzaF3+btu89mt7a9aRuT7cZdIGgbQOhjy3eGJGISftTcdI2d65iccYYY4yxf648URx02LMqqePUYArMHk13Y4U+Aei1IBO3EsQACm5Ld/vWJ38wMgzK3R7Dcq4vzjvm3KPyP/TZ25IafLJw1wMIn+yE8NU1tNF4iF5T3LHqenKqU1lTgJ5w2LEBLslVkxWL/Kq7seVLv5sZB6FHFKYcq6oLrxS3qc53KRNoP9pqRWDR/hwb2o+mH/X9n/Xn4+KELg/wyZAAzDkv9qH1viYFY0en4rPLV93HwaM3DKR6d+4Hrp2x+kD6g9CoiU0Lkq0Pny573/wKultfg13UD8eHln174VHfFHnPK3jTwgXrriU/ORyV/xq1247mfdi0oAKVtVq21yehWccL+GzYE1wMKZUeh/jxkYylB4O29BrigEt2uTcVRU1sHFPmLd/t7uSSUj6e2vwxaP9W1EbrY3eyZulPvItvBzzCmKXudfahxQdpW+TnwvOXmm0PF9uMpossvRgIavb4dKhz3fb7mddoOR44hTHGGGP/TK5ljSPHnY171qq/OwR1bwiGORAM8tB/Z0VpWLm4M7pOvD/uchmUTB9AY7YPtlzN8shqEPsrFv9DUShTCskom6U73a1GehRA0PaB0PUmBN1b6D43QJx5qrioz9RoWC5z8pICnGKxF0qvr9c2XR9bJXTzgt6KTFoMzW5Hlc3pPTcewqee6DgiAhtP+ez/1/a2n/cLfk31KL6wvISDt2K/l8pu3w3cNGWSFwYMOoqAkDhVqezYKY/Nqv23YPySi7h41nOlzY2EjuPnXl8weLEdDj+M86U2m+5G02t3623hEL67g2/GBZZ45uEn/Tv/qxpR/NhshkeVvKs9LFaExVEQ/bFnDnr/8eT1fmVDZjjXU5s/3qGm97Lt5xNOfm56E93HPcGMvf41t1xTd1L57x6AJbhEtFpxKeWwyVJ7dB9/EzN3BCSEp4k9y0Xxq00ODQFdFkRTcKaLLU0PfDLCE7MPxbv5p4n9FIszxhhjjP39Uahq8TBVnGm6LVCUGT+AoOVMgTkKn816iqU2QJQoZq57VHz36wkhaKUThEFr/MTHiTXSc7v/8WGoR2729rDcGIGJx7MiO0+jMK91BULPuxTQ4iB87YoOQxxwN6bGWlH9hWh7VQat9iwUvjqLdkaPsO1x/F5p3/c5FJ/XmpeED8wfQX/SqXqfjIw3FYsINq5RQ089CvP5/mqQz3X7hFlSmbNz7M6zZ0Jc79zJN6Plm543PnHCsd3yXV5jpsy9eWfa+IMhOzbdc5u/+lbw8buRa6hOO6lOdbX4wbpdT/xVRzlB+OYCOlnfL6AA/L4075d4xJUu7D3aG/Iebhi4IuaWorjJlSfJUzRG22H3qUTp0Ykfg760PyZzHPPkve7R/rhi7tGYqIkb3cpHLLz7KDzlhy7mfq9EUTQdvcMt/G2dC1AbYV/hEiNaSuW7HVI36W7OgrKFP4S+NmhLx9hg1hPc9UmXtpGfe2aMMcbY3xsFt7ZPYhudzTbnQdCgQNfHESpmgRh2pAy3ksQjNH/rqgelkGk9wrvm9lh3sjisQhSHKhb/zfZfd1u87KCH+2nb7LkUqp4bwI88iDs5fa+79Pxx2zsxDcZzjoSkfTrSAYK6HwTtNCjr+sF6o5s9tfGrA4dQG22W7HXP1hx9v8FqwcOGc/ZRGVK70rzHSZWj7vtkXN99zs/yRFDQfyTkUXD+cMWGG7YWE+9cH7fVvXzJMa+arNJKQ8Xsn7niXrj0q6GuELo/xPCVQfcVxU3OP4l6qDPFETZeJesVRU1Sa0TrPjO9GgU1Z8w8XhAqld2JqljefewNWM25Wu0XVdSxqeLvRMft3ZXnogLeM70CnamOcAqtvCCVu9WI2mMPJ2e2HxbS9KNBoctVdBrzGBe88mxfdJ4ZY4wxxv7SKPx8sf5GoU+XOdLzqRRENSPwyegMzD9fUdQoitNd8sVNg/dFFDQzuoF+m5Jw0afGVgqfisV/lwN3Y8590e8cVCd4Y/ed5Of2UhFbi8+GzDhduWrLk6a7mhS+3jjlUrJv8O7U+jZDciH0cEf/JU9qavH8Rx7+Dy0rj0rGJ7mi2IH2Q5r+a0NH07o/lB7FUHz8RbbhJau/HnIPsl53sfR0+h1FsbTs+zP2uyfOPxnhX/NvPYEsPhoY3EzrNt4dEYlLkfXzpbJ4UVzSeeZjtFXdjanr3TWaKv4BaDvaH3NLcX7b7AC6DHuE2TtTHyVWiVL3eB232T8N6zSdvld9nCn4P0DH8YHYeDnVmc7Bf+RHjIwxxhhj/zFZdZiw7XZN5dtW0nPMgRAG+0B9bzHW2TdspODT4WqkeKLbYgo+avcw51i8mF4njlMs+oe47pt/5rNBFKq+s8N3k/yeHvEsf277CzfeS1m53SlO8bEJbWPPRScLrvQafh96487AKSD5P/Ks9X9TRGqx+rCFl9Ba/TIGrPH3Pe4j9swQRZ3vb3vHT9rxEDb+6T/pJzu2UuyiMT2gSuj4AB0mxuCIbeahA3ejhw88lBKkpHEdquPscO1R2k+C8/oTQa0C0wp+1pvIq1h3yW+65WI3vKH/BOqz/HHOo3KkVH7Bp3zzsHWRkH58KQ3J/rplCKYfySi9FVQ2rGlBxhhjjLG/uusZjVMmnMlFc+NwCKrBEEy8YXYwG9eKMIECaaeNV4u8P6FQ+8UQJ2y3KarM+QMezfh37klVS7tO9IDw7X0IPW+hy9hbOHI/YRmt/2d3tDce8Fs3cIodnEOqliiKfnTaNnb05mO293xDY/UURf8o9sHJ/Uesc747aJlN8ZRtLth8wQfzdt3DjnN2NwG8pqjWZNut+NvtDB+gnZkzph1JLtt9PSlEddJ1KOldQe+5Idhjkys9a9z0vPX/ueKVvmjA8juYvunxI8+ILCPprrxi1iuJKxfH7LJJi+ky2gbfDblTYxMkTpXKHdMrF00+FIO3B3hB6OpE37fH0Jvr9uyIfd6YpgUZY4wxxv6qbsVWzzPenQnBggKztj8ELU+orkkWn+SJ1pmi2G3m8ayqluo2MJvligtOtTMoyP5suOiXEVcizrpmmxabmlluoSj6iYs+tV8aLnWD6qostB8YCeG7s1Ad/RgHr6d60zp//HGeJLNEHKM78ha0R57GfbfQ/8m7lXRMPrT3id9x5qbvxLhsfKso/hHNVx24OaJR6HwZA3Yk1NNnXanccqNXrIrJA5wOaYynUPyT58CpTpvp+8MyhR7n0Er9OJZ874CEvPK+itmvTDpvzlHlx8av8Yfe9BDscy6SuvfrRuvtvv5qYkorPZemHjeUTek7N9sPexxKpygWZYwxxhj766AA8+7m2ylnNJZ4QjDwhdDXB4K+F/ruKIZ78TPRp0A80WOqbWVL7WMYs8sXfiniWMWiL40CkkqZKI7eeDPpksUKf7Tq+D1mrbkXKZUrqvzIPqmy87q7WfARxaUzH4hnXjMLhfDZBbRXvYeRS/wDfDLELoqqQmmDOGjMcjsYTDyLJz4xZxXFTCEmrer91Yd9M98yt0czHWeMOZJ2XDFLMNsQESOonsXAtY/CFEU/Wn8yeM+bxjYQuj/Bt2N9sfK4/zZX19TfPWx2Volo1W/h7fwPBlzFnP0RVfHVohp9B94y2Rwd03ZMIJQGh1GAdsa31s44YZd5jOb92J0eY4wxxth/FYXm9793LAj9arwHBI3HkGl4QVnLDWNP5VeE1YuudzOBrnP80dLkPJbeik7MAl75ri6to/VZh2T7MdudYLbBFdqL7NFjxBX0m3oeVx6FTldU+1Fundh51dUEbLqbcXvto+IwzTVF+HCoH4SOlyB8eQj9Zl3DA8/Iy1JdClayA7dSTMILRUN6/5seJfgnS04uaTdxka1N12EOaG5og+E7Y4+m1Ioms4+F3Plg4C0IX++C7rhjdE3z/0cvvOVZqWe2lC6g1G6hlYUXNtzID1bM+kMU19VYT9rhHt+251UMXOj71DW6QXoMpJ35wfjgFiO9KDg/gaB6Hz0n++OCS7HUz/VPHiFhjDHGGPvTUSD5ZP691KgPx3tDUHeGoBVBoSUUI46VVjeK4qxzARUXPh3kgDd0z2OfY34hhauf/ODsZdAy7a/apbl3G2EPqxWPPR8nib2rRLFbZJXY7ZZzylSX4PQRiqo/omU6jVr3BB3HeGPbrcJouzBxxOWQp+sHr3SD1uibmLXhsb+Dd+xze9v4o9B2tJGm+Kei5YOkiulbHxRPn3M+b/rkY5k05U2ffa5k9o77mT5b7mWFLTmXFTZiW1LYwC3JYaN2J4VNO5UUtts+J2zR+aQwg6UuYZvvJoTtskkKW3U5e+X1iLLp8WXV07OBb/9vHXQufvfd3Be5bJ95ZvZR9wrdebcwfLUHPh90AbKeh9BzhCNOPYi7TOtvelSjXhQ1h29OLBB63YGKpS1W3shDAe1/UyO/IiUzV+3cbd+wXWftpJEBXzi8Os1/c/QKV6+3tE6j80jbxnOepUep7NNpp1IqlAzv0UXcNfo+3kW3BcnwSn22W7EYY4wxxtifj0LKV8vtcxLbjfWAYOz7w/DZ6unQ3lWDBFGsPxlUlf2G5T18bHwD606kPKb6HygWfSW0XKeJG7zRcaDDMwpnnymKX0haZsQqR4zZlSD10fzjiHjxhfXTQrNe/Y73y5DWQ9OXj6JrJy+5nrNj/tHYu6vPx+YbLAnN114Ug84z4/HZ5CS8MzYe7UfF4c3B0XhzSByaGYeimVksWvVPgUq/VKgMSINy/2QIZtH0ORbKVrGQ949A834xaGkRibeHROGr8SFQmxWE7pNdavrM9cu33u6fv/aMf+Kqa6k7bcLSZ/iUiV9K20LHS0mxeX8IavOdTfeSLEasC18+76Dfqe1Xkryvu9VJA700DdV9wyej5cpTYelt9e0h9H0EzVXB8C2se6kf6qUVixrTltiVtPxmE+ZvvSedt18dzpvW227sThfXdrpX8O0QJ5zzqb5Ky422PhCT1lLvHAT9OxBGR8H6cCqcQwu4tw3GGGOM/fkonHTc4VGS8dbEOAon0VDWD4OKRQQW2NbBuQoYf7IAco176DbTAzseZt2jgPObh2Q+HVK+pMM4Z/Sa5t9A633uSHj/iup1nbj6Gj7S348Ltj+MyPdHo3V84J9Sv2bDhZhb5kvDbs08nFw2dE/is06zgtFuRBCaDQyGklkYZAZhELTCIRhRGLbIgtAvB4J5FpoNKkFzqyIIBqkQ9GjSSqT3yZCZpEGlfy69T6GyeLooSYfSgAIIptKPLqlcL4lCaTQEQ5pvRMsZp9E5CKFXN7wzJgKfjHJD57EOz4ZtcH82Yo1fwOaL0beu2oRvCk6sV1ds+n/MPpvkRR/0t4XQ+y6+mehWuevJy4XVix4hM03neTxV/s4eo9cHFESk1xopZv0qOg+t5+1zePK69gV8NNIJu3xKblHZ26tORjl2muIHYUwkHctgGK8OR2Bh7T+ydxTGGGOM/UVRKOlx1a0+q8PYCApuFEosktDMIghbHMqQQgnZap80cMg9qM8PxoXg2qu/564nrevd+UfDy4UuNuhuHSL6xD9dqpj1M4/tPc3P3bz5nvSelvtw3qbzySMWna219Uhp6gHi96L9UKkXRe0TLjWr191MCxi8MSiv+xQvvGnhjGZajhB0PaA8iAKtWRCF2EA6NqFQNotDM5NkKFH4lZlSYKbwq9Q/DXKjaDQzi0dzSwq/hnTxYRwPmWEsBbxEek2FkhGFYW0K0joUpI0oMBtm0DKZUDbPg5IJhW8ql94rm+dDbpYLuXEeZPp5aGleBJl2AgS1EMj7+KK5uh/aadjhY/1L0Br3GOPXBQdvPx9z74pzyTgpXNI+/WGPd+RViu/O2+lcrNLjFl7XDMPG8wWOilkvRNvw3vDVNlVKfa6guZoDFu4LdlbMemnURrMtd2LvdRh0kcKzF1ZefrpQKt/nUfyo40I6jprukJm5YOb55PxyUfzNPXswxhhjjL2S0/Yl8V8PSofQM4yCHoU94wiscapFKqUXrd0UUrpcRueZATjiVnxOschLSy6p+WS96/qm//aXULhru/pMalSz7u5Q+fYRpm30y5PKFLN/FJteNWHh2vMYOWa+mqJI8IotlJ79/VDx8TejNjRPOuZvmXskPsF0eSI+HZ1FgZf20zSYwnE4BVYKvpp0HCjwCuYZVJZExyQByhbpaGaeCbl0h1i6m6xD83USoWycCLlBDAVtuvDQle6G0nuLFMisaFkTaaKAbZLdFJYFXQrW2rS8fhqUKHjLjLMoQFNw1qRwTPOVTKU70xlQNqVyY6n9OHpNRlvrCprK6D0tqxNF4ZvWo+YNJU1vvGHoic6DndFrxMOCGbsCsrZdjL8UWCT+eNx+q3zgtdWH/A70HuGI91XdMW9t8hzFrBfafCHnwMdmHmiu/wR953lj84lgB/oqvXJPGLSM0vWggps9R7mjvf5dLDkXu5fO3Tt7bIs3d54bAMHKG6+PjMHkM2klBXQBpFiMMcYYY+yPJwWTc74lV78Y60ohLIgCWQSa9YtEv5NVuF0iilaHKPB1voruCwOxz6v0hGKxl0Jty7bte3LCfOypp1tOuJ5XFDfxyMBA04XxED66hTa9zmH8Zjc7qv/j4BwUjr7aeCY819D6IA6csu+lKP5d8kvEbl4R4qJDD4seDVkdhM9HUug08KMgGw1Bj4KrXiaF2zQKshRm9Si86ufTK5VLd4k1KAhT0JUCrlwvGTIKszKtGCjpxECmGU2hOR0yQ+muMYViKVSb0kXIwAIKz1LopuX1aHkdCrrSnei+FM5V/andcMgtkikk0/qNqVwrhMrowsWIArsOvdf0pOWcab3uFN5pmUHU7gg6HwOp7eElECyLqT3aTuM8yA2pTJ3qqLk1jbrXRtcRvce6YO7epPt+aeIcOra/qwcKu4DCTaMWO4WZjT1Ztv6w//Bdp1PV/WNEdRe/tNmh8Rk/uZAJyGicpTk5skrW2ROa8yLhVy4ulL4LitmvjJaV3/epWNZnrA2+GmSLi7b5x6Ty82HFS/osC6sV1D3pXNzH5KP2FaWVhfpNCzHGGGOM/ZGkoOqZ8uye1hIKbep3Kez54t3JCVj0oCqBMvOp6bb1hYKqLQyWxON8YPlhxWIvTQpLs1be9H6n90HM2uQTrihuQvOUHgaWnes6nELhpwfxlvZ5WG90jd/9IGvG9hsx66yXPcjvM/Iclu955FNaWvtSPx78JbSedo+CSxcuPhTlYTHZ7VmXoSFobx4FobcXhVQKsnoUas2yKeDmU0BNpRBLky6FZ51MKOtloxkF4WY60VDWlsK1Yj6FYJlOEOTavlDW9YZMjfZBPYDCNQVXKpcGiHltSCS+WpgL1fVlMNhShJ4LoqC2KLxRd1Vk48Ad0Y2zjqc0LjuR2mi1IcFj2pH0rBnHsjKnHk0tnnokoXH8ocRGrUX+jb3nBDX2nheL7gtS0GFWLtqPlUIzBfGhRRCG0fYOoG3vlwJZv2zITTOanqOWnk2XArhMi15Vg9DGIBA9xwVj/Nbo5HOuxVfyRLGvdF4Uh+eV0HLyKauPnRm24CI66h+Gmtl5bNzn1phdWvrj8NvptQ3GA1a5PRW6XsM3w3yx/0GmnWLWj7xiY9ucehA8olD8+YiPL3Leudj6C3Obp8bTXeAeltXU68rdkMaZxqtpv7tfhIrOLqw8bhtPF10v7LmDMcYYY+yVBZeIe0YdqIeg6Q3BxBdvzE3EOu9n4RQ8LA97N3q1GeKMnvN88TDp1br9ouV/7DmhXBTbz9jq/LT/jGu/2OfvwceZR3sPtUfzb25CudtFfGx5EV/0vwLtsTbYcNznNrX1Uj8c/HcU8t4441G1bNn53DTV2UlobehPQdKZgi0FXHOpd4ssKA2uhvKgWrpgKIaKcR6Upbu2+jRPn171KDjrU3CmMK1EAVumGaa46xxL9SOhNCgGr4+MxmfjYqAxPw6mC8MKR2wIy1txMTFv/bnQvJUXYmzPhBZve5TTsC2rVNwWnSuOiAA+L6OJtu3HSdpW2sf2iun9/yuX6kWU4fOoDHFUYEbdtu025dumHC3bvelOUdq44zl52mti8S2F8S/nJuGtsQlQ7k8XA7q0j6bhtI/+kBvEoUW/LArR9FnNE3I9N7Qf7AGd5YHP5p+Ojd56LXP+v56nV7H+qKOR/sgDxXrDLmLXyfCmYbIltN1vzdrhUy50Po2Phz/CjkcpTlT2szvd1x1zVI1m3YDh/NOeNP91RfFLOemes7PTuHsYvNwpm7a/q1R2PeaZzedTAiH0uIFPBj/GrYBiF5r3k5EkGWOMMcZ+s+BaceLYk/l1giaFLc0gvDEpC1uixVwKHIN22VdEfTLaFXprg3Ajpua+YpFfRSHotbuuuUdmb3hYufdG3Flqq+m/8O8ERC9ZcdyzvLb2h6D4787eLZ00el6cv/Zo39CuAy+Fztjs7e+WIE5SzH4ltA3vHfetX2O9JS7ju7EUGjVCIKjHQy49U6wZDrl5ApqNLIbMqoBCcwVU+ldB2aAYrXQKoKKTSeEzkaYMCAa5FDrTKITGUxtBEPp4oW3/ULwxNASfTY2E+pqkvGV3S0LX361Z8zBFHC8FNWn//29SbM4fjtbTUmrfLq2q38qHFVOX3amet8+5OGDU/syUvvNC8Y61N94eRdtr5EkXB7T/UtA3pH2yoP2woHDZ3wdKRl5419IFxjOdK9eeDL6X9VT8WtH8S7vjHNnNxjVjIm1L0+AyT0IrO83aF+XYVusWXjN0xKLrqfa0rT+785tYLH48cVt0aEvNy2hreAjzjz4Jk/ZJMfulfO+QttdkrjeWHQkuiipFd9qGt6adyX+mbBJN58kNXRYFYLdD9Cv/DwljjDHG2M/k1or6C67lQtnIgUKlI1oPDMQimxrpTvOhXU6VCa3NH8J6dyRSKsS1ikV+VXBOyafLDrq49xpNbX5yFO/0vQqzBS6FRx2yb53yqTkycIMvTjkkzVRU/8NRePrsdsKzrVZ7EnI/n54KJdMo2jcKkNoxNCVQCKYA2dQnNb3qZdP7ZCgZpqC5WRYF5yzINLNonvSjvTjIdBIg16WgqeaH1ma+6L0wAcP2RJUvu516/7Jfxv3zgQVr6Fj9pjvh/ym0PW0D00XjrbfDlx3wzLk/8XBkVrfpfmhhFNB0DOSD8iBYUbAcTMdkAE2GFKw1nNDayB4aM51yFh/wXq5o6jdZeSAo/g0LLzpm1zFsZ0gtbc+nilk/ks7R6F0hsa2MHSH0tkG3MXexeL/tE6r7yo9WXHwYu11rlj1M5j4oq6qr6+mRIqoZbEooVLLypvB8Hd9OfPDsZHDxIkV1xhhjjLFXJ4WXlZdyY14zsoPQ9x5aDfXAZpe6smei+Hj+tYLIthb3YbnaC25pT5cpFnkpXlFJ68Zufoh2uucgdLsOoeMNCN9ewut6Tvh4ZCTeG+KKtVdSXrlLsl9Doeub634VB+YdSizpPC4eSmrhaCn1fqEvjXZI4Vnq+UIjqemus6AphehgCBYUIM0pTPdLp/cUmHVTIajS/L5xND8arw1OgPayZMw8EFM8+/uoMw7hdZuk46ZY5d8CHZe3HXNEs4l7oh7rLgor7jg1Eu+MSUTrofFQkbrQ06MgbZzfdDdaWcsR75lcweIjwZ4xotiZ9vWVuxrcdjS5n8aQ+zVfmZ7ERdeMrYriHz0Vxa9m7HNLam1I3w+Nh1BfFFt7O+zpSsXs32Tf/fwN6uPvYfSm2xWe+SXdIqpEy1FH0gtbGLjQ+bSBydoAOCUULVBUZ4wxxhh7eRSI2u13yk/+yMoPQhcPvDYoBAvsS+IoZJnsdHhapWxuB72VHrBPeTpPschLKyys/sAro2Tu6stpyybsCwvrO9298XMrHyirUojp7gpZXyeozg2ut0+oeqVA/iJ2ydVzFl1MqukwVnp+2RtCDwrOPSgUdgtt+mFcM6NsNDeicKidSVMq5DoUoPUjIR9On8eUQhj/FMKQQgg6oWhpEIjPhsfBYkshdjtX+dtmiSPpeL1y92l/RdJ+nHArNl9xoWjnuD35BV+MqICKbi4FWKnHj1zIpa72dAPR3NgbfabbPN18K9TXvxTdFYu/NJtHSZZXbAKeKD7+qJLC+KxjcRkt9a/Q+uzRfHAq1juJAYrZTRc/j32TF5265n6QtvUXH+d5ng0XYnZ+NPIChm+0KZA+R+SLE7vPlnotoe+dmjMGrAooy1M8C80YY4wx9tJ222Qc/2yUM4SOdhScUjD3ekMdhZZRx30rLrc0vAu1ZZ71dzNrf/yx1+9RDfS66li9cOet/Phus2Ig9LKlAG0DkzlucA6rGEwBSUWaFNVfSUKR2Hfd1dybfRb4UBBzoNAnPZIRC5l2EuRacZCpR0IanU+mkw4VwwJ6zYJMIxHK+gmQUZBuNohWPB4QxkrBORHfLUzE1rtFpRecCg8EZosmitX8I0Vl45MVF8tuTd+bnqmzNA5vDA2HYEgXGnrxdAFBAVrLBSrGj9BjqlPDqC2Bl1zSC39XV4Ceseg1akNYXhvLAGrbC4JJImQmmfjaOkyctNbXf933jz1XnwjB6NWuUBuwB0s2X855ld426PvbdsqxsKBPLB9g7kqPdVLZYpuwe6+PkR7Z8EMbPXusOx9ZQPXeaVqAMcYYY+xFpIDqmSqeNFgSBaHHAwqZnhh2oKo6XhS1HWLKd6ovcEHfBfZ4kli9XbHIH4YCS5vbieJirbXREDQoPHc4BLPxt3DfPtWD5v3sOdgXof3Q23E3/Z7FAle80T+w6ZELpYFZ9JoJgUKxoBNMIdobKkZxkEuPX2gkU1kGlA2yIWt6xjkMgjqV9y3EGyOq0H1hDuZeysm/FVO381W35e+O9vftqFrRbOuddFurtcFVXwzzQzuDQCiZUYA2jYHcOBBtTJ/AeMnjZ+f9MscpFnslD12jpg5d6lbbrNdNCJquMNpRhd6rKyGoRaBZTwdsPBGfeeuh/4Y9N6P3br2UcGLMcrvjczZctHcNT/hI0cRLqQe0rJeG1H/a55y471r6TPqeyCeej/d+3coTQpd76DTRDw9T6zYqqjPGGGOMPZ9fWv2cCUdKKTD6QOgVAt21qfDOr1+SWi5aGM4Kevam4SWc9st8KIVcxSJ/uBMx9Qs/mu6PNkY3sHiPR/Ej1ywjxaxfRUGoWXSBuH3RiQyxrZn0ozYPCP2zoTS8Fm2G1VEwzoGSdiZkGikQtFIhk+6eSj8K1EyAXC8VSgZSgJZ+LBiIN4amQG9NLuaeLnG+F4GB1PY/4nGM34PO+4dbz8fOn7cr1LbDWB/IBkRA3p8udChIC+q2+HqiG+ZdK3IOfyqaKxZ5KUcuu+mPWP24WuixH90mOzXY5jSOsT6QckVJ3REdB9rjYajYR1H1J6QLPcXbl3bgUvTwDlanYLjGHW7x1YNon7602OZTKajZQUnLE2OPRFXnNFQMVlRnjDHGGPs5ChCdVp7NrpD+C15Qj8ZnIwpwzKvSlso7LD6VVfd6HzfsuJFXQZ9f+r+y/TyiOm7ddvvu9ycC1qUCerTsjwNgPA/V6bL8eiSWXQiXurzrrSj+VSHFosW6S/mB2rOTKASHQ8ksF0qDaqAyvh5KQ6vw2qBqtDEuhnLfbMg1iiksl0OmJd1xpvBnREFaP5HCdDDkmh7oPC4KMy5UPPFq+Gc/jvF7bLPP3WOxLbH+/RHSKIYUnDWlLu0i0G5kOgZtDmm45Bo7VFH1pVzzyzYZs/Y29t0OPiV97jzPbXEri8fQm+uBsCqxR1OlP4jV1hsXP51ogyGbg/IofL++3zt9vs4KOv907pWN7mPZtehiqVxRnTHGGGPs/6OA+vZ5jzLPz4ZQCFILhJJBJNZfL82hcv3vnUoC2+rfx/jNaXnloqihWOSlZGdXfDt3uQve7X0R6vPsoD77rmi2zNlv2+WwJdS2qqLaT1Bgea28vEhNFKtf6r/hqb7yXu+Cc9prQupfGxIEQS8MgkE6Wg2ogoppftPQ2IKxNFx1OpQtKDCb5EGmn00hKQkqfcOgpBb8w9DWWgH4dFQwZh1OTnCLLn/lHz3+L4rIE7vuvpJ2pv/iwLr3B1J47uNJxzcegqEPdGY7ipeDy8cqqr6UzMxMNTHDpyVdMbXWW/cwQtbXBnqLo5H+ChdQL2vlxehT6stisPRK4V3p8zX31IMaS6Rn4H3Rfmwk1tyN2dlUkTHGGGPsX7mlVF81W5dCodkVQk8XGG4tqC8Vxcm34mp3fTz0HqzWeiKySByiqP5K3ENqd6iPdYHwxS4I3xyH0O083jc8h34zbzbsuBJz0ym+XptC9Mc0vdLgFhIKzXqrLqU4fDHVB4LuQ8hMQ9B8YF7TYxiCcSFkFJIFfdovs2wo9y9F88E1EIxKITMshkyHwnPPWMi6heCjftEYvS2t5qxX9Xbajv/YYyj/VFJvGCsvJ5/oO9sPLfWlAVVCIeg4oce8EFwOr3v0qsf0cUzB1J7TbCB0vod+y1KQVy/2Vcz6Qw1f7RqkMfMx9j1MbPqh6277wpMfW9NFVC9H6CwOh2t87dymiowxxhhjkkdxFSsMN8RC6OtFkx8+nhCLOwnPbNLqnu0xWBaNNpqXG/c8TP/NP5iicPvWvIMRIW+aPkDvmXH4uB+F3G7XKEifQnO1S/ja7AIsptrUHbsSGfIqASu3QbTcfDW/5sOBvpDpedEkDdaRRFMOheN8qAyrh5JFSdOdZUE/Gy1GNKL9VEBmQGXqaRSao/COeTIGLE6vuGBX70zr/kMfB/hf9Dimqt+sHZGxHaz9KTi7QdDzR5clJVhyvTjEJrROGj2wmaLqC8UWV3YZsPBRZlvV27CYHhBF56a9YtYf6olbolWnfjvw7dAj5Qfss01o+14ftDksSqkvXYRphUB/cVJJcGYJd1HHGGOMsR+6gpt8RPqBnC+FS+lxhigsfVAHCiqPxx9JhNDJBiuPpldQoGgaLvm3uuZXMe2wu9hYIoq31t8tyXlvTBi01kXhrQH3IHyyEmrWd3Dhfuzdlw1WCaI4dMbxpPpmWp4UguMh06VtV4v5ITSblkJuXorXKSTLB1RQgEuHMn2W96uGytBayIwpNHdxwhfDYnHQti6L9vU/cjfzfxUdz3eWnYjZarzIB20t/CDoxqLlwCz0XZSCnY9TXnr0v/te6QOGzL6Zs/uUr5ui6BfRd0ZWK4r6Z+0aRxy/UTnCwz+rn2LWS1l0wOvQV8Nuw3Tu7Tpq67NpJ4Le+m7cnUpB1R4tTAMw67CPi6IqY4wxxv5XUUhQPhNSHfvB6NCmcCPoxaHjikIEVYtVd+NAYdoW+guiEVuMaVI4USz2m1SL4of772fX7LocEjjpWGzl1AupXuWiqLb8UmCk+ZyzOPkwcxUFql+920zb0SK0XNw05lAClHWdabtjINfPg6CZSu/T0ULqPWMibaxVGWT9yyBYFEHJvBgqFiWQmVCoNoikeo6wWhuH4/ZFp6i9txRNsz9YYGLplHn7o5Pfl4buNgyDYB6CT2clYPalZBc6120V1V4oODL+u7C4bC3Fxya0bEua3pW+C9LnrVcefDtu/R30HOaKnpb3cficf3JTxZdEbbXfci3J7XOLS5i/1/OSVDZkq933rw9zgvRD2d4zfRBVKxo0VWaMMcbY/yb3vLopxgcoXPb1gNDbDx+Mixf3hdXtDa0Rj6ouTEcH6zAccy96qKj+u0jBe//18BPvGR2C+So7ysziB1K5a3hC37tuQcObKv0KWsb8qGeFj/46CslqtM2GCRSEEyHTo9CvIfW9TGG6Xw5eG1uF5qNrIB9QDFm/YiiZFDWFasEkGW1GJmDg7pjSkDxxiqJZ9h9E5/2zg/ez3XpMD6Bz5Q7BNAitLZxhsdhe6pv7TUW1XyV9f44f9xhz6Ero6fkr7XOHjb6OeSuunZHmrb3nb/jOgDsQvj2JvuPv41FAzpimhV5BjSh+Om2bR92XVmdw6H7EsBKg3biT6VWy/kloZeiPBacSAmgbuJcNxhhj7H+RNOLagrvFicrDoyDohEPo5YvJpwsoP4gHJp8sqhC6P8S80+ll9PlDxSK/iup2o8nqeQGDyluZLnFI3/y4IIzqdVEUvxRatt02m8KsL8Z6QVCV7gQmNf34TzDNgkw/FvK+ERD6hFCYjobQLxkqQwrQbKD0yEYRVAYWU3kkeq8rwQr7Z94x/GjGn+5acOkGizVhaGZBFzxqD9Fa/y5Mlrkn3A4realeN+j8q0ya9H2d3oAT2H0k0nHxardQrSH7cTGicOD0s5lOrQydoNznFKbudQqjusqKxV6JT75opjXxdr3h1BOZ0mffLHGNyaZqurD0RJeZoTjnX/O4qSJjjDHG/ndIAfZ0xFPPj5ZkUvgMaOp7950xSXAoBY4EUULRtIX2vMjKS35FLxUwqT359iueHtqTz9VZzvHFyu990ygY/2JXcv3XRB/vMOAKLCceEa/fD1mpKH4uaVsP3cmaPf1QvG9782AIPVwhV6eQrJ6A1lYVaDuyHoJ2CpT6REBJi0KzXswPQzWbpaG5VSFkxhmQD4jCmLOVcMt5dlLRLPsvSKsRNWcfCUn5dIQnBE03CEYe6DjDDeuvRE1TVHku+h7IrlzxGr3ngM9mxWf55K1PbvaZao93B1EY73QGXcfcqT7pmvZKzzf/u72XIk/qz7qEbfe9raXPKy+knmoznC7IBkZAe2sxvDIalzZVZIwxxtj/hopGcfL0KxQ4TSloDkyDfEQcVvvU4WIy0ELTCR8PdsGZ4IYjiuovRAFGecGeyEu9J9rhsyHuUOppj/cMzuGiZ6aTNJ8CtPQsqlJTZTLrcMSVj00OYMHWWw1JaQWWiuLnOmab+bDLeG80p+0SerpDphkKoU845PrpeG1IOdpZV1IAS4ayTjSU9WhfjPIhkybTDEjDareyCMKIA2klEdXiDEWT7L+Ivg8dlpzKPPbV8EC6aPOjCx179J1uiytOyXMUVV7JF/2fFAm9buFNi4eYu9/vuqL4N6Pt+3jIwisNBhMuuErf7dgy9Oq/IxWChRd9zxwx9UAMovNqDRXVGWOMMfZPd8q70vbTqdkUBPIgDC6E9cNqeFBK6LYgHcIXjzHlYEp59XPuGP+7bZfDjxsscMXS87HXDjqJk9UWu2UIamehsSwMI7elPBi1xil33mHvwKD0ymFSgD7nkLz5qltmaF4lfnUY7YQG0WTQ7ngKyj5QNspBc+l5Zs0YCseZFIxzfugFRDcaMv0IyPToIkAjCTLtYgrMBbRMEFoaOmDk93FF8dWimqJJ9hex627e+p6zg5u6rJPp2kN7tgPOOCQvVsz+VZV0QXb4Xu6l96z8n8o0HaC1JJgCbcMAxezf5ftz4UuHzHbH95cjrkqfd9jkP35vpNTrzGO8ae2I4z55F5sqMsYYY+yfLb1BNB58IOOZoBtBobMAPXYCkZRoN/mWQeh8H70nJMMpvvZ7RfUXcomoHG0wzbaxw0hbOBaIu6Uy2/yaJR/OSaFAFIRmve0gfH4GyupXMetwBK0Fb9CkIk1NDbwA1fl8s216TGsLB8gN0iBoURjuG0chORVKVqUQLPIhGKRSmIltetREMIiDoEf1NDIg9AzB22ZeWH41JSehtI77Zv6LuuCbvUJ9vh+dP086t7awWh6CsDTxpR612HvJcbzaRAc63w5oPSwco44lutF35hd7fhFF0bgQ6KX4+FIWrnf26jPoFLZfje7xIAitxu2KKhF0H9AF2n2MORZTSG02/biVMcYYY/9Q9Mf+zX0u5VmtBodCMI5FK+tC7AtpTKIUENZ3SzJUet/CnH0pgRRA2ikWea6ySnHUrNVhED65DFlvF3Sdm4oVdwpvnAhsjO69vgZLb9VXTt+WlPK5pQeEby9BdYZLTUxxXWfF4r/qvG+ZR8f5URSqfKFkkAIl7TQoScFYTxoRMBuygaVoP6kBzS0oKGvHUB0ql55x7u2ND6188P3jQuk56+8UzbG/qPN+eQu7z/CGoOkElb7OsFgQkp5R9+s/HLUJyPpm1Gb3TCX1y+gwxlY8Hdmgr5j1I+n8X3PMeDxq/QOYTN2NlTtPHqCylxqd0tGz5BM961MNppPOxgBRzexiqvr1nhNAQf0WuqyKxY2kupe6uGSMMcbY31RcnjjGaHMxhVEKzpaRsL5UhxRRTJ1+vSJfWcsFQ7ckIKlKNFdUf6Hiqsbllx4VYdCqKLQbGAShyy200nHFeyZhWHjn6TMKKGoUwOVnPauufjL8IUxWeiG7tnGyYvEXuhhdc6TL6lwIVhmQ9S+C3DgJKoYxEHTiKCTHQzDPbQrOrUdUo5kZvVdPhlwjHUIvP7xl6YlN97ITaf1fKZpjf3HzTsfO6DJP+pGqHVr0Po8pG23z6fz9ald12cC3U3e65lkvv9n0PP2/W3fQ78ZnFhfQwuQc1l71STp547HUV/hLD+s+b3vgPq1RNrjwKKJp2O0td/Jc24+m77rJXQze51tRAnzSVJExxhhj/zw7HlXYvzMqDYJuGJoPDsONpKcZdtkNlUpmXvh0cCAuedacfd5/d/87KRRTCOlTBwxbfDXNo9P4exC6n4Hw9VV0neYp7nbM2k91lKlOj7H7Y7HwcEgSvX/hiHFUX+V6dM1Jw43paD4iE83HPINgVgVBKxYqliloNaAAyv0L0GJsA1qNa6QAkwdl4zyo6GdDUIum0OyH6UeS4mg9HRRNsr+Jo8F1k0yXeUDe+TjaaVzD0jNJVxSzXojO9cf0vWkaxEb6/kiT9L6sHr3Mpt9rEL46gb4LwzKpXtPgOtJ3Unp9GX6Z4kfDl7mXT9ji70fLydNFsZP2muBiQd8Brw9xxIZHKccUVRljjDH2TxJfLi4x35wAQV3qRzcABltzUCGKpeOPpVULfW5i6snUIgoXbyuqv7LzzlnDJ+wJyHl3kB2E7y7hwwGPMf1YVObSUzEFU9YGIziydIii6nNRUFlgub0YQk97CstRELQzKTiXQD6gFLIBxWg+sBLKAysgt5KGzy5Ci6FVeG1oBQSNKLQ19sWWB0XhUpBSNMf+Zlx9c8boW9tA6HwLXaf44qBLwQjFrF+1dMuhnvNW3Yw/ftZpufSZvgfmozbRd6jjNVgs9I6XylJT0WLjmofBi+afsnnZAL36XOg29dluWH0k8pb0edxpvyXtR8XQvyNv9J5hU2UbmP9FU0XGGGOM/TNQSFDafCMhoq2ZE4XMQMgNI3EhtgGeRUALncfoNDcINskNmxTVfzMpeG++ln3ty+GBjcJ3FIC+uITvLO7i4qOkPYoqz5Uriv2tv8+oENRdIdMNhcyQQrNeLpT7VaLVqAYoWRVDbi4NeEKTBYVry0Io98+Dknky5Lr+2Hi1CLR+VUVz7G/q9JPiYerT3RvkmpegNs2hwSOjZqRi1gstWrnTt4vGOixb87Cpn2fpu2iyLCahhZEdRm/1TJTKVq6/Nnig9X4MGLoyjf5NNJPKfg21037QyocRHQ2vYPwcu4H0+aNB+5MbZVp2aKN9EbO2PjqrqMoYY4yxf4LQ0oaBJst9IfRwhKAahi5LcuHQCOhvSYDQ0wZLrudmUZB46eGEpSCuePuL7KKfndeYHoEPNe1w/HZ+U5deL0JhpNPGx+UNypbhkJmnQKaXQqFZ6jWjBHLTUsiNpYCcA7lFHgSzoqbgLKPQLOiHoJmJD6adLGqsbBSbBqxgfx3S94SmTy46low+fT/a7oZTovsJh9hLRz3rhiXlVj73h6JHnMr7a813bhTUrmHAqiAxLKdunGLWc0XFplttO+SRdPpqyCHpM32nOpstiy6R97qL1ecCE2k7ZNdtg/raeaXezCx4teffD95IMtAedB9DZ7o7SJ9PemRe/2SEA1S630S/hY9Sqe3Xmioyxhhj7O+N/qg322qbFtbOjEJznyDIDGOxxrsOK1zLIPS+hc8mBONGVPVORfUXSspsMN+yN8J73Fzn5GkbPcIuOKRNlQKJYvaPqExl38PIvLnb3aspwHyjKP5FUt155xP9Wg8JgTCYAvKAKghGFJr1CiE3qYCgkwtBLYlCchpkFjmQDSyn0FwCmUks5IaO6L859mlgtThU0Rz7L6Hz/DZN0mA3760/ETlr1BrPrdP3hSTpTHYs+crSFs163oKg+RCthnnjq4m+0LC+VLLveoqOYvGfOXgv8tgnAx7Qd/QeBq8PhFdUXXfFrOcqr69WS8wubOrLOahI7NttPF0sdryOVQcD8mi75E2VfqMxC5649exvjznbM6Vh5b8YtzugSPjmCrQWR8MtU5ynqMYYY4yxvzP7rMaRBptiKHy6Q+gZCK2tOQigFKG5nsp63MXUkxmIr67/1QFCKCx8OXedd9Gb3a9C+PA0hA6HMHRVAGLynw5WVPmJiOJiddeY1F8dsrugUVw7cK80+l8Mmo2pg/KAWgiG+U2PaLSzFqFiSQFfPxvKFgVQtiqCYFkEJem5ZqNgGK6Kxgn73Jf6r3z2n0FfpW/3Poo9uvZMcOmcoxGVIzdHVL1veA3KalfxmtEDfGDxEKqTvWCwNBymW/Lx+ii6CFL3hqzvQxhMt8n0yHn+c/Wj1js/eN3yEeS6NzFsrZPU3fhLPV5x5cwFXeu5188r9zqA3hMdcf5h9i5a9hcv8H6p/JcsOOin/aXRGYxd7nRA+uwUUTa968QAtDLzxdIrGTmlpS//PzaMMcYY+4vafi8zUsUqCIJ2HOSG4TiTXIeLmbWQazmg47Rk+BaJL3W3+eClqIe6kx5j3PZor5E7I8ramjtCped5HHySG5rSIFrtvJputf1i/ITNlyIdZq20c4y1+aEXgxeJqazrPONEBj4dmw+hP4XjUZWQm1M41suAYJrf9OM/5SEUkvsVQ2ZZAPnAEqpXSkE6HWprSvAgsvq8oin2J5GCpmNUrdnyk2GHBq4Kchi6JrD2vYF2ELrfoAsxGwi6jvh8oi/G7YupWnkl6f726ynj7FNEneofuifsPuVCireyiTcE82iYbwyrDikXNRRN/8xTUfxq+rGQ9FYDnuBDq7tYuNu3aZCdF6F1vHHvxr27Y2YfDh+zwxa77VK2Kmb9BF0INt92xsNh+SGbG7TMr/5QkOq3HrjoVs6gKQ9rxVKxAy2jNGBbdIygFw7VuZ54Epr0q8PHM8YYY+wvLL5e1B53tOSpYBhKwTkYHeakIIj+4o84kQSh021MP1SYTB9bKKo/V5UomkxcH4fJO8IDpM8UIj4YdTTFtUXvi+hm7QLzucH43MwG7XUvQ/7tAcxb64+ystrPmxZ+gTmXcm3aDvSH0CcQMv0ECl3JFJqzIBhnQskiB3LTLMj6U2geUE1Bq4LCM4Vmwzh8OjkNu92qLyuaYX8C+p6o3EpttJ5yLDSg90xntLV6jHaWvmip44rP6Bx2s3aDxZKQ4pnHU4N2+4oTpe+IYlFpWXlVldgzvbxxvOXqkAi5ljvaTqzChDNloYoqz5VJ4dl0nXuC0PMQelo/xqn7JV0Vs34VrfdbxdsfUdnrmfWYNn5visN7msehM+EMYtLLTBSzX+iUbdI0jQl2WHk56ZT0ebtt/qbXJ8Six5IM3I2uOtxUiTHGGGN/Tyf8yyLfGhUHQdWbAqcHRl4rw8VMoK3+E3w9xBFPgqqafkj1IhQ0Xtt/tzDnAyMvGM5PyLgSUT9Huvt2IhI73hrqCuGDoxA+PY/WarfwvulNGM1zw8n7eQuksKRo4hfdC6862nV+BgSdAArLUVDWTYJMPZW2swCCUQ6UKDQrmWQ1dUHXfDggWD6DzLgQLcx8sfBKSgptw/uKpth/GB3rDgfvp4R2meAGQesB2o/1g8mOWKy7WxA9YWv8pu3nC+aHxBeNo3P+44iT9L5ZhijOdU57dnf6oZiSHpMeQ3N5LFqbJkDJsBithxfDYEl0cYlY96tBOC4/X9NgwQNR6HYBG84l20ltK2a9NNqH7+4HFy4fvMkuvdd0V7Qd4EPf13sYtfR+dURc4c8C9i+JT634TnXOI3Rc4NoYBXySUZb/peHWMLQfno4V959eUFRjjDHG2N9NWLmoNnhverXQ16vpjm7bCck4mA0Yf58NocslzD+ZXCOFCUX15/JKLN3eY8I9CB2OQFCzxdfjgzBie1zm4AO5ldqb0jDzQEzVtP0xKetuRj885JC53DdPtPq1YFNZJ3addjC1QcUsHIJFJgSTXAiaWRD0i9Biooi3ZwHK0iMZmikUrLMgMy2netKPBhNhtDkLQUXiIEVT7D+MviNffX87OekdrccQvnCA9eYS7HWr3VYhitqKKj9RJ4o9RbHB9FGOeHe5E9BtAV0c6brTuaXJMBRKI+ohH0oXQr3C0Hu6J+Jr6sYrFn2hE09SN3w58BJUpz7GTa/sl35Eh7b/o61nor8fvsob302gC72eu9HG8BQ0Zto2rLqSdNIrC7/6o8P/Q221HbbVNaTtoFuYeyK0KShbbo/yVtL1Rt+FkQ2HHeKGN1VkjDHG2N/Lo5i6W92WlFBYSWyarM7V4OEz4I1RXug01Qt3Yp4eVVR9ofseSRcmbLGr0l3o9rStpSOE3rYQujtRAHGB5sY8RNeIDylQvFL/yfsf5938YEAABK04CAYFEMwrIdOvgNKAp1CZ2IhW1rWQW1ZS4KJArUPB2oDCvnES2oxPwi7HEulpk9/VQwJ7Oa6p6D5hX2xaa807UO52B6bTEpMDU8UZitk/c+hO8SGL+cHotywJ6ivovJoG0kVbCIT+ORAGFdN5LoJsYB3enAeoWKRDY4FnbWpdXQ/F4i9E5/y1KdufeAk998B4iW1j+a/01iLJq6zrsvR717QvTG5C+PoK3h3mDqt1LlVHnmSej8mq6qeo9koeRjwd1HPCDfQedaFS+h6uup1+8oORwZD3vQ/zRS5ptaL4paIqY4wxxv4O6A/6JzucKnNbWlJo1k9A85GpOJsLbPSphaBxC6N3h5VS2H3pEfao7rsFovj1/oeZjtqz/UveNaLg3OkRhG4P8f4ILwzf4ZO3+7xbnntQ0l7FIs91KbBmUe/JgaLQ3Rty/WIoW9ZBZlENJctGtBkLKA2v+iEwG5VCZl5OrxScdaOhYuSDOVeyG4pE0VjRFPsPuuUUbW4x/+5TodNddJsUiFGbvKK9U8RPFbN/4phT9qDxhxLcP58QTRc60qh6WXSBFYPW5lEYeBJoMzK/qf9t+aA6CtHVdGFUjU9mVWCNTe4r/bjzyKNEja/GX0ZLg0NYdSFyqaL4ucrq63sNmnEGzb4+AO2F/thhX7ifvsuv1Ifzv6N/W7JVR728e4+ywRn7okGxxXVdBu2IfCb0vo3O46NwzfPpEkVVxhhjjP0dZImixqDDpRD6BlKQCYLBgfymHwV+MycA7Qxu4bRznqui6iuroVB+/nHeY6tFAWjR+xqEb85D+OoojGbZ4qFnygv/2z08ra6n1ZpwCD1coaSVDiWdMjQzr4LcrBBKFpVoPqAKMqM0CvtZkPWrhmCcD5kBhTF9X1huTqvNetrQX9EU+w+6G1jdR2PslVzhm+9htCgcDhnidvr6vKeY/RPSBZj1PqdapcF38eXaAnyxgsKxUTzkuin4fHbBs2RR3Df0jJjbclAtlMwr0GJoGc1PgNnq1OpIUXzl4ao3XQ980lZvN7Rm3S8qFsUuiuLnmr7qxMol3/u6JxQ//075q0osFk21pzk1mC8PsZM+H/bKudZ+nA+amYZg7pEkv6ZKjDHGGPt72OVSdeiDCYkQVN0gN3XH5VTAsbARQp+zGLQ+DEUNv/+ubUm9qLvtZkrM5yN9Iag9wvxjGd7S3TjF7J+R5h28lRqtoukAQTMcSpr5EHrnUrhPgKAVSROFLe04qKiH02salA2LKfSnULkfui7OxtHAZ0cUTbH/IPvwAh396ddLlLudwJB1CbCLr/nZHVQ6l8oUmEdfc64be9e/buqIfQllgoYXWgzJQTOLTDSj8/jm6Gq8NrH4mdWliuQeW0qftRj+lC6EyiEzy0T7YfE48LD8N51PWu931utsk1sZX8Kyi5GOiuI/neZU22LtOZEoThQ7nU0v0f5ivosoaHnCcm1AdZEo/mr/5Ywxxhj7C6Bg0WXCgex6QcufQqkLvl4UhSRRdJ99Pq72Nd3L2P0w115R9VdJdxPPXkv8+MjZyI/vuGf3LBFFbSr7sX9met967bms/dN3JeN2YOUiRfEvKhNF1RHbkuubevjQS4ayQQFkGpm0jfE0RUOmTq9qUVBRC0FL7RQo6xVDZlwEaRjutfeL06RtUTTF/kO80hr2G66Nrxe63YfJzOC88IKfD2OeWyvqb3qQ5TBwmQ96jwnCkM0FmHZRhKCRRBc62fhh1MdcyC1LIR+WB2FgDJVF0FQImUUlhJEZ0NgQL2aWP/3Nj0xccM82/dDye3SZcAX+JeJzRx/8T6ELB/lZl4JznYfbYcnRoB30WWnw/sBswdQLvTdlYbt3qYGiKmOMMcb+yqIqxa2WGymgqEp9N/th+IUixIli6HtD7et6TbRDaE79NEXVF3KMqtw6fFPI044G5552M7z29Gur+6LOEh8sOB2W6JdauVBRjUJE2RsOztFjYwsLXzjgyQGH/EcfTaCAbEABWTsNgm4aVIyyIddJh1w9tWkS+sRBSTserfXSINcrgGBShK/mZzdciijlXjT+wx6GFZuarPVvVLYIwYjdNYjMEccqZv0opvyp5cSTUbXvjvaB0M0Bwtf38P4QP4w48RQqlpmQmdC5HFaEYTdFvD9FekY9D8pDMiAY0vk1q4LMKh8fLE/D0idJhXQh1F7R7CujZd+csvVmaoteuzBosav/He/KdxSz/jQUll/v3P+4qL/8fhVtz9tzjnp///ooX7w5PwtzbyXvUlRjjDHG2F8V/TFvdtG/1ubLMckUThOhPDgLi90ascK5AUKXixi83PVp9b8MTPE8/vHlO60WekDodBWt1L0gfOUEoasjhfH7NF3C4DX+8E8s3qio/qt8s2u0+m8MeSYzlu42S0MuU5DSSkdz4xzIdSls6WVAJo0WqJEIQScJMm2qoxEHwTweM87nFdJ+qSiaYv8B2U8xcPQK37rXel/D+H2pUdmN4mjFrB+de1IwbMTuuPrem0vw/uRsCN0D8Ia5j6i3OatebhwNJZMkKA8shKx/PqbcqMJ386XBanIhG1QG2chnUBpSg7ZDkrDCtuJKwm94tvnfPfQvm9nV6hI+0TyImavvT1YU/2mk/22ZttktSnOBD86Hin1sCsU2o44nlQqWTjDd6FudkVH9oaIqY4wxxv6KpD/m804kV8o0fCCoxeCD6UU4WwB0nBeH5r1vYvPF9IfSfysrqv+iujqxx9y9Yfig312M3BWVuepslevATcXFKpr+FGYpTPeyg/DpGczY6N1AdV9qFLcdDzId37SwhaAbRKE4BXK1lKbBTmQaKRSiKeTrpEHFshDN+pdCZpxH4TqByn1gsCYVrlmNE2ibn/vsNPt9Emvqho/aFfispao9Rq7J9KJj/ZOu/ug71fKCfflty+UxUDYNQevR5ZAZUXBWz0LvZVmVZaJ4a9iBMrpQi4dgKj2qkU6vdCFkng0VKwrPltUQBjVCMEiE+vwwJJeJfRRN/y7SxdS0VXZXp6ywx5zVN0Yoiv9UOy/Gb+oxxhU7bmQ2jWI58Wz0wdZDnfH+AFccfpD5szv2jDHGGPsLyRdFE9NV8U8FNQq4akEYfLoaKz0pCel4QHWCH+4FVP3qH/NzTpmbzdfGYsXDioMUTlpJZVdCag4O2ZKD2cdSQkdtSc54S+0JvjJ1wJmHdeOaFnqByDLR1HxNFIQejyEzTIKSXjbkfSgsq0o/XqRJCs8UnJWMs9FM6l3DLJ/CcyzaDvTDltsZnopm2H9AXFap4YRN9s+aaR3C+EMpKec8SgN2no/58bnm5ALx63WHk+1HbkmD0c4KCH0joWRFQdigmIJzEn2vvMQFN0pqJlyoa+qT+90xeegwj+YPLILcMhPKFkUQLGppKsTnUxKw61a8269duL0Kqa3kfHHoDZ+MloqiP1VwVNmX35qeK+s3zRHSRevcG6EbPhvrida6AZhyICaRtu/HkRQZY4wx9hdCf6RljyPrz3SflQShux2+mJMG12rRfdbDuhRBzx/DN8RQrv71xzQW7guIHrs/HrHiD/9dnyWKH+++l162/GiEi/SZ2mi/43qR26cD3LHtSsIdqex5qO77M48n5jfXd6UgHwgl3RQo6WfRaybkWmkQNClAa6X+EJ7VpCAdTWUx9N4DGstC4JleaaRoiv3BwgtE7QkbE8Lf0L2NAVv9b9K5ajPngI9d71EXsexU+Hi3zKcW5guCq98xsEczCzcMs3mGNqOzoWIinT+pJ5QwqAyIRPNhcRCMQiHTi0f/Y8+gt7uegnU6BHM6r8aZkFlWQG4YhnU30ippHR8pVv+PMX6164Mulo644lo10T83fVjPsT6Q9/CF8aZwsZh/0MoYY4z9da09m5SurO0Eoa8Thp4rbKCgMtfoQH6sYBKAmUeSnRTVnovqtzQecz2h/yo7UMoZI5Ud9awZtfp6MVwTSic2VSIU0l9XXehUv/lWWLqi6BcFF9Wv7ruEQlZf/6au5VQ0kqCknQKZfvoPzzT3pZDfJwFKGmlQ6psKZfU4yCiQtaRAtuJevq90MaBoiv2BAuJqjs3ZnYivhkWjnTZ9N9bnb5LKi0RxSPdJj9F5rBf2+tQ/U9K0pYDsDuWxmdA89xSmBwur3jT0g5KqCz6clYdVXg3J3Val5ws6gZAZxqGZMYVlA5pM6Nya0rkdVAgl8wIM2ZojBqQV/iMfXbhkm7JOfUQARq+JOibdAR++NLlS+MYb3y11FO0ysucqqjHGGGPsr4SCbtcBm9LLhJ5uFF4CMf5SYVmmKB7rtjzl2VsDA7DvcclKRdXnqq+H1sqddvjcagd23wu7K5VtP59yzHxBELwyxG1Nlcj90Nor6vPdsdMm+pCi6GcoRMg33S29+NaAMAiqIVDSSYay9MM/qW9m3QzIjXOhZEABSzOJytOhopNBdaTu6QJoIxIQVSouVjTF/kB7bucssljogRn74gvHbcreOHpDbH6H4b6YcDbrwi6/ert3hoRBrp+M3huA5gOS6XzEoPf6OmzwF6/ROR02dksJhC8ewvqyiHhRvDzrfOr5tiMT0aJ/+g8D2QysgWBcjGZDCiEYBUN7buQzlxTxv/IM8p+BjskbRnN90oasdKiQPuvNj7omNwrFm9auWHkrivseZ4wxxv6KHNIa1/dZnAOhZwBkJpG4mwrcShch13aE4fJkROZCT1H1uaSwm5JfZbLuuP3DBXudLoii2H76hsB0+VeH0WeqB6YcTPKefzTJ22ymN8av86ryzRPfVSz6M9TW60M3RpVIowQKqmFQkQY40U2kUE/hWDMVgnTn2SgDMn163zTQCYU0DSrTDcSSS0nS86GvKZpifxCH8JpRWtPoQqbHQ4zcm9w0eiSd4459NySIrftH4A3zeDpXUZBppqC5VRnk/cvo3ORgwLa8dOl8PBVFiyHrCyB87YLplwvCj8U9uxJG4Vl/DV30GGdDZXAj5P2qIBjm4KNxubBaEfp0y+WUAU0r/wfbdDPCW33yDUjvVz3JXvn6uHA6jk8wcl/806Ry0aKpEmOMMcb+GijUKG28lhbW2twHQu8AqC7PQbooho3YnwChy1WsulmYSgGpraL6SwvPEq0sZ3tB+Oh7CJ8fpDBwHO10z2Pkah/4JpX/+OjGL7kdUjaq42iXZ03BuXc45H1jKBjTpJkAGYVnmWEWBP10yKXwrEfBWTOW6gXiizHhOBdSw3eb/2D7nbJGak24ldmhn12j2qygujdNr2D0iaALV3MaZ3SfFvZM3tsLzXsHQalXJJppp0PZkC5wtOn708sbfWa7Sc/Hv+9eLJp2nxoJ4VsnWB0oLul3vLzCfF8eOs+lMK2aC2WLaroACqcrplDMu1QRUiWKJorV/6PN3OM6t/uIc9h10n+QdJzMt6c2CjqOeHO4BxaeCfNWVGOMMcbYXwH9se4z53BCvdDXGcpmiVh0tyY6qV48/dEoF7xpZYfzfrUHFFVfSWgqPlt5MMRPdfiVavPZ9zFirX3JxvPBjoEFoqWiynNtv5V0r42pA4Q+gVBST0BzLQrMOhTEpD6ajaTQnE2BORNyQ+mucyIEvWgKaQ4wXxEoDSjxjaIZ9gfYcjxl+xeWDug51hn2CU+H0oXWe71nPEpp1z8Q38x8hpa6oWimGUIXNxGQaSfSxYz0yEwcWg3MwHezIjH9eGQRnZM3514tHdp1SSHeHJaEllax+HBRKV0MhdE5zYfMsh4y40wM3l+Jo36VSZS0uylW/4/nEl5oqD7m1LMBCy89lD4vu5HupWJEF4wmPjDfHJNKx7updxrGGGOM/QXElmKC8WoKpZqeaGedhw2e4iPfAvHJG4NcoLsiCKFlPx/Q4lVQaPqIpkEUAD5RFL1QtSj2nnYsvlFQfQxBPRpy9SQ004iDsl4yBMM0yE1yoGxcCEErs2kQFKWm0QQDoKL7EHMP+/ormmF/ADu//P19htjjIwN/qI0Oqz94s3DW41ixd781yaEt9ekipm8RBd4UOi90Dgzo/Jjlo8fuOhidrcWHK5/iTpXoly6Ku0bti77cb0tSwbTHQBcKz0LfECiPKIR8eCVdCOXQuYyExrJsOGU8uyE91qFY/f8E2l/ZmDV3UjVmXkd6mdh7393ova2NnSFYJkBjdZLomd7QX1GVMcYYY/9tRx3L770/PILCZyDem1YA53yx+LRfcalM8zasNkVIwxu/sBu67JKaT/Zc8fO75JC6mkLAT/rZTU2t+C40quyVBq24m/hsR5eF0vb4UaBKhaxPEuSqsRTspTvLSVCxzEfLfhU0L5tCcyZkOlS3tzPM1sY8C84qt1I0w34nm6jKIyaLoqE6zSfDP77hyMg1sZXvaKeg69gStNGPhrJ2COT6cRD6FUCwoIlCc5sJlTC8KKLf9XoKfjHoNju+QX1eZEM7Uxc6X47ovKIQbQcnQ0kzCi3Mc6FkKd2ddkGPOcG4FlZ9XgqRitX/T9l6J21bl9kOMF3lYHnzUX73r8cHikK/NPRYnoHj7g2/+j80jDHGGPsTUCh+e8qetDgV/UAKn/7Q2FSKGlE8veRcYr3Q8xJmnEmLUlR9Lu/k0g3qY+5BY6wTDt4omqcobhKXmD92w26X6mlLLkVdehA6XVH8QkuuFQZ9NofCslkCBP0CKKmnQbmPdEdc+hEgBTXdRMgM8ig0F0GmmwZBIxiCmivmnEouoP35rwxm8U9z0i79VOexbhC6uaDvhvJ7dFw7zrrTUCJYldAFDZ0H4yQ65uF0TlIht6xAizF0xTSkDs0oRL89pQbKpnT+ujtB6EwXPz1DoawbjhYDaDltusjRi0MLNboQ6hFN5y4EX49xx3qb1OOKVf+tUfB/Q/H2ldyLLB/bfb6jOP+wizRwULOvpsZGCQPz8ME4P2y/ETJKUY0xxhhj/00UiL6ZeymfAmlA04/rhu/NQokoXu25KPBpWwt3zD2Tv1VR9blWXCja+fFAClGd7qLrGEdsvFe4hNpt+jEhhQD5I9u4WVrmR9B9wFk8Cv6hz9/nyS8TvzRdHVPYwtAbcsPEprvKco0syLWk/psprBkmU3CmV70MCs4U4jTTm+6UfzUpFHue5K1SNMN+IzpvHTZcKb303chwdJweix6L8tDOMrRBY3Ek3hgWBxWLOMiMYprOg5JuLuTaRVDqX4nXpwDKg2voQicPrYbUQkk/AzINqkshWU51W5hl4c3h5ZBpxULJOAOCagTeN/XHhH1ZUfvsC3YrVv+3Zued/e38lZczTUfuvm3vV9pBUfxSpMBtssC9ft7xsDjp87ANyVFKw3PQYnAE5h6Os2uqxBhjjLH/ruwKDDTfSQFVm4JzVy+svZMHvxqgxSBv9JgV12AT3zhSUfUX0R/8VpO+D48SVF0gaHhB6HUJ3433xcrbFX4Uwt5WVBMW7Y680mnkY9iG5DxSFP2iQ/fTjr9n5Q6hiyME9UjIdXIg06Fgry/1pEHbaUFB2TQTytJzsXrFTX3+CiahsFwbIQ1b/Ephhf1UTIGou/hwROlbUu8qXYIx3QZY4y1C0Amj74YPnYdINDdKosBMoVknA8o6FJy1suicUHgeUkXnIb+pL+aWg5+iWb9KCtgFaGaaArlRMgXuArw2qJLaSqLPcWjTPwHWe1Iv0fdHRbH6v72VB5z0Pzfaje7Db8E2smymnXvGnAuPQ1xt/SJ/tXcQOg6vTV7nVas21SVC+rztbOqNVlbxkPVLQL+1UeX03f66qSJjjDHG/ns8kqvPdZkfAkHTD29ZxiKoCrib3QjBwBETDyRX0B/01xVVf5EoVn9oMPt2tcHaMPTbkVrVzswZQscH+GhQPFbezQqjP/hNz0cvOxt5uO/sxzjpmNuvacFfQOtSXnIi2rWVoSuU9cKhopcEZf0cyPUoPDd1QZcEwUwaijkdzc0LITcshIxeBR13zDkY2VjLwfk380oVLfrP961spf8ErQYG0/n3h9wqDs2HS4/LRNCUQRdXqZDppTWN2iinCxeZAV28UIAWDLKbBqURdDPpYiYbr/WvRHPjIrroyUArsyzImx6noYCtlwfBiC5++tph9O50VAO9FKv/2/LxyWiZJ4rv0vdcmow15jpXfjHGF0F14gnNyQ9y3tPZilWHrrxwaHkJffflfYbfOaY/37MuprKu85i1Wf3fGRRJFyMh0FuRCM/4Bh4+njHGGPtvuxFWefyLqRSce7pBbWEBigG3Ha7lFYLaA2y9lVVHf9DfU1T9Rfed0+b2W+guHnWuWEPB4ctZJ1Ni2hm4QPjGFu3NvbDoUnY4lZssPhFUpDPfDpEVoqZi0Z+hdX07dmdwg9DLESraMWimnwK5djqFLgpe2skU3qRHNCjI6cSjuWURlEyKaV4UPhoegEvepdKQxXJFU+wlSGHPP0Hst/1slH2f4ffwvokdxuxOjr0R/uyi3ho65nohUJIuVjTS6VjXUgCmY65PFysGUgDOg8wkF3JTeq+eQmE4BTIdKSRn00VPDpR0KEyrJUFJMwFKxnmQW5RTnTha1g9DtkTBLrLoZz8k/Tuauezc5H5Trz7Vn/WkZsetnJQJZ6tzVMxD0HN1fGObgdcw5oBbrW1w+kv1ijF2Q8jmr4Y9wes6x7ukVIrDe8yXvu9e6DQ9Gk9iyy4oqjHGGGPsv+Vmct2BzouyIPTxweBdpagFdgw/kZatpGWP9ZcyYyjcvPCO87Fz2cu0hj3E9D1B56XPFMY+PPg4PfzLwc4QvrLD+wNDMHhLDD6wvIdRG0Ok9p7746liUeykvzSKQrwvZOoUsqReNDQpkEnhWRoZUFt65jm66dlnFYt8qPQvh0w/Gurzw+GZJ/ZVNMNegM7PO48CqgcfvR19d+DMe7mqwxzwbX8XqI16jM02BYekMH3Gs+Jyt0mxaGuQgDf0iiHvXQxlozq0sKxHmwH1dA6kO830nZHuJOukQomCc3P9bKgYZlNwzoBMKw3KhlSnVywE1XDIpX62DRPwzth0DNqakh5Z1DhfsTl/e4t23DPVHH3mWXvjS+i+MAFfLKSLOaMoqIxIxTKXulg6nl0VVX/VFa/cfZrTgrD4RMpYWu7tvguiCgUdV7w3MgRbHhRdVVRjjDHG2H8DhdhW2+zL3N4cEU1h1QNTTxY01ouis+q6sMq2Zl5YfirzmKLqc7n4lswyHXMWeqNP48L9kKYR+6jd944+zg1+39wfQpfbEHo/wps6djhhk/fCHznZRNSs/25mKm1LOGRqiVDSolCmn4Hm0p1NQwrP+tKd5xgKy7GQGadDbpYPuWUCTJYHNpSJoqqiGfZvpLDsHlE4Y+XhoC0G4y7lfmd2Dp0HOKDXMGeM2RAecNa7TPrfgpk0qS66UGz/8aBQKPXyRVv9LCj1TINS3wLINfPpAiYPylJPJprSqIAZFJrTIdOhkKybTlMaZBrSYxhxEDQSKCynoZlZDlr2p+VNw/CWhRe2PayI+yc+TnPYNf89/zqx0+Nacc4X82j/9aPQYkghukzPbHjb0NHfeotj+H3vTANF9ed6FFVm3WuUD6xXB7pIny3XhWQL2k5o3i8ABssCb9O/K/4fFcYYY+y/hYJS+5EHExoELWlYa1/MvFgUly+K13utScK3Y0PxMKbuhT8MlNAf8xbXXbOMNh94sufWfe/limKp/K0jjwt9O432gND5EvTnxMM5VHzuMNu0Lc0XnwoPU9b3g9CHAlgfCtAaKWjqu1kaLVBLutss3XWOhWBI4cSY5uunopl5DOaezwqg9SkrmvqfRsdBhaZvz3kXfnvwfpTB5ksxNlZLnjzVnPoEXa0fQWfSfUzdGpa753LukahqcUuBKFqe9i1ZY70zPLz3zGC0MQyE0D0YyuqZUDIqhrxfAWQm6VDRzYJMPRXKOhSmpUdnpHMkPZ4hdREoheU+MRDU6AJM6i6QJiXLXLQaWQZhaCbeG5+I9XcLpOfdP1Rs5j8GHWtZQnrtFzsupTzuO9+3oMP0GLxGF6KG23OqrPdmpL1h9gAfDzyNuTvu7Vcs8lzuaeL7PYa6Qsv6AV2/il2n7A31k2s700WiF0bujqipBT5TVGWMMcbYn61MFHurL46rFfoGQKYfjF2OVVnhomj/2YxQGC+Xsig+V1T9TWj5dreDql21pzlj3Fqvsog88V3FrJ/xzqhXHbAhQVQ2iEMLy5IfRpPTkfr9lZ5t/uFRDbleOgXlNMiMpB8IUiijz5+Mj8FJ/5pFimb+MejYvfH9jWKzVcfjriw8mXB/2bnoI555DUZU3kxRRbrYeJMm4zuBlcYbLgduH77B8b7eZNcw4zm+UJ3oBtUJj6AxxxkGSx5nr7gUd856a4Iu1R9P09INT8rO6K1OKvhiZDQ+HknHWCMIQo8QCr8JUNaV+sguhmBailYj6qFiVQIZBWdpMBq59g//CyCnc6JCk7J+JlTMyujc5EPFpBjNTIqazpmSOdXXjoHpmgyc8qq6S9v9lmKz/1Gk8zFp/oWS5t8cQN9JrrCJbbjed31eQu8lyWWJomg6/0z0zDNP4h2OX3fvqVjkuei8vDt4kXtW92FuqALeG7srdcFbg+nfpkkgzDekiAm14heKqowxxhj7s0WUilt0V2VD6B6AVlaRuBddXxtQVl/T3OIhJh0Ib6BQ8K2i6m9GbbSwjayddeJ25FhF0S+6HVm7qc8CCl8G6ZBbFkCwzIdgIP1AjUKyYSbkUq8aFJRVTFIgozoy8wYK19lQXRSLO1FP/zGjBUrH62Fw/vLhG4PTO431wzv9g9HOLBRv9PeD/upo9F3gFWu4Mi7UekdOqOmMwIz+09zRY5A93lK/gfZaN6E9xQUj1/iU9lsSev60c9KhkAJxCgWyj2nq6pElzrTeHBGmScH6NdNACsoBP/SDrZELGU0qOnkQ+tLx18n64QeA+rlQMi2j94UUhMshM6bzois9MpMJZbM8qBhnQ6aThFbDa9DSGmg1Gmg5tBGCejyF73gYraxEWK74kwFx/mnofMmsxh+asWK/c+Vl59T9dJz7aswKrFLStofxQqeXGvDnX2mOfnL2y/52WH028eMjHsWLPhtD58goGN1nRjQedSz7XReyjDHGGPsdzvo8Xd9lbjKEXn74alYmPGvEY7scC+3eGOqJyYfSH1Eo+NMef/AuaFyrvZSCWe9ICFIgs8ilUJdAQS2FQlseWliVoiVNSkZSTwMpUBnwjOplwGRdbH1Gg2iqaOZvjY53q9veubaakx0hM/OB0mAKqcZFFESLINMvpNdwCKoeEPq4o7VVHL4Ym4Seo/xhOCEgc9zK0OQD14rdUyvEwdRO011pem130a983PRdcRGao13F7pPTINMMpfMdBiUpHEuDl+hUQta7GHLpOWapz2zp+WWtjKZJRsFZ6l5O0M1Gm9EimlEolhkV0zyqY0T1aRL6Sr2cxEAmPdIxoAKCeS5amMdBf0FS+GmXhiFNO/Y/QLpbrHhtPnO3b5LhDCecfxx3uWnmKxg0z/PqpxaPsP12yrqI8soxX43zFgVdf7zdz77xK8sb/7hHXRhjjLG/jW0Pa9Z+O5vCmao3ei7LQ5gonhpzIiq5tYUDVlzJvamo9rs4xZT2XH348aVVe6+8sEuuOReKl75rFQy5bjJajaiBytAyCAapkFvkQTDLofcU5jSlZ52lPoWTIDcvh7J5KizWx8RJd/0Uzfxt0T68fieoxqnLqDAIXzpBuX8+mg1pgGAh0j5XU2jOQHPzWBiuS4P1Vt9nI/ZG3NzjJY6IqhaHUlhrrWimSWq12HevTda9wesDGr8Y6Q0ldTcIan4UlDOhZFrbNKkYVlNILoNcqwJKGqVQ1ipCC+NyOv4Uhvuk0Hci8Yf+szVSKUDnoOVIETKTajoftZCblNPFTAWaD3yK1wbUoLkxnSM9CtMGaWg/IgUj9qT6J/zL4Df/azwSKjr6JjcMkUK0ouilLT0cue0D4zswWuB1hL4TKl8Od6kSNHzwxSh/0Skib4aiGmOMMcb+bGtvV2/6bIbU364XrPYVoVIUz044kxj78XBvXAys/NVBG36JdLczsbhu2IZTwQvHb4r06zriTqPa5PvYcDbwxx8O/jtaRmmLTcWldkOk4Zgz0WxYFQRzCstmWWgxsgrKA4qh0r+oqacGwSgeygMpVEp3n43DMOt4coyimb+1m77l9/pMiYXQkS4Mekl321Oanhtubw0oS49I9PHAl2Pdn2WJYn8KZF8qFvsRlbVfeNRn1PBdqY+G7qrAu4MjKWx70hRKxywL8v5VkA14BtlAusqwfAqZXgFkfZMh9I5vGqhESZeOqWkNlE0oSNM8Jb1cKEsDm6gnUmAvRlvaDrllHQXkImqvBErSc836+XjNshqtNKns83C00E/AhFN1jnQ+Wyg2i72ikEyxW8+xdpi41SuFjuO3faZ6lQh9vdFxUhwueRUdVlRjjDHG2J9Juht21bc6vt3oREh3tEacyGtsEMWtU0/Hp7/dzxEHHQruKqq+kBR6a0TxY6eI8jEHbfLWj1jlFqU33QYfmF+G8A1NHx5Bj2nuuORb/9y+e2lbWi69llQk6HpBJvUNbJYDleHlUB5aBuXBJZD1z0cb61q0H/8MSoOyIR+QgxaDS9HM2B97HqakKpr526H9ficqp2HojdCn7l9b+4hCp8dQ1oxAW4s0fDaVwqtJPFpZFKG5CV1EUAj+ZIgrzvpVXaPlpFHqPgzIEj/2iC2ft2h/6i6dSR75H1u4Qq4dA8GUgrYJhW8pGEsj9mlJd4RLqKyajt8ztB5aj5YWBWhumAkZBeOmvpelHwPqllFgL0BL8yq81q+yqVzQiEUr8wK0sKSLGZ08Oj+5dNwL0UL6EaDUs0b3WLw5sBjfTi5AO91gDFsTc5O27X2aPj75JH7poj3h107aFS1Q7DL7FfTvqZf2DHuMWO9N/6xENbNVPkVCD098OSYBq87m71FUY4wxxtifSboreN2/Jq/V0FgKR16YfDkX4U+fpXw50RZvmT/CSYf8B4qqz3XgTMjbszc9sjcce/1pF4vH+FTHG8LXthC+ugOh53V0nOyGnnNdYLrGE/f8i190x1lmuiEoQ9Dx+OEHZxb5aD6+HkrDyiHop0AwSofcPAfN+hWi2eBsKA/Lh5JFNt4dEoUNl1IOKZr5W6Aw1Pv8w8SNmy/FXpi0J6Ko+1hvvG1FYbejCwVRe3SfE4EVNoUeq5/U3Ws7LJ72PxUqJjVQ0s6HrHcYPh4Qi2F7k+rHHUl62mmMy9PvRrqjvXkQlNUiIKjSsTJJQ8txpWgzsQ4yo2y0sCiHin4h5GoUpg0rILd6CmXTYsg0kn6426yehRbGFKiNaB2GVRTSK6BkUARlaXhsVdou1Uio6KVRIM+BXCMNKtLIgJopaK6bDlkvmv9dMLT2lEIa2WbgpkS07XobU3emPR2/J/XpF8P88JqmD76ysMWMHc6XqIqK4jCw5/AvFHv3nmgH1eku5dJ3ZcLukCJB1Z+CczwO2RZwcGaMMcb+G6TgfNGrMqu1uS/kFr6YeaPQv+CZuK3zzCB0nhAIr6jG0Yqqz3XVOcl64HJPCk/HIXxxF0IPP3SelVpvuS+jznhLFO6kNS73BfR2n3e/4uYb9dyeL56K4td6KwKKBRN/KA8sgNyyCIJBDgTdTAjqFPCkkQMNsiB1PyfTDaKQFwVBLQZdJ0XgfHDZNEUz/zUUcDr4Z9UN23I6Zdhp55phcY0Y9lR8Okg6xjTJaf6Hlx2q1o9YGe07ZFU4vhjmhdetwmjfQiiYekHJzAe9FoRg1sXkmAdZjbNoGdkpv7Idn4xPRmuLPAq0FIL16yDXL4CyMR0TKzo+llKvF4nUBgVmnUQKtmlNPWEoj6vHGwsa0eMAoDy4AC2GVKLlyGdoNbgBbYY9g7JFadOdYmUpAOvSMVZLh7IWhXLNPMh1i9FmUD1a9X9K7dLx1pB+JJgNQfrBoE4uZBSmZRr0vpcUuik8a+RASS0NSnqJ6LWkGN8sqsU3C7Ix9l4NWo8uo30LgUyV9rPjXfQadQe2ETljFIeMPUdSmdhbdcJ9qM/zkoKz6rxDsaWCqh+6TomGe1oZB2fGGGPsv0EKdVvvpmdJQ2u/Ni4O0+6W7WwUxXGqixKhPiMUMcWiuqLqc9Ef9rY3AqpWjdoU4tFtsh86TE7EpQzxXLQo7l32+Blskyu0FFVfKKm+cabJBgqARoEUCCnM6VMw60vhWD0WStoJUNZPhmCYAnn/bArVcVA2osDYMxZasyOfRdfWTlY086ejY/jerutprkYzPUt7jnTAx6YO+Ha4PwxXJMBibSI6jnZKNV0Skmi0ILzw88GBUFJ1gvQ4htDxIQVRb3w3LxtDD6RXTT2XcypNFKUfk7WmNps5B4pfzDibmdbGIgLNjCmwGj6Fcj/px3l5aD4gFyrW9H5gXVNf1tJofnJdCtGaGRSqi6E0qBFyqwq0n9eI5qOr6ZhmQzagGm3HAy0H10JuVkQXH5l0THPRwrSYjnMalCkYK1MoVzKhUK2VQwGc6ujRBYxxKYX6iqaeNKQeNJSNCmlduVCmeVLgVuqbCVmvVArHadTODxc6b04sxnebaqE8hD4b03kzoLYN49Hc0B6DV7vE0/7xXecXkPpW15l+H5+PdKmgY9V92fHkLKGbG3rMjIFfQe12RTXGGGOM/ZkopDWfcjAqS+j1EG1HJWGWTcW+clGc1HNBLEyWRaKoAUaKqr+K2mr5KLxszcSDIZn6S/zxoYVDTffp0QhtFF/qDmNIReNk3VUUlPVCIUjP8+onULiLgkwrEs10YyisxUBmnkrBOZ2CdWpTGBTU4tB1jF8BBY03Fc38qWifP164NzTyTWNHCF0foc2gYHw6OQztBoWKgg5dBBhmQjCVAqU07LgbBWYKzd0c8JapJwzmBmHS93HBPtXidGrHnCbtq+FF25deKbTXmR1Z0W1MRF07yyA6HtEUXsvoAoIm4xqa6NgY0kWDHh0L40KoSMFZnUJzL7qg0ChEM70yKBkW0rGiQGyYDaX+RXQssyhw0+d+TynEFtKyWRRwpbvJaXSM6ThqpNNxzoCsbzq1V0rvaR19M6hOftOrXDsXr/Wrgkwnq+nZZkHqZUMzHXLpTnSfFArNKVCW6vdOhEwjAYJq9A+9n0jbKe3/iEbIxgCCVRY+sg7Fuis5aykQtlMcRvZvCkVRVXvqHfqe3KmT/l0N3Zp1SMU0FB0mROOke9lZOnZKiqqMMcYY+7PQH+Xm5qsDsgQtZ7w1OR9bvRv2BZSKk76ZEoQhm+NKaH4XRdWXRsu0X3U5daXhTHu8Y3Yfk46nlQzZFmi38JDzBvqD/9w+oe3TGierLaKwqRtCYS4NyuZFULGiECcNtqGdQuUUlk2kPo2T6ZXCmR7V7ekEq8Xe9dTua4pm/jS0zs8WHk2IfUuXwnCfO+i8MqpqbWjNMidRnH+5UEz6egWFTwq9rw/JxSfD4tFpcjLM1ydVrb2eH3MpXJz/VBTXJNaId0445l/tvyoopvsMD3w6LgJt+0uhMwLNLCiUShcPhrmQWzRCblADJat6Cr/FaDu2AM2kIbBNivBa/6dQ0i6h0JqHFvqVaKVbDFmfWDQ3yoCSQTqUTfOgbFGGt8aJaDtGhJIx1VWnYykNm21Ay5iVNHU5p2yQD2V6le5aS8NoCz3jKABT8O2TRGE4De0GVENZJ5NCtGJ+r7imsC0NniKj4K2sTsFbNRktjHIVownSOvqEQ077IB9HgX14NV30VEJpQD4+sY7C2ANJiQdcc5bQcewlHc+rASVWy4972F12jh3VdID/h9G/od79F91De8PLddLnMftzv281IJi+D/ZYeDyylI7ZG00VGWOMMfbnSaysG2662r9B0HTFOzNLsTfw2b7TzuWTPh/vjz5zw1wV1X6TfKD7hktxId+MiYLQ9QQmbHGlv/d4XTH7Z4551k3uOjuIQp0zlHQjKDBKd2vzKeAlQ8U0CyoWaVDqn4A3Jhag8+J0aM73q5v+fUDRgZsxB6QLAEUzfwpaX9fVV5MS2xk60L754bPp6QipFkO2+1buVN+emvXFfD80HxCKjnNyatfcKt/ukVSxLqtRnFEliuMfxdbHTrma6a29Ian465mpeMOMLgbUKRT19aZgFALBIAaCOQXSftKdYtp/fQq6ehV0PCopeNZAPrQKn6wE2ltX0nJJkJuVQ25M79Uo1GpKQ2EnUWD1h0wzHCoGyVA2yaOLjhy0sCynY1jyw6MWUkCm4Nx0x5kmuSHVoc8qJhSeDei4SxcqGhSa1eKoLgVjnVSo6GZArp4CuQbNU42n9lMoaFNYbrqwkfaBgrwehWa9LDSnus2kIdI1YyA3SkILK+kxG1qmP23rwFoIAwshDE3B+zMSoT47vLHD0PDoLtMj8ablbRgtuB5E35M/bdCdvyL6frU0mnnH57OBt8XYQvQauT9rR4th/nTR6IKxe2NKODgzxhhj/wVhFbUzjdeHQtDyxLuzC7E/rGHf3bDaSV+O94Lp0tAQ+gPdSlH1N6Hl39pvU7HbaOIFzNh46zp9bhrN7pcsv5I85bPJjhTAblMQc0bbYWF4Y3gwei9IxPxzZQXLr2fG7nyQHTH6aOGKsyHl8+tEsfOfFSAoyHxE6/r2enDRxIUnEq4aLfNrEPQpNEt9JPeJxvQbtQh/BnxEoV7QjaPtp6lPArovqqhd///YuwvwKo7FbeAbwyltaYFSSimFUijuFiHE3YAEiBAIAYK7EyS4uxNCCAmEQBLi7u7u7u7Kvt/s6V6+2/9tKbS9vaWd3/Psc86ZnZ3ds2d58u6yO/Oy5fg5t8r9Ovvjb88wDWkQXeAGERkSgmQSSEgu/PFq8SwSMqVIIJUhAVORBFflMjAKXA8Y1egh34i+yi2kTRJ25xah97Iu9DZ+jf6LG9FbgyyrUAMhlQYwqiRkK2aix+Ic9NRIwXdb69BLPgtiMsXordaEPipNpK0q9JSpRA8pUpe7NYNMIlxoXlBCgnkpROS4UQO5HlbSSCAmAXxWCgn0JMiTz8y0JIjOyYHQrEyISuSTUJwD4QWkDW44dC4ky5SRz8UQnp8P0fl5JJCToCyTCyG5HPRQIIFenqtTBCHNJvTiekvRa0Mvo25yckSCPDf6oARZ31QvSO/y7iL7ewq/6/+xVp0Nd5li7I3smu6da+1KzD8yISdV8oFYfqWg5s867imKoiiK+jc1LGuiczoDzHRfjNhcAZ+K1xd8CruNR+q6QG1bEMrrWVm+6u+SU1IyH3j6i6GZs9MmwWT6Dh+MWRMGyT1JDcd8ij1tI8udHdO7F5EgNZSv9qdpZVlxq6By2bNPYi4YHXjSoLLdDpNMfTBkSQDGmMWxhrdru7/ZVg9GKR8qt2qx6kU7CbEk/MqXQlSlBr01uaGqYzFAJxefaaShl2IimCnkxGBuNPoolUN4Htc7RTWEJbgH+7hbHtIhJE5+CykSSueTgDm/DELS3NXhcoiQgNtjAaknTUIu9zCfAgnMEhkQUS4moZUsq16NT7cAU0+3QcW6IXB/UFPg5VyQdZOwKp5DAnENesrVkpBO6s4i4Xc2WccMEtLnceGZBHVu6G2ZChKWSQieTbaTbAsjSebPIaF5chR5Tf6xbFICROdmo59iJdnWXPRULIcYmRhuUBqu32hpEry5gVRIgBbcWiNNwrBcPoSU2iGsTkKyciVEdOshupiEfbIPeqk2QnghqUcCNjM3E8JzYjBvTTRK69np/M/wj2V6MdJ97FJnuEXUbnQpaDk6bDP5DZRCoH6ymAZniqIoivpfyO1gTVQPx5Fw9AoTD1Yi/zV74WVMh/HYZZ5Q2uJbUVzFjuGr/tc5RBQPPOZRMflBBiaXsew3fPGfhoSRfhmAzFWfumNaBwMSphvY4Qd9P3y/NBjjFrtBx9wnS+985iXLjK5zGSyr61bD1ozYQYKzCgmjXO8fXOiVIeFPPgcf61Ri4JIqEh7jSRBOIwEyAz10SKhUJeFXtRX9uRH4FpJgvbCU1CFBmBuqehapOyMGzEzyOjaS/CakzbkkVHL9JE+JQ2+JZIxcnoc52wsheyyndur2otfMHBJqp0Vg+v4WXInvjnAtZzXJScaXVjns5Yn7SXidkwThmSQQz2ohbTWRgFwruIVCdC53fzJ3CwdX1kzWX/fjuibH4iOlbEzbUgLlUzlNiieym6asicV4kywM087Gp4pJEJWIQm85sk0LkshEXiXIJEm+O3flmpu4IC7JjXrI3apBArUUeS9TS4IyWZciWQ8XupVJcFYn26RQDyFFEqy5fTg3Cz3Es9Bzmh9mLPVIX3EqY9veR1lT+Z/nH0dhi4f7QA13mJxL2Zhdz+4fY0ZOLqRCIWeeX01+4/58NYqiKIqi/iypjayJ4j4S0qY4YsyeMkR2secfuTcbj9PzgvLuyAC+2t8SCR9fByQVz3VNKz5+yj755WJzz/I56+Mx2iAeP6wIhuqh0PgTz4sCHbPZO3md7J3SVvbOQffXR1Wu5KZIXKioGLyxBIxyNsS06yAiVwER6WL0kOGuHKdCiARJYclMiCzIJQGZ1JPOIiGRu5IbQcIxCcazSKAVD0evhaHoJROLzzQT8YNxMmT3ZUN+RzoUt6ViumEsBkj6YNLyCOgdSSvS2RttdfpV2e60LlaebPso01t1DQwJmZNNo3AjtOso/50+XXOxMHnoUhJm54VDSIIE5DlFEOL6WpYnQV4+H6Jcl35cv9iS3G0ltWT7KiEimY7+C2Ohtj+/45hD82OfMtaYtMWNTDg4u4FVcslp3GN0smjPkiM5+8wuJyfoHonNkd8ZnzPVJCpnzGKv5imrUzB8UTI+lY9Ef1luikOvBdHoL5+G/io5JPBxQ38nCK7I99blbytRICcNymSbVEoguqQZoipNZH9VQHQ+d0uIO3qJ22H6khOl5IRGSPCD/cPMXung/qVhFDbfyd75Ig8jRhiSE7D5IZDYnVlX24rhfDWKoiiKov4szSxrYng2g4QaTwzZWITzcR1nb9g3G43S8cTSEwkhfLW/BRLARCMyWIlLnqzktltxD5cf9Wkbb2CPUfpe6K/uBxHFUDALwiEsHQZTm7buy5ENL7c8qHRafCC47Idlr5pG6sRj4FLu/uNUiCwuQM9lFRBSL0HvZZ1k2Qr0lC/BR1otP97ysIC7ZaEAIlyXeQvyISyXDPE9eVh0IAwqawKKdXYkBay9nBZw0jE74KFzesAl+3yLO74dS7K62SVZrd1Lismre0zNkrv2STZ+CdWbSYB9c4Uxu7xpocEh9/Des59DfU9K1+O4dg2uPLGqbY3a/qz83twQ2zNyBfcecwGee0iQEY+DkEr6j+GdC/cLqiEkW0YCfDQ+VYiCzrES7Lxb/JQcD+90bzHZlyL/mmLy2seetStbYnQ0fsnhB+m7H3jmBVzzLArY+zA7YMXJzADdI9lBq2+VQv54NkatTsB36zIwel0uRqzJw1DjfHyin4++S0vQV5vr4SMHnyrGYaZZKnSOx0Bzp81hfpX/OCq7At2HLAvD8mPBh86Fsp9+xT1kOycAMgezkNHYvoevRlEURVHUn0UQnM+QQDXXC8Lq0Tj8sjopsYw9852uJ3SPx3/wwZkEux5k6uOR2m249Vx23GyDcIxaEo2PZAIgvIAEZekkCB5K4wb5WPIaQktI6FSIgLBGOnqo50FYKhXM2GAyBYCZ6ANmmjcYyTBBwGZm+5FAGgYhuSQMNqyEiEI2hLirqNKVYOTryftaElKLIaqWBmOr8nqPfFaHBOA53FVcfvPem3V4rb7canv24xm3YXwiqC61iZXlQvVd+wpXcWNvCM8m2ynO3RddT04AuEFT8sm2khMj6UwIq5CgzIVl7gr4lGiISUdBYmsyjtkUhcQUduvyq/ivIL/B5Bry3d3j6w95x5ZZeSTXWTkn11ud8yqzWm9VZiV7INFq0ooAqxkrg63WXs6xehjcok6+1z/6PmeFLb6eA7W9sdUyS40E5y+H6saT3y4K4rvTOkLLGzX5ahRFURRF/Vm6WXa90WkSnMc9B6MRj5uhrdV5TeztsYaBWLAtIpCv9kHpAqQuvyo9ZHI87Krh8ZCCOaZBRZMMYyE6kwTeqdytEhEQkc5GX5U6Ei6rICrTSMJlAwmWLWAWtZP33FXlEvRQzYKwZAD6y3phuJY/JDdFQGZ7TLvE7vRirdO5UD+WBvH1Pp1rrmXF73JpMlc6llnwkTYXxKNJqI4kUzAGLs2B1sXs6lQSGvnN+1UkMH6595jzl9wrmYbyr6N2Wga9Gq95Cx/PeALVjZmupOxzbtpxqSp1tGwuCfdBEAzfLZ2Dvhp1JDQXgJEj4VmJ686uHL0VG8BMygQzPQgzTRNhdqMgJLaFVSeh9h95K8Rf3eSlj30GarnieAQ7UPkY++Ug7SjyO4ZjtFFQ9S2n39fbDUVRFEVRv0EHy/6guiOqlpnyCoxKLM74tJYVtrM3xiz3h+zO4AQSzD7iq34Qzj8MVlfd8KLtS/UX6C/tBGbySzDTfMmJgZcgMDIzyTQ3GMz8CIhJJ6LPwnh8rBCDb3RiMd4wDRNNajBjTT4Ud+c0aB3LCV9zPS78inPC85UXPQyzO1oNyf6YRIJmL/KqSE46DMn7aWQSjOJWwLLfbrXKv7H8fCqUD0Vh2Ym45iNO9bezWXa8YON+RUl5veypB1E+cquet30pcbdNbYtv246LkW377qS16e4P6Ow/7xrGqlthx538h1z9Wpb9esXVnNz+C3PIdyyBkDjXK0YuRKQyIKqUCyGFIggr/ThUNtednJh4ICYYRWLN2aT84JzufWS7//RBYz4U5PcdRKZZRWRaaeExz9Y75kxIbNpcfvafYsISG/dvjMPgX9aw0Seze+kY0zxyUheJCaZRNYn1tFcNiqIoivrTcVcbdfbHlTAzPMAsDMdJz6ayJpYEZ6NArLmSBhIepPmqH4SD13wzmfHmYGbdQW9pDwxSTsboxTmYZpL5WnpH7Os1N9Jfb7cser3uRk7rnLUxDnJb459uuJH69PKr3P0nnlRJXXFrkwoqgxT53qP4Jt8b2afzmwAp8vo9X/ROfGJKzs41JAF/vB0J+KHklYT8se5gvn2OLxRCobo7KcY+m1Xi6jpEp+1Q3h9X3kcploSpbDCK3EN2lYIHEUW5PqHF08DI5IORqyW/ayGGaMVi6anE7LjK7i3kuw0UrJB6g/xWwlxQfhKQv/2hd47f2jupRUtOxUP2SBqGa7/CcLmb2H3Vm3tQUZhf5BfdfGi/9MRF222kvd910jnXxNH9W+MIuOW2b3qZ03Lqu7Xkd1VIgPjOzJoC2h0dRVEURf35yB/3nkcf5iaLTPcDIxGLc75tZdUkOI9dFojlR9PA3fbAV/0gPHwZeubUA78Ki8dxFRuvxT87YFN70j6628g9ix1VT8IwF4i5iQSgEfwifyEQWnk0+eIQeTcwc0lw5h7im52JkcvTcd27zYWvxBx0qTo6wdQXzJxEiCnUQkihjtStJOG5goRkrj/kJDDToyEkGY9xa7Mgty8+8dDTgpPke3/JN/GPVw6MjKhq3+Wc375r86PcaI3z2VkLDqa+/m5DGvovL4SYJjkZWZhCTkqKIarEjaboja3XApJ+KTiTcqEr1z3lNx0PPjF/lS0GS1yGjJlH0YbzkY83XSvbtehIzC7NI75Hd99PvL3xkufpwITMnfyiv2i8zl33UTohsPZq2WibUXV40Io4sk3RkNmaTftxpiiKoqj/BfIHuMdl+8JQsVneYObHwcyhnrvifHuaYSg09ySi7gMLzhwSEPtzE//xg7PyUpaP0PQYiEkVQWp/Ji6F1b7gysl3+nbP3ajUEVouYGZ4Qkg2F8LK5SQwl5JAlQdheRKayW/YVzYRs8wysfJqSezj1G4D8huLCRr+wJ05YzXo8r2MSa5+RZvvPUm5eeL0CyN+1jsj+0LknmPKOe19EY3z1oZgikkE+isFQkyZhFI5csKhRk5WlEtJcC4jgbkYPdTawUhXoa9iGFT3uP1i2OX28emTjpkz1JwgNuMFmHFOYL61Q4+Jz/DxfE/0E3eEyKz7GLDgGQbL3MbOa76h/KK/aMrSe+6TDUIQmdW+3a6gxXzoqgRyUuQPuU0pzeRY+JSvRlEURVHUn4ULEseflDz8VI679zcKRra1DSQ4B89fkwAps0jENX14wflD1cGyU5cYvVJXX+ORIrkmA0anq+JjK9tWcvMCq9lxmieCC3stsAczxY+Eam40vnQwqslgZCLJb+eBwVrhUNie3rjrbqlzcCa7jPttBQ1/YEgoHPjMpVLF4pTr8XPXPCzs3FIFD1ba2AfdkV78CMNnPsBsNXdcuptgK1jgPXABV3ujQ4PILDdy8uEHZlYohCXIPpTKhrBCJURVW8DIk9CsXojeWhXkxKSeBOcS9FMKwCzjx5v4Zn6WX0jN+Mfulc/ltkSUT1kVCrXdCVDZEobFByOhuCMQ84y98L2aNwbOsoL+bs9gfrFfNNPQ0vNb7eeoqG8bZXQj73S/JdEQU4jCqosF8eR70PvTKYqiKOp/4Wl8556pZmmCh+e0rpc2drHsgvnrE6rmrI7Fqwx2Fl+N+i8gAajPsYeuxrrrHp48fjEJS1e6wnSXn21QZt0xvgrjnNBiLnMwsYFR8CehLgXMwgIIyZSCWZBA3odjpHE8Fh1Pwv6H6a/qgZH8Yn95JCB/lJhdo3zXK3Wr2fmIDboHYnZuuBSXoLPbrXLZAVcs0H+I4TOOQlb7eArZT6LkhG7wmuMRESIT7uPz+c+w91qqMt/UOyPtCM028shjuB5WFpKwLJ0NEbliQbeBYuqNEFVrgZBCFURVCtFDg+xjxSoIyZfgY40gyG522sI381bc/3aQ6fN2lh1DpnHkvWDKJ9N9V3bGxoMBcdesYi7w1X8W2U6R+SaWgeP0n4P7LLE56kIP9UgMNs7B+gcNxwWVKIqiKIr68xW9hrnCoRwwk7wgdTi3o5FltSQ2J+aP1PbD44jSA3w16g9U3cLO3nsz4vx8/aeZc5c+h94mp1jrZ+UmJGB9wVdhylrYmSctC55OXOJLTmpcwKhlgFmcDzGdVHyim4ixRsnQPpxR+SC06QxZTvDQ4IfAyjZI1Xjti+vrd3uXqq91gaGFB8ZoPEW/2Z74RCkYWx9mFD1NL9nsWVi3asGKp04zVCyw7dAdwf98uCQ3mY3Qesx+pmAJt8iiy4IG30MDyw4cp+9bwkjFglHIJIE5lYTjHAipkvCsQoKyEplkS9F/cR0+0W+E2BISpEn5d6YJuOZfvJVv5q0evfQe5xCQeLKiouJnrwqTUPyrt86UNrLjFq6x6Zy+xq6T/LY9lQ/lnxdRicPoDbm4Ed14jq9GURRFUdSfrayDPSx/MBnMD66Yvz+7vYZl9WR25xQOlHeFXUyBK1+N+oO4hOcaLNvnioEKjvhEIQ7X3LujIipZFY293jM3nnyycvcVL38ZvWsx6msdMXzhM/Sa8QhfqPlg5LIQSO2Lh+rxqKjttmmez2JazEmo+ks+8NfOsqPvOaTqvXRLfmFpl3Fq92b7N1fCb1sHrFFYaguRUVegeyQiOI1lJ+gcjAgXm+yNj6SD8TC8XHDMtQEjSMgUvvsy+tCpuzZDuTKvnNbh32vbdPSTssKZFzm3ubL3YZ/eoD92dTgY8Ugw0okkJJPgrEROGjVJYFYtAaNeCRGlKggrFEBMrYjMKwOjUQGpo8WIrWvYxjfzi8jvMdRg6+VqHbNrSM2vfHMS9L5s3XO0R6rew5JzXoLgLHug5Kyoegq4hxdfZNef56tRFEVRFPVna2LZ8fIH41qZ8S8xe1c+Slj2/g7buuTPlT1wKzDnOV+N+gOQINhLd931QpHxp8DM9sfHyrFYeiwcWrv8XksstYbOukdQM3ngabDD7enhexH3lh8Lvb3mYvpt80cFlzZdiJ8VUMJO5W434Jv7yygpqTFpbMV87j33HR+9DEqap34DQ6bcxch5PpBUvn9JUJG34YSXyxwTp85Mfohv26CW2d+rejWLTXuKVTfiHpOwOP3AZS/WK6TuJ0OAJ9di+GxDv27mh6eYtMg5gAuV/CwBsu633td9zL3Z4Lu1JCyLx4GZlwihhdlg5PIhrFULIc0GEpwbIKJM3svmkVCdAUa7DoxOBWQOZ3YUtbeP5pv5Rd6pJVN1zB1xwCb6GLcf+OL3Zu2SazNY+h5WnPNr4L6j5umaK2IamfhuTeLrZykt9PYpiqIoivpfIX+YBy49m9jETH6EKZsKEdPJbrWILNn7w4ZonHYueu8HsKhfRvZ17wOnbaOM97zMOXI/LueqY7H7+eeJyuOUHgxZdyh5SF4zhvBVPxgkIArrrbWy0dnu1RkQVyLHld147Dna/EKwz2hFHzDfe2CSlg85H/v//UebWjjHLd/j3Mh/FJhm7FAkvMAR47bnpkpuS3UctcAGy1Y/+8n9vC0t7NClu4NqmMnPMdbQHfFNTT8ZXGazudXhgyceOXPbxBf9xOq7TYuGm1RCVK0cfbSqIaJUAkaB6z2jCmJKFRCWK4GIFhegy8AokfCsVgkx5VwsOpro/muhnHPKOfnMYKVbGE2+7/ozaYVyxp7ntQ/5H192KuT4XdfsQw+dIiUDo5Lm8dV/0THLPMsv5N0xeaXbPbJeMaOLuVVCUrH43jSp++iLmq/4ahRFURRF/dnIH+YhW63zm5k5TzFULw3XgtjrD/Jrrn9jEoTttwsCyHw6vO8fiAtg/5r4or+ks89Lll2xr7I4dLVR4pFv/vHggkZ1ftZPcCcDWpteVQqPu4+DD1JCyPcS3MPLHTf772a5Dpb0x6ezXLFib4gFV17Vwk5futujQ3ezzWNSRxBwyWuvtTfDypi5jyGmHgr9S+UYJn4CemYnC8m8n1xhV9waaNlbJgoDVGKx61H2Qb6Y246P1E0sa5evudRFlvnZfWt2J9e6/5Ii9FnaioHGXeipVSPoyk9ItgAiskUQWpAHEfVaiGpXQ0yjHAwp/3pNDSy8247wTbzVZbv869+qPAMz/jmYb+3RX+IV+ig4oJfqSwzReoEhCyywaPPlQrKtn/OL/CwL6yLLYaqBUDXPvMTto++0XdoY8QiMNojsPvS44IN5AJSiKIqi/nbIH/Ev9tuXtDFzyR/7ye447tGBNPLX+mOtl9hyK4sbPfCdhoz+F1J/4Au/JP0zloE6pJkefDH1F0R+H1HuNyK/Wf/gzKrl2847XNhw1TVU8aBXhOz2oA6VrRkYp+yFobIvIL8lqCM2pfk/HkK875ozY7z2qxZmujvG6UTh5rOiw/wsrn0xWX1fN7Fxzhiv8rLbPqZCP6iAXSy7+hXWHwt50ysGqSe85GjQtR5ybvjGJAHVLKtz3PqV9+6rt325+XtP2sqb7b9nReoJHXYsvD1EOxPMd3GQ3RmTXVLZuNI/snT12n0vYr+XOYcjV11dufYEDf8brmzyModkRi6FBGJuVEVuJL5iMNK5ECGvfdSqwUhkC7qm661WhY+06sFIpmL0+izYFTRe4Zv5RVz767a/uv+9/GPMXxP2WmZbRMfY5R7d364MxYjN2ei/LBrMvGvQ3GlTSep+xi/2swwOpVgOVfHH6tu5VzLqWrRG6/m/ZqSiMHtrZndQwYfTcwpFURRF/e1wV78uutVUCku4kODsBbVTeZVVLJsgcSga6vvCyd/49/tDfe9l7JWZ2icx28ASu6zqtLmyxk5WPCQy9b0COPXH4sJaC8t+mVzcMfm2d+GhFXt9jy7b4FSoa+ZaGJRe7e6TWGI7V98OzIgrmGjs0HbuedFsy+A2ubVnoxp7inug9xQ/rN4WwN0G8ZOruYcepW/9RicMIrJZYL4PxxRt/5bsurI3Q7Wn57V/L28c9ZoZ+QCzV/nC+FRKlfyql+3kuPvJkNRrzhce+kIrBkM1wnEqoHsJX8xt90gtI7cMHRM77lgUvheZbjl5ZThGqKdismkEdl8LxpajNm1GO6zrjt72c0z7hcFvcipZcfE1AR1C0slg5AshpFwCEdUKiCiWCq4491Qqh7A0CdQLMiAqS4K0QjVE5NIwYXMU61Jc/2Z7fgn5Pr3FFQ/6K5s+qiP7eQbZ1uFuWewPDtn1h+4ktZivsaw4tvdBROHFp+E/ud/754zXcLzztWYQttkXqNqGda4bpR8PRjwaShaZ3W0fUJeDFEVRFPW3Q/7AC+17Vn1nkGE6mNlhmLYhNaeLZW8pn4vDcI1XeJXRtIGv+k6cwsp2D5N/iAHKDrDNYDf4JTVsV1r1CBorLtX5RNV/y1ej/gQkzPV94Z18VG7pA0uJJU9axBe/wCwD19ejFzlh0bYA7Dkflj9X5TqWrrsXwdXfdbPzbu8JoVi40YcLtoIH81pZVnyKUVgXM9wTa/cGk0ODfXOPLXfs7H+Y4bbjcW3birs1MX2kkjFYMRqXPSru8FUE7rtWnhqq6AxmqiOYiU9hvN8tmyz7MT9bwC682Xjc4pBu5jtrKG/yKX3k2TJbc80zs+XbfGqmLXwO/bUvSsgyohedgzT33Y1xuOjVarjzUbHhFddEzdk6W3pzwZVv6mftu5Qq9+3iYDAyaWBIaGbkCyAkRwI0Cc3CSqUQkS+FsAwJzsrkBEAqH2Li5LNEJHQvRnL/6/IfvZcAdSOARsEDkf+iYmBxa8UBG3hFpfzsbS1k+3/1gUGyroEzljpkfb8kGG1t7LfmD9Kd+iwMASOdAPXTyd2kDRqcKYqiKOp/abtt2a3PVuSAmREC2f0FaGHZw/Ln46O/XBKAc85lt/hqv+jGc59Jeltueqw/Fe6XWMyuuBnWmjTUKBmnQ7sa55iFtvSceRdGR0MRmtrwToNIUO/OM7FT8qRNtc7Bm3Fmx6542N665TWAn8WFsGGm+yy7h0tdwbbzCZlKG/zzxGZ7ghn9FOvPhTeR+UNdQ3Mld51wFAxffehJ6/ZB8v6YZeyDDpadxJVxV0/HL/Xv6jc3Gpdsylz+b/ibtfxB9YGHyWmkLcMxKxLAjHXA99pBXZcdKtbzVbjAKLLmUkJWj4WB6C3ujmW7g67zs95wTypbMNvYEaO0nTFT7xmWrH8GdRMr6G58Ef/QIfWZzbOY6XzV38RkX6jMYIVAMAsz3gRnMY0q9NCoJmE6H6JyJRCTLwKjlgpGoQjC88vRa0EoVlyJ9fm5wEuC88cs2/qTB/XIPvjqWVCpVnlbswlf9N7cUpu/+F7DHvI747jALqFvEZHHzCXbLZ8C8Z0xqCBhmq9KURRFUdT/gn1i84Wpe0mAmBuDiVtz4NfGrrqa2H518uYMbL9TdJcEh5/tpeBfXoalbpU2uAKRb45itK7/6z1u9U3DDFMgLBGCGftycTmk5nIXy8rz1anfgaTdQZb24Qv2Xk/asXivm9uUpXaQ2hIC5a2uGDZnG/ZdcPrJg2xSBmcPLd7nyIWwoRXkN5i0uoAE51cwORdOMjE7mK8m8KqwWWGc0bP2ATOssfJE9rXrz4v2Guz0r+49ywUDZWKx9XreT7qHI8eF6Gjl0/nzt8TA3Ka0Yd56v4rBSq/AfP8KUkYJjQ+92O/4qkx6Pbtk9qYEfK3phevOecZ88RuvEsuUN96MOmPhXHo6Kqf2tP2rGP3HnpWjyTp+d/d73HaetUy1/2RhGAnJ3IAnlSSIknBMpj5adYJXYZlCiMjkQUgtGR+t6ITYwgZ8JBuBPU9SrvHN/Kr4MravT1yznNRSD7OdZwLid150S7RwTNhJ9vMovsqv8kwuVxu96NVruW0x2dzvM9kkKotZGA0RlUyse1DV0sqyX/NVKYqiKIr6XyDBYtoWq1pBcP5INwNWWd1BSeVdVycbhmGvXVYt+QP+1l4AyPL9LtyPvWF6Jth/6aXcpkFGGWBmu4OZF4C5Rwqx7UnVHX2LhOMOwSVHSN03V0Sp9xMSl2mxcPHlRgXjl1h+MhWi8+3AjLfBspOx2aE59TNVDHblr9t5KZ6vLmBx8eLg3RduqXHvuQA5zzQ8VGiCC5Q2RDWT3/VNF3Ec7ndcdcy/hRl+DDPWhWPN5Xx8Oo+s4wdPfCwRhy030kz5qgKXHRJMZq541L3qeuK126+SJ1exbP/zPvk3v9Ig4XnEE8zRtq+/ZOfHPSQquGK7cueT9Wv2OziR9f6k/+X/tgaWHa24LRDMJE+ISRdDRLKMBONy9FasQk/lSggplkBYuYiE6WwIyyagp2ojGOl2TFpTBOeUWnG+mbeyCa9RVt/jUztS8QoGzPYGM5Wsb94dfG38GOuvhfjx1X6VZ37r+e83hGP8xmArsp8mzNlV3MzIxmLQsixstSx7SfblW09iKYqiKIr6LyN/oHtvulsSISabRMJDEpY/KojoZNmZclvCMHerd1v5/7ky+UuiGliDk/7NVaO2lUNYKxc9F+XhC5NsfKQRBmbsCaw+6IimbnY5X53iPX36VCS7tHO6SxKrcv1lnO01u8TwMzdDfBdttgvTXGnjfuJq3H6unun+i5smaprjmHWGkU8JqzdikSeEJV0xd2PEVW4+kDPg2Pm7b72lQftg2h2xWc/wg7Zzu2t0w2y+WIAcB/3N70cnCY29CZ1jUW3FgIziVs9nIxTswYx+jgmLgytfJrKaXF0uwOkcCMv/Qv4RG/pvV1Sbu5uN9Y8EYJrWK8xWv5Jw2drJjbQ7iJ/9P/EivERj9BI3MDOC0UOyCEJzi9BDpgoiMtx9zSQwL8wDo5APRiYDQjIpYKRKSOgth9yBfO62pRl8M29lfMI3+iOlqxDfdA/SO8i/o/lh6KPKnTxa4itFW1g8jb7xrxOIt7ngXX9wpGkIttgmPciuYLWmbi8j2xOJsWZ5uB3ersNXoyiKoijqf+l5XPPjIVokNJBwIXssv4CEncXLD8e2jjFwfO1f37aar/azuOB9+Wnqy7F6JChMeYYBRnnob9yAjw0bcDufzTZ/UZYyZ/nj13vOeZR28A+dUf+fs3fCJs2191u/V7+HmSaOuPci5fYNy1DNIw+Sw8eqO2C0qh3MX2YemrVy4+D995wukwAmxIVc5S0ubcyYG9A/GVxMPv/k6vEvue5W+OwTKRsMkrbGOfvKN/0g/8v2R1kn+0u6Y75pPFkNRnBlR61S9k/VDQDzgzMmLHLE8uP+ESa38++PWOqHAXPvYfs53yQuSHN185ubv0jMrT4QkslO4baTK/tfO22XfXeQujeEJBMFwVlMrpqE5gqIKVaSUJoLRjKLnDCS4KzAvU8h4TkX/RaVQfVwbix3bPPN/CL/0LQJhofdOgyvR3qWsuy4eJbVHmvk26F/L8fD+GRazMBpjzDL8DYiKpp/dYAbxfVhL0euCod1ZpeKuWXB4Y+0EiGkkohhy6Ohfih5Ml+NoiiKoqj/pVfZrPLEVWlgxgZA/UIdGll27eKD8Z7f6Lnikk/hxbeFIC5cnLIMe/W91gN8peuK66mAuEUDmAUxWP8k15cs+zGpM5NMX/CL/OOQfdDv2gMPixc+UUv5ojdeBSV+svdGqLfwxPOYYvCyni8WXAGW2x1RwPxwDWoHAyr4YgHSnojOTjdnkZmWmL7arb244d2C80P3IpOvFZzQY/xDrLGIc+OL3zB/nHXhMwlX9B7ngKP3E+3TCgqGcuUbz6Rtm7HUNe3r+WfSv5E9Uyy/27dsr21C2sH7kXYrtjyWFCz8F8TtJ/XdwXZ9FcJJWM6BiGQ+hGXLSTguh5hqDYTkiwUDnYiqFJPPJRAh74VkkvCZbgTMHUod+Gbe6uodz/WmewT3kQvu6b7vmC698nhQN/nck0wDF2+JDB+j8aDbJTz9TTd9P6epDTIShh7st4a+eJjJSq48kx4iqhSLHtppmLM7A08iG+byVSmKoiiK+l8q6mKll56sADMxBl8YpMG5sNP1RVTT9Y8WPoXeAc88vtovIgFF+KFX/oaXkVV3ulhWe+31tM5+M65i8y1vMgvT+Gr/WA0sq6K72QaLtzxHThsryxe/YeOduXzg3KsYrWXbddu/+l+3Q4gqHo5OZyRtIbvN21tQ8d+csks73lvKDmNXBne753cv44vfqrSRHae4IRzM0GuYscgZMXmsAj9LYNvJF1clljlAQucZNh+wj4hKyPyPoP8hIcF1sNKWgDZmdjgJx5XopVoNEcVK9FncTIJyJTm5yxM8KNhbqwpiKqUQlisHIxGCBUeiulM72Tl8M291xzJ0ldriW68N1+UJriiv3eP1dPlON+64F4y6ec2DlZM388Dpmz5v7RHDxrdm25SlwfhKxyWebPcCpV2pVUJSYei7OBuy5lmJpL1P+KoURVEURf0vkT/U/fWPVyYJzcrFp0sycdyv0qGzE/PFzUIhbuxQV9zw/3tIeBfB2XVGBrttb1+0dr5D/uAL/sv/Q0a+gxAXhMpYtq9PQvGYCw8TTG499l5f31b/Tj0muKVAZsoSJwyRssf+OykhfPEbpG1RhY0hMR8vdIfWodCn5Pfou/dO0r6vDUIwaVdp2+2Auv+4WqlxIGbaJ7LO+EgpEMZnUk7wxW+VVlYntXDdSzBjrmGIzBNsP+mSws8SuGvjNcU7NOtISQc7lS/6oL0IKNg8Wt0XzNQYiCnVoq92I4QUK/CJcRd6qZMTxfkZJDxnQ2hBJoQViyCq1oz++jlYa5fzhG/iV23ccit49OyD2HbG6Tb3WU7fOe5bRUdYPM8M0tjnZ6Kw6kWw0V4P8hPjrbdq6O4P3zJ4oScUd6T4tbOskvzhfBLiQ9FnURbmbE4WjKJIURRFUdRfxLbbVTFi87MhKhUK1RPxXN+8a1T2xmO4vDUu26fv5Kv97ZGAI0y++zdnAsK/ue0R/g15P5BMH5kdsikePu9M2feqds1TFtnA7KBNUGNj41uHT/6XXfeSjved/wLMD/b4RvERPKJLT5L1/OT2l1Ovyv1E5gRh6rp4bLqb1jR0oT0JdqGYsb++K7KWFfSM8e+Cy9k5U1aFg5npB8n1YdygIoIrnG/zzDv6qOYOm9y9lrG5h+4l22+weLyWn/W3w7JNg1YeCyjpqxiO3ksbIKpYBRGlSoio14PRqIeQWg2ElEoFvWpwIwYKy+ZDRK4cozfk4nZy2zv3xezhmr5u0UbrLTtuOUjmtLAzJVb5sMxIBxLWbfG5rD3GKtlgxwl/Y+644hf5WcobXaO+VPCHZUjTqWsh5Q8GLY4Do5CAT/RSselR8Uu+GkVRFEVRfwVXvBuOfGGQCmaWF+bsT0MlyzrqXswFM8cBp+2Lw/hqf0skGH+ZU4H5D16WLNtvFROnf9kBY3QvYoz6te6tl1zvc3V2XQi+/50GNzS5PQYv9cBJ99LtgoXfwYY70aELDseXTTBNzRKd+gi6hyOQ2/XTvq3PO2aH9F4YDvVztbUPgstPSq6Ja/xYORSMrBNkjsbGlbGsCl9VgASxaYtOpIGZ4o8h2v448yTMgZT9ZEjs/+vp06c9SB1RbuKL/rbyOzpWyV2ohtC6Fgw8DPRe2YbeGs3oJV8FZmEpxAwBRrcdjBYJ0YsaIKRSKgiqqseTmsm+/oFv5q2u3QxQvnA3wZPsT0E3i1GV7BeaW9wKZhuEYc4yP5idScw+fSf0V293qepkZ8xb6tky3SCukxyL0/Uuxdn2XJAMRjIVknsykVLPLuarUhRFURT1V5DdzmouutbEMrOD8KleHKKbgTtx7RCScsKqs6lcTxuCB8X+bl54hTlorTzbNEvrCcYpBEPcxKdC/qDXE4k1QS+GzrHD0p3OrVyw5urusiwK7En2x8hVAXgYW39A0MCv4EKV7gmfwofZFRZBnVg9fEkoesx7DI3DIWFknhhfjbH0rN30jU4kRpsWsNZZrHoty369xCLda5B6CISm2ENri/trS9soA746E5lZbWx4PAY/6HljtIZV96o9d8pqa2vpABm8ayH168buLYeQSRMY/UYwSiUQU6iECHdfs1QOGO6Ksy4J02tYiOi2QFirGqP2NOKIb8MVvom3IsfE54u33igdLn8Hy/Z5vOCLmchcdoxTDDsnIo+dQ+p8xBe/lZVv+bK5q6Kx/GhmIlnma5kD3nXC0skQkUnF2nsV9eQ4oT1qUBRFUdRfCfdHfodtZQUjlQRmXjC221e1l7Bszvg1EZhj4oPE8v98qO3vIDwlS9340Kt4oRmWGKGRCO8MVjBaHNkfPY9Z5u256JBSUdbGfsOVWUdUb/xK4zmGarvg4JOKHVzZr3nplygzUf8OJHcFZe6yK61WPlGAPrLu6Ctpjf3PEp1IKBL079vEstIq22I6mIlO0DqXF86VkW0Yu/p0Vs6sJYGYrWmDVRuvFL986SbDzfOKzJviHFVlHpFdfcAnsmFMRfPb76H9JyH7VFj/XHJ03yVpEFndih5mnWDUq9BDuQpC4okQls9BX8MWDNz0Gh+bvSahulxwu8a3a2La7cp+/K1/Dflthu19EBA7ZvG9ls/EL2LTEafL/Kz3Qra1x5YrHl4j9Dyx2bJ1+9mQbL0RZgFglJPQR78Al4Ib0viqFEVRFEX9lex/VH53oGYGmBn+mLQz93Umy7ppn0krFZ1ri92Wqaf4an87/gWdq7829mEH6oTiXnzb0YyCFHFzK7/CwMzScVywJZPgfuQ2lh013fBJo9hsG6w9E8d1GfKTWx7CwxOG1dfX/6T3g0deSQ809ng0qR2NSDS5mXLHq7rbcNH5vCRmygsM13iJW04p7iSE9SXT5wZ7vZqGLLyPhWYueOwUJghipLx/UG63YUBGu/LVp379nj59Skdf/BUvk2oNpplFQUQ5DUKL6sAsb4LQ4jr0WtwCIckEEpwzMWBtNwnOLES0aiCmWgxGOglLT0eisrL5vbpNDGnH97Jr/ZLHKz/teuxZ8t5Dy5Pfd67hEScM1HyCx4XsKo2LaRf6Lo0gQT8RvXXCcNWz5J1HHqQoiqIo6k8UXsKun781G8wcD3xhkocHRexRA8u6Ez2Ug7HsaCT3wGB/vurfyqNMdtg3uuGdwtOisehi6/ONlkFWYzVvY+/FREHXcP9unombj8hMRyhuiSzji94wWnctdO3Wu2/6R+ZCt8GBJ/Hyptb+fJHA/YDGVbM2luJLRV9om73EufP29zpYdmp0Vo39mpMuiqZH3aSsbAJn8dWp90CO0d4ah6LTRaT8IKRaCoYLy3r1JIiWQ0y7AUILU8Eo5IHRbCJlzWAk0yGqlApx81o8DKy6SJZ/pyHBG1oaZpO6w7j3XSyrMntFBKtk4tDuF1W2/n3+nSTlt86VMHPGhDVO5LyMnbf8SnGasEw0GJVofGcWjrvBde/8oCJFURRFUX8i8of7m8WnYtsZaUcIywTjgGNn1bMytkRUPQLi68KQ1cD+LQdhSCvDiLmrYlhmTBSG65fg+01JGKroApNDCf/xYNdSi3w/oam+mGoQXpfT/v+76avpZOfJGdhDQd+SG0lPcPtFdlXnNKll5yChcx5pWf9/AIvonHozy4DWqNMvGk8/9cjff+eO3zt1a0f9ulOO2au/0Y8hgTieBORaCKnVoYdxOxjVEojpcME5B8yCAjAaLeixvBOMfCYYuUisulXeQX634XwzbxUYk6Wguup091jFk7Vq28OzpNcn1gyQ84PwDEtM0iMnVUbPckx32B/0DkyfyC/yi5bvcZQdJGcHtYOhLjUsqzh+ZRzLiGeQ4BwHeYuYxuZf6caOoiiKoqj/ERIcRK6F1nh/tNQbzFx3KFhUIZ0UTt+VhI8WOOPwkzw78vHNA21/F+SE4QvTU5GVIpM90FsjGate1nuvOxeX9NA+XtDn8tPo6AE3PaMmcO/1zxb7iopH4iMJT+x8kOZM9odwGAne6hu8Qz+efg162127O1h2PFf3jmPo+g0WTvFr9zqeiEtqnMeVccgyXL/Qb+2ejHp/3JVegzP+BT1kQ9FLrQyfGLEQ022H8OIGiOk1QWxRI5iFJDRLFUJUrRGfriM/hGI6eqkGYdWNfP93/U2M9tqdGjDvHJgfbkB4rg1E5z/BZwpO+FjeCcyUh2C+PAYFI2tEJpVq8Yv8oq230yxnrU+GhVv1/t1u5SeG6KRAaEEOeuokwOhGnCN3rPBVKYqiKIr6q8ls7F6nfbYQzDR79FgSiOh2wNy1EszE+9A/H80NJTyIr/qnIgFiJFn3OP7jH05vX+SDfiqBGGxaCnOfzh0AI1SdWT2O+74G5n6JC1deLuXqnXTJC+gj4wlm7FN8t9QTyhtc8hTNXmG20XOsPu2d/MgnW0/QIPWns4rI3zjKgPw2EgnoubgOA1e/hph2KxiFavRY2gVhjVoyLwti4snovSATfbTrwMgmYKF5OmJzGlfxzfwq4wOPE8fIP4e4gU/V9gdRznvv+5x65pn++IZHlrPxseD6kXIXob7qWsmvBfHCFvbL8RuiKoYb+HfH17Y/UDpVUszIpZBtisYYs7jXz+PK32lESIqiKIqi/kfIH/sB57wakgYo+YNRC8O9pO6k1Cb23lcGAZi+2rM7u7JZia/6p/HPThmtu8mi0OSwW7NLZKM2X/yHsoxtffClQTwYpTgsulKWxu0Hm4B86XWnfVKHz7fCROmzjSREf3XcKuXZ0qMx9Yanw0q0drlfW3M86MHh+1HXg4pY7p7X3nxz1J+M+730jvsVM3NekeO2iPyOZFKuhpBqIxiVBgipN5DP5WAU8yG0MBvMvCwwUgUQVc/EbruSBLL8O/VtTX7j72x9CvY89688Qd4Luin8d6Ts60eeyS/O3X9lyhf9onNPU/cM0HDDzE2+5VEt7JnRKxPASJNjcEEIjG/kcPc8f85XpSiKoijqryq0kpWcszUNzBxvyJwsrShk2WcLjyXhM4UnuOdbeZyv9qdJrKxUmrvqOpiRN2F8JLs0r7xhDj/rD3M3rOLuYF1PCC94iW+XeWDbZf/uZXtfQHyVJRQNXdNPXYzwI0Hmo3WHkvuR14FcUOMXpf4CHocV7f5WN4iEzlSI6tVCSLsSjEYdGG1ukJNWMLKlYFRJcNathsiSJohpdJC6xRi3Jhe3gyrfeYCRxcsueapqX3zTb/NvRY4fMb0dTyIHKNri4IvcK9diOzd9sjiahPlIMAv9sOdJNjnMfnz4kKIoiqKov7B2lh2jeTS+VmiOF3opRcO7AbgR3oye86yx+U5qOPmj34Ov+qfZdDfJv/fCGHytHoXLz/O8+eI/BAkog248jS5RWm9db3Am2vOKU4LXztMuR/X3PNNK62Sn89WovyhyPH6sdSS8jJkdAiHZcvQw5HrMKMdHKzvQdwVLEmoXGJkSiCyug7B+HUSXd0BEuxU95TKxxDwhiiz/zvcRz5I42DB68h4cOPVYki/6TdwTq77/Tvnc6/GG9rXk+BsjczA6kpElwV8+GgMW++GQQx7X3aHgIVOKoiiKov7iLntVen+iEwdmjj92P6tlO1j22Ld6HuVzNvgjvA4afLU/TWYnK6l1qqJVaKY7NPfGNJGwMZqf9btxASU1T9C92DsNfkH9tey8lX70K+0oMOJJEFYsgZhhCxiNMoioV0JYuxkiSzshrFkPseUt6KFVASGNKjCqOZi/LQ3u8bU/Gcr81xw+E2A+deGJGMONt1PJcfOTPrvfx977EY/6Sz+A9vFIz+RazP9+bVAHIx9CgnMYxpm4dz+OL5nPV6UoiqIo6q8uILMp6ivDZDAzfSGxPxedLCu51rLs8SBdX5z3Ln3MV/tdwDDCbLHDQP7jr7oTVGXOdTXWX8YNh6ziQ0lwEeFnUf9QjSw7TmlzTI3YnBiIyKaTsJyGfqu4e5pLwChXoJ9xJ/oYv0ZPYxa9V3Sjr3IZmPnJ6Kubgi0PM7iRG9+714qyeI++0kusW0/fyxKMMvm+Sltaps1fa9fxqZYPXqY3H7SJKn0yUM8HjFwQeqpHY7FFhGDkSIqiKIqiPhBuqc2rpqxLbGNmuWOAegROujU6Z7Ks8Zh10VA84FfOsuxHfNXfzDMsZt+JW05c7wOf8UVvRdb5+aprhWXMlCeYbOQM74zWvfws6h+IHA+Djj8pLP1UKhjCM1MgSoJzX61kXMkFpli0kOBcg/5rAeFFrWC0aiGsWQ4RyQL0186HsWVpPTnu3rmPZPswdvTWqznzdz0smW8VxcquOZ6XM884HGdcyi6Q7RjKV3snW6+6GfVf8ADTN2W1kGVnqV7ICemhHizou/k7k8SmJwmt/9F/OEVRFEVRf3Gml1ITRLj/Pp4TjDlmGcjrYEuMrhbhU4WneOSXZ/9brtb9Cxe8V99Ijhy+xBkbbyXbkrb68LPeyiuxS2bmWhIyptyHzvm07gpgMj+L+oexCWg4PGVdFRjxbDDyZeQ1E2Ly+Vjpx2L4DlIumwMRvQ7+AcFqMKq5YJQqIX+yjo0rb3/n240yqlu+lDZ+0jB47h0MXvgYX6q+Qh+JJ2Bm3sEwbReo7fDJsnTJ22PrGHaDX+StFNY9dxab5wCZwwUhdhmthsOMyPYr5KOvXgmWHM2M4atRFEVRFPUhuR/RuP8b43Qwc8PRXyECp12bXjxMeG0tNP8+tLbas00sKxgU5H2QgPzxzvM+2xftj8j7dBEJwLOcMNPYFZGRNV/xVX7VgSc5bn2UXNBD3hUnn5Wk8MXUPwg58Ro838ipjpGMhJBmI5hFrRBWq4GQWi3EdrIQWl6FXhqFEFIkAVqjHV/uZ9FvTSuEVHKw4k5pEt/MryLHq8juw4/vTZC7iu8UbTDf2A2SJu6YZvAKX6o4khO4u2BGHMN0tZvYd9I2kF/sFzn6NSv8oPgUQ7U9YZnWsWLV+YKnYsrJYBQz8dWqQlxwrQvmq1IURVEU9SGp6GJ1dM5WgJkTBkbcFeKH0qp9X7Ou40w92keq2+GOf7sqX/VXkaDzhYVtzH613Tb1G68EQ+lQJpgFXLtekN3ojcyilnfuequ8lZ2jdjStm5nqjK+XhOO2R/FFfhb1D7H7aojrwAUOEJUjx5FmE5jFrRBZ2gXRtUDvI4CQXj366VRAVLkKn5gBY08CwlrFGLAoBGtvhJnzzbyTS1fcj67d4bTO/E72ipgydkU7oFHUxkpvvJi9Yv2ZiNiZuk+gtPoRwlLLZflFftHCJa8cPp4RAJ0TWYlAl5T8zoxWRioUjHQIFA+nvk4p7/rTH7ylKIqiKOoPAEDsontLXD/1WBKe7THYJBavatjHJ5zKS5g5T7DkYFQYCcRvHfTDPyxTdtHqC/4/yJuXKe5xwbITHi45jayvwZ1qMJNtMcUsFFb++dx9oj35Rd6JxdO8l4N1EsFM98RkA88Ol8QqGjj+IdpY9hvFHXEtzGQXiMqXgOEGN9FpQp81r9F/LyB6gBy4KzohpFgIIaks9NetRh/9SvTRiIfaiWh/tR3B/fmm/gM55oW3n3dTNzqe4Gt0Mv2W+gaPt54ckuP205Dc9gPPIyvM+KJfVM2yw6Ytcq8dt6gQXjmsioVr5u6PFbmTR398qR8Dc4fSO3xViqIoiqI+RH4l0Ji1KRLM/GcQEneDhVtdfmxFV+IwXT+MWeSI4JSGk3zVn5WT0zR46brzLXOWXcWTqNLjJJiM0LxQXMzMtse3Br447156ia/6Xjo62AmGZ3Ojekj5Q0jCBcZn47rbSNv8bOpvKqGqYYz20ajMwXrJ5JiMAyNbDrElrRDSqYLI4oYf72k2YCGyvB2MQilE1CvIawoGG8ZjjXWFJzn++vFN/Swyv4+ZuaP/l5Ku6DfVD8NlHWFyziuABOTf9TAsd2K4/1as2wCJF5huGltF1iOyYE/gK1HJQDDz3LBwbxwK2lg5vjpFURRFUR8i8gf+431PMiuEpF+CmewOnbONr0kIWLndq8FbVOYptt1IaSCf33qbhUtQiqKdb/JRUq//jkd5BcKznDFgaSpOhrzmupQT5kKFcyw7yfSc86Tw3IpJXKjgF30r78KWmdO2JoKRCkRvxTDss87nroAP4mdTf0M7rVKCP10UAkY5G2LKlRCWq0LPxXWCfpkZlQoIq7egh04jRDVrwWg2oqcJi17GRVhxNy+GHBvvNCR6ciH7qfaW0IB+M16BmfYSYlL3sfhcVO6ThNYdpI3fNAx2bgU7ScLIDcyk21C0CHOzjugwGrk4HMxMd3yhH4sjjiW+fFWKoiiKoj5k90LKHwxZ7AtmuhcGqkRj18s65w6WXfHDltjXw3R98CCy5gpf9a1uuSXfnbncEYPFX2HKujzseVIdu8g8xEVjn0fyFEMbDFW6iSWHouAY1KXFL/KrjG7mXfp0eQIY6Th8ZxCNG84579SzAfXhWXcv8c6XhiEYtLEMU86xEF1cCUahEGI65RDWJq8GLeip2wwhORKilUrBLO4Eo9uIGceq4VrAvvP9+Byr+KZB2nuC6kYtdkdPeXtycmaHUSt8sOJ0WO5Nj5b3aotz7nGJ+WeSzpDcEYKwhtd3F53JLBGaRYLzDF9I7klGFcsu4KtSFEVRFPUhy2vrWmBwLgvMrFeCe52nHslGdid7wOhOZRgj7gz1w15Nde9wm8SrkLx1x+9kXj7/pPjSo+f5yqfuZk9/klDVOnNX4o+9E0x5DLGJT2G00zuHu9LNL/ZWpF6fDXfTsvppRIGZ6AzN3SlIKeveyc+m/iYsbgXcH6nvAxGDPJzNfo3Noa1gdLJISE6GiHaFYMATIe0SCOvXY4BRM4Q16khwbgajmYnV93IDuf/Z4Jt6K1Kvx5OXsTc9A/P0WJb96o5v6TSLp7F+U1c5QmTuQzBjb2DiMg+sOhp87d6LqG2kzhf8or+ItCmmvNE1bbReICJL2eW3PHMlB+v6tjLzI9FTMhx77qQUkzoD+OoURVEURX3oniV2HJ2yrUjQu4aQzCvse1VZkNHKnh+1xh8jNV7BPbL1vR5sIkFhxCrrhCvjV0c1c1fdhGf7YpyuF3R2+6dbeaRmk/nvFJw5tcDw1beykj5TdAcz3QYah0KbI+s6pvCzqQ9cXRc0Nt7JBbPACz9YNOFoYjeGmuSAkUuH0MJcCEkXQWRhMTk200lQrkEvY6CfCdBLrwgqR9LhlVgtwzf1q9rb2XFLVllhwdJ7eJlYOp0rI8eikHdGi6bJ0QjfeQauEBt/Cf1/OIwNB6y4od9/dfCTW8/jb32tfB/y+0MSSP2Js7d5pQtLvQQzOxjT18YhMp/91QcLKYqiKIr6gJA/+H1X36wsE5LwAzPjGabuSEVBe/fuE+6Vzz4nZUab0toqG9jv+Oq/6KlfxJAD119ZzzK719VD5iZE5jlimlEadt+rLvBN7NzIV+PWJ0mmL/mPv4rUHWxysyC6h5QjROZYwehsfHV5Jzubn019oNI72RkW3l0d36whQVk+AX2WVUJ0SRX6G9Si16IaiMiUQViKlCk3gFEqB7OoGcySDnxs0IAtTzoRVtTy5ph6F7tPexweIX0LwlNuQGOvT1Fy3U8H2HEMrVGQMrTJkjB4AKsXMav54l9EjssJauuedH8ud71zp3vZTKPHaXs/WfICQrJeYOb5Q9c8IJME83ca/IeiKIqiqA/I45Cmu98uiSDB+TlEJZ2w8lFRCAkGX+scyK8aONkHp+/k+5IQ0Iuv/rMS08sWme15BWbIUYxWdsDmK6lZITnsNrKcKF+FuWCdtN/kgCd2nvHirjyP5It/VRXLDpU9GNXKTLuHnnPssfpqWl0hy0rws6kPTHxRlf6iY8FFQ83yIapTBka9BsLaDRBeTF5NOiG2ogO9jV5DTK8LYlwvGprlEFpSDWZxHSQOVcEzs3Mt39Q723vH58BQ7RdgpL3QU9wB05a+qD94Ld2Cny3gHJs9+lVUrgU5NnvwRb/owOXE3UMW3McUA1tyeLK95Y9HpwhJO4BZ4ImZG1LwIrRyJV+VoiiKoqi/Ey4o7L1fkv2RtKegD+ap21MRW959wD6xfevXWt5QWBOE5DIY8dV/FhesHz/Jv7dpT2LjbdvKM+SzoHuwy08cFB95RO8gnyefs04sUlzh0DZd4xU2nYjKr2HZHwQLv4Mr3mW6k41fdTJTbSAq4QitI+GNDwLLF/KzqQ+EbWj5KrX9gRBZ8JIE4gIwS1+DWdIN4UWtEFvZhj6HgT7bSZlqLfqu7MQnm8h7HVJPJhKz9pfjbmTbOr6p98KdCGoeCa/nbgth5ILATLTE8AXPob/X7yKZ9w1f7Z2Q+t8pm7mVDVF5gY23ky9ZxVYYfGNMTjwX+KG3kh8snlfGkeP9nXqQoSiKoijqA5TciNVKe3PATHMCI+GNbbZNrSQgKGteiXbpNf8Zdp3L5R7sE+Or/ywuLHChgv/IeEbV681efAWTtG7ijHOhLZkvSuaP3XOz9N7MpfY489g/hJS9839n3/aoMJLakwlmKtnG2c+geTispaCL9pH7oUioql2nczIRzHwSXlWzwCxqg5QlMO4kCyHNNogsa4Lo2g6IGHaQ+TUQUa1Er6Vc93N5+Eg7DitOhL36PYHUxrvw0Dg9b2hdLK6YuiW4g5l7H73E72Kh6ZMu0333T5O2f/VKM+fAnXivoSqukNgV5s591t7jnsHM9QMjmYgRBoF4Gl+1TVCRoiiKoqi/JxJoe59wLIvrpxwEZmYQBusn44hfkSdJz+ILt6VhjHw0ngc3nuWr/yrS3tB1F9OqRWY+AzPRGhPWx8I+qnMfP5uRXG/pr7rDFpHZNeP5ol/FhSb3HNZq/h4SuiY/QR9pPyw/ks0F+iF8FeovKry8e7PWkTCIKZLjS6cKvQ3a8PlmYPjeVgxY1wIxg2YwCgXosbwW0y4BvZa3QUilBoxSFsYeaMdqq7oM8ju/ue3nXXFh+F8T93nj+ajwM47ZLxKB77c9jokeq/8Ew+RvQG/LNdd/1Xmbh2GVSt/q3MUw7ac47dP27YOI2mWjdYPJiVygYKRAqc3ureWof+fbkCiKoiiK+kAVsOwP8hYp3YxEDJj5AZi02x9pdZ07bPxeHxsuHw6dwxFsOctO5Ku/1V3vEo3Ruo4YY+CLA89qY7QORySsvpSJxKaO5dxVZ6Uj7vXDVC1hYdc4jl/knTlmNt0eZ+QN5vvn6DXbH5vOplRWdrO6/GzqLyajpH2P5tEUMAvDwSythrB+K3ro1KGfcSeEVzZi6MkuCJu0CXrO4Kbpd7ox9GAXGI1afLO7AQ/S2cwalp3DN/erSAAWKqpkR8ub3PL8VuNSwbea1wpU97gWrLuUeFdlZ3C85CqvFnIMDiJTz+eBMStO3Pc+Qtr/il/8F5H6nxpfCajsIXsR624GPiTrGa55rriSkUwCIxmCUStccMwm0pivTlEURVHU352FR/n9oSvSwMjEQkjeC+ttK0mmYCcYnkmMGCBzB7seJTznq76VjU+x2trTYbD0K+Fu0eBGERyoddbTx8g6A5oXitt6S/pikq4Tnoc0vfMV53+3+XbKlaEaTmCm2aCPxFMsNg9nb3tVG/Czqb8Iq7CKw3rnMsjx5AfRJaUQM26F8OIqCCsUQVi1Cj1Xt+PLE0C/9UBvrqu5lZ0YcbQdo043oZd+AYysa7zIsdOXb+6dkONtwJYT9u2fzLkCZtIj9JByAyPugD4KLuR4sYLQxJvQ3OUVzFd/Z08jS44M17wJJfMgkG2astkq/97QpSQ0S8Vg0LJkbLLKiOarUhRFURT1T9DAst8tvpBVKywfS8JGAkabVuJefJdFZE3H+HlmHpi6+HlXUGLLNL76L+KC8n3nuGb3iNzjfBFzp4zd+blpJJgpkRCa6oVlR8IF9ziTuv25q3d8tXdmYZf28jtjro/nx2DmOmCcrg/uetQ8Ju19xFeh/od2W2edGL8xDIwmOQnTLQdj2A5mWQM+Wd2Mz4xaSeDMBaNdD+HVgJhuB0RUWvDxdvJ+ZQlEdMOgcjmj1K/s/U+suGPK4p6/1cJ1bsW9Zj/HdLMcGN+oD1I8GpuktN+Tnb7UlpVY+gCnbnoeJ3WF+MXeKq+uS0pmy5PO3lJXsPZavGVURavBuDVR7ULzvNBbPhL61ysq8zrf/ao4RVEURVF/E3ZZHfrTd5NQMz0GjGQqJI7ndGQAMne9mu6MUnbHsoMBsSSc/urIalefBKhvvuDYeDUw99B+57Rzkze5ssxMW4jNfQXt47HwSG+S5uqdvphxeKO5V01qce17DRhBQs8nB9zLj0/aQsK4+Eswc9wwWi8SWy4nhJLte6+eEqg/TnEHO2XdhZCIIYvJSY1aHBijJohtAUTXAx9tY9HTsB49NSshpFJKQnUleq1mIaxaD0aiDIxGKaafaYTu3aTEh0mNY/kmfxPuGNh5JzLewCICHvHZuuRzbzINi69kv3viFHfc8qn/O/8PxbqrPn79Fl6EyYXwDK6NZRezchhJX4jJBGCqaQxOvyzX5KtSFEVRFPVPQgKp8E67nPgBCgFgZoejt3oUtjnVJJDyESanE4sGKzyFuU1KCvn8q1eJjz30WrffJqp65a0YjFCzxsK1njhonREWWNWlQZYXcUph9cWXhjb3G3cWqmvuNrgmVL/34CbPM5sP6JyIh5C4I5i57vhMxRuml1Mb7gS0GvJVqD8BdyITmMMeXXYis6u3rBd6kNAspJovuKosZEQOKr129FjRDEa9AIxsNpmywCjnoOfyavRcVAkRuUx8syIFZz1ruN4z3tqDy8/xDMnavvdK+PU7HvkXn0fWz+CLmcceSebbzj3Hko0nHG+dffwZX/zOTtglKo9QPYsFm+wqc1l2jF18tfVw43AILfRHHwVPmFyMD+WrUhRFURT1T1TNsuPW38zsYmZ6gpkWiikbSuCW0XUhv5WdN9UsBMNJCL7vnvWEr/5W3JW+iApW4YFXm0J+Ffum72Ubn3qnBWsTwIy7g6FydjA7E4bIvKYj/Oz3klnTuWvd7WKISPuCkQpCD7kIzFwdg9N2advJ+umtG/9l+UV10tedK1Onr0yGsHwGGJUi9NCphJAcCchyuRhg2AlR9TrBFWYh3UqIqZeQ0FwI0aWlYFTjyW8WhTmbi3DqadV7//7lbfUj9z+J9Vm4MwCjjGIwRC0C47Q9MVfXNtHiWqxgIJKQhPSF2y3uW63e/rBJW++UOQnmwoKFf0UL2zlDYcO9qgm6N7DrevwUcix9I3c0GIz0UzJ5Yv6uOASWtinw1SmKoiiK+qdyimvYIrsnHcyMCDCTw6Fzvgb5LKtyM6DxYf+F9pi5wrvzZkjn6ve9Osh1cXfLu8Nnul4+mO9c8ZWue+Mh5zJzEkrGcm098knzck0umc9Xf2fpzexKBfOkMmFxdzDyaWDmxmLyqgjst8zlRkIcyFej/mDP0tmJuiciWz5TCwIznYRK5XoIL36NnjotJFzmklCcjl5qZRBWroCQBvnNVZMx3Kwaix50lCrcbooRU/KB9I50XPZoPsA3+V6Mt96xm7raESvuZmXq3Oq4qnq4oqq/RBKY8Z74QcsD5lbxb0bx273POnD1mvMJ73oyteG8e9B3mjex72HkC+7zQdt4j/7yDmDmu+GzRT6wcC50FlSkKIqiKOqfjbsq55bU7DN9XQGYqVEQlo6B/PnCbBI6ti67UNzKfP8Uq22q0MX+/6vIb/PYL/qzQ7Yhp5UsPLsHqnlBeKo/RqrHY93dgmq+CnPqecXdUSpPYXjYqzarlZ3LF7+z9NpW/TU3ciAi7sffCpCL/krh0DyQEBdZznJd4fXkq1K/Ezk+BjyLrTu67GpBB6MYCEYhgUxZENaohYhmHXovqoeQfD7EtLj7mYvAKOZDWDYFjEQ4Zh5pRNxr9p5zTv0lgzPxNS5R5b9p0BArxywFZX07dvnu8Efkt+3NleV3dUmP1wpCf/EYEp4fQ2r1/faIiFTBiRNbVdW/ItlPMKrlr7EKqjb4VucepM0el3JB2ze7YdM046dgpjlCbH4IDj/KqiPln/PVKYqiKIr6pyPhqM+Rl42eA+QiBIM89JKNwPGX1YVZXeyt8eujMFjzOR5FNzm9SyB1ishfqG/hDWbKeRI+bkN1t1/91Vc1phf9alL2vshxPOtWe3+CHglWgx/j0zm2MNrvBt+4/GXve0W7rANGR56UZc3YnARGLRWMXDxEFSIhvz8f++9l+pJtncJXpX4DLiw6p7A7V51LzxmpFwAh2UgSlEshrFYDIaU6iKoVQ2xRPkS1C8Go5EB0SSWEtbkH/0h4lq+BmDwJ1pIx2HEvs7iGZXVJKv2ab/q9Hb3kkzVV5i4cwxsFV5UTswumn74XGXj5cerLTefSb3wr86j1a/lrcIrLWyFY4B1VsqyE9rbnkFpjDcfUYpW8UnbsYvPEVmaCLZgZDtA8no3yLladr05RFEVRFPUjEiK+W3Yhv42ZHQBmYgS+08tDcEm3q2VSy6thJDhJb0jAE++6N/8d/jYXHatXTjXwhsxm38qY1k5B911P0hp2zNqShgEL/MGMfoxJ+jHYdq3Q2+x85IvDD9LxKrzykGDh98BdIfQsZLfr3K6AsGo0mIWZYKTz0V8+GsuPxHRfcs7bQwL5ez8o9k/nm12z2uxmavH3qzIhrJiKXiQUiy1ugpBaE0TUWiFMgrGIYi4J0nkQ1imDkFYlGPUKMMolYJQKyO9Qih4qZVhyJKd737loE77Z32zrEScN4z0v68Oyy3QLaln1DeYRrMoqy1R+NqO3xv34aOWneBJaeokv+lXk2PlS38I3cayWFS47VSqS42S4yZXEoh6zIiAyIxWTNmbjZnjVHb46RVEURVHUT/lktj+Yva2IBOcoMJOjIHm48HUzyxofcWv3GKQcDK2dgXlc4OCrv9VNt3yPa84Fgq7AyDJfaZtnevWcFQtmgjdmr/d87Z7eYMPPmy5uFgmpNT4tr1Iaf9PVvbj6jkV6p5IThixKAjOXhOf5XIAOwzcrY6C9wbfUOaD6AFnPIL469QtIeOy1/UH55knryO+vmii47aLv6g58shkQ0m4gwbgCQuqVEFIsJIG6FEKqtRDSbCFTGxj5cgjJ5YORTMFAvXSoWCRlkIPlN1/1f/6yXE1/pXWYlUPUBe4z+f0GP4tIMFHb7IFPZ7pjxdmSm2R7BcNza5q91Jy99Hm3dVCRIvf515Dl+u0455X2qcxtmF6JT+PKTnpk2A/Wc4HQ7BQMUanABa/OLHrSRVEURVHULyJBYcTBp1V5PcWDwYhHoadqFHa/6mggoWX/yhu5BX1l7mPN9SSui7oR/CK/6sqDQN0V+5zrek6zhsjUAOgeyWl3zu1S4+ZxAWb73fiCXjMcwMx4BJV9XjjzPFNHsOB74oLxNadKR/mdafhYMw2MEncLB5mm22GKgR923k4r9ypgl5B6v/mWgb8rsk/GPfavvKp3LD7hG+NkiGqXglnSDFGTDvQ0bEBf03ayL0vRS68BvZY1kkBdAGEVEpqVmsh+biABugqMTCqY2d6Ys7kAZ93anrS84wnW/0W2pffj57G3N+32xRyZKzC/+BKxOTmCbuc2XbO1HCJzDcx4O3xvFPb6lm+p557bPou3nfdq33kp4KyggXdw7mHGxUEzL2L6Sme2Blh93qcqbLiJN/kuniT4R0BmZ3bj77m1hKIoiqKof4i4mu7FOmdLwMwlQUIqCp9opWOLY/WLKrZrgcyhSPSTc8B1l/Q4vvqveuGWZClpYE+C8V2Y3ctrKmljZflZzPF7KQ8GStiRIGSNsasD2MUWkR7rzvi8tnUKedM/7/uqbGXFD9oVO0xcn0SCXRQJdF5gJFwhJOmNqavisf16To1/VtcFEtDG8Iv8Y5F9MN2lqNNy8eXk9lFm5CRDLgbCWmXotbwN/Vd0QHRpJRiNYjBct3Jy+RBRq4aQGgnO6q0QUqkBI19E3nMDnGTji9XZUDkcx972bz5ETogG8Kt4L2S5Pqevh/rtOuaN+88SrK1fFUqEJpXMS6uq6s/NT62sm7r1YkDx16ruEJ7zEvO3hcPolD9WHrKzAvwEV59/TWBy6YUpi55CbkMkbnqU7yf74KvZ+7iu9WJIcI7DiK1puBdR7sJXpyiKoiiKertb4c3b5+7JI2HXA8z8YIxYGcs65nYeiKuAueSuSHyl9QgX3avP8dXfioQh4fvuhY+u+FahjGUX8GVChxxqD07Ri0GPGT6YtjYCO1416ZFykf1WqdA64ONM3r/34Bj/zi6pY+Xyi5n5g5aHg5nlBmZhHHklQXpeIMYZhWL9rdSm8y5NNz0yunV/77o+NCUsO++yc7Wd2q6QrtE7CiBqSALwIhKOVcpJUK6HqGoZ+ulUkX2WBTHNCoiplkBoQSZ6qFVCTJl7OLCeBOla9NCqQw/tLEgdysFRj8aH9SSI86v4Tc7eTd46Q+0VLG4mreWL/gMJuqOvOBQ/2341NdAlveFoZvn/PxH7NSlNbTIym20wTOYprrv92C3eDq+W28NW579mlLLQf3EK9njXRpN10D7BKYqiKIp6NyRI9vDL7PCZsyUFzFwXMJIhUDtfAxK4TDwK2yy+NPDDD8t9cN+j6Bi/yFuR9oRZ9s3tGT322RU+G2UcSoKsE+ZviH19w6t2GTePBJaJCvvjXs/fHo6QMnY8V/Z7kPa+vRHSECi9P4EEP+4kIASMVCx59QczxwUD1YMxe30ozjlnByVVdEziF/tbIvtiYGJB69bTL0peSW4MxWCNWPRUSQejVogeRh0QXtxKgnM9hDWbIEICMaNQDCHJTPTXrkUfrRowMjnovbgc3+97DUYpk4TqDHykWwDNk0XVyeXdv6lv5v9r2Ub3l8PmPsXaszHT+KI/DPn+PU1O+xUOVrmHEw+zBPfXnw4oeDJmRyo5JsLQUzEeehfyW3MaW8UFC1AURVEURb0rEjR6Xw9tfDVoaRCYBb4kKAVD3qKgqraT3XPQp8HrY1VHTFxs13rTtVqOX+RXNbDsmK13Y3OGa7qDmfIAMza7NNwILdfkZzMHn5c/76fohFGLHGBhWzaehGwht6TS26+K2kz5Kr9JSGWX8g7L1Pwpa2PATHMloTkSQrO5q8/ku4m74xMFF8w2du5S2e7re9o+y8c7n11Jvv8HfysH2X+fPM+s07kbVv90+Y30gonrgvCJOvnO84MgJJsJMa4nDG5obLUSMtWCUW2CkHIDCc5NEFatRE/ZHPRRLxe850YDZNRzMOcqMP94DebsCoXp3VS3sFJ2LL+6322G9NnnoyQdsPdK7G2+6CfOn7838tZdW1vy23zKF70Tbj+s2Bvg+eVCZ2y+menHlV32zVw3Yzc5HmR8yPcOh/rZguq4uh//R4SiKIqiKOq9cVfpNtmXlIjpRZKAEQhh2QisvtdaTMoXrLQuedVT1gXSmwPbAvO7VPhF3qqVZb+65VqS9bWcP0bqBOJxcv16fhZz5EXtja9WBIOZeB2K233YgPi6b8h6Bq69Eo6Z613xMqaCu33jY776e+PC1h2/6i0Km8JyxuhGoacECUyzySQeDmZuNAnTMRCVCsdHav6Ysi0WZtfjmh6F1t7KaGW5Wzne6f7ZvwLyPfsGl7Di+2zz7KR2+RRP2haFAcb5JPRyvWSQSSnnxyAsSyaZMoiqFKK3Tg1ESHAW1iCBWaOZBMlqMBpVJGCnkBBdA7FV3WC08vCZWS7MA1o88xrZ01ldf3zIXG8esOPzuZaYqHW/+kVUpRJf/MZyw+N3DFeZl5PvKLjn+V1tvRBs9Z2KNdZYRLWR37KPZ17NUqn9Aa+FlMLIfknCpKN5uJ/evYSvTlEURVEU9duksKzEqueVtT1VSMic54Eh2snY597sSMKLpMnjmnYhqVdQ3xvS8Tyo8c2V47fhQuiecxXmxkcy4JlUHuCRUX3d5HyBy9c6JMRMuoIxq5xhE1RmzdU9bldyetgiN5aZdBMjNZ7g8rM47v5TwchxvxUXuu761G44YJ2ZKXswBT1l/cBMJZN4JgmShWDkUsDIh5Bg6YZhK4Iwf1codM9FxLxMq7wekNK6pIZlJ5A2BvPN/SWQ7Zlw06/iou6JxOvGFxKzppuRsKyXRMJuGpjlJAAvIkFYrZyExEoMMOxED7UaMNJF5ESoGCJK+RiwpB7CCkUQ1a6HiE694PaNvkZVEFtSAka3HJ/v68LEE9VY9bjIlvx+Ivxq/3AVLDtKc58vmAnHsHCdXfvpF+VLuXJunS98M0y37nmK5UY3VQWV39GaY66bv5S6DM1dL7tKaxqUrOKbBmkdT2N7ysSSE6YIjFidjE3PS0/x1SmKoiiKon6fXJadtfhiSoPQAhcSMIPw6ZIknParryaBbY/u1cJakdk2kFnj3H3Xr0mXX+RX2fmW7919JxYzTZ7iE7mX6CfrgAU7PXA7JMeDBKVenvnsQukdid3MpHvoMd8KS/YF4eLT5Hce4OLXkG3vm9vImp5/WZqwcEsYekiS7zaHhDbZGDAKJFQpxZP3JMzLeINRdMaIFf4YY+gJ8W0h0D4cXnbGKd/NIbzM7WUiu7H5TxylkGz3MDIpkX00JK+9S+mgVYq7/IGIzpGbS9FHO5FscwJE1EggXtICRq8bokav0cewHX0NuXuYyyCqXgFhxUL0UCmBmHIRhFQK0HNRJYSVyUmDUh4Y5Qxy8hCJYVvLMM68DFN2x7bt9at2sUlsNibrFOY3471IyZuaKi4+4XbtWcJNbr/zxT/rXkTNYrmNDt1D5l/Fl9KnoGR2PWHTiWeFuuvvYt22h+81ZPdx65hdIxVvQmWLa0d0RZc8V3bweX5sb2XyG8+PJyeBMVhxIUVwkkZRFEVRFPWHSalit2tdrQCzMBqMdAo+N47D0aCylyQIaa24UVrRR9wBU4xf4Z7fuw97HJHXMMfklNdV9QOeV0955l5Nb2CXk3DWg7T56ZprsRk95j3HAFlXrLqRWtgESHHLeGWUy6w99Dh58z47M1L3d99CQdbVs7SD1T9qmxkheyAeH6kHkgDtA0aCuz0lBkJy4RBSDBXcqsJIBpB5wWQfROFjPbIPlsfj+7UJkNoR0iWxNTDZ3CYnzPxF/Yaz3i1mJ5yqzI4+KzbzTq0ya2pqMautb1xXVFQ0jGzzgF+auO+dVtZgFJlfbxZS2GKW3NRm5k1eze3KzK66lj0/51KYrH0ypmrR6RRseN5SLneirL0vN1CJTgkJyW1g1Jsgpt2O3ppd6KHaCmGlJggtLMFH+q0YYEzmcyP7CaZiiC1thKhuHVmGfNYgExeapRIwdF0lvtqQB+3blbDwrb2RCHzP76rfzGTHXeMJchfwg8YzbDwVdpUv/kVJ+c0qV58WBhrvt2lYdeB+yXztgw+3HXn+XleF3WJzD8zQt8K8tZ54EtclOHbOWpaenmaWAkYtAIOMg3A9oCaxhZyICBagKIqiKIr6I9mlNx+cc4DrlSIKjHgERpvlwyqedSGBT2fr/fKUz6VsILHSFTc86n/Xw3y7b2eeHbnID0Izn2LZpeysIpYdzZWTcCm864533CdTzLFppyvIeoeS6Q8JPqRtkcwuVue8c3mA0lb/+m8NIiCsEAJmnhsJ0SRILwgngTkeQjLcLR0FYGSLIaRein4G5eihk4GeqhH4WCUY41ZnYOL2Aow0TcbXBpGYtDoS8nvSIb05DuN03RsmGTtVz1nvVq1sHlm99GJC9aJzcdVKxyKrlSxiq2dsCqqZuSEQMzaEYc62RIjvzcbUTWkYaZSMYaYV+NSkFoxKMgm5GfjhONDXoJlsRx36GwM9l7EkEJOwrELCsmINRNUbIKRCTnRkssgy+WA0ucBcRF7rIKzTApFFXSQ014ORTyPBORWfLk+F9NE87HbvvLs/qHObfwMr6AXlj0D27RCjY+SEY7oVZLZHt5HfbBQ/661IvYFk2V78x3d22rXquPjqKMw09MaL2LZVXNmLZPai4gHy/SXdMXB1MNbYJ0eR9v9St9xQFEVRFPU3cyUs98r4TUlgZnOjC0Zj0u4SHPGpEtxCcdKu2P6jWdaQXOWE6k52g2CB91RJQrLMetcm5ru7WHQ4DomlzW8eEislwVZu0yvIr3zRERrapVDYykqYW0XX3nVJvUsCVh++2u/GBTuP1I4z6+/nRWmYh4AbglpUzpcE6DASpLlBVfJIiC6HmFYdBqxoIwGbfJbPIqE6A8ILUkg4iyZBm5xgyJOQK8n13JD44yQVB2ZuPJhZpIyb5pH387lX0qYkmbeQ7FcJUiZBXiWzyVRM2ikn4ZgEZqUqfLz2NfoYNJL3hfh6fxc+NiHBWa4UoopczxdVJAhXg9FqAKPd9OPEBWONOvRa2QaxpXUkLJMgrZaHnotLyWsOhppWQepwHjTPZMfdDqlzi29ktfld8Ififpvd95Mefab0FD0l7WB6MjiclP1XHrg8ZpV77rvlHpixMQ5OSTjJlRlfK7w5YSP5XRScMGh1CHa6VQWT9X8iWICiKIqiKOq/hQSOz15lt4fN2h5OAp4zCXVeGL8tGo+LsJubf+RRdsKgudZYdzATacXse92TyomsZSWnrnyIcUtsugJy/383dGS935seC8mds+Rlw0O3ZsH9qs8iqm99u8gfY7X8obc7wc857Mf/kv+jkHUKkRA93Tu95fSOR/kRiy+nd43flIE+S7j+j0lY5sKwxo+hmZEnr1x4XciF6jSyXzIgqpQHUe4+Ytl88lqCnirVEF1QjR4LatFzQQ16SdaSiXyeVwmxueUQlaxEj4V16CnTCDG5NgjJdaGXOtBLmQUjXQIRrWJ8ZNYFsZUkMGuTsKxTDiHFHBKkc8HokFDMDVqiVUMCcjOENRohokrqKXIj/ZEAvaweH5vWYMjqBCw4noQVlsl19xLqrQo7/pxeQ7irx0esYksGSlzFV7L3cflZoR4/6w9B2u99+EbN1ZmayVDcHoMXmWVHufL196rujTDKICd5z9FfzQHLriT7krp0gBOKoiiKov4c3NW6h7EVgd+ZcVdKA0lIDMbCgxlwyu7mhjAeddquNuLzOfaQXeOBR76lB/nF3kkLyw5dZm5XpbzZiazm/18V3HMtLHbJNi/ctks14z6HFnbOlNgS3MzM80b/hX5YYlEI0wsJOHo/xP7fl/ujkDZFyHf74WVW674Nj4oemFiVF+pcrsB8i2p8qpcAYfkICGmQgCZLwrRCNoQU8kmwLoCwGgmtKk1k6iABt5UEbFKuTCalQggplZBAXQZR+TIIyRQLhrUWJmVC3H3IClz/ymVgFpPlF9VCWLMaQpp1JDA3o8dakuiXtUNoUT1ENEl45vpY1iXrUC0k60xGf90iDFyWh3GbyrHJFVC9WAfVc8XtqyxzYjfZl+5LaO1eSr7LH36bAtlHYqTdX+wqjsz/fuedhFzhSechaWRf4pnI/q6RBv/dhsveQV8ru0J3VyV809i9XJmFR57VqJXkREYyEsIq3lAyD4kh29BPsABFURRFUdSfhQtIp/1aPEetIgFvdgSYud6YYRqKXbYVXJdlk4/b5z8fqfMMM/X8cPtF2zuNMPgvbtEF4gb7fGP23E4q2G0Z+VRtr1OIxs5g2HqlXCVtC5NJ1NyyKKWXpBNE5J7A9EZceSHL6hlfi7wis9kWTwPSBfe1/jeR79+XhHwdu2RW74RzkZ3p9ZSgJSdSymZujMRIk2wMMchBLy5Iy6WSsJxLJhKClap/DM2aRSQUk0mWKyevqty9yyQYc93EqVWRqfzH0KxOwrQeCcVGJDzrN0NsRScJ0q0QNuz6sZ56OT5aVoGBS8vxzeoWDDcswIL9+dhkXR573Lso6HZEzeFUsl/qycT9Jvym/1eQ/dH7wlXvV4dO+GWGxDdJ88X/wTGmbdTcVU/aekw5D62trrWtLDuHn/WbcMfDiq0OVkPkrmHhLr/y8JLuzVy5XRz7bN42Eprn+OG7jUXYbFvR7F1ARwWkKIqiKOp/hISlnhbObc7j9HPAzAsWDKH9uWYgFl/KyCXzht0Prz4kvioUYxRdYB3c7kfK3umhME50ND7bfDr8+YEHoTC75Nt02bH0zbDO3mmdpuN1w8BMtsLsbW4tOS2NgntzTa4l7hkocxPGRzx9BBX/ZOT7DXXPZ+feDmzVO+dTZm10rdhe92xq6/SNMZi8PQPDjFNIuC3GmNUNGLq8En1VSXCWJeFakYRphUIIK5ejN3dVWT4Pwopknkwyhq+ux9gt7ST8FWLm/lLMPFgJyaPV3dO350FiR1zRipul1tuty6xfxDRb3/Js1fepYOeSMCnEb9J/HVmXGLe+lx4ZGxWWWqPPNyegvc7pLj/7Z931y90wWOZ2V48Jp7F4zdVEN7eAL/hZ74Wsd4DRQZ+nX8s9hsKWIO6g+5orv+Bb5zLTjJyMzArDIKNwnPVriiS/jaRgIYqiKIqiqP8VLjgdtGt4PtSIhGc5rtu2UPRTjobBhbJCEla+Cc1t3am0zw9fqLlj073k/Gr2/YZoJm18TaaB/EcmN6tLbekez9fMxLMYu9ofD4Mb93HlZDuGaGyJqmVG34OReVS+oPJfANn2r1Jr2DnBJU1HLniXHTnjUHXkqE3DEaNTRUd2PSh5ZvG8qMToXmrJCsvMEsM7OSVrHpaWrLiZW7L8QnLJnodZJUftGy9ZvGw6cju07kgKaSOyrEM3lWW/Cyxp2/Dv++XPRtb90Y07YZf3HnpUffWue3BSVt2CvVfCs/vPuITJ6uea4/LKRvBV3+CCLvdKlu0tbebeJjTuIrRM7iEpPvOdRp78d6St4XuuBqeO0HKCzpl81AGC9W16EOH11VIfMHPC8MOmcuzyqKgqI8ehYCGKoiiKoqj/NRJiRNZblj8ZtSbmx54nJGPQXyYAi0+klOeQkJfYyK5ZfDgJvWStoH4hvNSnsH07v+h74cLa2nMheULTnqDHXBesuJTqzQV3bt5u+8pHg5UCwUy3xLZ7USGCBf4Pvzh87JfITv9fBs7/i2x/n1+auIDJV/vLINs06Flg9i7djZ65S7d4Y/mm25lbD9zi/jehL5mG6R13ye4zYwM2nXzmQL7Dm4cOue9z4rZL+J6zHjvJe7Et519WbTnjjsT87mV8lXdClhV5FVZsobXtZeVE/VfY/jAzJpllpYNyWlTXXM6N+lzdkYRmBww3TMBhl2Zrsk3j+UUpiqIoiqL+GkigEbrqUfhQck8VmHlBYOY6oof4M8jti6xLb2YVWll2u+GN7I7eataYt94e52wyz/CLvjOyjgH6pzyyh2lEYbxeLuxjf+zf2Su37dH0TSS0T3DE1HV+OO2VriBY4P9IymvRMt7rBcWVzwouWkWt54upd2D9wMXEdN0D36O3Epp0DoSAGX4B2ntD40kw7clXEfDOytMYqXKic7zKNbwMLjLhi5mkpIJvp8kfhKr+5XayzGCLsxbfJ+XEzuBnvzOXMHaFpL4jhsjewWmXIjvSVu+2NvYbzb1p3X2kPMHMdkRvBXdse5haTOa9dZRCiqIoiqKo/yn3bHaX5qGc+v6KJFxxA4fMc4HWiTyElrKXSJD5bod9YfRA2ef4TuElNp3LvsxdieQXfSeltezXF+zrHh28UdF+xb7YYu/15y6qe33x8Qw7qK2Lx8lH1YZ81f/QCGjIrXMF881ZTNd6CIvb0fRhsXe0e+eZWJVlZ2HpmuW19U5uWI9xDzFl2dP2nxt5T8nMxbrXpNtQ2+TZVdIqeDBxyAOXxOvKi8+1bd3zLIIcB5/yVd8ZWaanVVyh7WTdZ6+/WfAcVxyyvPjyT0325cX0k0oCMysAHy30gNGZ2LzS97wliKIoiqIo6n8iqoSdt+ZuWU1fTW6glEAwk55jkn4gjtqUPCFBR3HPs0avjxVdMXDBHey6FZmZV/f+PT7UNLETHrrkpBgftS5Ybu6eePph3quoJFaOn/2zrMO6FEdqepLtccJQ+WAYHcp4M7gK2a7P7UI7JtiF1kzgi/6RYlMKZJy88rWNd1nvv/Mi/mpgYokGV75h64kpz7yjrnPvPbPZ0ePUnJoHzDyPLTf9/+N/Dp5FNaqPUrEFM/Eq9I5HYLtlEB54pBaTAP099z8TfLV3Rn6bb7ffDHUds8IK36jexubr2QdI2ReJzayxyaXc1C8Uoshx5o9hhonYZ5WbUVCPkfyiFEVRFEVRf30ZnezM/Q71lZ+pJ4CZ7A/mWzcMkQrA7vtFxe0su+l8dKPttA3P0Xv2FWhvCK+KzmNn84v+1xy4mfhgxoZsCEkEY6h6HrZe/3FYaRLmemw/H50+VvM5Jms/xuqDPoHZZR3/qHtja2rYr06c8zq1dqsDbttllRvu9MIg2XMYr36RveuRe4ev9saqQz7eQhOOYb6JdWNkFvsVXyxA9qfwwpW3or7XvgP1fe644pHqUsWyQ/nZ74yE475uAeWmSze6tAyXsYPytsA0/+yGE9w8i+e5fnPNciEiEQ5G0hELTyXhpF/9SS5QCxamKIqiKIr6kJAQM+m2V2vx15rxYKaTAD09AiJzPaB5OhuBtezpGpY11T0e19B7jhMkVvk1eyQ33eGuSvKL/6GOHHkxTcXElr2b0Jo7XD8cnykm4EXIjyMbau6Mu/7xAncw015BbJ49NLd45WaUt43MKi7+6uRl21tSagc3bT/hs8E3odCMfKcfBA1+4LbvuTHvxIlHb/q7NjY6HK+rfwXHzvhz/XB/FpbPahteja1nJl/ED1oOWLH7xWq+qoBDbIneOB3L7gHz7mPd2YhrfPEbD1wCd956Ee5A9tdcvui9hGW2ye46E5w1Z5E9JqnZYd+tXO5B0B7cvKPPc05PWBkFZlwomLmhWPmoFHHN3YLeVSiKoiiKoj5YJDiNuRfQmjfRrByMVBqYOdFgJjlDclsWbgV23CBhaMR625SobwzcMFzNHbuvJZWEp7f94gAav9WJ0+6uW455F5DtmTF2hU+92Dwn7H5QHqW2L8559LJY9FaOAyPuh29NQuCf1ygYee6xffTTeQqnsGS1DTYcDsbKI2FQXm/Tbumc+oC086d2cUbWNzQtP1+7qanpvUf8I8sO434HMgl66eCuCBsaXa6SkTZHejQ+48pWrTjtYn7Y9ie9kSSwrPqERf5dwsPuQ2PVc657wc/5WYKHQbX3BGYy420xXcez+eqT9IX8rN/NNbxdR26dS2tvcWssORhZ4ZPVbcCVJwPDd9vVHB5tGAtmRgAGqqRh673q6vJ2dqtgQYqiKIqiqA8dCVxfO6SypxTNK6p7K8aTgBoCZmYQRpkUYJNN430ukJ0I6t42d3sq+i1wx5xVYThmX3GeX/x3O3DYVXLxyhe4/ij+AAl80yQ3B7cy415iyAI/bLuW0Ho1oi32Yx0S6KdHQnV3XFV1C/slt9yeE3Zbdp/04kLy9CaWXbjfMm9L7xkXMGGRF47fTzslaJy4+7B4ypZL8Qrb74QqpHSxC0n9j/hZf5hdt21tldZZw3Srxw2+6BeR7/jZVd+UvS5JVW4rdkQ5aa5xrtPebo9rDlFH+PlCalonbi42eILAwDpB4M3LaxtBtvtLMk/Uy69N4eXj4H3XrgYkrd6XBdFvHTFTzx124fnjuLr/YnLYw6XHyOsYLfECh6+GP+GLf7O8Nkgds6sMnbDMHl8tewrVc/EhZHt6ke3qecWp+tGs7YmdY7YWgpnvia/042HxqjGRzP+P/qIpiqIoiqI+eEG17KTVt0tLPltCQqpcBJg5PvhKOxyGZwu4/9IfX8eyxnsdGmO/WhyEz+SfwOhIQJhDRMdifvHfhAuxm/c+LPtu1hnsPR1wkQStITOMn9f3nuSMHedyisjn4WtvxF7oJf4KE5dl4Z4rq8kt553SKB5dBcGDcf9C6vZT2RTVxnxjhyXmPomk7f7XnuTvmq52rVvngG3XtrtBUN34HNrb7uTY+MT9QOqLXHgcbnDDu25lUE6XDPkseDCOvIqSaTKZBLcevIsdDoEHP1N6Bsml/qX5lT/exxsUXTLcxj/f465XSkRUcuFMQUXi2nOfW7ONz+KMfVrlxmORGChuC2bcMcxa97I6JL9NEJTv2sfHHL8XeVmwAO+atY/F5tMxaftORDVE+Beed3WIXP7IjVUbLOWFYXLWcApL381XFbC47LF86xGfloNnkxz8ktGPL/5NUhvZdaoHPVr6yjpg6iqHtoueOTe5/ZRU1bVgy72imLHGqWDmBoORCsRXBmG4EVgdS/Y/vZ+ZoiiKoqi/LxKGvrd4VRUzdVsShBe6g5lhj37SXtA+Gsc+jaq+SuYPP+dZt03HPBhDlR7jB103bLtf/JCU/6aeEshyIjHJhSuOXwrMv2QZLRgK2tT8efXyHZ5l/2rT4EBMDTPqFlYejysjYWxgRkqlhM4a+87pOm4w2BNUsetioPUN55TLAbHVhuqbS7KYkXZQ3OvWllfHbp62yBtj9F0Q2cVqV7Psl6qmjv5fyZ/EiQc+5qR9MaU1jzFS0w5yplZ44ZcmuDq6efPD6avN7ndcuOkjuGpttstGc/NupyenbvqEXXoU8LM9g2id9bvWU8YNg+QCobrlxS6uzOK2r8f4Zc8wcMEDHL0WlyKoSOw6b12hsvZaXUQq+x35Pj9YOJRbDTdyQu/FHlh6ubJm892qY2anI0sL/u2BvatXD/UbMWtz97fy9nCJanPki5nVj/HZcFVb/KB5rysgKn8qXyxAvh83SMt7P/T371ySu6SNz4U4zdviiM91H8HwYkx1DcsKejYJDy83XWEehj7qYWBk49FbJRni27Nx2aPal6x3kKABiqIoiqKovzMSuITtkjv01j8sLv9CLwLMtBdgJj/B8MVeML2bX1DEsrNJMBLfeC/vtMzORAyWe4bF214WeCS2bOSbeG9ciCWTYCS7omp2Vmk1O5Z87nfGKtL980mP8JWUHfbcjxXc25ySWGk8TdkFzFf3YXI8ovPQg9j0zZfcC9aejcXnkr5gxjhAaos/4uvZ019oBDeJzXOG8f2c+kqWlSDb3feETXzBmiMvx3DtL9vj08QMvYEpOk/hHl0iePBRRe/mnOkyF2Gyw/kB99n8gv+zETNuYMSCmzC/HXmJK/u/tlglnBuoEoJ+c5xheDL4KFcWml1tqGse8FroBxt8r+zZ6prWoMqVH7rmWH3ogstP7vvdbFdw+tt1oRBd4ItP5b2gutWhhWyfYAhsDnnfa8txr9Q+485j2YGAsrJOdhZXfsY2dt0Eg8cwPuF1U1DxD0LWJ/TAvfDmTIMXGChnDZVDvrCMq7bl9l85Cc57LMusJVaHQkTcCYy0L77d34T9bl1wTGfX8k1QFEVRFEX9c5CQNPFecHPejA2xYOZ5g5nggR4LPKBwMLnlZkjTKTJ/TGEnK7nyTHzmd2p+mKzhgIM3o8Lt/bL/kPBE2p9y7lF4y3eSVp1am7xqyGfBlU4uvM3R9a7sP9ceF1zK39yu4ZrWbPuFmitEpzhDcXdKSAvLDl37IDe7z4IoMFOfQm2fb3l+RdMGsrxggA/yOnj1gYAmZrAVdLcF5nGfufKl2x3nya2ww/0XWYJ+kZ1CMm9/IWGFgQudsPFq7nGu7P96GMlO+V7dG0MXuOKEXYE5X8x4J9fpLNoe1Sk87gGU9r7oep5WuyGlqHZ5ekmj4KG/f3f4edGxYZrur4Um3ofpEecYsj0/GdK7gWVHb7oQkDVB7Sy2HnOEW2BepsnBF1h10imA1P3DHoa8/CpPb6WFW/yExc8wy9gbJ+zzuG2ZRMK0SFYNu9XgQuLrAUuSwYhHodeSDMw7kPj6UmiLbTXLvrkdhaIoiqIo6h+Hu+r5LLF94/Lz2VVDdRPAzHghGDb5q2WRWHE1u9Uzu+s8CVW6d0NYv8XmcW0jVGzwvcpF7LgSfIWUc5yo388AABTESURBVFeNRfimfhPSxqCYUvbr0w/yhvBFgquhW2+kW043dsM117QNfFmfxccSA4WmX8F3qyJw1rN7O7dusvz49bcbYr7V8QUz7jj0D4YhJPnHXkGaSFCWW+nR1GuSO+SM/W24Ms6NlzF3Zi16gNuOeYK+q/ec9xcfLPMUfaX9oLI97GeD893gzukTtT3w6SxnGB4OexOcOb4JLeoSK51bmbEnoXUgHLXAcH7Wf9DeHxjQY64lVDc55ZBtH8gXv0HKvr7vEnls295HZx7apF3xjCr9Q7p5I+32Lq1nZyw0sX00b4sn5qx6hK3XomL8ilh9bj63rzZcTAxW2R0DIXEbMHJemHSwGMse1jxMBKYJGqEoiqIoiqIEwWrqWZfSaIkdcRBeGAlmbhwYqWh8Z5oBM8vilrim10dInbHXwlqvSG31a/9W6wUkjV91X7TO8sorbf/Dh1cu7WQljY87N62ysOmw9Ip7qrTaNf7jObaYsjYAO+3yEsi2fHnxkU/srfsBplz9axEV5uOMPDtFJjli0U43Z67seXz2oG+UbZq+VEvBJcf6N72EPHJPfj5v6UscuVs1hvvsmML+MG9TKr7Sy8Wio0k/G5zjWtiZ4mZREJvhh7nGnof44jduu1Wpfy3rhM9mPsWmE2W/2NPEjttRa5hpF/A1OQGxCyi/xp0k8LP+a/Lr2G92nAlMXLjMFdOX+WLVjRTLvH8bEnvfk/SVsvtCm/oqcf/r4IpP1IOhvD8y/2Vmiw5fhaIoiqIoivp3JMQJ+6azS3bcLK74dkkqGAkSoGcHgZEOwtR10bB40eJM6gwh07SzLyp9phm74zMZW0xQsWnbeSPTN72OXUnm9eKb+90aWHbMhefhpjvPvSgw2P4I5jdiYyKr2RVkHT1ScuqM5fWeYYaKa6tTOqvI1d/1tKWCmRaABaZP/bnPZ66HDBokbtnyzbIY3Mv48Z5hzsbTHjarjvmhuYOdxH22iWye8v2qWIwyzIJTStvPBmcS1Gcs2ucL4QXemLQ66DBf/AYX5Ocuf4VPZ97HI7cCwYiIP2fbcZtZS7Y8YFXWPsr0ia/lBpwR5mf94RJqWfGd91Psxy57Vj5YwQoyG70brrys+1eXeMKOKTVrF12OSh1p4gsRxUAw87wwYVUADj0qcC1uYL8TNEJRFEVRFEX9MhICBz8JabQ0uJiDL/RJeJ7vBGbWS3yqEQj5vYn1F32bTpM6E4pYVnq7Vb6r1OYsfCTpgvmrQ7D7dmbq49AWUxLM+vDN/W6kLTGyvtHcK1/EuAVXqS/Uc+r6ZOZLfL/sOcT3u+aMMQ3HRJN03HTPEfSWkVeBIdIGr9BL4hUu+be9ueIst+KBi/LaW+WkPcHtIc9Cy85+rhaGkcvSEVzSIgiWnJdOiWtu3/G+R9bdm9Tt8YPijQBmhh3M7qakcmV8NYHcKnbMBIWLGDrvDBxD867yxf8hNDS0N/ddyNSfL/pDkXYHecXUbzhxO85Nfp0jxhm4Y9paN2y3SY0n8wT3SduGFsgYX0zKFd+fDmahKxg5Nww2jsCCfVElNlGFgltjKIqiKIqiqPfQybLid0Lq7GZt9uvuIecDZsZTMtlhxIpoGF3Lb7WP6DhDwtiEMpZdf8C2NHv6mkR8sjAS4xaHQvdgeMYDn8or1dX//0rvH83aq0X9jF1RovQm21KF3Y8xd4tX5p2gTq6rNMEIe1x4P/Uw1X6KcTiUt4RX7j9tb7Tf3GGf8gpLmB5+cU/QCPHgVfHDz2SD0G+hP448yxc8MOgdmHVaQfMylpvcAWnvUzL1Hi99OpIZcxHrLka2k899BQvzSloxfNNh2+pNx5yS3YLTBLeA/JnI9nx57GnpIV1zv8o5q9y420mw/JB/8Un7ij1k3niyL4b71HZvCCppv6F/N7GVmU9+y1n+6KeciHGrwrDhWc79qv/ScOsURVEURVH/GE4pXRqm10sTxhhFCB4cZOa4C27fmLi2EFIbw1pOO8dzDxCOqmLZhZsftDyS3paBT0kI/ULaDUrrPLH1Zvozq8jOuXxzfziybi7YcgOe/MeAJqRMNDi39cq+m9EZRy46Ye9hu6DnPomuZR3seL4Kc9k2zkpmfRBmm3rC6LBj556j1uHb9ttDUvUKVmyxPUfaEG5rY0edveNZp7HxSdix+wlWZH09+cXfIGVf82//NI7RZSq7r4e9lFllWzdV3xfzTLyhczDWwzak8s0Ih74pLRs3PizMn3k4DXNPVUJIzRdfLAuBxL6U5iOONa9uB7bTe5kpiqIoiqL+KCQU9n4R0XHe8Exuw8gVGSRAB4KRSQYzPxIjFT2hvisu+1F88y1SbzqZZlz1aLyvtC2ys6eiP4SVAzHawAPrr8cnuifX7CLzBd3C/ZlI+OWGjp7If/yJnOr6mdF59Xv9C9kJ1h4Zkw9Y2M6zOO09MSr7x+7x/oW7asu//Z9qY1mFR2Etp5YcS06evOwpvlW/D4V1NjC/l/ykuIOdwldjIqtYVZNzMcETjLwhLO8FRtwH/RenwvRSYfX9+IZbjSwryVelKIqiKIqi/mgkfH5z1bvxjMKBJPTVCifhORZiMzIgOjsGX+iFQ+5EFHs/ptGGhMz5ZJq8J7jrktzp4rpv10SBkXqE0UvtsPy4b+1JhxzH5DpWmtT5hG+aeguy37+47lJ8QHe/962Fqx9grHYAvlGPhtS6oNZDdpk3ud+Fr8pYhbeY6Z8MrZyx1gX9FZ+DkXyGz5YEYMamRBx/WeVJ6n7JV6UoiqIoiqL+2zI6WYntjzMdZY/FYYBhEhhZEozFE8DMScSgxQVQNi/BwSeVjpklrCwJavIprewFc8fy4h82BKCnsiv6KLlghqEf1h9PyL/pkGcdncvK0xD9U2S/DfNPYxdsPBx4WmmVW930ZeGYtCISU1Y6th98kOHxyI/V4epwdZ+ltmvdC6qxX3OiKHHM0hhykuIjuKVmwNJUTN+dwu55Vvj0YViFFqn/k4caKYqiKIqiqD9JNsvOM/ertFc+n8t+taUGjHwhGIVSMAuz8ZlqBsYbpWLejrTsA661NqUsu66LZRecC20+t/RKYsi8HYGdXy2NwEBFT3yv5wvtAwn5x2xz7F4ktXHd2k0j0+8aXOVDQ0Jtz6AqSO1zLFt5/GWyq+xur8aJK1whvtYfyhvcsPFcus1dHywi+0XQG0gdy0pbRracXXo1O2XM6kR8ppMGofmxZN9HQUwvHtO2xOCYR7ONVxU7Q7ACiqIoiqIo6n+PG475WkK7ld79qvah68vBaGWDkUkAI51KgnQG+mnHY4xpeKeSeWy6Y0rnQxIS1ckkdy6obb3mkdSo8Sti8alsJD5dEIIxGlFYuNy7a+uxqISLtjXHMuvYKaTuUH5VfxvkOw2zjmG/tg5hvz75KHO36eHQ3AUr/DBVNxpSa9IgtdqxRt/CP946vHknqSu4FYO8yj6IrjmvdjCieP6uWHyxPAyMpAsYcWd8YZKEybuSYHgvr/W0b22Ec37rMsGKKIqiKIqiqL8eEuwmXoxov6l5o7jp26256KOV/uNDhLMiwcwIh/C8SHyjl4oJ+pEwsUhIfeJes5YsI5FLgvRx+8bLKy8WJuseysVIZX8MkXiFL6VeYJ7+K5geC2pQ2xhod/ZZ5em0BnYuWWYugM/41X4QyDbP4rb7RmDnvPNOWXcX7XFsn2hgj1mrXCCzMQSLdgdD3sgrf//5/AAHT3Ytv5jAaa9S7cNOJREa5zIwZGU4GAlvMLP9SGj2xed64VA4Egeb2IbEgPrONWQd4/jFKIqiKIqiqL86Et5G+xSzFzZbl9gvWB/cPMM4EZ8pkAA9PQzM/AgS/IIhMs0To7SioLw/gt3qmOmawLKbyHLfkUAslc2ySqcc8h9uuhxVK7nGA+IrQiBuHIsJ6qGQWhkFw0PJUNviV7j7bnTITe/CbU0sq0eW5a5i/0c3cX8Wst1i/5rIdkxp6m7Ve5ZQr7f3dqybnOmLpOX7PGFyNgoqu0Iwy9gF8ts9YXQ8KmyvTfKT+8HlW8kyXJd6/fjmGI+aLsWtjyqvKO6LTBll4AlhRVey/56DkSYnFYZJmGyWCJ0TGS1HXtZc504muPXyi1IURVEURVEfohaWHRZX3LHisG3NI7WjeRiiHw1GwRPMXBKgZ0SBmeMPYdUwjN2ci/Er00vUDlQnnHneEvwqn91OwqQ2F4i7WXZLcG77DlPzqEvqe/yLxhl5dH1r6IqP5e/jW80nUNwQAI3NsVDdlFK45Up2kLFF8f7tl0r3vYyp3ReU2jL7rmfL0LQWdihpSzDxm/ZeuOWCg8kU8+NrTBo7NLmgc7VvUv2+lfuiXq0/Flyw6WRM5RqLmBrNDZ7Q3uIP3cPRmKJz+7XSuheNSmsdHDQ2+VkcvZ+0/3lg0RbS3hd801zbvS87d4offVbttNU6M1f5WHT+hE2JGLAklpxkOKGHgjuGLQ2CEtl/hlfyWs+41j7wy2s5TJYbzTdBURRFURRF/Z2UsqyOuXPtptXXYyNk9yR0jDZKgrAMCdBzE8BMSQEzvwIi4vXoubAY3xoWQnJXXvOqi4XB26xyTwQWsgokKHJXpPuQ1zHOZazxObdsj1Wn40MWrIqO0FifXrt0dyHmGqdiun4cZhtGYaFZBGYtd8JknScYp36vS2PPq44tV3w7lh9yd1Xb7PRAZ4vLA+0NTg+0zRweKK+2faC/2/WBwR53wfv5S25bam10eCat//ChnPEzJ51tfh0zdRw6FFb7QHmNH/R2xsL0aDZWmudCSj8MS7bGYOnWhGLdrXEp60/Fxprfzn2151rpcja08Cc9WZDt/5hs/9dhpexYp/ia7evvprqp70tombeuAANkEsHMjISwNNkX4oHorxqM6RsjWdN7uVHX/WvuV7LsSrIsvRWDoiiKoijqn6SJZSfe9Kg1234zP1lxXyK+WRqNAfqxYJQcwCiHgpFLJ+ExEsyCCAxRi8J0gzhobkuA4bbk0GsPMl9a29VuJCFSmUwfce2R1/5kmmgZxk7U3Z83xTKg5OyeR5kPlxyMtlffGey84qhvu+7JICgcDILGkQSo7Y2A/EYf6B8KxrJ9wViyJxjz9J2gsM4Hyw6EwvhoKBZv901ccyIMhufDsOpiADZfD8Wyk+Fe2x+mOB62T39mG1Bqc+phjdI9L0G/1fMFX+zfkDKRWJZVupbUpbrevl3jqFftnfWPylq0L+dh+o40jNmSAVEN8l0l/AW3r3ykGYsf1qdi+e0SGF9JbT/4tNIpqoKlI/tRFEVRFEVRgnApuIJsGVq7/rxHmf3aG6GvZ1hkY/CuBghrxYPRTAAjEwZmujeYSR4Qmx2Kz+aGY4RiDOavioeMWXzxzivZCWsPl2/dc7lxpX1848rCH6/MGpPpzdVZ8r4vmT4l6xtCXj/n3vOfPyOvX3KTdwb7ZRnLDuLLBf1Kk9d+/1b3Y0FjBHkv8n+nlJruxXvsqrcceFz0+JhLWdqiuxXlMy804rsdxfhCNw4fqXIPSfqAUUgjJwdp6KERj5FrsyGxOxUGF2Orz7lXOj5Lb+Bu4xhD2hvJr4qiKIqiKIqi/hMJjbM8yjrNLHxazC1cixONb+YlapxMr5+5PQHfr0nBZzpxYKZ4gZnmQV6dwcxxhZCEJz5XDMVIrWj8YEgC9eZkSG2OgeyWENbsanq6/rm8qw8T2848Tq085d/GLrDNqDJ9klZ0yjWv/JRLbs3OQ4ltI094YeR1MoWkd+gHpNafuuNbefrCy9LLFx3Lzhx/Un7qxLPqU+edq0+fdqq6sut+kfWRh0l1m29H18lvC6ifbRpSP21NRL3Unix8aRCDnhok6Mv6g5H/8Yr5AJ0UDFb0wnhdHyzcFNihdiI3cc3j4kRz+yLv0x61ZlFNrCwJygP4XUBRFEVRFEVRvw0J06M8S1mlJ5FYvduu3HXJiYR2BYtETNudiuFmieivH4teOiSkSgWCmRpKQnUQmLnkdToJ2HP80UsuAsOWJuFLwwjM3J+F8dvTMHRFCL42jcA3JqEYru+DYToB+FonBKOWR2O0fgy+WhSGIRqBGKodgiE6MRi8KBFf6CZj0JIEfMQF49kOYCZbk/D+hIRjEpJVosCoRqEPqdOfrGukaS7GrUmD9NYEHHeoebX5aoH6DdcGpQ5gMv+1KIqiKIqiKOq/iwTp0U0sO8E9h5W9HFF31diy/KretZKrOx6Uxa65Xt4wa20qppJpvGkavl+diqF6UfhIJRgiC2IwwrAC4ze0gpkfhd4KKWAkSOCeF4LPSCAeoBOFHqReD9WQHyfyXlQxAL3VwjDMKAMTNhfgh3UZmLo5FbO3JkPpUCZUj2dD93ZBw+5nJQ3r7uckaZwquGp6t/Tqo7gu8/sJ7ISUJvYHfrMpiqIoiqIo6q8BP/aj/FlcRccKx+SGbfeCmrY9jGraduRFzbYnoQ1Rj7xqM296dVy84NZ25qZjWeZDv+bMwzYlmWsvZydbx3Y4WMd3Zt4K/X/t3DFqgkEQBlBF8AAewqt4oL1HLNJYpBHBygMkCBYJuYHVphMkVULQIKIwv2vYFAkpA4K8Bx/MDMtuO9Vu8uT5I4+f3vPd41sezl/z6GGdbxefN9PlIY3KnbPlLt2/7NJqG+kYMTi/eU5Z6C/2jzQAAPybsty2a/lVf6eOfsx+px4BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALispmm6JZ3aAgAAf4nY9yOiV1sAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgKvTap0AeDHYGPfmkfoAAAAASUVORK5CYII=" style="width:180px;height:180px;object-fit:contain;opacity:0.85" />
    </div>
  </div>
</div>
<script>
  window.onload = function() {
    document.title = "itstour-hesabat"
    window.print()
  }
</script>
</body>
</html>`

  // Open in new tab — user saves as PDF via Ctrl+P → Save as PDF
  const win = window.open("","_blank")
  if(win){win.document.write(html);win.document.close()}
}


// ─── Excel Export ─────────────────────────────────────────────────────────────
function exportToExcel(bookings: any[]) {
  const typeLabels: Record<string, string> = {
    bilet:"Aviabilet",otel:"Otel",tur:"Tur",kruiz:"Kruiz",
    transfer:"Transfer",bagaj:"Bagaj",yer_secimi:"Yer seçimi",
    cip:"CIP",sigorta:"Sığorta",viza:"Viza"
  }
  const statusLabels: Record<string, string> = {
    pending:"Gözləyir", confirmed:"Təsdiqlənib", cancelled:"Ləğv edilib", completed:"Tamamlandı"
  }
  const payLabels: Record<string, string> = {
    paid:"Ödənilib", partial:"Qismən", unpaid:"Ödənilməyib"
  }

 const rows = bookings.map((b: any) => ({
  "Müştəri":        b.clientName,
  "Telefon":        b.clientPhone || "",
  "İstiqamət":      b.destination,
  "Növ":            typeLabels[b.bookingType] ?? b.bookingType,
  "Uçuş tarixi":    b.departureDate,
  "Qayıdış tarixi": b.returnDate || "",
  "Sifariş tarixi": b.orderDate || "",
  "Bilet №":        b.ticketNumber || "",
  "PNR":            b.pnr || "",
  "Məbləğ":         b.sellPrice,
  "Ödənilib":       b.paidAmount ?? 0,
  "Borc":           Math.max(0, b.sellPrice - (b.paidAmount ?? 0)),
  "Ödəniş statusu": payLabels[b.paymentStatus] ?? b.paymentStatus,
  "Menecer":        b.manager,
  "Qeydlər":        b.notes || "",
}))

  const ws = XLSX.utils.json_to_sheet(rows)

  // Column widths
  ws["!cols"] = [
    {wch:22},{wch:16},{wch:24},{wch:12},{wch:13},{wch:13},{wch:13},
    {wch:30},{wch:12},{wch:10},{wch:10},{wch:10},{wch:10},{wch:10},
    {wch:16},{wch:16},{wch:18},{wch:16},{wch:6},{wch:10},{wch:20}
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Sifarişlər")
  XLSX.writeFile(wb, `itstour-sifarisler-${new Date().toISOString().slice(0,10)}.xlsx`)
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SifarislerPage() {
  const { profile, canDelete } = useUserRole()
  const isReadOnly = profile?.role === "boss"
  const isManager = profile?.role === "menecer"
  const isBiletMenecer = profile?.role === "bilet_menecer"
  const { bookings, loading, fetchBookings, addBooking, updateBooking, deleteBooking } = useBookingsStore()
  const [modal, setModal] = useState<"create" | "edit" | null>(null)
  const [selected, setSelected] = useState<Booking | null>(null)
  const [filters, setFilters] = useState<BookingFilters>(EMPTY_FILTERS)
  const [activeTab, setActiveTab] = useState<BookingType | "all">("all")
  const [paymentStatus, setPaymentStatus] = useState("unpaid")
  const [paidAmount, setPaidAmount] = useState(0)
  const [isIata, setIsIata] = useState(false)
  const [ready, setReady] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [actionMenu, setActionMenu] = useState<string | null>(null)
  const [clientBalances, setClientBalances] = useState<Record<string, number>>({})
  const [viewModal, setViewModal] = useState<Booking | null>(null)
  const [myDrafts, setMyDrafts] = useState<any[]>([])

  useEffect(() => {
    fetchBookings()
    setReady(true)
    // Load client balances for PDF
    supabase.from("client_balances").select("client_name, balance").then(({ data }) => {
      if (data) {
        const map: Record<string, number> = {}
        data.forEach((b: any) => { map[b.client_name.toLowerCase()] = b.balance })
        setClientBalances(map)
      }
    })
  }, [])

  useEffect(() => {
    if (!profile) return
    if (!["menecer", "bilet_menecer"].includes(profile.role ?? "")) return
    supabase.from("booking_drafts")
      .select("*")
      .eq("submitted_by", profile.fullName)
      .in("review_status", ["pending", "rejected"])
      .order("created_at", { ascending: false })
      .then(({ data }) => setMyDrafts(data ?? []))
  }, [profile])

  useEffect(() => {
    if (modal) {
      setPaymentStatus(selected?.paymentStatus ?? "unpaid")
      setPaidAmount(selected?.paidAmount ?? 0)
      setIsIata(selected?.isIata ?? false)
    }
  }, [modal, selected])


  // ─── Flight reminder notifications ───────────────────────────────────────
  useEffect(() => {
    if (!ready || !profile) return
    const canReceive = ["it_admin", "boss", "direktor", "menecer", "bilet_menecer"].includes(profile.role)
    if (!canReceive) return

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }

    function checkFlights() {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
      const in5days = new Date(today); in5days.setDate(today.getDate() + 5)
      const tomorrowStr = tomorrow.toISOString().split("T")[0]
      const in5daysStr = in5days.toISOString().split("T")[0]

      const myBookings = bookings.filter(b =>
        b.status !== "cancelled" &&
        (profile?.role === "menecer" || profile?.role === "bilet_menecer"
          ? b.manager === profile?.fullName
          : true)
      )

      const tomorrow1 = myBookings.filter(b => b.departureDate === tomorrowStr)
      const in5days1 = myBookings.filter(b => b.departureDate === in5daysStr)

      function playAlert() {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.frequency.setValueAtTime(880, ctx.currentTime)
          osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3)
          gain.gain.setValueAtTime(0.3, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
          osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5)
        } catch {}
      }

      if (tomorrow1.length > 0) {
        const shown = sessionStorage.getItem(`notif_1d_${tomorrowStr}`)
        if (!shown) {
          playAlert()
          if (Notification.permission === "granted") {
            new Notification("🚨 Sabah uçuş!", {
              body: `${tomorrow1.length} müştərinin sabah uçuşu var: ${tomorrow1.slice(0,3).map(b => b.clientName).join(", ")}`,
              icon: "/favicon.ico"
            })
          }
          sessionStorage.setItem(`notif_1d_${tomorrowStr}`, "1")
        }
      }

      if (in5days1.length > 0) {
        const shown = sessionStorage.getItem(`notif_5d_${in5daysStr}`)
        if (!shown) {
          if (Notification.permission === "granted") {
            new Notification("⏰ 5 gün sonra uçuş", {
              body: `${in5days1.length} müştərinin 5 gün sonra uçuşu var: ${in5days1.slice(0,3).map(b => b.clientName).join(", ")}`,
              icon: "/favicon.ico"
            })
          }
          sessionStorage.setItem(`notif_5d_${in5daysStr}`, "1")
        }
      }
    }

    if (bookings.length > 0) checkFlights()
    const interval = setInterval(checkFlights, 60 * 60 * 1000) // check every hour
    return () => clearInterval(interval)
  }, [bookings, ready, profile])

  // ─── Flights tomorrow banner data ────────────────────────────────────────
  const flightsTomorrow = useMemo(() => {
    if (!profile) return []
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split("T")[0]
    return bookings.filter(b =>
      b.departureDate === tomorrowStr &&
      b.status !== "cancelled" &&
      (["menecer","bilet_menecer"].includes(profile.role) ? b.manager === profile.fullName : true)
    )
  }, [bookings, profile])

  const filtered = useMemo(() => bookings.filter(b => {
    if (isManager && b.manager !== profile?.fullName) return false
    if (isBiletMenecer && b.manager !== profile?.fullName) return false
    if (isBiletMenecer && b.bookingType !== "bilet") return false
    if (activeTab !== "all" && b.bookingType !== activeTab) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!b.clientName.toLowerCase().includes(q) && !b.destination.toLowerCase().includes(q) &&
        !(b.vendor ?? "").toLowerCase().includes(q) && !(b.ticketNumber ?? "").toLowerCase().includes(q) &&
        !(b.pnr ?? "").toLowerCase().includes(q)) return false
    }
    if (filters.status !== "all" && b.status !== filters.status) return false
    if (filters.manager && b.manager !== filters.manager) return false
    if (filters.iataPeriod !== "all" && b.iataPeriod !== filters.iataPeriod) return false
    if (filters.dateFrom && !b.departureDate.startsWith(filters.dateFrom)) return false
    return true
  }), [bookings, filters, activeTab, isManager, isBiletMenecer, profile])

  const totalRevenue = filtered.reduce((s, b) => s + b.sellPrice, 0)
  const totalProfit  = filtered.reduce((s, b) => s + b.profit, 0)
  const totalCost    = filtered.reduce((s, b) => s + b.buyPrice, 0)
  const paidCount    = filtered.filter(b => b.paymentStatus === "paid").length

  const typeCounts = BOOKING_TYPES.map(t => ({
    ...t,
    count: bookings.filter(b => b.bookingType === t.value && (!isManager || b.manager === profile?.fullName) && (!isBiletMenecer || b.manager === profile?.fullName)).length
  }))

  const activeFiltersCount = [
    filters.search, filters.status !== "all", filters.manager,
    filters.iataPeriod !== "all", filters.dateFrom
  ].filter(Boolean).length

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const sellPrice = Number(fd.get("sellPrice"))
    const buyPrice = Number(fd.get("buyPrice"))
    const commissionPercent = Number(fd.get("commissionPercent"))
    const grossProfit = sellPrice - buyPrice
    const commissionAmount = Math.round(grossProfit * commissionPercent) / 100
    const profit = grossProfit - commissionAmount
    const paid = paymentStatus === "paid" ? sellPrice : paymentStatus === "partial" ? paidAmount : 0

    const data: BookingFormData = {
      bookingType: fd.get("bookingType") as BookingType,
      clientName: fd.get("clientName") as string,
      clientPhone: fd.get("clientPhone") as string,
      clientEmail: fd.get("clientEmail") as string,
      destination: fd.get("destination") as string,
      departureDate: fd.get("departureDate") as string,
      returnDate: fd.get("returnDate") as string,
      travelers: Number(fd.get("travelers")),
      description: fd.get("description") as string,
      vendor: fd.get("vendor") as string,
      isIata, buyPrice, sellPrice, commissionPercent,
      paidAmount: paid,
      manager: (isManager || isBiletMenecer) ? (profile?.fullName ?? "") : fd.get("manager") as string,
      iataPeriod: fd.get("iataPeriod") as IATAPeriod,
      status: fd.get("status") as any,
      paymentStatus: paymentStatus as any,
      notes: fd.get("notes") as string,
      ticketNumber: fd.get("ticketNumber") as string,
      bookingReference: fd.get("bookingReference") as string,
      pnr: fd.get("pnr") as string,
      orderDate: fd.get("orderDate") as string,
      updated_by: profile?.fullName ?? "Admin",
      updated_by_role: profile?.role ?? "",
    }

    if (modal === "edit" && selected) {
      await updateBooking(selected.id, data)
      await logActivity({ userName: profile?.fullName ?? "", userRole: profile?.role ?? "", action: "update", entity: "booking", entityId: selected.id, details: { client: data.clientName, destination: data.destination, amount: data.sellPrice } })
    } else if (isManager || isBiletMenecer) {
      await supabase.from("booking_drafts").insert({
        client_name: data.clientName, client_phone: data.clientPhone,
        destination: data.destination, departure_date: data.departureDate,
        return_date: data.returnDate, travelers: data.travelers,
        booking_type: data.bookingType, description: data.description,
        vendor: data.vendor, is_iata: data.isIata,
        buy_price: data.buyPrice, sell_price: data.sellPrice,
        commission_percent: data.commissionPercent, commission_amount: commissionAmount,
        profit, paid_amount: data.paidAmount, manager: data.manager,
        iata_period: data.iataPeriod, status: data.status, payment_status: data.paymentStatus,
        notes: data.notes, ticket_number: data.ticketNumber,
        booking_reference: data.bookingReference, pnr: data.pnr,
        submitted_by: profile?.fullName ?? "", submitted_by_role: profile?.role ?? "",
        review_status: "pending",
      })
      await logActivity({ userName: profile?.fullName ?? "", userRole: profile?.role ?? "", action: "create", entity: "draft", details: { client: data.clientName, destination: data.destination, amount: data.sellPrice } })
      alert("✅ Sifariş təsdiq üçün göndərildi!")
    } else {
      await addBooking(data)
      await logActivity({ userName: profile?.fullName ?? "", userRole: profile?.role ?? "", action: "create", entity: "booking", details: { client: data.clientName, destination: data.destination, amount: data.sellPrice } })
    }
    setModal(null); setSelected(null)
  }

  if (!ready || !profile) return (
    <div className="min-h-screen p-7" style={{ background: "var(--bg-primary)" }}>
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-7 w-32 rounded-xl animate-pulse" style={{ background: "var(--bg-glass)" }} />
          <div className="h-4 w-24 rounded-lg animate-pulse" style={{ background: "var(--bg-glass)" }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[1,2,3].map(i => <div key={i} className="h-24 rounded-3xl animate-pulse" style={{ background: "var(--bg-glass)" }} />)}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen p-5 md:p-7" style={{ background: "var(--bg-primary)" }}
      onClick={() => actionMenu && setActionMenu(null)}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Sifarişlər</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{filtered.length}</span>
            <span> / {bookings.filter(b => !isManager || b.manager === profile.fullName).length} sifariş</span>
            {activeFiltersCount > 0 && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                {activeFiltersCount} filtr aktiv
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToPDF(filtered, clientBalances)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-95"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>
            <FileText size={15} />
            ⬇ PDF
          </button>
          <button
            onClick={() => exportToExcel(filtered)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-95"
            style={{ background: "linear-gradient(135deg, #10b981, #34d399)", boxShadow: "0 4px 16px rgba(16,185,129,0.3)" }}>
            <FileText size={15} />
            ⬇ Excel
          </button>
          <button
            onClick={() => exportUzlesme(filtered, clientBalances)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-95"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>
            <FileText size={15} />
            ⬇ Üzləşmə
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="relative flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-95"
            style={{ background: showFilters ? "rgba(239,68,68,0.1)" : "var(--bg-card)", border: `1px solid ${showFilters ? "rgba(239,68,68,0.3)" : "var(--border-color)"}`, color: showFilters ? "#ef4444" : "var(--text-secondary)" }}>
            <SlidersHorizontal size={15} />
            Filtrlər
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center"
                style={{ background: "#ef4444" }}>{activeFiltersCount}</span>
            )}
          </button>
          {!isReadOnly && (
            <button
              onClick={() => { setSelected(null); setModal("create") }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-95"
              style={{ background: "linear-gradient(135deg, #ef4444, #f97316)", boxShadow: "0 4px 20px rgba(239,68,68,0.3)" }}>
              <Plus size={15} />
              {isManager ? "Sifariş göndər" : "Yeni sifariş"}
            </button>
          )}
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard label="Ümumi gəlir" value={formatCurrency(totalRevenue)} sub={`${filtered.length} sifariş`}
          gradient="linear-gradient(135deg, #ef4444 0%, #f97316 100%)" />
        <KpiCard label="Alış xərci" value={formatCurrency(totalCost)} icon={TrendingDown} />
        <KpiCard label="Mənfəət" value={formatCurrency(totalProfit)} icon={TrendingUp}
          trend={totalProfit >= 0 ? "up" : "down"} />
        <KpiCard label="Ödənilib" value={`${paidCount}/${filtered.length}`}
          sub={`${filtered.length > 0 ? Math.round((paidCount/filtered.length)*100) : 0}% ödəniş`}
          icon={DollarSign} />
      </div>

      {/* Main Card */}
      <div className="rounded-3xl overflow-hidden"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", backdropFilter: "blur(20px)" }}>

        {/* Type tabs */}
        <div className="px-5 pt-4 pb-0" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <div className="flex gap-1 overflow-x-auto pb-3 scrollbar-hide">
            <button onClick={() => setActiveTab("all")}
              className="flex-shrink-0 px-4 py-2 rounded-2xl text-sm font-medium transition-all"
              style={{ background: activeTab === "all" ? "linear-gradient(135deg, #ef4444, #f97316)" : "transparent", color: activeTab === "all" ? "white" : "var(--text-secondary)", boxShadow: activeTab === "all" ? "0 4px 12px rgba(239,68,68,0.3)" : "none" }}>
              Hamısı ({bookings.filter(b => !isManager || b.manager === profile.fullName).length})
            </button>
            {typeCounts.map(t => {
              const Icon = t.Icon
              const active = activeTab === t.value
              return (
                <button key={t.value} onClick={() => setActiveTab(t.value as BookingType)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-sm font-medium transition-all"
                  style={{ background: active ? t.bg : "transparent", color: active ? t.color : "var(--text-secondary)", border: active ? `1px solid ${t.color}30` : "1px solid transparent" }}>
                  <Icon size={13} />{t.label}<span className="text-xs opacity-70">({t.count})</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Search */}
        <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <div className="relative">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input type="text" placeholder="Ad, bilet №, PNR, istiqamət axtar..."
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              className="w-full py-2.5 pl-11 pr-4 text-sm rounded-2xl focus:outline-none transition-all"
              style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
            {filters.search && (
              <button onClick={() => setFilters(f => ({ ...f, search: "" }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg" style={{ color: "var(--text-muted)" }}>
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="px-5 py-4 flex flex-wrap gap-3" style={{ borderBottom: "1px solid var(--border-color)", background: "var(--bg-glass)" }}>
            {[
              { value: filters.status, onChange: (v: string) => setFilters(f => ({ ...f, status: v as any })), options: [{ v: "all", l: "Bütün statuslar" }, { v: "pending", l: "Gözləyir" }, { v: "confirmed", l: "Təsdiqlənib" }, { v: "completed", l: "Tamamlandı" }, { v: "cancelled", l: "Ləğv edildi" }] },
              { value: filters.iataPeriod, onChange: (v: string) => setFilters(f => ({ ...f, iataPeriod: v as any })), options: [{ v: "all", l: "Bütün periodlar" }, { v: "1-7", l: "1-7" }, { v: "8-15", l: "8-15" }, { v: "16-23", l: "16-23" }, { v: "24-31", l: "24-31" }] },
            ].map((sel, i) => (
              <select key={i} value={sel.value} onChange={e => sel.onChange(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl focus:outline-none"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                {sel.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            ))}
            <input type="month" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
              className="px-3 py-2 text-sm rounded-xl focus:outline-none"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
            {activeFiltersCount > 0 && (
              <button onClick={() => { setFilters(EMPTY_FILTERS); setShowFilters(false) }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl font-medium"
                style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                <X size={13} /> Təmizlə
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "linear-gradient(135deg, var(--bg-glass), var(--bg-secondary))", borderBottom: "1px solid var(--border-color)" }}>
                {["Növ", "Müştəri", "İstiqamət", "Tarix", "Menecer", "Satış", "Qalıq", "Mənfəət", "Status", "Ödəniş", ""].map(h => (
                  <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider px-3 py-3"
                    style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
              {!loading && filtered.length === 0 && myDrafts.length === 0 && <EmptyState onAdd={() => setModal("create")} isManager={isManager} />}

              {/* Draft rows — only visible to the manager who submitted */}
              {!loading && (isManager || isBiletMenecer) && myDrafts.map(d => {
                const ti = getTypeInfo(d.booking_type)
                const Icon = ti.Icon
                const isPending = d.review_status === "pending"
                return (
                  <tr key={"draft-" + d.id} style={{ borderBottom: "1px solid var(--border-color)", opacity: 0.85, background: isPending ? "rgba(245,158,11,0.03)" : "rgba(239,68,68,0.03)" }}>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-xl w-fit" style={{ background: ti.bg, color: ti.color }}>
                          <Icon size={11} />{ti.label}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg w-fit" style={{
                          background: isPending ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                          color: isPending ? "#f59e0b" : "#ef4444"
                        }}>
                          {isPending ? "⏳ Gözləyir" : "❌ Rədd edildi"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{d.client_name}</p>
                      {d.client_phone && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{d.client_phone}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium" style={{ color: "var(--text-primary)" }}>{d.destination}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{d.travelers ?? 1} nəfər</p>
                    </td>
                    <td className="px-4 py-3.5">
                      {d.vendor ? <span className="text-xs font-medium px-2.5 py-1 rounded-xl" style={{ background: "var(--bg-glass)", color: "var(--text-secondary)" }}>{d.vendor}</span>
                        : <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{formatDate(d.departure_date)}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}>
                          {d.manager?.charAt(0)}
                        </div>
                        <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{d.manager?.split(" ")[0]}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <p className="font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{formatCurrency(d.sell_price)}</p>
                      <p className="text-xs mt-0.5 tabular-nums text-green-500">{formatCurrency(d.paid_amount ?? 0)}</p>
                    </td>
                    <td className="px-4 py-3.5 text-right"><span style={{ color: "var(--text-muted)" }}>—</span></td>
                    <td className="px-4 py-3.5 text-right"><span style={{ color: "var(--text-muted)" }}>—</span></td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs px-2.5 py-1 rounded-xl font-medium" style={{ background: isPending ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)", color: isPending ? "#f59e0b" : "#ef4444" }}>
                        {isPending ? "Təsdiq gözləyir" : "Rədd edildi"}
                      </span>
                      {d.reviewer_note && <p className="text-xs mt-0.5" style={{ color: "#ef4444" }}>{d.reviewer_note}</p>}
                    </td>
                    <td className="px-4 py-3.5" /><td className="px-4 py-3.5" />
                  </tr>
                )
              })}
              {!loading && filtered.map(b => {
                const ti = getTypeInfo(b.bookingType)
                const Icon = ti.Icon
                const remaining = b.sellPrice - (b.paidAmount ?? 0)
                return (
                  <tr key={b.id} className="group transition-all" style={{ borderBottom: "1px solid var(--border-color)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-glass)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg w-fit" style={{ background: ti.bg, color: ti.color }}>
                          <Icon size={10} />{ti.label}
                        </span>
                        {b.isIata && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded w-fit text-white" style={{ background: "#3b82f6" }}>IATA</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5" style={{ maxWidth: 140 }}>
                      <p className="font-semibold text-xs truncate" style={{ color: "var(--text-primary)" }}>{b.clientName}</p>
                      {b.clientPhone && <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{b.clientPhone}</p>}
                    </td>
                    <td className="px-3 py-2.5" style={{ maxWidth: 150 }}>
                      <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{b.destination}</p>
                      {b.vendor && <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{b.vendor}</p>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{formatDate(b.departureDate)}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{b.manager?.split(" ")[0]}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <p className="font-bold tabular-nums text-xs" style={{ color: "var(--text-primary)" }}>{formatCurrency(b.sellPrice)}</p>
                      <p className="text-[10px] tabular-nums" style={{ color: "#22c55e" }}>{formatCurrency(b.paidAmount ?? 0)}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {remaining > 0
                        ? <span className="font-bold tabular-nums text-xs px-1.5 py-0.5 rounded" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)" }}>{formatCurrency(remaining)}</span>
                        : <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`font-bold tabular-nums text-xs px-1.5 py-0.5 rounded ${b.profit >= 0 ? "text-green-500" : "text-red-500"}`}
                        style={{ background: b.profit >= 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)" }}>
                        {b.profit >= 0 ? "+" : ""}{formatCurrency(b.profit)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={b.status} /></td>
                    <td className="px-3 py-2.5"><PaymentBadge status={b.paymentStatus} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => setViewModal(b)}
                          className="p-1 rounded-lg transition-all hover:scale-110"
                          style={{ color: "#6366f1", background: "rgba(99,102,241,0.1)" }}>
                          <Eye size={12} />
                        </button>
                        {!isReadOnly && (
                          <button onClick={() => { setSelected(b); setModal("edit") }}
                            className="p-1 rounded-lg transition-all hover:scale-110"
                            style={{ color: "var(--text-secondary)", background: "var(--bg-glass)" }}>
                            <Edit3 size={12} />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => { if (confirm("Silinsin?")) { deleteBooking(b.id); logActivity({ userName: profile?.fullName ?? "", userRole: profile?.role ?? "", action: "delete", entity: "booking", entityId: b.id, details: { client: b.clientName, destination: b.destination } }) } }}
                            className="p-1 rounded-lg transition-all hover:scale-110"
                            style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)" }}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--border-color)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{filtered.length} sifariş · Cəmi {formatCurrency(totalRevenue)}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Mənfəət: <span className={totalProfit >= 0 ? "text-green-500 font-semibold" : "text-red-500 font-semibold"}>{formatCurrency(totalProfit)}</span>
            </p>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", animation: "modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1)" }}>
            <div className="flex items-center justify-between px-7 py-5" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {modal === "edit" ? "Sifarişi redaktə et" : "Yeni sifariş"}
                </h2>
                {isManager && modal === "create" && (
                  <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: "#f59e0b" }}>
                    <Clock size={11} /> Sifariş təsdiq üçün göndəriləcək
                  </p>
                )}
              </div>
              <button onClick={() => { setModal(null); setSelected(null) }}
                className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all hover:scale-110"
                style={{ background: "var(--bg-glass)", color: "var(--text-secondary)" }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-7 grid grid-cols-2 gap-5">
              <div className="col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Sifariş növü *</label>
                <div className="grid grid-cols-5 gap-2">
                  {BOOKING_TYPES.map(t => {
                    const Icon = t.Icon
                    return (
                      <label key={t.value} className="cursor-pointer">
                        <input type="radio" name="bookingType" value={t.value}
                          defaultChecked={selected ? selected.bookingType === t.value : t.value === "bilet"}
                          className="sr-only peer" />
                        <div className="border-2 rounded-2xl p-3 text-center transition-all peer-checked:scale-[1.03]"
                          style={{ borderColor: "var(--border-color)", background: "var(--bg-glass)" }}>
                          <Icon size={18} className="mx-auto mb-1.5" style={{ color: t.color }} />
                          <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{t.label}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Vendor</label>
                <input name="vendor" defaultValue={selected?.vendor ?? ""} placeholder="Amadeus, Booking.com..."
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer" onClick={() => setIsIata(!isIata)}>
                  <div className="relative w-11 h-6 rounded-full transition-all" style={{ background: isIata ? "#3b82f6" : "var(--bg-glass)", border: "1px solid var(--border-color)" }}>
                    <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform" style={{ transform: isIata ? "translateX(22px)" : "translateX(2px)" }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>IATA bileti</span>
                </label>
              </div>
              <div className="col-span-2 pt-2"><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Müştəri məlumatları</p></div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Ad *</label>
                <ClientAutocomplete defaultValue={selected?.clientName ?? ""} bookings={bookings} ready={ready} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Telefon *</label>
                <input name="clientPhone" defaultValue={selected?.clientPhone} required
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>İstiqamət *</label>
                <input name="destination" defaultValue={selected?.destination} required
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Başlanğıc tarixi *</label>
                <input name="departureDate" type="date" required defaultValue={selected?.departureDate ?? new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Son tarix</label>
                <input name="returnDate" type="date" defaultValue={selected?.returnDate ?? new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Sifariş tarixi * (müştəri uçuş tarixi)</label>
                <input name="orderDate" type="date" required defaultValue={(selected as any)?.orderDate ?? new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--text-primary)" }} />
              </div>
              <div className="col-span-2 pt-2"><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Maliyyə</p></div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Satış qiyməti (AZN) *</label>
                <input name="sellPrice" type="number" step="0.01" min="-99999" defaultValue={selected?.sellPrice ?? 0} required
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none font-semibold"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Alış qiyməti (AZN) *</label>
                <input name="buyPrice" type="number" step="0.01" min="-99999" defaultValue={selected?.buyPrice ?? 0} required
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Komissiya (%)</label>
                <input name="commissionPercent" type="number" step="0.1" min="0" max="100" defaultValue={selected?.commissionPercent ?? 5}
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Ödəniş statusu</label>
                <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                  <option value="unpaid">Ödənilməyib</option>
                  <option value="partial">Qismən ödənilib</option>
                  <option value="paid">Tam ödənilib</option>
                </select>
              </div>
              {paymentStatus === "partial" && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#f97316" }}>Ödənilən məbləğ</label>
                  <input type="number" step="0.01" min="0" value={paidAmount} onChange={e => setPaidAmount(Number(e.target.value))}
                    className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
                    style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.4)", color: "var(--text-primary)" }} />
                </div>
              )}
              <div className="col-span-2 pt-2"><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>İdarəetmə</p></div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Menecer</label>
                {(isManager || isBiletMenecer) ? (
                  <div className="w-full px-4 py-2.5 text-sm rounded-xl font-medium"
                    style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                    {profile?.fullName}
                  </div>
                ) : (
                  <select name="manager" defaultValue={selected?.manager ?? MANAGERS[0]}
                    className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
                    style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                    {MANAGERS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>IATA period</label>
                <select name="iataPeriod" defaultValue={selected?.iataPeriod ?? "1-7"}
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                  {["1-7","8-15","16-23","24-31"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Status</label>
                <select name="status" defaultValue={selected?.status ?? "pending"}
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                  <option value="pending">Gözləyir</option>
                  <option value="confirmed">Təsdiqlənib</option>
                  <option value="completed">Tamamlandı</option>
                  <option value="cancelled">Ləğv edildi</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Turistlər</label>
                <input name="travelers" type="number" min="1" defaultValue={selected?.travelers ?? 1}
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div className="col-span-2 pt-2"><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Referans</p></div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Bilet №</label>
                <input name="ticketNumber" defaultValue={selected?.ticketNumber ?? ""} placeholder="157-1234567890"
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>PNR</label>
                <input name="pnr" defaultValue={selected?.pnr ?? ""} placeholder="XYZABC"
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Bron №</label>
                <input name="bookingReference" defaultValue={selected?.bookingReference ?? ""} placeholder="ABC123"
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email</label>
                <input name="clientEmail" type="email" defaultValue={selected?.clientEmail}
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Qeydlər</label>
                <textarea name="notes" rows={2} defaultValue={selected?.notes}
                  className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none resize-none"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div className="col-span-2 flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                <button type="button" onClick={() => { setModal(null); setSelected(null) }}
                  className="px-5 py-2.5 rounded-2xl text-sm font-medium transition-all hover:scale-[1.02]"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                  Ləğv et
                </button>
                <button type="submit"
                  className="px-6 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-95"
                  style={{ background: "linear-gradient(135deg, #ef4444, #f97316)", boxShadow: "0 4px 16px rgba(239,68,68,0.3)" }}>
                  {modal === "edit" ? "Yadda saxla" : isManager ? "Təsdiqə göndər" : "Yarat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── View Modal ── */}
      {viewModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          onClick={e => { if (e.target === e.currentTarget) setViewModal(null) }}>
          <div className="w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl mb-8"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5"
              style={{ borderBottom: "1px solid var(--border-color)", background: `linear-gradient(135deg, ${getTypeInfo(viewModal.bookingType).bg}, transparent)` }}>
              <div className="flex items-center gap-3">
                {(() => { const ti = getTypeInfo(viewModal.bookingType); const Icon = ti.Icon; return <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: ti.bg }}><Icon size={18} style={{ color: ti.color }} /></div> })()}
                <div>
                  <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{viewModal.clientName}</h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{viewModal.destination}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isReadOnly && (
                  <button onClick={() => { setSelected(viewModal); setViewModal(null); setModal("edit") }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
                    style={{ background: "var(--bg-glass)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                    <Edit3 size={13} />Redaktə
                  </button>
                )}
                <button onClick={() => setViewModal(null)}
                  className="w-9 h-9 rounded-2xl flex items-center justify-center"
                  style={{ background: "var(--bg-glass)", color: "var(--text-secondary)" }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Status badges */}
              <div className="flex gap-2 flex-wrap">
                <StatusBadge status={viewModal.status} />
                <PaymentBadge status={viewModal.paymentStatus} />
                {viewModal.isIata && <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: "#3b82f6" }}>IATA</span>}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Calendar, label: "Sifariş tarixi", value: (viewModal as any).orderDate ? formatDate((viewModal as any).orderDate) : formatDate(viewModal.createdAt?.slice(0,10) ?? "") },
                  { icon: Calendar, label: "Uçuş tarixi", value: formatDate(viewModal.departureDate) },
                  { icon: Calendar, label: "Qayıdış tarixi", value: formatDate(viewModal.returnDate) },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="p-3 rounded-2xl" style={{ background: "var(--bg-glass)" }}>
                    <div className="flex items-center gap-1.5 mb-1"><Icon size={12} style={{ color: "var(--text-muted)" }} /><p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p></div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{value || "—"}</p>
                  </div>
                ))}
              </div>

              {/* Client info */}
              <div className="p-4 rounded-2xl space-y-3" style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)" }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Müştəri məlumatları</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: User, label: "Ad", value: viewModal.clientName },
                    { icon: Phone, label: "Telefon", value: viewModal.clientPhone || "—" },
                    { icon: Mail, label: "Email", value: viewModal.clientEmail || "—" },
                    { icon: MapPin, label: "İstiqamət", value: viewModal.destination },
                    { icon: User, label: "Menecer", value: viewModal.manager },
                    { icon: User, label: "Vendor", value: viewModal.vendor || "—" },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-2">
                      <Icon size={13} className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                      <div><p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p><p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{value}</p></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial info */}
              <div className="p-4 rounded-2xl" style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)" }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Maliyyə</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Satış", value: formatCurrency(viewModal.sellPrice), color: "var(--text-primary)" },
                    { label: "Alış", value: formatCurrency(viewModal.buyPrice), color: "#ef4444" },
                    { label: "Ödənilib", value: formatCurrency(viewModal.paidAmount ?? 0), color: "#22c55e" },
                    { label: "Mənfəət", value: formatCurrency(viewModal.profit), color: viewModal.profit >= 0 ? "#22c55e" : "#ef4444" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="p-3 rounded-xl text-center" style={{ background: "var(--bg-secondary)" }}>
                      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                      <p className="text-sm font-bold tabular-nums" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reference info */}
              {(viewModal.ticketNumber || viewModal.pnr || viewModal.bookingReference) && (
                <div className="p-4 rounded-2xl" style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)" }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Referans</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Bilet №", value: viewModal.ticketNumber },
                      { label: "PNR", value: viewModal.pnr },
                      { label: "Bron №", value: viewModal.bookingReference },
                    ].filter(r => r.value).map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                        <p className="text-sm font-mono font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {viewModal.notes && (
                <div className="p-4 rounded-2xl" style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)" }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Qeydlər</p>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{viewModal.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ClientAutocomplete({ defaultValue, bookings, ready }: { defaultValue: string, bookings: any[], ready: boolean }) {
  const [value, setValue] = useState(defaultValue)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [show, setShow] = useState(false)
  const uniqueClients = useMemo(() => [...new Set(bookings.map(b => b.clientName))].filter(Boolean), [bookings])

  function handleChange(v: string) {
    setValue(v)
    if (v.length > 0) {
      setSuggestions(uniqueClients.filter(c => c.toLowerCase().includes(v.toLowerCase())).slice(0, 6))
      setShow(true)
    } else setShow(false)
  }

  if (!ready) return null

  return (
    <div className="relative">
      <input name="clientName" value={value} onChange={e => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setShow(false), 150)} required
        className="w-full px-4 py-2.5 text-sm rounded-xl focus:outline-none"
        style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
      {show && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1.5 py-1 rounded-2xl overflow-hidden"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
          {suggestions.map(s => (
            <button key={s} type="button" onClick={() => { setValue(s); setShow(false) }}
              className="w-full text-left px-4 py-2.5 text-sm transition-all"
              style={{ color: "var(--text-primary)" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-glass)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}