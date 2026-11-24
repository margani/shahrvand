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
  var side=document.querySelector(".sidebar.right");
  if(!slug||!side||slug.indexOf("paths/")===0||typeof fetchData==="undefined")return;
  Promise.resolve(fetchData).then(function(d){
    d=(d&&d.content)||d;if(!d)return;
    var box=el("div","learning-paths");box.id="learning-paths";
    Object.keys(d).filter(function(k){return k.indexOf("paths/")===0&&k!=="paths/index"}).sort().forEach(function(pk){
      var steps=[];(d[pk].links||[]).forEach(function(l){if(d[l]&&steps.indexOf(l)<0)steps.push(l)});
      var i=steps.indexOf(slug);if(i<0)return;
      var card=el("section","lp-card");
      var head=el("div","lp-head");head.appendChild(link(pk,d[pk].title,"lp-title"));
      head.appendChild(el("span","lp-pos",(i+1)+" / "+steps.length));card.appendChild(head);
      var nav=el("div","lp-nav");
      if(i>0)nav.appendChild(link(steps[i-1],"\\u2190 "+d[steps[i-1]].title,"lp-prev"));
      if(i<steps.length-1)nav.appendChild(link(steps[i+1],d[steps[i+1]].title+" \\u2192","lp-next"));
      card.appendChild(nav);
      var det=el("details","lp-all");det.appendChild(el("summary",null,"All steps"));
      var ol=el("ol");steps.forEach(function(s){var li=el("li",s===slug?"current":"");
        if(s===slug)li.textContent=d[s].title;else li.appendChild(link(s,d[s].title));ol.appendChild(li)});
      det.appendChild(ol);card.appendChild(det);box.appendChild(card)});
    var dup=document.getElementById("learning-paths");if(dup)dup.remove();
    if(box.children.length){box.insertBefore(el("h3","lp-heading","Learning paths"),box.firstChild);side.insertBefore(box,side.firstChild)}
  })}
render();document.addEventListener("nav",render)})()`
