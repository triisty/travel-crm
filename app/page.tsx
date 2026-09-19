"use client"
import { useEffect, useState, useMemo } from "react"
import { useBookingsStore } from "@/lib/store/bookingsStore"
import { usePaymentsStore } from "@/lib/store/paymentsStore"
import { useUserRole } from "@/lib/hooks/useUserRole"
import { supabase } from "@/lib/supabase"
import { formatCurrency } from "@/lib/calculations"
import {
  TrendingUp, TrendingDown, DollarSign, Users, Clock,
  ArrowUpRight, AlertCircle, CheckCircle2, Star,
  Wallet, ArrowRight, Activity, Plane, BarChart3,
  Trophy, CreditCard, Package, Share2, X
} from "lucide-react"

const MONTHS = ["Yan","Fev","Mar","Apr","May","İyn","İyl","Avq","Sen","Okt","Noy","Dek"]

function greet() {
  const h = new Date().getHours()
  return h < 12 ? "Sabahınız xeyir" : h < 18 ? "Günortanız xeyir" : "Axşamınız xeyir"
}
function todayStr() {
  return new Date().toLocaleDateString("az-AZ", { weekday:"long", day:"numeric", month:"long" })
}

// ── Badges ────────────────────────────────────────────────────
function PayBadge({ s }: any) {
  const m: any = { paid:["badge-green","Ödənilib"], partial:["badge-amber","Qismən"], unpaid:["badge-red","Ödənilməyib"] }
  const [cls,label] = m[s] ?? m.unpaid
  return <span className={`badge ${cls}`}>{label}</span>
}

// ── Metric Card ───────────────────────────────────────────────
function MetricCard({ label, value, sub, icon: Icon, color, gradient }: any) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 transition-all hover:-translate-y-0.5"
      style={{ background: gradient ?? "var(--bg-card)", border: gradient ? "none" : "1px solid var(--border-color)", boxShadow: gradient ? `0 8px 24px ${color}30` : "0 1px 4px rgba(0,0,0,0.06)" }}>
      {gradient && <>
        <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="absolute -bottom-6 -left-4 w-20 h-20 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
      </>}
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: gradient ? "rgba(255,255,255,0.65)" : "var(--text-muted)" }}>{label}</p>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: gradient ? "rgba(255,255,255,0.15)" : color + "18" }}>
            <Icon size={14} style={{ color: gradient ? "white" : color }} />
          </div>
        </div>
        <p className="text-2xl font-black tabular-nums leading-none mb-1" style={{ color: gradient ? "white" : "var(--text-primary)" }}>{value}</p>
        {sub && <p className="text-xs" style={{ color: gradient ? "rgba(255,255,255,0.55)" : "var(--text-muted)" }}>{sub}</p>}
      </div>
    </div>
  )
}

// ── Stat pill ─────────────────────────────────────────────────
function StatPill({ label, value, color }: any) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      <div className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ background: color }} />
      <div>
        <p className="text-xl font-black tabular-nums leading-none" style={{ color: "var(--text-primary)" }}>{value}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────
function SHead({ icon: Icon, label, href, color = "var(--accent)" }: any) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: color + "18" }}>
          <Icon size={12} style={{ color }} />
        </div>
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{label}</h3>
      </div>
      {href && <a href={href} className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-60" style={{ color: "var(--text-muted)" }}>Hamısı <ArrowRight size={11} /></a>}
    </div>
  )
}

// ── Rank item ─────────────────────────────────────────────────
function RankItem({ name, value, sub, index }: any) {
  const MEDAL = ["#f59e0b","#94a3b8","#b45309"]
  return (
    <div className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl transition-colors" style={{ cursor: "default" }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0"
        style={{ background: index < 3 ? MEDAL[index]+"20" : "var(--bg-hover)", color: index < 3 ? MEDAL[index] : "var(--text-muted)" }}>
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

// ── Cash item ─────────────────────────────────────────────────
function CashItem({ t }: any) {
  const add = t.operation === "add"
  return (
    <div className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl transition-colors"
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
      <div className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0"
        style={{ background: add ? "var(--success-bg)" : "var(--danger-bg)", color: add ? "var(--success)" : "var(--danger)" }}>
        {add ? "↑" : "↓"}
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

// ── Debt item ─────────────────────────────────────────────────
function DebtItem({ b, i }: any) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl transition-colors"
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
      <span className="text-xs font-bold w-5 text-center flex-shrink-0" style={{ color: "var(--text-muted)" }}>{i+1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{b.clientName}</p>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{b.destination}</p>
      </div>
      <span className="badge badge-red flex-shrink-0">{formatCurrency(b.remaining)}</span>
    </div>
  )
}

// ── Flight alert ──────────────────────────────────────────────
function FlightAlert({ flights, onClose }: any) {
  useEffect(() => { const t = setTimeout(onClose, 7000); return () => clearTimeout(t) }, [])
  const d = new Date(); d.setDate(d.getDate() + 1)
  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ background: "var(--warning-bg)", borderBottom: "1px solid var(--border-color)" }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--warning)", }}>
            <Plane size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Sabah {flights.length} uçuş var</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{d.toLocaleDateString("az-AZ",{day:"numeric",month:"long"})}</p>
          </div>
        </div>
        <div className="p-4 space-y-2.5">
          {flights.slice(0,4).map((b:any) => (
            <div key={b.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color:"var(--text-primary)" }}>{b.clientName}</p>
                <p className="text-xs truncate" style={{ color:"var(--text-muted)" }}>{b.destination}</p>
              </div>
              <PayBadge s={b.paymentStatus} />
            </div>
          ))}
          {flights.length > 4 && <p className="text-xs text-center pt-1" style={{ color:"var(--text-muted)" }}>+{flights.length-4} daha</p>}
        </div>
        <div className="px-4 pb-4 flex gap-2">
          <a href="/bookings" className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center text-white transition-all hover:opacity-90" style={{ background: "var(--accent)" }}>
            Sifarişlərə bax
          </a>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm transition-all hover:opacity-70" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
            Bağla
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Flight bar ────────────────────────────────────────────────
function FlightBar({ bookings, profile }: any) {
  const [alert, setAlert] = useState(false)
  const tom = (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().split("T")[0] })()
  const tod = new Date().toISOString().split("T")[0]
  const in5 = (() => { const d = new Date(); d.setDate(d.getDate()+5); return d.toISOString().split("T")[0] })()
  const isMgr = ["menecer","bilet_menecer"].includes(profile?.role)
  const filter = (b:any) => b.status !== "cancelled" && (!isMgr || b.manager === profile?.fullName)
  const fTom = bookings.filter((b:any) => b.departureDate === tom && filter(b))
  const fTod = bookings.filter((b:any) => b.departureDate === tod && filter(b))
  const fIn5 = bookings.filter((b:any) => b.departureDate === in5 && filter(b))
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
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 mb-5 rounded-2xl"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <Plane size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Uçuşlar:</span>
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
    <div className="p-5 md:p-6 space-y-5" style={{ background:"var(--bg-primary)", minHeight:"100vh" }}>
      <div className="space-y-2"><div className="skeleton h-8 w-56 rounded-xl"/><div className="skeleton h-4 w-40 rounded-xl"/></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i=><div key={i} className="skeleton h-28 rounded-2xl"/>)}</div>
      <div className="grid grid-cols-3 gap-3">{[1,2,3].map(i=><div key={i} className="skeleton h-16 rounded-2xl"/>)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="skeleton h-64 rounded-2xl"/>)}</div>
    </div>
  )
}

// ── Manager Dashboard ─────────────────────────────────────────
function ManagerDash({ bookings, profile }: any) {
  const my    = bookings.filter((b:any) => b.manager === profile?.fullName)
  const rev   = my.reduce((s:number,b:any) => s+b.sellPrice, 0)
  const gross = my.filter((b:any) => (b.commissionPercent??0)>0 && (b.profit+b.commissionAmount)>0).reduce((s:number,b:any) => s+b.profit+b.commissionAmount, 0)
  const bonus = gross > 0 ? Math.round(gross * 0.10 * 100)/100 : 0
  const profit= my.reduce((s:number,b:any) => s+b.profit, 0)

  const topDebts = useMemo(() =>
    my.filter((b:any) => b.paymentStatus !== "paid" && b.sellPrice-(b.paidAmount??0) > 0)
      .map((b:any) => ({...b, remaining: b.sellPrice-(b.paidAmount??0)}))
      .sort((a:any,b:any) => b.remaining-a.remaining).slice(0,5), [my])

  const topClients = useMemo(() => {
    const m:any={}
    my.forEach((b:any) => { if(!m[b.clientName])m[b.clientName]={revenue:0,count:0}; m[b.clientName].revenue+=b.sellPrice; m[b.clientName].count++ })
    return Object.entries(m).map(([name,s]:any) => ({name,...s})).sort((a:any,b:any) => b.revenue-a.revenue).slice(0,5)
  }, [my])

  return (
    <div className="p-5 md:p-6" style={{ background:"var(--bg-primary)", minHeight:"100vh" }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: "var(--success)" }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Şəxsi panel</span>
        </div>
        <h1 className="text-2xl font-black" style={{ color:"var(--text-primary)", letterSpacing:"-0.5px" }}>
          {greet()}, {profile?.fullName?.split(" ")[0]} 👋
        </h1>
        <p className="text-sm mt-0.5 capitalize" style={{ color:"var(--text-muted)" }}>{todayStr()}</p>
      </div>

      <FlightBar bookings={bookings} profile={profile} />

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <MetricCard label="Sifarişlərim" value={my.length} sub={`${my.filter((b:any)=>b.status==="confirmed").length} təsdiqlənib`} icon={Package} gradient="linear-gradient(135deg,#e84545,#f06060)" color="#e84545" />
        <MetricCard label="Satış həcmim" value={formatCurrency(rev)} icon={TrendingUp} color="var(--success)" />
        <MetricCard label="Bonusum" value={formatCurrency(bonus)} icon={DollarSign} color="var(--warning)" />
        <MetricCard label="Mənfəətim" value={formatCurrency(profit)} icon={ArrowUpRight} color="var(--info)" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatPill label="Gözləyir" value={my.filter((b:any)=>b.status==="pending").length} color="var(--warning)" />
        <StatPill label="Ödənilməyib" value={my.filter((b:any)=>b.paymentStatus!=="paid").length} color="var(--danger)" />
        <StatPill label="Cəmi sifariş" value={my.length} color="var(--accent)" />
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-2xl p-5" style={{ background:"var(--bg-card)", border:"1px solid var(--border-color)" }}>
          <SHead icon={Users} label="Mənim Müştərilərim" color="var(--info)" />
          {topClients.length === 0
            ? <p className="text-sm text-center py-6" style={{color:"var(--text-muted)"}}>Müştəri yoxdur</p>
            : topClients.map((c:any,i:number) => <RankItem key={c.name} name={c.name} value={formatCurrency(c.revenue)} sub={`${c.count} sifariş`} index={i} />)}
        </div>
        <div className="rounded-2xl p-5" style={{ background:"var(--bg-card)", border:"1px solid var(--border-color)" }}>
          <SHead icon={AlertCircle} label="Mənim Borclarım" href="/debts" color="var(--danger)" />
          {topDebts.length === 0
            ? <div className="flex flex-col items-center py-6 gap-2"><CheckCircle2 size={22} style={{color:"var(--success)"}}/><p className="text-sm" style={{color:"var(--text-muted)"}}>Borc yoxdur 🎉</p></div>
            : topDebts.map((b:any,i:number) => <DebtItem key={b.id} b={b} i={i} />)}
        </div>
      </div>

      {/* Recent bookings */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ background:"var(--bg-card)", border:"1px solid var(--border-color)" }}>
        <div className="px-5 pt-4 pb-2"><SHead icon={Activity} label="Son Sifarişlərim" href="/bookings" color="var(--accent)" /></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>{["Müştəri","İstiqamət","Tarix","Ödəniş","Status"].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {my.slice(0,8).map((b:any) => (
                <tr key={b.id}>
                  <td><p className="font-semibold" style={{color:"var(--text-primary)"}}>{b.clientName}</p>{b.clientPhone&&<p className="text-xs" style={{color:"var(--text-muted)"}}>{b.clientPhone}</p>}</td>
                  <td style={{color:"var(--text-secondary)",maxWidth:140}} className="truncate">{b.destination}</td>
                  <td style={{color:"var(--text-muted)",whiteSpace:"nowrap"}}>{b.departureDate}</td>
                  <td><PayBadge s={b.paymentStatus}/></td>
                  <td>{b.status==="confirmed"?<span className="badge badge-green">Təsdiqlənib</span>:b.status==="cancelled"?<span className="badge badge-red">Ləğv</span>:<span className="badge badge-amber">Gözləyir</span>}</td>
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

// ── TOP Export Modal ──────────────────────────────────────────
function TopExportModal({ managers, onClose }: { managers: any[]; onClose: () => void }) {
  const [aiText, setAiText] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [period, setPeriod] = useState("Bu ay")
  const MEDALS = ["🥇","🥈","🥉"]

  async function generateAI() {
    setLoading(true); setAiText("")
    const top3 = managers.slice(0,3).map((m,i) => `${i+1}. ${m.name} — ${formatCurrency(m.revenue)} satış, ${formatCurrency(m.profit)} mənfəət`).join("\n")
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: `Sən ITS Tour turizm şirkətinin SMM mütəxəssisisən. ${period} üçün menecer reytinqi:\n\n${top3}\n\nCəmi ${managers.length} menecer iştirak edib.\n\nWhatsApp qrupuna göndərmək üçün motivasiya mesajı yaz:\n- Azərbaycan dilində\n- Emoji istifadə et\n- TOP 3-ü qeyd et\n- Digərləri üçün motivasiya ver\n- Qısa və enerjili (max 10 sətir)\n- ITS Tour adını qeyd et` }]
        })
      })
      const data = await res.json()
      setAiText(data.content?.[0]?.text ?? "Xəta baş verdi")
    } catch { setAiText("Xəta baş verdi") }
    setLoading(false)
  }

  function copyAll() {
    const now = new Date().toLocaleDateString("az-AZ",{day:"2-digit",month:"2-digit",year:"numeric"})
    let text = `🏆 ITS Tour — Top Menecerlər (${period}, ${now})\n\n`
    managers.slice(0,10).forEach((m,i) => {
      const medal = i<3 ? MEDALS[i] : `${i+1}.`
      text += `${medal} ${m.name} — ${formatCurrency(m.revenue)} satış, +${formatCurrency(m.profit)} mənfəət, ${m.count} sifariş\n`
    })
    if (aiText) text += "\n" + aiText
    text += "\n\n🔴 itstour.az | VARK TECHNOLOGIES"
    navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl"
        style={{ background: "#0f1117", border: "1px solid rgba(255,255,255,0.1)" }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black" style={{ color: "#e84545" }}>its</span>
              <span className="text-lg font-black text-white">tour</span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Menecer Reytinqi</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
            <X size={15} />
          </button>
        </div>

        {/* Period */}
        <div className="flex gap-1.5 p-4 pb-2">
          {["Bu həftə","Bu ay","Bu il"].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: period===p ? "#e84545" : "rgba(255,255,255,0.07)", color: period===p ? "white" : "rgba(255,255,255,0.4)", border: "1px solid " + (period===p ? "transparent" : "rgba(255,255,255,0.08)") }}>
              {p}
            </button>
          ))}
        </div>

        {/* Ranking */}
        <div className="px-4 pb-2 space-y-1">
          {managers.slice(0,10).map((m,i) => {
            const colors = ["#f59e0b","#94a3b8","#b45309"]
            const medal = i<3 ? ["🥇","🥈","🥉"][i] : String(i+1)
            return (
              <div key={m.name} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
                style={{ background: i===0?"linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.04))":i===1?"rgba(148,163,184,0.06)":i===2?"rgba(180,83,9,0.08)":"rgba(255,255,255,0.03)", border: i<3?"1px solid rgba(255,255,255,0.07)":"none" }}>
                <div className="w-7 h-7 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
                  style={{ background: i<3?colors[i]+"20":"rgba(255,255,255,0.06)", color: i<3?colors[i]:"rgba(255,255,255,0.3)" }}>
                  {medal}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{m.name}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{m.count} sifariş</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-black tabular-nums text-white">{formatCurrency(m.revenue)}</p>
                  <p className="text-xs font-bold tabular-nums" style={{ color: "#22c55e" }}>+{formatCurrency(m.profit)}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* AI message */}
        {(aiText || loading) && (
          <div className="mx-4 mb-3 p-4 rounded-2xl" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "#818cf8" }}>✨ AI Mesaj</p>
            {loading
              ? <div className="flex gap-1.5 py-1">{[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full" style={{ background: "#6366f1", animation: `bounce 1.2s ${i*0.2}s infinite`, opacity: 0.6 }} />)}</div>
              : <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.8)", whiteSpace: "pre-wrap" }}>{aiText}</p>}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2 p-4 pt-2">
          <button onClick={generateAI} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
            {loading ? "Yazılır..." : "✨ AI Mesaj"}
          </button>
          <button onClick={copyAll}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold"
            style={{ background: copied?"rgba(34,197,94,0.15)":"rgba(255,255,255,0.08)", color: copied?"#22c55e":"white", border: "1px solid " + (copied?"rgba(34,197,94,0.3)":"rgba(255,255,255,0.1)") }}>
            {copied ? "✅ Kopyalandı!" : "📋 Kopyala"}
          </button>
        </div>
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0.7);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
    </div>
  )
}

// ── Admin Dashboard ────────────────────────────────────────────
function AdminDash({ bookings, cashHistory, profile }: any) {
  const [period, setPeriod] = useState<"week"|"month"|"year">("month")
  const [showTop, setShowTop] = useState(false)
  const now = new Date()
  const rev    = bookings.reduce((s:number,b:any)=>s+b.sellPrice,0)
  const cost   = bookings.reduce((s:number,b:any)=>s+b.buyPrice,0)
  const profit = bookings.reduce((s:number,b:any)=>s+b.profit,0)
  const comm   = bookings.reduce((s:number,b:any)=>s+b.commissionAmount,0)
  const margin = rev>0?Math.round((profit/rev)*100):0

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

  const allTimeManagers = useMemo(() => {
    const m:any={}
    bookings.forEach((b:any)=>{if(!b.manager)return;if(!m[b.manager])m[b.manager]={name:b.manager,revenue:0,profit:0,count:0};m[b.manager].revenue+=b.sellPrice;m[b.manager].profit+=b.profit;m[b.manager].count++})
    return Object.values(m).sort((a:any,b:any)=>b.revenue-a.revenue)
  },[bookings])

  return (
    <div className="p-5 md:p-6" style={{ background:"var(--bg-primary)", minHeight:"100vh" }}>
      {showTop && <TopExportModal managers={allTimeManagers} onClose={() => setShowTop(false)} />}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--success)" }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Canlı məlumatlar</span>
          </div>
          <h1 className="text-2xl font-black" style={{ color:"var(--text-primary)", letterSpacing:"-0.5px" }}>Dashboard</h1>
          <p className="text-sm mt-0.5 capitalize" style={{ color:"var(--text-muted)" }}>{todayStr()}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTop(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg,#e84545,#f06060)", boxShadow: "0 4px 16px rgba(232,69,69,0.3)" }}>
            <Trophy size={14} />TOP Export
          </button>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl" style={{ background:"var(--bg-card)", border:"1px solid var(--border-color)" }}>
            <Package size={13} style={{ color:"var(--text-muted)" }} />
            <span className="text-sm font-bold" style={{ color:"var(--text-primary)" }}>{bookings.length}</span>
            <span className="text-xs" style={{ color:"var(--text-muted)" }}>sifariş</span>
          </div>
        </div>
      </div>

      <FlightBar bookings={bookings} profile={profile} />

      {/* Main metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <MetricCard label="Ümumi gəlir" value={formatCurrency(rev)} sub={`Marja: ${margin}%`} icon={TrendingUp} gradient="linear-gradient(135deg,#2bb5a0,#38d9c0)" color="#2bb5a0" />
        <MetricCard label="Alış xərci" value={formatCurrency(cost)} sub="Bilet və tur" icon={TrendingDown} color="var(--danger)" />
        <MetricCard label="Mənfəət" value={formatCurrency(profit)} sub={`${margin}% marja`} icon={ArrowUpRight} color="var(--success)" />
        <MetricCard label="Komissiya" value={formatCurrency(comm)} sub="Cəmi" icon={DollarSign} color="var(--accent)" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatPill label="Cəmi sifarişlər" value={bookings.length} color="var(--info)" />
        <StatPill label="Gözləyir" value={bookings.filter((b:any)=>b.status==="pending").length} color="var(--warning)" />
        <StatPill label="Ödənilməyib" value={bookings.filter((b:any)=>b.paymentStatus!=="paid").length} color="var(--danger)" />
      </div>

      {/* 3-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Managers */}
        <div className="rounded-2xl p-5" style={{ background:"var(--bg-card)", border:"1px solid var(--border-color)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background:"rgba(245,158,11,0.15)" }}>
                <Trophy size={12} style={{ color:"var(--warning)" }} />
              </div>
              <h3 className="text-sm font-bold" style={{ color:"var(--text-primary)" }}>Top Menecerlər</h3>
            </div>
            <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background:"var(--bg-hover)" }}>
              {(["week","month","year"] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className="px-2 py-1 rounded-md text-xs font-semibold transition-all"
                  style={{ background:period===p?"var(--bg-card)":"transparent", color:period===p?"var(--text-primary)":"var(--text-muted)", boxShadow:period===p?"var(--shadow-xs)":"none" }}>
                  {p==="week"?"H":p==="month"?"A":"İ"}
                </button>
              ))}
            </div>
          </div>
          {topManagers.length===0
            ? <p className="text-sm text-center py-6" style={{color:"var(--text-muted)"}}>Bu dövrdə sifariş yoxdur</p>
            : topManagers.map((m:any,i:number) => <RankItem key={m.name} name={m.name.split(" ")[0]} value={formatCurrency(m.revenue)} sub={`${m.count} sifariş`} index={i} />)}
        </div>

        {/* Clients */}
        <div className="rounded-2xl p-5" style={{ background:"var(--bg-card)", border:"1px solid var(--border-color)" }}>
          <SHead icon={Star} label="Top Müştərilər" color="var(--info)" />
          {topClients.map((c:any,i:number) => <RankItem key={c.name} name={c.name} value={formatCurrency(c.revenue)} sub={`${c.count} sifariş`} index={i} />)}
        </div>

        {/* Cash */}
        <div className="rounded-2xl p-5" style={{ background:"var(--bg-card)", border:"1px solid var(--border-color)" }}>
          <SHead icon={Wallet} label="Kassa Hərəkəti" href="/finances" color="var(--success)" />
          {cashHistory.length===0
            ? <p className="text-sm text-center py-6" style={{color:"var(--text-muted)"}}>Əməliyyat yoxdur</p>
            : cashHistory.map((t:any) => <CashItem key={t.id} t={t} />)}
        </div>
      </div>

      {/* Debts + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="rounded-2xl p-5" style={{ background:"var(--bg-card)", border:"1px solid var(--border-color)" }}>
          <SHead icon={AlertCircle} label="Ən Böyük Borclar" href="/debts" color="var(--danger)" />
          {topDebts.length===0
            ? <div className="flex flex-col items-center py-6 gap-2"><CheckCircle2 size={22} style={{color:"var(--success)"}}/><p className="text-sm" style={{color:"var(--text-muted)"}}>Borc yoxdur 🎉</p></div>
            : topDebts.map((b:any,i:number) => <DebtItem key={b.id} b={b} i={i} />)}
        </div>

        <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ background:"var(--bg-card)", border:"1px solid var(--border-color)" }}>
          <div className="px-5 pt-4 pb-2"><SHead icon={Activity} label="Son Sifarişlər" href="/bookings" color="var(--accent)" /></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>{["Müştəri","İstiqamət","Menecer","Satış","Ödəniş"].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {[...bookings].slice(0,6).map((b:any) => (
                  <tr key={b.id}>
                    <td><p className="font-semibold" style={{color:"var(--text-primary)"}}>{b.clientName}</p>{b.clientPhone&&<p className="text-xs" style={{color:"var(--text-muted)"}}>{b.clientPhone}</p>}</td>
                    <td style={{color:"var(--text-secondary)",maxWidth:130}} className="truncate">{b.destination}</td>
                    <td style={{color:"var(--text-muted)",whiteSpace:"nowrap"}}>{b.manager?.split(" ")[0]}</td>
                    <td className="font-bold tabular-nums" style={{color:"var(--text-primary)"}}>{formatCurrency(b.sellPrice)}</td>
                    <td><PayBadge s={b.paymentStatus}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}

function Footer() {
  return (
    <div className="text-center py-4">
      <a href="https://varktechnologies.com//" target="_blank" rel="noopener noreferrer"
        className="text-xs transition-all hover:opacity-60" style={{ color:"var(--text-muted)" }}>
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
