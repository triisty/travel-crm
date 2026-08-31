"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import Image from "next/image"
import { Eye, EyeOff, Mail, Lock, ArrowRight, Shield, Zap, Globe } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState<"email"|"password"|null>(null)
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError("Email və ya şifrə yanlışdır")
      setLoading(false)
    } else {
      window.location.href = "/"
    }
  }

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: "#060912" }}>
      <style>{`
        @keyframes float1 { 0%,100%{transform:translate(-30%,-30%) scale(1)} 50%{transform:translate(-25%,-35%) scale(1.05)} }
        @keyframes float2 { 0%,100%{transform:translate(30%,30%) scale(1)} 50%{transform:translate(25%,35%) scale(1.08)} }
        @keyframes float3 { 0%,100%{transform:translate(-50%,-50%) scale(1)} 50%{transform:translate(-48%,-52%) scale(1.04)} }
        @keyframes gridFade { from{opacity:0} to{opacity:1} }
        @keyframes slideIn { from{transform:translateX(-32px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes slideUp { from{transform:translateY(24px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes scanLine { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .input-field::placeholder { color: rgba(255,255,255,0.2); }
        .input-field:focus { outline: none; }
      `}</style>

      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden">

        {/* Animated background orbs */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#0d0d1a 0%,#0a0f1e 100%)" }} />
        <div className="absolute w-[600px] h-[600px] rounded-full" style={{ background:"radial-gradient(circle,rgba(239,68,68,0.15) 0%,transparent 70%)", top:"-10%", left:"-10%", animation:"float1 8s ease-in-out infinite" }} />
        <div className="absolute w-[500px] h-[500px] rounded-full" style={{ background:"radial-gradient(circle,rgba(59,130,246,0.12) 0%,transparent 70%)", bottom:"-10%", right:"-10%", animation:"float2 10s ease-in-out infinite" }} />
        <div className="absolute w-[400px] h-[400px] rounded-full" style={{ background:"radial-gradient(circle,rgba(99,102,241,0.1) 0%,transparent 70%)", top:"50%", left:"50%", animation:"float3 12s ease-in-out infinite" }} />

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.008]" style={{
         backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
          animation: "gridFade 1s ease 0.1s both"
        }} />

        {/* Scan line */}
        <div className="absolute left-0 right-0 h-px opacity-10 pointer-events-none"
          style={{ background:"linear-gradient(90deg,transparent,rgba(239,68,68,0.8),transparent)", animation:"scanLine 6s linear infinite" }} />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-red-500" style={{ animation:"blink 2s ease infinite" }} />
            <span className="text-xs font-bold tracking-[0.3em] uppercase" style={{ color:"rgba(255,255,255,0.3)" }}>LIVE SYSTEM</span>
          </div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <div style={{ animation:"slideIn 0.6s cubic-bezier(0.34,1.56,0.64,1)" }}>
            <h1 className="font-black text-white mb-4" style={{ fontSize:52, lineHeight:1.05, letterSpacing:"-2px" }}>
              its<span style={{ color:"#ef4444" }}>tour</span>
              <br/>
              <span style={{ fontSize:28, fontWeight:300, letterSpacing:"-0.5px", color:"rgba(255,255,255,0.4)" }}>CRM Platform</span>
            </h1>
            <p className="text-sm leading-relaxed mb-10" style={{ color:"rgba(255,255,255,0.35)", maxWidth:340 }}>
              Müasir turizm agentliyi üçün nəzərdə tutulmuş idarəetmə sistemi. Sifarişlər, maliyyə, hesabatlar — hamısı bir yerdə.
            </p>
          </div>

          {/* Feature pills */}
          <div className="space-y-3" style={{ animation:"slideUp 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.1s both" }}>
            {[
              { icon: Zap, label:"Real-time məlumatlar", color:"#f59e0b" },
              { icon: Shield, label:"Rol əsaslı giriş", color:"#22c55e" },
              { icon: Globe, label:"Hər cihazdan əlçatan", color:"#3b82f6" },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:`${color}18` }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <span className="text-sm font-medium" style={{ color:"rgba(255,255,255,0.5)" }}>{label}</span>
                <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background:color }} />
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <a href="https://varktechnologies.netlify.app/" target="_blank" rel="noopener noreferrer"
            className="text-xs font-bold tracking-widest uppercase transition-all hover:opacity-70"
            style={{ color:"rgba(255,255,255,0.2)", letterSpacing:"0.2em" }}>
            VARK TECHNOLOGIES
          </a>
        </div>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative"
        style={{ background:"#080b14" }}>

        {/* Subtle background */}
        <div className="absolute inset-0" style={{ background:"radial-gradient(ellipse 60% 50% at 50% 50%,rgba(99,102,241,0.06) 0%,transparent 100%)" }} />

        <div className="relative w-full max-w-[400px]" style={{ animation: "slideUp 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <span className="text-2xl font-black text-white">its<span style={{ color:"#ef4444" }}>tour</span></span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:"linear-gradient(135deg,#ef4444,#f97316)" }}>
                <Lock size={14} color="white" />
              </div>
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color:"rgba(255,255,255,0.3)" }}>Təhlükəsiz giriş</span>
            </div>
            <h2 className="text-3xl font-black text-white mb-2" style={{ letterSpacing:"-0.5px" }}>
              Xoş gəldiniz
            </h2>
            <p className="text-sm" style={{ color:"rgba(255,255,255,0.35)" }}>
              Hesabınıza daxil olmaq üçün məlumatlarınızı daxil edin
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-xs font-bold mb-2 tracking-wider uppercase" style={{ color:"rgba(255,255,255,0.4)" }}>
                Email ünvanı
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Mail size={16} style={{ color: focused==="email" ? "#ef4444" : "rgba(255,255,255,0.25)", transition:"color 0.2s" }} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                  required
                  placeholder="admin@itstour.az"
                  className="input-field w-full pl-11 pr-4 py-4 text-sm rounded-2xl text-white transition-all"
                  style={{
                    background: focused==="email" ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)",
                    border: `1.5px solid ${focused==="email" ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.08)"}`,
                    transition:"all 0.2s ease",
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold mb-2 tracking-wider uppercase" style={{ color:"rgba(255,255,255,0.4)" }}>
                Şifrə
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Lock size={16} style={{ color: focused==="password" ? "#ef4444" : "rgba(255,255,255,0.25)", transition:"color 0.2s" }} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  required
                  placeholder="••••••••••"
                  className="input-field w-full pl-11 pr-12 py-4 text-sm rounded-2xl text-white transition-all"
                  style={{
                    background: focused==="password" ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)",
                    border: `1.5px solid ${focused==="password" ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.08)"}`,
                    transition:"all 0.2s ease",
                    letterSpacing: showPassword ? "normal" : "0.2em",
                  }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-all hover:opacity-80"
                  style={{ color:"rgba(255,255,255,0.3)" }}>
                  {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background:"rgba(239,68,68,0.1)", border:"1.5px solid rgba(239,68,68,0.25)" }}>
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                <p className="text-sm" style={{ color:"rgba(239,100,100,1)" }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-sm text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2.5 mt-2"
              style={{
                background: loading ? "rgba(239,68,68,0.4)" : "linear-gradient(135deg,#ef4444 0%,#f97316 100%)",
                boxShadow: loading ? "none" : "0 8px 32px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
                transform: loading ? "scale(0.99)" : "scale(1)",
                transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
              }}
              onMouseEnter={e => { if(!loading) (e.currentTarget as HTMLElement).style.transform="scale(1.015)" }}
              onMouseLeave={e => { if(!loading) (e.currentTarget as HTMLElement).style.transform="scale(1)" }}>
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor:"rgba(255,255,255,0.3)", borderTopColor:"white" }} />
                  <span>Yoxlanılır...</span>
                </>
              ) : (
                <>
                  <span>Daxil ol</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 mt-6 mb-4">
            <div className="flex-1 h-px" style={{ background:"rgba(255,255,255,0.06)" }} />
            <span className="text-xs" style={{ color:"rgba(255,255,255,0.2)" }}>itstour CRM v2.0</span>
            <div className="flex-1 h-px" style={{ background:"rgba(255,255,255,0.06)" }} />
          </div>
<a href="/register"
  className="block text-center py-3 rounded-2xl text-sm font-semibold mt-4 transition-all hover:scale-[1.01]"
  style={{ background:"rgba(255,255,255,0.04)", border:"1.5px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.5)" }}>
  Yeni işçi qeydiyyatı →
</a>
          {/* Footer */}
          <p className="text-center text-xs" style={{ color:"rgba(255,255,255,0.15)" }}>
            Powered by{" "}
            <a href="https://varktechnologies.netlify.app/" target="_blank" rel="noopener noreferrer"
              className="font-bold transition-all hover:opacity-60"
              style={{ color:"rgba(255,255,255,0.3)" }}>
              VARK TECHNOLOGIES
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}