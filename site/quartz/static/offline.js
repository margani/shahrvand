// Offline copy of the whole site (service worker /sw.js, generated at build time), a footer
// line saying which version of the documents is on screen, and an "Update" notice that shows
// only when a newer version has been downloaded and is waiting.
;(function () {
  if (!("serviceWorker" in navigator)) return

  function el(t, c, x) {
    var e = document.createElement(t)
    if (c) e.className = c
    if (x != null) e.textContent = x
    return e
  }

  // ---- footer: which documents am I reading? ----
  // /version.json is answered by the installed copy, so this is the version that is on screen,
  // even offline and even if a newer one is already waiting.
  function stamp() {
    // Right sidebar, straight after the graph; the footer is only the fallback for a page with no graph.
    var graph = document.querySelector(".right.sidebar .graph")
    var host = graph ? graph.parentNode : document.querySelector("footer")
    if (!host || host.querySelector(".ps-version")) return
    fetch("/version.json")
      .then(function (r) {
        return r.json()
      })
      .then(function (v) {
        if (host.querySelector(".ps-version")) return
        var d = new Date(v.built)
        var box = el("div", "ps-version")
        box.appendChild(el("h3", null, "Documents version"))
        var ul = el("ul")
        ;[
          v.version,
          v.documents + " topics",
          v.persian ? v.persian + " in Persian" : null,
          "built " + (isNaN(d) ? v.built : d.toISOString().slice(0, 16).replace("T", " ") + " UTC"),
        ].forEach(function (t) {
          if (t) ul.appendChild(el("li", null, t))
        })
        box.appendChild(ul)
        if (graph) graph.parentNode.insertBefore(box, graph.nextSibling)
        else host.insertBefore(box, host.firstChild)
      })
      .catch(function () {})
  }
  stamp()
  document.addEventListener("nav", stamp)

  // ---- update notice ----
  var wanted = false // reload only when the owner pressed Update, not on the first install
  function offer(worker) {
    if (document.getElementById("ps-update")) return
    var box = el("div", "ps-update")
    box.id = "ps-update"
    box.setAttribute("role", "status")
    box.appendChild(el("span", null, "A new version of the documents is available."))
    var go = el("button", "ps-update-go", "Update")
    go.type = "button"
    go.addEventListener("click", function () {
      wanted = true
      go.disabled = true
      go.textContent = "Updating…"
      worker.postMessage({ type: "SKIP_WAITING" })
    })
    var later = el("button", "ps-update-later", "×")
    later.type = "button"
    later.title = later.ariaLabel = "Not now"
    later.addEventListener("click", function () {
      box.remove()
    })
    box.appendChild(go)
    box.appendChild(later)
    document.body.appendChild(box)
  }

  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (wanted) location.reload()
  })

  navigator.serviceWorker
    .register("/sw.js")
    .then(function (reg) {
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting)
      reg.addEventListener("updatefound", function () {
        var w = reg.installing
        if (!w) return
        w.addEventListener("statechange", function () {
          if (w.state === "installed" && navigator.serviceWorker.controller) offer(w)
        })
      })
      // A tab left open for days never navigates, so the browser would not look for an update.
      var last = Date.now()
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible" && Date.now() - last > 10 * 60 * 1000) {
          last = Date.now()
          reg.update().catch(function () {})
        }
      })
    })
    .catch(function () {})
})()
