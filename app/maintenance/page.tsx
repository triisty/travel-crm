"use client"
import { useEffect, useState } from "react"
import Link from "next/link"

export default function MaintenancePage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0a0f1e 0%, #0d1533 50%, #0a0f1e 100%)", zIndex: 9999 }}>
      <style>{`
        @keyframes earthSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orbitPlane {
          from { transform: rotate(0deg) translateX(140px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(140px) rotate(-360deg); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 40px rgba(56,130,246,0.3), 0 0 80px rgba(56,130,246,0.1); }
          50% { box-shadow: 0 0 60px rgba(56,130,246,0.5), 0 0 120px rgba(56,130,246,0.2); }
        }
        .earth-container {
          animation: float 6s ease-in-out infinite;
        }
        .earth-glow {
          animation: pulseGlow 4s ease-in-out infinite;
        }
        .plane-orbit {
          animation: orbitPlane 8s linear infinite;
        }
        .star { animation: twinkle var(--d, 3s) ease-in-out infinite; animation-delay: var(--delay, 0s); }
        .text-anim-1 { animation: fadeInUp 0.6s ease 0.1s both; }
        .text-anim-2 { animation: fadeInUp 0.6s ease 0.25s both; }
        .text-anim-3 { animation: fadeInUp 0.6s ease 0.4s both; }
        .text-anim-4 { animation: fadeInUp 0.6s ease 0.55s both; }
      `}</style>

      {/* Stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {mounted && Array.from({ length: 80 }).map((_, i) => (
          <div key={i} className="star absolute rounded-full bg-white"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 2 + 1}px`,
              height: `${Math.random() * 2 + 1}px`,
              opacity: Math.random() * 0.5 + 0.2,
              "--d": `${Math.random() * 3 + 2}s`,
              "--delay": `${Math.random() * 3}s`,
            } as any}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">

        {/* Logo */}
        <div className="text-anim-1 mb-10 flex items-center gap-2">
          <span className="text-xl font-black" style={{ background: "linear-gradient(135deg,#ef4444,#f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>its</span>
          <span className="text-xl font-black text-white">tour</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full ml-1" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>CRM</span>
        </div>

        {/* Text */}
        <div className="text-anim-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#60a5fa", letterSpacing: "0.2em" }}>Texniki xidmət</span>
        </div>
        <h1 className="text-anim-3 text-4xl md:text-5xl font-black text-white mb-3" style={{ letterSpacing: "-0.02em" }}>
          Üzr istəyirik
        </h1>
        <p className="text-anim-3 text-base mb-2" style={{ color: "rgba(255,255,255,0.7)" }}>
          Texniki işlər aparılır
        </p>
        <p className="text-anim-3 text-sm mb-8 max-w-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
          Sistemi daha sürətli etmək üçün müvəqqəti yeniləmə aparırıq. Zəhmət olmasa, bir az sonra yenidən cəhd edin.
        </p>

        {/* Button */}
        <div className="text-anim-4 mb-12">
          <Link href="/login"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 4px 24px rgba(99,102,241,0.4)" }}>
            Giriş səhifəsinə qayıt
          </Link>
        </div>

        {/* Earth + Plane */}
        <div className="text-anim-4 earth-container relative" style={{ width: 280, height: 280 }}>
          {/* Orbit ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div style={{
              width: 280, height: 280,
              borderRadius: "50%",
              border: "1px dashed rgba(99,130,246,0.25)",
            }} />
          </div>

          {/* Earth */}
          <div className="absolute earth-glow" style={{ left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 160, height: 160, borderRadius: "50%", overflow: "hidden" }}>
            {/* Ocean */}
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #1e40af, #1d4ed8 40%, #1e3a6e 70%, #0f2048 100%)" }} />

            {/* Continents via SVG */}
            <svg viewBox="0 0 160 160" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
              <defs>
                <clipPath id="earthClip">
                  <circle cx="80" cy="80" r="80" />
                </clipPath>
                <radialGradient id="lightGrad" cx="35%" cy="35%" r="60%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.15" />
                  <stop offset="70%" stopColor="white" stopOpacity="0.02" />
                  <stop offset="100%" stopColor="#000020" stopOpacity="0.5" />
                </radialGradient>
                <linearGradient id="atmGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g clipPath="url(#earthClip)">
                {/* Animated continent group */}
                <animateTransform attributeName="transform" type="rotate" values="0 80 80;360 80 80" dur="20s" repeatCount="indefinite" />
                {/* Europe */}
                <ellipse cx="88" cy="52" rx="12" ry="16" fill="#22c55e" opacity="0.85" />
                {/* Africa */}
                <ellipse cx="90" cy="82" rx="13" ry="22" fill="#16a34a" opacity="0.85" />
                {/* Americas */}
                <ellipse cx="44" cy="58" rx="11" ry="20" fill="#22c55e" opacity="0.85" />
                <ellipse cx="48" cy="90" rx="10" ry="24" fill="#15803d" opacity="0.85" />
                {/* Asia */}
                <ellipse cx="118" cy="50" rx="22" ry="18" fill="#22c55e" opacity="0.85" />
                {/* Australia */}
                <ellipse cx="122" cy="100" rx="11" ry="8" fill="#16a34a" opacity="0.8" />
                {/* Greenland */}
                <ellipse cx="68" cy="30" rx="7" ry="5" fill="#4ade80" opacity="0.7" />
              </g>
              {/* Light overlay */}
              <circle cx="80" cy="80" r="80" fill="url(#lightGrad)" />
              {/* Atmosphere rim */}
              <circle cx="80" cy="80" r="79" fill="none" stroke="#60a5fa" strokeWidth="3" strokeOpacity="0.2" />
            </svg>
          </div>

          {/* Atmosphere glow */}
          <div className="absolute" style={{
            left: "50%", top: "50%",
            transform: "translate(-50%,-50%)",
            width: 190, height: 190,
            borderRadius: "50%",
            background: "radial-gradient(circle, transparent 40%, rgba(56,130,246,0.12) 70%, rgba(56,130,246,0.0) 100%)",
            pointerEvents: "none"
          }} />

          {/* Orbiting Plane */}
          <div className="absolute" style={{ left: "50%", top: "50%", width: 0, height: 0 }}>
            <div className="plane-orbit" style={{ position: "absolute", left: 0, top: 0 }}>
              <svg width="40" height="20" viewBox="0 0 40 20" style={{ transform: "translate(-20px,-10px)", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}>
                {/* Fuselage */}
                <path d="M2 10 Q6 6 20 7 Q34 6 38 10 Q34 14 20 13 Q6 14 2 10Z" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.3"/>
                {/* Wing */}
                <path d="M12 10 L6 18 L22 17 L18 10Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.3"/>
                {/* Tail */}
                <path d="M4 10 L2 4 L8 8Z" fill="#e2e8f0"/>
                {/* Windows */}
                <ellipse cx="14" cy="8.5" rx="1.2" ry="1.5" fill="#93c5fd" opacity="0.9"/>
                <ellipse cx="18" cy="8.2" rx="1.2" ry="1.5" fill="#93c5fd" opacity="0.9"/>
                <ellipse cx="22" cy="8" rx="1.2" ry="1.5" fill="#93c5fd" opacity="0.9"/>
                {/* Engine */}
                <ellipse cx="15" cy="14" rx="2.5" ry="4" fill="#94a3b8"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
