// English/Persian twins. A Persian topic is the file name.fa.md next to name.md (slug "x/name.fa").
//  - a switch on each topic page links to the other language, only when that twin exists;
//  - lang="fa" on Persian pages (direction stays per block, see renderPage.tsx);
//  - a Persian page that links to a topic with no Persian twin yet would 404 on "name.fa", so
//    that link is sent to the English page instead.
;(function () {
  var FA = /\.fa$/
  function el(t, c, x) {
    var e = document.createElement(t)
    if (c) e.className = c
    if (x != null) e.textContent = x
    return e
  }
  function index() {
    return Promise.resolve(typeof fetchData !== "undefined" ? fetchData : {}).then(function (d) {
      return (d && d.content) || d || {}
    })
  }

  function apply() {
    var s = document.body.dataset.slug
    if (!s) return
    var isFa = FA.test(s)
    document.documentElement.lang = isFa ? "fa" : "en"
    index().then(function (d) {
      var twin = isFa ? s.replace(FA, "") : s + ".fa"
      var title = document.querySelector(".article-title")
      if (
        d[twin] &&
        title &&
        title.parentElement &&
        !title.parentElement.querySelector(".ps-lang")
      ) {
        var a = el("a", "internal ps-lang", isFa ? "English" : "فارسی")
        // No data-slug on purpose: a data-slug would make other scripts treat it as a page link.
        a.href = "/" + twin
        a.setAttribute("hreflang", isFa ? "en" : "fa")
        a.lang = isFa ? "en" : "fa"
        a.title = isFa ? "Read this topic in English" : "این مطلب را به فارسی بخوان"
        title.parentElement.appendChild(a)
      }
      // English page for every topic, by its last path segment ("message-queues").
      var english = {}
      Object.keys(d).forEach(function (k) {
        if (!FA.test(k)) english[k.split("/").pop()] = k
      })
      document.querySelectorAll("a[data-slug]").forEach(function (a) {
        var t = a.getAttribute("data-slug")
        if (!FA.test(t) || d[t]) return
        var en = english[t.replace(FA, "").split("/").pop()]
        if (!en) return
        a.setAttribute("data-slug", en)
        a.href = "/" + en
        a.title = "Not translated yet: opens the English page"
      })
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
