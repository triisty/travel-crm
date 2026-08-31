"use client"
import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

export default function MaintenancePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const router = useRouter()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let W = canvas.width = window.innerWidth
    let H = canvas.height = window.innerHeight
    let animId: number
    let t = 0

    const onResize = () => {
      W = canvas.width = window.innerWidth
      H = canvas.height = window.innerHeight
    }
    window.addEventListener("resize", onResize)

    // Stars
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 2000,
      r: Math.random() * 1.2 + 0.2,
      a: Math.random() * 0.5 + 0.1,
    }))

    function drawStars() {
      stars.forEach(s => {
        ctx!.beginPath()
        ctx!.arc(s.x % W, s.y % H, s.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(200,220,255,${s.a})`
        ctx!.fill()
      })
    }

    function drawEarth(cx: number, cy: number, r: number) {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark"

      // Atmosphere glow
      const atm = ctx!.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.3)
      atm.addColorStop(0, isDark ? "rgba(56,130,246,0.18)" : "rgba(56,130,246,0.12)")
      atm.addColorStop(1, "rgba(56,130,246,0)")
      ctx!.beginPath()
      ctx!.arc(cx, cy, r * 1.3, 0, Math.PI * 2)
      ctx!.fillStyle = atm
      ctx!.fill()

      // Ocean
      const ocean = ctx!.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r)
      ocean.addColorStop(0, "#2563eb")
      ocean.addColorStop(0.5, "#1d4ed8")
      ocean.addColorStop(1, "#1e3a6e")
      ctx!.beginPath()
      ctx!.arc(cx, cy, r, 0, Math.PI * 2)
      ctx!.fillStyle = ocean
      ctx!.fill()

      // Continents — animated rotation
      ctx!.save()
      ctx!.beginPath()
      ctx!.arc(cx, cy, r, 0, Math.PI * 2)
      ctx!.clip()

      const rotOffset = (t * 0.0003) % (Math.PI * 2)
      ctx!.translate(cx, cy)
      ctx!.rotate(rotOffset)
      ctx!.translate(-cx, -cy)

      // Land masses
      const land = [
        // Europe/Africa
        { x: cx + r * 0.08, y: cy - r * 0.25, w: r * 0.18, h: r * 0.28, rx: 8 },
        { x: cx + 0.05 * r, y: cy + r * 0.05, w: r * 0.22, h: r * 0.38, rx: 10 },
        // Americas
        { x: cx - r * 0.45, y: cy - r * 0.3, w: r * 0.2, h: r * 0.35, rx: 8 },
        { x: cx - r * 0.38, y: cy + r * 0.05, w: r * 0.18, h: r * 0.42, rx: 12 },
        // Asia
        { x: cx + r * 0.2, y: cy - r * 0.35, w: r * 0.42, h: r * 0.32, rx: 10 },
        // Australia
        { x: cx + r * 0.38, y: cy + r * 0.2, w: r * 0.18, h: r * 0.14, rx: 8 },
      ]

      land.forEach(l => {
        ctx!.beginPath()
        ctx!.roundRect(l.x - l.w/2, l.y - l.h/2, l.w, l.h, l.rx)
        ctx!.fillStyle = "#22c55e"
        ctx!.globalAlpha = 0.75
        ctx!.fill()
        ctx!.globalAlpha = 1
      })

      // Greenland / small islands
      ctx!.beginPath()
      ctx!.ellipse(cx - r * 0.22, cy - r * 0.48, r * 0.08, r * 0.06, 0.3, 0, Math.PI * 2)
      ctx!.fillStyle = "#16a34a"
      ctx!.globalAlpha = 0.7
      ctx!.fill()
      ctx!.globalAlpha = 1

      ctx!.restore()

      // Lighting overlay
      const light = ctx!.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 0, cx, cy, r)
      light.addColorStop(0, "rgba(255,255,255,0.18)")
      light.addColorStop(0.5, "rgba(255,255,255,0.04)")
      light.addColorStop(1, "rgba(0,0,30,0.45)")
      ctx!.beginPath()
      ctx!.arc(cx, cy, r, 0, Math.PI * 2)
      ctx!.fillStyle = light
      ctx!.fill()

      // Cloud wisps
      ctx!.save()
      ctx!.beginPath()
      ctx!.arc(cx, cy, r, 0, Math.PI * 2)
      ctx!.clip()
      ctx!.globalAlpha = 0.15
      ctx!.fillStyle = "white"
      ;[
        [cx - r*0.1, cy - r*0.3, r*0.25, r*0.06],
        [cx + r*0.2, cy + r*0.1, r*0.2, r*0.05],
        [cx - r*0.3, cy + r*0.2, r*0.18, r*0.04],
      ].forEach(([x, y, rw, rh]) => {
        ctx!.beginPath()
        ctx!.ellipse(x, y, rw, rh, 0.2, 0, Math.PI * 2)
        ctx!.fill()
      })
      ctx!.globalAlpha = 1
      ctx!.restore()
    }

    function drawPlane(cx: number, cy: number, orbitR: number, angle: number) {
      const px = cx + orbitR * Math.cos(angle)
      const py = cy + orbitR * Math.sin(angle) * 0.38

      // Depth scale
      const rawDepth = Math.sin(angle) * 0.38
      const scale = 0.65 + 0.45 * ((rawDepth + 0.38) / 0.76)
      const behind = Math.sin(angle) < -0.1

      if (behind) return // draw later

      // Heading angle
      const nx = cx + orbitR * Math.cos(angle + 0.01)
      const ny = cy + orbitR * Math.sin(angle + 0.01) * 0.38
      const heading = Math.atan2(ny - py, nx - px)

      ctx!.save()
      ctx!.translate(px, py)
      ctx!.rotate(heading)
      ctx!.scale(scale, scale)

      // Shadow
      ctx!.beginPath()
      ctx!.ellipse(0, 8, 22, 5, 0, 0, Math.PI * 2)
      ctx!.fillStyle = "rgba(0,0,0,0.15)"
      ctx!.fill()

      // Fuselage
      ctx!.beginPath()
      ctx!.moveTo(-30, 0)
      ctx!.bezierCurveTo(-30, -5, 30, -5, 34, 0)
      ctx!.bezierCurveTo(30, 5, -30, 5, -30, 0)
      ctx!.fillStyle = "#f8fafc"
      ctx!.fill()
      ctx!.strokeStyle = "#cbd5e1"
      ctx!.lineWidth = 0.5
      ctx!.stroke()

      // Wings
      ctx!.beginPath()
      ctx!.moveTo(-5, 0)
      ctx!.lineTo(-18, 20)
      ctx!.lineTo(12, 20)
      ctx!.lineTo(8, 0)
      ctx!.closePath()
      ctx!.fillStyle = "#e2e8f0"
      ctx!.fill()
      ctx!.strokeStyle = "#cbd5e1"
      ctx!.lineWidth = 0.5
      ctx!.stroke()

      // Tail
      ctx!.beginPath()
      ctx!.moveTo(-22, 0)
      ctx!.lineTo(-30, -12)
      ctx!.lineTo(-18, -2)
      ctx!.closePath()
      ctx!.fillStyle = "#e2e8f0"
      ctx!.fill()

      // Windows
      for (let i = 0; i < 5; i++) {
        ctx!.beginPath()
        ctx!.ellipse(-8 + i * 7, -1.5, 2, 2.5, 0, 0, Math.PI * 2)
        ctx!.fillStyle = "rgba(147,197,253,0.8)"
        ctx!.fill()
      }

      // Engine
      ctx!.beginPath()
      ctx!.ellipse(0, 13, 4, 7, 0, 0, Math.PI * 2)
      ctx!.fillStyle = "#94a3b8"
      ctx!.fill()

      ctx!.restore()
    }

    function drawOrbit(cx: number, cy: number, orbitR: number) {
      ctx!.beginPath()
      ctx!.ellipse(cx, cy, orbitR, orbitR * 0.38, 0, 0, Math.PI * 2)
      ctx!.strokeStyle = "rgba(99,130,246,0.18)"
      ctx!.lineWidth = 1.5
      ctx!.setLineDash([8, 12])
      ctx!.stroke()
      ctx!.setLineDash([])
    }

    function drawBehindPlane(cx: number, cy: number, orbitR: number, angle: number) {
      const rawDepth = Math.sin(angle) * 0.38
      if (Math.sin(angle) >= -0.1) return

      const px = cx + orbitR * Math.cos(angle)
      const py = cy + orbitR * Math.sin(angle) * 0.38
      const scale = 0.65 + 0.45 * ((rawDepth + 0.38) / 0.76)

      const nx = cx + orbitR * Math.cos(angle + 0.01)
      const ny = cy + orbitR * Math.sin(angle + 0.01) * 0.38
      const heading = Math.atan2(ny - py, nx - px)

      ctx!.save()
      ctx!.translate(px, py)
      ctx!.rotate(heading)
      ctx!.scale(scale, scale)
      ctx!.globalAlpha = 0.55

      ctx!.beginPath()
      ctx!.moveTo(-30, 0)
      ctx!.bezierCurveTo(-30, -5, 30, -5, 34, 0)
      ctx!.bezierCurveTo(30, 5, -30, 5, -30, 0)
      ctx!.fillStyle = "#f8fafc"
      ctx!.fill()

      ctx!.beginPath()
      ctx!.moveTo(-5, 0)
      ctx!.lineTo(-18, 20)
      ctx!.lineTo(12, 20)
      ctx!.lineTo(8, 0)
      ctx!.closePath()
      ctx!.fillStyle = "#e2e8f0"
      ctx!.fill()

      ctx!.globalAlpha = 1
      ctx!.restore()
    }

    function render() {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark"
      ctx!.clearRect(0, 0, W, H)

      // Background
      if (isDark) {
        const bg = ctx!.createLinearGradient(0, 0, W, H)
        bg.addColorStop(0, "#050914")
        bg.addColorStop(1, "#0a0f1e")
        ctx!.fillStyle = bg
        ctx!.fillRect(0, 0, W, H)
        drawStars()
      } else {
        const bg = ctx!.createLinearGradient(0, 0, W, H)
        bg.addColorStop(0, "#f0f6ff")
        bg.addColorStop(1, "#e8f0fe")
        ctx!.fillStyle = bg
        ctx!.fillRect(0, 0, W, H)
      }

      const cx = W / 2
      const cy = H * 0.58
      const earthR = Math.min(W, H) * 0.22
      const orbitR = earthR * 1.72
      const planeAngle = t * 0.0008

      // Draw behind plane first
      drawBehindPlane(cx, cy, orbitR, planeAngle)

      // Orbit line
      drawOrbit(cx, cy, orbitR)

      // Earth
      drawEarth(cx, cy, earthR)

      // Plane (front)
      drawPlane(cx, cy, orbitR, planeAngle)

      t += 16
      animId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", onResize)
    }
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      <canvas ref={canvasRef} className="absolute inset-0" style={{ opacity: 0.95 }} />

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col items-center justify-start pt-16 md:pt-20 px-6 pointer-events-none h-full">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-2.5">
          <span className="text-lg font-black" style={{
            background: "linear-gradient(135deg,#ef4444,#f97316)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
          }}>its</span>
          <span className="text-lg font-black" style={{ color: "var(--text-primary)" }}>tour</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full ml-1"
            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
            CRM
          </span>
        </div>

        {/* Text */}
        <div className="text-center max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: "#ef4444", letterSpacing: "0.15em" }}>
            Texniki xidmət
          </p>
          <h1 className="text-3xl md:text-4xl font-black mb-4 leading-tight"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Üzr istəyirik
          </h1>
          <p className="text-base font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
            Texniki işlər aparılır
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)", maxWidth: 400, margin: "0 auto" }}>
            Sistemi daha sürətli və rahat etmək üçün müvəqqəti yeniləmə aparırıq. Zəhmət olmasa, bir az sonra yenidən cəhd edin.
          </p>

          <div className="mt-6 pointer-events-auto">
            <a href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-[1.03] active:scale-95"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 4px 20px rgba(99,102,241,0.3)" }}>
              Giriş səhifəsinə qayıt
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
