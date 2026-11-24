// Adds the reader-mode button to the title row of every page. Reader mode itself is in reader.js.
(function () {
  var ICON_READER = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5.5C5.5 4.5 9 4.5 12 6.5c3-2 6.5-2 9-1V19c-2.5-1-6-1-9 1-3-2-6.5-2-9-1z"/><path d="M12 6.5V20"/></svg>'
  function renderBar() {
    var old = document.getElementById("ps-bar"); if (old) old.remove()
    var s = document.body.dataset.slug, art = document.querySelector("article")
    if (!s || !art || s === "index") return
    var bar = document.createElement("div"); bar.className = "ps-bar"; bar.id = "ps-bar"
    var rd = document.createElement("button"); rd.type = "button"; rd.className = "ps-btn ps-reader-btn"
    rd.innerHTML = ICON_READER
    rd.title = rd.ariaLabel = "Reader mode (full screen, no distractions)"
    rd.addEventListener("click", function () { if (window.psReader) window.psReader.toggle() })
    bar.appendChild(rd)
    // Into the header grid so the button shares the title row; fall back to the article if no title.
    var title = document.querySelector(".article-title"), host = title && title.parentElement
    if (host) host.appendChild(bar); else art.insertBefore(bar, art.firstChild)
  }
  renderBar()
  document.addEventListener("nav", renderBar)
})()
