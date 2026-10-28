function adminApi(m){
 m.appendChild(el('div','admincard','<h4>后端接口契约（供服务器实现）</h4>'

  +'<div class="sub">前端以 JSON 数据驱动；生产环境由后端实现以下 REST API，前端改为 fetch 调用。</div>'));
 const pre=el('pre','',`POST /api/project        {name,code,type,workType,address,lat,lng}  创建项目
GET  /api/project/:id/building  楼栋列表（含楼层/功能区树）
POST /api/project/:id/ai-search {address}  → AI检索轮廓 {geoJson}
PUT  /api/building/:id/outline  {shape:[[x,y]...],floors,floorHeight}  楼栋建模
PUT  /api/building/:id/floor/:f/zone-position  {zones:[{name,poly,beacon}]}  功能区位置
POST /api/beacon-group          {bld,floor,name,dist,stayStaff,stayMgr,list:[{code,mac}],zone}
POST /api/badge/scan            {badgeId,beaconCode,rssi,ts}  工牌上报信号
WS   /api/realtime/ws           实时推送全员位置 {badgeId,x,y,z,bld,floor,zone}
GET  /api/realtime/positions    全员实时位置快照
POST /api/fence                 {bld,floor,zone,name,level,auth,alertOnEnter}  创建电子围栏
GET  /api/fence/alerts          ?date= 围栏进入/离开记录
GET  /api/track/:staff/:date    员工当日轨迹（楼栋/功能区/时间/停留）
GET  /api/floor/stats/:bld/:f/:date  楼层功能区到访统计
POST /api/badge/bind            {projectId,staffId,badgeId}  工牌绑定员工`);
 pre.style.cssText='background:#F2F5F8;border-radius:8px;padding:14px;font-size:12px;line-height:1.7;overflow-x:auto;white-space:pre;color:#33414E';
 m.appendChild(pre);
 m.appendChild(el('div','admincard','<h4>定位判定逻辑（服务端）</h4><div class="sub">工牌上报 RSSI → 匹配最近信标组 → 判定功能区与停留时长 → 写入轨迹。</div>'
  +'<div class="hint">1. 工牌每 5s 上报周围信标 RSSI；2. 取信号最强的信标组（或三信标最小二乘）；'
  +'3. 连续 N 次命中同一功能区且超过最小停留时长 → 记为一次到访；4. 轨迹按时间序列入库供三视图查询。</div>'));
}
/* ============================================================ 实时监控（esmap风格3D室内图） */
let rtScene,rtCamera,rtRenderer,rtLabelR,rtControls,rtGroup,rtAnimOn=false;
let rtZones={},rtStaffMesh={},rtBeaconMesh=[],rtFenceMesh=[],rtRoute=null,rtDest=null;
let rtSim={},rtTimer=null,rtSelected=null;
let rtClock=0,rtLastAlertKey='';
function rtInit(){
 if(rtScene)return;
 rtScene=new THREE.Scene();
 rtScene.background=new THREE.Color(0xEDF0F3);
 rtCamera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,0.3,900);
 rtCamera.position.set(60,55,78);rtCamera.lookAt(24,0,14);
 rtRenderer=new THREE.WebGLRenderer({antialias:true});
 rtRenderer.setSize(innerWidth,innerHeight);
 rtRenderer.setPixelRatio(Math.min(devicePixelRatio,2));
 rtRenderer.shadowMap.enabled=true;
 rtRenderer.outputEncoding=THREE.sRGBEncoding;
 $id('rtCanvas').appendChild(rtRenderer.domElement);
 rtLabelR=new THREE.CSS2DRenderer();
 rtLabelR.setSize(innerWidth,innerHeight);
 rtLabelR.domElement.style.position='absolute';rtLabelR.domElement.style.top='0';
 $id('rtLabels').appendChild(rtLabelR.domElement);
 rtControls=new THREE.OrbitControls(rtCamera,rtRenderer.domElement);
 rtControls.enableDamping=true;rtControls.dampingFactor=0.08;
 rtControls.target.set(24,0,14);
 rtControls.minPolarAngle=0.62;rtControls.maxPolarAngle=0.95;
 rtControls.minDistance=20;rtControls.maxDistance=180;
 rtControls.update();
 rtScene.add(new THREE.HemisphereLight(0xFFFFFF,0xC7CCD2,1.0));
 const sun=new THREE.DirectionalLight(0xFFFFFF,0.95);
 sun.position.set(50,90,40);sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024);
 sun.shadow.camera.left=-90;sun.shadow.camera.right=90;
 sun.shadow.camera.top=90;sun.shadow.camera.bottom=-90;sun.shadow.camera.far=220;
 rtScene.add(sun);
 const fill=new THREE.DirectionalLight(0xD6E4F2,0.35);fill.position.set(-60,40,-50);rtScene.add(fill);
 const gnd=new THREE.Mesh(new THREE.PlaneGeometry(300,300),
  new THREE.MeshStandardMaterial({color:0xD9DDE2,roughness:1}));
 gnd.rotation.x=-Math.PI/2;gnd.position.y=-0.05;rtScene.add(gnd);
 addEventListener('resize',()=>{if(!rtCamera)return;rtCamera.aspect=innerWidth/innerHeight;
  rtCamera.updateProjectionMatrix();rtRenderer.setSize(innerWidth,innerHeight);
  rtLabelR.setSize(innerWidth,innerHeight);});
}
function rtPolyCenter(poly){return poly.reduce((s,p)=>[s[0]+p[0],s[1]+p[1]],[0,0]).map(v=>v/poly.length);}
function rtPointInPoly(x,z,poly){
 let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const xi=poly[i][0],zi=poly[i][1],xj=poly[j][0],zj=poly[j][1];
  const hit=((zi>z)!=(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi)+xi);
  if(hit)inside=!inside;
 }
 return inside;
}
function rtZoneOf(b,f,x,z){
 // 用已映射到楼栋轮廓的 rtZones 判断
 for(const k in rtZones){const zn=rtZones[k];
  if(zn.poly&&rtPointInPoly(x,z,zn.poly))return k;}
 return '走廊';
}
let rtBBox=null;
function rtMap(p){ // 0-100 归一化 → 楼栋轮廓米制
 if(!rtBBox)return p;
 return [rtBBox.min[0]+p[0]/100*(rtBBox.max[0]-rtBBox.min[0]),
         rtBBox.min[1]+p[1]/100*(rtBBox.max[1]-rtBBox.min[1])];
}
function rtBuildFloor(b,f){
 rtGroup=new THREE.Group();rtScene.add(rtGroup);rtZones={};
 const bgeo=P.bldGeo.find(x=>x.id===b);
 // 楼栋轮廓 bbox（用于归一化坐标映射）
 const xs=bgeo.shape.map(p=>p[0]),zs=bgeo.shape.map(p=>p[1]);
 rtBBox={min:[Math.min(...xs),Math.min(...zs)],max:[Math.max(...xs),Math.max(...zs)]};
 // 楼栋轮廓底
 const sh=new THREE.Shape();
 bgeo.shape.forEach((p,i)=>{i?sh.lineTo(p[0],p[1]):sh.moveTo(p[0],p[1]);});
 sh.lineTo(bgeo.shape[0][0],bgeo.shape[0][1]);
 const fg=new THREE.ExtrudeGeometry(sh,{depth:0.25,bevelEnabled:false});
 fg.rotateX(-Math.PI/2);
 const floor=new THREE.Mesh(fg,new THREE.MeshStandardMaterial({color:0xF4F6F8,roughness:0.9,side:THREE.DoubleSide}));
 floor.position.y=-0.22;rtGroup.add(floor);
 // 外轮廓线
 const ring=new THREE.BufferGeometry().setFromPoints(bgeo.shape.map(p=>new THREE.Vector3(p[0],0,p[1])));
 rtGroup.add(new THREE.Line(ring,new THREE.LineBasicMaterial({color:0x5A7488,linewidth:1})));
 // 功能区盒子
 const zp=DB.zonePos[b+'-'+f];
 if(zp)zp.zones.forEach(zn=>{
  if(!zn.poly||zn.poly.length<3)return;
  const mPoly=zn.poly.map(rtMap);
  const sh2=new THREE.Shape();
  mPoly.forEach((p,i)=>{i?sh2.lineTo(p[0],p[1]):sh2.moveTo(p[0],p[1]);});
  sh2.lineTo(mPoly[0][0],mPoly[0][1]);
  const g2=new THREE.ExtrudeGeometry(sh2,{depth:0.5,bevelEnabled:false});
  g2.rotateX(-Math.PI/2);
  const wall=new THREE.Mesh(g2,new THREE.MeshStandardMaterial({color:0xDCE4EA,roughness:0.7,transparent:true,opacity:0.45,side:THREE.DoubleSide}));
  wall.position.y=0.02;rtGroup.add(wall);
  const g3=new THREE.ExtrudeGeometry(sh2,{depth:0.06,bevelEnabled:false});
  g3.rotateX(-Math.PI/2);
  const c=colorForZone(zn.n);
  const top=new THREE.Mesh(g3,new THREE.MeshStandardMaterial({color:new THREE.Color(c),roughness:0.6,transparent:true,opacity:0.55,side:THREE.DoubleSide}));
  top.position.y=0.55;rtGroup.add(top);
  // 名称标签
  const pc=rtPolyCenter(mPoly);
  const lab=document.createElement('div');
  lab.textContent=zn.n;
  lab.style.cssText='background:rgba(255,255,255,.88);border:1px solid #B9C2CB;border-radius:5px;padding:1px 6px;font-size:10.5px;color:#41566B;white-space:nowrap';
  const l2=new THREE.CSS2DObject(lab);
  l2.position.set(pc[0],0.78,pc[1]);
  rtGroup.add(l2);
  rtZones[zn.n]={poly:mPoly,center:pc,obj:top,label:l2};
 });
 // 信标点
 rtBeaconMesh.forEach(m=>rtGroup.remove(m));rtBeaconMesh=[];
 DB.beacons.filter(bg=>bg.bld===b&&bg.floor===f).forEach(bg=>{
  const zn=rtZones[bg.zone];if(!zn)return;
  const p=new THREE.Mesh(new THREE.SphereGeometry(0.24,10,10),
   new THREE.MeshStandardMaterial({color:0xE8743B,emissive:0xE8743B,emissiveIntensity:0.4}));
  p.position.set(zn.center[0]+0.6,0.9,zn.center[1]-0.5);
  rtGroup.add(p);rtBeaconMesh.push(p);
 });
 // 围栏区域
 rtFenceMesh.forEach(m=>rtGroup.remove(m));rtFenceMesh=[];
 DB.fences.filter(fn=>fn.bld===b&&fn.floor===f).forEach(fn=>{
  const zn=rtZones[fn.zone];if(!zn)return;
  const sh3=new THREE.Shape();
  zn.poly.forEach((p,i)=>{i?sh3.lineTo(p[0],p[1]):sh3.moveTo(p[0],p[1]);});
  sh3.lineTo(zn.poly[0][0],zn.poly[0][1]);
  const g4=new THREE.ExtrudeGeometry(sh3,{depth:0.12,bevelEnabled:false});
  g4.rotateX(-Math.PI/2);
  const fm=new THREE.Mesh(g4,new THREE.MeshBasicMaterial({color:0xE0452E,transparent:true,opacity:0.3,depthWrite:false,side:THREE.DoubleSide}));
  fm.position.y=0.72;rtGroup.add(fm);rtFenceMesh.push(fm);
  const ring2=new THREE.BufferGeometry().setFromPoints(zn.poly.map(p=>new THREE.Vector3(p[0],0.86,p[1])));
  const fl=new THREE.Line(ring2,new THREE.LineBasicMaterial({color:0xE0452E,transparent:true,opacity:0.9}));
  rtGroup.add(fl);rtFenceMesh.push(fl);
  // 围栏标签
  const lab=document.createElement('div');
  lab.textContent='围栏 '+fn.name;
  lab.style.cssText='background:rgba(224,69,46,.92);border-radius:5px;padding:1px 7px;font-size:10.5px;color:#fff;white-space:nowrap;font-weight:600';
  const l3=new THREE.CSS2DObject(lab);
  l3.position.set(zn.center[0],1.35,zn.center[1]);
  rtGroup.add(l3);rtFenceMesh.push(l3);
 });
 rtBuildStaff(f);
}
function rtBuildStaff(f){
 Object.values(rtStaffMesh).forEach(m=>rtGroup.remove(m));rtStaffMesh={};
 DB.staff.forEach(s=>{
  const r=DB.realtime[s.id];
  if(!r||r.b!==curBld||r.f!==f)return;
  const mp=rtMap([r.x,r.y]);
  const x=mp[0], z=mp[1];
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(0.45,16,16),
   new THREE.MeshStandardMaterial({color:0x2E9E6B,emissive:0x2E9E6B,emissiveIntensity:0.35}));
  mesh.position.set(x,0.75,z);
  mesh.userData.staff=s.id;
  rtGroup.add(mesh);
  const lab=document.createElement('div');
  lab.textContent=s.name+' · '+r.z;
  lab.style.cssText='background:rgba(46,158,107,.92);border-radius:5px;padding:1px 7px;font-size:11px;color:#fff;white-space:nowrap;cursor:pointer';
  lab.style.boxShadow='0 1px 4px rgba(0,0,0,.25)';
  const l2=new THREE.CSS2DObject(lab);
  l2.position.set(x,1.6,z);
  l2.userData.staff=s.id;
  rtGroup.add(l2);
  rtStaffMesh[s.id]={mesh:mesh,label:l2,cur:{x,z}};
 });
}
function rtTick(){
 rtClock+=2;
 const b=curBld,f=curFloor;
 // 模拟员工移动（沿当前楼栋楼层功能区随机游走）
 DB.staff.forEach(s=>{
  const st=rtSim[s.id];if(!st)return;
  // 移动目标
  if(!st.target||Math.hypot(st.target.x-st.x,st.target.z-st.z)<0.6){
   const zones=Object.values(rtZones);
   if(zones.length){
    const z=zones[Math.floor(Math.random()*zones.length)];
    st.target={x:z.center[0]+(Math.random()*3-1.5),z:z.center[1]+(Math.random()*3-1.5)};
   }
  }
  const dx=st.target.x-st.x,dz=st.target.z-st.z;
  const d=Math.hypot(dx,dz);
  if(d>0.4){const sp=0.5+(Math.random()*0.3);st.x+=dx/d*sp;st.z+=dz/d*sp;}
  // RSSI 定位抖动
  st.x+= (Math.random()*0.5-0.25);st.z+=(Math.random()*0.5-0.25);
  const m=rtStaffMesh[s.id];
  if(m){m.mesh.position.set(st.x,0.75,st.z);
   m.label.position.set(st.x,1.6,st.z);
   m.cur={x:st.x,z:st.z};
   const zn=rtZoneOf(b,f,st.x,st.z);
   m.label.element.firstChild&&(m.label.element.textContent=s.name+' · '+zn);
   m.label.element.style.cssText=m.label.element.style.cssText;
  }
 });
 rtCheckFence();
 if(rtRoute)rtRefreshRoute();
 rtStatus();
}
function rtCheckFence(){
 const b=curBld,f=curFloor;
 DB.staff.forEach(s=>{
  const st=rtSim[s.id];if(!st)return;
  DB.fences.filter(fn=>fn.bld===b&&fn.floor===f).forEach(fn=>{
   const zn=rtZones[fn.zone];
   if(!zn||!zn.poly)return;
   const inside=rtPointInPoly(st.x,st.z,zn.poly);
   const key=s.id+'-'+fn.id;
   const authed=fn.auth.includes(s.id);
   if(inside&&!st.__inFence[key]){
    st.__inFence=st.__inFence||{};
    st.__inFence[key]=true;
    const rec={t:rtTime(),staff:s.id,fence:fn.id,action:'进入',authed:authed,level:fn.level};
    DB.fenceAlerts.unshift(rec);
    if(DB.fenceAlerts.length>40)DB.fenceAlerts.length=40;
    rtRenderAlerts();
   }else if(!inside&&st.__inFence&&st.__inFence[key]){
    delete st.__inFence[key];
    const rec={t:rtTime(),staff:s.id,fence:fn.id,action:'离开',authed:authed,level:fn.level};
    DB.fenceAlerts.unshift(rec);
    if(DB.fenceAlerts.length>40)DB.fenceAlerts.length=40;
    rtRenderAlerts();
   }
  });
 });
}
function rtTime(){
 const d=new Date();
 return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)+':'+('0'+d.getSeconds()).slice(-2);
}
