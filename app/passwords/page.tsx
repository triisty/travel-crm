"use client"
import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/lib/hooks/useUserRole"
import {
  Plus, X, Eye, EyeOff, Edit3, Trash2, Copy, Search,
  Lock, Globe, Smartphone, Share2, Key, Users, ChevronDown,
  CheckCircle2, AlertCircle, UserPlus, Mail, Shield
} from "lucide-react"

const card = { background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "16px" }
const modalCard = { background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "20px" }
const inp = { background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)", borderRadius: "10px", padding: "9px 13px", fontSize: "13px", outline: "none", width: "100%" }

const CATEGORIES = [
  { value: "social",  label: "Sosial media",  icon: Share2,     color: "#6366f1" },
  { value: "website", label: "Sayt",           icon: Globe,      color: "#2bb5a0" },
  { value: "app",     label: "Tətbiq",         icon: Smartphone, color: "#f59e0b" },
  { value: "email",   label: "Email",          icon: Mail,       color: "#e84545" },
  { value: "other",   label: "Digər",          icon: Key,        color: "#94a3b8" },
]

const ROLES = [
  { value: "menecer",       label: "Menecer" },
  { value: "bilet_menecer", label: "Bilet Menecer" },
  { value: "muhasib",       label: "Mühasib" },
  { value: "direktor",      label: "Direktor" },
  { value: "boss",          label: "Boss" },
  { value: "tender_menecer",label: "Tender Menecer" },
  { value: "it_admin",      label: "IT Admin" },
]

function getCatInfo(cat: string) {
  return CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[4]
}

function copyToClipboard(text: string, setCopied: (v: string) => void, id: string) {
  navigator.clipboard.writeText(text)
  setCopied(id)
  setTimeout(() => setCopied(""), 2000)
}

// ── Password Card ─────────────────────────────────────────────
function PasswordCard({ item, onEdit, onDelete, canEdit }: any) {
  const [showPwd, setShowPwd] = useState(false)
  const [copied, setCopied] = useState("")
  const cat = getCatInfo(item.category)
  const Icon = cat.icon

  return (
    <div className="p-4 rounded-2xl group transition-all hover:shadow-md"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: cat.color + "18" }}>
          <Icon size={15} style={{ color: cat.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{item.title}</p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: cat.color + "15", color: cat.color }}>{cat.label}</span>
          </div>
          {item.url && (
            <a href={item.url.startsWith("http") ? item.url : "https://" + item.url}
              target="_blank" rel="noopener noreferrer"
              className="text-xs truncate block hover:underline mt-0.5"
              style={{ color: "var(--text-muted)" }}>{item.url}</a>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {/* Login */}
        {item.login && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
            <Mail size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <span className="text-xs flex-1 truncate" style={{ color: "var(--text-secondary)" }}>{item.login}</span>
            <button onClick={() => copyToClipboard(item.login, setCopied, "l-" + item.id)}
              className="flex-shrink-0 transition-all hover:scale-110"
              style={{ color: copied === "l-" + item.id ? "#22c55e" : "var(--text-muted)" }}>
              {copied === "l-" + item.id ? <CheckCircle2 size={12} /> : <Copy size={12} />}
            </button>
          </div>
        )}
        {/* Password */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
          <Lock size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <span className="text-xs flex-1 font-mono truncate" style={{ color: "var(--text-secondary)", letterSpacing: showPwd ? "normal" : "0.15em" }}>
            {showPwd ? item.password : "••••••••"}
          </span>
          <button onClick={() => setShowPwd(v => !v)} className="flex-shrink-0" style={{ color: "var(--text-muted)" }}>
            {showPwd ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
          <button onClick={() => copyToClipboard(item.password, setCopied, "p-" + item.id)}
            className="flex-shrink-0 transition-all hover:scale-110"
            style={{ color: copied === "p-" + item.id ? "#22c55e" : "var(--text-muted)" }}>
            {copied === "p-" + item.id ? <CheckCircle2 size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      {item.notes && (
        <p className="text-xs mt-2 px-1" style={{ color: "var(--text-muted)" }}>{item.notes}</p>
      )}

      {canEdit && (
        <div className="flex gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition-all">
          <button onClick={() => onEdit(item)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:scale-105 flex-1 justify-center"
            style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
            <Edit3 size={11} />Düzəlt
          </button>
          <button onClick={() => onDelete(item.id)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:scale-105"
            style={{ background: "rgba(232,69,69,0.08)", color: "#e84545" }}>
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function PasswordsPage() {
  const { profile } = useUserRole()
  const [tab, setTab] = useState<"passwords" | "users">("passwords")
  const [passwords, setPasswords] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterCat, setFilterCat] = useState("all")
  const [modal, setModal] = useState(false)
  const [userModal, setUserModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState("")
  const [showPwds, setShowPwds] = useState<Record<string, boolean>>({})

  // Password form
  const [form, setForm] = useState({ title: "", category: "social", login: "", password: "", url: "", notes: "" })
  const [showFormPwd, setShowFormPwd] = useState(false)

  // User form
  const [userForm, setUserForm] = useState({ email: "", password: "", fullName: "", role: "menecer", phone: "" })
  const [userError, setUserError] = useState("")
  const [userSuccess, setUserSuccess] = useState("")
  const [creatingUser, setCreatingUser] = useState(false)

  const canAccess = ["it_admin", "direktor"].includes(profile?.role ?? "")
  const canEdit   = profile?.role === "it_admin"

  useEffect(() => { if (canAccess) { fetchPasswords(); fetchUsers() } }, [canAccess])

  async function fetchPasswords() {
    setLoading(true)
    const { data } = await supabase.from("passwords").select("*").order("created_at", { ascending: false })
    setPasswords(data ?? [])
    setLoading(false)
  }

  async function fetchUsers() {
    const { data } = await supabase.from("user_profiles").select("*").order("created_at", { ascending: false })
    setUsers(data ?? [])
  }

  function openCreate() {
    setEditItem(null)
    setForm({ title: "", category: "social", login: "", password: "", url: "", notes: "" })
    setShowFormPwd(false)
    setModal(true)
  }

  function openEdit(item: any) {
    setEditItem(item)
    setForm({ title: item.title, category: item.category, login: item.login ?? "", password: item.password, url: item.url ?? "", notes: item.notes ?? "" })
    setShowFormPwd(false)
    setModal(true)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.password.trim()) return
    setSaving(true)
    const payload = { ...form, updated_at: new Date().toISOString() }
    if (editItem) {
      await supabase.from("passwords").update(payload).eq("id", editItem.id)
    } else {
      await supabase.from("passwords").insert({ ...payload, created_by: profile?.fullName ?? "" })
    }
    setSaving(false); setModal(false); fetchPasswords()
  }

  async function handleDelete(id: string) {
    if (!confirm("Silinsin?")) return
    await supabase.from("passwords").delete().eq("id", id); fetchPasswords()
  }

  async function handleCreateUser() {
    setUserError(""); setUserSuccess(""); setCreatingUser(true)
    if (!userForm.email || !userForm.password || !userForm.fullName) {
      setUserError("Bütün məcburi sahələri doldurun"); setCreatingUser(false); return
    }
    try {
      // Create auth user via admin API
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userForm.email,
        password: userForm.password,
        email_confirm: true,
      })
      if (authError) throw authError
      if (authData?.user) {
        await supabase.from("user_profiles").upsert({
          id: authData.user.id,
          full_name: userForm.fullName,
          role: userForm.role,
          email: userForm.email,
          phone: userForm.phone,
        })
        setUserSuccess(`✅ İstifadəçi yaradıldı: ${userForm.email}`)
        setUserForm({ email: "", password: "", fullName: "", role: "menecer", phone: "" })
        fetchUsers()
      }
    } catch (e: any) {
      setUserError("Xəta: " + (e.message ?? "Naməlum xəta"))
    }
    setCreatingUser(false)
  }

  async function handleDeleteUser(id: string, email: string) {
    if (!confirm(`"${email}" silinsin?`)) return
    await supabase.from("user_profiles").delete().eq("id", id)
    fetchUsers()
  }

  async function handleUpdateUserRole(id: string, role: string) {
    await supabase.from("user_profiles").update({ role }).eq("id", id)
    fetchUsers()
  }

  const filtered = useMemo(() => passwords.filter(p => {
    if (filterCat !== "all" && p.category !== filterCat) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(p.title ?? "").toLowerCase().includes(q) && !(p.login ?? "").toLowerCase().includes(q) && !(p.url ?? "").toLowerCase().includes(q)) return false
    }
    return true
  }), [passwords, filterCat, search])

  if (!profile) return null
  if (!canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="text-center p-8">
          <Shield size={40} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Giriş qadağandır</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Bu bölməyə giriş icazəniz yoxdur</p>
        </div>
      </div>
    )
  }

  const ROLE_COLORS: Record<string,string> = {
    it_admin:"#e84545", boss:"#e84545", direktor:"#4a90d9",
    muhasib:"#2bb5a0", menecer:"#f59e0b", bilet_menecer:"#7c5cbf",
    tender_menecer:"#2bb5a0",
  }

  return (
    <div className="min-h-screen p-5 md:p-6" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
            {tab === "passwords" ? "Parollar" : "İstifadəçilər"}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {tab === "passwords" ? "Giriş məlumatları" : "Sistem istifadəçilərini idarə et"}
          </p>
        </div>
        {tab === "passwords" && canEdit && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg,#e84545,#f06060)", boxShadow: "0 4px 16px rgba(232,69,69,0.3)" }}>
            <Plus size={14} />Yeni parol
          </button>
        )}
        {tab === "users" && canEdit && (
          <button onClick={() => { setUserModal(true); setUserError(""); setUserSuccess("") }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>
            <UserPlus size={14} />Yeni istifadəçi
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-5 w-fit"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        {[
          { key: "passwords", label: "🔑 Parollar", count: passwords.length },
          { key: "users",     label: "👥 İstifadəçilər", count: users.length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: tab === t.key ? "var(--accent)" : "transparent",
              color: tab === t.key ? "white" : "var(--text-secondary)",
            }}>
            {t.label}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: tab === t.key ? "rgba(255,255,255,0.2)" : "var(--bg-primary)", color: tab === t.key ? "white" : "var(--text-muted)" }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── PASSWORDS TAB ── */}
      {tab === "passwords" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-[200px]"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <Search size={13} style={{ color: "var(--text-muted)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Axtar..."
                className="bg-transparent text-sm outline-none w-full" style={{ color: "var(--text-primary)" }} />
              {search && <button onClick={() => setSearch("")}><X size={12} style={{ color: "var(--text-muted)" }} /></button>}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setFilterCat("all")}
                className="text-xs font-semibold px-3 py-2 rounded-xl transition-all"
                style={{ background: filterCat === "all" ? "var(--accent)" : "var(--bg-card)", color: filterCat === "all" ? "white" : "var(--text-secondary)", border: "1px solid " + (filterCat === "all" ? "transparent" : "var(--border-color)") }}>
                Hamısı
              </button>
              {CATEGORIES.map(c => (
                <button key={c.value} onClick={() => setFilterCat(c.value)}
                  className="text-xs font-semibold px-3 py-2 rounded-xl transition-all"
                  style={{ background: filterCat === c.value ? c.color : "var(--bg-card)", color: filterCat === c.value ? "white" : "var(--text-secondary)", border: "1px solid " + (filterCat === c.value ? "transparent" : "var(--border-color)") }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3" style={{ ...card, padding: 40 }}>
              <Lock size={36} style={{ color: "var(--text-muted)" }} />
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                {search || filterCat !== "all" ? "Nəticə tapılmadı" : "Hələ parol yoxdur"}
              </p>
              {canEdit && !search && filterCat === "all" && (
                <button onClick={openCreate}
                  className="text-sm font-semibold px-4 py-2 rounded-xl text-white mt-1"
                  style={{ background: "var(--accent)" }}>
                  + Yeni parol əlavə et
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(item => (
                <PasswordCard key={item.id} item={item} onEdit={openEdit} onDelete={handleDelete} canEdit={canEdit} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── USERS TAB ── */}
      {tab === "users" && (
        <div className="rounded-2xl overflow-hidden" style={card}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--bg-primary)", borderBottom: "1px solid var(--border-color)" }}>
                {["Ad Soyad", "Email", "Rol", "Telefon", ""].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider px-4 py-3"
                    style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const rc = ROLE_COLORS[u.role] ?? "#94a3b8"
                const rl = ROLES.find(r => r.value === u.role)?.label ?? u.role
                return (
                  <tr key={u.id} className="group transition-all" style={{ borderBottom: "1px solid var(--border-color)" }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: rc }}>
                          {u.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                        <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{u.full_name ?? "—"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{u.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <select value={u.role} onChange={e => handleUpdateUserRole(u.id, e.target.value)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg outline-none cursor-pointer"
                          style={{ background: rc + "15", color: rc, border: "1px solid " + rc + "30" }}>
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                          style={{ background: rc + "15", color: rc }}>
                          {rl}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{u.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      {canEdit && u.role !== "it_admin" && (
                        <button onClick={() => handleDeleteUser(u.id, u.email)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all hover:scale-110"
                          style={{ color: "#e84545", background: "rgba(232,69,69,0.1)" }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Password Modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" style={{ backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-md p-6" style={modalCard}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                {editItem ? "Parolu düzəlt" : "Yeni parol"}
              </h2>
              <button onClick={() => setModal(false)} style={{ color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold mb-1 block uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Ad *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Məsələn: Instagram Business" style={inp} />
              </div>
              <div>
                <label className="text-[11px] font-semibold mb-1 block uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Kateqoriya</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(c => {
                    const Icon = c.icon
                    return (
                      <button key={c.value} onClick={() => setForm(f => ({ ...f, category: c.value }))}
                        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
                        style={{ background: form.category === c.value ? c.color : "var(--bg-glass)", color: form.category === c.value ? "white" : "var(--text-secondary)", border: "1px solid " + (form.category === c.value ? "transparent" : "var(--border-color)") }}>
                        <Icon size={11} />{c.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold mb-1 block uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>URL / Sayt</label>
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="instagram.com" style={inp} />
              </div>
              <div>
                <label className="text-[11px] font-semibold mb-1 block uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Login / Email</label>
                <input value={form.login} onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
                  placeholder="info@itstour.az" style={inp} />
              </div>
              <div>
                <label className="text-[11px] font-semibold mb-1 block uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Parol *</label>
                <div className="relative">
                  <input type={showFormPwd ? "text" : "password"} value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••" style={{ ...inp, paddingRight: 36 }} />
                  <button type="button" onClick={() => setShowFormPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }}>
                    {showFormPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold mb-1 block uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Qeyd</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Əlavə məlumat..." style={{ ...inp, resize: "none" }} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} disabled={saving || !form.title.trim() || !form.password.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--accent)" }}>
                {saving ? "Saxlanılır..." : editItem ? "Yadda saxla" : "Əlavə et"}
              </button>
              <button onClick={() => setModal(false)}
                className="px-5 py-2.5 rounded-xl text-sm"
                style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                Ləğv
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create User Modal ── */}
      {userModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" style={{ backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-md p-6" style={modalCard}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Yeni istifadəçi yarat</h2>
              <button onClick={() => setUserModal(false)} style={{ color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold mb-1 block uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Ad Soyad *</label>
                <input value={userForm.fullName} onChange={e => setUserForm(f => ({ ...f, fullName: e.target.value }))}
                  placeholder="Ad Soyad" style={inp} />
              </div>
              <div>
                <label className="text-[11px] font-semibold mb-1 block uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Email *</label>
                <input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="ad@itstour.az" style={inp} />
              </div>
              <div>
                <label className="text-[11px] font-semibold mb-1 block uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Şifrə *</label>
                <input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Minimum 6 simvol" style={inp} />
              </div>
              <div>
                <label className="text-[11px] font-semibold mb-1 block uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Telefon</label>
                <input value={userForm.phone} onChange={e => setUserForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+994..." style={inp} />
              </div>
              <div>
                <label className="text-[11px] font-semibold mb-1 block uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Rol *</label>
                <select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
                  style={inp}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>

            {userError && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(232,69,69,0.08)", border: "1px solid rgba(232,69,69,0.2)" }}>
                <AlertCircle size={13} style={{ color: "#e84545", flexShrink: 0 }} />
                <p className="text-xs" style={{ color: "#e84545" }}>{userError}</p>
              </div>
            )}
            {userSuccess && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(43,181,160,0.08)", border: "1px solid rgba(43,181,160,0.2)" }}>
                <CheckCircle2 size={13} style={{ color: "#2bb5a0", flexShrink: 0 }} />
                <p className="text-xs" style={{ color: "#2bb5a0" }}>{userSuccess}</p>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={handleCreateUser} disabled={creatingUser}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                {creatingUser ? "Yaradılır..." : "Yarat"}
              </button>
              <button onClick={() => setUserModal(false)}
                className="px-5 py-2.5 rounded-xl text-sm"
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
