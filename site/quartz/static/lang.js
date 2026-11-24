// Site-wide language. The site is bilingual as a whole: one switch (next to the dark-mode button)
// sets the language of every page, link, Explorer entry, path box and interface string.
// A Persian topic is the file name.fa.md next to name.md (slug "x/name.fa"); every topic is expected
// to have both. The choice is saved in localStorage "shahrvand.lang" only when the reader clicks the
// switch. Before that, the language of the page being read is the site language, so a shared Persian
// link is never bounced to English by a browser default.
//  - saved "fa" on an English page (or "en" on a Persian one) moves to the twin;
//  - links, popovers, the Explorer and the learning-path box point at the twin of the chosen language;
//  - a link whose twin does not exist falls back to the page that does, never to a 404.
;(function () {
  var FA = /\.fa$/
  var KEY = "shahrvand.lang"
  var FOLDERS = { paths: "مسیرها", foundations: "مبانی", institutions: "نهادها", rights: "حقوق" }
  // Interface strings Quartz renders in English. An unknown string is left as it is.
  var UI = {
    Explorer: "فهرست",
    "Graph View": "نمای گراف",
    "Table of Contents": "فهرست مطالب",
    Backlinks: "پیوندهای ورودی",
    "Documents version": "نسخهٔ مستندات",
    "Learning paths": "مسیرهای یادگیری",
  }
  function stored() {
    try {
      var v = localStorage.getItem(KEY)
      return v === "fa" || v === "en" ? v : null
    } catch (e) {
      return null
    }
  }
  function pageIsFa() {
    return FA.test(document.body.dataset.slug || "")
  }
  // Language the reader chose, or failing that the language of this page.
  function lang() {
    return stored() || (pageIsFa() ? "fa" : "en")
  }
  function index() {
    return Promise.resolve(typeof fetchData !== "undefined" ? fetchData : {}).then(function (d) {
      return (d && d.content) || d || {}
    })
  }
  // Writing the same value back is still a DOM mutation and would re-fire the observer forever,
  // so every write goes through these two, which do nothing when the value is already right.
  function setText(e, v) {
    if (e && e.textContent !== v) e.textContent = v
  }
  function setAttr(e, k, v) {
    if (e && e.getAttribute(k) !== v) e.setAttribute(k, v)
  }
  function slugOf(a) {
    return (
      a.getAttribute("data-slug") ||
      decodeURIComponent((a.getAttribute("href") || "").split("#")[0])
        .replace(/^[./]+/, "")
        .replace(/^\//, "")
    )
  }

  function go(slug) {
    location.assign("/" + (slug === "index" ? "" : slug))
  }
  function twinOf(d, s, toFa) {
    var base = s.replace(FA, "")
    var t = toFa ? base + ".fa" : base
    return d[t] ? t : null
  }

  // The switch. It lives in the same flex row as the dark-mode button; Quartz re-renders that row on
  // navigation, so it is re-added whenever it is missing.
  function ensureSwitch(d, L) {
    var host = document.querySelector(".darkmode")
    host = host && host.parentElement && host.parentElement.parentElement
    if (!host) return
    var b = host.querySelector(".ps-sitelang")
    if (!b) {
      b = el("button", "ps-sitelang")
      b.type = "button"
      b.addEventListener("click", function () {
        var next = lang() === "fa" ? "en" : "fa"
        try {
          localStorage.setItem(KEY, next)
        } catch (e) {}
        var t = twinOf(d, document.body.dataset.slug || "index", next === "fa")
        if (t && t !== document.body.dataset.slug) go(t)
        else location.reload()
      })
      host.appendChild(b)
    }
    // The button names the language it switches to.
    setText(b, L === "fa" ? "EN" : "فا")
    setAttr(b, "lang", L === "fa" ? "en" : "fa")
    var label = L === "fa" ? "Switch the site to English" : "تغییر زبان سایت به فارسی"
    setAttr(b, "aria-label", label)
    setAttr(b, "title", label)
  }
  function el(t, c) {
    var e = document.createElement(t)
    if (c) e.className = c
    return e
  }

  // Everything below runs for the chosen language and is idempotent (see setText).
  function toTwins(d, toFa) {
    // Body links, backlinks, popover targets: href and data-slug move to the chosen language.
    document.querySelectorAll("a[data-slug]").forEach(function (a) {
      var t = a.getAttribute("data-slug")
      var want = twinOf(d, t, toFa)
      if (!want || want === t) return
      setAttr(a, "data-slug", want)
      var h = a.getAttribute("href") || ""
      var i = h.indexOf("#")
      var hash = i >= 0 ? h.slice(i) : ""
      var path = i >= 0 ? h.slice(0, i) : h
      setAttr(a, "href", toFa ? path + ".fa" + hash : path.replace(/\.fa$/, "") + hash)
    })
    // Explorer entries.
    document.querySelectorAll(".explorer a.nav-file-title").forEach(function (a) {
      var t = slugOf(a)
      var want = twinOf(d, t, toFa)
      if (!want) return
      setText(a, d[want].title)
      setAttr(a, "href", "/" + want)
      setAttr(a, "lang", toFa ? "fa" : "en")
    })
  }
  function translateUi(d) {
    document.querySelectorAll(".explorer .folder-title").forEach(function (sp) {
      var a = sp.closest("a")
      var seg = ((a && a.getAttribute("href")) || "").replace(/^\/|\/$/g, "")
      if (FOLDERS[seg]) setText(sp, FOLDERS[seg])
    })
    document.querySelectorAll("h2, h3").forEach(function (h) {
      var t = h.textContent.trim()
      if (UI[t]) setText(h, UI[t])
    })
    document.querySelectorAll(".breadcrumb-element a").forEach(function (a) {
      var h = a.getAttribute("href") || ""
      var seg = h.replace(/^[./]+|\/$/g, "")
      if (/^(\.\.?\/)*$/.test(h) || h === "/") setText(a, "خانه")
      else if (FOLDERS[seg]) setText(a, FOLDERS[seg])
    })
    var q = document.querySelector(".search input, input.search-bar")
    setAttr(q, "placeholder", "جستجو…")
    document.querySelectorAll(".search-button p").forEach(function (p) {
      if (p.textContent.trim() === "Search") setText(p, "جستجو")
    })
    // "3 min read" and the date on the page; the date keeps the Gregorian calendar, in Persian digits.
    document.querySelectorAll(".content-meta span").forEach(function (sp) {
      var m = /^(\d+) min read$/.exec(sp.textContent.trim())
      if (m) setText(sp, Number(m[1]).toLocaleString("fa-IR") + " دقیقه مطالعه")
    })
    document.querySelectorAll(".content-meta time").forEach(function (t) {
      var dt = new Date(t.getAttribute("datetime"))
      if (!isNaN(dt)) setText(t, dt.toLocaleDateString("fa-IR-u-ca-gregory", { year: "numeric", month: "long", day: "numeric" }))
    })
    document.querySelectorAll("footer p, footer span").forEach(function (p) {
      var m = /^(\d+) topics$/.exec(p.textContent.trim())
      if (m) setText(p, Number(m[1]).toLocaleString("fa-IR") + " مطلب")
    })
  }

  function sync(d) {
    var L = lang()
    var toFa = L === "fa"
    document.documentElement.lang = toFa ? "fa" : "en"
    ensureSwitch(d, L)
    toTwins(d, toFa)
    if (toFa) translateUi(d)
  }

  var watching = null
  function apply() {
    var s = document.body.dataset.slug
    if (!s) return
    index().then(function (d) {
      // A saved choice that disagrees with this page: go to the twin.
      var st = stored()
      if (st && st !== (pageIsFa() ? "fa" : "en")) {
        var t = twinOf(d, s, st === "fa")
        if (t) return go(t)
      }
      document.documentElement.classList.remove("lang-pending")
      sync(d)
      if (watching) watching.disconnect()
      watching = new MutationObserver(function () {
        sync(d)
      })
      watching.observe(document.body, { childList: true, subtree: true })
    })
  }
  // Sticky title row: shift `top` up by the breadcrumb row so only the title row stays visible.
  function stick() {
    var h = document.querySelector(".page-header"),
      t = document.querySelector(".article-title")
    if (!h || !t) return
    var off = t.getBoundingClientRect().top - h.getBoundingClientRect().top
    document.documentElement.style.setProperty("--ps-stick", -off + "px")
  }
  apply()
  stick()
  document.addEventListener("nav", function () {
    apply()
    stick()
  })
  window.addEventListener("resize", stick)
  window.addEventListener("load", stick)
})()
