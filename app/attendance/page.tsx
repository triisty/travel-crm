"use client"
import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/lib/hooks/useUserRole"
import {
  Clock, Users, AlertTriangle, CheckCircle2, RefreshCw,
  Calendar, ChevronLeft, ChevronRight, Wifi, WifiOff, Activity
} from "lucide-react"

const ADMIN_ROLES = ["it_admin", "boss", "direktor", "muhasib"]

function fmt(ts: string | null) {
  if (!ts) return "—"
  return new Date(ts).toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" })
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("az-AZ", { weekday: "short", day: "numeric", month: "short" })
}
function fmtWorked(min: number | null) {
  if (!min || min <= 0) return "—"
  const h = Math.floor(min / 60), m = min % 60
  return `${h}s ${m}d`
}

export default function AttendancePage() {
  const { profile } = useUserRole()
  const [summary, setSummary]   = useState<any[]>([])
  const [events, setEvents]     = useState<any[]>([])
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null)
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10))
  // On mount, find last date with data
  useEffect(() => {
    supabase.from("attendance_summary").select("work_date").order("work_date", { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]?.work_date) setDate(data[0].work_date) })
  }, [])
  const [syncing, setSyncing]   = useState(false)
  const [syncMsg, setSyncMsg]   = useState("")
  const [diagMsg, setDiagMsg]   = useState("")
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<"today" | "history">("today")

  const isAdmin = ADMIN_ROLES.includes(profile?.role ?? "")
  const myPersonId = null // future: link user_profiles.person_id

  useEffect(() => { fetchSummary() }, [date])

  async function fetchSummary() {
    setLoading(true)
    const { data } = await supabase
      .from("attendance_summary")
      .select("*")
      .eq("work_date", date)
      .order("first_in", { ascending: true })
    setSummary(data ?? [])
    setLoading(false)
  }

  async function fetchPersonEvents(personId: string) {
    const { data } = await supabase
      .from("attendance_events")
      .select("*")
      .eq("person_id", personId)
      .gte("event_time", `${date}T00:00:00`)
      .lte("event_time", `${date}T23:59:59`)
      .order("event_time", { ascending: true })
    setEvents(data ?? [])
    setSelectedPerson(personId)
  }

  async function diagnose() {
    setDiagMsg("Yoxlanılır...")
    try {
      const res = await fetch("/api/hikvision/diagnose")
      const data = await res.json()
      setDiagMsg(data.ok
        ? "✅ Cihaz əlçatandır"
        : `❌ ${data.hint ?? data.error}`)
    } catch { setDiagMsg("❌ API xətası") }
  }

  async function syncNow() {
    setSyncing(true); setSyncMsg("")
    try {
      const startTime = `${date}T00:00:00+04:00`
      const endTime   = `${date}T23:59:59+04:00`
      const res = await fetch("/api/hikvision/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime, endTime }),
      })
      const data = await res.json()
      setSyncMsg(data.ok
        ? `✅ ${data.synced} hadisə sinxronizasiya edildi`
        : `❌ ${data.error}`)
      fetchSummary()
    } catch (e: any) { setSyncMsg("❌ " + e.message) }
    setSyncing(false)
  }

  function prevDay() { const d = new Date(date); d.setDate(d.getDate()-1); setDate(d.toISOString().slice(0,10)) }
  function nextDay() { const d = new Date(date); d.setDate(d.getDate()+1); setDate(d.toISOString().slice(0,10)) }

  const stats = useMemo(() => ({
    total:  summary.length,
    onTime: summary.filter(s => !s.is_late && s.first_in).length,
    late:   summary.filter(s => s.is_late).length,
    absent: summary.filter(s => !s.first_in).length,
  }), [summary])

  if (!profile) return null

  return (
    <div className="p-5 md:p-6" style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>Davamiyyət</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Hikvision DS-K1A802AMF</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button onClick={diagnose}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
              <Wifi size={13} />Diaqnoz
            </button>
            <button onClick={syncNow} disabled={syncing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-all"
              style={{ background: "var(--accent)" }}>
              <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Sinxron..." : "Sinxronizasiya"}
            </button>
          </div>
        )}
      </div>

      {/* Diag / sync messages */}
      {diagMsg && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
          {diagMsg}
        </div>
      )}
      {syncMsg && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
          {syncMsg}
        </div>
      )}

      {/* Date picker */}
      <div className="flex items-center gap-3 mb-5 p-1 rounded-2xl w-fit" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <button onClick={prevDay} className="w-8 h-8 flex items-center justify-center rounded-xl transition-all hover:bg-[var(--bg-hover)]" style={{ color: "var(--text-muted)" }}>
          <ChevronLeft size={15} />
        </button>
        <div className="flex items-center gap-2 px-2">
          <Calendar size={13} style={{ color: "var(--text-muted)" }} />
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="text-sm font-semibold bg-transparent outline-none" style={{ color: "var(--text-primary)" }} />
        </div>
        <button onClick={nextDay} className="w-8 h-8 flex items-center justify-center rounded-xl transition-all hover:bg-[var(--bg-hover)]" style={{ color: "var(--text-muted)" }}>
          <ChevronRight size={15} />
        </button>
        <span className="text-xs px-3 py-1 mr-1 rounded-lg font-medium" style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>
          {fmtDate(date)}
        </span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Cəmi",        value: stats.total,  icon: Users,         color: "var(--info)"    },
          { label: "Vaxtında",    value: stats.onTime, icon: CheckCircle2,  color: "var(--success)" },
          { label: "Gecikən",     value: stats.late,   icon: AlertTriangle, color: "var(--warning)" },
          { label: "Gəlməyən",   value: stats.absent, icon: WifiOff,       color: "var(--danger)"  },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="p-4 rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</p>
              <Icon size={14} style={{ color }} />
            </div>
            <p className="text-2xl font-black tabular-nums" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Main table */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>Yüklənir...</div>
        ) : summary.length === 0 ? (
          <div className="p-12 text-center">
            <Activity size={32} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Bu tarixdə məlumat yoxdur</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>«Sinxronizasiya» düyməsini sıxın</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {["İşçi", "İlk giriş", "Son çıxış", "İş vaxtı", "Status", ""].map(h => (
                    <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider px-4 py-3"
                      style={{ color: "var(--text-muted)", background: "var(--bg-primary)", borderBottom: "1px solid var(--border-color)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.map(s => (
                  <tr key={s.id} style={{ borderBottom: "1px solid var(--border-color)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: s.is_late ? "var(--warning)" : s.first_in ? "var(--success)" : "var(--danger)" }}>
                          {(s.employee_name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{s.employee_name ?? "—"}</p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>ID: {s.person_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold tabular-nums" style={{ color: s.is_late ? "var(--warning)" : "var(--success)" }}>
                        {fmt(s.first_in)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {fmt(s.last_out)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {fmtWorked(s.worked_minutes)}
                    </td>
                    <td className="px-4 py-3">
                      {!s.first_in
                        ? <span className="badge badge-red">Gəlməyib</span>
                        : s.is_late
                        ? <span className="badge badge-amber">Gecikib</span>
                        : <span className="badge badge-green">Vaxtında</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => fetchPersonEvents(s.person_id)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                        style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                        Tarixçə
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Event history modal */}
      {selectedPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-xl)" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  {summary.find(s => s.person_id === selectedPerson)?.employee_name ?? selectedPerson}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(date)} — bütün qeydlər</p>
              </div>
              <button onClick={() => setSelectedPerson(null)} style={{ color: "var(--text-muted)" }}>✕</button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto space-y-2">
              {events.length === 0
                ? <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>Hadisə yoxdur</p>
                : events.map((ev, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: ev.event_type === "entry" ? "var(--success)" : ev.event_type === "exit" ? "var(--danger)" : "var(--text-muted)" }} />
                    <div className="flex-1">
                      <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                        {ev.event_type === "entry" ? "Giriş" : ev.event_type === "exit" ? "Çıxış" : "Hadisə"}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {ev.verify_mode} · #{ev.raw_event_no}
                      </p>
                    </div>
                    <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {fmt(ev.event_time)}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
