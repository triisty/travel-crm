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
  Sparkles, Wallet, ArrowRight, Activity, Zap
} from "lucide-react"

// ─── Global styles ───────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
  @keyframes slideUp { from { transform:translateY(32px);opacity:0 } to { transform:translateY(0);opacity:1 } }
  @keyframes slideRight { from { transform:translateX(-24px);opacity:0 } to { transform:translateX(0);opacity:1 } }
  @keyframes planeFly { 0%{transform:translateX(-120px) translateY(20px) rotate(-5deg);opacity:0} 20%{opacity:1} 100%{transform:translateX(calc(100vw + 120px)) translateY(-30px) rotate(6deg);opacity:0} }
  @keyframes pulse-ring { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 50%{box-shadow:0 0 0 20px rgba(239,68,68,0)} }
  @keyframes countDown { from{width:100%} to{width:0%} }
  @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
  @keyframes glow { 0%,100%{opacity:0.5} 50%{opacity:1} }
  @keyframes numberUp { from{transform:translateY(8px);opacity:0} to{transform:translateY(0);opacity:1} }
  .dash-card { transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease; }
  .dash-card:hover { transform: translateY(-2px) scale(1.005); }
`

const card = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  backdropFilter: "blur(24px)",
  borderRadius: "28px",
}

const MEDAL_GRADIENTS = [
  "linear-gradient(135deg, #f59e0b, #fbbf24)",
  "linear-gradient(135deg, #94a3b8, #cbd5e1)",
  "linear-gradient(135deg, #b45309, #d97706)",
]
const CLIENT_GRADIENTS = [
  "linear-gradient(135deg, #3b82f6, #06b6d4)",
  "linear-gradient(135deg, #8b5cf6, #6366f1)",
  "linear-gradient(135deg, #10b981, #34d399)",
  "linear-gradient(135deg, #f59e0b, #fbbf24)",
  "linear-gradient(135deg, #ec4899, #f43f5e)",
]

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton({ style = {} }: { style?: any }) {
  return <div className="animate-pulse rounded-3xl" style={{ background: "var(--bg-glass)", ...style }} />
}
function DashboardSkeleton() {
  return (
    <div className="min-h-screen p-5 md:p-7" style={{ background: "var(--bg-primary)" }}>
      <div className="mb-8 space-y-2"><Skeleton style={{ height:32, width:240 }} /><Skeleton style={{ height:16, width:180 }} /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">{[1,2,3,4].map(i=><Skeleton key={i} style={{height:120}}/>)}</div>
      <div className="grid grid-cols-3 gap-4 mb-5">{[1,2,3].map(i=><Skeleton key={i} style={{height:96}}/>)}</div>
      <div className="grid grid-cols-2 gap-5 mb-5">{[1,2].map(i=><Skeleton key={i} style={{height:300}}/>)}</div>
      <Skeleton style={{height:340}}/>
    </div>
  )
}

// ─── Reusable ────────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, href, hrefLabel="Hamısı →", iconColor="#6366f1", iconBg="rgba(99,102,241,0.12)" }: any) {
  return (
    <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-2xl flex items-center justify-center" style={{ background: iconBg }}>
          <Icon size={15} style={{ color: iconColor }} />
        </div>
        <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      </div>
      {href && (
        <a href={href} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:scale-[1.04] active:scale-95"
          style={{ background: "var(--bg-glass)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
          {hrefLabel} <ArrowRight size={11} />
        </a>
      )}
    </div>
  )
}

function RankRow({ item, index, gradients, valueKey="revenue", subKey="count", subSuffix=" sifariş", formatVal=true }: any) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all cursor-default"
      style={{ background: "transparent" }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-glass)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
      <div className="w-8 h-8 rounded-2xl flex items-center justify-center text-xs font-black flex-shrink-0"
        style={{ background: index < 3 ? gradients[index] : "var(--bg-glass)", color: index < 3 ? "white" : "var(--text-secondary)", boxShadow: index < 3 ? "0 4px 12px rgba(0,0,0,0.15)" : "none" }}>
        {index < 3 ? ["🥇","🥈","🥉"][index] : index+1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{item.name}</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{item[subKey]}{subSuffix}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {formatVal ? formatCurrency(item[valueKey]) : item[valueKey]}
        </p>
        {item.profit !== undefined && (
          <p className="text-xs tabular-nums text-green-500">{formatCurrency(item.profit)}</p>
        )}
      </div>
    </div>
  )
}

function CashRow({ t }: { t: any }) {
  const isAdd = t.operation === "add"
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all"
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-glass)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
      <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 text-base font-bold"
        style={{ background: isAdd ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: isAdd ? "#22c55e" : "#ef4444" }}>
        {isAdd ? "↑" : "↓"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{t.reason || "—"}</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {new Date(t.created_at).toLocaleDateString("az-AZ", { day:"numeric", month:"short" })} · {t.currency}
        </p>
      </div>
      <p className={`text-sm font-bold tabular-nums flex-shrink-0 ${isAdd ? "text-green-500" : "text-red-500"}`}>
        {isAdd ? "+" : "−"}{t.amount} {t.currency}
      </p>
    </div>
  )
}

function DebtRow({ b, i }: { b: any; i: number }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all"
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-glass)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
      <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
        style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>{i+1}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{b.clientName}</p>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{b.destination}</p>
      </div>
      <p className="text-sm font-bold tabular-nums text-red-500 flex-shrink-0">{formatCurrency(b.remaining)}</p>
    </div>
  )
}

// ─── Flight Alert ─────────────────────────────────────────────────────────────
function FlightAlertOverlay({ flights, onClose }: { flights: any[]; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [])
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  const dateStr = tomorrow.toLocaleDateString("az-AZ", { day: "numeric", month: "long" })
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-sm mx-4 rounded-3xl overflow-hidden"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Xatırlatma</p>
          <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
            Sabah — {dateStr} — {flights.length} uçuş
          </p>
        </div>
        <div className="p-4 space-y-2">
          {flights.slice(0, 4).map((b: any) => (
            <div key={b.id} className="flex items-center justify-between px-3 py-2.5 rounded-2xl"
              style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)" }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{b.clientName}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{b.destination} · {b.manager?.split(" ")[0]}</p>
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-lg"
                style={{ background: b.paymentStatus === "paid" ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)", color: b.paymentStatus === "paid" ? "#22c55e" : "#f59e0b" }}>
                {b.paymentStatus === "paid" ? "Ödənilib" : "Ödənilməyib"}
              </span>
            </div>
          ))}
          {flights.length > 4 && <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>+{flights.length - 4} daha</p>}
        </div>
        <div className="px-4 pb-4 flex gap-2">
          <a href="/bookings" className="flex-1 py-2.5 rounded-2xl text-sm font-semibold text-center transition-all"
            style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
            Sifarişlərə bax
          </a>
          <button onClick={onClose} className="px-4 py-2.5 rounded-2xl text-sm"
            style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
            Bağla
          </button>
        </div>
      </div>
    </div>
  )
}

function FlightWidget({ bookings, profile }: { bookings: any[]; profile: any }) {
  const [showAlert, setShowAlert] = useState(false)
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split("T")[0]
  const in5days = new Date(); in5days.setDate(in5days.getDate() + 5)
  const in5daysStr = in5days.toISOString().split("T")[0]
  const todayStr = new Date().toISOString().split("T")[0]
  const filter = (b: any) => b.status !== "cancelled" && (["menecer","bilet_menecer"].includes(profile?.role) ? b.manager === profile?.fullName : true)
  const flightsTomorrow = bookings.filter(b => b.departureDate === tomorrowStr && filter(b))
  const flightsIn5Days = bookings.filter(b => b.departureDate === in5daysStr && filter(b))
  const flightsToday = bookings.filter(b => b.departureDate === todayStr && filter(b))
  useEffect(() => {
    if (flightsTomorrow.length > 0) {
      const key = `alert_${tomorrowStr}`
      if (!sessionStorage.getItem(key)) { setTimeout(() => setShowAlert(true), 1000); sessionStorage.setItem(key, "1") }
    }
  }, [flightsTomorrow.length])
  if (!flightsTomorrow.length && !flightsIn5Days.length && !flightsToday.length) return null
  return (
    <>
      {showAlert && <FlightAlertOverlay flights={flightsTomorrow} onClose={() => setShowAlert(false)} />}
      <div className="mb-5 rounded-3xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Uçuş xatırlatmaları</p>
          {flightsTomorrow.length > 0 && (
            <button onClick={() => setShowAlert(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
              {flightsTomorrow.length} sabah
            </button>
          )}
        </div>
        <div className="p-4 flex flex-wrap gap-2">
          {flightsToday.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl text-xs"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444" }}>
              <span className="font-bold">Bu gün</span>
              <span className="font-semibold">{flightsToday.length} müştəri</span>
              <span style={{ color: "rgba(239,68,68,0.6)" }}>·</span>
              <span>{flightsToday.slice(0,2).map((b:any)=>b.clientName).join(", ")}{flightsToday.length > 2 ? ` +${flightsToday.length-2}` : ""}</span>
            </div>
          )}
          {flightsTomorrow.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl text-xs"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)", color: "#f59e0b" }}>
              <span className="font-bold">Sabah</span>
              <span className="font-semibold">{flightsTomorrow.length} müştəri</span>
              <span style={{ color: "rgba(245,158,11,0.6)" }}>·</span>
              <span>{flightsTomorrow.slice(0,2).map((b:any)=>b.clientName).join(", ")}{flightsTomorrow.length > 2 ? ` +${flightsTomorrow.length-2}` : ""}</span>
            </div>
          )}
          {flightsIn5Days.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl text-xs"
              style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
              <span className="font-bold">5 gün sonra</span>
              <span className="font-semibold">{flightsIn5Days.length} müştəri</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Manager Dashboard ────────────────────────────────────────────────────────
function ManagerDashboard({ bookings, profile }: { bookings: any[]; profile: any }) {
  const myBookings = bookings.filter(b => b.manager === profile?.fullName)
  const myRevenue = myBookings.reduce((s,b) => s+b.sellPrice, 0)
  const myProfit = myBookings.reduce((s,b) => s+b.profit, 0)
  const myGrossProfit = myBookings.reduce((s,b) => s+b.profit+b.commissionAmount, 0)
  const myCommission = myGrossProfit * 0.10
  const myPending = myBookings.filter(b => b.status==="pending").length
  const myUnpaid = myBookings.filter(b => b.paymentStatus!=="paid").length
  const myConfirmed = myBookings.filter(b => b.status==="confirmed").length
  const recent = [...myBookings].slice(0, 8)
  const topClients = useMemo(() => {
    const stats = myBookings.reduce((acc:any,b) => { if(!acc[b.clientName]) acc[b.clientName]={revenue:0,count:0}; acc[b.clientName].revenue+=b.sellPrice; acc[b.clientName].count++; return acc }, {})
    return Object.entries(stats).map(([name,s]:any)=>({name,...s})).sort((a:any,b:any)=>b.revenue-a.revenue).slice(0,5)
  }, [myBookings])
  const myDebts = useMemo(() =>
    myBookings.filter(b=>b.paymentStatus!=="paid"&&b.sellPrice-(b.paidAmount??0)>0)
      .map(b=>({...b,remaining:b.sellPrice-(b.paidAmount??0)}))
      .sort((a:any,b:any)=>b.remaining-a.remaining).slice(0,5), [myBookings])
  const firstName = profile?.fullName?.split(" ")[0]
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour<12?"Sabahınız xeyir":hour<18?"Günortanız xeyir":"Axşamınız xeyir"

  return (
    <div className="min-h-screen p-5 md:p-7" style={{ background:"var(--bg-primary)" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Header */}
      <div className="mb-7" style={{ animation:"slideRight 0.4s ease" }}>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-2xl flex items-center justify-center" style={{ background:"linear-gradient(135deg,#f59e0b,#fbbf24)" }}>
            <Sparkles size={15} color="white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color:"var(--text-primary)" }}>{greeting}, {firstName}! 👋</h1>
        </div>
        <p className="text-sm ml-10" style={{ color:"var(--text-secondary)" }}>
          {now.toLocaleDateString("ru-RU", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
        </p>
      </div>

      <FlightWidget bookings={bookings} profile={profile} />

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div className="col-span-2 lg:col-span-1 p-6 text-white relative overflow-hidden rounded-3xl dash-card"
          style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow:"0 12px 40px rgba(99,102,241,0.35)", animation:"slideUp 0.4s ease" }}>
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10" style={{ background:"white" }} />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full opacity-10" style={{ background:"white" }} />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold opacity-70 uppercase tracking-widest">Sifarişlərim</p>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:"rgba(255,255,255,0.2)" }}><Star size={14}/></div>
            </div>
            <p className="text-5xl font-black mb-2 tabular-nums" style={{ animation:"numberUp 0.5s ease" }}>{myBookings.length}</p>
            <div className="flex items-center gap-1.5"><CheckCircle2 size={12} className="opacity-70"/><p className="text-xs opacity-70">{myConfirmed} təsdiqlənib</p></div>
          </div>
        </div>
        {[
          { label:"Satış həcmim", value:formatCurrency(myRevenue), Icon:TrendingUp, color:"#22c55e", bg:"rgba(34,197,94,0.12)", delay:"0.1s" },
          { label:"Komissiyam", value:formatCurrency(myCommission), Icon:DollarSign, color:"#f59e0b", bg:"rgba(245,158,11,0.12)", delay:"0.2s" },
          { label:"Mənfəət", value:formatCurrency(myProfit), Icon:ArrowUpRight, color:"#6366f1", bg:"rgba(99,102,241,0.12)", delay:"0.3s" },
        ].map(({ label, value, Icon, color, bg, delay }) => (
          <div key={label} className="p-5 rounded-3xl dash-card" style={{ ...card, animation:`slideUp 0.4s ease ${delay}` }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color:"var(--text-muted)" }}>{label}</p>
              <div className="w-8 h-8 rounded-2xl flex items-center justify-center" style={{ background:bg }}>
                <Icon size={14} style={{ color }} />
              </div>
            </div>
            <p className="text-xl font-black tabular-nums" style={{ color:"var(--text-primary)" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label:"Gözləyir", value:myPending, Icon:Clock, color:"#f59e0b", bg:"rgba(245,158,11,0.12)", glow:"rgba(245,158,11,0.2)" },
          { label:"Təsdiqlənib", value:myConfirmed, Icon:CheckCircle2, color:"#22c55e", bg:"rgba(34,197,94,0.12)", glow:"rgba(34,197,94,0.2)" },
          { label:"Ödənilməyib", value:myUnpaid, Icon:AlertCircle, color:"#ef4444", bg:"rgba(239,68,68,0.12)", glow:"rgba(239,68,68,0.2)" },
        ].map(({ label, value, Icon, color, bg, glow }) => (
          <div key={label} className="p-5 rounded-3xl flex items-center gap-4 dash-card" style={{ ...card }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background:bg, boxShadow:`0 4px 16px ${glow}` }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <p className="text-2xl font-black tabular-nums" style={{ color:"var(--text-primary)" }}>{value}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color:"var(--text-secondary)" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="rounded-3xl overflow-hidden dash-card" style={card}>
          <SectionHeader icon={Users} title="Mənim Müştərilərim" iconColor="#3b82f6" iconBg="rgba(59,130,246,0.12)" />
          <div className="p-4 space-y-1">
            {topClients.length===0
              ? <p className="text-sm text-center py-6" style={{ color:"var(--text-muted)" }}>Hələ müştəri yoxdur</p>
              : topClients.map((c:any,i:number)=><RankRow key={c.name} item={c} index={i} gradients={CLIENT_GRADIENTS}/>)}
          </div>
        </div>
        <div className="rounded-3xl overflow-hidden dash-card" style={card}>
          <SectionHeader icon={AlertCircle} title="Mənim Borclarım" href="/debts" iconColor="#ef4444" iconBg="rgba(239,68,68,0.12)" />
          <div className="p-4 space-y-1">
            {myDebts.length===0
              ? <div className="flex flex-col items-center py-6 gap-2"><CheckCircle2 size={28} className="text-green-500"/><p className="text-sm font-semibold" style={{ color:"var(--text-muted)" }}>Borc yoxdur 🎉</p></div>
              : myDebts.map((b:any,i:number)=><DebtRow key={b.id} b={b} i={i}/>)}
          </div>
        </div>
      </div>

      <div className="rounded-3xl overflow-hidden dash-card" style={card}>
        <SectionHeader icon={Activity} title="Son Sifarişlərim" href="/bookings" iconColor="#ef4444" iconBg="rgba(239,68,68,0.12)" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ borderBottom:"1px solid var(--border-color)" }}>
              {["Müştəri","İstiqamət","Tarix","Ödəniş","Status"].map(h=>(
                <th key={h} className="text-left text-xs font-bold uppercase tracking-wider px-6 py-4" style={{ color:"var(--text-muted)" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {recent.map((b:any)=>(
                <tr key={b.id} className="transition-all" style={{ borderBottom:"1px solid var(--border-color)" }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--bg-glass)"}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}>
                  <td className="px-6 py-3.5"><p className="font-semibold" style={{ color:"var(--text-primary)" }}>{b.clientName}</p><p className="text-xs" style={{ color:"var(--text-muted)" }}>{b.clientPhone}</p></td>
                  <td className="px-6 py-3.5 max-w-xs truncate" style={{ color:"var(--text-secondary)" }}>{b.destination}</td>
                  <td className="px-6 py-3.5 text-xs" style={{ color:"var(--text-secondary)" }}>{b.departureDate}</td>
                  <td className="px-6 py-3.5"><span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background:b.paymentStatus==="paid"?"rgba(34,197,94,0.12)":b.paymentStatus==="partial"?"rgba(249,115,22,0.12)":"rgba(239,68,68,0.12)", color:b.paymentStatus==="paid"?"#22c55e":b.paymentStatus==="partial"?"#f97316":"#ef4444" }}>{b.paymentStatus==="paid"?"Ödənilib":b.paymentStatus==="partial"?"Qismən":"Ödənilməyib"}</span></td>
                  <td className="px-6 py-3.5"><span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background:b.status==="confirmed"?"rgba(34,197,94,0.12)":b.status==="pending"?"rgba(245,158,11,0.12)":"rgba(99,102,241,0.12)", color:b.status==="confirmed"?"#22c55e":b.status==="pending"?"#f59e0b":"#6366f1" }}>{b.status==="confirmed"?"Təsdiqlənib":b.status==="pending"?"Gözləyir":"Tamamlandı"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center">
        <a href="https://varktechnologies.netlify.app/" target="_blank" rel="noopener noreferrer"
          className="text-xs font-medium transition-all hover:opacity-80"
          style={{ color:"var(--text-muted)" }}>
          Powered by <span style={{ color:"#6366f1", fontWeight:700 }}>VARK TECHNOLOGIES</span>
        </a>
      </div>
    </div>
  )
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard({ bookings, payments, cashHistory, profile }: { bookings: any[]; payments: any[]; cashHistory: any[]; profile?: any }) {
  const [managerPeriod, setManagerPeriod] = useState<"week"|"month"|"year">("month")
  const totalRevenue    = bookings.reduce((s,b)=>s+b.sellPrice,0)
  const totalCost       = bookings.reduce((s,b)=>s+b.buyPrice,0)
  const totalProfit     = bookings.reduce((s,b)=>s+b.profit,0)
  const totalCommission = bookings.reduce((s,b)=>s+b.commissionAmount,0)
  const pending         = bookings.filter(b=>b.status==="pending").length
  const unpaid          = bookings.filter(b=>b.paymentStatus!=="paid").length
  const margin          = totalRevenue>0?Math.round((totalProfit/totalRevenue)*100):0
  const recent          = [...bookings].slice(0,8)
  const now = new Date()

  const filteredByPeriod = useMemo(()=>bookings.filter(b=>{
    const d=new Date(b.departureDate)
    if(managerPeriod==="week"){const wa=new Date(now);wa.setDate(now.getDate()-7);return d>=wa}
    if(managerPeriod==="month") return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()
    return d.getFullYear()===now.getFullYear()
  }),[bookings,managerPeriod])

  const topManagers = useMemo(()=>{
    const stats=filteredByPeriod.reduce((acc:any,b)=>{if(!b.manager)return acc;if(!acc[b.manager])acc[b.manager]={revenue:0,profit:0,count:0};acc[b.manager].revenue+=b.sellPrice;acc[b.manager].profit+=b.profit;acc[b.manager].count++;return acc},{})
    return Object.entries(stats).map(([name,s]:any)=>({name,...s})).sort((a:any,b:any)=>b.revenue-a.revenue).slice(0,5)
  },[filteredByPeriod])

  const topClients = useMemo(()=>{
    const stats=bookings.reduce((acc:any,b)=>{if(!acc[b.clientName])acc[b.clientName]={revenue:0,count:0};acc[b.clientName].revenue+=b.sellPrice;acc[b.clientName].count++;return acc},{})
    return Object.entries(stats).map(([name,s]:any)=>({name,...s})).sort((a:any,b:any)=>b.revenue-a.revenue).slice(0,5)
  },[bookings])

  const topDebts = useMemo(()=>
    bookings.filter(b=>b.paymentStatus!=="paid"&&b.sellPrice-(b.paidAmount??0)>0)
      .map(b=>({...b,remaining:b.sellPrice-(b.paidAmount??0)}))
      .sort((a:any,b:any)=>b.remaining-a.remaining).slice(0,5),[bookings])

  return (
    <div className="min-h-screen p-5 md:p-7" style={{ background:"var(--bg-primary)" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-8" style={{ animation:"slideRight 0.4s ease" }}>
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color:"var(--text-primary)", letterSpacing:"-0.5px" }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color:"var(--text-secondary)" }}>
            {now.toLocaleDateString("ru-RU", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl" style={card}>
          <div className="w-2 h-2 rounded-full bg-green-500" style={{ animation:"glow 2s ease infinite" }} />
          <span className="text-xs font-bold" style={{ color:"var(--text-secondary)" }}>{bookings.length} sifariş</span>
          <Zap size={13} style={{ color:"#f59e0b" }} />
        </div>
      </div>

      <FlightWidget bookings={bookings} profile={profile} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {/* Hero */}
        <div className="col-span-2 lg:col-span-1 p-6 text-white relative overflow-hidden rounded-3xl dash-card"
          style={{ background:"linear-gradient(135deg,#11998e 0%,#38ef7d 100%)", boxShadow:"0 12px 40px rgba(17,153,142,0.35)", animation:"slideUp 0.3s ease" }}>
           <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-10" style={{ background:"white" }} />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full opacity-10" style={{ background:"white" }} />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold opacity-75 uppercase tracking-widest">Ümumi gəlir</p>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:"rgba(255,255,255,0.2)" }}><ArrowUpRight size={14}/></div>
            </div>
            <p className="text-2xl font-black mb-2 tabular-nums leading-tight">{formatCurrency(totalRevenue)}</p>
            <div className="flex items-center gap-1.5 mt-1 opacity-80">
              <TrendingUp size={11}/>
              <p className="text-xs font-semibold">Marja: {margin}%</p>
            </div>
          </div>
        </div>

        {[
          { label:"Alış xərci", value:formatCurrency(totalCost), sub:"Bilet və tur", Icon:TrendingDown, color:"#ef4444", bg:"rgba(239,68,68,0.12)", delay:"0.1s" },
          { label:"Mənfəət", value:formatCurrency(totalProfit), sub:`${margin}% marja`, Icon:TrendingUp, color:"#22c55e", bg:"rgba(34,197,94,0.12)", delay:"0.2s" },
          { label:"Komissiya", value:formatCurrency(totalCommission), sub:"Cəmi", Icon:DollarSign, color:"#6366f1", bg:"rgba(99,102,241,0.12)", delay:"0.3s" },
        ].map(({ label, value, sub, Icon, color, bg, delay }) => (
          <div key={label} className="p-5 rounded-3xl dash-card" style={{ ...card, animation:`slideUp 0.4s ease ${delay}` }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color:"var(--text-muted)" }}>{label}</p>
              <div className="w-8 h-8 rounded-2xl flex items-center justify-center" style={{ background:bg }}><Icon size={14} style={{ color }}/></div>
            </div>
            <p className="text-xl font-black tabular-nums" style={{ color:"var(--text-primary)" }}>{value}</p>
            <p className="text-xs mt-1" style={{ color:"var(--text-muted)" }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label:"Cəmi sifarişlər", value:bookings.length, Icon:Activity, color:"#6366f1", bg:"rgba(99,102,241,0.12)", glow:"rgba(99,102,241,0.2)" },
          { label:"Gözləyir", value:pending, Icon:Clock, color:"#f59e0b", bg:"rgba(245,158,11,0.12)", glow:"rgba(245,158,11,0.2)" },
          { label:"Ödənilməyib", value:unpaid, Icon:AlertCircle, color:"#ef4444", bg:"rgba(239,68,68,0.12)", glow:"rgba(239,68,68,0.2)" },
        ].map(({ label, value, Icon, color, bg, glow }) => (
          <div key={label} className="p-5 rounded-3xl flex items-center gap-4 dash-card" style={{ ...card }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background:bg, boxShadow:`0 4px 16px ${glow}` }}>
              <Icon size={20} style={{ color }}/>
            </div>
            <div>
              <p className="text-2xl font-black tabular-nums" style={{ color:"var(--text-primary)" }}>{value}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color:"var(--text-secondary)" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Top managers + clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="rounded-3xl overflow-hidden dash-card" style={card}>
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom:"1px solid var(--border-color)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-2xl flex items-center justify-center" style={{ background:"rgba(245,158,11,0.12)" }}><Trophy size={15} style={{ color:"#f59e0b" }}/></div>
              <h2 className="text-sm font-bold" style={{ color:"var(--text-primary)" }}>Top Menecerlər</h2>
            </div>
            <div className="flex gap-1 p-1 rounded-2xl" style={{ background:"var(--bg-glass)" }}>
              {(["week","month","year"] as const).map(p=>(
                <button key={p} onClick={()=>setManagerPeriod(p)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={{ background:managerPeriod===p?"linear-gradient(135deg,#f59e0b,#fbbf24)":"transparent", color:managerPeriod===p?"white":"var(--text-secondary)", boxShadow:managerPeriod===p?"0 2px 8px rgba(245,158,11,0.4)":"none" }}>
                  {p==="week"?"Həftə":p==="month"?"Ay":"İl"}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 space-y-1">
            {topManagers.length===0
              ? <p className="text-sm text-center py-6" style={{ color:"var(--text-muted)" }}>Bu dövrdə sifariş yoxdur</p>
              : topManagers.map((m:any,i:number)=><RankRow key={m.name} item={m} index={i} gradients={MEDAL_GRADIENTS}/>)}
          </div>
        </div>

        <div className="rounded-3xl overflow-hidden dash-card" style={card}>
          <SectionHeader icon={Star} title="Top Müştərilər" iconColor="#3b82f6" iconBg="rgba(59,130,246,0.12)" />
          <div className="p-4 space-y-1">
            {topClients.map((c:any,i:number)=><RankRow key={c.name} item={c} index={i} gradients={CLIENT_GRADIENTS}/>)}
          </div>
        </div>
      </div>

      {/* Cash + Debts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="rounded-3xl overflow-hidden dash-card" style={card}>
          <SectionHeader icon={Wallet} title="Kassa Hərəkəti" href="/finances" iconColor="#22c55e" iconBg="rgba(34,197,94,0.12)" />
          <div className="p-4 space-y-1">
            {cashHistory.length===0
              ? <p className="text-sm text-center py-6" style={{ color:"var(--text-muted)" }}>Əməliyyat yoxdur</p>
              : cashHistory.map((t:any)=><CashRow key={t.id} t={t}/>)}
          </div>
        </div>
        <div className="rounded-3xl overflow-hidden dash-card" style={card}>
          <SectionHeader icon={AlertCircle} title="Ən Böyük Borclar" href="/debts" iconColor="#ef4444" iconBg="rgba(239,68,68,0.12)" />
          <div className="p-4 space-y-1">
            {topDebts.length===0
              ? <div className="flex flex-col items-center py-6 gap-2"><CheckCircle2 size={28} className="text-green-500"/><p className="text-sm font-semibold" style={{ color:"var(--text-muted)" }}>Borc yoxdur 🎉</p></div>
              : topDebts.map((b:any,i:number)=><DebtRow key={b.id} b={b} i={i}/>)}
          </div>
        </div>
      </div>

      {/* Recent bookings */}
      <div className="rounded-3xl overflow-hidden dash-card mb-6" style={card}>
        <SectionHeader icon={Activity} title="Son Sifarişlər" href="/bookings" iconColor="#ef4444" iconBg="rgba(239,68,68,0.12)" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ borderBottom:"1px solid var(--border-color)" }}>
              {["Müştəri","İstiqamət","Menecer","Tarix","Satış","Ödəniş","Status"].map(h=>(
                <th key={h} className="text-left text-xs font-bold uppercase tracking-wider px-5 py-4" style={{ color:"var(--text-muted)" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {recent.map((b:any)=>(
                <tr key={b.id} className="transition-all" style={{ borderBottom:"1px solid var(--border-color)" }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--bg-glass)"}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}>
                  <td className="px-5 py-3.5"><p className="font-semibold text-sm" style={{ color:"var(--text-primary)" }}>{b.clientName}</p><p className="text-xs" style={{ color:"var(--text-muted)" }}>{b.clientPhone}</p></td>
                  <td className="px-5 py-3.5 max-w-[160px] truncate text-sm" style={{ color:"var(--text-secondary)" }}>{b.destination}</td>
                  <td className="px-5 py-3.5 text-xs" style={{ color:"var(--text-secondary)" }}>{b.manager?.split(" ")[0]}</td>
                  <td className="px-5 py-3.5 text-xs" style={{ color:"var(--text-secondary)" }}>{b.departureDate}</td>
                  <td className="px-5 py-3.5 text-sm font-bold tabular-nums" style={{ color:"var(--text-primary)" }}>{formatCurrency(b.sellPrice)}</td>
                  <td className="px-5 py-3.5"><span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background:b.paymentStatus==="paid"?"rgba(34,197,94,0.12)":b.paymentStatus==="partial"?"rgba(249,115,22,0.12)":"rgba(239,68,68,0.12)", color:b.paymentStatus==="paid"?"#22c55e":b.paymentStatus==="partial"?"#f97316":"#ef4444" }}>{b.paymentStatus==="paid"?"Ödənilib":b.paymentStatus==="partial"?"Qismən":"Ödənilməyib"}</span></td>
                  <td className="px-5 py-3.5"><span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background:b.status==="confirmed"?"rgba(34,197,94,0.12)":b.status==="pending"?"rgba(245,158,11,0.12)":"rgba(99,102,241,0.12)", color:b.status==="confirmed"?"#22c55e":b.status==="pending"?"#f59e0b":"#6366f1" }}>{b.status==="confirmed"?"Təsdiqlənib":b.status==="pending"?"Gözləyir":"Tamamlandı"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-2">
        <a href="https://varktechnologies.netlify.app/" target="_blank" rel="noopener noreferrer"
          className="text-xs font-medium transition-all hover:opacity-70"
          style={{ color:"var(--text-muted)" }}>
          Powered by <span style={{ color:"#6366f1", fontWeight:800 }}>VARK TECHNOLOGIES</span>
        </a>
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { bookings, fetchBookings } = useBookingsStore()
  const { payments, fetchPayments } = usePaymentsStore()
  const { profile } = useUserRole()
  const [cashHistory, setCashHistory] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetchBookings()
    fetchPayments()
    supabase.from("cash_transactions").select("*").order("created_at", { ascending: false }).limit(5)
      .then(({ data }) => { setCashHistory(data ?? []); setLoaded(true) })
  }, [])

  if (!profile) return <DashboardSkeleton />
  if (profile.role === "menecer" || profile.role === "bilet_menecer") {
    return <ManagerDashboard bookings={bookings} profile={profile} />
  }
  return <AdminDashboard bookings={bookings} payments={payments} cashHistory={cashHistory} profile={profile} />
}