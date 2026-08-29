const fs = require("fs");
const m = fs.readFileSync("src/app/main.js", "utf8");
const v = fs.readFileSync("src/app/views.js", "utf8");
const r = fs.readFileSync("src/core/renderer.js", "utf8");
console.log({blankTap:m.includes("blankTap"), panelToggle:m.includes("panelCollapsed = !state.panelCollapsed"), longPress450:m.includes("450"), linked:m.includes("add-linked-date")&&m.includes("linkedFrom"), clearStyle:m.includes("clear-text-style")&&v.includes("clear-text-style"), fitHandle:m.includes("contentHandleLocalMm")&&r.includes("function contentHandleLocalMm"), contentBar:v.includes("niim-content-line"), noEmptyCta:!v.includes("niim-stage-empty")});
const mat=require("./src/core/materials");
const ot=require("./src/app/online-templates-pack");
const c=require("./src/app/catalog");
console.log({materials:mat.MATERIAL_CATALOG.length, online:ot.ONLINE_TEMPLATES.length, catalogTemplates:(c.templates||[]).length});
