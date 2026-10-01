// lib/hikvision.ts
// Hikvision ISAPI integration — read-only, no biometric data stored

const HIK_IP   = process.env.HIKVISION_IP   ?? ""
const HIK_PORT = process.env.HIKVISION_PORT  ?? "80"
const HIK_USER = process.env.HIKVISION_USER  ?? "admin"
const HIK_PASS = process.env.HIKVISION_PASS  ?? ""

function basicAuth() {
  return "Basic " + Buffer.from(`${HIK_USER}:${HIK_PASS}`).toString("base64")
}

function baseUrl() {
  return `http://${HIK_IP}:${HIK_PORT}`
}

async function hikFetch(path: string, options?: RequestInit) {
  const url = baseUrl() + path
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    // No credentials stored in memory — only used per-request
  })
  return res
}

// ── Diagnostic: check device info before doing anything ──────
export async function getDeviceInfo() {
  try {
    const res = await hikFetch("/ISAPI/System/deviceInfo")
    if (!res.ok) return { ok: false, status: res.status, message: `HTTP ${res.status}` }
    const text = await res.text()
    return { ok: true, data: text }
  } catch (e: any) {
    return { ok: false, status: 0, message: e.message }
  }
}

// ── Get persons from device ───────────────────────────────────
export async function getPersons(): Promise<{ personId: string; name: string }[]> {
  try {
    const res = await hikFetch(
      "/ISAPI/AccessControl/UserInfo/Search?format=json",
      {
        method: "POST",
        body: JSON.stringify({
          UserInfoSearchCond: {
            searchID: "1",
            searchResultPosition: 0,
            maxResults: 1000,
          },
        }),
      }
    )
    if (!res.ok) return []
    const json = await res.json()
    const list = json?.UserInfoSearch?.UserInfo ?? []
    return list.map((u: any) => ({
      personId: String(u.employeeNo ?? u.userID ?? ""),
      name: u.name ?? "",
    }))
  } catch {
    return []
  }
}

// ── Fetch attendance events (ACS event log) ───────────────────
// ISAPI /ISAPI/AccessControl/AcsEvent?format=json
// Returns events WITHOUT biometric templates — only metadata
export async function fetchEvents(startTime: string, endTime: string) {
  try {
    const res = await hikFetch(
      "/ISAPI/AccessControl/AcsEvent?format=json",
      {
        method: "POST",
        body: JSON.stringify({
          AcsEventCond: {
            searchID: "1",
            searchResultPosition: 0,
            maxResults: 1000,
            major: 5,      // Access control events
            minor: 0,      // All subtypes
            startTime,     // "2024-01-01T00:00:00+04:00"
            endTime,
          },
        }),
      }
    )
    if (!res.ok) return []
    const json = await res.json()
    const events = json?.AcsEvent?.InfoList ?? []
    return events.map((e: any) => ({
      personId:     String(e.employeeNoString ?? e.employeeNo ?? ""),
      employeeName: e.name ?? "",
      eventTime:    e.time ?? "",
      // Determine direction from minor event type
      // 75=entry, 76=exit (DS-K1A series common values)
      eventType:    e.minor === 75 ? "entry" : e.minor === 76 ? "exit" : "unknown",
      verifyMode:   mapVerifyMode(e.currentVerifyMode),
      rawEventNo:   String(e.minor ?? ""),
    }))
  } catch {
    return []
  }
}

function mapVerifyMode(mode: number | string | undefined): string {
  const m: Record<string, string> = {
    "0": "card", "1": "fingerprint", "3": "password",
    "4": "card+fingerprint", "6": "face", "10": "card+password",
  }
  return m[String(mode ?? "")] ?? "unknown"
}
