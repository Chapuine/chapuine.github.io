function rtRenderAlerts(){
 const body=$id('rtAlertBody');body.innerHTML='';
 if(!DB.fenceAlerts.length){body.innerHTML='<div class="hint">暂无围栏事件。员工进入/离开围栏区域时在此实时记录。</div>';return;}
 DB.fenceAlerts.forEach((a,i)=>{

  const s=DB.staff.find(x=>x.id===a.staff);
  const fn=DB.fences.find(x=>x.id===a.fence);
  const d=el('div','','');
  d.style.cssText='border-bottom:1px dashed #E4E9EE;padding:8px 2px;'+(i===0?'background:#FDF3F1;border-radius:6px;':'');
  d.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px"><b style="font-size:12.5px">'+(a.authed?'授权':'<span style="color:#E0452E">未授权</span>')+' '+(a.action==='进入'?'进入':'离开')+'</b>'
   +'<span style="font-size:11px;color:#5A6A78;font-variant-numeric:tabular-nums">'+a.t+'</span></div>'
   +'<div style="font-size:11.5px;color:#33414E;margin-top:3px">'+s.name+' · '+(fn?fn.name.split('（')[0]:'')+'（'+a.level+'）</div>';
  body.appendChild(d);
 });
}
function rtStatus(){
 const b=P.bldGeo.find(x=>x.id===curBld);
 const staffHere=DB.staff.filter(s=>DB.realtime[s.id]&&DB.realtime[s.id].b===curBld&&DB.realtime[s.id].f===curFloor).length;
 $id('statusbar').innerHTML=
  '<div class="chip"><span class="dot" style="background:#2E9E6B"></span>实时定位 · '+b.name+' '+curFloor+'F</div>'
  +'<div class="chip">在线工牌 <b>'+DB.staff.length+'</b></div>'
  +'<div class="chip">本层人员 <b>'+staffHere+'</b></div>'
  +'<div class="chip">围栏告警 <b style="color:#E0452E">'+DB.fenceAlerts.filter(a=>!a.authed).length+'</b></div>';
}
function rtRefreshRoute(){
 const sel=$id('rtStaff').value,tgt=$id('rtTarget').value;
 if(!sel||!tgt){if(rtRoute&&rtRoute.parent)rtRoute.parent.remove(rtRoute);rtRoute=null;
  $id('rtNavInfo').textContent='未选择目的地';return;}
 const st=rtSim[sel];if(!st)return;
 const zn=rtZones[tgt];
 if(!zn){$id('rtNavInfo').textContent='目的地未配置位置';return;}
 const tc=zn.center;
 // 路径：当前位置 → 目标中心（经过走廊节点简化：直连 + 折线）
 const pts=[new THREE.Vector3(st.x,0.35,st.z)];
 // 若起点不在走廊，先走到走廊中心（最近走廊 poly）
 const curZn=rtZoneOf(curBld,curFloor,st.x,st.z);
 const corr=rtZones['走廊'];
 if(curZn!==tgt&&corr){
  const cc=corr.center;
  pts.push(new THREE.Vector3(cc[0],0.35,cc[1]));
 }
 pts.push(new THREE.Vector3(tc[0],0.35,tc[1]));
 if(rtRoute&&rtRoute.parent)rtRoute.parent.remove(rtRoute);
 const g=new THREE.BufferGeometry().setFromPoints(pts);
 rtRoute=new THREE.Line(g,new THREE.LineDashedMaterial({color:0x2E7DE8,dashSize:0.5,gapSize:0.3,transparent:true,opacity:0.95}));
 rtRoute.computeLineDistances();rtGroup.add(rtRoute);
 // 目的地球
 if(rtDest)rtGroup.remove(rtDest);
 rtDest=new THREE.Mesh(new THREE.SphereGeometry(0.6,16,16),
  new THREE.MeshStandardMaterial({color:0xE8743B,emissive:0xE8743B,emissiveIntensity:0.6}));
 rtDest.position.set(tc[0],0.9,tc[1]);rtGroup.add(rtDest);
 // 距离与方向
 let dist=0;for(let i=1;i<pts.length;i++)dist+=pts[i].distanceTo(pts[i-1]);
 const dx=tc[0]-st.x,dz=tc[1]-st.z;
 const ang=Math.atan2(dz,dx)*180/Math.PI;
 const dir=ang>=-22.5&&ang<22.5?'东':ang>=22.5&&ang<67.5?'东南':ang>=67.5&&ang<112.5?'南':ang>=112.5&&ang<157.5?'西南':ang>=157.5||ang<-157.5?'西':ang>=-157.5&&ang<-112.5?'西北':'北';
 $id('rtNavInfo').textContent=''+selName(sel)+' → '+tgt+'：约 '+dist.toFixed(1)+' m · 方向'+dir+'（经走廊）';
}
function selName(id){const s=DB.staff.find(x=>x.id===id);return s?s.name:id;}
function initRtView(){
 rtInit();
 const sl=$id('rtBld');sl.innerHTML='';
 P.bldGeo.forEach(x=>{const o=el('option','',x.name);o.value=x.id;sl.appendChild(o);});
 sl.value=curBld;
 const fillF=()=>{const fl=$id('rtFloor');fl.innerHTML='';
  const bd=bldOf(curBld);
  const Fs=realFloors(bd);
  curFloor=Fs.includes(curFloor)?curFloor:(Fs[0]||1);
  Fs.forEach(i=>{const o=el('option','',i+' 层');o.value=i;fl.appendChild(o);});
  fl.value=curFloor;};
 fillF();
 sl.onchange=()=>{curBld=sl.value;fillF();rtOpen();};
 $id('rtFloor').onchange=()=>{curFloor=+$id('rtFloor').value;rtOpen();};
 // 员工/目的地
 const ss=$id('rtStaff');ss.innerHTML='';
 DB.staff.forEach(s=>{const o=el('option','',s.name);o.value=s.id;ss.appendChild(o);});
 ss.value='S1';
 const fillT=()=>{const tg=$id('rtTarget');tg.innerHTML='';
  const zp=DB.zonePos[curBld+'-'+curFloor];
  (zp?zp.zones:[]).forEach(z=>{const o=el('option','',z.n);o.value=z.n;tg.appendChild(o);});};
 fillT();
 ss.onchange=()=>{rtSelected=ss.value;rtRefreshRoute();};
 $id('rtTarget').onchange=()=>rtRefreshRoute();
 $id('rtFence').onchange=()=>{rtFenceMesh.forEach(m=>m.visible=$id('rtFence').checked);};
 $id('rtNav').onchange=()=>{
  if(!$id('rtNav').checked&&rtRoute){rtGroup.remove(rtRoute);rtRoute=null;rtGroup.remove(rtDest);rtDest=null;}
  else rtRefreshRoute();};
 $id('rtHint')&&0;
 rtOpen();
 // 点击人员标签选择
 $id('rtLabels').addEventListener('pointerdown',e=>{
  const t=e.target;if(!t||!t.__rtStaff)return;
  rtSelected=t.__rtStaff;
  $id('rtStaff').value=rtSelected;rtRefreshRoute();
 });
}
function rtOpen(){
 if(rtGroup&&rtGroup.parent)rtScene.remove(rtGroup);
 rtBuildFloor(curBld,curFloor);
 // 初始化模拟状态：仅当前楼栋+当前楼层的真实在线员工进入本层演示
 DB.staff.forEach(s=>{
  const r=DB.realtime[s.id];
  if(!r||r.b!==curBld||r.f!==curFloor){rtSim[s.id]=null;return;}
  const mp=rtMap([r.x,r.y]);
  rtSim[s.id]={x:mp[0],z:mp[1],target:null,__inFence:{}};
 });
 $id('crumb').textContent='实时监控 · '+P.name+' · '+bname(curBld)+' '+curFloor+'F';
 rtStatus();
 rtRenderAlerts();
 rtRefreshRoute();
 // 动画循环
 if(!rtAnimOn){
  rtAnimOn=true;
  (function loop(){
   requestAnimationFrame(loop);
   if(rtControls)rtControls.update();
   if(rtRenderer&&rtScene)rtRenderer.render(rtScene,rtCamera);
   if(rtLabelR)rtLabelR.render(rtScene,rtCamera);
  })();
 }
 if(rtTimer)clearInterval(rtTimer);
 rtTimer=setInterval(rtTick,2000);
 // 给CSS2D标签绑定点击选择
 rtGroup.traverse(o=>{
  if(o.isCSS2DObject&&o.userData.staff){o.element.__rtStaff=o.userData.staff;
   o.element.addEventListener('click',()=>{rtSelected=o.userData.staff;$id('rtStaff').value=rtSelected;rtRefreshRoute();});
  }
 });
}

/* ============================================================ 楼层视图（2D 平面图） */
function zoneFloor(b,zn){ // 楼栋内查找功能区所在楼层（兜底：track 无 f 字段时）
 const keys=Object.keys(DB.zonePos).filter(k=>k.startsWith(b+'-'));
 for(const k of keys){const zp=DB.zonePos[k];
  if(zp.zones.some(z=>z.n===zn))return parseInt(k.slice(b.length+1),10);}
 return null;
}
// 功能区中心 → 楼栋轮廓 bbox 米制（0-100 归一化映射）
function zoneCenter3D(b,z,f){
 const bgeo=P.bldGeo.find(x=>x.id===b);
 const fl=(f!=null)?f:(zoneFloor(b,z)||1);
 const zp=DB.zonePos[b+'-'+fl];
 if(!bgeo||!zp)return [0,0];
 const xs=bgeo.shape.map(p=>p[0]),zs=bgeo.shape.map(p=>p[1]);
 const bbox={minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
 const bw=bbox.maxX-bbox.minX||1,bd2=bbox.maxZ-bbox.minZ||1;
 const zn=zp.zones.find(x=>x.n===z);
 if(!zn||!zn.poly)return [bw/2,-bd2/2];
 const c=zn.poly.reduce((s,q)=>[s[0]+q[0],s[1]+q[1]],[0,0]);
 const ox=c[0]/zn.poly.length,oz=c[1]/zn.poly.length;
 // ⚠ shape 的 y 轴经 rotateX(-PI/2) 映射到世界 -z：纵深坐标取负
 return [bbox.minX+ox/100*bw, -(bbox.minZ+oz/100*bd2)];
}
function floorVisitStats(b,f,date){
 // 返回 {zoneName:{staffs:{staffId:[cnt,staySec]},total:cnt}}
 const out={};
 DB.staff.forEach(s=>{
  const tk=DB.tracks[s.id]&&DB.tracks[s.id][date];if(!tk)return;
  tk.forEach((p,i)=>{
   const fl=(p.f!=null)?p.f:zoneFloor(b,p.z);if(fl!==f)return;
   const nxt=tk[i+1];
   const stay= nxt?Math.max(0,(toMin(nxt.t)-toMin(p.t)))*60 : 600;
   if(!out[p.z])out[p.z]={staffs:{},total:0};
   const rec=out[p.z];
   if(!rec.staffs[s.id])rec.staffs[s.id]=[0,0];
   rec.staffs[s.id][0]++;rec.staffs[s.id][1]+=stay;rec.total++;
  });
 });
 return out;
}
/* ================= 全维度统计引擎（楼栋/楼层/区域/员工） ================= */
function buildDayStats(date){
 // 每条轨迹=一次进入事件 {sid,b,f,z,t,stay}
 const visits=[];
 DB.staff.forEach(s=>{
  const tk=DB.tracks[s.id]&&DB.tracks[s.id][date];if(!tk)return;
  tk.forEach((p,i)=>{
   const nxt=tk[i+1];
   const stay=nxt?Math.max(0,(toMin(nxt.t)-toMin(p.t)))*60:600;
   visits.push({sid:s.id,b:p.b,f:(p.f!=null)?p.f:0,z:p.z,t:p.t,stay});
  });
 });
 const bld={};
 visits.forEach(v=>{const k=v.b;
  (bld[k]=bld[k]||{visits:[],staffSet:{},floorSet:{}});
  bld[k].visits.push(v);bld[k].staffSet[v.sid]=1;bld[k].floorSet[v.f]=1;});
 Object.keys(bld).forEach(k=>{bld[k].staffList=Object.keys(bld[k].staffSet)
  .map(sid=>{const sv=bld[k].visits.filter(x=>x.sid===sid);
   return {sid:sid,name:(DB.staff.find(s=>s.id===sid)||{}).name||sid,
    role:(DB.staff.find(s=>s.id===sid)||{}).role||'',count:sv.length,
    firstT:sv[0].t,lastT:sv[sv.length-1].t,
    stay:sv.reduce((a,x)=>a+x.stay,0)};})
  .sort((a,b)=>b.count-a.count);});
 const zone={};
 visits.forEach(v=>{const k=v.b+'|'+v.f+'|'+v.z;(zone[k]=zone[k]||[]).push(v);});
 return {visits:visits,bld:bld,zone:zone};
}
const DAY='2026-10-27';
const DAYSTATS=buildDayStats(DAY);
function staffDayStats(sid,date){
 // 员工当日：访问区域清单 + 汇总
 const tk=DB.tracks[sid]&&DB.tracks[sid][date];if(!tk)return null;
 const zones=[];const bset={},fset={};
 tk.forEach((p,i)=>{
  const nxt=tk[i+1];
  const stay=nxt?Math.max(0,(toMin(nxt.t)-toMin(p.t)))*60:600;
  bset[p.b]=1;fset[p.b+'-'+p.f]=1;
  zones.push({b:p.b,f:p.f,z:p.z,t:p.t,stay:stay});
 });
 // 按区域聚合
 const agg={};
 zones.forEach(z=>{const k=z.b+'|'+z.f+'|'+z.z;
  (agg[k]=agg[k]||{b:z.b,f:z.f,z:z.z,cnt:0,stay:0,firstT:z.t,lastT:z.t});
  agg[k].cnt++;agg[k].stay+=z.stay;agg[k].lastT=z.t;});
 const byBld={};
 zones.forEach(z=>{(byBld[z.b]=byBld[z.b]||[]).push(z);});
 return {points:tk.length,blds:Object.keys(bset).length,floors:Object.keys(fset).length,
  startT:tk[0].t,endT:tk[tk.length-1].t,zones:zones,agg:Object.values(agg).sort((a,b)=>b.stay-a.stay),byBld:byBld};
}
function staffBldFmt(id){return bname(id);}
function toMin(t){const a=t.split(':');return (+a[0])*60+(+a[1]);}
function initFloorView(){
 const b=$id('flBld');b.innerHTML='';
 P.bldGeo.forEach(x=>{const o=el('option','',x.name);o.value=x.id;b.appendChild(o);});
 b.value=curBld;
 const fillF=()=>{const fl=$id('flFloor');fl.innerHTML='';
  const bd=bldOf(curBld);
  const Fs=realFloors(bd);
  curFloor=Fs.includes(curFloor)?curFloor:(Fs[0]||1);
  Fs.forEach(i=>{const o=el('option','',i+' 层');o.value=i;fl.appendChild(o);});
  fl.value=curFloor;};
 fillF();
 b.onchange=()=>{curBld=b.value;fillF();renderFloor2D();};
 $id('flFloor').onchange=()=>{curFloor=+$id('flFloor').value;renderFloor2D();};
 $id('crumb').textContent='楼层视图 · '+P.name;
 renderFloor2D();
}
