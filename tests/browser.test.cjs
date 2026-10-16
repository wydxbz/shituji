const {chromium}=require('../scripts/browser-runtime.cjs').playwright();
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');
const root=path.resolve(__dirname,'..'), ext=path.join(root,'extension'),out=path.join(root,'evidence');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(root,'test-results/downloads'),{recursive:true});
const checks=[], errors=[];
const pass=message=>{checks.push(message);console.log('PASS '+message);};
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.zip':'application/zip'};
function asset(url){let p=decodeURIComponent(new URL(url).pathname);if(p==='/'||p.endsWith('/index.html'))p='/index.html';if(p==='/item.htm')p='/demo.html';const file=path.resolve(root,'docs','.'+p);if(!file.startsWith(path.join(root,'docs')+path.sep))return null;try{return {body:fs.readFileSync(file),contentType:mime[path.extname(file)]||'text/plain'};}catch{return null;}}
const server=http.createServer((req,res)=>{const a=asset('http://localhost'+req.url);res.writeHead(a?200:404,{'Content-Type':a?.contentType||'text/plain'});res.end(a?.body||'not found');});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const local='http://127.0.0.1:'+server.address().port;
  fs.mkdirSync(path.join(root,'.test-profile'),{recursive:true});
  const profile=fs.mkdtempSync(path.join(root,'.test-profile/run-'));
  const context=await chromium.launchPersistentContext(profile,{
    executablePath:process.env.BROWSER_EXECUTABLE,headless:true,acceptDownloads:true,downloadsPath:path.join(root,'test-results/downloads'),
    ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`],viewport:{width:1500,height:1080},deviceScaleFactor:1
  });
  let id;
  try {
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:12000});id=new URL(worker.url()).host;
    const base=`chrome-extension://${id}`;await worker.evaluate(()=>chrome.storage.local.clear());
    pass('在隔离浏览器资料目录中成功加载原始 Manifest V3 插件');
    const downloads=[];context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('download',d=>downloads.push(d));});
    const gallery=await context.newPage();gallery.on('pageerror',e=>errors.push(e.message));
    await gallery.goto(base+'/gallery.html?demo=1');await gallery.waitForFunction(()=>document.querySelectorAll('.image-card').length===8);
    await gallery.locator('.image-card').last().scrollIntoViewIfNeeded();
    await gallery.waitForFunction(()=>[...document.querySelectorAll('.image-stage img')].every(i=>i.complete&&i.naturalWidth>0));
    assert.equal(await gallery.locator('.image-card:visible').count(),8);pass('8 张原创示例图片全部成功加载，无破图');
    await gallery.locator('.check input').nth(0).check();await gallery.locator('.check input').nth(1).check();
    await gallery.selectOption('#shape','portrait');assert.equal(await gallery.locator('.image-card:visible').count(),2);assert.equal(await gallery.locator('#selected').textContent(),'2');
    assert.match(await gallery.locator('#hidden-selected').textContent(),/1 张/);pass('纵向筛选准确，筛选隐藏的勾选项得到保留并有提示');
    await gallery.click('#invert');assert.equal(await gallery.locator('#selected').textContent(),'2');
    await gallery.click('#clear-selection');await gallery.click('#reset');
    await gallery.getByRole('button',{name:'预览 弧线台灯'}).click();await gallery.waitForSelector('#preview[open]');
    await gallery.click('#preview-select');assert.equal(await gallery.locator('#selected').textContent(),'1');
    await gallery.keyboard.press('ArrowRight');assert.match(await gallery.locator('#preview-title').textContent(),/手提袋/);await gallery.keyboard.press('Escape');pass('大图预览、键盘翻页、选中与 Esc 关闭可用');
    await gallery.click('#clear-selection');await gallery.locator('.check input').nth(0).check();await gallery.locator('.check input').nth(1).check();
    await gallery.fill('#prefix','真实下载测试');await gallery.selectOption('#format','png');await gallery.click('#download');
    await gallery.waitForFunction(()=>document.querySelector('#progress-text').textContent.includes('成功 2 张'),{},{timeout:30000});
    const completed=await gallery.evaluate(()=>chrome.downloads.search({state:'complete'}));assert(completed.filter(x=>x.mime==='image/png').length>=2);
    const pngDownloads=downloads.filter(d=>d.suggestedFilename().endsWith('.png'));assert(pngDownloads.length>=2);
    for(let i=0;i<2;i++){const dest=path.join(root,'test-results/downloads',`verified-${i+1}.png`);await pngDownloads[i].saveAs(dest);const bytes=fs.readFileSync(dest);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');}
    pass('实际批量下载 2 张 PNG，浏览器状态 complete，验证文件 PNG 签名');
    const converted=await gallery.evaluate(async()=>{const blob=await(await fetch('assets/products/product-1.svg')).blob();const png=await toPNG(blob,500);const bitmap=await createImageBitmap(png);const result={type:png.type,w:bitmap.width,h:bitmap.height};bitmap.close();return result;});
    assert.equal(converted.type,'image/png');assert.equal(converted.w,500);pass('SVG 实际转换 PNG 并缩放到指定最长边，无放大失真');
    await gallery.click('#close-progress');await gallery.click('#export');await gallery.waitForFunction(()=>document.querySelector('#notice').textContent.includes('已导出'));
    const csvDownload=downloads.find(d=>d.suggestedFilename().endsWith('.csv'));assert(csvDownload);const csvPath=path.join(root,'test-results/downloads/verified.csv');await csvDownload.saveAs(csvPath);assert.match(fs.readFileSync(csvPath,'utf8'),/来源页面/);pass('CSV 清单实际下载，包含来源与图片信息');
    await gallery.evaluate(()=>requestDownload([{url:chrome.runtime.getURL('assets/missing.png'),alt:'不存在的测试图片'}]));
    await gallery.waitForFunction(()=>document.querySelector('#progress-text').textContent.includes('失败 1 张'));
    assert.equal(await gallery.locator('#retry').isVisible(),true);assert.match(await gallery.locator('#progress-text').textContent(),/成功 0 张/);pass('失败下载不计成功，展示原因与重试入口');
    await gallery.click('#retry');await gallery.waitForFunction(()=>!busy);
    await gallery.click('#close-progress');
    await gallery.click('#select-visible');await gallery.click('#download');await gallery.click('#cancel-download');await gallery.waitForFunction(()=>!busy);
    assert.match(await gallery.locator('#progress-text').textContent(),/队列已停止/);
    await gallery.click('#close-progress');await gallery.click('#export');await gallery.waitForFunction(()=>document.querySelector('#notice').textContent.includes('已导出'));
    pass('停止下载队列生效，随后 CSV 导出不受停止状态影响');
    // 以本项目原创 HTML 响应电商域名请求，验证匹配/注入和 DOM 扫描。不是实站兼容性测试。
    await context.route('https://item.taobao.com/**',async route=>{const a=asset(route.request().url());await route.fulfill({status:a?200:404,body:a?.body||'not found',contentType:a?.contentType||'text/plain'});});
    const product=await context.newPage();await product.goto('https://item.taobao.com/item.htm?id=100');await product.waitForSelector('#shituji-launcher');
    await product.screenshot({path:path.join(out,'02-商品页入口-模拟站点.png'),fullPage:false});
    const newGallery=context.waitForEvent('page');await product.locator('#shituji-launcher').click({position:{x:90,y:22}});const captured=await newGallery;
    await captured.waitForSelector('.image-card');await captured.locator('.image-card:visible').last().scrollIntoViewIfNeeded();
    await captured.waitForFunction(()=>[...document.querySelectorAll('.image-card:not([hidden]) .image-stage img')].every(i=>i.complete));
    const actual=await captured.evaluate(()=>({images:session.images,title:session.title}));assert.equal(actual.images.length,9);
    assert.equal(actual.images.filter(i=>i.url.includes('product-1.png')).length,1);assert(actual.images.some(i=>i.url.includes('product-6.png')));
    assert.equal(await captured.locator('.image-card:visible').count(),8);pass('商品页真实内容脚本：点击悬浮按钮提取 9 张、去重、提取懒加载候选、隐藏 48px 图标');
    await product.evaluate(()=>{const img=document.createElement('img');img.src='assets/products/product-1.svg';img.alt='新增 SVG 测试素材';document.body.append(img);});
    await captured.click('#rescan');await captured.waitForFunction(()=>!document.querySelector('#rescan').disabled);assert.match(await captured.locator('#notice').textContent(),/新增 1 张/);pass('补扫来源页能合并新增素材并保留原记录');
    await captured.reload();await captured.waitForSelector('.image-card');assert.equal(await captured.locator('.image-card').count(),10);pass('重新打开工作台后，采集记录仍保留');
    await product.goto('https://item.taobao.com/item.htm?id=101');await captured.click('#rescan');await captured.waitForFunction(()=>document.querySelector('#notice').textContent.includes('已跳转'));pass('来源页跳转后补扫被阻止，避免混入其他商品素材');
    await gallery.goto(base+'/gallery.html?demo=1');await gallery.waitForSelector('.image-card');
    await gallery.locator('.image-card').last().scrollIntoViewIfNeeded();await gallery.waitForFunction(()=>[...document.querySelectorAll('.image-stage img')].every(i=>i.complete));
    await gallery.locator('.check input').nth(0).check();await gallery.locator('.check input').nth(1).check();await gallery.locator('.check input').nth(4).check();await gallery.evaluate(()=>scrollTo(0,0));
    await gallery.screenshot({path:path.join(out,'01-插件选片台-实际运行.png'),fullPage:false});fs.copyFileSync(path.join(out,'01-插件选片台-实际运行.png'),path.join(root,'docs/assets/workbench.png'));
    await gallery.getByRole('button',{name:'预览 随行相机'}).click();await gallery.screenshot({path:path.join(out,'03-插件大图预览.png')});await gallery.keyboard.press('Escape');
    const management=await context.newPage();await management.goto('edge://extensions/');await management.waitForTimeout(800);await management.screenshot({path:path.join(out,'04-浏览器插件安装.png')});
    const site=await context.newPage();await site.goto(local);await site.waitForFunction(()=>[...document.images].filter(i=>!i.loading||i.loading!=='lazy').every(i=>i.complete&&i.naturalWidth>0));
    await site.screenshot({path:path.join(out,'06-配套官网-首页.png'),fullPage:false});
    await site.screenshot({path:path.join(out,'05-配套官网-本地预览.png'),fullPage:true});
    assert.equal(await site.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);pass('桌面官网无横向溢出，已保存全页截图');
    await site.setViewportSize({width:390,height:844});await site.reload();assert.equal(await site.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);pass('官网窄窗口布局无溢出（插件工作台以桌面为主）');
    await gallery.goto(base+'/gallery.html?id=missing');await gallery.waitForFunction(()=>document.querySelector('#notice').textContent.includes('已清除'));pass('失效采集链接展示明确空状态');
    gallery.once('dialog',d=>d.accept());await gallery.click('#clear-history');await gallery.waitForURL(base+'/gallery.html');
    const cleared=await worker.evaluate(()=>chrome.storage.local.get('sessions'));assert(!cleared.sessions);pass('清除采集记录后本地存储确实移除');
    assert.deepEqual(errors,[]);pass('上述页面无未捕获 JavaScript 异常');
    fs.writeFileSync(path.join(root,'test-results/browser-report.txt'),['拾图集自动化测试记录',new Date().toISOString(),'浏览器：'+await context.browser().version(),'使用隔离测试资料目录；未修改日常浏览器。','电商域名由本地原创建模页响应，不代表真实淘宝/京东/拼多多实站验证。','',...checks.map((c,i)=>`${i+1}. PASS ${c}`),'','截图见 evidence。下载文件校验结果见 test-results/downloads。'].join('\n'));
    console.log(`全部 ${checks.length} 项浏览器检查通过。`);
  } finally {await context.close();await new Promise(r=>server.close(r));if(path.resolve(profile).startsWith(path.join(root,'.test-profile')+path.sep)){try{fs.rmSync(profile,{recursive:true,force:true});}catch{}}}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
