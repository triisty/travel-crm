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
  Wallet, ArrowRight, Activity, Plane, BarChart3
} from "lucide-react"
import Image from "next/image"

const MONTHS = ["Yan","Fev","Mar","Apr","May","İyn","İyl","Avq","Sen","Okt","Noy","Dek"]

function greet() {
  const h = new Date().getHours()
  return h < 12 ? "Sabahınız xeyir" : h < 18 ? "Günortanız xeyir" : "Axşamınız xeyir"
}
function todayStr() {
  return new Date().toLocaleDateString("az-AZ", { weekday:"long", day:"numeric", month:"long" })
}

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color, trend }: any) {
  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</p>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: color + "14" }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-black tabular-nums leading-none mb-1" style={{ color: "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{sub}</p>}
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          <TrendingUp size={11} style={{ color: trend >= 0 ? "var(--success)" : "var(--danger)" }} />
          <span className="text-xs font-semibold" style={{ color: trend >= 0 ? "var(--success)" : "var(--danger)" }}>
            {trend >= 0 ? "+" : ""}{trend}%
          </span>
        </div>
      )}
    </div>
  )
}

function HeroCard({ label, value, sub, color1, color2 }: any) {
  return (
    <div className="kpi-card text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg,${color1},${color2})`, border: "none" }}>
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
      <div className="absolute -bottom-6 -left-4 w-24 h-24 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-wide mb-4 opacity-70">{label}</p>
        <p className="text-3xl font-black tabular-nums leading-none mb-1">{value}</p>
        {sub && <p className="text-xs opacity-60">{sub}</p>}
      </div>
    </div>
  )
}

function StatRow({ label, value, color }: any) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: color }} />
      <div>
        <p className="text-xl font-black tabular-nums leading-none" style={{ color: "var(--text-primary)" }}>{value}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
    </div>
  )
}

function SectionTitle({ icon: Icon, label, href, color = "var(--accent)" }: any) {
  return (
    <div className="flex items-center justify-between mb-3 px-4 pt-4">
      <div className="flex items-center gap-2">
        <Icon size={14} style={{ color }} />
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{label}</h3>
      </div>
      {href && (
        <a href={href} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Hamısı <ArrowRight size={11} />
        </a>
      )}
    </div>
  )
}

function RankItem({ name, value, sub, index }: any) {
  const colors = ["#f5a623","#94a3b8","#b45309"]
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg transition-colors hover:bg-[var(--bg-hover)]">
      <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-black flex-shrink-0"
        style={{ background: index < 3 ? colors[index]+"20" : "var(--bg-hover)", color: index < 3 ? colors[index] : "var(--text-muted)", fontSize: 11 }}>
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{name}</p>
        {sub && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{sub}</p>}
      </div>
      <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  )
}

function CashItem({ t }: any) {
  const add = t.operation === "add"
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg transition-colors hover:bg-[var(--bg-hover)]">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
        style={{ background: add ? "var(--success-bg)" : "var(--danger-bg)", color: add ? "var(--success)" : "var(--danger)" }}>
        {add ? "+" : "−"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{t.reason || "—"}</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{MONTHS[new Date(t.created_at).getMonth()]} {new Date(t.created_at).getDate()} · {t.currency}</p>
      </div>
      <p className="text-sm font-bold tabular-nums" style={{ color: add ? "var(--success)" : "var(--danger)" }}>
        {add ? "+" : "−"}{t.amount}
      </p>
    </div>
  )
}

function DebtItem({ b, i }: any) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg transition-colors hover:bg-[var(--bg-hover)]">
      <span className="text-xs font-bold w-5 text-center" style={{ color: "var(--text-muted)" }}>{i+1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{b.clientName}</p>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{b.destination}</p>
      </div>
      <span className="badge badge-red">{formatCurrency(b.remaining)}</span>
    </div>
  )
}

function PayBadge({ s }: any) {
  const m: any = { paid: ["badge-green","Ödənilib"], partial: ["badge-amber","Qismən"], unpaid: ["badge-red","Ödənilməyib"] }
  const [cls, label] = m[s] ?? m.unpaid
  return <span className={`badge ${cls}`}>{label}</span>
}

function StatusBadge({ s }: any) {
  const m: any = { confirmed:["badge-green","Təsdiqlənib"], pending:["badge-amber","Gözləyir"], completed:["badge-blue","Tamamlandı"], cancelled:["badge-red","Ləğv"] }
  const [cls, label] = m[s] ?? ["badge-gray", s]
  return <span className={`badge ${cls}`}>{label}</span>
}

// ── Flight alert ──────────────────────────────────────────────
function FlightAlert({ flights, onClose }: any) {
  useEffect(() => { const t = setTimeout(onClose, 7000); return () => clearTimeout(t) }, [])
  const d = new Date(); d.setDate(d.getDate() + 1)
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-xl)" }}>
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--border-color)", background: "var(--warning-bg)" }}>
          <Plane size={16} style={{ color: "var(--warning)" }} />
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Sabah {flights.length} uçuş</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{d.toLocaleDateString("az-AZ", { day:"numeric", month:"long" })}</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {flights.slice(0,4).map((b: any) => (
            <div key={b.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{b.clientName}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{b.destination}</p>
              </div>
              <PayBadge s={b.paymentStatus} />
            </div>
          ))}
          {flights.length > 4 && <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>+{flights.length-4} daha</p>}
        </div>
        <div className="px-4 pb-4 flex gap-2">
          <a href="/bookings" className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center text-white" style={{ background: "var(--accent)" }}>Sifarişlərə bax</a>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>Bağla</button>
        </div>
      </div>
    </div>
  )
}

function FlightBar({ bookings, profile }: any) {
  const [alert, setAlert] = useState(false)
  const tom  = (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().split("T")[0] })()
  const tod  = new Date().toISOString().split("T")[0]
  const in5  = (() => { const d = new Date(); d.setDate(d.getDate()+5); return d.toISOString().split("T")[0] })()
  const isMgr = ["menecer","bilet_menecer"].includes(profile?.role)
  const filter = (b: any) => b.status !== "cancelled" && (!isMgr || b.manager === profile?.fullName)
  const fTom = bookings.filter((b: any) => b.departureDate === tom && filter(b))
  const fTod = bookings.filter((b: any) => b.departureDate === tod && filter(b))
  const fIn5 = bookings.filter((b: any) => b.departureDate === in5 && filter(b))
  useEffect(() => {
    if (fTom.length) {
      const k = `fa_${tom}`
      if (!sessionStorage.getItem(k)) { setTimeout(() => setAlert(true), 800); sessionStorage.setItem(k, "1") }
    }
  }, [fTom.length])
  if (!fTom.length && !fTod.length && !fIn5.length) return null
  return (
    <>
      {alert && <FlightAlert flights={fTom} onClose={() => setAlert(false)} />}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 mb-5 rounded-xl"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <Plane size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        <span className="text-xs font-semibold mr-1" style={{ color: "var(--text-secondary)" }}>Uçuşlar:</span>
        {fTod.length > 0 && <span className="badge badge-red">Bu gün · {fTod.length}</span>}
        {fTom.length > 0 && <button onClick={() => setAlert(true)} className="badge badge-amber" style={{ cursor:"pointer" }}>Sabah · {fTom.length}</button>}
        {fIn5.length > 0 && <span className="badge badge-gray">5 gün · {fIn5.length}</span>}
      </div>
    </>
  )
}

// ── Skeleton ──────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="p-5 md:p-6 space-y-5" style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <div className="space-y-2">
        <div className="skeleton h-7 w-56 rounded-lg" />
        <div className="skeleton h-4 w-40 rounded-lg" />
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

// ── Manager Dashboard ─────────────────────────────────────────
function ManagerDash({ bookings, profile }: any) {
  const my    = bookings.filter((b: any) => b.manager === profile?.fullName)
  const rev   = my.reduce((s: number, b: any) => s + b.sellPrice, 0)
  const gross = my.reduce((s: number, b: any) => s + b.profit + b.commissionAmount, 0)
  const bonus = gross * 0.10
  const profit= my.reduce((s: number, b: any) => s + b.profit, 0)

  const topClients = useMemo(() => {
    const m: any = {}
    my.forEach((b: any) => { if(!m[b.clientName]) m[b.clientName]={revenue:0,count:0}; m[b.clientName].revenue+=b.sellPrice; m[b.clientName].count++ })
    return Object.entries(m).map(([name,s]:any) => ({name,...s})).sort((a:any,b:any) => b.revenue-a.revenue).slice(0,5)
  }, [my])

  const topDebts = useMemo(() =>
    my.filter((b:any) => b.paymentStatus !== "paid" && b.sellPrice-(b.paidAmount??0) > 0)
      .map((b:any) => ({...b, remaining: b.sellPrice-(b.paidAmount??0)}))
      .sort((a:any,b:any) => b.remaining-a.remaining).slice(0,5), [my])

  return (
    <div className="p-5 md:p-6" style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <div className="mb-6">
        <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
          {greet()}, {profile?.fullName?.split(" ")[0]}
        </h1>
        <p className="text-sm mt-0.5 capitalize" style={{ color: "var(--text-muted)" }}>{todayStr()}</p>
      </div>

      <FlightBar bookings={bookings} profile={profile} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <HeroCard label="Sifarişlərim" value={my.length} sub={`${my.filter((b:any)=>b.status==="confirmed").length} təsdiqlənib`} color1="#e84545" color2="#f06060" />
        <KpiCard label="Satış həcmim"  value={formatCurrency(rev)}   icon={TrendingUp}  color="var(--success)" />
        <KpiCard label="Bonusum"        value={formatCurrency(bonus)} icon={DollarSign}  color="var(--warning)" />
        <KpiCard label="Mənfəətim"      value={formatCurrency(profit)}icon={ArrowUpRight} color="var(--info)" />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatRow label="Gözləyir"    value={my.filter((b:any)=>b.status==="pending").length}          color="var(--warning)" />
        <StatRow label="Ödənilməyib" value={my.filter((b:any)=>b.paymentStatus!=="paid").length}      color="var(--danger)" />
        <StatRow label="Cəmi"        value={my.length}                                                  color="var(--accent)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <div className="card pb-3">
          <SectionTitle icon={Users} label="Mənim Müştərilərim" color="var(--info)" />
          <div className="px-4">
            {topClients.length === 0
              ? <p className="text-sm text-center py-6" style={{ color:"var(--text-muted)" }}>Müştəri yoxdur</p>
              : topClients.map((c:any,i:number) => <RankItem key={c.name} name={c.name} value={formatCurrency(c.revenue)} sub={`${c.count} sifariş`} index={i} />)}
          </div>
        </div>
        <div className="card pb-3">
          <SectionTitle icon={AlertCircle} label="Mənim Borclarım" href="/debts" color="var(--danger)" />
          <div className="px-4">
            {topDebts.length === 0
              ? <div className="flex flex-col items-center py-6 gap-2"><CheckCircle2 size={22} style={{color:"var(--success)"}}/><p className="text-sm" style={{color:"var(--text-muted)"}}>Borc yoxdur</p></div>
              : topDebts.map((b:any,i:number) => <DebtItem key={b.id} b={b} i={i} />)}
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <SectionTitle icon={Activity} label="Son Sifarişlərim" href="/bookings" color="var(--accent)" />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>{["Müştəri","İstiqamət","Tarix","Ödəniş","Status"].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {my.slice(0,8).map((b:any) => (
                <tr key={b.id}>
                  <td><p className="font-semibold" style={{color:"var(--text-primary)"}}>{b.clientName}</p><p className="text-xs" style={{color:"var(--text-muted)"}}>{b.clientPhone}</p></td>
                  <td style={{color:"var(--text-secondary)",maxWidth:140}} className="truncate">{b.destination}</td>
                  <td style={{color:"var(--text-muted)",whiteSpace:"nowrap"}}>{b.departureDate}</td>
                  <td><PayBadge s={b.paymentStatus}/></td>
                  <td><StatusBadge s={b.status}/></td>
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

// ── Admin Dashboard ────────────────────────────────────────────
function AdminDash({ bookings, cashHistory, profile }: any) {
  const [period, setPeriod] = useState<"week"|"month"|"year">("month")
  const now = new Date()
  const rev   = bookings.reduce((s:number,b:any)=>s+b.sellPrice,0)
  const cost  = bookings.reduce((s:number,b:any)=>s+b.buyPrice,0)
  const profit= bookings.reduce((s:number,b:any)=>s+b.profit,0)
  const comm  = bookings.reduce((s:number,b:any)=>s+b.commissionAmount,0)
  const margin= rev>0?Math.round((profit/rev)*100):0

  const periodBkgs = useMemo(() => bookings.filter((b:any) => {
    const d = new Date(b.createdAt)
    if (period==="week") { const w=new Date(now); w.setDate(now.getDate()-7); return d>=w }
    if (period==="month") return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()
    return d.getFullYear()===now.getFullYear()
  }), [bookings,period])

  const topManagers = useMemo(() => {
    const m:any={}
    periodBkgs.forEach((b:any)=>{if(!b.manager)return;if(!m[b.manager])m[b.manager]={revenue:0,count:0};m[b.manager].revenue+=b.sellPrice;m[b.manager].count++})
    return Object.entries(m).map(([name,s]:any)=>({name,...s})).sort((a:any,b:any)=>b.revenue-a.revenue).slice(0,5)
  },[periodBkgs])

  const topClients = useMemo(() => {
    const m:any={}
    bookings.forEach((b:any)=>{if(!m[b.clientName])m[b.clientName]={revenue:0,count:0};m[b.clientName].revenue+=b.sellPrice;m[b.clientName].count++})
    return Object.entries(m).map(([name,s]:any)=>({name,...s})).sort((a:any,b:any)=>b.revenue-a.revenue).slice(0,5)
  },[bookings])

  const topDebts = useMemo(() =>
    bookings.filter((b:any)=>b.paymentStatus!=="paid"&&b.sellPrice-(b.paidAmount??0)>0)
      .map((b:any)=>({...b,remaining:b.sellPrice-(b.paidAmount??0)}))
      .sort((a:any,b:any)=>b.remaining-a.remaining).slice(0,5),[bookings])

  return (
    <div className="p-5 md:p-6" style={{ background:"var(--bg-primary)", minHeight:"100vh" }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black" style={{ color:"var(--text-primary)" }}>Dashboard</h1>
          <p className="text-sm mt-0.5 capitalize" style={{ color:"var(--text-muted)" }}>{todayStr()}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background:"var(--bg-card)", border:"1px solid var(--border-color)" }}>
          <div className="w-2 h-2 rounded-full" style={{ background:"var(--success)" }} />
          <span className="text-xs font-semibold" style={{ color:"var(--text-secondary)" }}>{bookings.length} sifariş</span>
        </div>
      </div>

      <FlightBar bookings={bookings} profile={profile} />

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <HeroCard label="Ümumi gəlir" value={formatCurrency(rev)} sub={`Marja: ${margin}%`} color1="#2bb5a0" color2="#38d9c0" />
        <KpiCard label="Alış xərci"  value={formatCurrency(cost)}   sub="Bilet və tur" icon={TrendingDown} color="var(--danger)" />
        <KpiCard label="Mənfəət"     value={formatCurrency(profit)} sub={`${margin}% marja`} icon={TrendingUp} color="var(--success)" />
        <KpiCard label="Komissiya"   value={formatCurrency(comm)}   sub="Cəmi" icon={DollarSign} color="var(--accent)" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatRow label="Cəmi sifarişlər" value={bookings.length} color="var(--info)" />
        <StatRow label="Gözləyir" value={bookings.filter((b:any)=>b.status==="pending").length} color="var(--warning)" />
        <StatRow label="Ödənilməyib" value={bookings.filter((b:any)=>b.paymentStatus!=="paid").length} color="var(--danger)" />
      </div>

      {/* Managers + Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card pb-3">
          <div className="flex items-center justify-between px-4 pt-4 mb-3">
            <div className="flex items-center gap-2">
              <Trophy size={14} style={{ color:"var(--warning)" }} />
              <h3 className="text-sm font-bold" style={{ color:"var(--text-primary)" }}>Top Menecerlər</h3>
            </div>
            <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background:"var(--bg-hover)" }}>
              {(["week","month","year"] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
                  style={{ background:period===p?"var(--bg-card)":"transparent", color:period===p?"var(--text-primary)":"var(--text-muted)", boxShadow:period===p?"var(--shadow-xs)":"none" }}>
                  {p==="week"?"Həftə":p==="month"?"Ay":"İl"}
                </button>
              ))}
            </div>
          </div>
          <div className="px-4">
            {topManagers.length===0
              ? <p className="text-sm text-center py-6" style={{color:"var(--text-muted)"}}>Bu dövrdə sifariş yoxdur</p>
              : topManagers.map((m:any,i:number) => <RankItem key={m.name} name={m.name} value={formatCurrency(m.revenue)} sub={`${m.count} sifariş`} index={i} />)}
          </div>
        </div>
        <div className="card pb-3">
          <SectionTitle icon={Star} label="Top Müştərilər" color="var(--info)" />
          <div className="px-4">
            {topClients.map((c:any,i:number) => <RankItem key={c.name} name={c.name} value={formatCurrency(c.revenue)} sub={`${c.count} sifariş`} index={i} />)}
          </div>
        </div>
      </div>

      {/* Cash + Debts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card pb-3">
          <SectionTitle icon={Wallet} label="Kassa Hərəkəti" href="/finances" color="var(--success)" />
          <div className="px-4">
            {cashHistory.length===0
              ? <p className="text-sm text-center py-6" style={{color:"var(--text-muted)"}}>Əməliyyat yoxdur</p>
              : cashHistory.map((t:any) => <CashItem key={t.id} t={t} />)}
          </div>
        </div>
        <div className="card pb-3">
          <SectionTitle icon={AlertCircle} label="Ən Böyük Borclar" href="/debts" color="var(--danger)" />
          <div className="px-4">
            {topDebts.length===0
              ? <div className="flex flex-col items-center py-6 gap-2"><CheckCircle2 size={22} style={{color:"var(--success)"}}/><p className="text-sm" style={{color:"var(--text-muted)"}}>Borc yoxdur</p></div>
              : topDebts.map((b:any,i:number) => <DebtItem key={b.id} b={b} i={i} />)}
          </div>
        </div>
      </div>

      {/* Recent */}
      <div className="card mb-4">
        <SectionTitle icon={Activity} label="Son Sifarişlər" href="/bookings" color="var(--accent)" />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>{["Müştəri","İstiqamət","Menecer","Tarix","Satış","Ödəniş","Status"].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {[...bookings].slice(0,8).map((b:any) => (
                <tr key={b.id}>
                  <td><p className="font-semibold" style={{color:"var(--text-primary)"}}>{b.clientName}</p>{b.clientPhone&&<p className="text-xs" style={{color:"var(--text-muted)"}}>{b.clientPhone}</p>}</td>
                  <td style={{color:"var(--text-secondary)",maxWidth:140}} className="truncate">{b.destination}</td>
                  <td style={{color:"var(--text-muted)",whiteSpace:"nowrap"}}>{b.manager?.split(" ")[0]}</td>
                  <td style={{color:"var(--text-muted)",whiteSpace:"nowrap"}}>{b.departureDate}</td>
                  <td className="font-bold tabular-nums" style={{color:"var(--text-primary)"}}>{formatCurrency(b.sellPrice)}</td>
                  <td><PayBadge s={b.paymentStatus}/></td>
                  <td><StatusBadge s={b.status}/></td>
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
        className="text-xs transition-all hover:opacity-70" style={{ color:"var(--text-muted)" }}>
        Powered by <span style={{ color:"var(--accent)", fontWeight:700 }}>VARK TECHNOLOGIES</span>
      </a>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const { bookings, fetchBookings } = useBookingsStore()
  const { fetchPayments } = usePaymentsStore()
  const { profile } = useUserRole()
  const [cashHistory, setCashHistory] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetchBookings(); fetchPayments()
    supabase.from("cash_transactions").select("*").order("created_at",{ascending:false}).limit(8)
      .then(({data}) => { setCashHistory(data??[]); setLoaded(true) })
  }, [])

  if (!profile || !loaded) return <PageSkeleton />
  if (["menecer","bilet_menecer"].includes(profile.role)) return <ManagerDash bookings={bookings} profile={profile} />
  return <AdminDash bookings={bookings} cashHistory={cashHistory} profile={profile} />
}
