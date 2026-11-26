import {mountDesk} from "./app.mjs";
const root=document.getElementById("wafer-desk");
if (root) {
  const {catalogue,profile,feed}=JSON.parse(document.getElementById("wafer-snapshot").textContent);
  mountDesk(root,catalogue,profile,feed,new URL("./data/opportunities.json",document.baseURI).href);
}
