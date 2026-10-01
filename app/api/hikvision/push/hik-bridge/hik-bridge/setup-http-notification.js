// setup-http-notification.js
// Настраивает устройство DS-K1A802AMF для push событий на CRM
// Запусти ОДИН РАЗ: node setup-http-notification.js

"use strict"
require("dotenv").config()
const fetch = require("node-fetch")
const crypto = require("crypto")

const HIK_IP   = process.env.HIK_IP   || "192.168.1.125"
const HIK_PORT = process.env.HIK_PORT || "80"
const HIK_USER = process.env.HIK_USER || "admin"
const HIK_PASS = process.env.HIK_PASS || ""
const CRM_URL  = process.env.CRM_URL  || ""

function md5(s) { return crypto.createHash("md5").update(s).digest("hex") }

function parseDigest(wwwAuth) {
  const p = {}; const re = /(\w+)="([^"]+)"/g; let m
  while ((m = re.exec(wwwAuth)) !== null) p[m[1]] = m[2]
  return p
}

function buildDigest(method, uri, p) {
  const nc = "00000001", cnonce = crypto.randomBytes(8).toString("hex")
  const ha1 = md5(`${HIK_USER}:${p.realm}:${HIK_PASS}`)
  const ha2  = md5(`${method}:${uri}`)
  const resp = md5(`${ha1}:${p.nonce}:${nc}:${cnonce}:${p.qop || "auth"}:${ha2}`)
  return `Digest username="${HIK_USER}", realm="${p.realm}", nonce="${p.nonce}", uri="${uri}", qop=${p.qop || "auth"}, nc=${nc}, cnonce="${cnonce}", response="${resp}"`
}

async function hikReq(method, path, body) {
  const url = `http://${HIK_IP}:${HIK_PORT}${path}`
  const headers = { "Content-Type": "application/xml" }
  const opts = { method, headers, body, timeout: 10000 }
  const r1 = await fetch(url, opts)
  if (r1.status !== 401) return r1
  const wwwAuth = r1.headers.get("www-authenticate") || ""
  if (wwwAuth.toLowerCase().includes("digest")) {
    const p = parseDigest(wwwAuth)
    return fetch(url, { ...opts, headers: { ...headers, Authorization: buildDigest(method, path, p) } })
  }
  return fetch(url, { ...opts, headers: { ...headers, Authorization: "Basic " + Buffer.from(`${HIK_USER}:${HIK_PASS}`).toString("base64") } })
}

async function main() {
  console.log("=== Hikvision HTTP Notification Setup ===")
  console.log(`Cihaz: ${HIK_IP}:${HIK_PORT}`)
  console.log(`CRM:   ${CRM_URL}`)

  // Parse CRM URL
  const url = new URL(CRM_URL)
  const host = url.hostname
  const port = url.port || (url.protocol === "https:" ? "443" : "80")
  const proto = url.protocol === "https:" ? "HTTPS" : "HTTP"

  // 1. Check current httpHosts capability
  console.log("\n1. Mövcud konfiqurasiya yoxlanılır...")
  const getCap = await hikReq("GET", "/ISAPI/Event/notification/httpHosts")
  if (!getCap.ok && getCap.status !== 404) {
    console.error(`   XƏTA: HTTP ${getCap.status}`)
    console.error("   Bu cihaz HTTP Notification dəstəkləmir və ya endpoint fərqlidir")
    // Try alternative endpoint
    console.log("\n   Alternativ endpoint yoxlanılır...")
    const alt = await hikReq("GET", "/ISAPI/System/Network/httpHosts")
    console.log(`   Alternativ: HTTP ${alt.status}`)
    return
  }

  const currentXml = getCap.ok ? await getCap.text() : ""
  console.log("   Mövcud konfiqurasiya:", currentXml.slice(0, 200) || "(boş)")

  // 2. Set HTTP notification host
  console.log("\n2. HTTP Notification konfiqurasiya edilir...")
  const notifyPath = "/ISAPI/Event/notification/httpHosts"

  // XML payload — device will POST events to CRM
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotificationList version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <HttpHostNotification>
    <id>1</id>
    <url>/api/hikvision/event</url>
    <protocolType>${proto}</protocolType>
    <parameterFormatType>XML</parameterFormatType>
    <addressingFormatType>ipaddress</addressingFormatType>
    <ipAddress>${host}</ipAddress>
    <portNo>${port}</portNo>
    <httpAuthenticationMethod>none</httpAuthenticationMethod>
  </HttpHostNotification>
</HttpHostNotificationList>`

  const putRes = await hikReq("PUT", notifyPath, xmlBody)
  const putText = await putRes.text()

  if (putRes.ok || putRes.status === 200) {
    console.log("   ✅ HTTP Notification konfiqurasiya edildi!")
    console.log(`   Cihaz hadisələri buraya göndərəcək: ${proto}://${host}:${port}/api/hikvision/event`)
  } else {
    console.error(`   ❌ XƏTA: HTTP ${putRes.status}`)
    console.error("   Cavab:", putText.slice(0, 300))
    return
  }

  // 3. Verify
  console.log("\n3. Yoxlanılır...")
  const verRes = await hikReq("GET", notifyPath)
  const verText = await verRes.text()
  console.log("   Konfiqurasiya:", verText.slice(0, 400))

  console.log("\n=== TAMAMLANDI ===")
  console.log("Artıq cihaz hər attendance hadisəsini avtomatik CRM-ə göndərəcək.")
  console.log("Bridge-ə ehtiyac yoxdur — ПК söndürülə bilər.")
}

main().catch(e => { console.error("KRİTİK:", e.message); process.exit(1) })
