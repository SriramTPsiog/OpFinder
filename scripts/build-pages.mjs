import {cpSync,existsSync,mkdirSync,mkdtempSync,readFileSync,renameSync,rmSync,writeFileSync} from "node:fs";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {CATALOG,PROFILE} from "../src/data/catalog.ts";
import {startingDesk,validFeed} from "../desk/model.mjs";
import {page} from "../desk/view.mjs";
import {injectGrokPwaHead} from "./grok-pwa-shared.mjs";

function build(){
  const root=dirname(dirname(fileURLToPath(import.meta.url)));
  const out=join(root,"site"),stage=mkdtempSync(join(root,".wafer-site-"));
  const source=process.argv[2]?resolve(process.argv[2]):join(root,"public/data/opportunities.json");
  try{
    if(!existsSync(source)){
      if(process.argv[2])throw Error("The supplied source snapshot is missing.");
      const python=process.platform==="win32"?"python":"python3";
      execFileSync(python,[join(root,"scripts/refresh_opportunities.py"),"--baseline-only","--output",source],{stdio:"inherit"});
    }
    const data=readFileSync(source,"utf8"),feed=JSON.parse(data);
    if(!validFeed(feed))throw Error("Invalid opportunity snapshot.");
    const buildId=[process.env.GITHUB_RUN_ID,process.env.GITHUB_RUN_ATTEMPT,process.env.GITHUB_SHA].filter(Boolean).join("-")||"local";
    mkdirSync(join(stage,"assets"),{recursive:true});mkdirSync(join(stage,"data"),{recursive:true});
    for (const name of ["app","model","view","start"]) {
      const code=readFileSync(join(root,"desk",name+".mjs"),"utf8").replaceAll('.mjs"','.js"');
      writeFileSync(join(stage,"assets",name+".js"),code);
    }
    cpSync(join(root,"desk/desk.css"),join(stage,"assets/desk.css"));
    cpSync(join(root,"public/favicon.svg"),join(stage,"favicon.svg"));cpSync(join(root,"public/__grok"),join(stage,"__grok"),{recursive:true});
    const manifest={name:"Wafer Desk",short_name:"Wafer Desk",id:"../",scope:"../",start_url:"../",display:"standalone",theme_color:"#193c33",background_color:"#f7f7f2",icons:[{src:"../favicon.svg",type:"image/svg+xml",sizes:"any"},{src:"./icon-180.png",type:"image/png",sizes:"180x180"}]};
    writeFileSync(join(stage,"__grok/manifest.webmanifest"),JSON.stringify(manifest));
    const embedded=JSON.stringify({catalogue:CATALOG,profile:PROFILE,feed}).replaceAll("<","\\u003c");
    const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#193c33"><meta name="wafer-build" content="${buildId}">
      <title>Wafer Desk · Semiconductor admissions</title><meta name="description" content="Discover electronics and semiconductor master's programmes and scholarships, track applications and export deadlines.">
      <link rel="icon" href="./favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="./assets/desk.css"></head>
      <body><div id="wafer-desk" class="wd">${page(startingDesk(CATALOG,PROFILE,feed))}</div><script type="application/json" id="wafer-snapshot">${embedded}</script>
      <script type="module" src="./assets/start.js"></script></body></html>`;
    writeFileSync(join(stage,"index.html"),injectGrokPwaHead(html,{appName:"Wafer Desk",cwd:root}).replaceAll('href="/__grok/','href="./__grok/'));
    writeFileSync(join(stage,"data/opportunities.json"),data);
    writeFileSync(join(stage,"build-info.json"),JSON.stringify({id:buildId,checkedAt:feed.checkedAt,sourceCount:feed.sources.length,discovered:feed.items.length,curated:CATALOG.length}));
    writeFileSync(join(stage,".nojekyll"),"");rmSync(out,{recursive:true,force:true});renameSync(stage,out);
    console.log(`Built ${CATALOG.length} curated opportunities and ${feed.items.length} source listings for GitHub Pages.`);
  }finally{rmSync(stage,{recursive:true,force:true});}
}

build();
