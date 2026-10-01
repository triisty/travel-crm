// app/api/hikvision/sync/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { fetchEvents } from "@/lib/hikvision"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WORK_START      = process.env.HIKVISION_WORK_START    ?? "09:00"
const LATE_MINUTES    = parseInt(process.env.HIKVISION_LATE_MINUTES ?? "15")
const TZ_OFFSET       = "+04:00" // Baku time

export async function POST(req: NextRequest) {
  try {
    // Default: last 24h
    const body = await req.json().catch(() => ({}))
    const now   = new Date()
    const start = body.startTime ?? new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().replace("Z", TZ_OFFSET)
    const end   = body.endTime   ?? now.toISOString().replace("Z", TZ_OFFSET)

    const events = await fetchEvents(start, end)
    if (!events.length) return NextResponse.json({ ok: true, synced: 0, message: "No events" })

    // ── Insert events (ON CONFLICT DO NOTHING = no dupes) ──
    const rows = events
      .filter((e: any) => e.personId && e.eventTime)
      .map((e: any) => ({
        person_id:     e.personId,
        employee_name: e.employeeName,
        event_time:    e.eventTime,
        event_type:    e.eventType,
        verify_mode:   e.verifyMode,
        raw_event_no:  e.rawEventNo,
        device_ip:     process.env.HIKVISION_IP,
      }))

    const { error: insertErr } = await supabase
      .from("attendance_events")
      .upsert(rows, { onConflict: "person_id,event_time", ignoreDuplicates: true })

    if (insertErr) return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 })

    // ── Rebuild daily summaries for affected dates ──────────
    const dates = [...new Set(rows.map(r => r.event_time.slice(0, 10)))]
    const personIds = [...new Set(rows.map(r => r.person_id))]
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

      if (!evts || !evts.length) continue

      const firstIn  = evts.find(e => e.event_type === "entry" || e.event_type === "unknown")
      const lastOut  = evts.filter(e => e.event_type === "exit" || e.event_type === "unknown").pop()
      const name     = evts[0].employee_name

      let workedMinutes = 0
      if (firstIn && lastOut && lastOut.event_time !== firstIn.event_time) {
        workedMinutes = Math.round(
          (new Date(lastOut.event_time).getTime() - new Date(firstIn.event_time).getTime()) / 60000
        )
      }

      // Late check: compare firstIn time vs WORK_START
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
