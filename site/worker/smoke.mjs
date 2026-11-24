// Run against `wrangler dev -c wrangler.dev.jsonc` (see CLAUDE.md). Exit 1 on a failed check, 2 if it
// could not run, never 0 with nothing tested.
const base = process.argv[2]
if (!base) { console.error("usage: node worker/smoke.mjs <base-url>"); process.exit(2) }
let ran = 0, failed = 0
const check = (name, ok, extra = "") => { ran++; if (!ok) failed++; console.log(`${ok ? "ok  " : "FAIL"} ${name} ${ok ? "" : extra}`) }
const origin = new URL(base).origin
const jar = {}
const client = (id) => async (method, path, body, o = true) => {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(o ? { origin } : {}), ...(jar[id] ? { cookie: jar[id] } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  })
  const sc = res.headers.get("set-cookie")
  if (sc) jar[id] = sc.split(";")[0].endsWith("=") ? "" : sc.split(";")[0]
  return { status: res.status, headers: res.headers, data: await res.json().catch(() => null) }
}
const A = client("a"), B = client("b"), anon = client("anon")
const login = async (c, email) => {
  const r = await c("POST", "/auth/request", { email })
  const v = await c("POST", "/auth/verify", { email, code: r.data.devCode })
  return { r, v }
}

let r = await anon("GET", "/api/state")
check("anonymous state is 401", r.status === 401, JSON.stringify(r.data))
r = await anon("POST", "/auth/request", { email: "not-an-email" })
check("bad email rejected", r.status === 400)
r = await anon("POST", "/auth/verify", { email: "x@example.com", code: "123456" })
check("verify with no code issued fails", r.status === 400)

const a = await login(A, "Alice@Example.com")
check("sign in A", a.v.status === 200 && a.v.data.email === "alice@example.com", JSON.stringify(a.v))
const ck = a.v.headers.get("set-cookie") || ""
check("cookie is HttpOnly Secure SameSite", /HttpOnly/.test(ck) && /Secure/.test(ck) && /SameSite=Lax/.test(ck) && ck.startsWith("__Host-"), ck)
const req2 = await anon("POST", "/auth/request", { email: "carol@example.com" })
await anon("POST", "/auth/verify", { email: "carol@example.com", code: req2.data.devCode })
r = await anon("POST", "/auth/verify", { email: "carol@example.com", code: req2.data.devCode })
check("a code works once", r.status === 400)
const bad = await anon("POST", "/auth/request", { email: "dave@example.com" })
const wrong = bad.data.devCode === "000000" ? "111111" : "000000"
for (let i = 0; i < 5; i++) await anon("POST", "/auth/verify", { email: "dave@example.com", code: wrong })
r = await anon("POST", "/auth/verify", { email: "dave@example.com", code: bad.data.devCode })
check("5 wrong tries lock the code", r.status === 400)

r = await A("PUT", "/api/read", { slug: "foundations/the-state", value: true })
check("A marks read", r.status === 200)
await A("PUT", "/api/favorite", { slug: "foundations/the-state", value: true })
r = await A("POST", "/api/annotations", { slug: "foundations/the-state", quote: "Sovereignty", prefix: "", suffix: "", note: "mine", color: "green" })
const id = r.data?.id
check("A creates annotation", r.status === 201 && id)
r = await A("GET", "/api/state")
check("A state read back", r.data.read.includes("foundations/the-state") && r.data.favorites.includes("foundations/the-state") && r.data.email === "alice@example.com", JSON.stringify(r.data))

await login(B, "bob@example.com")
r = await B("GET", "/api/state")
check("B sees none of A's state", r.data.read.length === 0 && r.data.favorites.length === 0, JSON.stringify(r.data))
r = await B("GET", "/api/annotations?slug=foundations/the-state")
check("B sees none of A's annotations", r.data.annotations.length === 0)
r = await B("PATCH", `/api/annotations/${id}`, { note: "hijack" })
check("B cannot edit A's annotation", r.status === 404)
r = await B("DELETE", `/api/annotations/${id}`)
check("B cannot delete A's annotation", r.status === 404)
r = await A("GET", "/api/annotations?slug=foundations/the-state")
check("A's annotation untouched", r.data.annotations[0]?.note === "mine")

r = await A("PUT", "/api/read", { slug: "x", value: true }, false)
check("write without Origin refused", r.status === 403)
r = await A("PUT", "/api/read", { slug: "../x", value: true })
check("bad slug rejected", r.status === 400)
r = await A("GET", "/api/export")
check("export has A's data only", r.data.annotations.length === 1 && r.data.read.length === 1 && r.data.email === "alice@example.com")

r = await A("POST", "/auth/logout", {})
r = await A("GET", "/api/state")
check("after logout A is 401", r.status === 401)
await login(A, "alice@example.com")
r = await A("GET", "/api/state")
check("A's data survives a new sign-in", r.data.read.length === 1)
r = await A("DELETE", "/api/account")
check("delete account", r.status === 200)
await login(A, "alice@example.com")
r = await A("GET", "/api/state")
check("deleted data is gone", r.data.read.length === 0 && r.data.favorites.length === 0)

for (let i = 0; i < 6; i++) r = await anon("POST", "/auth/request", { email: "spam@example.com" })
check("rate limit per address", r.status === 429, String(r.status))
if (!ran) process.exit(2)
console.log(`${ran - failed}/${ran} passed`)
process.exit(failed ? 1 : 0)
