"use strict"
require("dotenv").config()
const fetch = require("node-fetch")
const crypto = require("crypto")

const HIK_IP      = process.env.HIK_IP       || "192.168.1.125"
const HIK_PORT    = process.env.HIK_PORT      || "80"
const HIK_USER    = process.env.HIK_USER      || "admin"
const HIK_PASS    = process.env.HIK_PASS      || ""
const CRM_URL     = process.env.CRM_URL       || ""
const CRM_SECRET  = process.env.CRM_SECRET    || ""
const INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MINUTES || "5") * 60 * 1000
const INITIAL_DAYS= parseInt(process.env.INITIAL_SYNC_DAYS || "30")
const TZ_OFFSET   = process.env.TZ_OFFSET     || "+04:00"
const ONCE        = process.argv.includes("--once")

function log(level, msg, data) {
  const ts = new Date().toLocaleString("az-AZ", { timeZone: "Asia/Baku" })
  console.log(`[${ts}] [${level}] ${msg}`)
  if (data) console.log("  →", JSON.stringify(data, null, 2))
}
const info  = (m, d) => log("INFO ", m, d)
const warn  = (m, d) => log("WARN ", m, d)
const error = (m, d) => log("ERROR", m, d)
const ok    = (m, d) => log("OK   ", m, d)

function md5(s) { return crypto.createHash("md5").update(s).digest("hex") }

// ── Digest Auth ───────────────────────────────────────────────
function parseDigestChallenge(wwwAuth) {
  const params = {}
  const re = /(\w+)="([^"]+)"/g
  let m
  while ((m = re.exec(wwwAuth)) !== null) params[m[1]] = m[2]
  return params
}

function buildDigestAuth(method, uri, params) {
  const nc = "00000001"
  const cnonce = crypto.randomBytes(8).toString("hex")
  const ha1 = md5(`${HIK_USER}:${params.realm}:${HIK_PASS}`)
  const ha2 = md5(`${method}:${uri}`)
  const response = md5(`${ha1}:${params.nonce}:${nc}:${cnonce}:${params.qop || "auth"}:${ha2}`)
  return `Digest username="${HIK_USER}", realm="${params.realm}", nonce="${params.nonce}", uri="${uri}", qop=${params.qop || "auth"}, nc=${nc}, cnonce="${cnonce}", response="${response}"`
}

async function hikRequest(method, path, body) {
  const url = `http://${HIK_IP}:${HIK_PORT}${path}`
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  }
  if (body) opts.body = JSON.stringify(body)

  // Step 1: initial request → get 401 + WWW-Authenticate
  const res1 = await fetch(url, opts)
  if (res1.status !== 401) return res1  // already ok or other error

  const wwwAuth = res1.headers.get("www-authenticate") || ""
  if (!wwwAuth.toLowerCase().includes("digest")) {
    // Try Basic as fallback
    const basicOpts = {
      ...opts,
      headers: {
        ...opts.headers,
        Authorization: "Basic " + Buffer.from(`${HIK_USER}:${HIK_PASS}`).toString("base64"),
      },
    }
    return fetch(url, basicOpts)
  }

  // Step 2: Digest auth
  const params = parseDigestChallenge(wwwAuth)
  const authHeader = buildDigestAuth(method, path, params)
  return fetch(url, {
    ...opts,
    headers: { ...opts.headers, Authorization: authHeader },
  })
}

// ── Diagnose ──────────────────────────────────────────────────
async function diagnose() {
  info("Cihaz yoxlanılır...", { ip: HIK_IP, port: HIK_PORT, user: HIK_USER })
  try {
    const res = await hikRequest("GET", "/ISAPI/System/deviceInfo")
    if (res.status === 401) {
      error("Authentication uğursuz! Parol yanlışdır.")
      return false
    }
    if (!res.ok) {
      warn(`HTTP ${res.status} — /ISAPI/System/status yoxlanılır...`)
      const r2 = await hikRequest("GET", "/ISAPI/System/status")
      if (!r2.ok) { error("Cihaz ISAPI-ni dəstəkləmir", { status: r2.status }); return false }
    }
    const text = await res.text()
    const model = text.match(/<model>(.*?)<\/model>/)?.[1] ?? "naməlum"
    const sn    = text.match(/<serialNumber>(.*?)<\/serialNumber>/)?.[1] ?? "naməlum"
    ok(`Cihaz əlçatandır — Model: ${model}, SN: ${sn}`)
    return true
  } catch (e) {
    error(`Şəbəkə xətası: ${e.message}`)
    return false
  }
}

// ── Get persons ───────────────────────────────────────────────
async function getPersons() {
  info("Şəxslər alınır...")
  try {
    const res = await hikRequest("POST",
      "/ISAPI/AccessControl/UserInfo/Search?format=json",
      { UserInfoSearchCond: { searchID: "1", searchResultPosition: 0, maxResults: 1000 } }
    )
    if (!res.ok) { warn("Şəxslər alınmadı", { status: res.status }); return [] }
    const json = await res.json()
    const list = json?.UserInfoSearch?.UserInfo ?? []
    ok(`${list.length} şəxs tapıldı`)
    return list.map(u => ({
      personId: String(u.employeeNo ?? u.userID ?? ""),
      name: String(u.name ?? ""),
    }))
  } catch (e) {
    error(`Şəxslər xətası: ${e.message}`)
    return []
  }
}

// ── Fetch events ──────────────────────────────────────────────
async function fetchEvents(startTime, endTime) {
  info(`Hadisələr alınır: ${startTime} → ${endTime}`)
  const VERIFY_MAP = { 0:"card",1:"fingerprint",3:"password",4:"card+fingerprint",6:"face",10:"card+password" }

  async function tryFetch(body) {
    const res = await hikRequest("POST", "/ISAPI/AccessControl/AcsEvent?format=json", body)
    if (!res.ok) return null
    return res.json()
  }

  let json = await tryFetch({
    AcsEventCond: { searchID:"1", searchResultPosition:0, maxResults:2000, major:5, minor:0, startTime, endTime }
  })
  if (!json) {
    warn("major/minor filtri uğursuz, filtersiz yoxlanılır...")
    json = await tryFetch({
      AcsEventCond: { searchID:"2", searchResultPosition:0, maxResults:2000, startTime, endTime }
    })
  }
  if (!json) { warn("Hadisə alınmadı"); return [] }

  const list = json?.AcsEvent?.InfoList ?? []
  const events = list
    .filter(e => e.employeeNoString || e.employeeNo)
    .map(e => ({
      personId:     String(e.employeeNoString ?? e.employeeNo ?? ""),
      employeeName: String(e.name ?? ""),
      eventTime:    String(e.time ?? ""),
      eventType:    e.minor === 76 ? "exit" : e.minor === 75 ? "entry" : "unknown",
      verifyMode:   VERIFY_MAP[e.currentVerifyMode] ?? "unknown",
      rawEventNo:   String(e.minor ?? ""),
    }))
    .filter(e => e.personId && e.eventTime)

  ok(`${events.length} hadisə parse edildi`)
  return events
}

// ── Push to CRM ───────────────────────────────────────────────
async function pushToCRM(events) {
  if (!CRM_URL) { warn("CRM_URL yoxdur"); return 0 }
  if (!events.length) { info("Göndəriləcək hadisə yoxdur"); return 0 }
  info(`CRM-ə göndərilir: ${events.length} hadisə`)
  try {
    const res = await fetch(`${CRM_URL}/api/hikvision/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bridge-secret": CRM_SECRET },
      body: JSON.stringify({ events }),
      timeout: 30000,
    })
    if (!res.ok) {
      const t = await res.text()
      error("CRM push uğursuz", { status: res.status, body: t.slice(0,300) })
      return 0
    }
    const data = await res.json()
    ok("CRM cavabı", data)
    return data.synced ?? events.length
  } catch (e) {
    error(`CRM push xətası: ${e.message}`)
    return 0
  }
}

function toHikTime(date) { return date.toISOString().replace("Z", TZ_OFFSET) }

function getLastSyncTime() {
  try {
    const fs = require("fs")
    if (fs.existsSync(".last_sync")) return new Date(fs.readFileSync(".last_sync","utf8").trim())
  } catch {}
  return null
}
function saveLastSyncTime(d) { require("fs").writeFileSync(".last_sync", d.toISOString()) }

async function syncCycle(isInitial = false) {
  const now = new Date()
  let startDate
  if (isInitial) {
    startDate = new Date(now.getTime() - INITIAL_DAYS * 24 * 60 * 60 * 1000)
    info(`=== İlkin sinxronizasiya: son ${INITIAL_DAYS} gün ===`)
  } else {
    startDate = getLastSyncTime() ?? new Date(now.getTime() - 10 * 60 * 1000)
    info(`=== Sinxronizasiya: ${startDate.toLocaleString()} → indi ===`)
  }
  const events = await fetchEvents(toHikTime(startDate), toHikTime(now))
  if (events.length) {
    const synced = await pushToCRM(events)
    info(`Tamamlandı: ${synced} hadisə CRM-ə yazıldı`)
  } else {
    info("Yeni hadisə tapılmadı")
  }
  saveLastSyncTime(now)
}

async function main() {
  console.log("=".repeat(60))
  console.log("  ITS Tour — Hikvision Bridge v1.1 (Digest Auth)")
  console.log("  Cihaz:", `${HIK_IP}:${HIK_PORT}`)
  console.log("  CRM:  ", CRM_URL || "(yoxdur)")
  console.log("=".repeat(60))

  if (!HIK_PASS) { error("HIK_PASS təyin edilməyib!"); process.exit(1) }
  if (!CRM_URL)  { error("CRM_URL təyin edilməyib!"); process.exit(1) }

  const alive = await diagnose()
  if (!alive) { error("Cihazla əlaqə yoxdur."); process.exit(1) }

  const persons = await getPersons()
  if (persons.length) info("Şəxslər:", persons.map(p => `${p.personId}: ${p.name}`))

  if (ONCE) { await syncCycle(true); info("Tamamlandı."); process.exit(0) }

  await syncCycle(!getLastSyncTime())
  info(`Hər ${INTERVAL_MS/60000} dəqiqədə sinxronizasiya...`)
  setInterval(async () => { try { await syncCycle(false) } catch(e) { error(e.message) } }, INTERVAL_MS)
  process.on("SIGINT",  () => { info("Dayandırılır..."); process.exit(0) })
  process.on("SIGTERM", () => { info("Dayandırılır..."); process.exit(0) })
}

main().catch(e => { error("Kritik: " + e.message); process.exit(1) })
