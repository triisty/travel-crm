// app/api/attendance/upload/route.ts
// Accepts CSV exported from iVMS-4200 Time & Attendance
// Parses and saves to Supabase attendance_events + attendance_summary

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WORK_START   = process.env.HIKVISION_WORK_START   ?? "09:00"
const LATE_MINUTES = parseInt(process.env.HIKVISION_LATE_MINUTES ?? "15")

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim()
}

function parseFile(text: string): any[] {
  // iVMS exports HTML disguised as .xls — parse as HTML table
  if (text.includes("<table") || text.includes("<td")) {
    return parseHtmlTable(text)
  }
  // CSV / TSV fallback
  return parseCSV(text)
}

function parseHtmlTable(html: string): any[] {
  const rows: string[][] = []
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
  let trMatch
  while ((trMatch = trRe.exec(html)) !== null) {
    const cells: string[] = []
    let tdMatch
    const tdReg = new RegExp(tdRe.source, "gi")
    while ((tdMatch = tdReg.exec(trMatch[1])) !== null) {
      cells.push(stripHtml(tdMatch[1]))
    }
    if (cells.length > 0) rows.push(cells)
  }

  // Find header row (contains "Person ID" or "Name")
  const headerIdx = rows.findIndex(r =>
    r.some(c => c.toLowerCase().includes("person id") || c.toLowerCase().includes("name"))
  )
  if (headerIdx === -1) return []

  const headers = rows[headerIdx].map(h => h.toLowerCase().trim())
  return rows.slice(headerIdx + 1)
    .filter(r => r.length >= 2 && r.some(c => c.trim()))
    .map(r => {
      const obj: any = {}
      headers.forEach((h, i) => { obj[h] = r[i]?.trim() ?? "" })
      return obj
    })
}

function parseCSV(text: string): any[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const sep = lines[0].includes("\t") ? "\t" : ","
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, "").toLowerCase())
  return lines.slice(1).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ""))
    const obj: any = {}
    headers.forEach((h, i) => { obj[h] = vals[i] ?? "" })
    return obj
  }).filter(r => Object.values(r).some(v => v !== ""))
}

// Map iVMS column names to our fields
// Confirmed iVMS columns: Person ID, Name, Department, Time, Attendance Status, Attendance Check Point
function mapRow(row: any): any | null {
  const empNo   = row["person id"] || row["employee id"] || row["employee no"] || row["id"] || ""
  const empName = row["name"] || row["employee name"] || row["person name"] || ""
  const timeStr = row["time"] || row["authentication time"] || row["date and time"] || row["check time"] || ""
  const status  = row["attendance status"] || row["status"] || row["type"] || "unknown"
  const device  = row["attendance check point"] || row["device name"] || row["device"] || ""

  if (!empNo || !timeStr) return null

  let eventTime: string
  try {
    const d = new Date(timeStr)
    if (isNaN(d.getTime())) return null
    eventTime = d.toISOString()
  } catch { return null }

  const statusLower = status.toLowerCase()
  let eventType = "unknown"
  if (statusLower.includes("check in") || statusLower === "in") eventType = "entry"
  else if (statusLower.includes("check out") || statusLower === "out") eventType = "exit"

  return {
    person_id:     empNo.trim(),
    employee_name: empName.trim(),
    event_time:    eventTime,
    event_type:    eventType,
    verify_mode:   "unknown",
    raw_event_no:  status,
    device_ip:     device,
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    if (!file) return NextResponse.json({ ok: false, error: "No file uploaded" }, { status: 400 })

    const text = await file.text()
    const rows = parseFile(text)
    if (!rows.length) return NextResponse.json({ ok: false, error: "No data found in file" }, { status: 400 })

    const events = rows.map(mapRow).filter(Boolean) as any[]
    if (!events.length) return NextResponse.json({ ok: false, error: "Could not parse any rows. Check column names." }, { status: 400 })

    // Insert into Supabase
    const { error } = await supabase
      .from("attendance_events")
      .upsert(events, { onConflict: "person_id,event_time", ignoreDuplicates: true })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    // Rebuild summaries
    const dates     = [...new Set<string>(events.map(e => e.event_time.slice(0, 10)))]
    const personIds = [...new Set<string>(events.map(e => e.person_id))]
    await rebuildSummaries(dates, personIds)

    return NextResponse.json({ ok: true, total: rows.length, imported: events.length, dates })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

async function rebuildSummaries(dates: string[], personIds: string[]) {
  for (const date of dates) {
    for (const personId of personIds) {
      const { data: evts } = await supabase
        .from("attendance_events")
        .select("event_time, event_type, employee_name")
        .eq("person_id", personId)
        .gte("event_time", `${date}T00:00:00`)
        .lte("event_time", `${date}T23:59:59`)
        .order("event_time", { ascending: true })

      if (!evts?.length) continue

      const firstIn = evts.find(e => e.event_type === "entry" || e.event_type === "unknown")
      const lastOut = [...evts].reverse().find(e => e.event_type === "exit" || e.event_type === "unknown")
      const name    = evts.find(e => e.employee_name)?.employee_name ?? ""

      let workedMinutes = 0
      if (firstIn && lastOut && lastOut.event_time !== firstIn.event_time) {
        workedMinutes = Math.round(
          (new Date(lastOut.event_time).getTime() - new Date(firstIn.event_time).getTime()) / 60000
        )
      }

      let isLate = false
      if (firstIn) {
        const inTime    = new Date(firstIn.event_time)
        const [wH, wM]  = WORK_START.split(":").map(Number)
        const workStart = new Date(inTime)
        workStart.setHours(wH, wM + LATE_MINUTES, 0, 0)
        isLate = inTime > workStart
      }

      await supabase.from("attendance_summary").upsert({
        person_id:      personId,
        employee_name:  name,
        work_date:      date,
        first_in:       firstIn?.event_time ?? null,
        last_out:       lastOut?.event_time ?? null,
        worked_minutes: workedMinutes,
        is_late:        isLate,
      }, { onConflict: "person_id,work_date" })
    }
  }
}
