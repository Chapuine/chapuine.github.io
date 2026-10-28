function adminZone(m){
 m.appendChild(el('div','admincard','<h4>功能区位置配置</h4>'
  +'<div class="sub">在每个楼栋每个楼层，把功能区画在平面图上——系统才知道功能区在哪、信标覆盖哪个区域。左键添加顶点 / 拖动顶点，双击闭合多边形。</div>'));
 const ctl=el('div','admin-toolbar');
 ctl.innerHTML='<select id="azBld"></select><select id="azFloor"></select>'
  +'<button class="btn sm primary" id="azAdd">+ 新增区域</button>'
  +'<button class="btn sm" id="azSave">保存配置</button>'
  +'<button class="btn sm" id="azDel">删除选中</button>'
  +'<span class="hint" style="flex:1">绘制流程：选功能区 → 点画布添加顶点 → 双击闭合</span>';
 m.appendChild(ctl);
 const sl1=$id('azBld'),sl2=$id('azFloor');
 P.bldGeo.forEach(b=>{const o=el('option','',b.id+' '+b.name);o.value=b.id;sl1.appendChild(o);});
 sl1.value='B1';
 const refill=()=>{sl2.innerHTML='';const b=bldOf(sl1.value);
  for(let f=1;f<=b.floors;f++){const o=el('option','',f+'层');o.value=f;sl2.appendChild(o);}
  sl2.value=Math.min(sl2.value||1,b.floors);};
 refill();sl1.onchange=refill;
 const wrap=el('div','canvaswrap');m.appendChild(wrap);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 460 320');svg.style.background='#FBFCFF';wrap.appendChild(svg);
 // 状态
 const st={selZone:null,drawing:[],pts:[],dragIdx:-1};
 const key=sl1.value+'-'+sl2.value;
 function curZones(){const k=sl1.value+'-'+sl2.value;DB.zonePos[k]=DB.zonePos[k]||{zones:[]};return DB.zonePos[k].zones;}
 function zoneById(n){return curZones().find(z=>z.n===n);}
 function zoneBld(){return bldOf(sl1.value);}
 // 楼栋轮廓底
 const bgeo=P.bldGeo.find(x=>x.id===sl1.value);
 function norm(v){return [v[0]/60*460+40,v[1]/50*320+30];}
 function denorm(px,py){return [(px-40)/460*60,(py-30)/320*50];}
 function render(){
  svg.innerHTML='';
  const defs=elNS('defs');svg.appendChild(defs);
  // 楼栋底
  const bpts=bgeo.shape.map(norm);
  let pstr='';
  // scale to canvas: shape是米级坐标(0-60,0-50)，拉伸到画布
  const scale=6.8;
  bgeo.shape.forEach((p,i)=>{pstr+=(i?' ':'')+((p[0]*scale)+40)+','+((50-p[1]*scale)+30);});
  const poly=elNS('polygon');poly.setAttribute('points',pstr);

  poly.setAttribute('fill','#EAF1FA');poly.setAttribute('stroke','#2E7DE8');poly.setAttribute('stroke-width','1.5');
  svg.appendChild(poly);
  // 功能区
  curZones().forEach(z=>{
   if(z.poly&&z.poly.length>1){
    const pts=z.poly.map(p=>[(p[0]*scale)+40,(50-p[1]*scale)+30]);
    const pp=elNS('polygon');
    pp.setAttribute('points',pts.map(p=>p.join(',')).join(' '));
    pp.setAttribute('fill',colorForZone(z.n));pp.setAttribute('stroke','#8A96A2');
    pp.setAttribute('stroke-width','1.2');pp.setAttribute('data-zone',z.n);
    pp.setAttribute('style','cursor:pointer');
    pp.addEventListener('click',e=>{e.stopPropagation();st.selZone=z.n;render();});
    svg.appendChild(pp);
    const tx=elNS('text');tx.setAttribute('x',pts.reduce((s,p)=>s+p[0],0)/pts.length);
    tx.setAttribute('y',pts.reduce((s,p)=>s+p[1],0)/pts.length);
    tx.setAttribute('text-anchor','middle');tx.setAttribute('font-size','11');
    tx.setAttribute('fill','#33414E');tx.textContent=z.n+(z.beacon&&z.beacon.length?' ·'+z.beacon.map(b=>b.replace('BG','B')).join('+'):'');
    svg.appendChild(tx);
   }
  });
  // 绘制中的线
  if(st.drawing.length>1){
   const pts=st.drawing.map(p=>[(p[0]*scale)+40,(50-p[1]*scale)+30]);
   const lp=elNS('polyline');lp.setAttribute('points',pts.map(p=>p.join(',')).join(' '));
   lp.setAttribute('fill','none');lp.setAttribute('stroke','#E8743B');lp.setAttribute('stroke-width','1.5');
   lp.setAttribute('stroke-dasharray','5 4');svg.appendChild(lp);
  }
  // 选中高亮
  if(st.selZone){const z=zoneById(st.selZone);
   if(z&&z.poly){const pts=z.poly.map(p=>[(p[0]*scale)+40,(50-p[1]*scale)+30]);
    const hl=elNS('polygon');hl.setAttribute('points',pts.map(p=>p.join(',')).join(' '));
    hl.setAttribute('fill','none');hl.setAttribute('stroke','#E0452E');hl.setAttribute('stroke-width','2.5');
    svg.appendChild(hl);
    z.poly.forEach((p,i)=>{const c=elNS('circle');
     c.setAttribute('cx',p[0]*scale+40);c.setAttribute('cy',50-p[1]*scale+30);c.setAttribute('r','4.5');
     c.setAttribute('fill','#fff');c.setAttribute('stroke','#E0452E');c.setAttribute('stroke-width','2');
     c.setAttribute('data-v',i);c.style.cursor='grab';svg.appendChild(c);});
   }
  }
  // 信标
  DB.beacons.filter(bg=>bg.bld===sl1.value&&bg.floor===(+sl2.value)).forEach(bg=>{
   const z=zoneById(bg.zone);
   if(z&&z.poly){const c=z.poly.reduce((s,p)=>[s[0]+p[0],s[1]+p[1]],[0,0]);
    const cx=c[0]/z.poly.length*scale+40, cy=50-c[1]/z.poly.length*scale+30;
    const g=elNS('g');
    const cir=elNS('circle');cir.setAttribute('cx',cx);cir.setAttribute('cy',cy);cir.setAttribute('r','7');
    cir.setAttribute('fill','#E8743B');cir.setAttribute('stroke','#fff');cir.setAttribute('stroke-width','2');
    const lb=elNS('text');lb.setAttribute('x',cx+11);lb.setAttribute('y',cy+4);lb.setAttribute('font-size','10');
    lb.setAttribute('fill','#A04A15');lb.textContent=bg.id;
    g.appendChild(cir);g.appendChild(lb);svg.appendChild(g);
   }
  });
 }
 function elNS(n){return document.createElementNS('http://www.w3.org/2000/svg',n);}
 render();
 // 交互：点击画布添加/选择顶点
 svg.addEventListener('dblclick',e=>{
  const rect=svg.getBoundingClientRect();
  const x=(e.clientX-rect.left)/rect.width*460, y=(e.clientY-rect.top)/rect.height*320;
  if(st.drawing.length>=3){ // 闭合
   const raw=st.drawing.map(p=>[(p[0]-40)/scale,(50-p[1])/scale]);
   curZones().push({n:st.drawingName||'新区域'+Date.now()%1000,poly:raw,beacon:[]});
   st.drawing=[];st.drawingName=null;render();toast('区域已添加');
  }
 });
 svg.addEventListener('click',e=>{
  if(st.dragIdx>=0)return;
  const rect=svg.getBoundingClientRect();
  const x=(e.clientX-rect.left)/rect.width*460, y=(e.clientY-rect.top)/rect.height*320;
  if(st.selZone){const z=zoneById(st.selZone);
   // 顶点拖动命中
   if(z&&z.poly){const sc=6.8;
    z.poly.forEach((p,i)=>{if(Math.hypot((p[0]*sc+40)-x,(50-p[1]*sc+30)-y)<7){st.dragIdx=i;st.dragZone=z;}});
   }
  }
  if(st.dragIdx<0&&st.drawing){st.drawing.push([(x-40)/scale,(50-y)/scale]);render();}
 });
 svg.addEventListener('mousemove',e=>{
  if(st.dragIdx>=0&&st.dragZone){
   const rect=svg.getBoundingClientRect();
   const x=(e.clientX-rect.left)/rect.width*460, y=(e.clientY-rect.top)/rect.height*320;
   st.dragZone.poly[st.dragIdx]=[(x-40)/scale,(50-y)/scale];render();
  }
 });
 document.addEventListener('mouseup',()=>{st.dragIdx=-1;});
 $id('azAdd')==null&&0;
 // 用 ctl 里新增按钮
 $id('azAdd').onclick=()=>{
  const name=prompt('功能区名称（对应品质模块中的功能区）：');
  if(!name)return;
  st.drawingName=name;st.drawing=[];st.selZone=null;
  toast('请点击画布添加顶点，双击闭合');render();
 };
 $id('azSave').onclick=()=>{toast('功能区位置已保存（'+(curZones().length||0)+' 个区域）');persist();};
 $id('azDel').onclick=()=>{
  if(!st.selZone)return toast('先点击选中一个区域');
  const zs=curZones();const i=zs.findIndex(z=>z.n===st.selZone);
  if(i>=0){zs.splice(i,1);st.selZone=null;render();toast('已删除');}
 };
 sl1.onchange=()=>{st.selZone=null;st.drawing=[];render();};
 sl2.onchange=()=>{st.selZone=null;st.drawing=[];render();};
}
/* ---- 信标绑定 ---- */
function adminBeacon(m){
 m.appendChild(el('div','admincard','<h4>信标绑定（信标组管理）</h4>'
  +'<div class="sub">信标组 = 一个功能区的定位单元：名称、接收距离、关联信标（编码+MAC）、最小停留时长。数据参照 cims「定位设备-信标管理」真实结构。</div>'));
 const tb=el('table');tb.innerHTML='<tr><th>信标组</th><th>楼栋-楼层</th><th>接收距离</th><th>关联信标</th><th>停留时长(员工/主管)</th><th>操作</th></tr>';
 DB.beacons.forEach(bg=>{
  const b=P.bldGeo.find(x=>x.id===bg.bld);
  const r=el('tr');
  r.innerHTML='<td><b>'+bg.name+'</b></td><td>'+b.name+' '+bg.floor+'F</td><td>'+bg.dist+'</td>'
   +'<td>'+bg.list.map(x=>x.code+'<br><small style="color:#8A96A2">'+x.mac+'</small>').join('<br>')+'</td>'
   +'<td>'+bg.stayStaff+'s / '+bg.stayMgr+'s</td>'
   +'<td><button class="btn sm" data-e="'+bg.id+'">编辑</button> <button class="btn sm danger" data-d="'+bg.id+'">删除</button></td>';
  tb.appendChild(r);
 });
 m.appendChild(tb);
 tb.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>{
  const bg=DB.beacons.find(x=>x.id===b.dataset.e);
  const name=prompt('信标组名（=关联功能区名）：',bg.name);
  if(name)bg.name=name;
  const dist=prompt('接收距离描述：',bg.dist);if(dist)bg.dist=dist;
  const ss=prompt('员工最小停留时长(秒)：',bg.stayStaff);if(ss)bg.stayStaff=+ss||bg.stayStaff;
  const sm=prompt('主管最小停留时长(秒)：',bg.stayMgr);if(sm)bg.stayMgr=+sm||bg.stayMgr;
  const mac=prompt('追加信标 MAC（回车跳过）：','');if(mac)bg.list.push({code:'10008'+Math.floor(Math.random()*90000),mac:mac.toUpperCase()});
  renderAdmin();toast('信标组已更新');});
 tb.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{
  const i=DB.beacons.findIndex(x=>x.id===b.dataset.d);
  if(i>=0){DB.beacons.splice(i,1);renderAdmin();toast('信标组已删除');}});
 m.appendChild(el('div','admincard','<h4>新增信标组</h4><div class="sub">选择楼栋楼层与功能区，绑定信标编码/MAC。</div>'
  +'<div class="formgrid"><div class="f"><label>楼栋</label><select id="nbBld"></select></div>'
  +'<div class="f"><label>楼层</label><select id="nbFloor"></select></div>'
  +'<div class="f"><label>关联功能区</label><select id="nbZone"></select></div>'
  +'<div class="f"><label>信标 MAC</label><input type="text" placeholder="E31AFD8934B9"></div></div>'
  +'<div class="admin-toolbar"><button class="btn primary" id="nbAdd">创建信标组</button></div>'));
 const slB=$id('nbBld');P.bldGeo.forEach(b=>{const o=el('option','',b.name);o.value=b.id;slB.appendChild(o);});
 const fillN=()=>{const b=bldOf(slB.value);const f=$id('nbFloor');f.innerHTML='';
  realFloors(b).forEach(i=>{const o=el('option','',i+'层');o.value=i;f.appendChild(o);});
  const z=$id('nbZone');z.innerHTML='';zoneNames(b,realFloors(b)[0]||1).forEach(n=>{const o=el('option','',n);o.value=n;z.appendChild(o);});};
 slB.onchange=fillN;$id('nbFloor').onchange=()=>{const b=bldOf(slB.value);const z=$id('nbZone');z.innerHTML='';
  zoneNames(b,+$id('nbFloor').value).forEach(n=>{const o=el('option','',n);o.value=n;z.appendChild(o);});};
 fillN();
 $id('nbAdd').onclick=()=>{
  const mac=$id('nbBld').parentElement.parentElement.querySelector('input[type=text]').value||'E31AFD'+Math.random().toString(16).slice(2,8).toUpperCase();
  DB.beacons.push({id:'BG'+(DB.beacons.length+1),bld:slB.value,floor:+$id('nbFloor').value,
   name:$id('nbZone').value,dist:'半径约2-2.5米',stayStaff:10,stayMgr:60,
   list:[{code:'10008'+Math.floor(Math.random()*90000),mac:mac}],zone:$id('nbZone').value});
  renderAdmin();toast('信标组已创建');};
}
/* ---- 电子围栏 ---- */
function adminFence(m){
 m.appendChild(el('div','admincard','<h4>电子围栏配置</h4>'
  +'<div class="sub">选择楼栋楼层的功能区设为电子围栏：划定敏感区域（医院重要科室 / 商场贵重区 / 办公楼机密区），系统实时监控进出并记录未授权人员。</div>'));
 const tb=el('table');tb.innerHTML='<tr><th>围栏</th><th>位置</th><th>级别</th><th>授权人员</th><th>状态</th><th>操作</th></tr>';
 DB.fences.forEach(fn=>{
  const b=P.bldGeo.find(x=>x.id===fn.bld);
  const names=fn.auth.map(a=>DB.staff.find(s=>s.id===a)?.name||a).join('、');
  const r=el('tr');
  r.innerHTML='<td><b>'+fn.name+'</b></td><td>'+b.name+' '+fn.floor+'F · '+fn.zone+'</td>'
   +'<td><span class="tag">'+fn.level+'</span></td><td>'+names+'</td>'
   +'<td><span class="tag" style="background:'+(fn.alertOnEnter?'#FDEBE7;color:#E0452E':'#E8F5EE;color:#2E9E6B')+'">'
   +(fn.alertOnEnter?'未授权即告警':'仅记录')+'</span></td>'
   +'<td><button class="btn sm" data-e="'+fn.id+'">编辑</button> <button class="btn sm danger" data-d="'+fn.id+'">删除</button></td>';
  tb.appendChild(r);
 });
 m.appendChild(tb);
 tb.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>{
  const fn=DB.fences.find(x=>x.id===b.dataset.e);
  const name=prompt('围栏名称：',fn.name);if(name)fn.name=name;
  const level=prompt('级别（机密/管控/限制/贵重）：',fn.level);if(level)fn.level=level;
  const auth=prompt('授权人员工号（逗号分隔，如 S1,S3）：',fn.auth.join(','));if(auth)fn.auth=auth.split(/[,，]/).map(x=>x.trim()).filter(Boolean);
  renderAdmin();toast('围栏已更新');});
 tb.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{
  const i=DB.fences.findIndex(x=>x.id===b.dataset.d);
  if(i>=0){DB.fences.splice(i,1);renderAdmin();toast('围栏已删除');}});
 m.appendChild(el('div','admincard','<h4>新增电子围栏</h4><div class="sub">选择楼栋、楼层、功能区，设置围栏名称与授权人员。</div>'
  +'<div class="formgrid"><div class="f"><label>楼栋</label><select id="nfBld"></select></div>'
  +'<div class="f"><label>楼层</label><select id="nfFloor"></select></div>'
  +'<div class="f"><label>功能区（已绘制位置的区域）</label><select id="nfZone"></select></div>'
  +'<div class="f"><label>围栏级别</label><select id="nfLevel"><option>机密</option><option>限制</option><option>管控</option><option>贵重</option></select></div>'
  +'<div class="f"><label>围栏名称</label><input type="text" id="nfName" placeholder="如：手术室（限制）"></div>'
  +'<div class="f"><label>授权人员工号（逗号分隔）</label><input type="text" id="nfAuth" placeholder="S3"></div></div>'
  +'<div class="admin-toolbar"><button class="btn primary" id="nfAdd">创建围栏</button>'
  +'<span class="hint">未在授权名单内的员工进入该区域，将实时产生告警记录。</span></div>'));
 const slB=$id('nfBld');P.bldGeo.forEach(b=>{const o=el('option','',b.name);o.value=b.id;slB.appendChild(o);});
 const fillF=()=>{const b=bldOf(slB.value);const fl=$id('nfFloor');fl.innerHTML='';
  realFloors(b).forEach(i=>{const o=el('option','',i+' 层');o.value=i;fl.appendChild(o);});
  fillZ();};
 const fillZ=()=>{const b=bldOf(slB.value);const f=+$id('nfFloor').value;const z=$id('nfZone');z.innerHTML='';
  zoneNames(b,f).forEach(n=>{const o=el('option','',n);o.value=n;z.appendChild(o);});};
 slB.onchange=fillF;$id('nfFloor').onchange=fillZ;fillF();
 $id('nfAdd').onclick=()=>{
  const nm=$id('nfName').value.trim();if(!nm)return toast('请输入围栏名称');
  DB.fences.push({id:'F'+(DB.fences.length+1),bld:slB.value,floor:+$id('nfFloor').value,
   name:nm,zone:$id('nfZone').value,level:$id('nfLevel').value,
   auth:$id('nfAuth').value.split(/[,，]/).map(x=>x.trim()).filter(Boolean),
   alertOnEnter:true,color:'#E0452E'});
  renderAdmin();toast('围栏已创建：'+nm);};
}
/* ---- 接口契约 ---- */
