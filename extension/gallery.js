'use strict';
const $ = s => document.querySelector(s), C = globalThis.Shitu;
const selected = new Set(), cards = new Map(), states = new Map();
const hasExtension = !!globalThis.chrome?.runtime?.id;
const params = new URLSearchParams(location.search);
let session, images = [], visible = [], previewList = [], previewIndex = 0, busy = false, cancelled = false, failed = [], aborter;
const examples = ['弧线台灯','远行手提袋','轻盈耳机','日常咖啡杯','随行相机','城市运动鞋','书桌时钟','水滴香氛'];
const setNotice = text => { $('#notice').textContent = text; };
function filters() { return {min:Number($('#min-size').value),shape:$('#shape').value,type:$('#type').value,query:$('#search').value.trim()}; }
function demoSession() {
  return {id:'demo',title:'日常好物 · 原创商品插画集',url:'',createdAt:new Date().toISOString(),demo:true,images:examples.map((alt,i) => ({url:new URL(`assets/products/product-${i+1}.png`,location.href).href,width:960,height:i===1||i===7?1200:800,alt,source:'原创示例',type:'png'}))};
}
async function init() {
  let sessions = [];
  if (hasExtension) sessions = (await chrome.storage.local.get('sessions')).sessions || [];
  if (params.has('demo')) session = demoSession();
  else session = params.has('id') ? sessions.find(s=>s.id===params.get('id')) : sessions[0];
  const history = $('#history');
  if(!sessions.length) { const p=document.createElement('p');p.textContent='还没有采集记录';history.append(p); }
  sessions.forEach(s=>{
    const a=document.createElement('a');a.href='gallery.html?id='+encodeURIComponent(s.id);a.textContent=s.title;a.title=s.title;
    if(s.id===session?.id) a.className='current';
    const small=document.createElement('small');small.textContent=`${s.images.length} 张 · ${new Date(s.createdAt).toLocaleDateString('zh-CN')}`;a.append(small);history.append(a);
  });
  if(!session) {
    $('#empty').hidden=false;$('#rescan').disabled=true;
    if(params.has('id'))setNotice('这次采集记录已清除或超出最近 8 次保留范围。请重新提取。');
    return;
  }
  images=session.images;
  $('#title').textContent=session.title;
  $('#source-label').textContent=session.demo?'内置示例 · 8 张原创插画':new URL(session.url).hostname;
  $('#demo-badge').hidden=!session.demo;
  $('#subtitle').textContent=session.demo?'这些插画用于体验筛选、预览与真实下载，不来自电商网站。':`采集于 ${new Date(session.createdAt).toLocaleString('zh-CN')}，素材来源已记录。`;
  if(session.url){$('#source-link').href=session.url;$('#source-link').hidden=false;}
  $('#rescan').disabled=!!session.demo || !hasExtension;
  if(session.limited)setNotice('本次达到扫描上限（最多 400 张）；请下载需要的图片，再到更具体的商品页面采集。');
  render();
}
function render() {
  $('#grid').replaceChildren();cards.clear();
  const ordered=[...images];
  if($('#sort').value==='size')ordered.sort((a,b)=>b.width*b.height-a.width*a.height);
  if($('#sort').value==='name')ordered.sort((a,b)=>a.alt.localeCompare(b.alt,'zh-CN'));
  ordered.forEach((item,index)=>{
    const card=document.createElement('article');card.className='image-card';
    const stage=document.createElement('div');stage.className='image-stage';
    const checkLabel=document.createElement('label');checkLabel.className='check';
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=selected.has(item.url);checkbox.setAttribute('aria-label','选择 '+(item.alt || '图片 '+(index+1)));
    checkbox.onchange=()=>{checkbox.checked?selected.add(item.url):selected.delete(item.url);updateSelection();};checkLabel.append(checkbox);
    const button=document.createElement('button');button.setAttribute('aria-label','预览 '+(item.alt || '图片 '+(index+1)));button.onclick=()=>openPreview(item);
    const img=document.createElement('img');img.alt=item.alt||'图片 '+(index+1);img.loading='lazy';img.referrerPolicy='no-referrer';
    img.onload=()=>{item.width=img.naturalWidth;item.height=img.naturalHeight;dimensions.textContent=`${item.width} × ${item.height}`;applyFilters();};
    img.onerror=()=>{card.classList.add('broken');dimensions.textContent=item.width?`${item.width} × ${item.height}`:'尺寸未知';};
    img.src=item.url;button.append(img);
    const badge=document.createElement('span');badge.className='type-badge';badge.textContent=item.type.toUpperCase();
    stage.append(button,checkLabel,badge);
    const info=document.createElement('div');info.className='image-info';
    const name=document.createElement('strong');name.textContent=item.alt || `图片 ${String(index+1).padStart(3,'0')}`;name.title=name.textContent;
    const metadata=document.createElement('div');const dimensions=document.createElement('span');dimensions.textContent=item.width?`${item.width} × ${item.height}`:'读取尺寸…';
    const source=document.createElement('span');source.textContent=item.source;metadata.append(dimensions,source);
    const state=document.createElement('span');state.className='status';state.textContent=states.get(item.url)||'';
    info.append(name,metadata,state);card.append(stage,info);$('#grid').append(card);cards.set(item.url,{card,checkbox,state,item});
  });
  applyFilters();
}
function applyFilters() {
  const f=filters();visible=[];
  for(const {card,item} of cards.values()) {const show=C.matches(item,f);card.hidden=!show;if(show)visible.push(item);}
  $('#total').textContent=images.length;$('#visible').textContent=visible.length;
  $('#count-note').textContent=`${visible.length} / ${images.length}`;
  $('#empty').hidden=visible.length>0;
  $('#empty-text').textContent=images.length?'没有符合条件的图片，请降低尺寸限制或重置筛选。':'页面中未发现可读取的图片。请先滚动来源页加载图片，再补扫。';
  updateSelection();
}
function updateSelection() {
  $('#selected').textContent=selected.size;$('#bar-count').textContent=selected.size;
  const hidden=selected.size-visible.filter(i=>selected.has(i.url)).length;
  $('#hidden-selected').textContent=hidden?`包含 ${hidden} 张被筛选隐藏的图片`:'支持批量保存';
  $('#download').disabled=busy||!selected.size;
  for(const [url,{card,checkbox}] of cards){card.classList.toggle('selected',selected.has(url));checkbox.checked=selected.has(url);}
  if($('#preview').open)updatePreviewSelection();
}
for(const id of ['search','min-size','shape','type'])$( '#'+id).addEventListener('input',applyFilters);
$('#sort').onchange=render;
$('#select-visible').onclick=()=>{visible.forEach(i=>selected.add(i.url));updateSelection();};
$('#invert').onclick=()=>{visible.forEach(i=>selected.has(i.url)?selected.delete(i.url):selected.add(i.url));updateSelection();};
$('#clear-selection').onclick=()=>{selected.clear();updateSelection();};
$('#reset').onclick=()=>{$('#search').value='';$('#min-size').value='0';$('#shape').value='';$('#type').value='';applyFilters();};
for(const mode of ['comfortable','compact'])$('#'+mode).onclick=()=>{$('#grid').classList.toggle('compact',mode==='compact');$('#compact').setAttribute('aria-pressed',mode==='compact');$('#comfortable').setAttribute('aria-pressed',mode!=='compact');};
$('#current-nav').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
$('#help').onclick=()=>$('#help-dialog').showModal();$('#close-help').onclick=()=>$('#help-dialog').close();
$('#clear-history').onclick=async()=>{
  if(!hasExtension)return setNotice('当前是网页预览，浏览器插件中的采集记录不在此页面保存。');
  if(!confirm('清除本机全部采集记录？已下载的文件不会删除。'))return;
  const r=await chrome.runtime.sendMessage({type:'CLEAR'});if(!r.ok)return setNotice(r.error);
  location.href='gallery.html';
};
$('#rescan').onclick=async(e)=>{
  e.target.disabled=true;setNotice('正在补扫来源页面…');
  try {const r=await chrome.runtime.sendMessage({type:'RESCAN',id:session.id});if(!r.ok)throw new Error(r.error);const before=images.length;session=r.data;images=session.images;render();setNotice(`补扫完成，新增 ${Math.max(0,images.length-before)} 张。${session.limited?'已达到扫描上限。':''}`);}
  catch(e){setNotice('补扫失败：'+e.message+' 请回到原网页，重新点击拾图集。');}
  finally{$('#rescan').disabled=false;}
};
function openPreview(item) {previewList=[...visible];previewIndex=previewList.indexOf(item);updatePreview();$('#preview').showModal();}
function updatePreviewSelection() {const item=previewList[previewIndex];if(item)$('#preview-select').textContent=selected.has(item.url)?'取消选择':'选中这张';}
function updatePreview(){
  if(!previewList.length){$('#preview').close();return;}
  previewIndex=(previewIndex+previewList.length)%previewList.length;const item=previewList[previewIndex];
  $('#preview-image').src=item.url;$('#preview-image').alt=item.alt;$('#preview-title').textContent=item.alt||'未命名图片';
  $('#preview-meta').textContent=`${previewIndex+1} / ${previewList.length}　${item.width||'?'} × ${item.height||'?'}　${item.type.toUpperCase()}`;
  $('#preview-url').href=item.url;updatePreviewSelection();
}
$('#close-preview').onclick=()=>$('#preview').close();$('#prev').onclick=()=>{previewIndex--;updatePreview();};$('#next').onclick=()=>{previewIndex++;updatePreview();};
$('#preview').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){$('#prev').click();e.preventDefault();}if(e.key==='ArrowRight'){$('#next').click();e.preventDefault();}});
$('#preview-select').onclick=()=>{const i=previewList[previewIndex];selected.has(i.url)?selected.delete(i.url):selected.add(i.url);updateSelection();};
async function saveBlob(blob,filename,allowCancel=false) {
  const url=URL.createObjectURL(blob);
  try {
    if(!hasExtension){const a=document.createElement('a');a.href=url;a.download=filename.split('/').pop();a.click();await new Promise(r=>setTimeout(r,1000));return;}
    const id=await chrome.downloads.download({url,filename,saveAs:false,conflictAction:'uniquify'});
    for(let attempt=0;attempt<300;attempt++) {
      const [d]=await chrome.downloads.search({id});
      if(d?.state==='complete')return;
      if(d?.state==='interrupted')throw new Error(d.error||'下载被浏览器中断');
      if(allowCancel&&cancelled){await chrome.downloads.cancel(id).catch(()=>{});throw new Error('已停止');}
      await new Promise(r=>setTimeout(r,200));
    }
    await chrome.downloads.cancel(id).catch(()=>{});throw new Error('保存超时，请查看浏览器下载列表');
  } finally {URL.revokeObjectURL(url);}
}
$('#export').onclick=async()=>{
  if(!session||!visible.length)return setNotice('没有可导出的图片，请先提取或调整筛选。');
  try{await saveBlob(new Blob([C.csv(session,visible)],{type:'text/csv;charset=utf-8'}),'拾图集/素材来源清单.csv');setNotice(`已导出当前可见的 ${visible.length} 张图片信息。`);}catch(e){setNotice('清单导出失败：'+e.message);}
};
function mark(item,text){states.set(item.url,text);const card=cards.get(item.url);if(card)card.state.textContent=text;}
async function loadBlob(url) {
  aborter=new AbortController();
  const timer=setTimeout(()=>aborter?.abort(),20000);
  try {
    const response=await fetch(url,{signal:aborter.signal,credentials:'omit',referrerPolicy:'no-referrer'});
    if(!response.ok)throw new Error(`来源返回 HTTP ${response.status}`);
    const type=response.headers.get('content-type')?.split(';')[0]||'';
    if(!type.startsWith('image/'))throw new Error('来源未返回图片，可能需要登录或已失效');
    const limit=25*1024*1024;
    if(Number(response.headers.get('content-length'))>limit)throw new Error('图片超过 25 MB，建议打开原图单独保存');
    const chunks=[];let total=0;const reader=response.body.getReader();
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>limit){await reader.cancel();throw new Error('图片超过 25 MB');}chunks.push(value);}
    return new Blob(chunks,{type});
  } finally {clearTimeout(timer);aborter=null;}
}
async function toPNG(blob,maxSide) {
  const bitmap=await createImageBitmap(blob).catch(()=>null);
  let image=bitmap,temp;
  if(!image){temp=URL.createObjectURL(blob);image=new Image();image.src=temp;try{await image.decode();}catch(e){URL.revokeObjectURL(temp);throw new Error('浏览器无法解码这张图片');}}
  try {
    const w=image.width,h=image.height;
    if(!w||!h||w*h>50000000)throw new Error('图片像素过大，建议保留原格式下载');
    const scale=maxSide?Math.min(1,maxSide/Math.max(w,h)):1;
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const out=await new Promise(r=>canvas.toBlob(r,'image/png'));canvas.width=canvas.height=1;
    if(!out)throw new Error('PNG 转换失败');return out;
  } finally {bitmap?.close();if(temp)URL.revokeObjectURL(temp);}
}
function requestDownload(items){
  if(busy||!items.length)return;
  const options={format:$('#format').value,prefix:C.filename($('#prefix').value),resize:Number($('#resize').value)};
  busy=true;cancelled=false;updateSelection();
  // permissions.request 必须直接处于用户点击调用链，前面不执行异步读取。
  const origins=[...new Set(items.map(i=>{const u=new URL(i.url);return /^https?:$/.test(u.protocol)?`${u.protocol}//${u.hostname}/*`:null;}).filter(Boolean))];
  const permission=hasExtension&&origins.length?chrome.permissions.request({origins}):Promise.resolve(true);
  permission.then(ok=>{if(!ok){busy=false;updateSelection();setNotice('未获得图片来源访问权限，未开始下载。可以打开原图，或再次点击下载授权。');return;}return runDownloads(items,options);}).catch(e=>{busy=false;updateSelection();setNotice('下载未开始：'+e.message);});
}
async function runDownloads(items,options){
  failed=[];let success=0,processed=0;$('#progress-panel').hidden=false;$('#close-progress').hidden=true;$('#retry').hidden=true;$('#cancel-download').hidden=false;$('#failures').replaceChildren();$('#progress').max=items.length;$('#progress').value=0;
  for(let n=0;n<items.length;n++) {
    if(cancelled)break;
    const item=items[n];$('#progress-text').textContent=`正在处理 ${n+1} / ${items.length}：${item.alt||'图片'}`;mark(item,'处理中…');
    try {
      let blob=await loadBlob(item.url);
      let ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg','image/avif':'avif','image/bmp':'bmp'})[blob.type];
      if(options.format==='png'){blob=await toPNG(blob,options.resize);ext='png';}
      if(!ext)throw new Error('原格式暂不支持，请选择 PNG');
      if(cancelled)throw new Error('已停止');
      await saveBlob(blob,`拾图集/${options.prefix}_${String(n+1).padStart(3,'0')}.${ext}`,true);
      success++;mark(item,'✓ 已保存');
    } catch(e) {
      if(cancelled){mark(item,'未完成 · 已停止');break;}
      const error=e.name==='AbortError'?'图片读取超时':e.message;
      failed.push(item);mark(item,'未保存 · '+error);
      const li=document.createElement('li');li.textContent=`${item.alt||'图片 '+(n+1)}：${error}`;$('#failures').append(li);
    }
    processed++;$('#progress').value=processed;
  }
  busy=false;$('#cancel-download').hidden=true;$('#close-progress').hidden=false;$('#retry').hidden=!failed.length;
  $('#progress-text').textContent=`${cancelled?'队列已停止':'本次处理结束'}：成功 ${success} 张，失败 ${failed.length} 张，未处理 ${items.length-processed} 张。${hasExtension?'请在下载文件夹的“拾图集”目录查看。':'当前为网页预览，浏览器负责保存文件。'}`;
  updateSelection();
}
$('#download').onclick=()=>requestDownload(images.filter(i=>selected.has(i.url)));
$('#retry').onclick=()=>requestDownload([...failed]);
$('#cancel-download').onclick=()=>{cancelled=true;aborter?.abort();$('#progress-text').textContent='正在停止，请稍候…';};
$('#close-progress').onclick=()=>$('#progress-panel').hidden=true;
$('#format').onchange=()=>$('#resize').disabled=$('#format').value==='original';
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
init().catch(e=>setNotice('工作台打开失败：'+e.message));
