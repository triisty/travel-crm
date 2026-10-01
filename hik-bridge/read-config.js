"use strict"
require("dotenv").config()
const fetch = require("node-fetch")
const crypto = require("crypto")

const HIK_IP   = process.env.HIK_IP   || "192.168.1.125"
const HIK_PORT = process.env.HIK_PORT || "80"
const HIK_USER = process.env.HIK_USER || "admin"
const HIK_PASS = process.env.HIK_PASS || ""

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
async function hikGet(path) {
  const url = `http://${HIK_IP}:${HIK_PORT}${path}`
  const r1 = await fetch(url, { timeout: 10000 })
  if (r1.status !== 401) return r1
  const p = parseDigest(r1.headers.get("www-authenticate") || "")
  return fetch(url, { headers: { Authorization: buildDigest("GET", path, p) } })
}

async function main() {
  // Read full current httpHosts config
  console.log("=== Current httpHosts config ===")
  const r1 = await hikGet("/ISAPI/Event/notification/httpHosts")
  console.log("Status:", r1.status)
  console.log(await r1.text())

  // Read capabilities
  console.log("\n=== httpHosts capabilities ===")
  const r2 = await hikGet("/ISAPI/Event/notification/httpHosts/capabilities")
  console.log("Status:", r2.status)
  console.log(await r2.text())
}
main().catch(console.error)
