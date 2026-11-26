export const STAGES = {
  "new": "New",
  "shortlist": "Shortlisted",
  "drafting": "Drafting",
  "applied": "Applied",
  "ignore": "Ignored"
};
export const KINDS = {
  "program": "Programme",
  "scholarship": "Scholarship",
  "both": "Programme + funding"
};

export function isTracked(status) {return ["shortlist","drafting","applied"].includes(status);}

export function localDay(d=new Date()) {return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}

export function validDay(value) {if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+"T12:00:00Z");return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value;}

export function dateLabel(value,year=true) {if(!value)return "Pending";const d=new Date(value.length===10?value+"T12:00:00Z":value);return Number.isFinite(+d)?d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:year?"numeric":undefined,timeZone:"UTC"}):"Pending";}

export function safeUrl(value) {if(typeof value!=="string")return "";try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password?u.href:"";}catch{return "";}}

export function isListing(x){return !!x && [x.id,x.title,x.institution,x.country,x.field].every(v=>typeof v==="string"&&v) && Object.hasOwn(KINDS,x.kind) && !!safeUrl(x.url);}

export function validFeed(f){return !!f&&f.version===1&&Array.isArray(f.items)&&f.items.every(isListing)&&Array.isArray(f.sources)&&f.sources.every(p=>p&&typeof p.name==="string"&&typeof p.id==="string"&&!!safeUrl(p.url)&&["ok","stale","reviewed","unavailable"].includes(p.state));}

export function emptyFeed(){return {version:1,items:[],sources:[],reviewedOn:"",checkedAt:null};}

export function cleanMap(value,valid){if(!value||typeof value!=="object"||Array.isArray(value))return {};return Object.fromEntries(Object.entries(value).filter(([k,v])=>/^[\w-]+$/.test(k)&&!["constructor","__proto__","prototype"].includes(k)&&valid(v)));}

export function readTracker(raw){let t={};try{t=JSON.parse(raw||"{}")||{};}catch{}return {status:cleanMap(t.status,x=>Object.hasOwn(STAGES,x)),notes:cleanMap(t.notes,x=>typeof x==="string"),letters:cleanMap(t.letters,x=>typeof x==="string"),deadlines:cleanMap(t.deadlines,validDay),snapshots:cleanMap(t.snapshots,isListing)};}

export function filters(tab){return {query:"",country:"",kind:"",source:"",sort:tab==="catalogue"?"fit":tab==="applications"?"deadline":"recent",dated:false,seasonal:false,hideIgnored:true};}

export function startingDesk(catalogue,profile,feed=emptyFeed(),date=new Date()) {return {catalogue,profile,feed,date,tab:"desk",tracker:readTracker(null),filters:Object.fromEntries(["desk","discover","catalogue","applications"].map(t=>[t,filters(t)])),opened:new Set(),sourceOpen:false,limit:12,refreshing:false,message:"",storageError:false,aiAvailable:false,busy:false};}

export function records(s){
  const all=new Map(Object.values(s.tracker.snapshots).map(x=>[x.id,x]));
  const byUrl=new Map(s.catalogue.map(x=>[x.url.replace(/\/$/,""),x]));
  for(const x of s.catalogue)all.set(x.id,x);
  const discover=s.feed.items.map(x=>{
    const old=byUrl.get(x.url.replace(/\/$/,""));
    const merged=old?{...old,...x,id:old.id}:x;
    all.set(merged.id,merged);return merged;
  });
  return {all,discover,catalogue:s.catalogue.map(x=>all.get(x.id)),applications:[...all.values()].filter(x=>isTracked(s.tracker.status[x.id]))};
}

export function due(x,t){const d=t.deadlines[x.id]||x.deadline;return validDay(d)?d:"";}

export function matching(rows,f,t,date=new Date()){
  const words=f.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter(x=>{
    const text=[x.title,x.institution,x.country,x.field,x.city,x.summary,x.sourceId].join(" ").toLowerCase();
    return words.every(w=>text.includes(w))&&(!f.country||x.country===f.country)&&(!f.kind||x.kind===f.kind||x.kind==="both")&&(!f.source||x.sourceId===f.source)&&(!f.hideIgnored||t.status[x.id]!=="ignore")&&(!f.dated||!!due(x,t))&&(!f.seasonal||x.months?.includes(date.getMonth()+1));
  }).sort((a,b)=>{
    const order=f.sort==="deadline"?(due(a,t)||"9999").localeCompare(due(b,t)||"9999"):f.sort==="fit"?(b.fit??-1)-(a.fit??-1):f.sort==="recent"?(b.firstSeenAt||"").localeCompare(a.firstSeenAt||""):0;
    return order||a.title.localeCompare(b.title)||a.id.localeCompare(b.id);
  });
}

export function picks(s){
  const eligible=s.catalogue.filter(x=>!["applied","ignore"].includes(s.tracker.status[x.id]));
  const usual=eligible.filter(x=>x.months?.includes(s.date.getMonth()+1));
  const pool=(usual.length?usual:eligible).slice().sort((a,b)=>b.fit-a.fit);
  const start=(Date.UTC(s.date.getFullYear(),s.date.getMonth(),s.date.getDate())-Date.UTC(s.date.getFullYear(),0,0))/86400000;
  return Array.from({length:Math.min(5,pool.length)},(_,i)=>pool[(start+i)%pool.length]);
}

export function upcoming(s){return [...records(s).all.values()].filter(x=>due(x,s.tracker)>=localDay(s.date)&&!["applied","ignore"].includes(s.tracker.status[x.id])).sort((a,b)=>due(a,s.tracker).localeCompare(due(b,s.tracker))||a.title.localeCompare(b.title));}

export function briefing(s){
  const next=upcoming(s)[0], apps=records(s).applications, draft=apps.find(x=>s.tracker.status[x.id]==="drafting"),pick=picks(s)[0];
  return [next?`Your next listed date is ${dateLabel(due(next,s.tracker))} for ${next.title}. Check the closing time and required documents on the official page.`:"Add a confirmed deadline to a programme you are tracking.",draft?`Continue the draft for ${draft.title}. Check your transcript and referee details against its requirements.`:pick?`Review ${pick.title} at ${pick.institution}. Compare the modules with your interests in circuits and embedded systems.`:"",`${apps.filter(x=>s.tracker.status[x.id]!=="applied").length} applications are in progress.`].filter(Boolean).join("\n\n");
}

export function csv(rows,t){
  const cell=value=>{let s=String(value??"");if(/^\s*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  const header=["Status","Fit","Title","Institution","Country","Kind","Intake","Funding","URL","Risks","Note","Deadline","Date source"];
  const data=rows.map(x=>[STAGES[t.status[x.id]||"new"],x.fit,x.title,x.institution,x.country,KINDS[x.kind],x.intake,x.funding,x.url,x.risks,t.notes[x.id],due(x,t),t.deadlines[x.id]?"Personal":x.deadline?"Provider":""]);
  return "\uFEFF"+[header,...data].map(row=>row.map(cell).join(",")).join("\r\n");
}

export function calendar(rows,t,now=new Date()){
  const esc=s=>s.replaceAll("\\","\\\\").replace(/\r\n|\r|\n/g,"\\n").replaceAll(";","\\;").replaceAll(",","\\,");
  const stamp=now.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Wafer Desk//Admissions//EN","CALSCALE:GREGORIAN"];
  for(const x of rows){const day=due(x,t);if(!day)continue;const next=new Date(day+"T00:00:00Z");next.setUTCDate(next.getUTCDate()+1);
    lines.push("BEGIN:VEVENT",`UID:${x.id}@waferdesk`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${day.replaceAll("-","")}`,`DTEND;VALUE=DATE:${next.toISOString().slice(0,10).replaceAll("-","")}`,`SUMMARY:${esc(x.title)} deadline`,`DESCRIPTION:${esc([x.institution,t.notes[x.id]].filter(Boolean).join("\n"))}`,`URL:${x.url}`,"END:VEVENT");
  }
  const utf8=new TextEncoder();
  return [...lines,"END:VCALENDAR"].map(line=>{let text="",length=0;for(const ch of line){const n=utf8.encode(ch).length;if(length+n>75){text+="\r\n ";length=1;}text+=ch;length+=n;}return text;}).join("\r\n")+"\r\n";
}
