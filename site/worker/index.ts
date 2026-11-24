// Reader accounts: email one-time code -> session cookie. Pages are static assets; only /api/* and
// /auth/* run this Worker. Every personal row is scoped by user_id taken from the session, never from
// the request, so one reader can never name another reader's data.
type Env = {
  DB: D1Database
  ASSETS: Fetcher
  EMAIL?: { send(m: { to: string; from: string | { email: string; name?: string }; subject: string; text: string }): Promise<unknown> }
  MAIL_FROM: string
  // Secret that keys the code hash. Without it sign-in refuses to run rather than weakening itself.
  CODE_KEY?: string
  // Local tests only: return the code in the response instead of emailing it. Never set in production.
  DEV_RETURN_CODE?: string
}

const COLORS = new Set(["yellow", "green", "blue", "pink"])
const SLUG = /^[a-z0-9][a-z0-9\-_/.%]{0,199}$/
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}$/
const MAX_QUOTE = 2000, MAX_CONTEXT = 200, MAX_NOTE = 10000
const CODE_TTL_MS = 10 * 60 * 1000
const SESSION_TTL_MS = 60 * 24 * 3600 * 1000
const MAX_ATTEMPTS = 5
const PER_EMAIL_PER_HOUR = 5
const PER_IP_PER_HOUR = 20
const COOKIE = "__Host-shahrvand"

class BadRequest extends Error {}

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  })

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("")
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))
async function hmac(key: string, s: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(s)))
}
function equal(a: string, b: string) {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}
// Rejection sampling keeps the six digits uniform (a plain modulo would favour low numbers).
function newCode() {
  const buf = new Uint32Array(1)
  const limit = 4294967296 - (4294967296 % 1000000)
  do {
    crypto.getRandomValues(buf)
  } while (buf[0] >= limit)
  return String(buf[0] % 1000000).padStart(6, "0")
}
const newToken = () => hex(crypto.getRandomValues(new Uint8Array(32)).buffer)

function slugOf(v: unknown): string {
  if (typeof v !== "string" || !SLUG.test(v)) throw new BadRequest("Bad slug")
  return v
}
function text(v: unknown, field: string, max: number, required = false): string {
  if (v === undefined && !required) return ""
  if (typeof v !== "string" || v.length > max || (required && v.length === 0)) throw new BadRequest(`Bad ${field}`)
  return v
}
async function body(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) throw new BadRequest("JSON body required")
  const data = await request.json().catch(() => null)
  if (typeof data !== "object" || data === null || Array.isArray(data)) throw new BadRequest("Bad body")
  return data as Record<string, unknown>
}

function cookieOf(request: Request, name: string) {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=")
    if (k === name) return v.join("=")
  }
  return null
}
const setCookie = (token: string, maxAge: number) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`

async function userOf(request: Request, env: Env): Promise<{ id: string; email: string } | null> {
  const token = cookieOf(request, COOKIE)
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null
  return env.DB.prepare(
    "SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
  )
    .bind(await sha256(token), new Date().toISOString())
    .first<{ id: string; email: string }>()
}

async function startSession(env: Env, userId: string) {
  const token = newToken()
  const now = Date.now()
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256(token), userId, new Date(now + SESSION_TTL_MS).toISOString(), new Date(now).toISOString())
    .run()
  return token
}

async function authRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const now = new Date()
  const iso = now.toISOString()
  if (request.method !== "POST") return json({ error: "Not found" }, 404)

  if (url.pathname === "/auth/request") {
    if (!env.CODE_KEY) return json({ error: "Sign-in is not configured on this server (CODE_KEY missing)." }, 503)
    const b = await body(request)
    const email = text(b.email, "email", 320, true).trim().toLowerCase()
    if (!EMAIL.test(email)) throw new BadRequest("Bad email")
    const ip = request.headers.get("cf-connecting-ip") ?? ""
    const since = new Date(now.getTime() - 3600_000).toISOString()
    const [perEmail, perIp] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS n FROM login_codes WHERE email = ? AND created_at > ?").bind(email, since).first<{ n: number }>(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM login_codes WHERE ip = ? AND created_at > ?").bind(ip, since).first<{ n: number }>(),
    ])
    if ((perEmail?.n ?? 0) >= PER_EMAIL_PER_HOUR || (ip && (perIp?.n ?? 0) >= PER_IP_PER_HOUR)) {
      return json({ error: "Too many codes requested. Try again later." }, 429)
    }
    const code = newCode()
    const id = crypto.randomUUID()
    await env.DB.prepare("INSERT INTO login_codes (id, email, code_hash, ip, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, email, await hmac(env.CODE_KEY, `${email}:${code}`), ip, new Date(now.getTime() + CODE_TTL_MS).toISOString(), iso)
      .run()
    if (env.DEV_RETURN_CODE === "1") return json({ sent: true, devCode: code })
    if (!env.EMAIL) return json({ error: "Email sending is not configured on this server." }, 503)
    try {
      await env.EMAIL.send({
        to: email,
        from: { email: env.MAIL_FROM, name: "Shahrvand" },
        subject: `${code} is your Shahrvand code`,
        text: `Your Shahrvand sign-in code is ${code}\n\nIt works once and expires in 10 minutes. If you did not ask for it, ignore this message.\n\nکد ورود شما به شهروند: ${code}\nاین کد یک‌بار مصرف است و تا ۱۰ دقیقه اعتبار دارد.`,
      })
    } catch (e) {
      await env.DB.prepare("DELETE FROM login_codes WHERE id = ?").bind(id).run()
      console.error("send failed", e instanceof Error ? e.message : e)
      return json({ error: `Could not send the email from ${env.MAIL_FROM}. Check that this sending domain is onboarded.` }, 502)
    }
    // Same answer whether or not the address already has an account.
    return json({ sent: true })
  }

  if (url.pathname === "/auth/verify") {
    if (!env.CODE_KEY) return json({ error: "Sign-in is not configured on this server (CODE_KEY missing)." }, 503)
    const b = await body(request)
    const email = text(b.email, "email", 320, true).trim().toLowerCase()
    const code = text(b.code, "code", 6, true)
    if (!/^\d{6}$/.test(code)) throw new BadRequest("Bad code")
    const row = await env.DB.prepare(
      "SELECT id, code_hash, attempts FROM login_codes WHERE email = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1",
    ).bind(email, iso).first<{ id: string; code_hash: string; attempts: number }>()
    const bad = () => json({ error: "That code is wrong or expired." }, 400)
    if (!row || row.attempts >= MAX_ATTEMPTS) return bad()
    if (!equal(row.code_hash, await hmac(env.CODE_KEY, `${email}:${code}`))) {
      await env.DB.prepare("UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?").bind(row.id).run()
      return bad()
    }
    // Single use: delete before issuing the session, and only continue if this call deleted it.
    const used = await env.DB.prepare("DELETE FROM login_codes WHERE id = ?").bind(row.id).run()
    if (!used.meta.changes) return bad()
    await env.DB.prepare("INSERT OR IGNORE INTO users (id, email, created_at) VALUES (?, ?, ?)").bind(crypto.randomUUID(), email, iso).run()
    const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>()
    if (!user) return json({ error: "Server error" }, 500)
    const token = await startSession(env, user.id)
    return json({ email }, 200, { "set-cookie": setCookie(token, SESSION_TTL_MS / 1000) })
  }

  if (url.pathname === "/auth/logout") {
    const token = cookieOf(request, COOKIE)
    if (token && /^[0-9a-f]{64}$/.test(token)) {
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run()
    }
    return json({ ok: true }, 200, { "set-cookie": setCookie("", 0) })
  }
  return json({ error: "Not found" }, 404)
}

async function route(request: Request, env: Env, url: URL, uid: string, email: string): Promise<Response> {
  const method = request.method
  const now = new Date().toISOString()

  if (method === "GET" && url.pathname === "/api/state") {
    const [read, favorites] = await Promise.all([
      env.DB.prepare("SELECT slug FROM read_topics WHERE user_id = ? ORDER BY read_at").bind(uid).all<{ slug: string }>(),
      env.DB.prepare("SELECT slug FROM favorites WHERE user_id = ? ORDER BY created_at").bind(uid).all<{ slug: string }>(),
    ])
    return json({ email, read: read.results.map((r) => r.slug), favorites: favorites.results.map((r) => r.slug) })
  }
  if (method === "GET" && url.pathname === "/api/annotations") {
    const slug = slugOf(url.searchParams.get("slug"))
    const rows = await env.DB.prepare(
      "SELECT id, quote, prefix, suffix, note, color, created_at, updated_at FROM annotations WHERE user_id = ? AND slug = ? ORDER BY created_at",
    ).bind(uid, slug).all()
    return json({ annotations: rows.results })
  }
  if (method === "GET" && url.pathname === "/api/all") {
    const rows = await env.DB.prepare(
      "SELECT id, slug, quote, note, color, created_at, updated_at FROM annotations WHERE user_id = ? ORDER BY created_at DESC LIMIT 2000",
    ).bind(uid).all()
    return json({ annotations: rows.results })
  }
  // Everything the site holds about the reader, for them to keep.
  if (method === "GET" && url.pathname === "/api/export") {
    const [read, favs, ann] = await Promise.all([
      env.DB.prepare("SELECT slug, read_at FROM read_topics WHERE user_id = ?").bind(uid).all(),
      env.DB.prepare("SELECT slug, created_at FROM favorites WHERE user_id = ?").bind(uid).all(),
      env.DB.prepare("SELECT slug, quote, prefix, suffix, note, color, created_at, updated_at FROM annotations WHERE user_id = ?").bind(uid).all(),
    ])
    return json({ email, read: read.results, favorites: favs.results, annotations: ann.results })
  }
  if (method === "DELETE" && url.pathname === "/api/account") {
    // Foreign keys cascade to sessions and every personal table.
    await env.DB.batch([
      env.DB.prepare("DELETE FROM login_codes WHERE email = ?").bind(email),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(uid),
      env.DB.prepare("DELETE FROM read_topics WHERE user_id = ?").bind(uid),
      env.DB.prepare("DELETE FROM favorites WHERE user_id = ?").bind(uid),
      env.DB.prepare("DELETE FROM annotations WHERE user_id = ?").bind(uid),
      env.DB.prepare("DELETE FROM users WHERE id = ?").bind(uid),
    ])
    return json({ ok: true }, 200, { "set-cookie": setCookie("", 0) })
  }

  const flag = (table: "read_topics" | "favorites", col: "read_at" | "created_at") => async () => {
    const b = await body(request)
    const slug = slugOf(b.slug)
    if (typeof b.value !== "boolean") throw new BadRequest("Bad value")
    await (b.value
      ? env.DB.prepare(`INSERT OR REPLACE INTO ${table} (user_id, slug, ${col}) VALUES (?, ?, ?)`).bind(uid, slug, now)
      : env.DB.prepare(`DELETE FROM ${table} WHERE user_id = ? AND slug = ?`).bind(uid, slug)
    ).run()
    return json({ slug, value: b.value })
  }
  if (method === "PUT" && url.pathname === "/api/read") return flag("read_topics", "read_at")()
  if (method === "PUT" && url.pathname === "/api/favorite") return flag("favorites", "created_at")()

  if (method === "POST" && url.pathname === "/api/annotations") {
    const b = await body(request)
    const slug = slugOf(b.slug)
    const color = typeof b.color === "string" && COLORS.has(b.color) ? b.color : "yellow"
    const row = {
      id: crypto.randomUUID(),
      quote: text(b.quote, "quote", MAX_QUOTE, true),
      prefix: text(b.prefix, "prefix", MAX_CONTEXT),
      suffix: text(b.suffix, "suffix", MAX_CONTEXT),
      note: text(b.note, "note", MAX_NOTE),
      color,
    }
    await env.DB.prepare(
      "INSERT INTO annotations (id, user_id, slug, quote, prefix, suffix, note, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(row.id, uid, slug, row.quote, row.prefix, row.suffix, row.note, row.color, now, now).run()
    return json({ ...row, created_at: now, updated_at: now }, 201)
  }
  const one = /^\/api\/annotations\/([0-9a-f-]{36})$/.exec(url.pathname)
  if (one && method === "PATCH") {
    const b = await body(request)
    const note = text(b.note, "note", MAX_NOTE)
    const color = typeof b.color === "string" && COLORS.has(b.color) ? b.color : null
    const res = await env.DB.prepare("UPDATE annotations SET note = ?, color = COALESCE(?, color), updated_at = ? WHERE id = ? AND user_id = ?")
      .bind(note, color, now, one[1], uid).run()
    return res.meta.changes ? json({ id: one[1], note, updated_at: now }) : json({ error: "Not found" }, 404)
  }
  if (one && method === "DELETE") {
    const res = await env.DB.prepare("DELETE FROM annotations WHERE id = ? AND user_id = ?").bind(one[1], uid).run()
    return res.meta.changes ? json({ id: one[1] }) : json({ error: "Not found" }, 404)
  }
  return json({ error: "Not found" }, 404)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const isAuth = url.pathname.startsWith("/auth/")
    if (!isAuth && !url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request)
    try {
      // The cookie is SameSite=Lax; this also stops a cross-site form or fetch from writing.
      if (request.method !== "GET" && request.headers.get("origin") !== url.origin) {
        return json({ error: "Cross-origin write refused" }, 403)
      }
      if (isAuth) return await authRoute(request, env, url)
      const user = await userOf(request, env)
      if (!user) return json({ error: "Sign in required" }, 401)
      return await route(request, env, url, user.id, user.email)
    } catch (e) {
      if (e instanceof BadRequest) return json({ error: e.message }, 400)
      console.error("shahrvand api error", e instanceof Error ? e.stack : e)
      return json({ error: "Server error" }, 500)
    }
  },
}
