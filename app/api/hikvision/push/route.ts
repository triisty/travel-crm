// app/api/hikvision/push/route.ts
// Receives events from local Windows bridge
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WORK_START   = process.env.HIKVISION_WORK_START   ?? "09:00"
const LATE_MINUTES = parseInt(process.env.HIKVISION_LATE_MINUTES ?? "15")
const CRM_SECRET   = process.env.CRM_SECRET ?? ""

export async function POST(req: NextRequest) {
  // Verify bridge secret
  if (CRM_SECRET && req.headers.get("x-bridge-secret") !== CRM_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const events: any[] = body.events ?? []
    if (!events.length) return NextResponse.json({ ok: true, synced: 0 })

    // Insert — ignore duplicates via unique constraint (person_id, event_time)
    const rows = events.map((e: any) => ({
      person_id:     String(e.personId     ?? ""),
      employee_name: String(e.employeeName ?? ""),
      event_time:    String(e.eventTime    ?? ""),
      event_type:    String(e.eventType    ?? "unknown"),
      verify_mode:   String(e.verifyMode   ?? "unknown"),
      raw_event_no:  String(e.rawEventNo   ?? ""),
      device_ip:     process.env.HIKVISION_IP ?? "",
    })).filter(r => r.person_id && r.event_time)

    const { error: insertErr } = await supabase
      .from("attendance_events")
      .upsert(rows, { onConflict: "person_id,event_time", ignoreDuplicates: true })

    if (insertErr) return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 })

    // Rebuild summaries for affected dates
    const dates     = [...new Set<string>(rows.map(r => r.event_time.slice(0, 10)))]
    const personIds = [...new Set<string>(rows.map(r => r.person_id))]
    await rebuildSummaries(dates, personIds)

    return NextResponse.json({ ok: true, synced: rows.length, dates })
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
      const name    = evts[0].employee_name

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
