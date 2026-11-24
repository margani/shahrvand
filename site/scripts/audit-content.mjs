// Audit of content/ against content/_coverage.md. Exit 0 = all checks passed, 1 = a check failed,
// 2 = the audit could not run (no coverage entries or no pages found). It exists because the content
// is written in bulk by another tool: a missing Persian twin, a page without sources or a link to a
// page that does not exist must be caught before a build ships it.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs"
import { join, dirname, resolve, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = process.argv[2] ? resolve(process.argv[2]) : resolve(dirname(fileURLToPath(import.meta.url)), "../../content")
const EN = ["Definition", "Why it matters", "How it works", "Contested points", "Examples", "Sources", "Further reading"]
const FA = ["تعریف", "چرا اهمیت دارد", "چگونه کار می‌کند", "نکات مورد مناقشه", "نمونه‌ها", "منابع", "مطالعه‌ی بیشتر"]
const fails = []
let checks = 0
const check = (cond, msg) => { checks++; if (!cond) fails.push(msg) }

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

const cov = readFileSync(join(root, "_coverage.md"), "utf8")
const entries = [...cov.matchAll(/^- \[( |x)\] ([a-z0-9-]+\/[a-z0-9-]+):/gm)].map((m) => ({ done: m[1] === "x", slug: m[2] }))
if (!entries.length) { console.error("audit: no coverage entries parsed"); process.exit(2) }
const listed = new Set(entries.map((e) => e.slug))

const pages = walk(root).filter((p) => p.endsWith(".md")).map((p) => relative(root, p).replaceAll("\\", "/"))
  .filter((p) => !p.startsWith("_") && !p.startsWith("index") && !p.startsWith("paths/"))
if (!pages.length) { console.error("audit: no pages found"); process.exit(2) }

for (const e of entries) {
  const en = existsSync(join(root, e.slug + ".md")), fa = existsSync(join(root, e.slug + ".fa.md"))
  if (e.done) check(en && fa, `${e.slug}: ticked but missing ${!en ? "English" : ""}${!en && !fa ? " and " : ""}${!fa ? "Persian" : ""} page`)
  else check(!(en && fa), `${e.slug}: both pages exist, tick the box in _coverage.md`)
}
for (const p of pages) {
  const slug = p.replace(/\.fa\.md$|\.md$/, "")
  check(listed.has(slug), `${p}: not listed in _coverage.md`)
}

function page(file) {
  const text = readFileSync(join(root, file), "utf8")
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text)
  check(!!fm, `${file}: no frontmatter`)
  const front = fm ? fm[1] : ""
  const body = fm ? text.slice(fm[0].length) : text
  check(/^title: .+/m.test(front), `${file}: no title`)
  check(/^description: .{20,}/m.test(front), `${file}: description missing or too short`)
  const fa = file.endsWith(".fa.md")
  const heads = [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim())
  const want = fa ? FA : EN
  check(JSON.stringify(heads) === JSON.stringify(want), `${file}: headings ${JSON.stringify(heads)} differ from the template`)
  const src = /(?:^|\n)## (?:Sources|منابع)\n([\s\S]*?)(?=\n## |(?![\s\S]))/.exec(body)
  const items = src ? src[1].split("\n").filter((l) => l.startsWith("- ")) : []
  check(items.length >= 2, `${file}: fewer than 2 sources`)
  for (const l of items) if (/https?:\/\//.test(l)) check(/Accessed \d{1,2} \w+ \d{4}/.test(l), `${file}: source with a URL has no access date: ${l.slice(0, 70)}`)
  for (const m of body.matchAll(/\]\(([^)\s]+)\)/g)) {
    const href = m[1].split("#")[0]
    if (!href || /^(https?:|mailto:)/.test(href)) continue
    const base = resolve(root, dirname(file), href)
    const ok = [base + (fa ? ".fa" : "") + ".md", base + ".md"].some(existsSync)
    check(ok, `${file}: broken link (${m[1]})`)
  }
  return heads
}
const heads = new Map(pages.map((p) => [p, page(p)]))
for (const p of pages.filter((p) => !p.endsWith(".fa.md"))) {
  const twin = p.replace(/\.md$/, ".fa.md")
  if (heads.has(twin)) check(heads.get(p).length === heads.get(twin).length, `${p}: section count differs from its Persian twin`)
}

console.log(`audit: ${pages.length} pages, ${entries.filter((e) => e.done).length}/${entries.length} topics done, ${checks} checks`)
if (fails.length) { console.error(fails.map((f) => "FAIL " + f).join("\n")); console.error(`${fails.length} failed`); process.exit(1) }
console.log("audit: all passed")
