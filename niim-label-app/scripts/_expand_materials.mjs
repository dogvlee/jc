import fs from "fs";
const path = "D:/vibecode/jc/niim-label-app/src/core/materials.js";
let src = fs.readFileSync(path, "utf8");

const extras = [
  ["cat","猫咪","表情",["可爱","最新","热门"]],
  ["dog","狗狗","表情",["可爱","热门"]],
  ["rabbit","兔子","表情",["可爱","最新"]],
  ["bird","小鸟","表情",["可爱","园艺"]],
  ["fish","小鱼","表情",["可爱"]],
  ["butterfly","蝴蝶","表情",["可爱","园艺","最新"]],
  ["bear","小熊","表情",["可爱","热门"]],
  ["chick","小鸡","表情",["可爱","最新"]],
  ["fox","狐狸","表情",["可爱","VIP"], true],
  ["apple","苹果","餐饮",["餐饮","最新"]],
  ["bread","面包","餐饮",["餐饮"]],
  ["coffee","咖啡","餐饮",["餐饮","热门"]],
  ["ice_cream","冰淇淋","餐饮",["餐饮","可爱"]],
  ["pizza","披萨","餐饮",["餐饮"]],
  ["egg","鸡蛋","餐饮",["餐饮"]],
  ["bowl","碗","餐饮",["餐饮"]],
  ["chopsticks","筷子","餐饮",["餐饮"]],
  ["strawberry","草莓","餐饮",["餐饮","可爱","最新"]],
  ["balloon","气球","通用",["祝福","可爱","热门"]],
  ["bells","铃铛","通用",["祝福","最新"]],
  ["champagne","香槟","通用",["祝福","VIP"], true],
  ["bow_tie","领结","通用",["饰品","祝福"]],
  ["earring","耳环","通用",["饰品","VIP"], true],
  ["necklace","项链","通用",["饰品","最新"]],
  ["gem","宝石","通用",["饰品","VIP","热门"], true],
  ["crown","皇冠","通用",["VIP","饰品","热门"], true],
  ["sun","太阳","通用",["最新","园艺"]],
  ["cloud","云朵","通用",["可爱","最新"]],
  ["rain","下雨","通用",["警示"]],
  ["moon","月亮","通用",["可爱","最新"]],
  ["lightning","闪电","警示",["警示","热门"]],
  ["wrench","扳手","通用",["标记"]],
  ["hammer","锤子","通用",["标记"]],
  ["gear","齿轮","通用",["标记","最新"]],
  ["key","钥匙","通用",["标记","热门"]],
  ["lock","锁","通用",["标记","警示"]],
  ["pen","钢笔","通用",["最新"]],
  ["folder","文件夹","通用",["标记"]],
  ["calendar","日历","通用",["最新","热门"]],
  ["clipboard","剪贴板","通用",["标记"]],
  ["printer","打印机","通用",["最新","热门"]],
  ["trophy","奖杯","通用",["祝福","VIP","热门"], true],
  ["flag","旗帜","标记",["标记","热门"]],
  ["target","靶心","标记",["标记"]],
  ["wink","眨眼","表情",["可爱","最新"]],
  ["sad","难过","表情",["可爱"]],
  ["cool","酷","表情",["可爱","热门"]],
  ["love_face","花痴","表情",["可爱","祝福"]],
  ["cart","购物车","零售",["零售","热门"]],
  ["bag","购物袋","零售",["零售","最新"]],
  ["tag","吊牌","零售",["零售"]],
  ["store","店铺","零售",["零售"]],
  ["chat","对话","联系",["联系","最新"]],
  ["user","用户","联系",["联系"]],
  ["home","家","联系",["联系","热门"]],
  ["link","链接","联系",["联系"]],
  ["truck","货车","物流",["物流","热门"]],
  ["plane","飞机","物流",["物流","最新"]],
  ["package","包裹","物流",["物流"]],
  ["triangle","三角","形状",["形状"]],
  ["plus","加号","形状",["形状","标记"]],
  ["minus","减号","形状",["形状","标记"]],
  ["star_fill","实心星","形状",["形状","可爱","VIP"], true],
  ["heart_fill","实心爱心","形状",["形状","可爱","祝福"]],
  ["lantern","灯笼","通用",["祝福","最新","热门"]],
  ["red_packet","红包","通用",["祝福","热门"]],
  ["tree","树","通用",["园艺"]],
  ["rose","玫瑰","通用",["园艺","祝福","热门"]],
  ["cactus","仙人掌","通用",["园艺","可爱"]],
  ["sunflower","向日葵","通用",["园艺","最新"]],
  ["electricity","带电","警示",["警示","热门"]],
  ["high_temp","高温","警示",["警示"]],
  ["medal","奖牌","通用",["VIP","祝福"], true],
  ["ribbon","丝带","通用",["祝福","饰品","VIP"], true],
  ["arrow_double","双向","箭头",["箭头"]],
  ["refresh","刷新","箭头",["箭头","最新"]],
  ["download","下载","箭头",["箭头"]],
  ["upload","上传","箭头",["箭头"]]
];

const existingIds = new Set([...src.matchAll(/id:\s*'([^']+)'/g)].map(m => m[1]));
const newEntries = extras.filter(e => !existingIds.has(e[0]));
const entryLines = newEntries.map(([id, label, category, tags, vip]) => {
  const tagStr = JSON.stringify(tags).replace(/"/g, "'");
  return "  { id: '" + id + "', label: '" + label + "', category: '" + category + "', tags: " + tagStr + (vip ? ", vip: true" : "") + " }";
}).join(",\n");
const catClose = src.indexOf("];\r\n\r\nfunction materialById");
if (catClose < 0) throw new Error("catalog close not found");
let head = src.slice(0, catClose).replace(/\s+$/,"");
if (!head.endsWith(",")) head += ",";
src = head + "\n" + entryLines + "\n" + src.slice(catClose);
const R = {
  face: "context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.38,0,Math.PI*2);stroke();context.beginPath();context.arc(sx(0.36),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.64),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.16,0.15*Math.PI,0.85*Math.PI);stroke();",
  circle: "context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();",
  food: "context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.3,0,Math.PI*2);stroke();context.beginPath();context.moveTo(sx(0.35),sy(0.35));context.quadraticCurveTo(sx(0.5),sy(0.2),sx(0.65),sy(0.35));stroke();",
  tool: "context.beginPath();context.moveTo(sx(0.25),sy(0.75));context.lineTo(sx(0.75),sy(0.25));context.moveTo(sx(0.3),sy(0.3));context.lineTo(sx(0.45),sy(0.2));context.lineTo(sx(0.55),sy(0.3));context.lineTo(sx(0.4),sy(0.4));stroke();",
  arrowH: "context.beginPath();context.moveTo(sx(0.2),sy(0.5));context.lineTo(sx(0.8),sy(0.5));context.moveTo(sx(0.65),sy(0.35));context.lineTo(sx(0.8),sy(0.5));context.lineTo(sx(0.65),sy(0.65));stroke();",
  shop: "context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();",
  plant: "context.beginPath();context.moveTo(sx(0.5),sy(0.85));context.lineTo(sx(0.5),sy(0.4));stroke();context.beginPath();context.arc(sx(0.5),sy(0.35),Math.min(w,h)*0.2,0,Math.PI*2);stroke();",
  warn: "context.beginPath();context.moveTo(sx(0.5),sy(0.12));context.lineTo(sx(0.88),sy(0.82));context.lineTo(sx(0.12),sy(0.82));context.closePath();stroke();"
};
const map = {};
for (const id of ["cat","dog","rabbit","bird","bear","chick","fox","wink","sad","cool","love_face","user"]) map[id]=R.face;
for (const id of ["fish","butterfly","egg","balloon","bells","earring","necklace","sun","cloud","rain","moon","gear","target","link","lantern","sunflower","medal","refresh"]) map[id]=R.circle;
for (const id of ["apple","bread","coffee","ice_cream","pizza","bowl","strawberry","champagne"]) map[id]=R.food;
for (const id of ["chopsticks","wrench","hammer","key","pen","flag","plane","plus","minus"]) map[id]=R.tool;
for (const id of ["arrow_double","download","upload"]) map[id]=R.arrowH;
for (const id of ["bow_tie","gem","crown","lock","folder","calendar","clipboard","printer","trophy","cart","bag","tag","store","chat","home","truck","package","red_packet","ribbon"]) map[id]=R.shop;
for (const id of ["tree","rose","cactus"]) map[id]=R.plant;
for (const id of ["lightning","triangle","electricity","high_temp"]) map[id]=R.warn;
map.star_fill = "context.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5;const r=i%2===0?0.42:0.18;const px=sx(0.5+Math.cos(a)*r);const py=sy(0.5+Math.sin(a)*r);if(i===0)context.moveTo(px,py);else context.lineTo(px,py);}context.closePath();fill();";
map.heart_fill = "context.beginPath();context.moveTo(sx(0.5),sy(0.82));context.bezierCurveTo(sx(0.15),sy(0.58),sx(0.08),sy(0.32),sx(0.28),sy(0.22));context.bezierCurveTo(sx(0.4),sy(0.16),sx(0.5),sy(0.26),sx(0.5),sy(0.36));context.bezierCurveTo(sx(0.5),sy(0.26),sx(0.6),sy(0.16),sx(0.72),sy(0.22));context.bezierCurveTo(sx(0.92),sy(0.32),sx(0.85),sy(0.58),sx(0.5),sy(0.82));context.closePath();fill();";
const blocks = newEntries.map(([id]) => "  } else if (id === '" + id + "') {\n    " + (map[id] || R.circle) + "\n").join("");
const fallbackMarker = "  } else {\r\n    // fallback check";
const insertAt = src.indexOf(fallbackMarker);
if (insertAt < 0) throw new Error("fallback missing");
src = src.slice(0, insertAt) + blocks + src.slice(insertAt);
fs.writeFileSync(path, src);
const ids = [...src.matchAll(/\{ id: '([^']+)'/g)].map(m => m[1]);
console.log("catalog entries", ids.length, "unique", new Set(ids).size, "added", newEntries.length);
