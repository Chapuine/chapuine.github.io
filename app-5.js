function renderFloor2D(){
 const wrap=document.querySelector('#floorView .canvaswrap');
 if(!wrap){ // 动态创建画布容器
  const w2=document.createElement('div');w2.className='canvaswrap';
  w2.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(720px,calc(100vw - 300px));';
  document.getElementById('floorView').insertBefore(w2,document.querySelector('#floorView .legend'));
 }
 const w2=document.querySelector('#floorView .canvaswrap');
 w2.innerHTML='';
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 460 320');
 svg.style.cssText='width:100%;height:auto;background:#FBFCFF';
 w2.appendChild(svg);
 const bd=bldOf(curBld);const bgeo=P.bldGeo.find(x=>x.id===curBld);
 // 画布映射：轮廓 bbox（米制）→ viewBox(0 0 460 320) 内的 40..420 / 30..290
 const xs=bgeo.shape.map(p=>p[0]),zs=bgeo.shape.map(p=>p[1]);
 const bbox={minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
 const bw=bbox.maxX-bbox.minX||1,bd2=bbox.maxZ-bbox.minZ||1;
 const scale=Math.min(380/bw,260/bd2);
 const f2c=(x,z)=>[(40+(x-bbox.minX)*scale),(30+(bd2-(z-bbox.minZ))*scale)];
 // 楼栋轮廓
 const pstr=bgeo.shape.map(p=>f2c(p[0],p[1]).join(',')).join(' ');
 const poly=document.createElementNS('http://www.w3.org/2000/svg','polygon');
 poly.setAttribute('points',pstr);poly.setAttribute('fill','#F2F6FA');poly.setAttribute('stroke','#2E7DE8');poly.setAttribute('stroke-width','1.6');
 svg.appendChild(poly);
 const stats=floorVisitStats(curBld,curFloor,'2026-10-27');
 const zp=DB.zonePos[curBld+'-'+curFloor];
 if(zp)zp.zones.forEach(z=>{
  if(!z.poly||z.poly.length<3)return;

  // 0-100 归一化 → 轮廓 bbox 米制 → 画布
  const mPoly=z.poly.map(p=>[bbox.minX+p[0]/100*bw,bbox.minZ+p[1]/100*bd2]);
  const pts=mPoly.map(p=>f2c(p[0],p[1]));
  const pp=document.createElementNS('http://www.w3.org/2000/svg','polygon');
  pp.setAttribute('points',pts.map(p=>p.join(',')).join(' '));
  const st=stats[z.n];
  pp.setAttribute('fill',colorForZone(z.n));
  pp.setAttribute('stroke', st&&st.total>0?'#E8743B':'#8A96A2');
  pp.setAttribute('stroke-width', st&&st.total>0?'2':'1.2');
  pp.style.cursor='pointer';
  pp.addEventListener('click',e=>showFnTip(e,z.n,stats[z.n],curBld,curFloor));
  pp.addEventListener('mousemove',e=>{if(e.buttons)return;showFnTip(e,z.n,stats[z.n],curBld,curFloor);});
  svg.appendChild(pp);
  const cx=pts.reduce((s,p)=>s+p[0],0)/pts.length, cy=pts.reduce((s,p)=>s+p[1],0)/pts.length;
  const tx=document.createElementNS('http://www.w3.org/2000/svg','text');
  tx.setAttribute('x',cx);tx.setAttribute('y',cy);tx.setAttribute('text-anchor','middle');
  tx.setAttribute('font-size','11');tx.setAttribute('fill','#33414E');
  tx.textContent=z.n+(st&&st.total?(' · '+st.total+'人'):'');
  svg.appendChild(tx);
 });
 // 实时人员
 Object.values(DB.realtime).forEach(r=>{
  if(r.b!==curBld||r.f!==curFloor)return;
  const g=document.createElementNS('http://www.w3.org/2000/svg','g');
  const rm=[bbox.minX+r.x/100*bw,bbox.minZ+r.y/100*bd2];
  const rc=f2c(rm[0],rm[1]);
  const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
  c.setAttribute('cx',rc[0]);c.setAttribute('cy',rc[1]);
  c.setAttribute('r','6');c.setAttribute('fill','#E0452E');c.setAttribute('stroke','#fff');c.setAttribute('stroke-width','2');
  g.appendChild(c);svg.appendChild(g);
 });
 $id('statusbar').innerHTML=
  '<div class="chip"><span class="dot" style="background:#2E7DE8"></span>'+bd.name+' '+curFloor+'F</div>'
  +'<div class="chip">已配置区域 <b>'+((zp&&zp.zones.length)||0)+'</b></div>'
  +'<div class="chip">信标组 <b>'+DB.beacons.filter(x=>x.bld===curBld&&x.floor===curFloor).length+'</b></div>';
 renderFloorStats(curBld,curFloor);
}
function renderFloorStats(b,f){
 const body=$id('flStatsBody');
 const bd=bldOf(b);
 const stats=floorVisitStats(b,f,DAY);
 const zp=DB.zonePos[b+'-'+f];
 const zns=zp?zp.zones:[];
 const cov=zns.filter(z=>stats[z.n]).length;
 const allZ=Object.keys(stats);
 const mapZ={};
 Object.keys(stats).forEach(k=>{mapZ[k]=stats[k];});
 body.innerHTML='';
 body.appendChild(el('div','','<div style="font-size:13px;font-weight:700">'+bd.name+' · '+f+'F 完成情况</div>'
  +'<div style="font-size:11.5px;color:#5A6A78;margin:2px 0 6px">'+DAY+' · 已覆盖区域 <b>'+cov+'/'+zns.length+'</b>'
  +(allZ.length?' · 实际到访 '+allZ.length+' 个':'')+'</div>'));
 if(!zns.length){
  body.appendChild(el('div','hint','本层未配置功能区'));
  return;
 }
 const tb=el('table','','<tr><th>区域</th><th>状态</th><th>到访</th><th>平均停留</th><th></th></tr>');
 zns.forEach(z=>{
  const st=mapZ[z.n];
  const r=el('tr','');
  if(st){
   const staffs=Object.keys(st.staffs).length;
   const avg=Math.round(Object.values(st.staffs).reduce((s,x)=>s+x[1],0)/Math.max(1,Object.keys(st.staffs).length));
   r.innerHTML='<td><b>'+z.n+'</b></td>'
    +'<td><span class="tag" style="background:#E8F5EE;color:#2E9E6B">已到访</span></td>'
    +'<td>'+staffs+'人 · '+st.total+'次</td>'
    +'<td>'+fmtDur(avg)+'</td><td><button class="btn sm" data-zone="'+z.n+'">明细</button></td>';
   r.style.cursor='pointer';
   r.dataset.zone=z.n;
  }else{
   r.innerHTML='<td>'+z.n+'</td>'
    +'<td><span class="tag" style="background:#F4F6F8;color:#8A96A2">未到访</span></td>'
    +'<td style="color:#8A96A2">—</td><td>—</td><td></td>';
  }
  tb.appendChild(r);
 });
 body.appendChild(tb);
 tb.querySelectorAll('tr[data-zone]').forEach(r=>{
  r.addEventListener('click',()=>{
   const zn=r.dataset.zone;
   const st=mapZ[zn];
   if(!st)return;
   if(r.__exp){r.__exp.remove();r.__exp=null;return;}
   const sub=el('tr','','<td colspan="5"><div style="background:#F7FAFD;border-radius:6px;padding:6px 8px">'
    +'<div style="font-weight:700;font-size:11.5px;margin-bottom:3px">'+bd.name+' '+f+'F · '+zn+' 进出明细</div>'
    +Object.entries(st.staffs).map(([sid,x])=>{
     const s=DB.staff.find(y=>y.id===sid);
     const times=(DAYSTATS.zone[b+'|'+f+'|'+zn]||[]).filter(v=>v.sid===sid);
     return '<div style="display:flex;justify-content:space-between;font-size:11.5px;border-top:1px dashed #D7E0E8;padding:2px 0">'
      +'<span>'+s.name+' · '+times.map(t=>t.t).join('、')+'</span>'
      +'<b>'+fmtDur(Math.round(x[1]/x[0]))+'/次</b></div>';
    }).join('')+'</div></td>');
   sub.style.cursor='default';
   tb.insertBefore(sub,r.nextSibling);
   r.__exp=sub;
  });
 });
 const fns=DB.fences.filter(fn=>fn.bld===b&&fn.floor===f);
 if(fns.length){
  body.appendChild(el('div','','<div style="font-weight:700;font-size:12px;margin:8px 0 3px">本层电子围栏</div>'
   +fns.map(fn=>'<div style="display:flex;justify-content:space-between;font-size:11.5px;padding:2px 0">'
    +'<span><b style="color:#E0452E">■</b> '+fn.name+'（'+fn.level+'）</span>'
    +'<span style="color:#8A96A2">授权 '+fn.auth.map(a=>(DB.staff.find(s=>s.id===a)||{}).name||a).join('、')+'</span></div>').join('')));
 }
}
function showFnTip(ev,zn,st,b,f){
 const tip=$id('fnTip');
 if(!st){tip.style.display='none';return;}
 const bd=bldOf(b);
 let html='<b>'+bd.name+' · '+f+'F · '+zn+'</b>';
 html+='<div class="trow"><span>当日到访员工</span><b>'+Object.keys(st.staffs).length+' 人</b></div>';
 html+='<div class="trow"><span>总到访次数</span><b>'+st.total+' 次</b></div>';
 const avg=Math.round(Object.values(st.staffs).reduce((s,x)=>s+x[1],0)/Math.max(1,Object.keys(st.staffs).length));
 html+='<div class="trow"><span>平均停留</span><b>'+fmtDur(avg)+'</b></div>';
 html+='<div style="margin-top:5px;border-top:1px dashed #C8D2DB;padding-top:5px">';
 Object.entries(st.staffs).forEach(([sid,x])=>{
  const s=DB.staff.find(y=>y.id===sid);
  html+='<div class="trow"><span>'+s.name+'</span><b>'+x[0]+'次 / '+fmtDur(Math.round(x[1]/x[0]))+'</b></div>';
 });
 html+='</div>';
 tip.innerHTML=html;
 const r=tip.parentElement.getBoundingClientRect();
 const w=tip.offsetWidth||200;
 let x=ev.clientX-w-12,y=ev.clientY-40;
 tip.style.display='block';
 tip.style.left=Math.max(8,Math.min(innerWidth-w-8,x))+'px';
 tip.style.top=Math.max(8,y)+'px';
 document.addEventListener('mousemove',ev2=>{
  const t2=ev2.target;
  if(t2&&(t2.tagName==='polygon'||t2.closest('#fnTip')))return;
  tip.style.display='none';
 },{once:false});
}
function fmtDur(sec){
 sec=Math.max(0,Math.round(sec));
 if(sec<60)return sec+' 秒';
 if(sec<3600)return Math.floor(sec/60)+' 分 '+Math.round(sec%60)+' 秒';
 return Math.floor(sec/3600)+' 时 '+Math.round(sec%3600/60)+' 分';
}
/* ============================================================ 人员视图（项目级轨迹回放） */
function initStaffView(){
 const sel=$id('stStaff');sel.innerHTML='';
 DB.staff.forEach(s=>{const o=el('option','',s.name+'（'+s.role+'）');o.value=s.id;sel.appendChild(o);});
 sel.value=curStaff;
 const d=$id('stDate');d.innerHTML='';
 Object.keys(DB.tracks[curStaff]).forEach(x=>{const o=el('option','',x);o.value=x;d.appendChild(o);});
 sel.onchange=()=>{curStaff=sel.value;buildStaffView();};
 d.onchange=()=>buildStaffView();
 $id('crumb').textContent='人员视图 · 项目级轨迹回放';
 buildStaffView();
}
let staffAnim=null;
function renderStaffStats(sid,date){
 const body=$id('staffStatsBody');
 const s=DB.staff.find(x=>x.id===sid);
 const st=staffDayStats(sid,date);
 body.innerHTML='';
 if(!st){body.appendChild(el('div','hint','该员工当日无作业记录'));return;}
 const workMin=toMin(st.endT)-toMin(st.startT);
 body.appendChild(el('div','','<div style="font-size:13px;font-weight:700">'+s.name+'（'+s.role+'）· '+date+'</div>'
  +'<div class="statrow" style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0"><span class="tag" style="background:#E8F1FA;color:#3A6580">轨迹点 '+st.points+'</span>'
  +'<span class="tag" style="background:#E8F5EE;color:#2E9E6B">覆盖楼栋 '+st.blds+'</span>'
  +'<span class="tag" style="background:#F6EFE3;color:#B97A24">覆盖楼层 '+st.floors+'</span>'
  +'<span class="tag" style="background:#F6E3E1;color:#C24B3A">作业时长 '+fmtDur(workMin*60)+'</span></div>'
  +'<div style="font-size:11.5px;color:#5A6A78">开始 <b>'+st.startT+'</b> · 结束 <b>'+st.endT+'</b></div>'));
 // 区域停留排行
 body.appendChild(el('div','','<div style="font-weight:700;font-size:12.5px;margin:8px 0 4px">区域停留排行（累计）</div>'));
 const tb=el('table','','<tr><th>区域</th><th>次数</th><th>累计停留</th><th>时段</th></tr>');
 st.agg.slice(0,12).forEach(a=>{
  tb.appendChild(el('tr','','<td>'+bname(a.b)+' '+(a.f>0?a.f+'F ':'')+a.z+'</td><td>'+a.cnt+'</td>'
   +'<td><b>'+fmtDur(a.stay)+'</b></td><td style="font-size:11px;color:#5A6A78">'+a.firstT+'~'+a.lastT+'</td>'));
 });
 body.appendChild(tb);
 // 按楼栋分组的作业路线
 Object.keys(st.byBld).forEach(b=>{
  const rows=st.byBld[b];
  body.appendChild(el('div','','<div style="font-weight:700;font-size:12.5px;margin:8px 0 4px">'+bname(b)+' 作业路线（'+rows.length+' 个点位）</div>'));
  const tb2=el('table','','<tr><th>时间</th><th>楼层</th><th>区域</th><th>停留</th></tr>');
  rows.forEach(v=>{
   tb2.appendChild(el('tr','','<td>'+v.t+'</td><td>'+(v.f>0?v.f+'F':'-')+'</td><td>'+v.z+'</td><td>'+fmtDur(v.stay)+'</td>'));
  });
  body.appendChild(tb2);
 });
}
function buildStaffView(){
 setBldScene('staff');
 const sid=curStaff,date=$id('stDate').value||'2026-10-27';
 const tk=DB.tracks[sid][date];
 $id('statusbar').innerHTML=
  '<div class="chip"><span class="dot" style="background:#2E7DE8"></span>'+DB.staff.find(s=>s.id===sid).name
  +'（'+DB.staff.find(s=>s.id===sid).role+'）</div>'
  +'<div class="chip">'+date+' · 轨迹点 <b>'+tk.length+'</b></div>'
  +'<div class="chip">覆盖楼栋 <b>'+new Set(tk.map(p=>p.b)).size+'</b></div>';
 renderStaffStats(sid,date);
 // 移除旧轨迹线
 scene.getObjectsByProperty&&0;
 scene.traverse(o=>{if(o.__isTrack)scene.remove(o);});
 // 轨迹线（3D，穿过楼栋位置，坐标经 0-100→轮廓米制映射）
 const linePts=[];
 tk.forEach((p,i)=>{
  const pos=bldLayoutPos(p.b);
  const c=zoneCenter3D(p.b,p.z,p.f);
  linePts.push(new THREE.Vector3(pos.x+c[0],0.8,pos.z+c[1]));
 });
 const lg=new THREE.BufferGeometry().setFromPoints(linePts);
 const line=new THREE.Line(lg,new THREE.LineDashedMaterial({color:0x2E7DE8,dashSize:0.8,gapSize:0.5,transparent:true,opacity:0.85}));
 line.computeLineDistances();line.__isTrack=true;scene.add(line);
 // 时间线
 const slider=$id('tlSlider');slider.max=tk.length-1;slider.value=0;
 const tlTime=$id('tlTime');
 const mk=()=>{const i=+slider.value;const p=tk[i];tlTime.textContent=p.t;
  const pos=bldLayoutPos(p.b);
  const c=zoneCenter3D(p.b,p.z,p.f);
  const target=new THREE.Vector3(pos.x+c[0],0.8,pos.z+c[1]);
  if(!marker){marker=new THREE.Mesh(new THREE.SphereGeometry(0.7,16,16),
    new THREE.MeshStandardMaterial({color:0xE0452E,emissive:0xE0452E,emissiveIntensity:0.5}));
   scene.add(marker);}
  marker.position.copy(target);
  const lb=$id('staffLabel');if(!lb)return;
  const s=DB.staff.find(x=>x.id===sid);
 lb.textContent=s.name+' · '+bname(p.b)+' '+p.z+' · '+p.t;
 };
 let marker=null;
 $id('staffLabel')==null&&(()=>{const d=document.createElement('div');d.id='staffLabel';
  d.style.cssText='position:absolute;left:50%;top:70px;transform:translateX(-50%);z-index:14;background:rgba(255,255,255,.95);border:1px solid #E0452E;border-radius:10px;padding:6px 14px;font-size:13px;font-weight:600;color:#E0452E;box-shadow:0 4px 16px rgba(0,0,0,.12)';
  document.body.appendChild(d);})();
 mk();
 slider.oninput=mk;
 window.__tlState={slider:slider,tk:tk,mk:mk,playing:false,iv:null};
 togglePlay();
 buildStaffView.__clean=()=>{clearInterval(__tlState.iv);};
}
function togglePlay(){
 const S=window.__tlState;if(!S)return;
 S.playing=!S.playing;
 $id('tlPlay').textContent=S.playing?'暂停':'播放';
 if(S.playing){S.iv=setInterval(()=>{
   let i=+S.slider.value+1;if(i>=S.tk.length){i=0;}
   S.slider.value=i;S.mk();
  },900);}
 else clearInterval(S.iv);
}
