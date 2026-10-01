// app/api/hikvision/event/route.ts
// Receives real-time XML push directly from DS-K1A802AMF device
// Device calls this endpoint on every fingerprint/card scan

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WORK_START   = process.env.HIKVISION_WORK_START   ?? "09:00"
const LATE_MINUTES = parseInt(process.env.HIKVISION_LATE_MINUTES ?? "15")

// Hikvision sends multipart XML — parse the relevant fields
function parseXmlField(xml: string, field: string): string {
  const m = xml.match(new RegExp(`<${field}[^>]*>([^<]*)</${field}>`))
  return m?.[1]?.trim() ?? ""
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()

    // Hikvision sends XML like:
    // <EventNotificationAlert>
    //   <eventType>AccessControllerEvent</eventType>
    //   <AccessControllerEvent>
    //     <employeeNoString>00000004</employeeNoString>
    //     <name>Ayxan Elkhanli</name>
    //     <currentVerifyMode>fingerprint</currentVerifyMode>
    //     <type>entry</type>
    //   </AccessControllerEvent>
    //   <dateTime>2026-10-01T09:02:33+04:00</dateTime>
    // </EventNotificationAlert>

    const eventType = parseXmlField(body, "eventType")

    // Only process access control events
    if (!eventType.includes("AccessControl") && !eventType.includes("attendance")) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const personId     = parseXmlField(body, "employeeNoString") || parseXmlField(body, "employeeNo")
    const employeeName = parseXmlField(body, "name")
    const eventTime    = parseXmlField(body, "dateTime") || new Date().toISOString()
    const verifyMode   = parseXmlField(body, "currentVerifyMode") || parseXmlField(body, "verifyMode") || "unknown"
    const minor        = parseXmlField(body, "minor")
    const eventDir     = parseXmlField(body, "type") // "entry" | "exit" | "other"

    // Map direction
    let direction = "unknown"
    if (eventDir === "entry" || minor === "75") direction = "entry"
    else if (eventDir === "exit" || minor === "76") direction = "exit"

    if (!personId) {
      // Not a person event (door alarm, etc.) — ignore
      return NextResponse.json({ ok: true, skipped: true })
    }

    // Insert event — unique on (person_id, event_time) prevents dupes
    const { error } = await supabase
      .from("attendance_events")
      .upsert({
        person_id:     personId,
        employee_name: employeeName,
        event_time:    eventTime,
        event_type:    direction,
        verify_mode:   verifyMode,
        raw_event_no:  minor,
        device_ip:     req.headers.get("x-forwarded-for") ?? "",
      }, { onConflict: "person_id,event_time", ignoreDuplicates: true })

    if (error) {
      console.error("[Hikvision Push] DB error:", error.message)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    // Rebuild daily summary for this person+date
    const date = eventTime.slice(0, 10)
    await rebuildSummary(personId, date)

    console.log(`[Hikvision Push] ${employeeName || personId} @ ${eventTime} → ${direction}`)
    return NextResponse.json({ ok: true })

  } catch (e: any) {
    console.error("[Hikvision Push] Error:", e.message)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// Accept GET for device connectivity check
export async function GET() {
  return new Response("OK", { status: 200 })
}

async function rebuildSummary(personId: string, date: string) {
  const { data: evts } = await supabase
    .from("attendance_events")
    .select("event_time, event_type, employee_name")
    .eq("person_id", personId)
    .gte("event_time", `${date}T00:00:00`)
    .lte("event_time", `${date}T23:59:59`)
    .order("event_time", { ascending: true })

  if (!evts?.length) return

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
