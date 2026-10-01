// ITS Tour — Hikvision Bridge
// Runs on office Windows PC, pushes events to CRM via HTTPS
// No biometric data is transmitted — only timestamps, names, IDs

"use strict"
require("dotenv").config()
const fetch = require("node-fetch")

// ── Config ────────────────────────────────────────────────────
const HIK_IP      = process.env.HIK_IP       || "192.168.1.125"
const HIK_PORT    = process.env.HIK_PORT      || "80"
const HIK_USER    = process.env.HIK_USER      || "admin"
const HIK_PASS    = process.env.HIK_PASS      || ""
const CRM_URL     = process.env.CRM_URL       || ""   // e.g. https://itstourcrm.vercel.app
const CRM_SECRET  = process.env.CRM_SECRET    || ""   // shared secret header
const INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MINUTES || "5") * 60 * 1000
const INITIAL_DAYS= parseInt(process.env.INITIAL_SYNC_DAYS     || "30")
const TZ_OFFSET   = process.env.TZ_OFFSET     || "+04:00"
const ONCE        = process.argv.includes("--once")

// ── Logging ───────────────────────────────────────────────────
function log(level, msg, data) {
  const ts = new Date().toLocaleString("az-AZ", { timeZone: "Asia/Baku" })
  const line = `[${ts}] [${level}] ${msg}`
  console.log(line)
  if (data) console.log("  →", JSON.stringify(data, null, 2))
}
const info  = (m, d) => log("INFO ", m, d)
const warn  = (m, d) => log("WARN ", m, d)
const error = (m, d) => log("ERROR", m, d)
const ok    = (m, d) => log("OK   ", m, d)

// ── Hikvision ISAPI ───────────────────────────────────────────
function hikAuth() {
  return "Basic " + Buffer.from(`${HIK_USER}:${HIK_PASS}`).toString("base64")
}
function hikBase() { return `http://${HIK_IP}:${HIK_PORT}` }

async function hikGet(path) {
  const res = await fetch(hikBase() + path, {
    headers: { Authorization: hikAuth() },
    timeout: 10000,
  })
  return res
}

async function hikPost(path, body) {
  const res = await fetch(hikBase() + path, {
    method: "POST",
    headers: {
      Authorization: hikAuth(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    timeout: 15000,
  })
  return res
}

// ── Step 1: Diagnose device ───────────────────────────────────
async function diagnose() {
  info("Cihaz yoxlanılır...", { ip: HIK_IP, port: HIK_PORT, user: HIK_USER })
  try {
    const res = await hikGet("/ISAPI/System/deviceInfo")
    if (res.status === 401) {
      error("Authentication uğursuz! HIK_USER / HIK_PASS yoxlayın")
      return false
    }
    if (res.status === 404) {
      warn("deviceInfo endpoint tapılmadı — köhnə firmware? /ISAPI/System/status yoxlanılır...")
      const r2 = await hikGet("/ISAPI/System/status")
      if (!r2.ok) { error("Cihaz ISAPI-ni dəstəkləmir", { status: r2.status }); return false }
    } else if (!res.ok) {
      error("Cihaza qoşulmaq mümkün olmadı", { status: res.status })
      return false
    }
    const text = await res.text()
    const model = text.match(/<model>(.*?)<\/model>/)?.[1] ?? "naməlum"
    const sn    = text.match(/<serialNumber>(.*?)<\/serialNumber>/)?.[1] ?? "naməlum"
    ok(`Cihaz əlçatandır — Model: ${model}, SN: ${sn}`)
    return true
  } catch (e) {
    error(`Şəbəkə xətası: ${e.message}`)
    error("Cihazın IP və portu düzgündür?", { HIK_IP, HIK_PORT })
    return false
  }
}

// ── Step 2: Get persons ───────────────────────────────────────
async function getPersons() {
  info("Şəxslər alınır...")
  try {
    const res = await hikPost("/ISAPI/AccessControl/UserInfo/Search?format=json", {
      UserInfoSearchCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 1000,
      },
    })
    if (!res.ok) { warn("Şəxslər alınmadı", { status: res.status }); return [] }
    const json = await res.json()
    const list = json?.UserInfoSearch?.UserInfo ?? []
    ok(`${list.length} şəxs tapıldı`)
    // Return ONLY non-biometric fields
    return list.map(u => ({
      personId: String(u.employeeNo ?? u.userID ?? ""),
      name:     String(u.name ?? ""),
    }))
  } catch (e) {
    error(`Şəxslər xətası: ${e.message}`)
    return []
  }
}

// ── Step 3: Fetch events ──────────────────────────────────────
// AcsEvent returns: time, employeeNo, name, minor (event subtype)
// NO fingerprint templates — only event metadata
async function fetchEvents(startTime, endTime) {
  info(`Hadisələr alınır: ${startTime} → ${endTime}`)
  try {
    const res = await hikPost("/ISAPI/AccessControl/AcsEvent?format=json", {
      AcsEventCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 2000,
        major: 5,       // Access Control
        minor: 0,       // All subtypes
        startTime,
        endTime,
      },
    })
    if (!res.ok) {
      warn("Hadisələr alınmadı", { status: res.status })
      // Fallback: try without major/minor filter
      const res2 = await hikPost("/ISAPI/AccessControl/AcsEvent?format=json", {
        AcsEventCond: {
          searchID: "2",
          searchResultPosition: 0,
          maxResults: 2000,
          startTime,
          endTime,
        },
      })
      if (!res2.ok) { warn("Fallback da uğursuz", { status: res2.status }); return [] }
      const j2 = await res2.json()
      return parseEvents(j2)
    }
    const json = await res.json()
    return parseEvents(json)
  } catch (e) {
    error(`Hadisə xətası: ${e.message}`)
    return []
  }
}

function parseEvents(json) {
  const list = json?.AcsEvent?.InfoList ?? []
  const VERIFY_MAP = {
    0: "card", 1: "fingerprint", 3: "password",
    4: "card+fingerprint", 6: "face", 10: "card+password",
  }
  // Map event minor type to entry/exit
  // DS-K1A802AMF: 75=normal verify (entry), 76=exit (if two-reader setup)
  // Without door controller: most events are "unknown" direction
  const events = list
    .filter(e => e.employeeNoString || e.employeeNo)
    .map(e => ({
      personId:     String(e.employeeNoString ?? e.employeeNo ?? ""),
      employeeName: String(e.name ?? ""),
      eventTime:    String(e.time ?? ""),
      eventType:    e.minor === 76 ? "exit" : e.minor === 75 ? "entry" : "unknown",
      verifyMode:   VERIFY_MAP[e.currentVerifyMode] ?? "unknown",
      rawEventNo:   String(e.minor ?? ""),
      // !! No biometric template fields are included !!
    }))
    .filter(e => e.personId && e.eventTime)

  ok(`${events.length} hadisə parse edildi`)
  return events
}

// ── Step 4: Push to CRM ───────────────────────────────────────
async function pushToCRM(events) {
  if (!CRM_URL) { warn("CRM_URL təyin edilməyib — push atlandı"); return 0 }
  if (!events.length) { info("Push üçün hadisə yoxdur"); return 0 }

  info(`CRM-ə göndərilir: ${events.length} hadisə → ${CRM_URL}`)
  try {
    const res = await fetch(`${CRM_URL}/api/hikvision/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-secret": CRM_SECRET,
      },
      body: JSON.stringify({ events }),
      timeout: 30000,
    })
    if (!res.ok) {
      const text = await res.text()
      error("CRM push uğursuz", { status: res.status, body: text.slice(0, 300) })
      return 0
    }
    const data = await res.json()
    ok(`CRM cavabı`, data)
    return data.synced ?? events.length
  } catch (e) {
    error(`CRM push xətası: ${e.message}`)
    return 0
  }
}

// ── Sync window helpers ───────────────────────────────────────
function toHikTime(date) {
  return date.toISOString().replace("Z", TZ_OFFSET)
}

function getLastSyncTime() {
  try {
    const fs = require("fs")
    if (fs.existsSync(".last_sync")) {
      return new Date(fs.readFileSync(".last_sync", "utf8").trim())
    }
  } catch {}
  return null
}

function saveLastSyncTime(date) {
  require("fs").writeFileSync(".last_sync", date.toISOString())
}

// ── Main sync ─────────────────────────────────────────────────
async function syncCycle(isInitial = false) {
  const now = new Date()
  let startDate

  if (isInitial) {
    startDate = new Date(now.getTime() - INITIAL_DAYS * 24 * 60 * 60 * 1000)
    info(`=== İlkin sinxronizasiya: son ${INITIAL_DAYS} gün ===`)
  } else {
    const last = getLastSyncTime()
    startDate = last ?? new Date(now.getTime() - 10 * 60 * 1000) // last 10min fallback
    info(`=== Sinxronizasiya: ${startDate.toLocaleString()} → indi ===`)
  }

  const events = await fetchEvents(toHikTime(startDate), toHikTime(now))

  if (events.length) {
    const synced = await pushToCRM(events)
    info(`Sinxronizasiya tamamlandı: ${synced} hadisə CRM-ə yazıldı`)
  } else {
    info("Yeni hadisə tapılmadı")
  }

  saveLastSyncTime(now)
}

// ── Entry point ───────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60))
  console.log("  ITS Tour — Hikvision Bridge v1.0")
  console.log("  Cihaz:", `${HIK_IP}:${HIK_PORT}`)
  console.log("  CRM:  ", CRM_URL || "(təyin edilməyib)")
  console.log("=".repeat(60))

  if (!HIK_PASS) {
    error("HIK_PASS .env-də təyin edilməyib! Bridge dayandırılır.")
    process.exit(1)
  }
  if (!CRM_URL) {
    error("CRM_URL .env-də təyin edilməyib! Bridge dayandırılır.")
    process.exit(1)
  }
  if (!CRM_SECRET) {
    warn("CRM_SECRET təyin edilməyib — push-lar rədd edilə bilər")
  }

  // Diagnose first
  const alive = await diagnose()
  if (!alive) {
    error("Cihazla əlaqə qurmaq mümkün olmadı. Bridge dayandırılır.")
    process.exit(1)
  }

  // Get and log persons
  const persons = await getPersons()
  if (persons.length) {
    info("Şəxslər siyahısı:", persons.map(p => `${p.personId}: ${p.name}`))
  }

  if (ONCE) {
    // --once flag: do initial sync and exit
    await syncCycle(true)
    info("--once rejimi: bridge tamamlandı")
    process.exit(0)
  }

  // Initial sync on startup
  const hasLastSync = getLastSyncTime() !== null
  await syncCycle(!hasLastSync)

  // Periodic sync
  info(`Avtomatik sinxronizasiya hər ${INTERVAL_MS / 60000} dəqiqədə bir başlayır...`)
  setInterval(async () => {
    try {
      await syncCycle(false)
    } catch (e) {
      error(`Sinxronizasiya xətası: ${e.message}`)
    }
  }, INTERVAL_MS)

  // Graceful shutdown
  process.on("SIGINT",  () => { info("Bridge dayandırılır..."); process.exit(0) })
  process.on("SIGTERM", () => { info("Bridge dayandırılır..."); process.exit(0) })
}

main().catch(e => { error("Kritik xəta: " + e.message); process.exit(1) })
