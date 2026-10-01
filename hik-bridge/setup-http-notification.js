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
function parseDigest(w) {
  const p = {}; const re = /(\w+)="([^"]+)"/g; let m
  while ((m = re.exec(w)) !== null) p[m[1]] = m[2]; return p
}
function buildDigest(method, uri, p) {
  const nc = "00000001", cn = crypto.randomBytes(8).toString("hex")
  const ha1 = md5(`${HIK_USER}:${p.realm}:${HIK_PASS}`)
  const ha2  = md5(`${method}:${uri}`)
  const resp = md5(`${ha1}:${p.nonce}:${nc}:${cn}:${p.qop||"auth"}:${ha2}`)
  return `Digest username="${HIK_USER}", realm="${p.realm}", nonce="${p.nonce}", uri="${uri}", qop=${p.qop||"auth"}, nc=${nc}, cnonce="${cn}", response="${resp}"`
}

async function hikReq(method, path, body) {
  const url = `http://${HIK_IP}:${HIK_PORT}${path}`
  const headers = { "Content-Type": "application/xml" }
  const opts = { method, headers, body, timeout: 10000 }
  const r1 = await fetch(url, opts)
  if (r1.status !== 401) return r1
  const p = parseDigest(r1.headers.get("www-authenticate") || "")
  return fetch(url, { ...opts, headers: { ...headers, Authorization: buildDigest(method, path, p) } })
}

async function main() {
  console.log("=== Hikvision HTTP Notification Setup ===")
  console.log(`Cihaz: ${HIK_IP}:${HIK_PORT}`)
  console.log(`CRM:   ${CRM_URL}`)

  const url = new URL(CRM_URL)
  const host = url.hostname
  // Device requires port 1024-65535. Use 443 workaround via HTTPS on standard port.
  // Since capabilities show portNo min=1024, we use HTTP on port 8080 via a redirect
  // OR we use the CRM directly on port 443 but specify it differently.
  // Actually: portNo min=1024 means device won't accept 80 or 443.
  // Solution: Use Vercel's custom domain on port 8443 — but we don't have that.
  // Real solution: use port 443 anyway and see if device accepts it.
  // The capability says min=1024 but many devices accept 443 in practice.
  const port = 443

  // Exact XML matching device's own format (from read-config output)
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotificationList version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<HttpHostNotification version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<id>1</id>
<url>/api/hikvision/event</url>
<protocolType>HTTP</protocolType>
<parameterFormatType>XML</parameterFormatType>
<addressingFormatType>ipaddress</addressingFormatType>
<ipAddress>${host}</ipAddress>
<portNo>${port}</portNo>
<httpAuthenticationMethod>none</httpAuthenticationMethod>
<SubscribeEvent>
<eventMode>all</eventMode>
</SubscribeEvent>
</HttpHostNotification>
</HttpHostNotificationList>`

  console.log("\nGöndərilən XML:")
  console.log(xmlBody)

  const res = await hikReq("PUT", "/ISAPI/Event/notification/httpHosts", xmlBody)
  const text = await res.text()

  if (res.ok) {
    console.log("\n✅ Uğurlu! Cihaz hadisələri CRM-ə göndərəcək.")
  } else {
    console.log(`\n❌ XƏTA HTTP ${res.status}:`)
    console.log(text)

    // Try with port 8080 as fallback (not standard but some devices accept non-443)
    console.log("\nPort 8080 ilə yenidən cəhd edilir (fallback)...")
    const xml2 = xmlBody.replace(`<portNo>${port}</portNo>`, `<portNo>8080</portNo>`)
    const res2 = await hikReq("PUT", "/ISAPI/Event/notification/httpHosts", xml2)
    const text2 = await res2.text()
    if (res2.ok) {
      console.log("✅ Port 8080 ilə uğurlu!")
      console.log("⚠️  Vercel-də port 8080 açıq deyil — bu işləməyəcək.")
      console.log("Manual konfiqurasiya tələb olunur — aşağıya bax.")
    } else {
      console.log(`❌ Bu da uğursuz: ${text2.slice(0,200)}`)
      console.log("\n=== MANUAL KONFIQURASIYA ===")
      console.log("http://192.168.1.125 saytına girin:")
      console.log("Configuration → Network → Advanced Settings → Other")
      console.log("və ya: Configuration → Event → Alarm Server")
      console.log("Orada HTTP host olaraq təyin edin:")
      console.log(`  IP: ${host}`)
      console.log(`  Port: 443`)
      console.log(`  URL: /api/hikvision/event`)
      console.log(`  Protocol: HTTPS`)
    }
  }

  // Verify
  const ver = await hikReq("GET", "/ISAPI/Event/notification/httpHosts")
  console.log("\n=== Mövcud konfiqurasiya ===")
  console.log(await ver.text())
}

main().catch(e => { console.error("KRİTİK:", e.message); process.exit(1) })
