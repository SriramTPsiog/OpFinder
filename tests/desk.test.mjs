import test from "node:test";
import assert from "node:assert/strict";
import {CATALOG,PROFILE} from "../src/data/catalog.ts";
import {startingDesk,emptyFeed,readTracker,records,due,validDay,calendar,csv,matching,filters,picks,validFeed} from "../desk/model.mjs";

const item={id:"feed-test",title:"Chip MSc",url:"https://example.edu/chips",institution:"Example University",country:"Sweden",kind:"both",field:"IC design",sourceId:"sample",deadline:"2026-12-31"};

test("old notes and saved discoveries survive a later source removal",()=>{
  const s=startingDesk(CATALOG,PROFILE,emptyFeed());
  s.tracker=readTracker('{"status":{"feed-test":"drafting"},"notes":{"feed-test":"Reference booked"},"letters":{"2026-11-26":"My briefing"}}');
  s.tracker.snapshots[item.id]=item;
  assert.equal(records(s).applications[0].title,item.title);
  assert.equal(s.tracker.notes[item.id],"Reference booked");
  assert.equal(s.tracker.letters["2026-11-26"],"My briefing");
  assert.deepEqual(readTracker("{").status,{});
});
test("source and catalogue representations use the same tracker ID",()=>{
  const orig=CATALOG.find(x=>x.id==="kth-es"),s=startingDesk(CATALOG,PROFILE,{...emptyFeed(),items:[{...item,url:orig.url}]});
  s.tracker.status[orig.id]="applied";
  assert.equal(records(s).discover[0].id,orig.id);
  assert.equal(records(s).applications.length,1);
});
test("programme and funding filters both include a mixed opportunity",()=>{
  const t=readTracker(null),rows=[{...item,id:"other",kind:"program",deadline:undefined},item];
  for(const kind of ["program","scholarship"])assert(matching(rows,{...filters("discover"),kind},t).some(x=>x.id===item.id));
  assert.equal(matching(rows,{...filters("discover"),sort:"deadline"},t)[0].id,item.id);
  assert.equal(matching(rows,{...filters("discover"),query:" IC   SWEDEN ",dated:true},t).length,1);
});
test("personal date overrides provider date in CSV and all-day calendar",()=>{
  const t=readTracker(null);t.deadlines[item.id]="2027-02-28";t.notes[item.id]="=1+1, test\nmore";
  assert.equal(due(item,t),"2027-02-28");assert(!validDay("2027-02-29"));
  const out=calendar([item],t,new Date("2026-11-26T01:00:00Z"));
  assert.match(out,/DTSTART;VALUE=DATE:20270228/);assert.match(out,/DTEND;VALUE=DATE:20270301/);
  assert(out.split("\r\n").every(l=>Buffer.byteLength(l)<=75));
  assert(csv([item],t).includes("\"'=1+1, test\nmore\""));
});
test("daily picks are unique for small pools",()=>{
  for(const n of [1,2,3,4,5,6,9]){
    const pool=CATALOG.slice(0,n).map(x=>({...x,months:[11]}));
    const s=startingDesk(pool,PROFILE,emptyFeed(),new Date("2026-11-26T06:00:00Z"));
    assert.equal(new Set(picks(s).map(x=>x.id)).size,Math.min(n,5));
  }
});
test("reject unhealthy or unsafe records from a snapshot",()=>{
  assert(validFeed(emptyFeed()));
  assert(!validFeed({...emptyFeed(),items:[{...item,url:"javascript:alert(1)"}]}));
});
