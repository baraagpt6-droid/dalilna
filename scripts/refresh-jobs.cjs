"use strict";
const fs=require("node:fs"),path=require("node:path");
const OUT=path.join(__dirname,"..","jobs-feed.json"),now=Date.now();
const TARGETS={
 Yemen:{code:"YE",aliases:["yemen","اليمن","sanaa","sana","aden","taiz","ibb","hadramawt","hodeidah","mukalla","marib","الحديدة","صنعاء","عدن","تعز","إب"]},
 "Saudi Arabia":{code:"SA",aliases:["saudi arabia","kingdom of saudi","ksa","السعودية","الرياض","جدة","الدمام","مكة","المدينة","riyadh","jeddah","dammam"]},
 "United Arab Emirates":{code:"AE",aliases:["united arab emirates","uae","الإمارات","الامارات","dubai","abu dhabi","sharjah","دبي","أبوظبي","ابوظبي"]},
 Oman:{code:"OM",aliases:["oman","عمان","مسقط","muscat","salalah","صلالة"]},
 Qatar:{code:"QA",aliases:["qatar","قطر","doha","الدوحة"]},
 Bahrain:{code:"BH",aliases:["bahrain","البحرين","manama","المنامة"]},
 Iraq:{code:"IQ",aliases:["iraq","العراق","baghdad","بغداد","erbil","اربيل","basra","البصرة"]},
 Jordan:{code:"JO",aliases:["jordan","الأردن","الاردن","amman","العقبة","aqaba"]}
};
function decode(s){return String(s||"").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();}
function tag(block,name){const m=block.match(new RegExp("<"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)</"+name+">","i"));return m?decode(m[1]):"";}
function linkFrom(block){const m=block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);return m?m[1]:(tag(block,"link")||tag(block,"guid"));}
function inferCountry(text){const s=String(text||"").toLowerCase();for(const [country,data] of Object.entries(TARGETS))if(data.aliases.some(a=>s.includes(a.toLowerCase())))return {country,countryCode:data.code};return null;}
function isoDate(value){const d=Date.parse(value||"");return Number.isFinite(d)?new Date(d).toISOString():new Date(now).toISOString();}

const ARABIC_MONTHS={"يناير":1,"فبراير":2,"مارس":3,"أبريل":4,"ابريل":4,"مايو":5,"يونيو":6,"يوليو":7,"أغسطس":8,"اغسطس":8,"سبتمبر":9,"أكتوبر":10,"اكتوبر":10,"نوفمبر":11,"ديسمبر":12};
function parseDateLabel(value){
 const s=String(value||"").trim();
 let m=s.match(/(\d{1,2})\s+([^\s]+)\s+(\d{4})/);
 if(m&&ARABIC_MONTHS[m[2]])return new Date(Date.UTC(Number(m[3]),ARABIC_MONTHS[m[2]]-1,Number(m[1]),23,59,59)).toISOString();
 const d=Date.parse(s);return Number.isFinite(d)?new Date(d).toISOString():null;
}
function decodePreserving(value){
 return String(value||"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
}
function stripHtml(html){
 return decodePreserving(String(html||"").replace(/<br\s*\/?>/gi,"\n").replace(/<\/(?:p|div|li|h\d)>/gi,"\n").replace(/<[^>]+>/g," "))
  .replace(/[ \t]+\n/g,"\n").replace(/\n[ \t]+/g,"\n").replace(/\n{2,}/g,"\n").trim();
}
function fieldValue(text,label){
 const lines=String(text||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 for(let i=0;i<lines.length;i++){
  const at=lines[i].search(label);
  if(at>=0){const value=lines[i].slice(at).replace(label,"").trim();return value||lines[i+1]||"";}
 }
 return "";
}
function parseYemenHrJobs(html){
 const source=String(html||""),marks=[...source.matchAll(/data-post="hr_yemen\/(\d+)"/g)],out=[];
 for(let i=0;i<marks.length;i++){
  const at=marks[i].index,from=Math.max(0,source.lastIndexOf('class="tgme_widget_message_wrap',at));
  const next=i+1<marks.length?source.lastIndexOf('class="tgme_widget_message_wrap',marks[i+1].index):source.length;
  const block=source.slice(from,next>from?next:source.length),textMatch=block.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const plain=stripHtml(textMatch?textMatch[1]:block);
  const title=(plain.match(/المسمى الوظيفي\s*[:：]\s*([^\n\r]+)/i)||[])[1];
  const organization=(plain.match(/الجهة\s*[:：]\s*([^\n\r]+)/i)||[])[1];
  const location=(plain.match(/الموقع\s*[:：]\s*([^\n\r]+)/i)||[])[1];
  const published=(plain.match(/تاريخ النشر\s*[:：]\s*([^\n\r]+)/i)||[])[1];
  const deadline=(plain.match(/آخر موعد للتقديم\s*[:：]\s*([^\n\r]+)/i)||[])[1];
  if(!title||!location||!published)continue;
  const publishedAt=parseDateLabel(published);
  if(!publishedAt)continue;
  const deadlineAt=parseDateLabel(deadline);
  if(deadlineAt&&Date.parse(deadlineAt)<now)continue;
  const detail=(block.match(/href=["'](https:\/\/telegra\.ph\/[^"']+)["']/i)||[])[1];
  const external=(block.match(/href=["'](https:\/\/(?!(?:t\.me|telegra\.ph)[/])[^"']+)["']/i)||[])[1];
  const postId=marks[i][1];
  out.push({
   id:"yemenhr:"+postId,title:decode(title).slice(0,180),
   organization:decode(organization||"إعلان عبر YemenHR"),
   location:decode(location)+", Yemen",city:decode(location),
   country:"Yemen",countryCode:"YE",publishedAt,
   deadline:deadline?decode(deadline):"",source:"YemenHR public jobs channel",
   url:detail||external||("https://t.me/hr_yemen/"+postId),
   applicationUrl:external||"",expiresAt:deadlineAt||new Date(now+30*86400000).toISOString()
  });
 }
 return out;
}
function parseCareersSaIndex(html){
 const out=[],seen=new Set();
 const re=/<a\b[^>]*href=["']([^"']*\/en\/jobs\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
 for(const m of String(html||"").matchAll(re)){
  const url=new URL(m[1],"https://www.careers.sa");
  if(/\/en\/jobs\/company(?:\/|$)/i.test(url.pathname))continue;
  const title=stripHtml(m[2]).replace(/\s+/g," ").trim();
  if(!seen.has(url.href)&&title){seen.add(url.href);out.push({url:url.href,title});}
 }
 return out.slice(0,20);
}
function parseCareersSaJob(html,url,fallbackTitle){
 const lines=stripHtml(html).split("\n").map(x=>x.trim()).filter(Boolean);
 const h1=(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)||[])[1];
 const title=stripHtml(h1||fallbackTitle).replace(/\s+/g," ").trim();
 const orgLine=lines.find(line=>/^Jobs\s*[\/›]\s*/i.test(line))||"";
 const organization=orgLine.replace(/^Jobs\s*[\/›]\s*/i,"").trim()||"Employer listing via Careers.sa";
 const locationLine=lines.find(line=>/,\s*Saudi Arabia/i.test(line))||"Saudi Arabia";
 const locationMatch=locationLine.match(/([A-Za-z][A-Za-z .'-]{1,45},\s*Saudi Arabia)/i);
 const location=locationMatch?locationMatch[1]:"Saudi Arabia";
 const dateLine=lines.find(line=>/First found/i.test(line))||"";
 const firstFound=(dateLine.match(/First found\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i)||[])[1];
 const publishedAt=firstFound?parseDateLabel(firstFound):new Date(now).toISOString();
 const eligibility=/Targeting Saudi nationals/i.test(lines.join(" "))?"Saudi nationals":"";
 return {
  id:"careers-sa:"+url.split("/").pop(),title:title.slice(0,180),organization,
  location,city:location.split(",")[0],country:"Saudi Arabia",countryCode:"SA",
  publishedAt,source:"Careers.sa employer listing",url,eligibility,
  expiresAt:new Date(now+14*86400000).toISOString()
 };
}
async function fetchYemenHrJobs(){
 const url="https://t.me/s/hr_yemen";
 const html=await getText(url);
 return parseYemenHrJobs(html);
}
async function fetchCareersSaJobs(){
 const indexUrl="https://www.careers.sa/en/jobs";
 const html=await getText(indexUrl),links=parseCareersSaIndex(html),items=[];
 for(const link of links){
  try{const detail=await getText(link.url);const item=parseCareersSaJob(detail,link.url,link.title);if(item.title)items.push(item);}
  catch(error){console.warn("careers.sa detail unavailable: "+link.url+" "+String(error.message||error).slice(0,120));}
 }
 return items;
}

function parseRss(xml,source){const blocks=[...String(xml||"").matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map(x=>x[0]),out=[];for(const block of blocks){const title=tag(block,"title"),url=linkFrom(block),description=tag(block,"description")||tag(block,"summary")||tag(block,"content"),m=(description+" "+block).match(/(?:Duty Station|Location|Duty station|الموقع)\s*[:：]\s*([^<\n\r;|]{2,100})/i),location=m?decode(m[1]):"",place=inferCountry(location+" "+description.slice(0,1200));if(!title||!url||!/^https?:\/\//i.test(url)||!place)continue;const published=tag(block,"pubDate")||tag(block,"published")||tag(block,"updated")||tag(block,"dc:date"),deadline=(description+" "+block).match(/(?:Deadline|Closing Date|Application deadline|آخر موعد)\s*[:：]\s*([^<\n\r;|]{4,50})/i);out.push({id:tag(block,"guid")||url,title:title.slice(0,180),organization:source,location:location||place.country,city:location||"",country:place.country,countryCode:place.countryCode,publishedAt:isoDate(published),deadline:deadline?decode(deadline[1]):"",source,url,expiresAt:new Date(now+30*86400000).toISOString()});}return out;}
async function getText(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);try{const r=await fetch(url,{signal:controller.signal,headers:{Accept:"application/rss+xml, application/atom+xml, application/xml, text/xml, application/json;q=0.9, */*;q=0.8","User-Agent":"DalilnaJobFeed/2.1 (+https://github.com/baraagpt6-droid/dalilna)"}});if(!r.ok)throw new Error("HTTP "+r.status);return await r.text();}finally{clearTimeout(timer);}}
async function reliefWeb(app){const url="https://api.reliefweb.int/v2/jobs?appname="+encodeURIComponent(app)+"&preset=latest&profile=list&limit=100&fields[include]=date.created,country.name,city,source.name,date.closing",data=JSON.parse(await getText(url));return (data.data||[]).map(row=>{const f=row.fields||{},c=Array.isArray(f.country)?f.country[0]?.name:f.country?.name,place=inferCountry(c+" "+(f.city||""));if(!place||!f.url||!f.title)return null;return {id:"reliefweb:"+row.id,title:f.title,organization:f.source?.name||"ReliefWeb",location:[f.city,c].filter(Boolean).join(", "),city:f.city||"",country:place.country,countryCode:place.countryCode,publishedAt:isoDate(f.date?.created),deadline:f.date?.closing||"",source:"ReliefWeb",url:f.url,expiresAt:new Date(now+30*86400000).toISOString()};}).filter(Boolean);}
async function main(){let prev={items:[]};try{prev=JSON.parse(fs.readFileSync(OUT,"utf8"));}catch(_){}const fresh=[],sources=[],feeds=[["UN Careers RSS","https://careers.un.org/jobfeed?isPage=true"]];String(process.env.DALILNA_JOB_RSS_FEEDS||"").split(/[\r\n,]+/).map(x=>x.trim()).filter(Boolean).forEach((url,i)=>feeds.push(["Configured RSS "+(i+1),url]));for(const [name,url] of feeds){try{const items=parseRss(await getText(url),name);fresh.push(...items);sources.push({name,url,status:"ok",count:items.length});}catch(e){sources.push({name,url,status:"unavailable",message:String(e.message||e).slice(0,160),count:0});}}for(const [name,loader,url] of [["YemenHR public channel",fetchYemenHrJobs,"https://t.me/s/hr_yemen"],["Careers.sa Saudi listings",fetchCareersSaJobs,"https://www.careers.sa/en"]]){try{const items=await loader();fresh.push(...items);sources.push({name,url,status:"ok",count:items.length});}catch(e){sources.push({name,url,status:"unavailable",message:String(e.message||e).slice(0,160),count:0});}}const app=String(process.env.RELIEFWEB_APPNAME||"").trim();if(app){try{const items=await reliefWeb(app);fresh.push(...items);sources.push({name:"ReliefWeb Jobs API",url:"https://api.reliefweb.int/v2/jobs",status:"ok",count:items.length});}catch(e){sources.push({name:"ReliefWeb Jobs API",url:"https://api.reliefweb.int/v2/jobs",status:"unavailable",message:String(e.message||e).slice(0,160),count:0});}}else sources.push({name:"ReliefWeb Jobs API",url:"https://api.reliefweb.int/v2/jobs",status:"skipped",message:"RELIEFWEB_APPNAME is not configured.",count:0});const old=(Array.isArray(prev.items)?prev.items:[]).filter(x=>x&&x.url&&Date.parse(x.expiresAt||"")>now&&!/\/en\/jobs\/company(?:\/|$)/i.test(String(x.url))),map=new Map();[...old,...fresh].forEach(item=>{const key=String(item.url).split("#")[0];if(key)map.set(key,item);});const items=[...map.values()].sort((a,b)=>Date.parse(b.publishedAt||0)-Date.parse(a.publishedAt||0)).slice(0,300);if(!fresh.length&&!old.length){console.log("No jobs received; keeping the current index.");console.log(JSON.stringify(sources));return;}if(JSON.stringify(items)===JSON.stringify(old)&&JSON.stringify(sources)===JSON.stringify(prev.sources||[])){console.log("No job-feed content or source-status changes; no commit needed.");return;}fs.writeFileSync(OUT,JSON.stringify({schemaVersion:1,fetchedAt:new Date(now).toISOString(),refreshedBy:"GitHub Actions daily job-feed refresh",sources,items},null,2)+"\n");console.log("Refreshed job index: "+fresh.length+" fresh, "+items.length+" retained.");console.log(JSON.stringify(sources));}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={parseRss,parseDateLabel,parseYemenHrJobs,parseCareersSaIndex,parseCareersSaJob};
