/* ComparáTech · piezas de detalle de producto compartidas (ventana de detalle de «Productos» y página producto.html). */
(function (root) {
  "use strict";
  const DET = {};
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ARS = n => n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR");
  const price = o => o.price_cash ?? o.price_list;
  const COLORS = ["#1f6feb", "#e0763a", "#12a37a", "#b04ad6", "#d6a31f", "#d64a6a", "#4a9ed6"];
  /* ctx = { HIST, META, CFG, REP, stale(store) } */
  DET.chart = function (g, ctx) {
    const { HIST, META } = ctx, best = x => price(x.offers[0]);

  const lines=g.offers.map((o,i)=>({o,c:COLORS[i%COLORS.length],s:(HIST[o.k]||[]).map(x=>[x[0],x[1]])})).filter(l=>l.s.length);
  const today=(META.updated||new Date().toISOString()).slice(0,10),D=d=>new Date(d).getTime();
  const all=lines.flatMap(l=>l.s.filter(x=>x[0]).map(x=>D(x[0])));
  const pts=lines.flatMap(l=>l.s.map(x=>x[1]));
  if(!pts.length)return "";
  const t0=Math.min(...all,D(today)-86400000*7),t1=Math.max(D(today),...all);
  const mn=Math.min(...pts),mx=Math.max(...pts),pad=(mx-mn)*.15||mx*.05,lo=mn-pad,hi=mx+pad;
  const W=760,H=230,L=64,R=10,T=10,B=26,X=t=>L+(t-t0)/(t1-t0||1)*(W-L-R),Y=p=>T+(1-(p-lo)/(hi-lo))*(H-T-B);
  let svg=`<svg viewBox="0 0 ${W} ${H}">`;
  for(let i=0;i<=3;i++){const p=lo+(hi-lo)*i/3,y=Y(p);svg+=`<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="currentColor" opacity=".12"/><text x="${L-6}" y="${y+4}" text-anchor="end" font-size="11" fill="currentColor" opacity=".6">${ARS(p)}</text>`}
  for(let i=0;i<=4;i++){const t=t0+(t1-t0)*i/4;svg+=`<text x="${X(t)}" y="${H-6}" text-anchor="${i==0?"start":i==4?"end":"middle"}" font-size="11" fill="currentColor" opacity=".6">${new Date(t).toLocaleDateString("es-AR",{day:"numeric",month:"short"})}</text>`}
  lines.forEach(l=>{let d="",prev=null;
    const s=l.s.map(x=>[x[0]?D(x[0]):t0,x[1]]);s.push([D(today),s[s.length-1][1]]);
    s.forEach(([t,p],i)=>{d+=i==0?`M${X(t)},${Y(p)}`:`H${X(t)}V${Y(p)}`});
    svg+=`<path d="${d}" fill="none" stroke="${l.c}" stroke-width="2.2" stroke-linejoin="round"/>`;
    const e=s[s.length-1];svg+=`<circle cx="${X(e[0])}" cy="${Y(e[1])}" r="3.5" fill="${l.c}"/>`});
  svg+=`</svg><div class="leg">${lines.map(l=>`<span><i style="background:${l.c}"></i>${esc(l.o.store)}</span>`).join("")}</div>`;
  const n=Math.max(...lines.map(l=>l.s.length));
  const top=g.offers[0],ts=HIST[top.k]||[],tv=ts.map(x=>x[1]);
  const msg=tv.length>=3&&price(top)<=Math.min(...tv)?"Es el precio más bajo registrado de esta tienda.":tv.length?`Precio más bajo registrado en ${esc(top.store)}: ${ARS(Math.min(...tv))}.`:"";
  return `<div class="chart"><b>Historial de precio</b> <span class="sub">${msg} ${n<3?"El historial se va armando con cada actualización.":""}</span>${svg}</div>`;
  };
  DET.offerRows = function (g, ctx) {
    const { CFG, REP, stale } = ctx;
  return g.offers.map((o,k)=>{
    const st=o.stock===true?'<span class="in">● Con stock</span>':o.stock===false?'<span class="out">● Sin stock</span>':'<span class="sub">a confirmar</span>';
    const rt=o.rating?` ⭐${o.rating.score}${o.rating.count?` (${o.rating.count})`:""}`:"";
    const ch=o.chg?` <span class="${o.chg.pct<0?"dn":"up"}">${o.chg.pct<0?"▼":"▲"}${Math.abs(o.chg.pct)}%</span>`:"";
    const cu=o.cuotas?esc(o.cuotas):(CFG.stores[o.store]?.cuotas&&o.price_list?`${CFG.stores[o.store].cuotas.n} cuotas${CFG.stores[o.store].cuotas.sin_interes?" sin interés":""} de ${ARS(o.price_list/CFG.stores[o.store].cuotas.n)}`:'<span class="sub">consultar</span>');
    return `<tr class="${k===0?"best":""}"><td><b>${esc(o.store)}</b>${rt}${REP.badge(o.store)}${stale(o.store)?'<span class="warnpill">dato viejo</span>':""}${o.anom?'<span class="warnpill">precio inusual</span>':""}</td><td class="n">${ARS(o.price_cash)}${ch}</td><td class="n">${ARS(o.price_list)}</td><td>${cu}</td><td>${st}</td><td><a target="_blank" rel="noopener nofollow" href="${esc(o.url)}">Ir a la tienda ↗</a></td></tr>`}).join("");
  };
  DET.offersTable = (g, ctx) => `<div class="tw2"><table><tr><th>Tienda</th><th class="n">Efectivo / transf.</th><th class="n">Lista / tarjeta</th><th>Cuotas</th><th>Stock</th><th></th></tr>${DET.offerRows(g, ctx)}</table></div>`;
  DET.url = id => "producto.html?id=" + encodeURIComponent(id);
  if (typeof module !== "undefined" && module.exports) module.exports = DET; else root.DET = DET;
})(typeof self !== "undefined" ? self : this);
