
function applyOutlineDemo(){toast('已应用 AI 检索轮廓（示例）');}
let scene,camera,renderer,labelRenderer,controls,locGroup;
let bldMeshes={},routeLine,bldLabelObjs=[],beaconCovObjs=[],staffMarkers={};
function initBldScene(){
 if(scene)return;
 scene=new THREE.Scene();
 scene.background=new THREE.Color(0xE7EBEE);
 scene.fog=new THREE.Fog(0xE7EBEE,260,520);
 camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,0.5,1500);
 camera.position.set(78,62,104);
 renderer=new THREE.WebGLRenderer({antialias:true});
 renderer.setSize(innerWidth,innerHeight);
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.outputEncoding=THREE.sRGBEncoding;
 $id('view3d').appendChild(renderer.domElement);
 labelRenderer=new THREE.CSS2DRenderer();
 labelRenderer.setSize(innerWidth,innerHeight);
 labelRenderer.domElement.style.position='absolute';labelRenderer.domElement.style.top='0';
 $id('labels').appendChild(labelRenderer.domElement);
 controls=new THREE.OrbitControls(camera,renderer.domElement);
 controls.enableDamping=true;controls.dampingFactor=0.08;
 controls.target.set(34,10,0);controls.minDistance=15;controls.maxDistance=340;
 controls.maxPolarAngle=Math.PI*0.49;controls.update();
 scene.add(new THREE.HemisphereLight(0xFFFFFF,0xB9C4CE,1.15));
 const sun=new THREE.DirectionalLight(0xFFFFFF,1.05);
 sun.position.set(80,130,60);sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024);
 sun.shadow.camera.left=-120;sun.shadow.camera.right=120;
 sun.shadow.camera.top=120;sun.shadow.camera.bottom=-120;sun.shadow.camera.far=300;
 scene.add(sun);
 const fill2=new THREE.DirectionalLight(0xCFE0F0,0.35);fill2.position.set(-80,50,-60);scene.add(fill2);
 const amb=new THREE.AmbientLight(0xEAF2F8,0.35);scene.add(amb);
 const site=new THREE.Mesh(new THREE.PlaneGeometry(190,150),
  new THREE.MeshStandardMaterial({color:0xCBD2D8,roughness:0.9}));
 site.rotation.x=-Math.PI/2;site.position.y=-0.02;site.receiveShadow=true;scene.add(site);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(700,700),
  new THREE.MeshStandardMaterial({color:0xE2E5E9,roughness:1}));
 ground.rotation.x=-Math.PI/2;ground.position.y=-0.06;scene.add(ground);
 const grid=new THREE.GridHelper(240,24,0xB4BCC4,0xCDD3D9);
 grid.position.y=0.01;grid.material.transparent=true;grid.material.opacity=0.4;scene.add(grid);
 // 地块边界亮线（园区轮廓）
 if(P.outline&&P.outline.length){
  const lp=P.outline.map(p=>new THREE.Vector3(p[0],0.05,p[1]));
  lp.push(lp[0].clone());
  const lgeo=new THREE.BufferGeometry().setFromPoints(lp);
  const ol=new THREE.Line(lgeo,new THREE.LineBasicMaterial({color:0x4E86C8,transparent:true,opacity:0.5}));
  scene.add(ol);
 }
 addEventListener('resize',()=>{if(!camera)return;camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
  labelRenderer.setSize(innerWidth,innerHeight);});
 animate();
}
function shapeGeometry(shape,floors,fh){
 const h=floors*fh;
 const sh=new THREE.Shape();
 shape.forEach((p,i)=>{i?sh.lineTo(p[0],p[1]):sh.moveTo(p[0],p[1]);});
 sh.lineTo(shape[0][0],shape[0][1]);
 const geo=new THREE.ExtrudeGeometry(sh,{depth:h,bevelEnabled:false});
 geo.rotateX(-Math.PI/2);
 geo.translate(0,0,0);
 // 把拉伸深度转为Y高度：rotateX后 depth 沿Y
 return geo;
}
function buildBld(){
 Object.values(bldMeshes).forEach(g=>scene.remove(g));bldMeshes={};
 P.bldGeo.forEach(b=>{
  const g=new THREE.Group();
  const H=b.height||b.floors*4.2;
  const sh=new THREE.Shape();
  b.shape.forEach((p,i)=>{i?sh.lineTo(p[0],p[1]):sh.moveTo(p[0],p[1]);});
  sh.lineTo(b.shape[0][0],b.shape[0][1]);
  const geo=new THREE.ExtrudeGeometry(sh,{depth:H,bevelEnabled:false});
  geo.rotateX(-Math.PI/2);geo.computeBoundingBox();
  const shell=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:new THREE.Color(b.color),
   transparent:true,opacity:0.85,roughness:0.5,metalness:0.08,side:THREE.DoubleSide}));
  shell.castShadow=true;shell.receiveShadow=true;
  g.add(shell);
  // 建筑边缘线框（强化结构轮廓）
  const edges=new THREE.EdgesGeometry(geo);
  const edgeLine=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:0x3A5A72,transparent:true,opacity:0.55}));
  edgeLine.position.y=0.02;g.add(edgeLine);
  // 楼体发光基座（选中/悬停时高亮）
  const glow=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x2E7DE8,transparent:true,opacity:0.16,emissive:0x2E7DE8,emissiveIntensity:0.55,depthWrite:false,side:THREE.DoubleSide}));
  glow.visible=false;glow.position.y=0.03;g.add(glow);g.userData.glow=glow;
  // 楼层环线（按真实楼层数量）
  const Fs=realFloors(b);
  for(let f=1;f<Fs.length;f++){
   const ring=new THREE.BufferGeometry().setFromPoints(
    b.shape.map(p=>new THREE.Vector3(p[0],f*4.2,p[1])));
   g.add(new THREE.Line(ring,new THREE.LineBasicMaterial({color:0xFFFFFF,transparent:true,opacity:0.5})));
  }
  const topRing=new THREE.BufferGeometry().setFromPoints(
   b.shape.map(p=>new THREE.Vector3(p[0],H-0.1,p[1])));
  g.add(new THREE.Line(topRing,new THREE.LineBasicMaterial({color:0x5E7488,transparent:true,opacity:0.7})));
  // 楼号标签
  const bb=new THREE.Box3().setFromObject(shell);
  const cx=(bb.min.x+bb.max.x)/2,cz=(bb.min.z+bb.max.z)/2;
  const lab=document.createElement('div');
  lab.textContent=b.name.replace('项目','');
  lab.style.cssText='background:linear-gradient(135deg,#FFFFFF,#E8F1FA);border:1px solid #B9C2CB;border-radius:8px;padding:3px 11px;font-size:12px;font-weight:700;color:#3A6580;box-shadow:0 2px 8px rgba(58,101,128,.22);white-space:nowrap;letter-spacing:.5px';
  const l2=new THREE.CSS2DObject(lab);
  l2.position.set(cx,H+4,cz);g.add(l2);bldLabelObjs.push(l2);
  // 信标覆盖圈（地面圆，φ=接收距离）
  const bgList=DB.beacons.filter(x=>x.bld===b.id);
  bgList.forEach(bg=>{
   const zp=DB.zonePos[b.id+'-'+bg.floor];
   if(zp){const z=zp.zones.find(x=>x.n===bg.zone);
    if(z&&z.poly){const c=z.poly.reduce((s,p)=>[s[0]+p[0],s[1]+p[1]],[0,0]);
     const cx2=c[0]/z.poly.length,cy2=c[1]/z.poly.length;
     const cir=new THREE.Mesh(new THREE.CircleGeometry(3.2,32),
      new THREE.MeshBasicMaterial({color:0xE8743B,transparent:true,opacity:0.14,depthWrite:false}));
     cir.rotation.x=-Math.PI/2;cir.position.set(cx2,0.06,cy2);
     g.add(cir);beaconCovObjs.push(cir);
     const pin=new THREE.Mesh(new THREE.SphereGeometry(0.28,10,10),
      new THREE.MeshStandardMaterial({color:0xE8743B,emissive:0xE8743B,emissiveIntensity:0.5}));
     pin.position.set(cx2,0.9,cy2);g.add(pin);
    }
   }
  });
  const pos=bldLayoutPos(b.id);
  g.position.set(pos.x,0,pos.z);
  g.userData.bld=b.id;
  scene.add(g);bldMeshes[b.id]=g;
 });
 // 路线
 if(routeLine)scene.remove(routeLine);
 const pts=[];DB.routes.forEach(r=>r.pts.forEach(p=>pts.push(new THREE.Vector3(p[0],0.2,p[2]))));
 const rg=new THREE.BufferGeometry().setFromPoints(pts);
 routeLine=new THREE.Line(rg,new THREE.LineDashedMaterial({color:0x2E9E6B,dashSize:1.2,gapSize:0.7,transparent:true,opacity:0.8}));
 routeLine.computeLineDistances();scene.add(routeLine);
}
function bldLayoutPos(id){
 // 楼栋园区布局来自 DB.bldLayout（B1/B2 并排，可配置）
 const L=DB.bldLayout||{};
 return L[id]||{x:0,z:0};
}
function animate(){
 requestAnimationFrame(animate);
 if(!renderer)return;
 controls.update();
 renderer.render(scene,camera);
 labelRenderer.render(scene,camera);
}
/* ================= esmap 风格视角控制 / 楼层高亮 ================= */
let bldFloorBlocks={},curFloor3D=null,autoRotateOn=false;
function flyCam(target,pos){
 // 平滑飞行（简单两段补间）
 const st={t:0};
 const sT=target.clone(),sP=camera.position.clone();
 const anim=()=>{
  st.t=Math.min(1,st.t+0.07);
  const e=1-Math.pow(1-st.t,3);
  controls.target.lerpVectors(sT,target,e);
  camera.position.lerpVectors(sP,pos,e);
  if(st.t<1)requestAnimationFrame(anim);else{controls.update();}
 };
 anim();
}
function camPreset(mode){
 if(!scene)return;
 const c=zoneCenter3D('B1','公区',1);
 const baseT=new THREE.Vector3(bldLayoutPos('B1').x+c[0],10,bldLayoutPos('B1').z+c[1]);
 if(mode==='top')flyCam(baseT.clone(),new THREE.Vector3(baseT.x,150,baseT.z+0.01));
 else if(mode==='side')flyCam(baseT.clone(),new THREE.Vector3(baseT.x+120,28,baseT.z));
 else if(mode==='reset')flyCam(baseT.clone(),new THREE.Vector3(baseT.x+78,62,baseT.z+104));
}
function compassRotate(deg){
 if(!controls)return;
 const t=controls.target.clone();
 const v=camera.position.clone().sub(t);
 const r=deg*Math.PI/180;
 camera.position.set(t.x+v.x*Math.cos(r)+v.z*Math.sin(r),t.y+v.y,t.z-t.x*Math.sin(r)+v.z*Math.cos(r));
 controls.update();
 const d=$id('compassDisc');if(d)d.style.transform='rotate('+deg+'deg)';
}
function buildFloorBar(){
 const bar=$id('bldFloorBar');if(!bar)return;
 bar.innerHTML='';
 const bid=selBld||'B1';
 const bd=bldOf(bid);if(!bd)return;
 const Fs=realFloors(bd);
 Fs.forEach(f=>{
  const btn=el('button','',(f>0?f+'F':f+'层'));
  if(f===curFloor3D)btn.classList.add('active');
  btn.onclick=()=>setBldFloor(bid,f);
  bar.appendChild(btn);
 });
 // 当前选中楼层滚入视野
 const act=bar.querySelector('button.active');
 if(act)act.scrollIntoView({block:'center'});
}
function clearFloorBlocks(){
 Object.values(bldFloorBlocks).forEach(g=>scene.remove(g));
 bldFloorBlocks={};
}
function setBldFloor(bid,f){
 curFloor3D=f;
 clearFloorBlocks();
 const bgeo=P.bldGeo.find(x=>x.id===bid);
 const zp=DB.zonePos[bid+'-'+f];
 const pos=bldLayoutPos(bid);
 if(zp&&bgeo){
  const xs=bgeo.shape.map(p=>p[0]),zs=bgeo.shape.map(p=>p[1]);
  const bbox={minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
  const bw=bbox.maxX-bbox.minX||1,bd2=bbox.maxZ-bbox.minZ||1;
  // ⚠ shape 的 y 轴经 rotateX(-PI/2) 映射到世界 -z 方向：纵深坐标必须取负
  const group=new THREE.Group();
  zp.zones.forEach(z=>{
   if(!z.poly||z.poly.length<3)return;
   const mPoly=z.poly.map(p=>[bbox.minX+p[0]/100*bw,-(bbox.minZ+p[1]/100*bd2)]);
   const sh=new THREE.Shape();
   mPoly.forEach((p,i)=>{i?sh.lineTo(p[0],p[1]):sh.moveTo(p[0],p[1]);});
   sh.lineTo(mPoly[0][0],mPoly[0][1]);
   const geo=new THREE.ExtrudeGeometry(sh,{depth:3.0,bevelEnabled:false});
   geo.rotateX(-Math.PI/2);geo.translate(0,f*4.2+0.5,0);
   const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({
    color:new THREE.Color(colorForZone(z.n)),transparent:true,opacity:0.88,
    roughness:0.45,metalness:0.05,emissive:new THREE.Color(colorForZone(z.n)),emissiveIntensity:0.1,
    side:THREE.DoubleSide}));
   mesh.userData.zone=z.n;
   group.add(mesh);
  });
  // 楼层基板
  const sh2=new THREE.Shape();
  bgeo.shape.forEach((p,i)=>{i?sh2.lineTo(p[0],p[1]):sh2.moveTo(p[0],p[1]);});
  sh2.lineTo(bgeo.shape[0][0],bgeo.shape[0][1]);
  const g2=new THREE.ExtrudeGeometry(sh2,{depth:0.4,bevelEnabled:false});
  g2.rotateX(-Math.PI/2);g2.translate(0,f*4.2-0.05,0);
  const plate=new THREE.Mesh(g2,new THREE.MeshStandardMaterial({color:0xFFFFFF,transparent:true,opacity:0.30,roughness:0.6,side:THREE.DoubleSide}));
  group.add(plate);
  group.position.set(pos.x,0,pos.z);
  scene.add(group);bldFloorBlocks[bid+'-'+f]=group;
  // 视角飞行到该层（cx/cz 需匹配几何真实方向：shape y→世界 -z）
  const czN=-(bbox.minZ+bd2/2);
  flyCam(new THREE.Vector3(pos.x+bbox.minX+bw/2,f*4.2+2,pos.z+czN),
         new THREE.Vector3(pos.x+bbox.minX+bw/2-34,f*4.2+30,pos.z+czN+46));
 }else{
  // 无功能区数据：仅飞视角
  const bgeo2=P.bldGeo.find(x=>x.id===bid);
  if(bgeo2){
   const xs=bgeo2.shape.map(p=>p[0]),zs=bgeo2.shape.map(p=>p[1]);
   const cx=(Math.min(...xs)+Math.max(...xs))/2,czN=-((Math.min(...zs)+Math.max(...zs))/2);
   flyCam(new THREE.Vector3(pos.x+cx,f*4.2+2,pos.z+czN),
          new THREE.Vector3(pos.x+cx-30,f*4.2+26,pos.z+czN+40));
  }
 }
 buildFloorBar();
}
