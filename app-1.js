
const dbKey='yzj3d_';
function persist(){localStorage.setItem(dbKey+JSON.stringify(Object.keys(DB)),'')}
/* ============================================================ 应用路由 */
const views={rt:document.getElementById('rtView'),bld:document.getElementById('bldView'),floor:document.getElementById('floorView'),
 staff:document.getElementById('staffView'),admin:document.getElementById('adminView')};
let curView='bld',curBld='B1',curFloor=null,curStaff='S1';
function show(v){
 curView=v;
 Object.values(views).forEach(x=>x.classList.remove('active'));
 views[v].classList.add('active');
 document.querySelectorAll('header .seg button').forEach(b=>b.classList.remove('active'));
 document.getElementById('nav'+v[0].toUpperCase()+v.slice(1)).classList.add('active');
 // 3D 层仅在需要时显示
 const need3d=(v==='bld'||v==='staff'||v==='rt');
 const useRt=(v==='rt');
 document.getElementById('view3d').style.display=(need3d&&!useRt)?'block':'none';
 document.getElementById('labels').style.display=(need3d&&!useRt)?'block':'none';
 document.getElementById('rtCanvas').style.display=useRt?'block':'none';
 document.getElementById('rtLabels').style.display=useRt?'block':'none';
 document.getElementById('statusbar').innerHTML='';
 if(v==='rt'){initRtView();}
 else if(v==='bld'){initBldView();}
 else if(v==='floor'){initFloorView();}
 else if(v==='staff'){initStaffView();}
 else if(v==='admin'){renderAdmin();}
 if($id('flStats'))$id('flStats').style.display=(v==='floor')?'block':'none';
 if($id('staffStats'))$id('staffStats').style.display=(v==='staff')?'block':'none';
 if(v!=='bld'&&$id('bldInfo'))$id('bldInfo').style.display='none';
}
document.getElementById('navRt').onclick=()=>show('rt');
document.getElementById('navBld').onclick=()=>show('bld');
document.getElementById('navFloor').onclick=()=>show('floor');
document.getElementById('navStaff').onclick=()=>show('staff');
document.getElementById('navAdmin').onclick=()=>{show('admin');renderAdmin();};

/* ============================================================ 通用工具 */
function el(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}
function $id(id){return document.getElementById(id);}
const P=DB.projects[0];
function bldOf(id){return DB.buildings[P.id].find(b=>b.id===id);}
function bname(id){const g=P.bldGeo.find(x=>x.id===id);return g?g.name:id;}
function zoneNames(b,f){const z=b.zones.find(x=>x.f===f);return z?z.z:[];}
// 真实楼层列表（数据离散：含地下负层/挑层），返回升序
function realFloors(b){return (b.zones||[]).map(z=>z.f).filter((v,i,a)=>a.indexOf(v)===i).sort((x,y)=>x-y);}
function colorForZone(name){
 const map={大堂:'#9BC6EE',卫生间:'#E8B9B1','女卫生间':'#E8B9B1','男卫生间':'#E8B9B1',残卫:'#E8B9B1',
 茶水间:'#F6D7A8',走廊:'#D9E3EC',公区:'#D0E8D5',会议室:'#C9C2E0',前台:'#F2C4CE',
 消防楼梯:'#C7CDD4',货梯厅:'#C7CDD4',客梯厅:'#C7CDD4',办公区:'#D0E8D5',吸烟区:'#F6D7A8',
 挂号处:'#F2C4CE',药房:'#F2C4CE',候诊区:'#D9E3EC',护士站:'#F2C4CE',诊区:'#D0E8D5',内科诊区:'#D0E8D5',
 外科诊区:'#D0E8D5',检验科:'#C9C2E0',放射科:'#C9C2E0',病房区:'#D0E8D5',手术室:'#E8B9B1',住院部大厅:'#9BC6EE'};
 for(const k in map){if(name.includes(k))return map[k];}
 return '#E3E8ED';
}
function toast(msg){
 let t=$id('toast');
 if(!t){t=el('div','','');t.id='toast';
  t.style.cssText='position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:99;background:#1E2A35;color:#fff;padding:10px 18px;border-radius:10px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.25);transition:opacity .3s;max-width:80vw';
  document.body.appendChild(t);}
 t.textContent=msg;t.style.opacity='1';
 clearTimeout(t.__tm);t.__tm=setTimeout(()=>t.style.opacity='0',2600);
}
function drawOutlineSVG(shape,w,h,cw,ch,label,editable){
 // shape: 米级坐标数组 → 画布坐标
 const wrap=el('div','canvaswrap','');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 '+cw+' '+ch);wrap.appendChild(svg);
 const pad=24, sx=(cw-pad*2)/w, sy=(ch-pad*2)/h;
 const topx=(x)=>(x*sx+pad), topy=(y)=>(ch-pad-y*sy);
 const pts=shape.map(p=>[topx(p[0]),topy(p[1])]);
 const poly=elNS2('polygon');
 poly.setAttribute('points',pts.map(p=>p.join(',')).join(' '));
 poly.setAttribute('fill','#EAF1FA');poly.setAttribute('stroke','#2E7DE8');poly.setAttribute('stroke-width','1.6');
 svg.appendChild(poly);
 const lb=elNS2('text');lb.setAttribute('x',cw/2);lb.setAttribute('y',16);
 lb.setAttribute('text-anchor','middle');lb.setAttribute('font-size','12');lb.setAttribute('fill','#5A6A78');
 lb.textContent=label+'（'+shape.length+' 顶点 · '+(w*0.5)+'m×'+(h*0.5)+'m 示意）';
 svg.appendChild(lb);
 if(editable){
  let cur=shape.slice(),drag=-1;
  const draw=()=>{
   svg.querySelectorAll('circle').forEach(c=>c.remove());
   const p2=cur.map(p=>[topx(p[0]),topy(p[1])]);
   poly.setAttribute('points',p2.map(p=>p.join(',')).join(' '));
   cur.forEach((p,i)=>{const c=elNS2('circle');
    c.setAttribute('cx',topx(p[0]));c.setAttribute('cy',topy(p[1]));c.setAttribute('r','6');
    c.setAttribute('fill','#fff');c.setAttribute('stroke','#E8743B');c.setAttribute('stroke-width','2.5');
    c.style.cursor='grab';
    c.addEventListener('mousedown',e=>{e.preventDefault();drag=i;});
    svg.appendChild(c);});
  };
  svg.addEventListener('mousemove',e=>{
   if(drag<0)return;
   const r=svg.getBoundingClientRect();
   const x=(e.clientX-r.left)/r.width*cw, y=(e.clientY-r.top)/r.height*ch;
   cur[drag]=[(x-pad)/sx,(ch-pad-y)/sy];draw();
  });
  document.addEventListener('mouseup',()=>{drag=-1;});
  svg.addEventListener('dblclick',e=>{
   const r=svg.getBoundingClientRect();
   const x=(e.clientX-r.left)/r.width*cw, y=(e.clientY-r.top)/r.height*ch;
   cur.push([(x-pad)/sx,(ch-pad-y)/sy]);draw();
  });
  svg.__getPts=()=>cur;
  svg.__setPts=fn=>{cur=fn();draw();};
  draw();
 }
 return wrap;
}
function elNS2(n){return document.createElementNS('http://www.w3.org/2000/svg',n);}
/* ============================================================ Admin 渲染 */
const adminPages=['proj','bld','zone','beacon','fence','api'];
let adminPage='proj';
document.querySelectorAll('#adminView .side button').forEach(b=>{
 b.onclick=()=>{adminPage=b.dataset.page;
  document.querySelectorAll('#admin .side button').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');renderAdmin();};
});
function renderAdmin(){
 const m=$id('adminMain');m.innerHTML='';
 if(adminPage==='proj')adminProj(m);
 else if(adminPage==='bld')adminBld(m);
 else if(adminPage==='zone')adminZone(m);
 else if(adminPage==='beacon')adminBeacon(m);
 else if(adminPage==='fence')adminFence(m);
 else adminApi(m);
}
/* ---- 项目信息 ---- */
function adminProj(m){
 m.appendChild(el('div','admincard','<h4>项目基础信息</h4><div class="sub">用户填写项目信息后，AI 联网检索真实建筑轮廓并完成数据建模。本版数据源：用户提供的「建筑物功能区导出」（355 个功能区）+ 联网检索中海广场真实建筑参数（中楼 35F/150m、南楼 21F、北楼 6F、地下 4F），楼栋几何可在下方微调。</div>'));
 const g=el('div','formgrid');
 const fields=[['name','项目名称',P.name],['code','项目编号',P.code],['type','业态',P.type],
  ['workType','作业类型',P.workType],['address','项目地址',P.address],['lat','纬度',P.lat],['lng','经度',P.lng]];
 fields.forEach(f=>{const d=el('div','f');
  d.innerHTML='<label>'+f[1]+'</label><input type="text" value="'+f[2]+'" data-k="'+f[0]+'">';
  g.appendChild(d);});
 m.appendChild(g);
 m.appendChild(el('div','admin-toolbar',
  '<button class="btn primary" id="aiSearch">AI 联网检索建筑轮廓</button>'
  +'<button class="btn" id="saveProj">保存项目信息</button>'
  +'<span class="tag">检索源：OpenStreetMap / 高德 / 天地图（后端配置）</span>'));
 $id('aiSearch').onclick=()=>{toast('AI 检索演示：已加载'+P.name+'建筑轮廓（中楼矩形/南楼矩形示意）');applyOutlineDemo();};
 $id('saveProj').onclick=()=>{
  g.querySelectorAll('input').forEach(i=>{const k=i.dataset.k;const v=i.value;
   if(k==='lat'||k==='lng')P[k]=parseFloat(v)||P[k];else P[k]=v;});toast('项目信息已保存');};
 const card=el('div','admincard','<h4>项目地块轮廓</h4><div class="sub">AI 检索返回的矢量轮廓（示例数据，可点击顶点微调）。</div>');
 card.appendChild(drawOutlineSVG(P.outline,60,50,460,320,'项目地块'));
 m.appendChild(card);
}
/* ---- 楼栋建模 ---- */
function adminBld(m){
 const card=el('div','admincard');
 card.appendChild(el('h4','','楼栋列表与建模参数'));
 card.appendChild(el('div','sub','每个楼栋：名称 / 楼层数 / 层高 / 建筑轮廓（AI 检索或手绘）。任意多边形轮廓将被拉伸为 3D 楼体。'));
 const tb=el('table');tb.innerHTML='<tr><th>楼栋</th><th>楼层</th><th>层高</th><th>轮廓形状</th><th>操作</th></tr>';
 P.bldGeo.forEach(b=>{const r=el('tr');
  r.innerHTML='<td><b>'+b.name+'</b></td><td>'+b.floors+' 层</td><td>4.2 m</td>'
   +'<td><span class="tag">'+b.shape.length+' 顶点</span></td>'
   +'<td><button class="btn sm" data-shape="'+b.id+'">编辑轮廓</button></td>';
  tb.appendChild(r);});
 card.appendChild(tb);m.appendChild(card);
 tb.querySelectorAll('button[data-shape]').forEach(btn=>{
  btn.onclick=()=>{const b=P.bldGeo.find(x=>x.id===btn.dataset.shape);
   const card2=el('div','admincard','<h4>编辑楼栋轮廓 · '+b.name+'</h4><div class="sub">双击闭合多边形，顶点可拖动；点击「应用」更新 3D 模型。</div>');
   card2.appendChild(drawOutlineSVG(b.shape,60,50,460,320,b.id,true));
   card2.appendChild(el('div','admin-toolbar','<button class="btn primary" data-ok>应用轮廓</button><button class="btn" data-cancel>取消</button>'));
   m.appendChild(card2);
   let pts=b.shape.slice();
   card2.querySelector('svg').__setPts=fn=>pts=fn();
   card2.querySelector('[data-ok]').onclick=()=>{b.shape=pts;toast('轮廓已应用，3D 模型将更新');renderAdmin();};
   card2.querySelector('[data-cancel]').onclick=()=>{card2.remove();};
  };
 });
 m.appendChild(el('div','admincard','<h4>层高与楼层规则</h4><div class="sub">层高用于 3D 拉伸与楼层分隔；支持「标准层」与「特殊层」（大堂挑高、设备层）。</div>'
  +'<div class="formgrid"><div class="f"><label>标准层层高 (m)</label><input type="number" value="4.2"></div>'
  +'<div class="f"><label>大堂层高 (m)</label><input type="number" value="6.0"></div>'
  +'<div class="f"><label>裙房层高 (m)</label><input type="number" value="5.2"></div></div>'));
}
/* ---- 功能区位置配置（核心画布） ---- */
