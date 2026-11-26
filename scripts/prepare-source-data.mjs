import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../",import.meta.url));
const python=process.platform==="win32"?"python":"python3";
const args=["scripts/refresh_opportunities.py"];
if(!process.argv.includes("--refresh"))args.push("--baseline-only");
execFileSync(python,args,{cwd:root,stdio:"inherit"});
