// Reader accounts: sign in with an emailed one-time code (/auth/*), then read marks, favorites,
// highlights and notes are kept per reader through /api/* (D1). A visitor who never signs in sees the
// plain site plus a "Sign in" link, and a build with no Worker (a local static server) behaves the same.
// Annotations are anchored by quote + surrounding text rather than offsets so they survive edits.
(function () {
  var state = null // { read:Set, favorites:Set, email }
  // Interface strings in both languages; the site language is <html lang>, set by lang.js.
  var FA = {
    "Reader mode (full screen, no distractions)": "حالت مطالعه (تمام‌صفحه، بدون حواس‌پرتی)",
    "Read (click to unmark)": "خوانده شد (برای برداشتن علامت کلیک کنید)",
    "Mark as read": "علامت «خوانده شد»",
    "Favorite (click to remove)": "مورد علاقه (برای برداشتن کلیک کنید)",
    "Add to favorites": "افزودن به موردعلاقه‌ها",
    "Could not save. Are you signed in?": "ذخیره نشد. آیا وارد شده‌اید؟",
    Favorites: "موردعلاقه‌ها",
    Highlight: "هایلایت", Note: "یادداشت", Save: "ذخیره", Delete: "حذف", Close: "بستن",
    "Could not delete": "حذف نشد", "Could not save": "ذخیره نشد",
    "Notes and highlights": "یادداشت‌ها و هایلایت‌ها",
    All: "همه", Notes: "یادداشت‌ها", Highlights: "هایلایت‌ها", "Loading…": "در حال بارگذاری…",
    "Nothing yet. Select text in a topic to highlight it or add a note.": "هنوز چیزی نیست. در یک مطلب متنی را انتخاب کنید تا هایلایت یا یادداشت اضافه شود.",
    "Nothing here yet.": "اینجا هنوز چیزی نیست.", "Could not load.": "بارگذاری نشد.",
    "Sign in": "ورود", "Sign out": "خروج",
    "Export my data": "دریافت داده‌های من", "Delete my account": "حذف حساب من",
    "Delete your account and everything saved with it? This cannot be undone.": "حساب و همهٔ چیزهایی که با آن ذخیره شده حذف شود؟ این کار برگشت‌پذیر نیست.",
    "Sign in to keep your reading progress, favorites, highlights and notes.": "برای نگه‌داشتن پیشرفت مطالعه، موردعلاقه‌ها، هایلایت‌ها و یادداشت‌هایتان وارد شوید.",
    "We only store your email address. No password: we send a six-digit code.": "فقط نشانی ایمیل شما ذخیره می‌شود. رمز عبور لازم نیست: یک کد شش‌رقمی می‌فرستیم.",
    Email: "ایمیل", "Send code": "ارسال کد", Code: "کد", "Check code": "بررسی کد",
    "We sent a code to": "کدی فرستادیم به", "Use another email": "ایمیل دیگر",
    "Something went wrong. Try again.": "مشکلی پیش آمد. دوباره تلاش کنید.",
  }
  function T(k) { return document.documentElement.lang === "fa" && FA[k] ? FA[k] : k }
  var colors = ["yellow", "green", "blue", "pink"]
  var CTX = 40
  // Icon-only buttons; the accessible name and tooltip are set in paintBar. Static markup, no user text.
  var ICON_READ = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/></svg>'
  var ICON_STAR = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/></svg>'

  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e }
  function api(method, path, body) {
    return fetch(path, {
      method: method,
      credentials: "same-origin",
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      if (!r.ok) throw new Error(method + " " + path + " " + r.status)
      return r.json()
    })
  }
  function titles() { return Promise.resolve(typeof fetchData !== "undefined" ? fetchData : {}).then(function (d) { return (d && d.content) || d || {} }) }
  function slug() { return document.body.dataset.slug }
  // Read and Favorite belong to the topic, not to a language: name.fa is the Persian twin of name.
  // Highlights and notes stay per page, because the quoted text differs between the languages.
  function topic(s) { return s.replace(/\.fa$/, "") }

  // ---- read marks and favorites on every internal link ----
  function decorate() {
    if (!state) return
    // Explorer file links carry no data-slug, only an href like /kubernetes/containers.
    document.querySelectorAll("a[data-slug], .explorer a.nav-file-title").forEach(function (a) {
      var s = topic(a.getAttribute("data-slug") || decodeURIComponent(a.getAttribute("href") || "").replace(/^\//, ""))
      a.classList.toggle("ps-read", state.read.has(s))
      a.classList.toggle("ps-fav", state.favorites.has(s))
    })
  }
  var pending = null
  new MutationObserver(function () {
    if (pending) return
    pending = setTimeout(function () { pending = null; decorate() }, 60)
  }).observe(document.body, { childList: true, subtree: true })

  // ---- toolbar: mark as read, favorite ----
  function toggle(kind, s, btn) {
    var set = kind === "read" ? state.read : state.favorites
    var next = !set.has(s)
    if (next) set.add(s); else set.delete(s)
    paintBar(); decorate(); renderFavorites()
    api("PUT", kind === "read" ? "/api/read" : "/api/favorite", { slug: s, value: next }).catch(function () {
      if (next) set.delete(s); else set.add(s)
      paintBar(); decorate(); renderFavorites()
      btn.title = T("Could not save. Are you signed in?")
    })
  }
  function paintBar() {
    var bar = document.getElementById("ps-bar"); if (!bar) return
    var s = topic(slug())
    var r = bar.querySelector(".ps-read-btn"), f = bar.querySelector(".ps-fav-btn")
    var isRead = state.read.has(s), isFav = state.favorites.has(s)
    r.classList.toggle("on", isRead); f.classList.toggle("on", isFav)
    r.innerHTML = ICON_READ; f.innerHTML = ICON_STAR
    r.title = r.ariaLabel = T(isRead ? "Read (click to unmark)" : "Mark as read")
    f.title = f.ariaLabel = T(isFav ? "Favorite (click to remove)" : "Add to favorites")
    r.setAttribute("aria-pressed", state.read.has(s)); f.setAttribute("aria-pressed", state.favorites.has(s))
  }
  var ICON_READER = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5.5C5.5 4.5 9 4.5 12 6.5c3-2 6.5-2 9-1V19c-2.5-1-6-1-9 1-3-2-6.5-2-9-1z"/><path d="M12 6.5V20"/></svg>'
  function renderBar() {
    var old = document.getElementById("ps-bar"); if (old) old.remove()
    var s = slug(), art = document.querySelector("article")
    if (!s || !art || s === "index" || s.indexOf("paths/") === 0 && s === "paths/index") return
    var bar = el("div", "ps-bar"); bar.id = "ps-bar"
    var r = el("button", "ps-btn ps-read-btn"); r.type = "button"
    var f = el("button", "ps-btn ps-fav-btn"); f.type = "button"
    r.addEventListener("click", function () { toggle("read", topic(s), r) })
    f.addEventListener("click", function () { toggle("favorite", topic(s), f) })
    var rd = el("button", "ps-btn ps-reader-btn"); rd.type = "button"; rd.innerHTML = ICON_READER
    rd.title = rd.ariaLabel = T("Reader mode (full screen, no distractions)")
    rd.addEventListener("click", function () { if (window.psReader) window.psReader.toggle() })
    bar.appendChild(rd); if (state) { bar.appendChild(r); bar.appendChild(f) }
    // Into the header grid so the buttons share the title row; the article body is a separate
    // element, so fall back to it only if the title is missing.
    var title = document.querySelector(".article-title"), host = title && title.parentElement
    if (host) host.appendChild(bar); else art.insertBefore(bar, art.firstChild)
    if (state) paintBar()
  }

  // ---- favorites list in the right sidebar ----
  function renderFavorites() {
    var old = document.getElementById("ps-favs"); if (old) old.remove()
    var side = document.querySelector(".sidebar.right"); if (!side || !state.favorites.size) return
    titles().then(function (d) {
      var box = el("div", "ps-panel"); box.id = "ps-favs"
      box.appendChild(el("h3", "ps-heading", T("Favorites")))
      var ul = el("ul")
      Array.from(state.favorites).forEach(function (s) {
        if (!d[s]) return
        var fa = document.documentElement.lang === "fa" && d[s + ".fa"] ? s + ".fa" : s
        var li = el("li"), a = el("a", "internal", d[fa].title); a.href = "/" + fa; a.setAttribute("data-slug", fa)
        li.appendChild(a); ul.appendChild(li)
      })
      if (!ul.children.length) return
      box.appendChild(ul)
      var again = document.getElementById("ps-favs"); if (again) again.remove()
      side.appendChild(box); decorate()
    })
  }

  // ---- annotations ----
  var notes = [] // for the current page
  function textNodes(root) {
    var out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        for (var p = n.parentNode; p && p !== root; p = p.parentNode) {
          if (p.nodeType === 1 && (p.id === "ps-bar" || p.classList.contains("ps-ui") || p.tagName === "SCRIPT" || p.tagName === "STYLE")) return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      },
    })
    while (w.nextNode()) out.push(w.currentNode)
    return out
  }
  function locate(root, a) {
    var nodes = textNodes(root), full = "", map = []
    nodes.forEach(function (n) { map.push({ n: n, start: full.length }); full += n.nodeValue })
    var idx = -1
    var withCtx = (a.prefix || "") + a.quote + (a.suffix || "")
    var c = full.indexOf(withCtx)
    if (c >= 0) idx = c + (a.prefix || "").length
    else idx = full.indexOf(a.quote)
    if (idx < 0) return null
    return { start: idx, end: idx + a.quote.length, map: map }
  }
  function wrap(loc, a) {
    var marks = []
    loc.map.forEach(function (m) {
      var len = m.n.nodeValue.length, s = Math.max(loc.start, m.start), e = Math.min(loc.end, m.start + len)
      if (s >= e) return
      var node = m.n
      if (e - m.start < len) node.splitText(e - m.start)
      if (s - m.start > 0) node = node.splitText(s - m.start)
      var mk = el("mark", "ps-mark ps-" + a.color + (a.note ? " has-note" : ""))
      mk.setAttribute("data-ann", a.id)
      node.parentNode.replaceChild(mk, node); mk.appendChild(node)
      marks.push(mk)
    })
    return marks
  }
  function unwrapAll() {
    document.querySelectorAll("mark.ps-mark").forEach(function (m) {
      var p = m.parentNode; while (m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); p.normalize()
    })
  }
  function paintAnnotations() {
    unwrapAll()
    var art = document.querySelector("article"); if (!art) return
    var lost = []
    notes.forEach(function (a) {
      var loc = locate(art, a)
      if (!loc) { lost.push(a); return }
      wrap(loc, a)
    })
    // Arriving from the global list: scroll to the highlight named in the hash and flash it.
    var m = /^#ann-([0-9a-f-]{36})$/.exec(location.hash)
    if (m) {
      var target = document.querySelector('mark.ps-mark[data-ann="' + m[1] + '"]')
      if (target) {
        target.scrollIntoView({ block: "center" }); target.classList.add("ps-flash")
        setTimeout(function () { target.classList.remove("ps-flash") }, 2000)
      }
    }
    var old = document.getElementById("ps-lost"); if (old) old.remove()
    if (lost.length) {
      var box = el("details", "ps-lost ps-ui"); box.id = "ps-lost"
      box.appendChild(el("summary", null, document.documentElement.lang === "fa" ? lost.length + " یادداشت که متنش تغییر کرده" : lost.length + " note" + (lost.length > 1 ? "s" : "") + " whose text changed"))
      lost.forEach(function (a) {
        var row = el("div", "ps-lost-row")
        row.appendChild(el("blockquote", null, a.quote))
        if (a.note) row.appendChild(el("p", null, a.note))
        var del = el("button", "ps-btn small", T("Delete")); del.type = "button"
        del.addEventListener("click", function () { removeAnn(a.id) })
        row.appendChild(del); box.appendChild(row)
      })
      var bar = document.getElementById("ps-bar"); if (bar) bar.after(box)
    }
  }
  function loadAnnotations() {
    var s = slug(); if (!s) return
    api("GET", "/api/annotations?slug=" + encodeURIComponent(s)).then(function (r) {
      if (slug() !== s) return
      notes = r.annotations; paintAnnotations()
    }).catch(function () {})
  }
  function removeAnn(id) {
    api("DELETE", "/api/annotations/" + id).then(function () {
      notes = notes.filter(function (n) { return n.id !== id }); closePop(); paintAnnotations()
    }).catch(function () { alert(T("Could not delete")) })
  }

  // ---- popup for a text selection, and for an existing mark ----
  var pop = null
  function closePop() { if (pop) { pop.remove(); pop = null } }
  function place(box, rect) {
    document.body.appendChild(box)
    var w = box.offsetWidth
    var left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2 + window.scrollX), window.scrollX + document.documentElement.clientWidth - w - 8)
    box.style.left = left + "px"
    box.style.top = (rect.bottom + window.scrollY + 8) + "px"
  }
  function colorRow(current, onPick) {
    var row = el("div", "ps-colors")
    colors.forEach(function (c) {
      var b = el("button", "ps-dot ps-" + c); b.type = "button"; b.title = c
      b.setAttribute("aria-label", c); if (c === current) b.classList.add("on")
      b.addEventListener("click", function () { onPick(c) })
      row.appendChild(b)
    })
    return row
  }
  function contextOf(range, art) {
    var nodes = textNodes(art), full = "", start = -1, end = -1
    nodes.forEach(function (n) {
      if (n === range.startContainer) start = full.length + range.startOffset
      if (n === range.endContainer) end = full.length + range.endOffset
      full += n.nodeValue
    })
    if (start < 0 || end < 0 || end <= start) return null
    return { quote: full.slice(start, end), prefix: full.slice(Math.max(0, start - CTX), start), suffix: full.slice(end, end + CTX) }
  }
  function selectionPopup() {
    var sel = window.getSelection()
    var art = document.querySelector("article")
    if (!state || !art || !sel || sel.isCollapsed || !sel.rangeCount) return
    var range = sel.getRangeAt(0)
    if (!art.contains(range.commonAncestorContainer) || (pop && pop.contains(range.commonAncestorContainer))) return
    var ctx = contextOf(range, art); if (!ctx || !ctx.quote.trim() || ctx.quote.length > 2000) return
    var rect = range.getBoundingClientRect()
    closePop()
    pop = el("div", "ps-pop ps-ui")
    var hl = el("button", "ps-btn", T("Highlight")); hl.type = "button"
    var nt = el("button", "ps-btn", T("Note")); nt.type = "button"
    function save(note, color) {
      var body = { slug: slug(), quote: ctx.quote, prefix: ctx.prefix, suffix: ctx.suffix, note: note || "", color: color || "yellow" }
      api("POST", "/api/annotations", body).then(function (a) {
        notes.push(a); sel.removeAllRanges(); closePop(); paintAnnotations()
      }).catch(function () { alert(T("Could not save")) })
    }
    hl.addEventListener("click", function () { save("", "yellow") })
    nt.addEventListener("click", function () {
      pop.textContent = ""
      var ta = el("textarea", "ps-text"); ta.rows = 3; ta.placeholder = T("Note"); ta.setAttribute("dir", "auto")
      var color = "yellow"
      var row = colorRow(color, function (c) {
        color = c; row.querySelectorAll(".ps-dot").forEach(function (d) { d.classList.toggle("on", d.title === c) })
      })
      var ok = el("button", "ps-btn", T("Save")); ok.type = "button"
      ok.addEventListener("click", function () { save(ta.value, color) })
      pop.appendChild(ta); pop.appendChild(row); pop.appendChild(ok); ta.focus()
    })
    pop.appendChild(hl); pop.appendChild(nt)
    place(pop, rect)
  }
  function markPopup(mk) {
    var a = notes.filter(function (n) { return n.id === mk.getAttribute("data-ann") })[0]; if (!a) return
    closePop()
    pop = el("div", "ps-pop ps-ui")
    var ta = el("textarea", "ps-text"); ta.rows = 3; ta.value = a.note; ta.placeholder = T("Note"); ta.setAttribute("dir", "auto")
    var color = a.color
    var row = colorRow(color, function (c) {
      color = c; row.querySelectorAll(".ps-dot").forEach(function (d) { d.classList.toggle("on", d.title === c) })
    })
    var ok = el("button", "ps-btn", T("Save")); ok.type = "button"
    var del = el("button", "ps-btn danger", T("Delete")); del.type = "button"
    ok.addEventListener("click", function () {
      api("PATCH", "/api/annotations/" + a.id, { note: ta.value, color: color }).then(function () {
        a.note = ta.value; a.color = color; closePop(); paintAnnotations()
      }).catch(function () { alert(T("Could not save")) })
    })
    del.addEventListener("click", function () { removeAnn(a.id) })
    pop.appendChild(ta); pop.appendChild(row); pop.appendChild(ok); pop.appendChild(del)
    place(pop, mk.getBoundingClientRect())
  }

  document.addEventListener("mouseup", function (e) {
    if (!state || (pop && pop.contains(e.target))) return
    var mk = e.target.closest && e.target.closest("mark.ps-mark")
    setTimeout(function () {
      var sel = window.getSelection()
      if (sel && !sel.isCollapsed) selectionPopup()
      else if (mk) markPopup(mk)
      else closePop()
    }, 0)
  })
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closePop(); closePanel() } })

  // ---- global list of highlights and notes ----
  var ICON_LIST = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg>'
  var panelFilter = "all"
  function closePanel() { var p = document.getElementById("ps-panel-all"); if (p) p.remove() }
  function openPanel() {
    closePanel()
    var box = el("aside", "ps-all ps-ui"); box.id = "ps-panel-all"; box.setAttribute("aria-label", T("Notes and highlights"))
    var head = el("div", "ps-all-head")
    head.appendChild(el("strong", null, T("Notes and highlights")))
    var close = el("button", "ps-btn ps-icon", "×"); close.type = "button"; close.title = close.ariaLabel = T("Close")
    close.addEventListener("click", closePanel); head.appendChild(close); box.appendChild(head)
    var tabs = el("div", "ps-tabs")
    var body = el("div", "ps-all-body")
    ;[["all", T("All")], ["notes", T("Notes")], ["highlights", T("Highlights")]].forEach(function (t) {
      var b = el("button", "ps-btn small" + (panelFilter === t[0] ? " on" : ""), t[1]); b.type = "button"
      b.addEventListener("click", function () { panelFilter = t[0]; openPanel() })
      tabs.appendChild(b)
    })
    box.appendChild(tabs); box.appendChild(body); document.body.appendChild(box)
    body.textContent = T("Loading…")
    Promise.all([api("GET", "/api/all"), titles()]).then(function (res) {
      var list = res[0].annotations.filter(function (a) {
        return panelFilter === "all" || (panelFilter === "notes" ? a.note : !a.note)
      })
      body.textContent = ""
      if (!list.length) {
        body.appendChild(el("p", "ps-empty", T(panelFilter === "all" ? "Nothing yet. Select text in a topic to highlight it or add a note." : "Nothing here yet.")))
        return
      }
      var groups = {}, order = []
      list.forEach(function (a) { if (!groups[a.slug]) { groups[a.slug] = []; order.push(a.slug) } groups[a.slug].push(a) })
      order.forEach(function (s) {
        var sec = el("section", "ps-group")
        var h = el("a", "ps-group-title internal", (res[1][s] && res[1][s].title) || s); h.href = "/" + s
        h.addEventListener("click", closePanel); sec.appendChild(h)
        groups[s].forEach(function (a) {
          var row = el("a", "ps-item internal ps-b-" + a.color); row.href = "/" + s + "#ann-" + a.id
          row.addEventListener("click", closePanel)
          row.appendChild(el("span", "ps-quote", a.quote.length > 160 ? a.quote.slice(0, 160) + "…" : a.quote))
          if (a.note) row.appendChild(el("span", "ps-note", a.note))
          row.querySelectorAll("span").forEach(function (x) { x.setAttribute("dir", "auto") })
          sec.appendChild(row)
        })
        body.appendChild(sec)
      })
    }).catch(function () { body.textContent = T("Could not load.") })
  }
  function mountPanelButton() {
    if (document.getElementById("ps-open-all")) return
    var b = el("button", "ps-btn ps-fab"); b.type = "button"; b.id = "ps-open-all"; b.innerHTML = ICON_LIST
    b.title = b.ariaLabel = T("Notes and highlights")
    b.addEventListener("click", function () { if (document.getElementById("ps-panel-all")) closePanel(); else openPanel() })
    document.body.appendChild(b)
  }

  // ---- sign in / out ----
  function post(path, body) {
    return fetch(path, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {} }).then(function (d) { if (!r.ok) throw new Error(d.error || T("Something went wrong. Try again.")); return d }) })
  }
  function closeDialog() { var d = document.getElementById("ps-dialog"); if (d) d.remove() }
  // Two steps in one dialog: email, then the six-digit code. Text only goes in via textContent.
  function openDialog() {
    closeDialog()
    var wrap = el("div", "ps-dialog-bg ps-ui"); wrap.id = "ps-dialog"
    var box = el("form", "ps-dialog"); box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true")
    wrap.appendChild(box); wrap.addEventListener("mousedown", function (e) { if (e.target === wrap) closeDialog() })
    var err = el("p", "ps-dialog-err"); err.setAttribute("role", "alert")
    function msg(m) { err.textContent = m || "" }
    function stepEmail() {
      box.textContent = ""
      box.appendChild(el("p", null, T("Sign in to keep your reading progress, favorites, highlights and notes.")))
      box.appendChild(el("p", "ps-dialog-small", T("We only store your email address. No password: we send a six-digit code.")))
      var inp = el("input", "ps-input"); inp.type = "email"; inp.required = true; inp.autocomplete = "email"; inp.placeholder = T("Email"); inp.setAttribute("aria-label", T("Email")); inp.dir = "ltr"
      var go = el("button", "ps-btn ps-go", T("Send code")); go.type = "submit"
      box.appendChild(inp); box.appendChild(go); box.appendChild(err)
      box.onsubmit = function (e) {
        e.preventDefault(); msg(""); go.disabled = true
        post("/auth/request", { email: inp.value }).then(function () { stepCode(inp.value.trim().toLowerCase()) })
          .catch(function (x) { msg(x.message); go.disabled = false })
      }
      inp.focus()
    }
    function stepCode(email) {
      box.textContent = ""
      var p = el("p"); p.appendChild(document.createTextNode(T("We sent a code to") + " ")); p.appendChild(el("bdi", null, email)); box.appendChild(p)
      var inp = el("input", "ps-input"); inp.inputMode = "numeric"; inp.autocomplete = "one-time-code"; inp.maxLength = 6; inp.pattern = "[0-9]{6}"; inp.required = true; inp.placeholder = T("Code"); inp.setAttribute("aria-label", T("Code")); inp.dir = "ltr"
      var go = el("button", "ps-btn ps-go", T("Check code")); go.type = "submit"
      var back = el("button", "ps-btn small", T("Use another email")); back.type = "button"; back.addEventListener("click", stepEmail)
      box.appendChild(inp); box.appendChild(go); box.appendChild(back); box.appendChild(err)
      box.onsubmit = function (e) {
        e.preventDefault(); msg(""); go.disabled = true
        post("/auth/verify", { email: email, code: inp.value.trim() }).then(function () { location.reload() })
          .catch(function (x) { msg(x.message); go.disabled = false })
      }
      inp.focus()
    }
    stepEmail(); document.body.appendChild(wrap)
  }
  function authLinks(signedIn) {
    var old = document.getElementById("ps-auth"); if (old) old.remove()
    var foot = document.querySelector("footer"); if (!foot) return
    var box = el("p", "ps-auth"); box.id = "ps-auth"
    function link(label, fn) { var a = el("a", null, T(label)); a.href = "#"; a.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); fn() }); return a }
    function sep() { return document.createTextNode(" · ") }
    if (!signedIn) box.appendChild(link("Sign in", openDialog))
    else {
      var who = el("bdi", "ps-who", state.email); box.appendChild(who); box.appendChild(sep())
      box.appendChild(link("Export my data", function () { location.assign("/api/export") })); box.appendChild(sep())
      box.appendChild(link("Delete my account", function () {
        if (confirm(T("Delete your account and everything saved with it? This cannot be undone."))) {
          fetch("/api/account", { method: "DELETE", credentials: "same-origin" }).then(function () { location.reload() })
        }
      })); box.appendChild(sep())
      box.appendChild(link("Sign out", function () { post("/auth/logout").then(function () { location.reload() }, function () { location.reload() }) }))
    }
    foot.appendChild(box)
  }

  // ---- boot ----
  function page() {
    closePop(); renderBar()
    if (!state) return
    renderFavorites(); decorate()
    notes = []; loadAnnotations()
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDialog() })
  api("GET", "/api/state").then(function (s) {
    state = { email: s.email, read: new Set(s.read), favorites: new Set(s.favorites) }
    document.documentElement.classList.add("ps-on")
    mountPanelButton()
    page(); authLinks(true)
    document.addEventListener("nav", function () { page(); authLinks(true) })
  }).catch(function (e) {
    // 401 = a visitor who is not signed in. A network error or a build with no Worker gets no link.
    page()
    document.addEventListener("nav", page)
    if (!/ 401$/.test(String(e && e.message))) return
    authLinks(false)
    document.addEventListener("nav", function () { authLinks(false) })
  })
})()
