"use client"
import * as XLSX from "xlsx"
import { supabase } from "@/lib/supabase"
import { useState, useEffect, useMemo } from "react"
import { useBookingsStore } from "@/lib/store/bookingsStore"
import { usePaymentsStore } from "@/lib/store/paymentsStore"
import { useUserRole } from "@/lib/hooks/useUserRole"
import { formatCurrency } from "@/lib/calculations"
import {
  TrendingUp, TrendingDown, DollarSign, Plus, Trash2,
  Wallet, ArrowUpRight, X, Receipt, CreditCard, BarChart3,
  CheckCircle2, Clock, AlertCircle, Edit3, FileDown, CalendarRange
} from "lucide-react"

interface Expense { id: string; name: string; amount: number; category: string; date: string }

// ─── Design tokens ────────────────────────────────────────────────────────
const card = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  backdropFilter: "blur(24px)",
  borderRadius: "24px",
}
const modalStyle = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border-color)",
  borderRadius: "28px",
}
const input = {
  background: "var(--bg-glass)",
  border: "1px solid var(--border-color)",
  color: "var(--text-primary)",
  borderRadius: "14px",
  padding: "11px 16px",
  fontSize: "14px",
  outline: "none",
  width: "100%",
  transition: "border-color 0.2s",
}

const EXPENSE_CATEGORIES = ["Ofis", "Kommunal", "Marketing", "Maaş", "Digər"]

// ─── Skeleton ─────────────────────────────────────────────────────────────
function Skeleton({ style = {} }: { style?: any }) {
  return <div className="animate-pulse rounded-2xl" style={{ background: "var(--bg-glass)", ...style }} />
}

// ─── Tab Button ────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all hover:scale-[1.02]"
      style={{
        background: active ? "linear-gradient(135deg, #ef4444, #f97316)" : "transparent",
        color: active ? "white" : "var(--text-secondary)",
        boxShadow: active ? "0 4px 12px rgba(239,68,68,0.25)" : "none",
      }}>
      {children}
    </button>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, label, action, onAction }: any) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-14 h-14 rounded-3xl flex items-center justify-center"
        style={{ background: "var(--bg-glass)" }}>
        <Icon size={24} style={{ color: "var(--text-muted)" }} />
      </div>
      <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>{label}</p>
      {action && (
        <button onClick={onAction}
          className="text-xs font-medium px-3 py-1.5 rounded-xl"
          style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
          {action}
        </button>
      )}
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────
export default function FinancesPage() {
  const { bookings, fetchBookings } = useBookingsStore()
  const { payments, fetchPayments, addPayment, deletePayment } = usePaymentsStore()
  const { profile } = useUserRole()
  const isReadOnly = profile?.role === "boss"
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [modal, setModal] = useState<"expense" | "income" | null>(null)
  const [tab, setTab] = useState<"overview" | "income" | "expense" | "kassa" | "debts">("overview")
  const [selectedBookingId, setSelectedBookingId] = useState("")
  const [cashAZN, setCashAZN] = useState(0)
  const [cashUSD, setCashUSD] = useState(0)
  const [cashModal, setCashModal] = useState(false)
  const [cashInput, setCashInput] = useState("")
  const [cashReason, setCashReason] = useState("")
  const [cashOperation, setCashOperation] = useState<"add" | "subtract">("add")
  const [cashCurrency, setCashCurrency] = useState<"AZN" | "USD">("AZN")
  const [cashHistory, setCashHistory] = useState<any[]>([])
  const [editModal, setEditModal] = useState<any>(null)
  const [editReason, setEditReason] = useState("")
  const [editAmount, setEditAmount] = useState("")
  const [editOperation, setEditOperation] = useState<"add"|"subtract">("add")
  const [editDate, setEditDate] = useState("")
  const [ready, setReady] = useState(false)
  const [kassaFrom, setKassaFrom] = useState("")
  const [kassaTo, setKassaTo] = useState("")
  const [pdfLoading, setPdfLoading] = useState(false)
  const [debtSearch, setDebtSearch] = useState("")
  const [debtPayAmounts, setDebtPayAmounts] = useState<Record<string, string>>({})
  const [debtPayLoading, setDebtPayLoading] = useState<string | null>(null)
  const [expenseCategories, setExpenseCategories] = useState<string[]>(["Ofis", "Kommunal", "Marketing", "Maaş", "Digər"])
  const [newCategoryInput, setNewCategoryInput] = useState("")
  const [showCategoryInput, setShowCategoryInput] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [incomeSearch, setIncomeSearch] = useState("")
  const [incomeBookings, setIncomeBookings] = useState<any[]>([])
  const [incomeAmounts, setIncomeAmounts] = useState<Record<string, string>>({})
  const [incomeLoading, setIncomeLoading] = useState<string | null>(null)

  async function loadCash() {
    const { data: balances } = await supabase.from("cash_balance").select("*")
    if (balances) {
      setCashUSD(balances.find((c: any) => c.currency === "USD")?.amount ?? 0)
    }
    let allTxData: any[] = []
    let txFrom = 0
    while (true) {
      const { data: txChunk } = await supabase.from("cash_transactions").select("*").order("created_at", { ascending: false }).range(txFrom, txFrom + 999)
      if (!txChunk || txChunk.length === 0) break
      allTxData = [...allTxData, ...txChunk]
      if (txChunk.length < 1000) break
      txFrom += 1000
    }
    // Always calculate AZN balance from transactions — never trust cash_balance table
    const realBalance = allTxData
      .filter(t => t.currency === "AZN")
      .reduce((s: number, t: any) => t.operation === "add" ? s + t.amount : s - t.amount, 0)
    setCashAZN(Math.max(0, realBalance))
    // Also sync cash_balance table so it stays correct
    await supabase.from("cash_balance").update({ amount: Math.max(0, realBalance), updated_at: new Date().toISOString() }).eq("currency", "AZN")
    setCashHistory(allTxData)
    // Load custom categories
    const { data: cats } = await supabase.from("expense_categories").select("name").order("created_at", { ascending: true })
    if (cats && cats.length > 0) {
      setExpenseCategories(cats.map((c: any) => c.name))
    }
  }

  useEffect(() => { fetchBookings(); fetchPayments(); loadCash(); setReady(true) }, [])

  const totalBookingRevenue = bookings.reduce((s, b) => s + b.sellPrice, 0)
  const totalBookingCost    = bookings.reduce((s, b) => s + b.buyPrice, 0)
  const totalExpenses       = expenses.reduce((s, e) => s + e.amount, 0)
  const totalManualIncome   = payments.reduce((s, p) => s + p.amount, 0)
  const totalProfit         = bookings.reduce((s, b) => s + b.profit, 0) - totalExpenses + totalManualIncome
  const margin              = totalBookingRevenue > 0 ? Math.round((totalProfit / totalBookingRevenue) * 100) : 0
  const unpaidBookings      = bookings.filter(b => b.paymentStatus !== "paid")

  const cashAznIn  = useMemo(() => cashHistory.filter(t => t.currency === "AZN" && t.operation === "add").reduce((s, t) => s + t.amount, 0), [cashHistory])
  const cashAznOut = useMemo(() => cashHistory.filter(t => t.currency === "AZN" && t.operation === "subtract").reduce((s, t) => s + t.amount, 0), [cashHistory])

  const filteredCashHistory = useMemo(() => {
    return cashHistory.filter(t => {
      if (!kassaFrom && !kassaTo) return true
      const d = new Date(t.created_at)
      const from = kassaFrom ? new Date(kassaFrom + "T00:00:00") : null
      const to   = kassaTo   ? new Date(kassaTo   + "T23:59:59") : null
      if (from && d < from) return false
      if (to   && d > to)   return false
      return true
    })
  }, [cashHistory, kassaFrom, kassaTo])

  async function downloadKassaPDF() {
    setPdfLoading(true)
    try {
      const { default: jsPDF } = await import("jspdf")
      const { default: autoTable } = await import("jspdf-autotable")

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

      // Header
      doc.setFontSize(18)
      doc.setTextColor(40, 40, 40)
      doc.text("ITS Tour — Kassa Hesabatı", 14, 18)

      const periodLabel = kassaFrom || kassaTo
        ? `${kassaFrom ? kassaFrom : "əvvəl"} — ${kassaTo ? kassaTo : "bu günə qədər"}`
        : "Bütün tarixlər"
      doc.setFontSize(10)
      doc.setTextColor(120, 120, 120)
      doc.text(`Dövr: ${periodLabel}`, 14, 26)
      doc.text(`Çap tarixi: ${new Date().toLocaleDateString("az-AZ")}`, 14, 32)

      // Summary row
      const totalIn  = filteredCashHistory.filter(t => t.currency === "AZN" && t.operation === "add").reduce((s, t) => s + t.amount, 0)
      const totalOut = filteredCashHistory.filter(t => t.currency === "AZN" && t.operation === "subtract").reduce((s, t) => s + t.amount, 0)
      doc.setFontSize(10)
      doc.setTextColor(40, 40, 40)
      doc.text(`AZN Giriş: ${totalIn.toFixed(2)}    AZN Çıxış: ${totalOut.toFixed(2)}    Fərq: ${(totalIn - totalOut).toFixed(2)}`, 14, 40)

      // Table
      const rows = filteredCashHistory.map(t => [
        new Date(t.created_at).toLocaleDateString("az-AZ") + " " + new Date(t.created_at).toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" }),
        t.currency,
        t.operation === "add" ? "Giriş" : "Çıxış",
        (t.operation === "add" ? "+" : "−") + Number(t.amount).toFixed(2) + " " + t.currency,
        t.reason || "—",
        Number(t.balance_after ?? 0).toFixed(2) + " " + t.currency,
      ])

      autoTable(doc, {
        startY: 46,
        head: [["Tarix / Saat", "Valyuta", "Növ", "Məbləğ", "Səbəb", "Qalıq"]],
        body: rows,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 255] },
        didParseCell(data) {
          if (data.section === "body" && data.column.index === 2) {
            data.cell.styles.textColor = data.cell.raw === "Giriş" ? [22, 163, 74] : [220, 38, 38]
          }
          if (data.section === "body" && data.column.index === 3) {
            const isIn = String(data.cell.raw ?? "").startsWith("+")
            data.cell.styles.textColor = isIn ? [22, 163, 74] : [220, 38, 38]
            data.cell.styles.fontStyle = "bold"
          }
        },
      })

      const filename = `kassa_${kassaFrom || "start"}_${kassaTo || "end"}.pdf`
      doc.save(filename)
    } finally {
      setPdfLoading(false)
    }
  }

  if (!ready) return (
    <div className="min-h-screen p-7" style={{ background: "var(--bg-primary)" }}>
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[1,2,3,4,5].map(i => <Skeleton key={i} style={{ height: 110 }} />)}
      </div>
      <Skeleton style={{ height: 400 }} />
    </div>
  )

  async function handleAddIncome(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const clientName = fd.get("name") as string
    let remaining = Number(fd.get("amount"))
    const date = fd.get("date") as string
    const description = fd.get("description") as string

    if (selectedBookingId) {
      const booking = bookings.find(b => b.id === selectedBookingId)
      if (booking) {
        const debt = booking.sellPrice - (booking.paidAmount ?? 0)
        const toPay = Math.min(remaining, debt)
        await addPayment({ clientName, amount: toPay, description, date, bookingId: selectedBookingId })
        remaining -= toPay
      }
    }
    if (remaining > 0) {
      const unpaid = bookings.filter(b => b.clientName.toLowerCase() === clientName.toLowerCase() && b.paymentStatus !== "paid" && b.id !== selectedBookingId).sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime())
      for (const booking of unpaid) {
        if (remaining <= 0) break
        const debt = booking.sellPrice - (booking.paidAmount ?? 0)
        if (debt <= 0) continue
        const toPay = Math.min(remaining, debt)
        await addPayment({ clientName, amount: toPay, description: `Auto: ${description}`, date, bookingId: booking.id })
        remaining -= toPay
      }
    }
    if (remaining > 0) {
      const { data: eb } = await supabase.from("client_balances").select("*").ilike("client_name", clientName).single()
      if (eb) await supabase.from("client_balances").update({ balance: eb.balance + remaining }).eq("id", eb.id)
      else await supabase.from("client_balances").insert({ client_name: clientName, balance: remaining })
      await supabase.from("client_balance_transactions").insert({ client_name: clientName, amount: remaining, type: "credit", description: `Artıq ödəniş: ${description}` })
    }
    await fetchBookings(); setSelectedBookingId(""); setModal(null)
  }

  function handleAddExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setExpenses(prev => [...prev, {
      id: Date.now().toString(),
      name: fd.get("name") as string,
      amount: Number(fd.get("amount")),
      category: fd.get("category") as string,
      date: fd.get("date") as string,
    }])
    setModal(null)
  }

  async function handleCashSubmit() {
    const amount = parseFloat(cashInput)
    if (!amount || amount <= 0) return
    if (cashCurrency === "AZN") {
      const nv = cashOperation === "add" ? cashAZN + amount : Math.max(0, cashAZN - amount)
      setCashAZN(nv)
      await supabase.from("cash_balance").update({ amount: nv, updated_at: new Date().toISOString() }).eq("currency", "AZN")
      await supabase.from("cash_transactions").insert({ currency: "AZN", operation: cashOperation, amount, reason: cashReason || null, balance_after: nv })
    } else {
      const nv = cashOperation === "add" ? cashUSD + amount : Math.max(0, cashUSD - amount)
      setCashUSD(nv)
      await supabase.from("cash_balance").update({ amount: nv, updated_at: new Date().toISOString() }).eq("currency", "USD")
      await supabase.from("cash_transactions").insert({ currency: "USD", operation: cashOperation, amount, reason: cashReason || null, balance_after: nv })
    }
    setCashInput(""); setCashReason("")
    await loadCash(); setCashModal(false)
  }



  async function handleDebtPay(booking: any) {
    const amount = parseFloat(debtPayAmounts[booking.id] ?? "")
    if (!amount || amount <= 0) return
    setDebtPayLoading(booking.id)
    const newPaid = (booking.paidAmount ?? 0) + amount
    const newStatus = newPaid >= booking.sellPrice ? "paid" : "partial"
    await supabase.from("bookings").update({ paid_amount: newPaid, payment_status: newStatus }).eq("id", booking.id)
    await fetchBookings()
    setDebtPayAmounts(prev => { const n = {...prev}; delete n[booking.id]; return n })
    setDebtPayLoading(null)
  }

  async function handleAddCategory() {
    const name = newCategoryInput.trim()
    if (!name) return
    if (expenseCategories.includes(name)) { setNewCategoryInput(""); setShowCategoryInput(false); return }
    // Save to supabase (create table if not exists)
    await supabase.from("expense_categories").insert({ name })
    setExpenseCategories(prev => [...prev, name])
    setNewCategoryInput("")
    setShowCategoryInput(false)
  }

  async function handleDeleteCategory(name: string) {
    await supabase.from("expense_categories").delete().eq("name", name)
    setExpenseCategories(prev => prev.filter(c => c !== name))
    if (categoryFilter === name) setCategoryFilter("all")
  }

  async function handleEditCash(t: any) {
    const amount = parseFloat(editAmount)
    if (!amount || amount <= 0) return
    const currency = t.currency

    // 1. Update the transaction amount and reason
    await supabase.from("cash_transactions").update({ amount, reason: editReason, operation: editOperation }).eq("id", t.id)

    // 2. Recalculate the true balance from all transactions
    const { data: allTx } = await supabase.from("cash_transactions").select("*").eq("currency", currency).order("created_at", { ascending: true })
    let running = 0
    for (const tx of allTx ?? []) {
      running = tx.operation === "add" ? running + tx.amount : running - tx.amount
      await supabase.from("cash_transactions").update({ balance_after: Math.max(0, running) }).eq("id", tx.id)
    }

    // 3. Set cash_balance to final running total
    await supabase.from("cash_balance").update({ amount: Math.max(0, running) }).eq("currency", currency)
    if (currency === "AZN") setCashAZN(Math.max(0, running))
    else setCashUSD(Math.max(0, running))

    await loadCash()
    setEditModal(null)
  }

  async function handleDeleteCash(t: any) {
    if (!confirm("Bu əməliyyatı silmək istəyirsiniz?")) return
    const currency = t.currency

    // 1. Delete the transaction
    await supabase.from("cash_transactions").delete().eq("id", t.id)

    // 2. Recalculate true balance from remaining transactions
    const { data: allTx } = await supabase.from("cash_transactions").select("*").eq("currency", currency).order("created_at", { ascending: true })
    let running = 0
    for (const tx of allTx ?? []) {
      running = tx.operation === "add" ? running + tx.amount : running - tx.amount
      await supabase.from("cash_transactions").update({ balance_after: Math.max(0, running) }).eq("id", tx.id)
    }

    // 3. Set cash_balance to final running total
    await supabase.from("cash_balance").update({ amount: Math.max(0, running) }).eq("currency", currency)
    if (currency === "AZN") setCashAZN(Math.max(0, running))
    else setCashUSD(Math.max(0, running))

    await loadCash()
  }

  return (
    <div className="min-h-screen p-5 md:p-7" style={{ background: "var(--bg-primary)" }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Maliyyə</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Maliyyə hesabatı və idarəetmə</p>
        </div>
        <div className="flex gap-2">
          {!isReadOnly && <button onClick={() => setModal("income")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-95"
            style={{ background: "linear-gradient(135deg, #10b981, #34d399)", boxShadow: "0 4px 16px rgba(16,185,129,0.3)" }}>
            <Plus size={15} />Gəlir
          </button>}
          {!isReadOnly && <button onClick={() => setModal("expense")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-95"
            style={{ background: "linear-gradient(135deg, #ef4444, #f97316)", boxShadow: "0 4px 16px rgba(239,68,68,0.3)" }}>
            <Plus size={15} />Xərc
          </button>}
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Revenue hero */}
        <div className="col-span-2 lg:col-span-1 p-5 rounded-3xl text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #10b981, #34d399)", boxShadow: "0 8px 24px rgba(16,185,129,0.3)" }}>
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-15" style={{ background: "white" }} />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold opacity-75 uppercase tracking-wider">Ümumi gəlir</p>
              <TrendingUp size={15} className="opacity-70" />
            </div>
            <p className="text-2xl font-bold tabular-nums mb-1">{formatCurrency(totalBookingRevenue + totalManualIncome)}</p>
            <p className="text-xs opacity-65">Sifarişlər + ödənişlər</p>
          </div>
        </div>

        {[
          { label: "Alış xərci",        value: formatCurrency(totalBookingCost), sub: "Bilet və tur",   Icon: TrendingDown, color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
          { label: "Əməliyyat xərcləri",value: formatCurrency(totalExpenses),    sub: `${expenses.length} qeyd`,   Icon: Receipt,     color: "#f97316", bg: "rgba(249,115,22,0.12)" },
          { label: "Xalis mənfəət",     value: formatCurrency(totalProfit),      sub: `Marja: ${margin}%`, Icon: BarChart3, color: totalProfit >= 0 ? "#22c55e" : "#ef4444", bg: totalProfit >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)" },
        ].map(({ label, value, sub, Icon, color, bg }) => (
          <div key={label} className="p-5 rounded-3xl transition-all hover:scale-[1.01]" style={card}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: bg }}>
                <Icon size={14} style={{ color }} />
              </div>
            </div>
            <p className="text-xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{sub}</p>
          </div>
        ))}

        {/* Kassa card */}
        <div className="p-5 rounded-3xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ ...card, borderColor: "rgba(99,102,241,0.25)", boxShadow: "0 0 0 1px rgba(99,102,241,0.1)", cursor: isReadOnly ? "default" : "pointer" }}
          onClick={() => !isReadOnly && setCashModal(true)}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Kassa</p>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.12)" }}>
              <Wallet size={14} style={{ color: "#6366f1" }} />
            </div>
          </div>
          <p className="text-xl font-bold tabular-nums mb-0.5" style={{ color: "#6366f1" }}>{formatCurrency(cashAZN)}</p>
          <p className="text-sm font-semibold text-green-500 tabular-nums">${cashUSD.toFixed(2)}</p>
          <div className="flex items-center gap-1 mt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nağd · Klikla idarə et</p>
          </div>
        </div>
      </div>

      {/* ── Tabs + Content ── */}
      <div className="rounded-3xl overflow-hidden" style={card}>
        <div className="flex gap-1 px-5 py-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <TabBtn active={tab === "overview"} onClick={() => setTab("overview")}>
            <BarChart3 size={14} /> Ümumi baxış
          </TabBtn>
          <TabBtn active={tab === "income"} onClick={() => setTab("income")}>
            <TrendingUp size={14} />
            Gəlirlər
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.2)", fontSize: "11px" }}>{payments.length}</span>
          </TabBtn>
          <TabBtn active={tab === "expense"} onClick={() => setTab("expense")}>
            <TrendingDown size={14} />
            Xərclər
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.2)", fontSize: "11px" }}>{expenses.length}</span>
          </TabBtn>
          <TabBtn active={tab === "kassa"} onClick={() => setTab("kassa")}>
            <Wallet size={14} />
            Kassa
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.2)", fontSize: "11px" }}>{cashHistory.length}</span>
          </TabBtn>
          <TabBtn active={tab === "debts"} onClick={() => setTab("debts")}>
            <CreditCard size={14} />
            Borclar
          </TabBtn>
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x" style={{ borderColor: "var(--border-color)" }}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Son ödənişlər</h3>
                <span className="text-xs font-bold text-green-500">{formatCurrency(totalManualIncome)}</span>
              </div>
              {payments.length === 0 ? <EmptyState icon={DollarSign} label="Hələ ödəniş yoxdur" action="Gəlir əlavə et" onAction={() => setModal("income")} /> : (
                <div className="space-y-1">
                  {payments.slice(0, 6).map(p => (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all"
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-glass)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(34,197,94,0.12)" }}>
                        <TrendingUp size={13} className="text-green-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{p.clientName}</p>
                        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{p.description || "—"}</p>
                      </div>
                      <p className="text-sm font-bold text-green-500 tabular-nums flex-shrink-0">{formatCurrency(p.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Son xərclər</h3>
                <span className="text-xs font-bold text-red-500">{formatCurrency(totalExpenses)}</span>
              </div>
              {expenses.length === 0 ? <EmptyState icon={Receipt} label="Xərc qeydi yoxdur" action="Xərc əlavə et" onAction={() => setModal("expense")} /> : (
                <div className="space-y-1">
                  {expenses.slice(0, 6).map(e => (
                    <div key={e.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all"
                      onMouseEnter={el => (el.currentTarget as HTMLElement).style.background = "var(--bg-glass)"}
                      onMouseLeave={el => (el.currentTarget as HTMLElement).style.background = "transparent"}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,68,68,0.12)" }}>
                        <TrendingDown size={13} className="text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{e.name}</p>
                        <span className="text-xs px-2 py-0.5 rounded-lg" style={{ background: "var(--bg-glass)", color: "var(--text-muted)" }}>{e.category}</span>
                      </div>
                      <p className="text-sm font-bold text-red-500 tabular-nums flex-shrink-0">{formatCurrency(e.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Income tab */}
        {tab === "income" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Daxil olan ödənişlər</h3>
              <p className="text-sm font-bold text-green-500 tabular-nums">Cəmi: {formatCurrency(totalManualIncome)}</p>
            </div>
            {payments.length === 0 ? <EmptyState icon={DollarSign} label="Hələ ödəniş yoxdur" action="İlk ödənişi əlavə et" onAction={() => setModal("income")} /> : (
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--bg-glass)", borderBottom: "1px solid var(--border-color)" }}>
                      {["Müştəri", "Açıqlama", "Tarix", "Məbləğ", "Sifariş", ""].map(h => (
                        <th key={h} className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--text-muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => {
                      const booking = bookings.find(b => b.id === p.bookingId)
                      return (
                        <tr key={p.id} className="group transition-all" style={{ borderBottom: "1px solid var(--border-color)" }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-glass)"}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                          <td className="px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>{p.clientName}</td>
                          <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{p.description || "—"}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{p.date}</td>
                          <td className="px-4 py-3 font-bold text-green-500 tabular-nums">{formatCurrency(p.amount)}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{booking ? booking.destination : "—"}</td>
                          <td className="px-4 py-3">
                            {!isReadOnly && <button onClick={() => deletePayment(p.id)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-xl transition-all hover:scale-110"
                              style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)" }}>
                              <Trash2 size={12} />
                            </button>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Expense tab */}
        {tab === "expense" && (
          <div className="p-6 space-y-5">
            {/* Categories management */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Kateqoriyalar</h3>
                <button onClick={() => setShowCategoryInput(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                  <Plus size={12} />Yeni kateqoriya
                </button>
              </div>
              {showCategoryInput && (
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Kateqoriya adı..."
                    value={newCategoryInput}
                    onChange={e => setNewCategoryInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddCategory()}
                    autoFocus
                    className="flex-1 px-3 py-2 text-sm rounded-xl"
                    style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)", outline: "none" }}
                  />
                  <button onClick={handleAddCategory}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, #10b981, #34d399)" }}>Əlavə et</button>
                  <button onClick={() => { setShowCategoryInput(false); setNewCategoryInput("") }}
                    className="px-3 py-2 rounded-xl text-sm"
                    style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>Ləğv et</button>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setCategoryFilter("all")}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: categoryFilter === "all" ? "linear-gradient(135deg,#ef4444,#f97316)" : "var(--bg-glass)", color: categoryFilter === "all" ? "white" : "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                  Hamısı
                </button>
                {expenseCategories.map(cat => (
                  <div key={cat} className="flex items-center gap-1 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                    <button onClick={() => setCategoryFilter(cat)}
                      className="px-3 py-1.5 text-xs font-semibold transition-all"
                      style={{ background: categoryFilter === cat ? "rgba(99,102,241,0.15)" : "var(--bg-glass)", color: categoryFilter === cat ? "#6366f1" : "var(--text-secondary)" }}>
                      {cat}
                    </button>
                    <button onClick={() => handleDeleteCategory(cat)}
                      className="px-1.5 py-1.5 text-xs transition-all hover:bg-red-50"
                      style={{ color: "var(--text-muted)", borderLeft: "1px solid var(--border-color)" }}>
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats by category */}
            {expenses.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {expenseCategories
                  .map(cat => ({ cat, total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0) }))
                  .filter(x => x.total > 0)
                  .sort((a, b) => b.total - a.total)
                  .map(({ cat, total }) => (
                    <div key={cat} className="p-4 rounded-2xl cursor-pointer transition-all hover:scale-[1.02]"
                      style={{ background: categoryFilter === cat ? "rgba(239,68,68,0.08)" : "var(--bg-glass)", border: `1px solid ${categoryFilter === cat ? "rgba(239,68,68,0.3)" : "var(--border-color)"}` }}
                      onClick={() => setCategoryFilter(categoryFilter === cat ? "all" : cat)}>
                      <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>{cat}</p>
                      <p className="text-base font-black text-red-500 tabular-nums">{formatCurrency(total)}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{expenses.filter(e => e.category === cat).length} əməliyyat</p>
                    </div>
                  ))}
              </div>
            )}

            {/* Total */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Xərclər {categoryFilter !== "all" ? `— ${categoryFilter}` : ""}
              </h3>
              <p className="text-sm font-bold text-red-500 tabular-nums">
                Cəmi: {formatCurrency(expenses.filter(e => categoryFilter === "all" || e.category === categoryFilter).reduce((s, e) => s + e.amount, 0))}
              </p>
            </div>

            {expenses.length === 0 ? <EmptyState icon={Receipt} label="Xərc qeydi yoxdur" action="İlk xərci əlavə et" onAction={() => setModal("expense")} /> : (
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--bg-glass)", borderBottom: "1px solid var(--border-color)" }}>
                      {["Ad", "Kateqoriya", "Tarix", "Məbləğ", ""].map(h => (
                        <th key={h} className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--text-muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.filter(e => categoryFilter === "all" || e.category === categoryFilter).map(e => (
                      <tr key={e.id} className="group transition-all" style={{ borderBottom: "1px solid var(--border-color)" }}
                        onMouseEnter={el => (el.currentTarget as HTMLElement).style.background = "var(--bg-glass)"}
                        onMouseLeave={el => (el.currentTarget as HTMLElement).style.background = "transparent"}>
                        <td className="px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>{e.name}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2.5 py-1 rounded-xl font-medium" style={{ background: "var(--bg-glass)", color: "var(--text-secondary)" }}>{e.category}</span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{e.date}</td>
                        <td className="px-4 py-3 font-bold text-red-500 tabular-nums">{formatCurrency(e.amount)}</td>
                        <td className="px-4 py-3">
                          {!isReadOnly && <button onClick={() => setExpenses(prev => prev.filter(x => x.id !== e.id))}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-xl transition-all hover:scale-110"
                            style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)" }}>
                            <Trash2 size={12} />
                          </button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Kassa tab */}
        {tab === "kassa" && (
          <div className="p-6">
            {/* Kassa summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              {[
                { label: "AZN Balansı", value: formatCurrency(cashAZN), color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
                { label: "USD Balansı", value: `$${cashUSD.toFixed(2)}`, color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
                { label: "AZN Giriş", value: formatCurrency(cashAznIn), color: "#22c55e", bg: "rgba(34,197,94,0.08)" },
                { label: "AZN Çıxış", value: formatCurrency(cashAznOut), color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className="p-4 rounded-2xl" style={{ background: bg }}>
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                  <p className="text-lg font-bold tabular-nums" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Kassa əməliyyatları</h3>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* Period filter */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl" style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)" }}>
                  <CalendarRange size={12} style={{ color: "var(--text-muted)" }} />
                  <input
                    type="date" value={kassaFrom} onChange={e => setKassaFrom(e.target.value)}
                    className="text-xs outline-none bg-transparent"
                    style={{ color: "var(--text-primary)", width: "110px" }}
                  />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                  <input
                    type="date" value={kassaTo} onChange={e => setKassaTo(e.target.value)}
                    className="text-xs outline-none bg-transparent"
                    style={{ color: "var(--text-primary)", width: "110px" }}
                  />
                  {(kassaFrom || kassaTo) && (
                    <button onClick={() => { setKassaFrom(""); setKassaTo("") }}
                      className="ml-1 p-0.5 rounded-lg transition-all hover:scale-110"
                      style={{ color: "var(--text-muted)" }}>
                      <X size={11} />
                    </button>
                  )}
                </div>
                {/* PDF download */}
                <button
                  onClick={downloadKassaPDF}
                  disabled={pdfLoading || filteredCashHistory.length === 0}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl text-white transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
                  {pdfLoading
                    ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <FileDown size={13} />}
                  PDF {filteredCashHistory.length !== cashHistory.length ? `(${filteredCashHistory.length})` : ""}
                </button>
                {!isReadOnly && <button onClick={() => setCashModal(true)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-all hover:scale-[1.03]"
                  style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}>
                  <Plus size={12} /> Əməliyyat
                </button>}
              </div>
            </div>

            {filteredCashHistory.length === 0 ? <EmptyState icon={Wallet} label={cashHistory.length > 0 ? "Seçilmiş dövrdə əməliyyat yoxdur" : "Hələ əməliyyat yoxdur"} /> : (
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--bg-glass)", borderBottom: "1px solid var(--border-color)" }}>
                      {["Tarix", "Valyuta", "Növ", "Məbləğ", "Səbəb", "Qalıq", ""].map(h => (
                        <th key={h} className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--text-muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCashHistory.map((t: any) => (
                      <tr key={t.id} className="group transition-all" style={{ borderBottom: "1px solid var(--border-color)" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-glass)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                          {new Date(t.created_at).toLocaleDateString("az-AZ")} {new Date(t.created_at).toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded-xl font-medium"
                            style={{ background: t.currency === "AZN" ? "rgba(99,102,241,0.12)" : "rgba(34,197,94,0.12)", color: t.currency === "AZN" ? "#6366f1" : "#22c55e" }}>
                            {t.currency}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded-xl font-medium"
                            style={{ background: t.operation === "add" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: t.operation === "add" ? "#22c55e" : "#ef4444" }}>
                            {t.operation === "add" ? "↑ Giriş" : "↓ Çıxış"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold tabular-nums" style={{ color: t.operation === "add" ? "#22c55e" : "#ef4444" }}>
                          {t.operation === "add" ? "+" : "−"}{t.amount} {t.currency}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{t.reason || "—"}</td>
                        <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{t.balance_after} {t.currency}</td>
                        <td className="px-4 py-3">
                          {!isReadOnly && <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => { setEditModal(t); setEditAmount(String(t.amount)); setEditReason(t.reason || ""); setEditOperation(t.operation); setEditDate(t.created_at?.slice(0,10) || "") }}
                              className="p-1.5 rounded-xl transition-all hover:scale-110"
                              style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                              <Edit3 size={12} />
                            </button>
                            <button onClick={() => handleDeleteCash(t)}
                              className="p-1.5 rounded-xl transition-all hover:scale-110"
                              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                              <Trash2 size={12} />
                            </button>
                          </div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Cash Modal ── */}
      {cashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto" style={modalStyle}>
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.12)" }}>
                  <Wallet size={15} style={{ color: "#6366f1" }} />
                </div>
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Kassa idarəetməsi</h2>
              </div>
              <button onClick={() => setCashModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "var(--bg-glass)", color: "var(--text-muted)" }}>
                <X size={15} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Balance display */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl text-center" style={{ background: "rgba(99,102,241,0.1)" }}>
                  <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>AZN</p>
                  <p className="text-xl font-bold tabular-nums" style={{ color: "#6366f1" }}>{formatCurrency(cashAZN)}</p>
                </div>
                <div className="p-4 rounded-2xl text-center" style={{ background: "rgba(34,197,94,0.1)" }}>
                  <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>USD</p>
                  <p className="text-xl font-bold tabular-nums text-green-500">${cashUSD.toFixed(2)}</p>
                </div>
              </div>

              {/* Operation type */}
              <div className="grid grid-cols-2 gap-2">
                {[{ v: "add", l: "↑ Giriş", color: "#22c55e", bg: "rgba(34,197,94,0.15)" }, { v: "subtract", l: "↓ Çıxış", color: "#ef4444", bg: "rgba(239,68,68,0.15)" }].map(op => (
                  <button key={op.v} onClick={() => setCashOperation(op.v as any)}
                    className="py-2.5 rounded-2xl text-sm font-semibold transition-all"
                    style={{
                      background: cashOperation === op.v ? op.bg : "var(--bg-glass)",
                      border: `1px solid ${cashOperation === op.v ? op.color + "40" : "var(--border-color)"}`,
                      color: cashOperation === op.v ? op.color : "var(--text-secondary)",
                    }}>
                    {op.l}
                  </button>
                ))}
              </div>

              {/* Currency */}
              <div className="grid grid-cols-2 gap-2">
                {["AZN", "USD"].map(cur => (
                  <button key={cur} onClick={() => setCashCurrency(cur as any)}
                    className="py-2.5 rounded-2xl text-sm font-semibold transition-all"
                    style={{
                      background: cashCurrency === cur ? "rgba(99,102,241,0.15)" : "var(--bg-glass)",
                      border: `1px solid ${cashCurrency === cur ? "rgba(99,102,241,0.4)" : "var(--border-color)"}`,
                      color: cashCurrency === cur ? "#6366f1" : "var(--text-secondary)",
                    }}>
                    {cur}
                  </button>
                ))}
              </div>

              <input type="number" value={cashInput} onChange={e => setCashInput(e.target.value)}
                placeholder={`Məbləğ (${cashCurrency})`} style={input} />
              <input type="text" value={cashReason} onChange={e => setCashReason(e.target.value)}
                placeholder="Səbəb (məs: Müştəri ödənişi)" style={input} />

              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleCashSubmit}
                  className="py-3 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-95"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>
                  Təsdiq et
                </button>
                <button onClick={() => setCashModal(false)}
                  className="py-3 rounded-2xl text-sm font-medium transition-all"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                  Ləğv et
                </button>
              </div>

              {/* History in modal */}
              {cashHistory.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                  <p className="text-xs font-semibold uppercase tracking-wider px-4 py-2.5" style={{ background: "var(--bg-glass)", color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)" }}>
                    Son əməliyyatlar
                  </p>
                  <div className="max-h-52 overflow-y-auto">
                    {cashHistory.slice(0, 10).map((t: any) => (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                          style={{ background: t.operation === "add" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: t.operation === "add" ? "#22c55e" : "#ef4444" }}>
                          {t.operation === "add" ? "↑" : "↓"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{t.reason || "Səbəb yoxdur"}</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{new Date(t.created_at).toLocaleDateString("az-AZ")} · {t.currency}</p>
                        </div>
                        <p className={`text-sm font-bold tabular-nums flex-shrink-0 ${t.operation === "add" ? "text-green-500" : "text-red-500"}`}>
                          {t.operation === "add" ? "+" : "−"}{t.amount}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ── Edit Cash Modal ── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-sm" style={modalStyle}>
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.12)" }}>
                  <Edit3 size={14} style={{ color: "#6366f1" }} />
                </div>
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Əməliyyatı redaktə et</h2>
              </div>
              <button onClick={() => setEditModal(null)} className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "var(--bg-glass)", color: "var(--text-muted)" }}>
                <X size={15} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 rounded-2xl flex items-center gap-3" style={{ background: "var(--bg-glass)" }}>
                <span className="text-xs px-2 py-1 rounded-xl font-medium"
                  style={{ background: editModal.operation === "add" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: editModal.operation === "add" ? "#22c55e" : "#ef4444" }}>
                  {editModal.operation === "add" ? "↑ Giriş" : "↓ Çıxış"}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{editModal.currency} · {new Date(editModal.created_at).toLocaleDateString("az-AZ")}</span>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Əməliyyat növü</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{v:"add",l:"↑ Giriş",color:"#22c55e",bg:"rgba(34,197,94,0.15)"},{v:"subtract",l:"↓ Çıxış",color:"#ef4444",bg:"rgba(239,68,68,0.15)"}].map(op => (
                    <button key={op.v} type="button" onClick={() => setEditOperation(op.v as any)}
                      className="py-2.5 rounded-2xl text-sm font-semibold transition-all"
                      style={{ background:editOperation===op.v?op.bg:"var(--bg-glass)", border:`1px solid ${editOperation===op.v?op.color+"40":"var(--border-color)"}`, color:editOperation===op.v?op.color:"var(--text-secondary)" }}>
                      {op.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Məbləğ ({editModal.currency})</label>
                <input type="number" step="0.01" min="0" value={editAmount} onChange={e => setEditAmount(e.target.value)} style={input} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Səbəb</label>
                <input type="text" value={editReason} onChange={e => setEditReason(e.target.value)} placeholder="Səbəb..." style={input} />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                <button onClick={() => setEditModal(null)}
                  className="py-2.5 rounded-2xl text-sm font-medium transition-all"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                  Ləğv et
                </button>
                <button onClick={() => handleEditCash(editModal)}
                  className="py-2.5 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}>
                  Yadda saxla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* ── Debts Tab ── */}
        {tab === "debts" && (
        <div className="space-y-5">
          {/* Search + Excel */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Müştəri adı ilə axtar..."
                value={debtSearch}
                onChange={e => setDebtSearch(e.target.value)}
                className="w-full px-5 py-3.5 text-sm rounded-2xl"
                style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)", outline: "none" }}
              />
              {debtSearch && (
                <button onClick={() => setDebtSearch("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }}>
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              onClick={() => {
                const rows = bookings
                  .filter(b => b.paymentStatus !== "paid" && b.sellPrice - (b.paidAmount ?? 0) > 0)
                  .filter(b => !debtSearch || b.clientName.toLowerCase().includes(debtSearch.toLowerCase()))
                  .sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime())
                  .map((b, i) => ({
                    "#": i + 1,
                    "Müştəri": b.clientName,
                    "Telefon": b.clientPhone || "",
                    "İstiqamət": b.destination || "",
                    "Növ": b.bookingType,
                    "Tarix": b.departureDate || "",
                    "Ümumi (AZN)": b.sellPrice,
                    "Ödənilib (AZN)": b.paidAmount ?? 0,
                    "Qalıq Borc (AZN)": Math.max(0, b.sellPrice - (b.paidAmount ?? 0)),
                    "Status": b.paymentStatus === "partial" ? "Qismən" : "Ödənilməyib",
                    "Menecer": b.manager || "",
                  }))
                const ws = XLSX.utils.json_to_sheet(rows)
                ws["!cols"] = [{wch:4},{wch:22},{wch:14},{wch:22},{wch:12},{wch:12},{wch:14},{wch:14},{wch:16},{wch:14},{wch:16}]
                const wb2 = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(wb2, ws, "Borclar")
                XLSX.writeFile(wb2, `borclar-${new Date().toISOString().slice(0,10)}.xlsx`)
              }}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.02] whitespace-nowrap"
              style={{ background: "linear-gradient(135deg,#10b981,#34d399)", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}>
              <ArrowUpRight size={15} />
              ⬇ Excel
            </button>
          </div>

          {/* Debt list */}
          {(() => {
            const debtBookings = bookings
              .filter(b => b.paymentStatus !== "paid" && b.sellPrice - (b.paidAmount ?? 0) > 0)
              .filter(b => !debtSearch || b.clientName.toLowerCase().includes(debtSearch.toLowerCase()))
              .sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime())

            if (debtBookings.length === 0) {
              return (
                <div className="text-center py-16 rounded-3xl" style={{ ...card, color: "var(--text-muted)" }}>
                  <p className="text-sm font-medium">{debtSearch ? "Müştəri tapılmadı" : "Borc yoxdur 🎉"}</p>
                </div>
              )
            }

            // Group by client
            const grouped: Record<string, typeof debtBookings> = {}
            debtBookings.forEach(b => {
              if (!grouped[b.clientName]) grouped[b.clientName] = []
              grouped[b.clientName].push(b)
            })

            return Object.entries(grouped).map(([clientName, clientBookings]) => {
              const totalDebt = clientBookings.reduce((s, b) => s + Math.max(0, b.sellPrice - (b.paidAmount ?? 0)), 0)
              return (
                <div key={clientName} className="rounded-3xl overflow-hidden" style={card}>
                  {/* Client header */}
                  <div className="px-5 py-4 flex items-center justify-between"
                    style={{ borderBottom: "1px solid var(--border-color)", background: "var(--bg-glass)" }}>
                    <div>
                      <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{clientName}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{clientBookings.length} sifariş</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>Cəmi borc</p>
                      <p className="text-lg font-black tabular-nums text-red-500">{formatCurrency(totalDebt)}</p>
                    </div>
                  </div>

                  {/* Bookings */}
                  <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                    {clientBookings.map(b => {
                      const remaining = Math.max(0, b.sellPrice - (b.paidAmount ?? 0))
                      const isLoading = debtPayLoading === b.id
                      return (
                        <div key={b.id} className="px-5 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                                {b.destination || "—"}
                              </p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                  ✈ {b.departureDate}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                                  {b.bookingType}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.paymentStatus === "partial" ? "text-orange-500" : "text-red-500"}`}
                                  style={{ background: b.paymentStatus === "partial" ? "rgba(249,115,22,0.1)" : "rgba(239,68,68,0.1)" }}>
                                  {b.paymentStatus === "partial" ? "Qismən" : "Ödənilməyib"}
                                </span>
                              </div>
                              <div className="flex gap-4 mt-1.5">
                                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                  Ümumi: <strong>{formatCurrency(b.sellPrice)}</strong>
                                </span>
                                <span className="text-xs text-green-500">
                                  Ödənilib: <strong>{formatCurrency(b.paidAmount ?? 0)}</strong>
                                </span>
                                <span className="text-xs text-red-500">
                                  Qalıq: <strong>{formatCurrency(remaining)}</strong>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Payment row */}
                          <div className="flex items-center gap-2 mt-3">
                            <input
                              type="number"
                              placeholder={`Ödəniş məbləği (max ${remaining.toFixed(2)})`}
                              value={debtPayAmounts[b.id] ?? ""}
                              onChange={e => setDebtPayAmounts(prev => ({ ...prev, [b.id]: e.target.value }))}
                              className="flex-1 px-3 py-2 text-sm rounded-xl"
                              style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)", outline: "none" }}
                            />
                            <button
                              onClick={() => {
                                if (!debtPayAmounts[b.id]) setDebtPayAmounts(prev => ({ ...prev, [b.id]: remaining.toFixed(2) }))
                                else handleDebtPay(b)
                              }}
                              disabled={isLoading}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-50 whitespace-nowrap"
                              style={{ background: "linear-gradient(135deg, #10b981, #34d399)", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}>
                              {isLoading ? (
                                <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }} />
                              ) : (
                                <CheckCircle2 size={14} />
                              )}
                              {debtPayAmounts[b.id] ? "Ödə" : "Tam ödə"}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      )}
      {/* ── Income Modal ── */}
      {modal === "income" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}
          onClick={e => { if (e.target === e.currentTarget) { setModal(null); setIncomeSearch(""); setIncomeBookings([]); setIncomeAmounts({}) } }}>
          <div className="w-full max-w-lg mb-8" style={modalStyle}>

            {/* Header */}
            <div className="px-6 py-5 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--border-color)", background: "linear-gradient(135deg,rgba(16,185,129,0.1),transparent)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#10b981,#34d399)", boxShadow: "0 4px 12px rgba(16,185,129,0.35)" }}>
                  <TrendingUp size={18} color="white" />
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Ödəniş qəbul et</h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Müştəri borcunu sil</p>
                </div>
              </div>
              <button onClick={() => { setModal(null); setIncomeSearch(""); setIncomeBookings([]); setIncomeAmounts({}) }}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110"
                style={{ background: "var(--bg-glass)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
                <X size={15} />
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* ── SEARCH ── */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                  Müştəri axtar
                </label>
                <div className="relative">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Ad yazın..."
                    value={incomeSearch}
                    onChange={e => {
                      const q = e.target.value
                      setIncomeSearch(q)
                      if (q.trim().length > 0) {
                        const matched = bookings
                          .filter(b => b.clientName.toLowerCase().includes(q.toLowerCase()) && b.paymentStatus !== "paid" && b.sellPrice - (b.paidAmount ?? 0) > 0)
                          .sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime())
                        setIncomeBookings(matched)
                      } else {
                        setIncomeBookings([])
                      }
                    }}
                    style={{ ...input, paddingRight: "44px" }}
                  />
                  {incomeSearch ? (
                    <button onClick={() => { setIncomeSearch(""); setIncomeBookings([]); setIncomeAmounts({}) }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ background: "var(--bg-glass)", color: "var(--text-muted)" }}>
                      <X size={12} />
                    </button>
                  ) : (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                      <AlertCircle size={15} />
                    </div>
                  )}
                </div>
              </div>

              {/* ── RESULTS ── */}
              {incomeSearch && incomeBookings.length === 0 && (
                <div className="py-8 text-center rounded-2xl" style={{ background: "var(--bg-glass)", color: "var(--text-muted)" }}>
                  <CheckCircle2 size={24} className="mx-auto mb-2 text-green-500" />
                  <p className="text-sm font-medium">Bu müştərinin borcu yoxdur</p>
                </div>
              )}

              {incomeBookings.length > 0 && (() => {
                // Group by client
                const grouped: Record<string, typeof incomeBookings> = {}
                incomeBookings.forEach(b => {
                  if (!grouped[b.clientName]) grouped[b.clientName] = []
                  grouped[b.clientName].push(b)
                })

                return Object.entries(grouped).map(([cName, cBooks]) => {
                  const totalDebt = cBooks.reduce((s, b) => s + Math.max(0, b.sellPrice - (b.paidAmount ?? 0)), 0)
                  return (
                    <div key={cName} className="rounded-2xl overflow-hidden"
                      style={{ border: "1px solid var(--border-color)" }}>

                      {/* Client row */}
                      <div className="px-4 py-3 flex items-center justify-between"
                        style={{ background: "var(--bg-glass)", borderBottom: "1px solid var(--border-color)" }}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-white text-sm font-black flex-shrink-0"
                            style={{ background: "linear-gradient(135deg,#ef4444,#f97316)" }}>
                            {cName[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{cName}</p>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{cBooks.length} sifariş · borc var</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>Cəmi borc</p>
                          <p className="text-base font-black text-red-500 tabular-nums">{formatCurrency(totalDebt)}</p>
                        </div>
                      </div>

                      {/* Booking rows */}
                      <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                        {cBooks.map((b, bi) => {
                          const remaining = Math.max(0, b.sellPrice - (b.paidAmount ?? 0))
                          const val = incomeAmounts[b.id] ?? ""
                          const isLoading = incomeLoading === b.id
                          return (
                            <div key={b.id} className="px-4 py-3.5"
                              style={{ background: bi % 2 === 0 ? "transparent" : "rgba(0,0,0,0.01)" }}>
                              {/* Booking info */}
                              <div className="flex items-start gap-2 mb-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                                    {b.destination || "—"}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>✈ {b.departureDate}</span>
                                    <span className="text-xs px-1.5 py-0.5 rounded-lg font-medium"
                                      style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                                      {b.bookingType}
                                    </span>
                                    <span className="text-xs px-1.5 py-0.5 rounded-lg font-medium"
                                      style={{ background: b.paymentStatus === "partial" ? "rgba(249,115,22,0.1)" : "rgba(239,68,68,0.1)",
                                               color: b.paymentStatus === "partial" ? "#ea580c" : "#ef4444" }}>
                                      {b.paymentStatus === "partial" ? "Qismən" : "Ödənilməyib"}
                                    </span>
                                  </div>
                                  {/* Amounts row */}
                                  <div className="flex gap-3 mt-1.5">
                                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                      Ümumi: <span className="font-bold">{formatCurrency(b.sellPrice)}</span>
                                    </span>
                                    {(b.paidAmount ?? 0) > 0 && (
                                      <span className="text-xs text-green-500">
                                        Ödənilib: <span className="font-bold">{formatCurrency(b.paidAmount)}</span>
                                      </span>
                                    )}
                                    <span className="text-xs text-red-500">
                                      Qalıq: <span className="font-bold">{formatCurrency(remaining)}</span>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Payment input */}
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  max={remaining}
                                  value={val}
                                  onChange={e => setIncomeAmounts(prev => ({ ...prev, [b.id]: e.target.value }))}
                                  placeholder={`Max: ${remaining.toFixed(2)} AZN`}
                                  className="flex-1 px-3 py-2 text-sm rounded-xl"
                                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)", outline: "none" }}
                                />
                                <button
                                  disabled={isLoading}
                                  onClick={async () => {
                                    const amt = parseFloat(val || remaining.toFixed(2))
                                    if (!amt || amt <= 0) return
                                    setIncomeLoading(b.id)
                                    const newPaid = (b.paidAmount ?? 0) + amt
                                    await addPayment({ clientName: b.clientName, amount: amt, description: `Ödəniş: ${b.destination}`, date: new Date().toISOString().split("T")[0], bookingId: b.id })
                                    await fetchBookings()
                                    setIncomeAmounts(prev => { const n = { ...prev }; delete n[b.id]; return n })
                                    setIncomeBookings(prev => prev.filter(x => {
                                      if (x.id !== b.id) return true
                                      return (x.sellPrice - newPaid) > 0.01
                                    }))
                                    setIncomeLoading(null)
                                  }}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white whitespace-nowrap transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-50"
                                  style={{ background: "linear-gradient(135deg,#10b981,#34d399)", boxShadow: "0 4px 14px rgba(16,185,129,0.35)", minWidth: "80px", justifyContent: "center" }}>
                                  {isLoading ? (
                                    <span className="w-4 h-4 border-2 rounded-full animate-spin flex-shrink-0"
                                      style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }} />
                                  ) : (
                                    <CheckCircle2 size={14} />
                                  )}
                                  {val ? "Ödə" : "Tam ödə"}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              })()}

              {/* ── DIVIDER ── */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px" style={{ background: "var(--border-color)" }} />
                <span className="text-xs font-bold uppercase tracking-widest px-2" style={{ color: "var(--text-muted)" }}>Əl ilə qeyd</span>
                <div className="flex-1 h-px" style={{ background: "var(--border-color)" }} />
              </div>

              {/* ── MANUAL FORM ── */}
              <form onSubmit={handleAddIncome} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Müştəri *</label>
                    <input name="name" required placeholder="Ad..." style={input} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Məbləğ (AZN) *</label>
                    <input name="amount" type="number" step="0.01" min="0" required style={input} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Tarix</label>
                    <input name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} style={input} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Açıqlama</label>
                    <input name="description" placeholder="Qeyd..." style={input} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2" style={{ borderTop: "1px solid var(--border-color)" }}>
                  <button type="button"
                    onClick={() => { setModal(null); setIncomeSearch(""); setIncomeBookings([]); setIncomeAmounts({}) }}
                    className="py-2.5 rounded-2xl text-sm font-medium transition-all"
                    style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                    Bağla
                  </button>
                  <button type="submit"
                    className="py-2.5 rounded-2xl text-sm font-bold text-white transition-all hover:scale-[1.02]"
                    style={{ background: "linear-gradient(135deg,#10b981,#34d399)", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}>
                    Yadda saxla
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      )}

            {/* ── Expense Modal ── */}
      {modal === "expense" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-sm" style={modalStyle}>
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.12)" }}>
                  <TrendingDown size={14} className="text-red-500" />
                </div>
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Yeni xərc qeydi</h2>
              </div>
              <button onClick={() => setModal(null)} className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "var(--bg-glass)", color: "var(--text-muted)" }}>
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Ad *</label>
                <input name="name" required style={input} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Məbləğ (AZN) *</label>
                  <input name="amount" type="number" step="0.01" min="0" required style={input} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Tarix</label>
                  <input name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} style={input} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Kateqoriya</label>
                <div className="grid grid-cols-3 gap-2">
                  {EXPENSE_CATEGORIES.map(cat => (
                    <label key={cat} className="cursor-pointer">
                      <input type="radio" name="category" value={cat} defaultChecked={cat === "Ofis"} className="sr-only peer" />
                      <div className="text-center py-2 rounded-xl text-xs font-medium border-2 transition-all peer-checked:border-red-500 peer-checked:bg-red-50 peer-checked:text-red-600"
                        style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}>
                        {cat}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                <button type="button" onClick={() => setModal(null)}
                  className="py-2.5 rounded-2xl text-sm font-medium transition-all"
                  style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                  Ləğv et
                </button>
                <button type="submit"
                  className="py-2.5 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #ef4444, #f97316)", boxShadow: "0 4px 12px rgba(239,68,68,0.3)" }}>
                  Əlavə et
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}