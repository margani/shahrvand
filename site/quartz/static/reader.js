// Reader mode: a distraction-free view of one topic (like a browser's reader mode).
// The mode itself always starts off; the choices (width, colour theme, text size) are kept in
// localStorage so the next time it opens the way it was left. They live in the browser, not in D1,
// because they are a display preference of this device.
;(function () {
  var KEY = "shahrvand.reader.v1"
  var DEFAULTS = { theme: "warm", width: "medium", size: "0", screen: "screen" }
  var THEMES = [["site", "Site"], ["warm", "Warm"], ["cool", "Cool"]]
  var WIDTHS = [["narrow", "Narrow"], ["medium", "Medium"], ["wide", "Wide"], ["full", "Full"]]
  var SCREENS = [["window", "Window"], ["screen", "Screen"]]
  var MAXSTEP = 3 // text size is a step from -3 to +3; 0 is the normal size
  var LEGACY = { s: "-1", m: "0", l: "1" } // values saved by the first version
  var root = document.documentElement
  var cfg = load()
  var ownsFullscreen = false

  function load() {
    var c = {}
    try { c = JSON.parse(localStorage.getItem(KEY) || "{}") || {} } catch (e) { c = {} }
    var out = {}
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = typeof c[k] === "string" ? c[k] : DEFAULTS[k] })
    // A stored value this version does not know falls back to the default, not to a broken layout.
    if (!THEMES.some(function (t) { return t[0] === out.theme })) out.theme = DEFAULTS.theme
    if (!WIDTHS.some(function (t) { return t[0] === out.width })) out.width = DEFAULTS.width
    if (!SCREENS.some(function (t) { return t[0] === out.screen })) out.screen = DEFAULTS.screen
    var n = parseInt(LEGACY[out.size] || out.size, 10)
    out.size = String(isNaN(n) ? 0 : Math.max(-MAXSTEP, Math.min(MAXSTEP, n)))
    return out
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)) } catch (e) {} }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e }
  function isOn() { return root.classList.contains("ps-reader") }

  function apply() {
    root.setAttribute("data-ps-theme", cfg.theme)
    root.setAttribute("data-ps-width", cfg.width)
    root.setAttribute("data-ps-size", cfg.size)
    var p = document.getElementById("ps-reader-panel")
    if (!p) return
    var n = parseInt(cfg.size, 10)
    p.querySelector(".ps-rd-level").textContent = n > 0 ? "+" + n : n < 0 ? "−" + -n : "0"
    p.querySelector("button[data-step='-1']").disabled = n <= -MAXSTEP
    p.querySelector("button[data-step='1']").disabled = n >= MAXSTEP
    p.querySelectorAll("button[data-k]").forEach(function (b) {
      var on = cfg[b.getAttribute("data-k")] === b.getAttribute("data-v")
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", on)
    })
  }

  function group(label, key, items) {
    var row = el("div", "ps-rd-row"); row.appendChild(el("span", "ps-rd-label", label))
    var box = el("div", "ps-rd-group")
    items.forEach(function (it) {
      var b = el("button", "ps-rd-opt", it[1]); b.type = "button"
      b.setAttribute("data-k", key); b.setAttribute("data-v", it[0])
      b.addEventListener("click", function () { cfg[key] = it[0]; save(); apply(); if (key === "screen") syncFullscreen() })
      box.appendChild(b)
    })
    row.appendChild(box); return row
  }
  // Text size: three steps smaller and three larger; a click on the level goes back to normal.
  function stepper() {
    var row = el("div", "ps-rd-row"); row.appendChild(el("span", "ps-rd-label", "Text"))
    var box = el("div", "ps-rd-group")
    function step(by) { var n = Math.max(-MAXSTEP, Math.min(MAXSTEP, parseInt(cfg.size, 10) + by)); cfg.size = String(n); save(); apply() }
    var less = el("button", "ps-rd-opt", "A−"); less.type = "button"; less.setAttribute("data-step", "-1"); less.title = "Smaller text"
    var more = el("button", "ps-rd-opt", "A+"); more.type = "button"; more.setAttribute("data-step", "1"); more.title = "Larger text"
    var lvl = el("button", "ps-rd-opt ps-rd-level"); lvl.type = "button"; lvl.title = "Normal size"
    less.addEventListener("click", function () { step(-1) }); more.addEventListener("click", function () { step(1) })
    lvl.addEventListener("click", function () { cfg.size = "0"; save(); apply() })
    box.appendChild(less); box.appendChild(lvl); box.appendChild(more); row.appendChild(box); return row
  }
  function panel() {
    var old = document.getElementById("ps-reader-panel"); if (old) return old
    var p = el("div", "ps-ui"); p.id = "ps-reader-panel"
    var top = el("div", "ps-rd-top")
    var gear = el("button", "ps-rd-btn", "Aa"); gear.type = "button"; gear.title = "Reading settings"; gear.setAttribute("aria-expanded", "false")
    var exit = el("button", "ps-rd-btn", "Exit"); exit.type = "button"; exit.title = "Leave reader mode (Esc)"
    var opts = el("div", "ps-rd-opts"); opts.hidden = true
    opts.appendChild(group("Display", "screen", SCREENS)); opts.appendChild(group("Width", "width", WIDTHS)); opts.appendChild(group("Theme", "theme", THEMES)); opts.appendChild(stepper())
    gear.addEventListener("click", function () { opts.hidden = !opts.hidden; gear.setAttribute("aria-expanded", String(!opts.hidden)) })
    exit.addEventListener("click", off)
    top.appendChild(gear); top.appendChild(exit); p.appendChild(top); p.appendChild(opts)
    document.body.appendChild(p)
    return p
  }

  function on() {
    root.classList.add("ps-reader"); panel(); apply()
    syncFullscreen()
  }
  // Screen = whole monitor, Window = the browser window only. Called from a click, which is the
  // user gesture fullscreen needs; refused or unsupported (iPhone) it simply stays in-window.
  function syncFullscreen() {
    try {
      if (cfg.screen === "screen") {
        if (root.requestFullscreen && !document.fullscreenElement) {
          ownsFullscreen = true
          var r = root.requestFullscreen()
          if (r && r.catch) r.catch(function () { ownsFullscreen = false })
        }
      } else if (document.fullscreenElement) {
        // Clear the flag first so the fullscreenchange handler does not also leave reader mode.
        ownsFullscreen = false; document.exitFullscreen()
      }
    } catch (e) { ownsFullscreen = false }
  }
  function off() {
    root.classList.remove("ps-reader")
    var p = document.getElementById("ps-reader-panel"); if (p) p.remove()
    if (ownsFullscreen && document.fullscreenElement) { try { document.exitFullscreen() } catch (e) {} }
    ownsFullscreen = false
  }
  function toggle() { if (isOn()) off(); else on() }

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !isOn()) return
    var opts = document.querySelector("#ps-reader-panel .ps-rd-opts")
    if (opts && !opts.hidden) { opts.hidden = true; return }
    off()
  })
  // Leaving full screen with the browser's own Esc also leaves reader mode.
  document.addEventListener("fullscreenchange", function () { if (ownsFullscreen && !document.fullscreenElement && isOn()) off() })
  // Quartz navigation replaces the body, so the panel is put back; the mode carries over to the next topic.
  document.addEventListener("nav", function () { if (isOn()) { panel(); apply(); scrollTo(0, 0) } })

  apply()
  window.psReader = { toggle: toggle, isOn: isOn }
})()
