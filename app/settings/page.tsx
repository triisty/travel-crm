"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Camera, Save, Eye, EyeOff, Power, PowerOff } from "lucide-react"

const card = { background: "var(--bg-card)", border: "1px solid var(--border-color)", backdropFilter: "blur(20px)", borderRadius: "24px" }
const inputStyle = { background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)", borderRadius: "12px", padding: "10px 16px", fontSize: "14px", outline: "none", width: "100%" }

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [position, setPosition] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [passwordMessage, setPasswordMessage] = useState("")
  const [ready, setReady] = useState(false)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceLoading, setMaintenanceLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setReady(true); return }
      const { data } = await supabase.from("user_profiles").select("*").eq("id", user.id).single()
      if (data) { setProfile(data); setFullName(data.full_name ?? ""); setPhone(data.phone ?? ""); setPosition(data.position ?? ""); setAvatarUrl(data.avatar_url ?? "") }
      // Load maintenance mode
      const { data: setting } = await supabase.from("system_settings").select("value").eq("key", "maintenance_mode").single()
      if (setting) setMaintenanceMode(setting.value === "true")
      setReady(true)
    }
    load()
  }, [])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return
    const ext = file.name.split('.').pop()
    const path = `avatars/${user.id}.${ext}`
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true })
    if (error) { setMessage("Şəkil yüklənmədi: " + error.message); return }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path)
    setAvatarUrl(publicUrl); setMessage("✅ Şəkil yükləndi!")
  }

  async function toggleMaintenance() {
    if (!confirm(maintenanceMode ? "Sistemi işə salmaq istəyirsiniz?" : "Sistemi dayandırmaq istəyirsiniz? Bütün istifadəçilər çıxarılacaq.")) return
    setMaintenanceLoading(true)
    const newVal = !maintenanceMode
    await supabase.from("system_settings").update({ value: String(newVal), updated_at: new Date().toISOString() }).eq("key", "maintenance_mode")
    setMaintenanceMode(newVal)
    setMaintenanceLoading(false)
  }

  async function handleSaveProfile() {
    setLoading(true); setMessage("")
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return
    const { error } = await supabase.from("user_profiles").update({ full_name: fullName, phone, position, avatar_url: avatarUrl }).eq("id", user.id)
    if (error) setMessage("Xəta: " + error.message)
    else setMessage("✅ Profil yeniləndi!")
    setLoading(false)
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) { setPasswordMessage("Şifrələr uyğun gəlmir!"); return }
    if (newPassword.length < 6) { setPasswordMessage("Şifrə ən az 6 simvol olmalıdır!"); return }
    setPasswordLoading(true); setPasswordMessage("")
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setPasswordMessage("Xəta: " + error.message)
    else { setPasswordMessage("✅ Şifrə dəyişdirildi!"); setNewPassword(""); setConfirmPassword("") }
    setPasswordLoading(false)
  }

  if (!ready) return null

  return (
    <div className="min-h-screen p-5 md:p-7" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-7"><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Profil Ayarları</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Hesab məlumatlarınızı idarə edin</p></div>

        {/* Avatar */}
        <div className="p-6 mb-4" style={card}>
          <h2 className="text-base font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Profil Şəkli</h2>
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl overflow-hidden flex items-center justify-center text-white text-2xl font-bold" style={{ background: "linear-gradient(135deg, #ef4444, #f97316)" }}>
                {avatarUrl ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : <span>{fullName?.[0] ?? "?"}</span>}
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                <Camera size={14} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fullName || "Ad yoxdur"}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{profile?.email}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>JPG, PNG — maks 2MB</p>
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <div className="p-6 mb-4" style={card}>
          <h2 className="text-base font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Şəxsi Məlumatlar</h2>
          <div className="space-y-4">
            {[{ label: "Ad Soyad", value: fullName, onChange: setFullName, placeholder: "Adınızı daxil edin" }, { label: "Telefon", value: phone, onChange: setPhone, placeholder: "+994 XX XXX XX XX" }, { label: "Vəzifə", value: position, onChange: setPosition, placeholder: "Məsələn: Menecer" }].map(({ label, value, onChange, placeholder }) => (
              <div key={label}>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>{label}</label>
                <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Email</label>
              <input value={profile?.email ?? ""} disabled style={{ ...inputStyle, opacity: 0.5, cursor: "not-allowed" }} />
            </div>
          </div>
          {message && <p className={`mt-3 text-sm ${message.startsWith("✅") ? "text-green-500" : "text-red-500"}`}>{message}</p>}
          <button onClick={handleSaveProfile} disabled={loading} className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-medium text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg, #ef4444, #f97316)" }}>
            <Save size={16} />{loading ? "Yadda saxlanır..." : "Yadda saxla"}
          </button>
        </div>

        {/* Change Password */}
        <div className="p-6 mb-4" style={card}>
          <h2 className="text-base font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Şifrəni Dəyiş</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Yeni Şifrə</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Yeni şifrə" style={{ ...inputStyle, paddingRight: "40px" }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Şifrəni Təsdiq Et</label>
              <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Şifrəni təkrarlayın" style={inputStyle} />
            </div>
          </div>
          {passwordMessage && <p className={`mt-3 text-sm ${passwordMessage.startsWith("✅") ? "text-green-500" : "text-red-500"}`}>{passwordMessage}</p>}
          <button onClick={handleChangePassword} disabled={passwordLoading || !newPassword || !confirmPassword} className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-medium text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            <Save size={16} />{passwordLoading ? "Dəyişdirilir..." : "Şifrəni dəyiş"}
          </button>
        </div>

        {/* Maintenance Mode — only for it_admin */}
        {profile?.role === "it_admin" && (
          <div className="p-6" style={{ ...card, border: maintenanceMode ? "1px solid rgba(239,68,68,0.3)" : "1px solid var(--border-color)" }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  Sistem İdarəetməsi
                </h2>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {maintenanceMode
                    ? "🔴 Sistem hal-hazırda dayandırılıb. Yalnız siz daxil ola bilərsiniz."
                    : "🟢 Sistem aktiv vəziyyətdədir. Bütün istifadəçilər daxil ola bilər."}
                </p>
              </div>
              <button onClick={toggleMaintenance} disabled={maintenanceLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95"
                style={{
                  background: maintenanceMode
                    ? "linear-gradient(135deg,#22c55e,#16a34a)"
                    : "linear-gradient(135deg,#ef4444,#dc2626)",
                  boxShadow: maintenanceMode
                    ? "0 4px 16px rgba(34,197,94,0.3)"
                    : "0 4px 16px rgba(239,68,68,0.3)"
                }}>
                {maintenanceLoading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : maintenanceMode ? (
                  <><Power size={15} />Sistemi işə sal</>
                ) : (
                  <><PowerOff size={15} />Sistemi dayandır</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
