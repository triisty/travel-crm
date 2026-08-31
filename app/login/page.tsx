"use client"
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import Image from "next/image"
import { Eye, EyeOff, ArrowRight, Plane, BarChart3, Users, Shield } from "lucide-react"

const FEATURES = [
  { icon: Plane,     label: "Uçuş və tur sifarişlərini idarə et" },
  { icon: BarChart3, label: "Real-time maliyyə hesabatları" },
  { icon: Users,     label: "Komanda üçün rol əsaslı giriş" },
  { icon: Shield,    label: "Məlumatlarınız tamamilə təhlükəsizdir" },
]

export default function LoginPage() {
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState("")
  const [showPwd, setShowPwd]   = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError("")
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError("Email və ya şifrə yanlışdır"); setLoading(false) }
    else window.location.href = "/"
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#f5f7fa" }}>

      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: "linear-gradient(145deg, #1a2332 0%, #0f1824 100%)" }}>

        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-5"
          style={{ background: "#e84545", transform: "translate(30%, -30%)" }} />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-5"
          style={{ background: "#2bb5a0", transform: "translate(-30%, 30%)" }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full opacity-5"
          style={{ background: "#4a90d9", transform: "translate(-50%,-50%)" }} />

        {/* Logo */}
        <div className="relative z-10">
          <Image src="/logo.png" alt="ITS Tour" width={130} height={44}
            style={{ objectFit: "contain", objectPosition: "left", filter: "brightness(0) invert(1)" }} />
        </div>

        {/* Main text */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
            style={{ background: "rgba(232,69,69,0.15)", border: "1px solid rgba(232,69,69,0.3)" }}>
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-xs font-semibold" style={{ color: "#e84545" }}>Canlı sistem</span>
          </div>
          <h1 className="font-black text-white mb-4 leading-tight" style={{ fontSize: 42, letterSpacing: "-1.5px" }}>
            Turizm biznesi<br />
            <span style={{ color: "#e84545" }}>üçün</span> CRM
          </h1>
          <p className="text-sm leading-relaxed mb-10" style={{ color: "rgba(255,255,255,0.45)", maxWidth: 360 }}>
            Sifarişlər, maliyyə, işçi idarəetməsi, hesabatlar — hamısı bir platformada. ITS Tour CRM ilə biznesinizi tam nəzarət altında saxlayın.
          </p>

          {/* Feature list */}
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(43,181,160,0.15)", border: "1px solid rgba(43,181,160,0.25)" }}>
                  <Icon size={13} style={{ color: "#2bb5a0" }} />
                </div>
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <a href="https://varktechnologies.netlify.app/" target="_blank" rel="noopener noreferrer"
            className="text-xs font-semibold tracking-widest uppercase transition-all hover:opacity-60"
            style={{ color: "rgba(255,255,255,0.2)", letterSpacing: "0.18em" }}>
            VARK TECHNOLOGIES
          </a>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Image src="/logo.png" alt="ITS Tour" width={110} height={36} style={{ objectFit: "contain", objectPosition: "left" }} />
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-black mb-1.5" style={{ color: "#1a2332", letterSpacing: "-0.5px" }}>
              Xoş gəldiniz
            </h2>
            <p className="text-sm" style={{ color: "#6b7a8d" }}>
              Hesabınıza daxil olmaq üçün məlumatlarınızı daxil edin
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                style={{ color: "#6b7a8d" }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="siz@itstour.az"
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: 10,
                  border: "1.5px solid #e8ecf0", background: "#fff",
                  color: "#1a2332", fontSize: 14, outline: "none",
                  transition: "border-color 0.15s ease",
                }}
                onFocus={e => e.target.style.borderColor = "#e84545"}
                onBlur={e => e.target.style.borderColor = "#e8ecf0"} />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                style={{ color: "#6b7a8d" }}>Şifrə</label>
              <div className="relative">
                <input type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  required placeholder="••••••••"
                  style={{
                    width: "100%", padding: "11px 44px 11px 14px", borderRadius: 10,
                    border: "1.5px solid #e8ecf0", background: "#fff",
                    color: "#1a2332", fontSize: 14, outline: "none",
                    letterSpacing: showPwd ? "normal" : "0.15em",
                    transition: "border-color 0.15s ease",
                  }}
                  onFocus={e => e.target.style.borderColor = "#e84545"}
                  onBlur={e => e.target.style.borderColor = "#e8ecf0"} />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#9aa5b4", padding: 4 }}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
                style={{ background: "rgba(232,69,69,0.06)", border: "1px solid rgba(232,69,69,0.2)" }}>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#e84545" }} />
                <p className="text-sm" style={{ color: "#e84545" }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #e84545, #f06060)",
                boxShadow: "0 4px 16px rgba(232,69,69,0.3)",
                marginTop: 8
              }}
              onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(232,69,69,0.4)" }}}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(232,69,69,0.3)" }}>
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Yoxlanılır...</span></>
              ) : (
                <><span>Daxil ol</span><ArrowRight size={15} /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "#e8ecf0" }} />
            <span className="text-xs" style={{ color: "#9aa5b4" }}>itstour CRM</span>
            <div className="flex-1 h-px" style={{ background: "#e8ecf0" }} />
          </div>

          {/* Register link */}
          <a href="/register"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: "#f5f7fa", border: "1.5px solid #e8ecf0", color: "#6b7a8d" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "#d0d8e4"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "#e8ecf0"}>
            Yeni işçi qeydiyyatı
          </a>

          {/* Bottom credit */}
          <p className="text-center text-xs mt-6" style={{ color: "#9aa5b4" }}>
            Powered by{" "}
            <a href="https://varktechnologies.netlify.app/" target="_blank" rel="noopener noreferrer"
              className="font-semibold transition-all hover:opacity-70"
              style={{ color: "#6b7a8d" }}>
              VARK TECHNOLOGIES
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
