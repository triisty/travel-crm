// app/api/hikvision/persons/route.ts
import { NextResponse } from "next/server"
import { getPersons } from "@/lib/hikvision"

export async function GET() {
  const persons = await getPersons()
  return NextResponse.json({ ok: true, persons })
}
