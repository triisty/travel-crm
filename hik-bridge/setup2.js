"use strict"
require("dotenv").config()
const fetch = require("node-fetch")
const crypto = require("crypto")

const HIK_IP   = process.env.HIK_IP   || "192.168.1.125"
const HIK_PORT = process.env.HIK_PORT || "80"
const HIK_USER = process.env.HIK_USER || "admin"
const HIK_PASS = process.env.HIK_PASS || ""
const CRM_HOST = "itstourcrm.vercel.app"

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
async function hikReq(method, path, body, contentType) {
  const url = `http://${HIK_IP}:${HIK_PORT}${path}`
  const headers = { "Content-Type": contentType || "application/xml" }
  const opts = { method, headers, body, timeout: 10000 }
  const r1 = await fetch(url, opts)
  if (r1.status !== 401) return r1
  const p = parseDigest(r1.headers.get("www-authenticate") || "")
  return fetch(url, { ...opts, headers: { ...headers, Authorization: buildDigest(method, path, p) } })
}

// Try different port values that might be accepted
const PORTS_TO_TRY = [2048, 4443, 8443, 9000, 1024]

async function tryPort(port) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotificationList version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<HttpHostNotification version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<id>1</id>
<url>/api/hikvision/event</url>
<protocolType>HTTP</protocolType>
<parameterFormatType>XML</parameterFormatType>
<addressingFormatType>ipaddress</addressingFormatType>
<ipAddress>${CRM_HOST}</ipAddress>
<portNo>${port}</portNo>
<httpAuthenticationMethod>none</httpAuthenticationMethod>
</HttpHostNotification>
</HttpHostNotificationList>`

  const res = await hikReq("PUT", "/ISAPI/Event/notification/httpHosts", xml)
  return res.ok
}

async function main() {
  console.log("Müxtəlif portlar sınaqdan keçirilir...")
  for (const port of PORTS_TO_TRY) {
    process.stdout.write(`  Port ${port}: `)
    const ok = await tryPort(port)
    console.log(ok ? "✅ QƏBUL EDİLDİ!" : "❌ rədd")
    if (ok) {
      console.log(`\n✅ Port ${port} işləyir!`)
      console.log(`Cihaz hadisələri buraya göndərəcək: http://${CRM_HOST}:${port}/api/hikvision/event`)
      console.log(`\nVercel bu portu dinləmir — Cloudflare Tunnel lazımdır.`)
      console.log(`Növbəti addım üçün adminə yazın.`)
      break
    }
  }
}
main().catch(console.error)
