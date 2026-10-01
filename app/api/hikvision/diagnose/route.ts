// app/api/hikvision/diagnose/route.ts
import { NextResponse } from "next/server"
import { getDeviceInfo } from "@/lib/hikvision"

export async function GET() {
  const result = await getDeviceInfo()
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.message,
      hint: result.status === 401
        ? "Неверные credentials. Проверь HIKVISION_USER и HIKVISION_PASS в .env"
        : result.status === 0
        ? "Устройство недоступно. Проверь IP/PORT и сетевое соединение"
        : `HTTP ${result.status} — возможно неподдерживаемый endpoint`,
    }, { status: 200 }) // 200 чтобы не блокировать устройство
  }
  return NextResponse.json({ ok: true, data: result.data })
}
