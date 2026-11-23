"use strict";
(() => {
  const DATA_URL="./market_prices_yemen.json";
    const $=id=>document.getElementById(id);
  let data=null,activeCategory="all";
  const number=value=>Number(value).toLocaleString("en-US",{maximumFractionDigits:0});
  const money=value=>number(Math.round(value));
  const safeUrl=value=>{try{const u=new URL(value);return u.protocol==="https:"?u.href:"";}catch(_){return "";}};
  function mid(zone,currency){
    const rates=data?.exchangeRates?.[zone];
    if(!rates)return 0;
    if(currency==="YER")return 1;
    if(currency==="USD")return rates.usd.mid;
    if(currency==="SAR")return rates.sar.mid;
    return 0;
  }
  function baseUsd(item){
    const p=item.pricing||{},zone=p.sourceZone||"sanaa";
    if(p.currency==="USD")return Number(p.amount??((Number(p.min||0)+Number(p.max||0))/2));
    const localMid=mid(zone,"USD");
    return localMid>0?Number(p.amount??((Number(p.min||0)+Number(p.max||0))/2))/localMid:0;
  }
  function converted(item,zone){
    const p=item.pricing||{},usd=baseUsd(item);
    if(!usd)return null;
    const yer=usd*mid(zone,"USD"),sar=usd*mid(zone,"SAR");
    const sourceZone=p.sourceZone||"sanaa";
    const low=Number(p.min||p.amount||0),high=Number(p.max||p.amount||0);
    const factor=mid(zone,"USD")/Number(data.exchangeRates[sourceZone]?.usd?.mid||mid(zone,"USD"));
    const sourceRange=high>low;
    return {yer:yer,sar:sar,usd:usd,low:sourceRange?low*factor:null,high:sourceRange?high*factor:null};
  }
  function formatPrice(item,zone){
    const v=converted(item,zone);
    if(!v)return "السعر غير متاح";
    const p=item.pricing||{},range=Number(p.max||0)>Number(p.min||0);
    if(range&&p.currency==="YER"){
      const fx=mid(zone,"USD")/mid(p.sourceZone||"sanaa","USD");
      return money(Number(p.min)*fx)+" – "+money(Number(p.max)*fx)+" ريال";
    }
    return money(v.yer)+" ريال";
  }
  function html(tag,className,text){
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(text!==undefined)el.textContent=text;
    return el;
  }
  function renderCard(item){
    const card=html("article","price-guide-card");
    const image=html("img","price-guide-image");
    image.src="./market-price-images/"+item.image;
    image.alt=item.title;
    image.loading="lazy";
    image.addEventListener("error",()=>image.remove(),{once:true});
    card.appendChild(image);
    const body=html("div","price-guide-card-body");
    body.appendChild(html("h4","",item.title));
    body.appendChild(html("p","price-guide-subtitle",item.subtitle||""));
    const source=html("div","price-guide-source",item.priceLabel+" · "+item.sourceName);
    body.appendChild(source);
    const priceGrid=html("div","price-guide-prices");
    for(const [key,label] of [["sanaa","صنعاء"],["aden","عدن"]]){
      const cell=html("div","price-guide-price");
      cell.appendChild(html("small","",label+" · ريال يمني"));
      cell.appendChild(html("b","",formatPrice(item,key)));
      priceGrid.appendChild(cell);
    }
    body.appendChild(priceGrid);
    const usd=baseUsd(item);
    const sanaa=converted(item,"sanaa"),aden=converted(item,"aden");
    const foreign=html("p","price-guide-foreign",usd?("صنعاء: "+money(sanaa.usd)+" USD · "+money(sanaa.sar)+" SAR | عدن: "+money(aden.usd)+" USD · "+money(aden.sar)+" SAR"):"لا يتوفر متوسط موثق بالدولار أو الريال السعودي");
    body.appendChild(foreign);
    body.appendChild(html("p","price-guide-date","آخر مراجعة للمصدر: "+(item.sourceCheckedAt||data.lastChecked)));
    const actions=html("div","price-guide-actions");
    const seller=html("button","add","ابحث عن بائع");
    seller.type="button";
    seller.addEventListener("click",()=>findSeller(item.category));
    actions.appendChild(seller);
    const request=html("button","ghost","اطلب هذه السلعة");
    request.type="button";
    request.addEventListener("click",()=>{
      const buy=$("sqBuy");
      if(buy){buy.click();setTimeout(()=>{const title=document.querySelector("#vSouq input[name='name'],#vSouq input[name='title'],#vSouq textarea[name='desc']");if(title&&!title.value)title.value="طلب شراء: "+item.title;},150);}
    });
    actions.appendChild(request);
    const sourceUrl=safeUrl(item.sourceUrl);
    if(sourceUrl){
      const sourceLink=html("a","price-guide-source-link","المصدر");
      sourceLink.href=sourceUrl;sourceLink.target="_blank";sourceLink.rel="noopener noreferrer";
      actions.appendChild(sourceLink);
    }
    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }
  function findSeller(category){
    const group={solar:"solar",electronics:"electronics",vehicles:"vehicles",property:"property"}[category]||"all";
    const tab=document.querySelector("#souqCategoryTabs [data-group='"+group+"']");
    if(tab)tab.click();
    const context=window.regionCurrentContext?window.regionCurrentContext():null;
    const gov=context?.gov||context?.governorate||"";
    const selector=$("sharedSouqGovernorate");
    if(selector&&gov&&[...selector.options].some(option=>option.value===gov)){
      selector.value=gov;
      selector.dispatchEvent(new Event("change",{bubbles:true}));
    }
    $("sharedSouqItems")?.scrollIntoView({behavior:"smooth",block:"start"});
  }
  function render(){
    const mount=$("marketPriceGuideMount");
    if(!mount||!data)return;
    const panel=html("section","price-guide-panel");
    panel.id="yemenLivePriceGuide";
    const head=html("div","price-guide-head");
    const title=html("div","",undefined);
    title.appendChild(html("h3","","أسعار السوق اليمنية الاسترشادية"));
    title.appendChild(html("p","price-guide-note",data.priceDisclosure));
    head.appendChild(title);
    head.appendChild(html("span","price-guide-live-tag","فحص أسعار الهواتف والطاقة أسبوعياً"));
    panel.appendChild(head);
    const rates=data.exchangeRates;
    panel.appendChild(html("p","price-guide-fx-note","مرجع الصرف "+data.exchangeRates.asOf+" · صنعاء USD "+rates.sanaa.usd.mid+" / SAR "+rates.sanaa.sar.mid+" · عدن USD "+rates.aden.usd.mid+" / SAR "+rates.aden.sar.mid));
    const tabs=html("div","price-guide-tabs");
    [["all","الكل"],...data.categories.map(c=>[c.id,c.label])].forEach(([id,label])=>{
      const button=html("button",activeCategory===id?"active":"",label);
      button.type="button";
      button.setAttribute("aria-pressed",activeCategory===id?"true":"false");
      button.addEventListener("click",()=>{activeCategory=id;render();});
      tabs.appendChild(button);
    });
    panel.appendChild(tabs);
    const grid=html("div","price-guide-grid");
    const items=data.items.filter(item=>activeCategory==="all"||item.category===activeCategory);
    items.forEach(item=>grid.appendChild(renderCard(item)));
    panel.appendChild(grid);
    const footer=html("p","price-guide-footer","الأسعار المنشورة من متاجر أو أدلة أسعار تُعرض كمراجع. أسعار السيارات والعقارات المعروضة عينات إعلانات أفراد وليست متوسطات سوق. لا يوجد سعر موثق لبعض الأصناف حتى الآن. إعلانات البائعين الحقيقية تظهر أولاً في الأعلى.");
    panel.appendChild(footer);
    mount.replaceChildren(panel);
  }
  async function load(){
    try{
      const response=await fetch(DATA_URL,{cache:"no-store"});
      if(!response.ok)throw new Error("HTTP "+response.status);
      data=await response.json();
      render();
    }catch(error){
      const mount=$("marketPriceGuideMount");
      if(mount)mount.textContent="تعذر تحميل قائمة الأسعار المحفوظة على الجهاز.";
    }
  }
  function search(query){
    const q=String(query||"").normalize("NFKC").toLowerCase();
    if(!data)return [];
    return data.items.filter(item=>(item.title+" "+item.subtitle+" "+item.category).toLowerCase().includes(q)
      || (item.category==="solar"&&/(طاقة|شمس|بطاري|انفرتر|لوح)/.test(q))
      || (item.category==="electronics"&&/(جوال|هاتف|سامسونج|ايفون|شاومي|لابتوب|الكترون)/.test(q))
      || (item.category==="vehicles"&&/(سيار|هايلوكس|تويوتا|دباب|باص)/.test(q))
      || (item.category==="property"&&/(عقار|ارض|شقه|ايجار|محل)/.test(q)));
  }
  function getPriceSummary(item){
    if(!data||!item)return "";
    return "صنعاء: "+formatPrice(item,"sanaa")+" · عدن: "+formatPrice(item,"aden")
      +" · "+money(baseUsd(item))+" USD · "+money(baseUsd(item)*Number(data.exchangeRates.sarPerUsd||3.75))+" SAR";
  }
  window.DalilnaPriceGuide={load,search,getData:()=>data,getPriceSummary};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load,{once:true});else load();
})();
