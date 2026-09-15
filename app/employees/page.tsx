"use client"

import { useState, useEffect, useMemo } from "react"
import { useBookingsStore } from "@/lib/store/bookingsStore"
import { formatCurrency } from "@/lib/calculations"
import { supabase } from "@/lib/supabase"
import {
  Plus, Trash2, Users, TrendingUp, DollarSign, Award,
  CheckCircle2, Clock, X, ChevronLeft, ChevronRight,
  Edit3, Gift, AlertCircle, Wallet, BarChart3, ClipboardList,
  Calendar, Star, ArrowLeft, Eye, Search
} from "lucide-react"

interface Employee {
  id: string; name: string; position: string; baseSalary: number
  commissionPercent: number; phone: string; email: string; status: "active" | "inactive"
}

interface EmployeePayment {
  id: string; employeeId: string; employeeName: string; month: string
  salaryAmount: number; salaryPaidAmount: number; salaryPaid: boolean; salaryPaidAt: string | null
  bonusAmount: number; bonusPaidAmount: number; bonusPaid: boolean; bonusPaidAt: string | null
  notes: string
}

const card = { background: "var(--bg-card)", border: "1px solid var(--border-color)", backdropFilter: "blur(24px)", borderRadius: "24px" }
const modalCard = { background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "28px" }
const inp = { background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)", borderRadius: "12px", padding: "10px 16px", fontSize: "14px", outline: "none", width: "100%" }

const GRADIENTS = [
  "linear-gradient(135deg, #ef4444, #f97316)",
  "linear-gradient(135deg, #3b82f6, #06b6d4)",
  "linear-gradient(135deg, #10b981, #34d399)",
  "linear-gradient(135deg, #8b5cf6, #6366f1)",
  "linear-gradient(135deg, #f59e0b, #fbbf24)",
  "linear-gradient(135deg, #ec4899, #f43f5e)",
]

const MONTHS_AZ = ["Yanvar","Fevral","Mart","Aprel","May","İyun","İyul","Avqust","Sentyabr","Oktyabr","Noyabr","Dekabr"]

function getMonthLabel(month: string) {
  const [y, m] = month.split("-")
  return `${MONTHS_AZ[parseInt(m) - 1]} ${y}`
}
function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}
function prevMonth(month: string) {
  const [y, m] = month.split("-").map(Number)
  if (m === 1) return `${y-1}-12`
  return `${y}-${String(m-1).padStart(2,"0")}`
}
function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number)
  if (m === 12) return `${y+1}-01`
  return `${y}-${String(m+1).padStart(2,"0")}`
}
function monthsBack(n: number) {
  const months = []
  let m = getCurrentMonth()
  for (let i = 0; i < n; i++) { months.push(m); m = prevMonth(m) }
  return months
}
function mapPayment(p: any): EmployeePayment {
  return {
    id: p.id, employeeId: p.employee_id, employeeName: p.employee_name, month: p.month,
    salaryAmount: p.salary_amount ?? 0,
    salaryPaidAmount: p.salary_paid_amount ?? (p.salary_paid ? (p.salary_amount ?? 0) : 0),
    salaryPaid: p.salary_paid ?? false, salaryPaidAt: p.salary_paid_at,
    bonusAmount: p.bonus_amount ?? 0,
    bonusPaidAmount: p.bonus_paid_amount ?? (p.bonus_paid ? (p.bonus_amount ?? 0) : 0),
    bonusPaid: p.bonus_paid ?? false, bonusPaidAt: p.bonus_paid_at,
    notes: p.notes ?? ""
  }
}
function getSalaryStatus(payment: EmployeePayment) {
  if (payment.salaryPaidAmount === 0) return "unpaid"
  if (payment.salaryPaidAmount >= payment.salaryAmount) return "paid"
  return "partial"
}
function getBonusStatus(payment: EmployeePayment) {
  if (payment.bonusAmount === 0) return "none"
  if (payment.bonusPaidAmount === 0) return "unpaid"
  if (payment.bonusPaidAmount >= payment.bonusAmount) return "paid"
  return "partial"
}

const STATUS_CONFIG = {
  paid:    { label: "Tam ödənilib",    color: "#22c55e", bg: "rgba(34,197,94,0.12)",   Icon: CheckCircle2 },
  partial: { label: "Qismən",          color: "#f97316", bg: "rgba(249,115,22,0.12)",  Icon: AlertCircle },
  unpaid:  { label: "Ödənilməyib",     color: "#ef4444", bg: "rgba(239,68,68,0.12)",   Icon: Clock },
  none:    { label: "Bonus yoxdur",    color: "#9ca3af", bg: "var(--bg-glass)",          Icon: Gift },
}

// ─── Employee Detail View ─────────────────────────────────────
function EmployeeDetail({ emp, bookings, allPayments, onBack, onEdit, idx }: {
  emp: Employee; bookings: any[]; allPayments: EmployeePayment[]; onBack: () => void; onEdit: (emp: Employee) => void; idx: number
}) {
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [viewBooking, setViewBooking] = useState<any>(null)
  const [editBooking, setEditBooking] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<any>({})

  const myBookings = useMemo(() => {
    return bookings.filter(b => {
      if (b.manager !== emp.name) return false
      if (search) {
        const q = search.toLowerCase()
        if (!(b.clientName ?? "").toLowerCase().includes(q) && !(b.destination ?? "").toLowerCase().includes(q)) return false
      }
      if (dateFrom) { const d = new Date(b.createdAt); if (d < new Date(dateFrom + "T00:00:00")) return false }
      if (dateTo)   { const d = new Date(b.createdAt); if (d > new Date(dateTo + "T23:59:59")) return false }
      return true
    })
  }, [bookings, emp.name, search, dateFrom, dateTo])

  const totalRev    = myBookings.reduce((s, b) => s + b.sellPrice, 0)
  const totalBuy    = myBookings.reduce((s, b) => s + b.buyPrice, 0)
  const grossProfit = myBookings.filter(b => (b.commissionPercent ?? 0) > 0).reduce((s, b) => s + b.profit + b.commissionAmount, 0)
  const totalBonus  = grossProfit > 0 ? Math.round(grossProfit * (emp.commissionPercent / 100) * 100) / 100 : 0
  const totalProfit = myBookings.reduce((s, b) => s + b.profit, 0)
  const unpaidCount = myBookings.filter(b => b.paymentStatus !== "paid").length

  function openEdit(b: any) {
    setEditForm({
      clientName: b.clientName ?? "", clientPhone: b.clientPhone ?? "",
      destination: b.destination ?? "", departureDate: b.departureDate ?? "",
      returnDate: b.returnDate ?? "", travelers: b.travelers ?? 1,
      bookingType: b.bookingType ?? "bilet",
      buyPrice: b.buyPrice ?? 0, sellPrice: b.sellPrice ?? 0,
      commissionPercent: b.commissionPercent ?? 10,
      vendor: b.vendor ?? "", pnr: b.pnr ?? "",
      ticketNumber: b.ticketNumber ?? "", notes: b.notes ?? "",
      status: b.status ?? "pending", paymentStatus: b.paymentStatus ?? "unpaid",
      paidAmount: b.paidAmount ?? 0,
    })
    setEditBooking(b)
    setViewBooking(null)
  }

  async function handleSaveEdit() {
    if (!editBooking) return
    setSaving(true)
    const gross = Number(editForm.sellPrice) - Number(editForm.buyPrice)
    const commAmt = Math.round(gross * (Number(editForm.commissionPercent) / 100) * 100) / 100
    const profit  = gross - commAmt
    await supabase.from("bookings").update({
      client_name: editForm.clientName, client_phone: editForm.clientPhone,
      destination: editForm.destination, departure_date: editForm.departureDate,
      return_date: editForm.returnDate, travelers: Number(editForm.travelers),
      booking_type: editForm.bookingType,
      buy_price: Number(editForm.buyPrice), sell_price: Number(editForm.sellPrice),
      commission_percent: Number(editForm.commissionPercent),
      commission_amount: commAmt, profit,
      vendor: editForm.vendor, pnr: editForm.pnr,
      ticket_number: editForm.ticketNumber, notes: editForm.notes,
      status: editForm.status, payment_status: editForm.paymentStatus,
      paid_amount: Number(editForm.paidAmount),
    }).eq("id", editBooking.id)
    setSaving(false)
    setEditBooking(null)
    // Refresh store
    const { useBookingsStore: bs } = await import("@/lib/store/bookingsStore")
    bs.getState().fetchBookings()
  }

  const inpStyle = { background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)", borderRadius: "10px", padding: "9px 12px", fontSize: "13px", outline: "none", width: "100%" }

  return (
    <div className="min-h-screen p-5 md:p-6" style={{ background: "var(--bg-primary)" }}>
      {/* Back */}
      <button onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium mb-5 transition-all hover:opacity-70"
        style={{ color: "var(--text-secondary)" }}>
        <ArrowLeft size={15} />Geri
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white flex-shrink-0"
            style={{ background: GRADIENTS[idx % GRADIENTS.length] }}>
            {emp.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>{emp.name}</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {emp.position || "Menecer"} · {emp.commissionPercent}% komissiya · {formatCurrency(emp.baseSalary)} maaş
            </p>
          </div>
        </div>
        <button onClick={() => onEdit(emp)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02]"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          <Edit3 size={13} />Düzəlt
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        {[
          { label: "Satış həcmi",  value: formatCurrency(totalRev),    color: "#6366f1" },
          { label: "Alış xərci",   value: formatCurrency(totalBuy),    color: "#ef4444" },
          { label: "Mənfəət",      value: formatCurrency(totalProfit), color: "#22c55e" },
          { label: `Bonus (${emp.commissionPercent}%)`, value: formatCurrency(totalBonus), color: "#f59e0b" },
          { label: "Ödənilməyib",  value: unpaidCount + " sifariş",   color: "#ef4444" },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-4 rounded-2xl" style={card}>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
            <p className="text-lg font-black tabular-nums" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-[180px]"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <Search size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Müştəri, istiqamət..."
            className="bg-transparent text-xs outline-none w-full" style={{ color: "var(--text-primary)" }} />
          {search && <button onClick={() => setSearch("")}><X size={11} style={{ color: "var(--text-muted)" }} /></button>}
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs outline-none"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs outline-none"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(""); setDateTo("") }}
            className="px-3 py-2 rounded-xl text-xs font-medium"
            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
            Sıfırla
          </button>
        )}
        <span className="px-3 py-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {myBookings.length} sifariş
        </span>
      </div>

      {/* Bookings table */}
      <div className="rounded-2xl overflow-hidden" style={card}>
        {myBookings.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <ClipboardList size={32} style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sifariş tapılmadı</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "linear-gradient(135deg,var(--bg-glass),var(--bg-secondary))", borderBottom: "1px solid var(--border-color)" }}>
                  {["Müştəri","İstiqamət","Növ","Tarix","Satış","Alış","Mənfəət","Bonus","Ödəniş","Status",""].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-wider px-3 py-3"
                      style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myBookings.map(b => {
                  const gross = b.profit + b.commissionAmount
                  const bBonus = (b.commissionPercent ?? 0) > 0 && gross > 0
                    ? Math.round(gross * (emp.commissionPercent / 100) * 100) / 100 : 0
                  return (
                    <tr key={b.id} className="group transition-all" style={{ borderBottom: "1px solid var(--border-color)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-xs demo-name" style={{ color: "var(--text-primary)" }}>{b.clientName}</p>
                        {b.clientPhone && <p className="text-[10px] demo-phone" style={{ color: "var(--text-muted)" }}>{b.clientPhone}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-secondary)", maxWidth: 130 }}>
                        <p className="truncate">{b.destination}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg"
                          style={{ background: "var(--bg-glass)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                          {b.bookingType}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {b.departureDate}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-bold tabular-nums text-right" style={{ color: "var(--text-primary)" }}>
                        {formatCurrency(b.sellPrice)}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-semibold tabular-nums text-right text-red-400">
                        {formatCurrency(b.buyPrice)}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-semibold tabular-nums text-right"
                        style={{ color: b.profit >= 0 ? "#22c55e" : "#ef4444" }}>
                        {formatCurrency(b.profit)}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-bold tabular-nums text-right" style={{ color: "#f59e0b" }}>
                        +{formatCurrency(bBonus)}
                      </td>
                      <td className="px-3 py-2.5">
                        {b.paymentStatus === "paid"
                          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>Ödənilib</span>
                          : b.paymentStatus === "partial"
                          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>Qismən</span>
                          : <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>Ödənilməyib</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {b.status === "confirmed"
                          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>Təsdiqlənib</span>
                          : b.status === "cancelled"
                          ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>Ləğv</span>
                          : <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>Gözləyir</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => setViewBooking(b)}
                            className="p-1.5 rounded-lg transition-all hover:scale-110"
                            style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                            <Eye size={12} />
                          </button>
                          <button onClick={() => openEdit(b)}
                            className="p-1.5 rounded-lg transition-all hover:scale-110"
                            style={{ background: "var(--bg-glass)", color: "var(--text-secondary)" }}>
                            <Edit3 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Footer total */}
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--border-color)", background: "var(--bg-glass)" }}>
                  <td className="px-3 py-3 text-xs font-bold" style={{ color: "var(--text-secondary)" }} colSpan={4}>CƏMI ({myBookings.length} sifariş)</td>
                  <td className="px-3 py-3 text-xs font-black tabular-nums text-right" style={{ color: "var(--text-primary)" }}>{formatCurrency(totalRev)}</td>
                  <td className="px-3 py-3 text-xs font-black tabular-nums text-right text-red-400">{formatCurrency(totalBuy)}</td>
                  <td className="px-3 py-3 text-xs font-black tabular-nums text-right text-green-500">{formatCurrency(totalProfit)}</td>
                  <td className="px-3 py-3 text-xs font-black tabular-nums text-right" style={{ color: "#f59e0b" }}>+{formatCurrency(totalBonus)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* View Modal */}
      {viewBooking && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" style={{ backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto" style={modalCard}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{viewBooking.clientName}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(viewBooking)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl text-white"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                  <Edit3 size={12} />Düzəlt
                </button>
                <button onClick={() => setViewBooking(null)} style={{ color: "var(--text-muted)" }}><X size={18} /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Müştəri", viewBooking.clientName],
                ["Telefon", viewBooking.clientPhone || "—"],
                ["İstiqamət", viewBooking.destination],
                ["Növ", viewBooking.bookingType],
                ["Getmə tarixi", viewBooking.departureDate],
                ["Qayıdış tarixi", viewBooking.returnDate || "—"],
                ["Səyahətçi", viewBooking.travelers + " nəfər"],
                ["Vendor", viewBooking.vendor || "—"],
                ["PNR", viewBooking.pnr || "—"],
                ["Bilet №", viewBooking.ticketNumber || "—"],
                ["Satış qiyməti", formatCurrency(viewBooking.sellPrice)],
                ["Alış qiyməti", formatCurrency(viewBooking.buyPrice)],
                ["Mənfəət", formatCurrency(viewBooking.profit)],
                [`Bonus (${emp.commissionPercent}%)`, formatCurrency((() => { const g = viewBooking.profit + viewBooking.commissionAmount; return g > 0 ? Math.round(g * emp.commissionPercent / 100 * 100) / 100 : 0 })())],
                ["Ödənilib", formatCurrency(viewBooking.paidAmount ?? 0)],
                ["Qalıq", formatCurrency(viewBooking.sellPrice - (viewBooking.paidAmount ?? 0))],
              ].map(([label, value]) => (
                <div key={label} className="p-3 rounded-xl" style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)" }}>
                  <p className="text-[10px] font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
                </div>
              ))}
            </div>
            {viewBooking.notes && (
              <div className="mt-3 p-3 rounded-xl" style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)" }}>
                <p className="text-[10px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>Qeyd</p>
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>{viewBooking.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editBooking && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" style={{ backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto" style={modalCard}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Sifarişi düzəlt</h2>
              <button onClick={() => setEditBooking(null)} style={{ color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Müştəri adı", key: "clientName", type: "text" },
                { label: "Telefon", key: "clientPhone", type: "text" },
                { label: "İstiqamət", key: "destination", type: "text" },
                { label: "Getmə tarixi", key: "departureDate", type: "date" },
                { label: "Qayıdış tarixi", key: "returnDate", type: "date" },
                { label: "Səyahətçi sayı", key: "travelers", type: "number" },
                { label: "Alış qiyməti", key: "buyPrice", type: "number" },
                { label: "Satış qiyməti", key: "sellPrice", type: "number" },
                { label: "Komissiya %", key: "commissionPercent", type: "number" },
                { label: "Ödənilib", key: "paidAmount", type: "number" },
                { label: "Vendor", key: "vendor", type: "text" },
                { label: "PNR", key: "pnr", type: "text" },
                { label: "Bilet №", key: "ticketNumber", type: "text" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="text-[10px] font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>{label}</label>
                  <input type={type} value={editForm[key]} onChange={e => setEditForm((f: any) => ({ ...f, [key]: e.target.value }))} style={inpStyle} />
                </div>
              ))}
              <div>
                <label className="text-[10px] font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>Status</label>
                <select value={editForm.status} onChange={e => setEditForm((f: any) => ({ ...f, status: e.target.value }))} style={inpStyle}>
                  <option value="pending">Gözləyir</option>
                  <option value="confirmed">Təsdiqlənib</option>
                  <option value="completed">Tamamlandı</option>
                  <option value="cancelled">Ləğv edildi</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>Ödəniş statusu</label>
                <select value={editForm.paymentStatus} onChange={e => setEditForm((f: any) => ({ ...f, paymentStatus: e.target.value }))} style={inpStyle}>
                  <option value="unpaid">Ödənilməyib</option>
                  <option value="partial">Qismən</option>
                  <option value="paid">Ödənilib</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>Qeyd</label>
                <textarea value={editForm.notes} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))}
                  rows={2} style={{ ...inpStyle, resize: "none" }} />
              </div>
            </div>
            {/* Profit preview */}
            <div className="mt-3 p-3 rounded-xl flex items-center justify-between"
              style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Mənfəət preview:</span>
              <span className="text-sm font-bold" style={{ color: "#22c55e" }}>
                {formatCurrency((Number(editForm.sellPrice) - Number(editForm.buyPrice)) * (1 - Number(editForm.commissionPercent) / 100))}
              </span>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleSaveEdit} disabled={saving}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                {saving ? "Yadda saxlanılır..." : "Yadda saxla"}
              </button>
              <button onClick={() => setEditBooking(null)}
                className="px-5 py-3 rounded-2xl text-sm"
                style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                Ləğv
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function EmployeesPage() {
  const { bookings, fetchBookings } = useBookingsStore()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [payments, setPayments] = useState<EmployeePayment[]>([])
  const [allPayments, setAllPayments] = useState<EmployeePayment[]>([])
  const [modal, setModal] = useState(false)
  const [payModal, setPayModal] = useState<{ emp: Employee; payment: EmployeePayment } | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [bookingsModal, setBookingsModal] = useState<{ emp: Employee; month: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Employee | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [ready, setReady] = useState(false)
  const [activeTab, setActiveTab] = useState<"salary" | "period" | "employees">("salary")
  const [periodMonths, setPeriodMonths] = useState(1)
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [useCustom, setUseCustom] = useState(false)
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)

  useEffect(() => { fetchBookings(); fetchEmployees(); setReady(true) }, [])
  useEffect(() => { if (employees.length > 0) fetchPayments() }, [selectedMonth, employees.length])

  async function fetchPayments(empList?: Employee[]) {
    const list = empList ?? employees
    if (list.length === 0) return
    const { data } = await supabase.from("employee_payments").select("*").eq("month", selectedMonth)
    const existing = data ?? []
    const missing = list.filter(e => e.status === "active" && !existing.find((p: any) => p.employee_id === e.id))
    if (missing.length > 0) {
      await supabase.from("employee_payments").insert(missing.map(e => ({
        employee_id: e.id, employee_name: e.name, month: selectedMonth,
        salary_amount: e.baseSalary, salary_paid_amount: 0, salary_paid: false, salary_paid_at: null,
        bonus_amount: 0, bonus_paid_amount: 0, bonus_paid: false, bonus_paid_at: null, notes: ""
      })))
      const { data: fresh } = await supabase.from("employee_payments").select("*").eq("month", selectedMonth)
      setPayments((fresh ?? []).map(mapPayment))
    } else {
      setPayments(existing.map(mapPayment))
    }
    // Load all payments for period tab
    const { data: all } = await supabase.from("employee_payments").select("*")
    setAllPayments((all ?? []).map(mapPayment))
  }

  async function fetchEmployees() {
    const { data } = await supabase.from("employees").select("*").order("created_at", { ascending: false })
    if (data) {
      const list: Employee[] = data.map((e: any) => ({
        id: e.id, name: e.name, position: e.position ?? "",
        baseSalary: e.base_salary ?? 0, commissionPercent: e.commission_percent ?? 10,
        phone: e.phone ?? "", email: e.email ?? "", status: e.status ?? "active"
      }))
      setEmployees(list)
      await fetchPayments(list)
    }
    setLoading(false)
  }

  // Get bookings for employee in a specific month
  function getMonthBookings(name: string, month: string) {
    return bookings.filter(b => {
      if (b.manager !== name) return false
      const bMonth = (b.createdAt ?? "").slice(0, 7)
      return bMonth === month
    })
  }

  // Calculate real commission from bookings for a month
  function calcRealCommission(emp: Employee, month: string) {
    const mb = getMonthBookings(emp.name, month)
    const gross = mb.filter(b => (b.commissionPercent ?? 0) > 0)
      .reduce((s, b) => s + b.profit + b.commissionAmount, 0)
    if (gross <= 0) return 0
    return Math.round(gross * (emp.commissionPercent / 100) * 100) / 100
  }

  // Period stats for an employee
  function getPeriodStats(emp: Employee, nMonths: number) {
    const months = monthsBack(nMonths)
    let totalSalary = 0, totalBonus = 0, totalPaid = 0, totalBookings = 0, totalRevenue = 0, totalProfit = 0
    for (const m of months) {
      const p = allPayments.find(p => p.employeeId === emp.id && p.month === m)
      totalSalary += p?.salaryAmount ?? emp.baseSalary
      const bonus = calcRealCommission(emp, m)
      totalBonus += bonus
      totalPaid += (p?.salaryPaidAmount ?? 0) + (p?.bonusPaidAmount ?? 0)
      const mb = getMonthBookings(emp.name, m)
      totalBookings += mb.length
      totalRevenue += mb.reduce((s, b) => s + b.sellPrice, 0)
      totalProfit += mb.reduce((s, b) => s + b.profit, 0)
    }
    return { totalSalary, totalBonus, totalPaid, totalBookings, totalRevenue, totalProfit, months }
  }

  function getCustomStats(emp: Employee) {
    if (!customFrom && !customTo) return null
    const from = customFrom ? new Date(customFrom + "T00:00:00") : null
    const to   = customTo   ? new Date(customTo   + "T23:59:59") : null

    const filteredBookings = bookings.filter(b => {
      if (b.manager !== emp.name) return false
      const d = new Date(b.createdAt)
      if (from && d < from) return false
      if (to   && d > to)   return false
      return true
    })

    const totalRevenue = filteredBookings.reduce((s, b) => s + b.sellPrice, 0)
    const totalBuy     = filteredBookings.reduce((s, b) => s + b.buyPrice, 0)
    const grossProfit  = filteredBookings.filter(b => (b.commissionPercent ?? 0) > 0).reduce((s, b) => s + b.profit + b.commissionAmount, 0)
    const totalBonus   = grossProfit > 0 ? Math.round(grossProfit * (emp.commissionPercent / 100) * 100) / 100 : 0
    const totalProfit  = filteredBookings.reduce((s, b) => s + b.profit, 0)

    // Get months in range for salary
    const months: string[] = []
    if (customFrom && customTo) {
      let cur = customFrom.slice(0, 7)
      const end = customTo.slice(0, 7)
      while (cur <= end) {
        months.push(cur)
        cur = nextMonth(cur)
      }
    }
    const totalSalary = months.length * emp.baseSalary
    const totalPaid = months.reduce((s, m) => {
      const p = allPayments.find(p => p.employeeId === emp.id && p.month === m)
      return s + (p?.salaryPaidAmount ?? 0) + (p?.bonusPaidAmount ?? 0)
    }, 0)

    return { filteredBookings, totalRevenue, totalBuy, grossProfit, totalBonus, totalProfit, totalSalary, totalPaid, months, bookingsCount: filteredBookings.length }
  }

  async function handleSavePayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!payModal) return
    const fd = new FormData(e.currentTarget)
    const salaryAmount = Number(fd.get("salaryAmount"))
    const salaryPaidAmount = Number(fd.get("salaryPaidAmount"))
    const bonusAmount = Number(fd.get("bonusAmount"))
    const bonusPaidAmount = Number(fd.get("bonusPaidAmount"))
    const now = new Date().toISOString()
    await supabase.from("employee_payments").update({
      salary_amount: salaryAmount, salary_paid_amount: salaryPaidAmount,
      salary_paid: salaryPaidAmount >= salaryAmount && salaryAmount > 0,
      salary_paid_at: salaryPaidAmount >= salaryAmount && salaryAmount > 0 ? now : null,
      bonus_amount: bonusAmount, bonus_paid_amount: bonusPaidAmount,
      bonus_paid: bonusPaidAmount >= bonusAmount && bonusAmount > 0,
      bonus_paid_at: bonusPaidAmount >= bonusAmount && bonusAmount > 0 ? now : null,
      notes: fd.get("notes") as string,
    }).eq("id", payModal.payment.id)
    await fetchPayments(); setPayModal(null)
  }

  async function handleSubmitEmployee(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data = {
      name: fd.get("name") as string, position: fd.get("position") as string,
      base_salary: Number(fd.get("baseSalary")), commission_percent: Number(fd.get("commissionPercent")),
      phone: fd.get("phone") as string, email: fd.get("email") as string, status: fd.get("status") as string
    }
    if (selected) await supabase.from("employees").update(data).eq("id", selected.id)
    else await supabase.from("employees").insert(data)
    await fetchEmployees(); setModal(false); setSelected(null)
  }

  async function handleDelete(id: string) {
    if (confirm("Silinsin?")) { await supabase.from("employees").delete().eq("id", id); await fetchEmployees() }
  }

  async function toggleCommissionPaid(bookingId: string, currentPaid: boolean) {
    setMarkingId(bookingId)
    await supabase.from("bookings").update({
      commission_paid: !currentPaid,
      commission_paid_at: !currentPaid ? new Date().toISOString() : null
    }).eq("id", bookingId)
    await fetchBookings()
    setMarkingId(null)
  }

  if (!ready) return null

  // Show employee detail view
  if (selectedEmployee) {
    const empIdx = employees.findIndex(e => e.id === selectedEmployee.id)
    return (
      <EmployeeDetail
        emp={selectedEmployee}
        bookings={bookings}
        allPayments={allPayments}
        onBack={() => setSelectedEmployee(null)}
        onEdit={(emp) => { setSelectedEmployee(null); setSelected(emp); setModal(true) }}
        idx={empIdx >= 0 ? empIdx : 0}
      />
    )
  }

  const activeEmps = employees.filter(e => e.status === "active")
  const totalBaseSalary = activeEmps.reduce((s, e) => s + e.baseSalary, 0)
  const totalBonus = activeEmps.reduce((s, e) => s + calcRealCommission(e, selectedMonth), 0)
  const totalPaidOut = payments.reduce((s, p) => s + p.salaryPaidAmount + p.bonusPaidAmount, 0)
  const paidFull = payments.filter(p => getSalaryStatus(p) === "paid").length
  const unpaidCount = payments.filter(p => getSalaryStatus(p) === "unpaid").length

  return (
    <div className="min-h-screen p-5 md:p-7" style={{ background: "var(--bg-primary)" }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>İşçilər & Maaşlar</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{activeEmps.length} aktiv işçi</p>
        </div>
        <button onClick={() => { setSelected(null); setModal(true) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.02]"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>
          <Plus size={15} />İşçi əlavə et
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Ümumi maaş fondu", value: formatCurrency(totalBaseSalary), Icon: Wallet, color: "#6366f1", bg: "rgba(99,102,241,0.12)" },
          { label: `${getMonthLabel(selectedMonth)} bonusu`, value: formatCurrency(totalBonus), Icon: Gift, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
          { label: "Ödənilib (bu ay)", value: formatCurrency(totalPaidOut), Icon: CheckCircle2, color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
          { label: "Ödənilməyib", value: unpaidCount + " nəfər", Icon: AlertCircle, color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
        ].map(({ label, value, Icon, color, bg }) => (
          <div key={label} className="p-5 rounded-3xl" style={card}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
              <div className="w-8 h-8 rounded-2xl flex items-center justify-center" style={{ background: bg }}>
                <Icon size={14} style={{ color }} />
              </div>
            </div>
            <p className="text-xl font-black tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-2xl mb-5 w-fit" style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)" }}>
        {[
          { key: "salary", label: "💰 Maaş & Bonus" },
          { key: "period", label: "📊 Dövr analizi" },
          { key: "employees", label: "👥 İşçilər" },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: activeTab === t.key ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "transparent",
              color: activeTab === t.key ? "white" : "var(--text-secondary)",
              boxShadow: activeTab === t.key ? "0 2px 8px rgba(99,102,241,0.3)" : "none"
            }}>{t.label}</button>
        ))}
      </div>

      {/* ── Salary Tab ── */}
      {activeTab === "salary" && (
        <>
          {/* Month nav */}
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => setSelectedMonth(prevMonth(selectedMonth))}
              className="p-2 rounded-xl transition-all hover:scale-110"
              style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold px-4 py-2 rounded-xl" style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)", minWidth: 160, textAlign: "center" }}>
              {getMonthLabel(selectedMonth)}
            </span>
            <button onClick={() => setSelectedMonth(nextMonth(selectedMonth))}
              className="p-2 rounded-xl transition-all hover:scale-110"
              style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="rounded-3xl overflow-hidden" style={card}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr style={{ background: "linear-gradient(135deg,var(--bg-glass),var(--bg-secondary))", borderBottom: "1px solid var(--border-color)" }}>
                    {["İşçi", "Vəzifə", "Əməkhaqqı", "Sifarişlər", "Hesablanan bonus", "Ödənilib (maaş)", "Ödənilib (bonus)", "Status", ""].map(h => (
                      <th key={h} className="text-left text-[11px] font-bold uppercase tracking-widest px-4 py-4" style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-4 py-4"><div className="h-4 rounded-lg animate-pulse" style={{ background: "var(--bg-glass)", width: "80%" }} /></td>
                      ))}
                    </tr>
                  )) : activeEmps.map((emp, idx) => {
                    const payment = payments.find(p => p.employeeId === emp.id)
                    if (!payment) return null
                    const realBonus = calcRealCommission(emp, selectedMonth)
                    const monthBookings = getMonthBookings(emp.name, selectedMonth)
                    const salStatus = getSalaryStatus(payment)
                    const bonStatus = getBonusStatus(payment)
                    const salCfg = STATUS_CONFIG[salStatus]
                    const SalIcon = salCfg.Icon
                    return (
                      <tr key={emp.id} className="group transition-all" style={{ borderBottom: "1px solid var(--border-color)" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-glass)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                              style={{ background: GRADIENTS[idx % GRADIENTS.length] }}>
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{emp.name}</p>
                              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{emp.commissionPercent}% komissiya</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-medium px-2.5 py-1 rounded-xl" style={{ background: "var(--bg-glass)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                            {emp.position || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-bold tabular-nums text-sm" style={{ color: "var(--text-primary)" }}>{formatCurrency(emp.baseSalary)}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <button onClick={() => setBookingsModal({ emp, month: selectedMonth })}
                            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-all hover:scale-105"
                            style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                            <ClipboardList size={12} />
                            {monthBookings.length} sifariş
                          </button>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-bold tabular-nums text-sm" style={{ color: "#f59e0b" }}>{formatCurrency(realBonus)}</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{emp.commissionPercent}% × mənfəət</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold tabular-nums text-sm" style={{ color: "#22c55e" }}>{formatCurrency(payment.salaryPaidAmount)}</p>
                          {payment.salaryPaidAmount < payment.salaryAmount && (
                            <p className="text-xs text-red-400">Qalıq: {formatCurrency(payment.salaryAmount - payment.salaryPaidAmount)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold tabular-nums text-sm" style={{ color: "#22c55e" }}>{formatCurrency(payment.bonusPaidAmount)}</p>
                          {payment.bonusPaidAmount < realBonus && realBonus > 0 && (
                            <p className="text-xs text-red-400">Qalıq: {formatCurrency(realBonus - payment.bonusPaidAmount)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-xl"
                            style={{ background: salCfg.bg, color: salCfg.color }}>
                            <SalIcon size={11} />{salCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <button onClick={() => setPayModal({ emp, payment })}
                            className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl text-white transition-all hover:scale-105"
                            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                            <Edit3 size={12} />Ödə
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Period Tab ── */}
      {activeTab === "period" && (
        <>
          {/* Period selector */}
          <div className="p-4 rounded-3xl mb-5" style={card}>
            <div className="flex flex-wrap items-center gap-3">
              {/* Quick buttons */}
              <div className="flex gap-1.5">
                {[1, 2, 3, 6].map(n => (
                  <button key={n} onClick={() => { setPeriodMonths(n); setUseCustom(false) }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: !useCustom && periodMonths === n ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "var(--bg-glass)",
                      color: !useCustom && periodMonths === n ? "white" : "var(--text-secondary)",
                      border: "1px solid " + (!useCustom && periodMonths === n ? "transparent" : "var(--border-color)")
                    }}>
                    {n} ay
                  </button>
                ))}
              </div>

              <div className="w-px h-6" style={{ background: "var(--border-color)" }} />

              {/* Custom date range */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Özəl dövr:</span>
                <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setUseCustom(true) }}
                  className="text-xs outline-none px-2.5 py-2 rounded-xl"
                  style={{ background: "var(--bg-glass)", border: "1px solid " + (useCustom ? "#6366f1" : "var(--border-color)"), color: "var(--text-primary)" }} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setUseCustom(true) }}
                  className="text-xs outline-none px-2.5 py-2 rounded-xl"
                  style={{ background: "var(--bg-glass)", border: "1px solid " + (useCustom ? "#6366f1" : "var(--border-color)"), color: "var(--text-primary)" }} />
                {useCustom && (
                  <button onClick={() => { setCustomFrom(""); setCustomTo(""); setUseCustom(false) }}
                    className="p-1.5 rounded-lg transition-all hover:scale-110"
                    style={{ color: "var(--text-muted)" }}>
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Employee cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeEmps.map((emp, idx) => {
              const customStats = useCustom ? getCustomStats(emp) : null
              const stats = useCustom ? null : getPeriodStats(emp, periodMonths)
              const totalSalary = customStats?.totalSalary ?? stats?.totalSalary ?? 0
              const totalBonus  = customStats?.totalBonus  ?? stats?.totalBonus  ?? 0
              const totalPaid   = customStats?.totalPaid   ?? stats?.totalPaid   ?? 0
              const totalBooks  = customStats?.bookingsCount ?? stats?.totalBookings ?? 0
              const totalRev    = customStats?.totalRevenue ?? stats?.totalRevenue ?? 0
              const totalProfit = customStats?.totalProfit ?? stats?.totalProfit ?? 0
              const unpaid      = Math.max(0, totalSalary + totalBonus - totalPaid)
              const isExpanded  = expandedEmp === emp.id

              return (
                <div key={emp.id} className="rounded-3xl overflow-hidden" style={card}>
                  {/* Header */}
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-base font-bold text-white flex-shrink-0"
                        style={{ background: GRADIENTS[idx % GRADIENTS.length] }}>
                        {emp.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{emp.name}</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{emp.position} · {emp.commissionPercent}% komissiya</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                          {useCustom ? (customFrom && customTo ? `${customFrom} — ${customTo}` : "Özəl dövr") : `Son ${periodMonths} ay`}
                        </p>
                        <p className="text-sm font-bold" style={{ color: "#6366f1" }}>{totalBooks} sifariş</p>
                      </div>
                    </div>

                    {/* KPI grid */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: "Satış həcmi", value: formatCurrency(totalRev), color: "var(--text-primary)" },
                        { label: "Brüt mənfəət", value: formatCurrency(totalProfit + totalBonus), color: "#6366f1" },
                        { label: "Bonus (%"+emp.commissionPercent+")", value: formatCurrency(totalBonus), color: "#f59e0b" },
                        { label: "Maaş cəmi", value: formatCurrency(totalSalary), color: "var(--text-primary)" },
                        { label: "Ödənilib", value: formatCurrency(totalPaid), color: "#22c55e" },
                        { label: "Borc", value: formatCurrency(unpaid), color: unpaid > 0 ? "#ef4444" : "#22c55e" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="p-2.5 rounded-2xl" style={{ background: "var(--bg-glass)" }}>
                          <p className="text-[10px] font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
                          <p className="text-xs font-bold tabular-nums" style={{ color }}>{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Expand button */}
                    <button onClick={() => setExpandedEmp(isExpanded ? null : emp.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all"
                      style={{ background: "var(--bg-glass)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                      {isExpanded ? "Gizlət ▲" : "Ətraflı göstər ▼"}
                    </button>
                  </div>

                  {/* Expanded: monthly breakdown or bookings list */}
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-2" style={{ borderTop: "1px solid var(--border-color)" }}>
                      <p className="text-xs font-bold pt-3 mb-2" style={{ color: "var(--text-muted)" }}>
                        {useCustom ? "SİFARİŞLƏR" : "AYLIQ İCMAL"}
                      </p>

                      {useCustom ? (
                        /* Custom: show bookings list */
                        customStats?.filteredBookings.length === 0 ? (
                          <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>Bu dövrdə sifariş yoxdur</p>
                        ) : customStats?.filteredBookings.map((b: any) => (
                          <div key={b.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                            style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)" }}>
                            <div>
                              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{b.clientName}</p>
                              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{b.destination} · {b.createdAt?.slice(0,10)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold" style={{ color: "#22c55e" }}>{formatCurrency(b.sellPrice)}</p>
                              <p className="text-[10px]" style={{ color: "#f59e0b" }}>
                                +{formatCurrency(Math.round((b.profit + b.commissionAmount) * emp.commissionPercent / 100 * 100) / 100)} bonus
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        /* Monthly: show month breakdown */
                        stats?.months.map(m => {
                          const p = allPayments.find(p => p.employeeId === emp.id && p.month === m)
                          const bonus = calcRealCommission(emp, m)
                          const mb = getMonthBookings(emp.name, m)
                          const salPaid = p?.salaryPaidAmount ?? 0
                          const bonPaid = p?.bonusPaidAmount ?? 0
                          return (
                            <div key={m} className="flex items-center justify-between px-3 py-2 rounded-xl"
                              style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)" }}>
                              <div className="flex items-center gap-2">
                                <Calendar size={12} style={{ color: "var(--text-muted)" }} />
                                <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{getMonthLabel(m)}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-lg" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>{mb.length} sif.</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs">
                                <span style={{ color: "var(--text-muted)" }}>Maaş: <span className="font-semibold" style={{ color: salPaid >= (p?.salaryAmount ?? emp.baseSalary) ? "#22c55e" : "#ef4444" }}>{formatCurrency(salPaid)}</span></span>
                                <span style={{ color: "var(--text-muted)" }}>Bonus: <span className="font-semibold" style={{ color: bonPaid >= bonus && bonus > 0 ? "#22c55e" : bonus > 0 ? "#f59e0b" : "var(--text-muted)" }}>{formatCurrency(bonPaid)}/{formatCurrency(bonus)}</span></span>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Employees Tab ── */}
      {activeTab === "employees" && (
        <div className="rounded-3xl overflow-hidden" style={card}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "linear-gradient(135deg,var(--bg-glass),var(--bg-secondary))", borderBottom: "1px solid var(--border-color)" }}>
                  {["İşçi", "Vəzifə", "Əsas maaş", "Komissiya %", "Ümumi sifariş", "Ümumi satış", "Telefon", "Status", ""].map(h => (
                    <th key={h} className="text-left text-[11px] font-bold uppercase tracking-widest px-4 py-4" style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, idx) => {
                  const allB = bookings.filter(b => b.manager === emp.name)
                  return (
                    <tr key={emp.id} className="group transition-all" style={{ borderBottom: "1px solid var(--border-color)" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-glass)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setSelectedEmployee(emp)}>
                          <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-bold text-white"
                            style={{ background: GRADIENTS[idx % GRADIENTS.length] }}>
                            {emp.name.charAt(0)}
                          </div>
                          <p className="font-semibold text-sm hover:underline" style={{ color: "var(--text-primary)" }}>{emp.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs" style={{ color: "var(--text-secondary)" }}>{emp.position || "—"}</td>
                      <td className="px-4 py-3.5 font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{formatCurrency(emp.baseSalary)}</td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-xl" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
                          {emp.commissionPercent}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <button onClick={() => setSelectedEmployee(emp)}
                          className="font-semibold tabular-nums text-sm hover:underline"
                          style={{ color: "#6366f1" }}>
                          {allB.length}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 font-semibold tabular-nums" style={{ color: "#22c55e" }}>{formatCurrency(allB.reduce((s, b) => s + b.sellPrice, 0))}</td>
                      <td className="px-4 py-3.5 text-xs" style={{ color: "var(--text-secondary)" }}>{emp.phone || "—"}</td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-xl"
                          style={{ background: emp.status === "active" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: emp.status === "active" ? "#22c55e" : "#ef4444" }}>
                          {emp.status === "active" ? "Aktiv" : "Deaktiv"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => setSelectedEmployee(emp)}
                            className="p-1.5 rounded-xl" style={{ color: "#6366f1", background: "rgba(99,102,241,0.1)" }}>
                            <Eye size={13} />
                          </button>
                          <button onClick={() => { setSelected(emp); setModal(true) }}
                            className="p-1.5 rounded-xl" style={{ color: "var(--text-secondary)", background: "var(--bg-glass)" }}>
                            <Edit3 size={13} />
                          </button>
                          <button onClick={() => handleDelete(emp.id)}
                            className="p-1.5 rounded-xl" style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)" }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pay Modal ── */}
      {payModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" style={{ backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-md p-6" style={modalCard}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{payModal.emp.name}</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{getMonthLabel(selectedMonth)}</p>
              </div>
              <button onClick={() => setPayModal(null)} style={{ color: "var(--text-muted)" }}><X size={18} /></button>
            </div>

            {/* Commission info */}
            <div className="p-3 rounded-2xl mb-4" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <p className="text-xs font-medium mb-1" style={{ color: "#f59e0b" }}>Hesablanan bonus ({payModal.emp.commissionPercent}%)</p>
              <p className="text-xl font-black tabular-nums" style={{ color: "#f59e0b" }}>
                {formatCurrency(calcRealCommission(payModal.emp, selectedMonth))}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {getMonthBookings(payModal.emp.name, selectedMonth).length} sifariş əsasında
              </p>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Maaş məbləği</label>
                  <input name="salaryAmount" type="number" step="0.01" defaultValue={payModal.payment.salaryAmount || payModal.emp.baseSalary} style={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Ödənilən maaş</label>
                  <input name="salaryPaidAmount" type="number" step="0.01" defaultValue={payModal.payment.salaryPaidAmount} style={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Bonus məbləği</label>
                  <input name="bonusAmount" type="number" step="0.01" defaultValue={payModal.payment.bonusAmount || calcRealCommission(payModal.emp, selectedMonth)} style={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Ödənilən bonus</label>
                  <input name="bonusPaidAmount" type="number" step="0.01" defaultValue={payModal.payment.bonusPaidAmount} style={inp} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Qeyd</label>
                <input name="notes" defaultValue={payModal.payment.notes} placeholder="Əlavə qeyd..." style={inp} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit"
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                  Yadda saxla
                </button>
                <button type="button" onClick={() => setPayModal(null)}
                  className="px-5 py-3 rounded-2xl text-sm"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                  Ləğv
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bookings Modal (commission tracking) ── */}
      {bookingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" style={{ backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col" style={modalCard}>
            <div className="flex items-center justify-between p-5 pb-3">
              <div>
                <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                  {bookingsModal.emp.name} — {getMonthLabel(bookingsModal.month)}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Komissiya ödəmə statusu · {bookingsModal.emp.commissionPercent}%
                </p>
              </div>
              <button onClick={() => setBookingsModal(null)} style={{ color: "var(--text-muted)" }}><X size={18} /></button>
            </div>

            {/* Summary */}
            <div className="px-5 pb-3">
              <div className="grid grid-cols-3 gap-3">
                {(() => {
                  const mb = getMonthBookings(bookingsModal.emp.name, bookingsModal.month)
                  const paid = mb.filter((b: any) => b.commissionPaid)
                  const totalBonus = calcRealCommission(bookingsModal.emp, bookingsModal.month)
                  return [
                    { label: "Cəmi sifariş", value: mb.length, color: "#6366f1" },
                    { label: "Komissiya ödənilib", value: paid.length, color: "#22c55e" },
                    { label: "Hesablanan bonus", value: formatCurrency(totalBonus), color: "#f59e0b" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="p-3 rounded-2xl" style={{ background: "var(--bg-glass)" }}>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color }}>{value}</p>
                    </div>
                  ))
                })()}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
              {getMonthBookings(bookingsModal.emp.name, bookingsModal.month).length === 0 ? (
                <div className="py-10 text-center" style={{ color: "var(--text-muted)" }}>Bu ay üçün sifariş yoxdur</div>
              ) : getMonthBookings(bookingsModal.emp.name, bookingsModal.month).map((b: any) => {
                const gross = b.profit + b.commissionAmount
                const commission = Math.round(gross * (bookingsModal.emp.commissionPercent / 100) * 100) / 100
                const isPaid = b.commissionPaid
                return (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-2xl transition-all"
                    style={{ background: isPaid ? "rgba(34,197,94,0.05)" : "var(--bg-glass)", border: `1px solid ${isPaid ? "rgba(34,197,94,0.2)" : "var(--border-color)"}` }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{b.clientName}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-lg" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>{b.bookingType}</span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {b.destination} · Satış: {formatCurrency(b.sellPrice)} · Mənfəət: {formatCurrency(b.profit)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold tabular-nums" style={{ color: "#f59e0b" }}>{formatCurrency(commission)}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>komissiya</p>
                    </div>
                    <button
                      onClick={() => toggleCommissionPaid(b.id, isPaid)}
                      disabled={markingId === b.id}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:scale-105 disabled:opacity-50 flex-shrink-0"
                      style={{
                        background: isPaid ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.1)",
                        color: isPaid ? "#22c55e" : "#ef4444",
                        border: `1px solid ${isPaid ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.2)"}`,
                        minWidth: 90
                      }}>
                      {markingId === b.id ? "..." : isPaid ? <><CheckCircle2 size={11} />Ödənilib</> : <><Clock size={11} />Ödənilməyib</>}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Employee Modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" style={{ backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-md p-6" style={modalCard}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{selected ? "İşçini düzəlt" : "Yeni işçi"}</h2>
              <button onClick={() => { setModal(false); setSelected(null) }} style={{ color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmitEmployee} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Ad Soyad *</label>
                  <input name="name" required defaultValue={selected?.name} placeholder="Ad Soyad" style={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Vəzifə</label>
                  <input name="position" defaultValue={selected?.position} placeholder="Menecer" style={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Status</label>
                  <select name="status" defaultValue={selected?.status ?? "active"} style={inp}>
                    <option value="active">Aktiv</option>
                    <option value="inactive">Deaktiv</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Əsas maaş (AZN)</label>
                  <input name="baseSalary" type="number" step="0.01" defaultValue={selected?.baseSalary} placeholder="800" style={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Komissiya (%)</label>
                  <input name="commissionPercent" type="number" step="0.1" min="0" max="100" defaultValue={selected?.commissionPercent ?? 10} placeholder="10" style={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Telefon</label>
                  <input name="phone" defaultValue={selected?.phone} placeholder="+994..." style={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Email</label>
                  <input name="email" type="email" defaultValue={selected?.email} placeholder="email@..." style={inp} />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit"
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                  {selected ? "Yadda saxla" : "Əlavə et"}
                </button>
                <button type="button" onClick={() => { setModal(false); setSelected(null) }}
                  className="px-5 py-3 rounded-2xl text-sm"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                  Ləğv
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
