"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useUserRole } from "@/lib/hooks/useUserRole"
import { formatCurrency, formatDate } from "@/lib/calculations"
import { CheckCircle, XCircle, Eye, Clock, Edit3, Send } from "lucide-react"

const card = { background: "var(--bg-card)", border: "1px solid var(--border-color)", backdropFilter: "blur(20px)", borderRadius: "24px" }
const modalCard = { background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "24px" }
const inputStyle = { background: "var(--bg-glass)", border: "1px solid var(--border-color)", color: "var(--text-primary)", borderRadius: "12px", padding: "10px 16px", fontSize: "14px", outline: "none", width: "100%" }

export default function DraftsPage() {
  const { profile } = useUserRole()
  const [drafts, setDrafts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [reviewNote, setReviewNote] = useState("")
  const [ready, setReady] = useState(false)
  const [editDraft, setEditDraft] = useState<any>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [resubmitting, setResubmitting] = useState(false)

  useEffect(() => { fetchDrafts(); setReady(true) }, [profile])

  async function fetchDrafts() {
    setLoading(true)
    let query = supabase.from("booking_drafts").select("*").order("created_at", { ascending: false })
    if (profile?.role === "menecer") query = query.eq("submitted_by", profile.fullName)
    const { data } = await query
    setDrafts(data ?? [])
    setLoading(false)
  }

  async function handleApprove(draft: any) {
    const { error } = await supabase.from("bookings").insert({ client_name: draft.client_name, client_phone: draft.client_phone ?? "", destination: draft.destination, departure_date: draft.departure_date, return_date: draft.return_date ?? draft.departure_date, travelers: draft.travelers ?? 1, booking_type: draft.booking_type, description: draft.description ?? "", vendor: draft.vendor ?? "", is_iata: draft.is_iata ?? false, buy_price: draft.buy_price, sell_price: draft.sell_price, commission_percent: draft.commission_percent, commission_amount: draft.commission_amount, profit: draft.profit, paid_amount: draft.paid_amount ?? 0, manager: draft.manager, iata_period: draft.iata_period ?? "1-7", status: "confirmed", payment_status: draft.payment_status ?? "unpaid", notes: draft.notes ?? "", ticket_number: draft.ticket_number ?? "", booking_reference: draft.booking_reference ?? "", pnr: draft.pnr ?? "", updated_by: profile?.fullName ?? "", updated_by_role: profile?.role ?? "" })
    if (error) { alert("Xəta: " + error.message); return }
    await supabase.from("booking_drafts").update({ review_status: "approved", reviewer_note: reviewNote }).eq("id", draft.id)
    setSelected(null); setReviewNote(""); fetchDrafts()
  }

  async function handleReject(draft: any) {
    await supabase.from("booking_drafts").update({ review_status: "rejected", reviewer_note: reviewNote }).eq("id", draft.id)
    setSelected(null); setReviewNote(""); fetchDrafts()
  }

  async function handleDelete(id: string) {
    if (!confirm("Silinsin?")) return
    await supabase.from("booking_drafts").delete().eq("id", id); fetchDrafts()
  }

  function openEditDraft(draft: any) {
    setEditForm({
      client_name: draft.client_name ?? "",
      client_phone: draft.client_phone ?? "",
      destination: draft.destination ?? "",
      departure_date: draft.departure_date ?? "",
      return_date: draft.return_date ?? "",
      travelers: draft.travelers ?? 1,
      booking_type: draft.booking_type ?? "bilet",
      buy_price: draft.buy_price ?? 0,
      sell_price: draft.sell_price ?? 0,
      commission_percent: draft.commission_percent ?? 10,
      vendor: draft.vendor ?? "",
      pnr: draft.pnr ?? "",
      ticket_number: draft.ticket_number ?? "",
      notes: draft.notes ?? "",
      description: draft.description ?? "",
    })
    setEditDraft(draft)
    setSelected(null)
  }

  async function handleResubmit() {
    if (!editDraft) return
    setResubmitting(true)
    const gross = editForm.sell_price - editForm.buy_price
    const commissionAmount = Math.round(gross * (editForm.commission_percent / 100) * 100) / 100
    const profit = gross - commissionAmount
    await supabase.from("booking_drafts").update({
      ...editForm,
      buy_price: Number(editForm.buy_price),
      sell_price: Number(editForm.sell_price),
      commission_percent: Number(editForm.commission_percent),
      commission_amount: commissionAmount,
      profit,
      travelers: Number(editForm.travelers),
      review_status: "pending",
      reviewer_note: "",
    }).eq("id", editDraft.id)
    setResubmitting(false)
    setEditDraft(null)
    fetchDrafts()
  }

  if (!ready) return null

  const pending = drafts.filter(d => d.review_status === "pending")
  const approved = drafts.filter(d => d.review_status === "approved")
  const rejected = drafts.filter(d => d.review_status === "rejected")
  const canReview = ["it_admin", "direktor", "muhasib"].includes(profile?.role ?? "")

  return (
    <div className="min-h-screen p-5 md:p-7" style={{ background: "var(--bg-primary)" }}>
      <div className="flex items-center justify-between mb-7">
        <div><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Təsdiq gözləyən sifarişlər</h1><p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>Menecerlərin əlavə etdiyi sifarişlər</p></div>
        <div className="flex gap-3">
          {[{ label: "Gözləyir", value: pending.length, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" }, { label: "Təsdiqlənib", value: approved.length, color: "#22c55e", bg: "rgba(34,197,94,0.1)" }, { label: "Rədd edilib", value: rejected.length, color: "#ef4444", bg: "rgba(239,68,68,0.1)" }].map(({ label, value, color, bg }) => (
            <div key={label} className="px-4 py-2 rounded-2xl text-center" style={{ background: bg }}>
              <p className="text-xs font-medium" style={{ color }}>{label}</p>
              <p className="text-xl font-bold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 rounded-3xl" style={{ ...card, color: "var(--text-muted)" }}>Yüklənir...</div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-16 rounded-3xl" style={{ ...card, color: "var(--text-muted)" }}><Clock size={40} className="mx-auto mb-3 opacity-30" /><p className="text-sm font-medium">Heç bir sifariş yoxdur</p></div>
      ) : (
        <div className="rounded-3xl overflow-hidden" style={card}>
          <table className="w-full text-sm">
            <thead><tr style={{ borderBottom: "1px solid var(--border-color)" }}>{["Müştəri", "İstiqamət", "Növ", "Tarix", "Satış", "Menecer", "Status", ""].map(h => <th key={h} className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--text-muted)" }}>{h}</th>)}</tr></thead>
            <tbody>{drafts.map(d => (
              <tr key={d.id} className="border-b" style={{ borderColor: "var(--border-color)" }}>
                <td className="px-4 py-3"><p className="font-medium" style={{ color: "var(--text-primary)" }}>{d.client_name}</p><p className="text-xs" style={{ color: "var(--text-muted)" }}>{d.client_phone}</p></td>
                <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{d.destination}</td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-xl" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>{d.booking_type}</span></td>
                <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{formatDate(d.departure_date)}</td>
                <td className="px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>{formatCurrency(d.sell_price)}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{d.manager}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2.5 py-1 rounded-xl font-medium" style={{ background: d.review_status === "pending" ? "rgba(245,158,11,0.1)" : d.review_status === "approved" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: d.review_status === "pending" ? "#f59e0b" : d.review_status === "approved" ? "#22c55e" : "#ef4444" }}>
                    {d.review_status === "pending" ? "⏳ Gözləyir" : d.review_status === "approved" ? "✅ Təsdiqlənib" : "❌ Rədd edilib"}
                  </span>
                  {d.reviewer_note && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{d.reviewer_note}</p>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => { setSelected(d); setReviewNote("") }} className="p-1.5 rounded-xl" style={{ color: "var(--text-muted)" }}><Eye size={15} /></button>
                    {d.review_status === "rejected" && d.submitted_by === profile?.fullName && (
                      <button onClick={() => openEditDraft(d)}
                        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-all hover:scale-105"
                        style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                        <Edit3 size={12} />Düzəlt
                      </button>
                    )}
                    {profile?.role === "it_admin" && <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-xl" style={{ color: "var(--text-muted)" }}><XCircle size={15} /></button>}
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" style={modalCard}>
            <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Sifariş təfərrüatı</h2><button onClick={() => setSelected(null)} style={{ color: "var(--text-muted)" }} className="text-xl">✕</button></div>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              {[["Müştəri", selected.client_name], ["Telefon", selected.client_phone || "—"], ["İstiqamət", selected.destination], ["Növ", selected.booking_type], ["Uçuş tarixi", formatDate(selected.departure_date)], ["Qayıdış tarixi", formatDate(selected.return_date)], ["Satış qiyməti", formatCurrency(selected.sell_price)], ["Alış qiyməti", formatCurrency(selected.buy_price)], ["Mənfəət", formatCurrency(selected.profit)], ["Menecer", selected.manager], ["Vendor", selected.vendor || "—"], ["PNR", selected.pnr || "—"]].map(([label, value]) => (
                <div key={label}><p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</p><p className="font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p></div>
              ))}
            </div>
            <div className="p-3 rounded-2xl mb-4" style={{ background: "rgba(245,158,11,0.1)" }}>
              <p className="text-xs mb-1" style={{ color: "#f59e0b" }}>Göndərən</p>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{selected.submitted_by} ({selected.submitted_by_role})</p>
            </div>
            {canReview && selected.review_status === "pending" && (
              <>
                <div className="mb-4"><label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Qeyd (istəyə görə)</label><input type="text" value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Düzəliş tələbi..." style={inputStyle} /></div>
                <div className="flex gap-3">
                  <button onClick={() => handleApprove(selected)} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium text-white" style={{ background: "linear-gradient(135deg, #10b981, #34d399)" }}><CheckCircle size={16} />Təsdiqlə və yayımla</button>
                  <button onClick={() => handleReject(selected)} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium text-white" style={{ background: "linear-gradient(135deg, #ef4444, #f97316)" }}><XCircle size={16} />Rədd et</button>
                </div>
              </>
            )}
            {selected.review_status !== "pending" && (
              <div className="p-3 rounded-2xl" style={{ background: selected.review_status === "approved" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }}>
                <p className="text-sm font-semibold" style={{ color: selected.review_status === "approved" ? "#22c55e" : "#ef4444" }}>{selected.review_status === "approved" ? "✅ Təsdiqlənib" : "❌ Rədd edilib"}</p>
                {selected.reviewer_note && <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{selected.reviewer_note}</p>}
                {selected.review_status === "rejected" && selected.submitted_by === profile?.fullName && (
                  <button onClick={() => openEditDraft(selected)}
                    className="flex items-center gap-2 mt-3 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02]"
                    style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                    <Edit3 size={14} />Düzəlt və yenidən göndər
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit & Resubmit Modal */}
      {editDraft && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" style={{ backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" style={modalCard}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Sifarişi düzəlt</h2>
              <button onClick={() => setEditDraft(null)} style={{ color: "var(--text-muted)" }} className="text-xl">✕</button>
            </div>

            {editDraft.reviewer_note && (
              <div className="p-3 rounded-2xl mb-4" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <p className="text-xs font-semibold mb-1" style={{ color: "#ef4444" }}>Buxalterin qeydi:</p>
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>{editDraft.reviewer_note}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Müştəri adı", key: "client_name", type: "text" },
                { label: "Telefon", key: "client_phone", type: "text" },
                { label: "İstiqamət", key: "destination", type: "text" },
                { label: "Uçuş tarixi", key: "departure_date", type: "date" },
                { label: "Qayıdış tarixi", key: "return_date", type: "date" },
                { label: "Səyahətçi sayı", key: "travelers", type: "number" },
                { label: "Alış qiyməti", key: "buy_price", type: "number" },
                { label: "Satış qiyməti", key: "sell_price", type: "number" },
                { label: "Komissiya %", key: "commission_percent", type: "number" },
                { label: "Vendor", key: "vendor", type: "text" },
                { label: "PNR", key: "pnr", type: "text" },
                { label: "Bilet №", key: "ticket_number", type: "text" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>{label}</label>
                  <input type={type} value={editForm[key]} onChange={e => setEditForm((f: any) => ({ ...f, [key]: e.target.value }))} style={inputStyle} />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>Qeyd</label>
                <textarea value={editForm.notes} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))}
                  rows={2} style={{ ...inputStyle, resize: "none" }} />
              </div>
            </div>

            {/* Profit preview */}
            <div className="mt-3 p-3 rounded-2xl" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <div className="flex justify-between text-xs">
                <span style={{ color: "var(--text-secondary)" }}>Mənfəət:</span>
                <span className="font-bold" style={{ color: "#22c55e" }}>
                  {formatCurrency((Number(editForm.sell_price) - Number(editForm.buy_price)) * (1 - Number(editForm.commission_percent) / 100))}
                </span>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={handleResubmit} disabled={resubmitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                <Send size={15} />{resubmitting ? "Göndərilir..." : "Yenidən göndər"}
              </button>
              <button onClick={() => setEditDraft(null)}
                className="px-5 py-3 rounded-2xl text-sm"
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
