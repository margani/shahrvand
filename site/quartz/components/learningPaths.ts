// A learning path is a page under Paths/ whose ordered list links to topics. A topic that appears
// in one or more paths shows where it sits in each (position, previous, next, all steps). The
// order comes from the path page's own links, so no topic file carries path metadata.
// It runs in the browser from contentIndex because Quartz components only see one page's data
// at render time and cannot read the other pages' link lists in a layout slot.
export const learningPathsScript = `(function(){
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function link(slug,text,c){var a=el("a",(c?c+" ":"")+"internal",text);a.href="/"+slug;a.setAttribute("data-slug",slug);return a}
function render(){
  var old=document.getElementById("learning-paths");if(old)old.remove();
  var slug=document.body.dataset.slug;
  // A Persian page (name.fa) sits in the same paths as name; the box is then Persian wherever a
  // Persian twin exists, and English for the rest (a path with no Persian page yet).
  var fa=/\\.fa$/.test(slug||"");if(fa)slug=slug.replace(/\\.fa$/,"");
  var side=document.querySelector(".sidebar.right");
  if(!slug||!side||slug.indexOf("paths/")===0||typeof fetchData==="undefined")return;
  Promise.resolve(fetchData).then(function(d){
    d=(d&&d.content)||d;if(!d)return;
    function tw(k){return fa&&d[k+".fa"]?k+".fa":k}
    var box=el("div","learning-paths");box.id="learning-paths";if(fa){box.dir="rtl";box.lang="fa"}
    Object.keys(d).filter(function(k){return k.indexOf("paths/")===0&&k!=="paths/index"&&!/\\.fa$/.test(k)}).sort().forEach(function(pk){
      var steps=[];(d[tw(pk)].links||[]).forEach(function(l){l=l.replace(/\\.fa$/,"");if(d[l]&&steps.indexOf(l)<0)steps.push(l)});
      var i=steps.indexOf(slug);if(i<0)return;
      var card=el("section","lp-card");
      var head=el("div","lp-head");head.appendChild(link(tw(pk),d[tw(pk)].title,"lp-title"));
      head.appendChild(el("span","lp-pos",(i+1)+" / "+steps.length));card.appendChild(head);
      var nav=el("div","lp-nav");
      if(i>0)nav.appendChild(link(tw(steps[i-1]),(fa?"\\u2192 ":"\\u2190 ")+d[tw(steps[i-1])].title,"lp-prev"));
      if(i<steps.length-1)nav.appendChild(link(tw(steps[i+1]),d[tw(steps[i+1])].title+(fa?" \\u2190":" \\u2192"),"lp-next"));
      card.appendChild(nav);
      var det=el("details","lp-all");det.appendChild(el("summary",null,fa?"همه مرحله‌ها":"All steps"));
      var ol=el("ol");steps.forEach(function(s){var li=el("li",s===slug?"current":"");
        if(s===slug)li.textContent=d[tw(s)].title;else li.appendChild(link(tw(s),d[tw(s)].title));ol.appendChild(li)});
      det.appendChild(ol);card.appendChild(det);box.appendChild(card)});
    var dup=document.getElementById("learning-paths");if(dup)dup.remove();
    if(box.children.length){box.insertBefore(el("h3","lp-heading",fa?"مسیرهای یادگیری":"Learning paths"),box.firstChild);side.insertBefore(box,side.firstChild)}
  })}
render();document.addEventListener("nav",render)})()`
