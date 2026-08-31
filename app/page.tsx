"use client"
import { useEffect, useState, useMemo } from "react"
import { useBookingsStore } from "@/lib/store/bookingsStore"
import { usePaymentsStore } from "@/lib/store/paymentsStore"
import { useUserRole } from "@/lib/hooks/useUserRole"
import { supabase } from "@/lib/supabase"
import { formatCurrency } from "@/lib/calculations"
import {
  TrendingUp, TrendingDown, DollarSign, Users, Clock,
  ArrowUpRight, Trophy, AlertCircle, CheckCircle2, Star,
  Wallet, ArrowRight, Activity, BarChart3, Plane
} from "lucide-react"

// ─── Helpers ─────────────────────────────────────────────────
const MEDAL_COLORS = ["#f59e0b", "#94a3b8", "#b45309"]
const MONTHS_AZ = ["Yan","Fev","Mar","Apr","May","İyn","İyl","Avq","Sen","Okt","Noy","Dek"]

function timeGreeting() {
  const h = new Date().getHours()
  return h < 12 ? "Sabahınız xeyir" : h < 18 ? "Günortanız xeyir" : "Axşamınız xeyir"
}

function today() { return new Date().toLocaleDateString("az-AZ", { weekday:"long", day:"numeric", month:"long", year:"numeric" }) }

// ─── Sub-components ───────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color, accent }: any) {
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: color + "18" }}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-black tabular-nums leading-none mb-1" style={{ color: "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  )
}

function HeroCard({ label, value, sub, gradient }: any) {
  return (
    <div className="kpi-card text-white relative overflow-hidden" style={{ background: gradient, border: "none" }}>
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
      <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-wider mb-3 opacity-70">{label}</p>
        <p className="text-3xl font-black tabular-nums leading-none mb-1">{value}</p>
        {sub && <p className="text-xs opacity-60">{sub}</p>}
      </div>
    </div>
  )
}

function StatBadge({ label, value, color }: any) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: color }} />
      <div>
        <p className="text-xl font-black tabular-nums leading-none" style={{ color: "var(--text-primary)" }}>{value}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
    </div>
  )
}

function SectionTitle({ icon: Icon, title, href, color = "var(--accent)" }: any) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon size={15} style={{ color }} />
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{title}</h3>
      </div>
      {href && (
        <a href={href} className="flex items-center gap-1 text-xs font-medium"
          style={{ color: "var(--text-muted)" }}>
          Hamısı <ArrowRight size={11} />
        </a>
      )}
    </div>
  )
}

function RankItem({ name, value, sub, index }: any) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg transition-colors"
      style={{ cursor: "default" }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
      <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-black flex-shrink-0"
        style={{
          background: index < 3 ? MEDAL_COLORS[index] + "20" : "var(--bg-hover)",
          color: index < 3 ? MEDAL_COLORS[index] : "var(--text-muted)",
          fontSize: "11px"
        }}>
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{name}</p>
        {sub && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{sub}</p>}
      </div>
      <p className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  )
}

function CashItem({ t }: any) {
  const isAdd = t.operation === "add"
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg transition-colors"
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
        style={{ background: isAdd ? "var(--success-bg)" : "var(--danger-bg)", color: isAdd ? "var(--success)" : "var(--danger)" }}>
        {isAdd ? "↑" : "↓"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{t.reason || "—"}</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {MONTHS_AZ[new Date(t.created_at).getMonth()]} {new Date(t.created_at).getDate()} · {t.currency}
        </p>
      </div>
      <p className="text-sm font-bold tabular-nums flex-shrink-0"
        style={{ color: isAdd ? "var(--success)" : "var(--danger)" }}>
        {isAdd ? "+" : "−"}{t.amount}
      </p>
    </div>
  )
}

function DebtItem({ b, i }: any) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg transition-colors"
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
      <span className="text-xs font-bold w-5 text-center flex-shrink-0" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{b.clientName}</p>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{b.destination}</p>
      </div>
      <span className="badge badge-red">{formatCurrency(b.remaining)}</span>
    </div>
  )
}

function PayBadge({ status }: any) {
  const cfg: any = {
    paid:    { label: "Ödənilib",    cls: "badge-green" },
    partial: { label: "Qismən",      cls: "badge-amber" },
    unpaid:  { label: "Ödənilməyib", cls: "badge-red" },
  }
  const c = cfg[status] ?? cfg.unpaid
  return <span className={`badge ${c.cls}`}>{c.label}</span>
}

function StatusBadge({ status }: any) {
  const cfg: any = {
    confirmed:  { label: "Təsdiqlənib", cls: "badge-green" },
    pending:    { label: "Gözləyir",    cls: "badge-amber" },
    completed:  { label: "Tamamlandı",  cls: "badge-blue" },
    cancelled:  { label: "Ləğv edildi", cls: "badge-red" },
  }
  const c = cfg[status] ?? cfg.pending
  return <span className={`badge ${c.cls}`}>{c.label}</span>
}

// ─── Flight alert overlay ─────────────────────────────────────
function FlightAlert({ flights, onClose }: any) {
  useEffect(() => { const t = setTimeout(onClose, 7000); return () => clearTimeout(t) }, [])
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-xl)" }}>
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--warning-bg)" }}>
            <Plane size={15} style={{ color: "var(--warning)" }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Sabah {flights.length} uçuş</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {tomorrow.toLocaleDateString("az-AZ", { day: "numeric", month: "long" })}
            </p>
          </div>
        </div>
        <div className="p-4 space-y-2">
          {flights.slice(0, 4).map((b: any) => (
            <div key={b.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{b.clientName}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{b.destination}</p>
              </div>
              <PayBadge status={b.paymentStatus} />
            </div>
          ))}
          {flights.length > 4 && <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>+{flights.length - 4} daha</p>}
        </div>
        <div className="px-4 pb-4 flex gap-2">
          <a href="/bookings" className="flex-1 py-2 rounded-xl text-sm font-semibold text-center"
            style={{ background: "var(--accent)", color: "white" }}>
            Sifarişlərə bax
          </a>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm"
            style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
            Bağla
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Flight widget (compact bar) ──────────────────────────────
function FlightBar({ bookings, profile }: any) {
  const [showAlert, setShowAlert] = useState(false)
  const tomorrowStr = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0] })()
  const todayStr    = new Date().toISOString().split("T")[0]
  const in5dStr     = (() => { const d = new Date(); d.setDate(d.getDate() + 5); return d.toISOString().split("T")[0] })()
  const isManager   = ["menecer","bilet_menecer"].includes(profile?.role)
  const filter      = (b: any) => b.status !== "cancelled" && (!isManager || b.manager === profile?.fullName)
  const tomorrow    = bookings.filter((b: any) => b.departureDate === tomorrowStr && filter(b))
  const today       = bookings.filter((b: any) => b.departureDate === todayStr && filter(b))
  const in5d        = bookings.filter((b: any) => b.departureDate === in5dStr && filter(b))

  useEffect(() => {
    if (tomorrow.length > 0) {
      const key = `fa_${tomorrowStr}`
      if (!sessionStorage.getItem(key)) { setTimeout(() => setShowAlert(true), 800); sessionStorage.setItem(key, "1") }
    }
  }, [tomorrow.length])

  if (!tomorrow.length && !today.length && !in5d.length) return null

  return (
    <>
      {showAlert && <FlightAlert flights={tomorrow} onClose={() => setShowAlert(false)} />}
      <div className="mb-5 flex flex-wrap gap-2 p-3.5 rounded-xl items-center"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <Plane size={13} style={{ color: "var(--text-muted)" }} />
        <span className="text-xs font-semibold mr-1" style={{ color: "var(--text-secondary)" }}>Uçuşlar:</span>
        {today.length > 0 && (
          <span className="badge badge-red">Bu gün · {today.length}</span>
        )}
        {tomorrow.length > 0 && (
          <button onClick={() => setShowAlert(true)} className="badge badge-amber" style={{ cursor: "pointer" }}>
            Sabah · {tomorrow.length}
          </button>
        )}
        {in5d.length > 0 && (
          <span className="badge badge-gray">5 gün · {in5d.length}</span>
        )}
      </div>
    </>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="p-5 md:p-6 space-y-5" style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <div className="space-y-2">
        <div className="skeleton h-7 w-48" />
        <div className="skeleton h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1,2].map(i => <div key={i} className="skeleton h-64 rounded-xl" />)}
      </div>
    </div>
  )
}

// ─── Manager Dashboard ─────────────────────────────────────────
function ManagerDashboard({ bookings, profile }: any) {
  const my  = bookings.filter((b: any) => b.manager === profile?.fullName)
  const rev = my.reduce((s: number, b: any) => s + b.sellPrice, 0)
  const gross = my.reduce((s: number, b: any) => s + b.profit + b.commissionAmount, 0)
  const bonus = gross * 0.10
  const profit = my.reduce((s: number, b: any) => s + b.profit, 0)
  const pending = my.filter((b: any) => b.status === "pending").length
  const unpaid  = my.filter((b: any) => b.paymentStatus !== "paid").length

  const topClients = useMemo(() => {
    const m: any = {}
    my.forEach((b: any) => {
      if (!m[b.clientName]) m[b.clientName] = { revenue: 0, count: 0 }
      m[b.clientName].revenue += b.sellPrice
      m[b.clientName].count++
    })
    return Object.entries(m).map(([name, s]: any) => ({ name, ...s })).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5)
  }, [my])

  const topDebts = useMemo(() =>
    my.filter((b: any) => b.paymentStatus !== "paid" && b.sellPrice - (b.paidAmount ?? 0) > 0)
      .map((b: any) => ({ ...b, remaining: b.sellPrice - (b.paidAmount ?? 0) }))
      .sort((a: any, b: any) => b.remaining - a.remaining).slice(0, 5),
    [my])

  return (
    <div className="p-5 md:p-6" style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
          {timeGreeting()}, {profile?.fullName?.split(" ")[0]}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{today()}</p>
      </div>

      <FlightBar bookings={bookings} profile={profile} />

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <HeroCard label="Sifarişlərim" value={my.length} sub={`${my.filter((b:any)=>b.status==="confirmed").length} təsdiqlənib`} gradient="linear-gradient(135deg,#2563eb,#3b82f6)" />
        <KpiCard label="Satış həcmim" value={formatCurrency(rev)} icon={TrendingUp} color="#16a34a" />
        <KpiCard label="Bonusum" value={formatCurrency(bonus)} icon={DollarSign} color="#d97706" />
        <KpiCard label="Mənfəətim" value={formatCurrency(profit)} icon={ArrowUpRight} color="#7c3aed" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatBadge label="Gözləyir" value={pending} color="var(--warning)" />
        <StatBadge label="Ödənilməyib" value={unpaid} color="var(--danger)" />
        <StatBadge label="Cəmi sifariş" value={my.length} color="var(--accent)" />
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <div className="card p-4">
          <SectionTitle icon={Users} title="Mənim Müştərilərim" color="var(--accent)" />
          {topClients.length === 0
            ? <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>Müştəri yoxdur</p>
            : topClients.map((c: any, i: number) => <RankItem key={c.name} name={c.name} value={formatCurrency(c.revenue)} sub={`${c.count} sifariş`} index={i} />)}
        </div>
        <div className="card p-4">
          <SectionTitle icon={AlertCircle} title="Mənim Borclarım" href="/debts" color="var(--danger)" />
          {topDebts.length === 0
            ? <div className="flex flex-col items-center py-6 gap-2">
                <CheckCircle2 size={24} style={{ color: "var(--success)" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Borc yoxdur</p>
              </div>
            : topDebts.map((b: any, i: number) => <DebtItem key={b.id} b={b} i={i} />)}
        </div>
      </div>

      {/* Recent */}
      <div className="card mb-4">
        <div className="px-4 pt-4 pb-2">
          <SectionTitle icon={Activity} title="Son Sifarişlərim" href="/bookings" color="var(--danger)" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              {["Müştəri","İstiqamət","Tarix","Ödəniş","Status"].map(h => <th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {my.slice(0, 8).map((b: any) => (
                <tr key={b.id}>
                  <td>
                    <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{b.clientName}</p>
                    {b.clientPhone && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{b.clientPhone}</p>}
                  </td>
                  <td style={{ color: "var(--text-secondary)", maxWidth: 160 }} className="truncate">{b.destination}</td>
                  <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{b.departureDate}</td>
                  <td><PayBadge status={b.paymentStatus} /></td>
                  <td><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Footer />
    </div>
  )
}

// ─── Admin Dashboard ───────────────────────────────────────────
function AdminDashboard({ bookings, cashHistory, profile }: any) {
  const [period, setPeriod] = useState<"week"|"month"|"year">("month")
  const now = new Date()

  const totalRevenue = bookings.reduce((s: number, b: any) => s + b.sellPrice, 0)
  const totalCost    = bookings.reduce((s: number, b: any) => s + b.buyPrice, 0)
  const totalProfit  = bookings.reduce((s: number, b: any) => s + b.profit, 0)
  const totalComm    = bookings.reduce((s: number, b: any) => s + b.commissionAmount, 0)
  const margin       = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0
  const pending      = bookings.filter((b: any) => b.status === "pending").length
  const unpaid       = bookings.filter((b: any) => b.paymentStatus !== "paid").length

  const periodBkgs = useMemo(() => bookings.filter((b: any) => {
    const d = new Date(b.createdAt)
    if (period === "week") { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w }
    if (period === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    return d.getFullYear() === now.getFullYear()
  }), [bookings, period])

  const topManagers = useMemo(() => {
    const m: any = {}
    periodBkgs.forEach((b: any) => {
      if (!b.manager) return
      if (!m[b.manager]) m[b.manager] = { revenue: 0, profit: 0, count: 0 }
      m[b.manager].revenue += b.sellPrice
      m[b.manager].profit  += b.profit
      m[b.manager].count++
    })
    return Object.entries(m).map(([name, s]: any) => ({ name, ...s })).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5)
  }, [periodBkgs])

  const topClients = useMemo(() => {
    const m: any = {}
    bookings.forEach((b: any) => {
      if (!m[b.clientName]) m[b.clientName] = { revenue: 0, count: 0 }
      m[b.clientName].revenue += b.sellPrice
      m[b.clientName].count++
    })
    return Object.entries(m).map(([name, s]: any) => ({ name, ...s })).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5)
  }, [bookings])

  const topDebts = useMemo(() =>
    bookings.filter((b: any) => b.paymentStatus !== "paid" && b.sellPrice - (b.paidAmount ?? 0) > 0)
      .map((b: any) => ({ ...b, remaining: b.sellPrice - (b.paidAmount ?? 0) }))
      .sort((a: any, b: any) => b.remaining - a.remaining).slice(0, 5),
    [bookings])

  return (
    <div className="p-5 md:p-6" style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{today()}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)" }} />
          <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{bookings.length} sifariş</span>
        </div>
      </div>

      <FlightBar bookings={bookings} profile={profile} />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <HeroCard label="Ümumi gəlir" value={formatCurrency(totalRevenue)} sub={`Marja: ${margin}%`} gradient="linear-gradient(135deg,#16a34a,#22c55e)" />
        <KpiCard label="Alış xərci"  value={formatCurrency(totalCost)}    sub="Bilet və tur" icon={TrendingDown} color="var(--danger)" />
        <KpiCard label="Mənfəət"     value={formatCurrency(totalProfit)}  sub={`${margin}% marja`} icon={TrendingUp} color="var(--success)" />
        <KpiCard label="Komissiya"   value={formatCurrency(totalComm)}    sub="Cəmi" icon={DollarSign} color="var(--accent)" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatBadge label="Cəmi sifarişlər" value={bookings.length} color="var(--accent)" />
        <StatBadge label="Gözləyir"        value={pending}          color="var(--warning)" />
        <StatBadge label="Ödənilməyib"     value={unpaid}           color="var(--danger)" />
      </div>

      {/* Managers + Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Managers */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy size={15} style={{ color: "var(--warning)" }} />
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Top Menecerlər</h3>
            </div>
            <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: "var(--bg-hover)" }}>
              {(["week","month","year"] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
                  style={{
                    background: period === p ? "var(--bg-card)" : "transparent",
                    color: period === p ? "var(--text-primary)" : "var(--text-muted)",
                    boxShadow: period === p ? "var(--shadow-xs)" : "none"
                  }}>
                  {p === "week" ? "Həftə" : p === "month" ? "Ay" : "İl"}
                </button>
              ))}
            </div>
          </div>
          {topManagers.length === 0
            ? <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>Bu dövrdə sifariş yoxdur</p>
            : topManagers.map((m: any, i: number) => <RankItem key={m.name} name={m.name} value={formatCurrency(m.revenue)} sub={`${m.count} sifariş`} index={i} />)}
        </div>

        {/* Clients */}
        <div className="card p-4">
          <SectionTitle icon={Star} title="Top Müştərilər" color="var(--accent)" />
          {topClients.map((c: any, i: number) => <RankItem key={c.name} name={c.name} value={formatCurrency(c.revenue)} sub={`${c.count} sifariş`} index={i} />)}
        </div>
      </div>

      {/* Cash + Debts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card p-4">
          <SectionTitle icon={Wallet} title="Kassa Hərəkəti" href="/finances" color="var(--success)" />
          {cashHistory.length === 0
            ? <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>Əməliyyat yoxdur</p>
            : cashHistory.map((t: any) => <CashItem key={t.id} t={t} />)}
        </div>
        <div className="card p-4">
          <SectionTitle icon={AlertCircle} title="Ən Böyük Borclar" href="/debts" color="var(--danger)" />
          {topDebts.length === 0
            ? <div className="flex flex-col items-center py-6 gap-2">
                <CheckCircle2 size={24} style={{ color: "var(--success)" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Borc yoxdur</p>
              </div>
            : topDebts.map((b: any, i: number) => <DebtItem key={b.id} b={b} i={i} />)}
        </div>
      </div>

      {/* Recent bookings */}
      <div className="card mb-4">
        <div className="px-4 pt-4 pb-2">
          <SectionTitle icon={Activity} title="Son Sifarişlər" href="/bookings" color="var(--danger)" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              {["Müştəri","İstiqamət","Menecer","Tarix","Satış","Ödəniş","Status"].map(h => <th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {[...bookings].slice(0, 8).map((b: any) => (
                <tr key={b.id}>
                  <td>
                    <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{b.clientName}</p>
                    {b.clientPhone && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{b.clientPhone}</p>}
                  </td>
                  <td style={{ color: "var(--text-secondary)", maxWidth: 140 }} className="truncate">{b.destination}</td>
                  <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{b.manager?.split(" ")[0]}</td>
                  <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{b.departureDate}</td>
                  <td className="font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{formatCurrency(b.sellPrice)}</td>
                  <td><PayBadge status={b.paymentStatus} /></td>
                  <td><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Footer />
    </div>
  )
}

function Footer() {
  return (
    <div className="text-center py-4">
      <a href="https://varktechnologies.netlify.app/" target="_blank" rel="noopener noreferrer"
        className="text-xs" style={{ color: "var(--text-muted)" }}>
        Powered by <span style={{ color: "var(--accent)", fontWeight: 700 }}>VARK TECHNOLOGIES</span>
      </a>
    </div>
  )
}

// ─── Root ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const { bookings, fetchBookings } = useBookingsStore()
  const { fetchPayments } = usePaymentsStore()
  const { profile } = useUserRole()
  const [cashHistory, setCashHistory] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetchBookings()
    fetchPayments()
    supabase.from("cash_transactions").select("*").order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => { setCashHistory(data ?? []); setLoaded(true) })
  }, [])

  if (!profile || !loaded) return <PageSkeleton />
  if (["menecer","bilet_menecer"].includes(profile.role)) {
    return <ManagerDashboard bookings={bookings} profile={profile} />
  }
  return <AdminDashboard bookings={bookings} cashHistory={cashHistory} profile={profile} />
}
