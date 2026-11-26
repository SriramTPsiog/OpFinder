import {STAGES,isTracked,localDay,validDay,validFeed,emptyFeed,readTracker,filters,startingDesk,records,picks,briefing,csv,calendar} from "./model.mjs";
import {page,results} from "./view.mjs";

function download(value,name,mime){
  const u=URL.createObjectURL(new Blob([value],{type:mime})),a=document.createElement("a");
  a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);
}

export function mountDesk(root,catalogue,profile,initial,feedUrl,aiBrief){
  const s=startingDesk(catalogue,profile,validFeed(initial)?initial:emptyFeed());
  s.aiAvailable=typeof aiBrief==="function";
  const storage="wafer-desk-v1", cache="wafer-desk-source-snapshot-v1", controller=new AbortController(),listeners={signal:controller.signal};
  const time=f=>Date.parse(f.checkedAt||f.reviewedOn||"")||0;
  let toastTimer=0,disposed=false,lastRead=0,deferredPaint=false;
  try{s.tracker=readTracker(localStorage.getItem(storage));const saved=JSON.parse(localStorage.getItem(cache)||"null");if(validFeed(saved)&&time(saved)>time(s.feed))s.feed=saved;}catch{}
  function render(){if(!disposed){root.innerHTML=page(s);deferredPaint=false;}}
  function restore(selector){root.querySelector(selector)?.focus({preventScroll:true});}
  function notice(message){
    s.message=message;const box=root.querySelector(".wd-toast");
    if(box){box.textContent=s.storageError?"Browser storage is unavailable. Edits last for this session.":message;box.hidden=!s.storageError&&!message;}
    clearTimeout(toastTimer);if(message)toastTimer=setTimeout(()=>notice(""),3600);
  }
  function persist(){try{localStorage.setItem(storage,JSON.stringify(s.tracker));}catch{s.storageError=true;notice("");}}
  function remember(x){if(x.sourceId)s.tracker.snapshots[x.id]={...x};}
  function updateResults(){const list=root.querySelector("#wd-results");if(list)list.innerHTML=results(s);}
  function route(scroll=false){
    const [section,id]=location.hash.slice(1).split("/");
    if(section&&!["desk","discover","catalogue","applications","today","apply"].includes(section))return;
    s.tab=section==="today"?"desk":section==="apply"?"applications":section||"desk";s.limit=12;
    const x=id?records(s).all.get(id):null;
    if(x){s.filters[s.tab]=filters(s.tab);s.filters[s.tab].query=x.title;s.filters[s.tab].hideIgnored=false;s.opened.add(x.id);}
    render();
    if(x){const selector=`[data-detail="${CSS.escape(x.id)}"] summary`;restore(selector);if(scroll)root.querySelector(selector)?.scrollIntoView({block:"nearest"});}
    else if(scroll){window.scrollTo(0,0);restore("#wd-main");}
  }
  function show(x){
    const d=records(s);
    const tab=isTracked(s.tracker.status[x.id])?"applications":d.discover.some(y=>y.id===x.id)?"discover":"catalogue";
    const hash="#"+tab+"/"+encodeURIComponent(x.id);if(location.hash===hash)route(true);else location.hash=hash;
  }
  function setStage(x,stage){remember(x);s.tracker.status[x.id]=stage;persist();render();}
  async function refresh(explicit=false){
    if(disposed||s.refreshing)return;
    s.refreshing=true;lastRead=Date.now();
    const button=root.querySelector('[data-act="refresh"]');if(button){button.disabled=true;button.textContent="Checking…";}
    try{
      const response=await fetch(feedUrl,{cache:"no-store",signal:controller.signal});if(!response.ok)throw Error("Feed unavailable");
      const feed=await response.json();if(!validFeed(feed))throw Error("Invalid feed");
      if(disposed)return;
      const changed=time(feed)>=time(s.feed)&&JSON.stringify(feed)!==JSON.stringify(s.feed);
      if(changed){s.feed=feed;try{localStorage.setItem(cache,JSON.stringify(feed));}catch{}
        const editing=root.contains(document.activeElement)&&document.activeElement?.matches("input,textarea,select");
        if(editing)deferredPaint=true;else render();
      }
      if(explicit)notice(changed?"Loaded the latest published listings.":"You have the latest published snapshot.");
    }catch{if(!disposed)notice("Could not load the published feed. Showing the available snapshot.");}
    finally{s.refreshing=false;const b=root.querySelector('[data-act="refresh"]');if(b){b.disabled=false;b.textContent="Check latest snapshot";}}
  }
  function click(e){
    if(!(e.target instanceof Element))return;
    const b=e.target.closest("[data-act]");if(!b)return;
    const {act,id}=b.dataset,d=records(s),x=d.all.get(id);
    if(act==="save"&&x){if(isTracked(s.tracker.status[x.id])){show(x);return;}setStage(x,"shortlist");restore(`[data-act="save"][data-id="${CSS.escape(x.id)}"]`);notice("Added to My applications.");}
    else if(act==="show"&&x)show(x);
    else if(act==="refresh")void refresh(true);
    else if(act==="brief"){s.tracker.letters[localDay(s.date)]=briefing(s);persist();render();restore('[data-act="brief"]');notice("Today's briefing is ready.");}
    else if(act==="ai"&&aiBrief&&!s.busy){s.busy=true;render();const day=localDay(s.date);Promise.resolve(aiBrief(day,picks(s))).then(text=>{
      if(disposed)return;if(!text)throw Error("No response");s.tracker.letters[day]=text;persist();notice("Your briefing is ready.");
    }).catch(()=>{if(!disposed)notice("The AI service is unavailable. Write my briefing still works on this device.");}).finally(()=>{s.busy=false;render();});}
    else if(act==="reset"){s.filters[s.tab]=filters(s.tab);s.limit=12;render();restore('[data-filter="query"]');}
    else if(act==="more"){const former=s.limit;s.limit+=12;updateResults();root.querySelectorAll(".wd-card summary")[former]?.focus();}
    else if(act==="csv")download(csv(d.applications,s.tracker),"wafer-desk-applications.csv","text/csv;charset=utf-8");
    else if(act==="calendar")download(calendar(d.applications,s.tracker),"wafer-desk-deadlines.ics","text/calendar;charset=utf-8");
  }
  function field(e){
    const el=e.target;if(!el?.matches?.("input,textarea,select"))return;
    const key=el.dataset.filter;
    if(key){if((e.type==="input")!==(key==="query"))return;s.filters[s.tab][key]=el.type==="checkbox"?el.checked:el.value;s.limit=12;updateResults();return;}
    const x=records(s).all.get(el.dataset.note||el.dataset.stage||el.dataset.deadline);if(!x)return;
    if(el.dataset.note&&e.type==="input"){remember(x);s.tracker.notes[x.id]=el.value;persist();}
    else if(el.dataset.stage&&e.type==="change"&&Object.hasOwn(STAGES,el.value)){setStage(x,el.value);restore(`[data-stage="${CSS.escape(x.id)}"]`);notice("Application stage saved.");}
    else if(el.dataset.deadline&&e.type==="change"&&(!el.value||validDay(el.value))){remember(x);if(el.value)s.tracker.deadlines[x.id]=el.value;else delete s.tracker.deadlines[x.id];persist();render();restore(`[data-deadline="${CSS.escape(x.id)}"]`);notice("Deadline updated.");}
  }
  root.addEventListener("click",click,listeners);root.addEventListener("input",field,listeners);root.addEventListener("change",field,listeners);
  root.addEventListener("toggle",e=>{const el=e.target;if(!root.contains(el))return;if(el.dataset.detail){if(el.open)s.opened.add(el.dataset.detail);else s.opened.delete(el.dataset.detail);}if(el.hasAttribute("data-sources"))s.sourceOpen=el.open;},{capture:true,...listeners});
  root.addEventListener("focusout",()=>{if(deferredPaint)queueMicrotask(()=>{if(deferredPaint&&!root.contains(document.activeElement))render();});},listeners);
  window.addEventListener("hashchange",()=>route(true),listeners);
  window.addEventListener("storage",e=>{if(e.key===storage||e.key===null){s.tracker=readTracker(e.newValue);render();}},listeners);
  function checkVisible(){if(document.visibilityState!=="visible")return;const now=new Date();if(localDay(s.date)!==localDay(now)){s.date=now;render();}if(Date.now()-lastRead>=15*60*1000)void refresh();}
  document.addEventListener("visibilitychange",checkVisible,listeners);const interval=setInterval(checkVisible,60000);
  route();if(!root.childElementCount)render();void refresh();
  return ()=>{disposed=true;controller.abort();clearInterval(interval);clearTimeout(toastTimer);};
}
