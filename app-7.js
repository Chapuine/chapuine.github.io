function bindCamControls(){
 $id('camTop').onclick=()=>camPreset('top');
 $id('camSide').onclick=()=>camPreset('side');
 $id('camReset').onclick=()=>camPreset('reset');
 $id('camAuto').onclick=()=>{
  autoRotateOn=!autoRotateOn;
  controls.autoRotate=autoRotateOn;
  controls.autoRotateSpeed=0.9;
  $id('camAuto').classList.toggle('active',autoRotateOn);
  $id('camAuto').textContent=autoRotateOn?'停止旋转':'自动旋转';
 };
 $id('compass').onclick=()=>compassRotate(90);
}
function setBldScene(mode){
 if(mode==='bld'){
  initBldScene();buildBld();applyBldToggles();
 }else if(mode==='staff'){
  initBldScene();
  if(!Object.keys(bldMeshes).length)buildBld();
  applyBldToggles();
 }
}
function applyBldToggles(){
 beaconCovObjs.forEach(c=>c.visible=$id('bldBeacon').checked);
 bldLabelObjs.forEach(l=>l.visible=$id('bldLabel').checked);
 if(routeLine)routeLine.visible=$id('bldRoute').checked;
}
$id('bldBeacon').onchange=applyBldToggles;
$id('bldLabel').onchange=applyBldToggles;
$id('bldRoute').onchange=applyBldToggles;
$id('camReset')&&($id('camReset').onclick=()=>camPreset('reset'));
function initBldView(){
 setBldScene('bld');
 bindCamControls();
 buildFloorBar();
 $id('crumb').textContent='建筑物视图 · '+P.name;
 const sb=$id('statusbar');
 sb.innerHTML='<div class="chip"><span class="dot" style="background:#2E7DE8"></span>'+P.name
  +' <b>'+P.bldGeo.length+'</b> 栋楼</div>'
  +'<div class="chip">信标组 <b>'+DB.beacons.length+'</b></div>'
  +'<div class="chip">在岗人员 <b>'+DB.staff.length+'</b></div>'
  +'<div class="chip" style="color:#2E7DE8">拖拽旋转 · 滚轮缩放 · 右键平移</div>';
 bindBldClick();
}
function bindBldClick(){
 const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let down=null;
 renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
 renderer.domElement.addEventListener('pointermove',e=>{
  if(!scene)return;
  mouse.x=(e.clientX/innerWidth)*2-1;mouse.y=-(e.clientY/innerHeight)*2+1;
  ray.setFromCamera(mouse,camera);
  const hits=ray.intersectObjects(scene.children,true);
  let hitBld=null;
  for(const h of hits){let o=h.object;
   while(o&&!o.userData.bld)o=o.parent;
   if(o&&o.userData.bld){hitBld=o.userData.bld;break;}}
  Object.keys(bldMeshes).forEach(k=>{
   const g=bldMeshes[k];
   if(!g.userData.glow)return;
   g.userData.glow.visible=(k===hitBld&&k!==selBld)||(k===selBld&&k!==hitBld);
  });
  renderer.domElement.style.cursor=hitBld?'pointer':'';
 });
 renderer.domElement.addEventListener('pointerup',e=>{
  if(!down)return;
  if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;
  mouse.x=(e.clientX/innerWidth)*2-1;mouse.y=-(e.clientY/innerHeight)*2+1;
  ray.setFromCamera(mouse,camera);
  const hits=ray.intersectObjects(scene.children,true);
  for(const h of hits){let o=h.object;
   while(o&&!o.userData.bld)o=o.parent;
   if(o&&o.userData.bld){setSelBld(o.userData.bld);showBldInfo(o.userData.bld);break;}
  }
 });
}
let selBld=null;
function setSelBld(id){
 selBld=id;
 Object.keys(bldMeshes).forEach(k=>{
  const g=bldMeshes[k];
  if(g.userData.glow)g.userData.glow.visible=(k===id);
 });
 if($id('bldFloorBar')&&typeof buildFloorBar==='function')buildFloorBar();
}
function showBldInfo(id){
 const bgeo=P.bldGeo.find(x=>x.id===id);
 const b=bldOf(id);
 const body=$id('bldInfoBody');
 const st=DAYSTATS.bld[id]||{visits:[],staffSet:{},floorSet:{},staffList:[]};
 body.innerHTML='';
 body.appendChild(el('div','','<div style="font-size:15px;font-weight:700;margin-bottom:2px">'+bgeo.name
  +' <span class="tag" style="background:#E8F1FA;color:#3A6580">'+bgeo.floors+' 层 · 高 '+bgeo.height.toFixed(1)+'m</span></div>'
  +'<div style="font-size:12px;color:#5A6A78;margin-bottom:8px">'+bgeo.note+' · 今日 '+DAY+' 数据</div>'));
 // 今日签到员工
 const hd=el('div','','<div style="font-weight:700;font-size:13px;margin:6px 0 4px">今日签到员工（'+st.staffList.length+' 人 · '+st.visits.length+' 次到访）</div>');
 if(!st.staffList.length){
  hd.appendChild(el('div','hint','今日无员工签到记录'));
 }else{
  const tb=el('table','','<tr><th>员工</th><th>角色</th><th>次数</th><th>时段</th></tr>');
  st.staffList.forEach(x=>{
   tb.appendChild(el('tr','','<td>'+x.name+'</td><td>'+x.role+'</td><td><b>'+x.count+'</b></td>'
    +'<td style="font-size:11px;color:#5A6A78">'+x.firstT+' ~ '+x.lastT+'</td>'));
  });
  hd.appendChild(tb);
 }
 body.appendChild(hd);
 // 楼层完成情况
 const Fs=realFloors(b);
 const cov=Fs.filter(f=>st.floorSet[f]).length;
 const pc=Math.round(cov/Math.max(1,Fs.length)*100);
 body.appendChild(el('div','','<div style="font-weight:700;font-size:13px;margin:8px 0 4px">楼层巡检完成情况</div>'
  +'<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:8px;background:#E4E9EE;border-radius:4px;overflow:hidden">'
  +'<div style="height:100%;width:'+pc+'%;background:linear-gradient(90deg,#2E9E6B,#5BC98E);border-radius:4px"></div></div>'
  +'<b style="font-size:12px">'+cov+'/'+Fs.length+' 层 · '+pc+'%</b></div>'));
 const tb2=el('table','','<tr><th>楼层</th><th>功能区</th><th>到访次数</th><th>状态</th></tr>');
 Fs.slice(0,14).forEach(f=>{
  const zs=zoneNames(b,f);
  const fv=st.visits.filter(v=>v.f===f);
  const covered=fv.length>0;
  tb2.appendChild(el('tr','','<td>'+(f>0?f+'F':f)+'</td><td>'+zs.length+'</td><td>'
   +'<b style="color:'+(covered?'#2E9E6B':'#8A96A2')+'">'+fv.length+'</b></td><td>'
   +(covered?'<span class="tag" style="background:#E8F5EE;color:#2E9E6B">已覆盖</span>'
   :'<span class="tag" style="background:#F4F6F8;color:#8A96A2">未覆盖</span>')+'</td>'));
 });
 body.appendChild(tb2);
 // 最近进出明细
 const recent=st.visits.slice(-8).reverse();
 body.appendChild(el('div','','<div style="font-weight:700;font-size:13px;margin:8px 0 4px">最近进出记录</div>'
  +(recent.length?'':el('div','hint','暂无记录'))));
 if(recent.length){
  const tb3=el('table','','<tr><th>时间</th><th>员工</th><th>区域</th><th>停留</th></tr>');
  recent.forEach(v=>{
   const s=DB.staff.find(x=>x.id===v.sid);
   tb3.appendChild(el('tr','','<td>'+v.t+'</td><td>'+(s?s.name:v.sid)+'</td><td>'+(v.f>0?v.f+'F ':'')+v.z+'</td>'
    +'<td>'+fmtDur(v.stay)+'</td>'));
  });
  body.appendChild(tb3);
 }
 body.appendChild(el('div','hint','数据来源：'+P.name+' 当日 '+DAY+' 扫码轨迹 643 条（'+DAYSTATS.visits.length+' 个进入事件）。'));
 $id('bldInfo').style.display='block';
}
$id('bldInfoClose').onclick=()=>$id('bldInfo').style.display='none';
$id('flStatsClose').onclick=()=>$id('flStats').style.display='none';
$id('staffStatsClose').onclick=()=>$id('staffStats').style.display='none';
$id('tlPlay').onclick=()=>togglePlay();
/* ===== 初始 ===== */
show('bld');
