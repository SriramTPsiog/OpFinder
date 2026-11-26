import {STAGES,KINDS,localDay,dateLabel,safeUrl,isTracked,due,records,matching,picks,upcoming} from "./model.mjs";

function h(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

function link(url,label="Official page"){
  const href=safeUrl(url);
  return href?`<a class="wd-textlink" href="${h(href)}" target="_blank" rel="noopener noreferrer">${h(label)}<span class="wd-out" aria-hidden="true"></span></a>`:"";
}

function tag(label,tone=""){return `<span class="wd-badge ${tone}">${h(label)}</span>`;}

function opts(options,current){return options.map(([v,label])=>`<option value="${h(v)}"${v===current?" selected":""}>${h(label)}</option>`).join("");}

function nav(s){
  const tabs=[["desk","Overview"],["discover","Discover"],["catalogue","Catalogue"],["applications","My applications"]];
  return `<a class="wd-skip" href="#wd-main">Skip to opportunities</a><header class="wd-top"><div class="wd-wrap wd-bar">
    <a class="wd-brand" href="#desk" aria-label="Wafer Desk home"><span class="wd-mark" aria-hidden="true"></span>Wafer Desk</a>
    <nav aria-label="Main navigation">${tabs.map(([id,name])=>`<a href="#${id}"${id===s.tab?' aria-current="page"':""}>${name}</a>`).join("")}</nav>
    <time class="wd-date" datetime="${localDay(s.date)}">${h(s.date.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"}))}</time></div></header>`;
}

function titleBlock(s){
  if(s.tab==="desk")return `<div class="wd-hero"><div class="wd-hero-text"><p class="wd-label light">Graduate admissions · 2027 intake</p>
    <h1>Your semiconductor<br><em>admissions desk.</em></h1><p>Find master's programmes and funding in electronics, circuits and chip design. Keep your next application in view.</p>
    <a class="wd-btn cream" href="#discover">Explore opportunities</a></div><div class="wd-wafer-scene" aria-hidden="true"><div class="wd-reticle"></div><div class="wd-wafer"></div></div></div>`;
  const titles={discover:["Official sources","Discover opportunities","Find engineering programmes and scholarships on university and funding-body websites."],
    catalogue:["Programme guide","The catalogue","Explore the original shortlist, with fit scores, typical application windows and funding notes for your profile."],
    applications:["Personal tracker","My applications","Keep your shortlist, notes and confirmed dates together on this device."]};
  const [label,title,description]=titles[s.tab];
  return `<div class="wd-pagehead"><p class="wd-label">${label}</p><h1>${title}</h1><p>${description}</p></div>`;
}

function fact(label,value){return value?`<div><dt>${h(label)}</dt><dd>${h(value)}</dd></div>`:"";}

function card(x,s){
  const t=s.tracker, stage=t.status[x.id]||"new", saved=isTracked(stage), day=due(x,t);
  const p=s.feed.sources.find(v=>v.id===x.sourceId);
  const badge=x.sourceId?(p?.state==="stale"?tag("Cached listing","amber"):(!s.feed.items.some(i=>i.url===x.url)?tag("Saved copy"):"")):x.months?.includes(s.date.getMonth()+1)?tag("Typical window this month","green"):"";
  const dateText=day?(day<localDay(s.date)?"Past date":t.deadlines[x.id]?"My deadline":"Deadline")+" · "+dateLabel(day):"";
  const grades={ok:"Grade likely acceptable",borderline:"Grade near the line — explain 7.61",tight:"Grade filter may reject 7.61"};
  return `<article class="wd-card"><div class="wd-cardtop"><div class="wd-tags">${tag(KINDS[x.kind],x.kind==="scholarship"?"peach":"green")}${badge}<span class="wd-country">${h(x.country)}</span></div>
    <button type="button" class="wd-save${saved?" saved":""}" data-act="save" data-id="${h(x.id)}" aria-label="${h((saved?"View application for ":"Shortlist ")+x.title)}"><span aria-hidden="true">${saved?"✓":"+"}</span> ${saved?"Saved":"Shortlist"}</button></div>
    <details data-detail="${h(x.id)}"${s.opened.has(x.id)?" open":""}><summary><span class="wd-summary"><strong>${h(x.title)}</strong><span class="wd-school">${h(x.institution)}${x.city?" · "+h(x.city):""}</span></span><span class="wd-chevron" aria-hidden="true"></span></summary>
    <div class="wd-expanded">${x.summary?`<p>${h(x.summary)}</p>`:""}${x.why?`<p>${h(x.why)}</p>`:""}${x.risks?`<p class="wd-risk"><b>Application considerations</b> ${h(x.risks)}</p>`:""}
    <dl class="wd-facts">${fact("Usual application window",x.window)}${fact("Funding",x.funding)}${fact("Intake",x.intake)}${fact("Academic fit",grades[x.grade])}
    ${fact("Source",p?.name)}${fact("First found by scanner",x.firstSeenAt&&dateLabel(x.firstSeenAt))}${fact("Last seen on source",x.lastSeenAt&&dateLabel(x.lastSeenAt))}
    ${x.sourceId?fact("Provider deadline",x.deadline?dateLabel(x.deadline):"Check the official page for round dates."):""}</dl>
    <div class="wd-edit"><label>Application stage<select data-stage="${h(x.id)}">${opts(Object.entries(STAGES),stage)}</select></label>
    <label>My confirmed deadline<input type="date" data-deadline="${h(x.id)}" value="${h(t.deadlines[x.id]||"")}"></label></div>
    <label class="wd-note">Application notes<textarea rows="2" data-note="${h(x.id)}" placeholder="Modules, referee or documents to prepare">${h(t.notes[x.id]||"")}</textarea></label></div></details>
    <div class="wd-cardfoot"><div class="wd-footmeta">${h(x.field)}${x.fit?`<span>Fit ${x.fit}/100</span>`:""}${dateText?`<span class="wd-due">${h(dateText)}</span>`:""}${saved?`<span>${h(STAGES[stage])}</span>`:""}</div>${link(x.url)}</div></article>`;
}

function monitor(s,compact=false){
  const f=s.feed, good=f.sources.filter(p=>p.state==="ok").length;
  const info=f.checkedAt?`Last scan ${dateLabel(f.checkedAt)} · ${good}/${f.sources.length} sources reached.${good<f.sources.length?" Unreachable sources show their last available listings.":""}`:f.reviewedOn?`Starting list reviewed ${dateLabel(f.reviewedOn)}. Awaiting the first automated scan.`:"Loading source information.";
  const rows=f.sources.map(p=>{
    const state=p.state==="ok"?"Checked "+dateLabel(p.lastSuccessAt,false):p.state==="stale"?"Cached · "+dateLabel(p.lastSuccessAt,false):p.state==="reviewed"?"Reviewed "+dateLabel(f.reviewedOn,false):"Unavailable";
    return `<li><div>${link(p.url,p.name)}<span>${h(state)} · ${p.count} ${p.count===1?"listing":"listings"}</span></div></li>`;
  }).join("");
  return `<aside class="wd-panel wd-sources"><div class="wd-panehead"><span aria-hidden="true">◉</span><h2>Source monitor</h2></div><p>${h(info)}</p>
    ${compact?`<details data-sources${s.sourceOpen?" open":""}><summary>View ${f.sources.length} sources</summary><ul>${rows}</ul></details>`:`<ul>${rows}</ul>`}
    <button type="button" class="wd-btn secondary" data-act="refresh" ${s.refreshing?"disabled":""}>${s.refreshing?"Checking…":"Check latest snapshot"}</button><small class="wd-help">Loads the most recently published feed.</small></aside>`;
}

function upcomingPanel(s){
  const list=upcoming(s).slice(0,3);
  return `<aside class="wd-panel wd-deadlines"><div class="wd-panehead"><span class="wd-cal-icon" aria-hidden="true"></span><h2>Upcoming dates</h2></div>
   ${list.length?`<ul>${list.map(x=>{const day=due(x,s.tracker);return `<li><time datetime="${day}"><small>${h(dateLabel(day,false).split(" ")[1])}</small><b>${Number(day.slice(-2))}</b></time><div><button type="button" class="wd-plain" data-act="show" data-id="${h(x.id)}">${h(x.title)}</button><span>${s.tracker.deadlines[x.id]?"My confirmed date":"Provider deadline"}</span></div></li>`;}).join("")}</ul>`:"<p>Add a confirmed date to an application to see it here.</p>"}</aside>`;
}

function profilePanel(s){const p=s.profile;return `<details class="wd-panel wd-profile"><summary>Applicant profile</summary><h3>${h(p.name)}</h3><p>${h(p.degree)} · CGPA ${h(p.cgpa)}</p><p>${h(p.role)} since ${h(p.since)}.</p><p>${h(p.proof)}</p><p>${h(p.skills)}</p></details>`;}

function overview(s){
  const d=records(s), letter=s.tracker.letters[localDay(s.date)], featured=picks(s).map(x=>d.all.get(x.id));
  const stats=[["discover",d.discover.length,"Source listings"],["catalogue",d.catalogue.length,"Curated opportunities"],["applications",d.applications.length,"In my tracker"]];
  return `<div class="wd-metrics">${stats.map(([to,n,label])=>`<a href="#${to}"><strong>${n}</strong><span>${label}</span></a>`).join("")}</div>
   <div class="wd-columns"><section><div class="wd-heading"><div><p class="wd-label">Programme guide</p><h2>On your radar</h2></div><a class="wd-textlink" href="#catalogue">View catalogue</a></div>
   <p class="wd-intro">A daily selection for your profile. Application windows are seasonal estimates.</p><div class="wd-stack">${featured.map(x=>card(x,s)).join("")||'<p class="wd-empty">All your curated picks have been reviewed.</p>'}</div>
   <div class="wd-brief"><p class="wd-label">Today's desk note</p><h2>Plan your next application</h2>${letter?`<div class="wd-letter">${h(letter)}</div>`:"<p>Get a short briefing from your saved applications, upcoming dates and programme picks.</p>"}
   <button type="button" class="wd-btn secondary" data-act="brief">${letter?"Update my briefing":"Write my briefing"}</button>
   ${s.aiAvailable?`<button type="button" class="wd-btn secondary" data-act="ai" ${s.busy?"disabled":""}>${s.busy?"Writing…":"Write with Grok"}</button>`:""}</div></section>
   <div class="wd-rail">${upcomingPanel(s)}${monitor(s,true)}${profilePanel(s)}</div></div>`;
}

function filterBar(s,rows){
  const f=s.filters[s.tab], countries=[...new Set(rows.map(x=>x.country))].sort();
  const sorts=[["name","Title A–Z"],["deadline","Earliest deadline"]];
  if(s.tab!=="catalogue")sorts.unshift(["recent","Recently discovered"]);
  if(s.tab!=="discover")sorts.unshift(["fit","Highest fit"]);
  const select=(label,key,options)=>`<label>${label}<select data-filter="${key}">${opts(options,f[key])}</select></label>`;
  const check=(label,key)=>`<label><input type="checkbox" data-filter="${key}" ${f[key]?"checked":""}> ${label}</label>`;
  return `<div class="wd-filters" role="search" aria-label="Filter opportunities"><label class="wd-search">Search<input type="search" data-filter="query" placeholder="Programme, university or field" value="${h(f.query)}"></label>
    ${select("Country or region","country",[["","All locations"],...countries.map(x=>[x,x])])}
    ${select("Type","kind",[["","All types"],["program","Programmes"],["scholarship","Scholarships"]])}
    ${s.tab==="discover"?select("Source","source",[["","All sources"],...s.feed.sources.map(p=>[p.id,p.name])]):""}
    ${select("Sort by","sort",sorts)}<div class="wd-checks">${check("Has a deadline","dated")}${s.tab==="catalogue"?check("Usual window this month","seasonal"):""}${s.tab!=="applications"?check("Hide ignored","hideIgnored"):""}
    <button type="button" class="wd-reset" data-act="reset">Reset filters</button></div></div>`;
}

export function results(s){
  const pool=records(s)[s.tab]||[], rows=matching(pool,s.filters[s.tab],s.tracker,s.date), visible=rows.slice(0,s.limit);
  const noSaved=s.tab==="applications"&&!pool.length;
  return `<p class="wd-count" aria-live="polite">${rows.length} ${rows.length===1?"opportunity":"opportunities"}${rows.length>visible.length?" · showing "+visible.length:""}</p>
   <div class="wd-stack">${visible.map(x=>card(x,s)).join("")||`<div class="wd-empty"><h3>${noSaved?"Start your shortlist":"No matches"}</h3><p>${noSaved?"Save a programme or scholarship to track it here.":"Try a different search or reset the filters."}</p>${noSaved?'<a href="#discover" class="wd-textlink">Explore opportunities</a>':'<button type="button" class="wd-btn secondary" data-act="reset">Reset filters</button>'}</div>`}</div>
   ${rows.length>visible.length?'<button type="button" data-act="more" class="wd-btn secondary wd-more">Show more opportunities</button>':""}`;
}

function workspace(s){
  const rows=records(s)[s.tab],apps=s.tab==="applications";
  const stages=apps?`<div class="wd-pipeline">${["shortlist","drafting","applied"].map(k=>tag(`${STAGES[k]} · ${rows.filter(x=>s.tracker.status[x.id]===k).length}`,"green")).join("")}</div>`:"";
  const exports=apps?`<aside class="wd-panel"><h2>Export applications</h2><p>Download your full tracker or add its dated applications to your calendar.</p><div class="wd-actions"><button class="wd-btn secondary" data-act="csv" ${rows.length?"":"disabled"}>Download CSV</button><button class="wd-btn secondary" data-act="calendar" ${rows.some(x=>due(x,s.tracker))?"":"disabled"}>Export calendar (.ics)</button></div></aside>`:"";
  return `${stages}<div class="wd-columns"><section>${filterBar(s,rows)}<div id="wd-results">${results(s)}</div></section><div class="wd-rail">${s.tab==="discover"?monitor(s):upcomingPanel(s)}${exports}${s.tab==="catalogue"?profilePanel(s):""}</div></div>`;
}

export function page(s){return `${nav(s)}<main class="wd-wrap" id="wd-main" tabindex="-1">${titleBlock(s)}${s.tab==="desk"?overview(s):workspace(s)}</main><footer class="wd-wrap wd-footer"><strong>Wafer Desk</strong><span>Electronics &amp; semiconductor admissions</span></footer><div class="wd-toast" role="status" ${s.message||s.storageError?"":"hidden"}>${h(s.storageError?"Browser storage is unavailable. Edits last for this session.":s.message)}</div>`;}
