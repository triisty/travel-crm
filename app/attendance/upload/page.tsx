"use client"
import { useState } from "react"
import { Upload, CheckCircle2, AlertCircle, FileText, ArrowLeft } from "lucide-react"

export default function AttendanceUploadPage() {
  const [dragging, setDragging]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<any>(null)
  const [error, setError]         = useState("")

  async function handleFile(file: File) {
    if (!file) return
    setLoading(true); setResult(null); setError("")
    const form = new FormData()
    form.append("file", file)
    try {
      const res  = await fetch("/api/attendance/upload", { method: "POST", body: form })
      const data = await res.json()
      if (data.ok) setResult(data)
      else setError(data.error || "Xəta baş verdi")
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="p-5 md:p-6" style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <div className="max-w-xl mx-auto">
        <a href="/attendance" className="flex items-center gap-2 text-sm mb-6 hover:opacity-70 transition-opacity"
          style={{ color: "var(--text-muted)" }}>
          <ArrowLeft size={14} />Davamiyyətə qayıt
        </a>

        <h1 className="text-2xl font-black mb-1" style={{ color: "var(--text-primary)" }}>
          CSV / Excel Yüklə
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          iVMS-4200-dən export edilmiş attendance faylını yükləyin
        </p>

        {/* How to export */}
        <div className="p-4 rounded-2xl mb-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
            iVMS-4200-dən necə export etmək
          </p>
          <ol className="space-y-1">
            {[
              "Time & Attendance → Attendance Statistics",
              "Tarix aralığını seçin",
              "Search düyməsinə basın",
              "Export → CSV formatında yükləyin",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ background: "var(--accent)", color: "white" }}>{i+1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className="rounded-2xl flex flex-col items-center justify-center p-12 mb-4 cursor-pointer transition-all"
          style={{
            border: `2px dashed ${dragging ? "var(--accent)" : "var(--border-color)"}`,
            background: dragging ? "var(--accent-light)" : "var(--bg-card)",
          }}
          onClick={() => document.getElementById("fileInput")?.click()}>
          <input id="fileInput" type="file" accept=".csv,.txt,.xls,.xlsx" className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
          {loading ? (
            <>
              <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mb-3"
                style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Yüklənir...</p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "var(--accent-light)" }}>
                <Upload size={24} style={{ color: "var(--accent)" }} />
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Faylı bura sürükləyin
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                və ya klikləyin — CSV, TXT, XLS, XLSX
              </p>
            </>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className="p-4 rounded-2xl" style={{ background: "rgba(43,181,160,0.08)", border: "1px solid rgba(43,181,160,0.25)" }}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
              <p className="text-sm font-bold" style={{ color: "var(--success)" }}>Uğurla yükləndi!</p>
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {result.imported} hadisə CRM-ə yazıldı (cəmi {result.total} sətir)
            </p>
            {result.dates?.length > 0 && (
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Tarixlər: {result.dates.join(", ")}
              </p>
            )}
            <a href="/attendance"
              className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "var(--success)" }}>
              Davamiyyətə bax →
            </a>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl" style={{ background: "rgba(232,69,69,0.08)", border: "1px solid rgba(232,69,69,0.25)" }}>
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={16} style={{ color: "var(--danger)" }} />
              <p className="text-sm font-bold" style={{ color: "var(--danger)" }}>Xəta</p>
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
