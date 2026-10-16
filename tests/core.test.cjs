const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../extension/core.js');
test('URL 规范化：保留签名参数、去片段、拒绝非网络协议及含凭据 URL',()=>{
  assert.equal(C.normalizeURL('../p.jpg?token=a%2Fb#x','https://shop.test/item/1'),'https://shop.test/p.jpg?token=a%2Fb');
  for(const bad of ['javascript:alert(1)','data:image/png;base64,abc','file:///x','https://name:secret@test/a.jpg'])assert.equal(C.normalizeURL(bad),null);
});
test('去重仅比较完整 URL，不错误合并不同签名版本',()=>{
  const a=C.normalizeImages([{url:'/a.png?x=1',width:0},{url:'/a.png?x=1#abc',width:900,height:800},{url:'/a.png?x=2'}],'https://a.test');
  assert.equal(a.length,2);assert.equal(a[0].width,900);
});
test('srcset 支持宽度、倍数和 URL 中逗号',()=>{
  assert.deepEqual(C.srcsetURLs('a.png 1x, b.png 2x'),['a.png','b.png']);
  assert.deepEqual(C.srcsetURLs('a.png, b.png'),['a.png','b.png']);
  assert.deepEqual(C.srcsetURLs('https://x/a,b.png 800w, /b.png 1200w'),['https://x/a,b.png','/b.png']);
});
test('尺寸与比例筛选：未知尺寸保留；比例必须已知',()=>{
  const f={min:120,shape:'',type:'',query:''};
  assert.equal(C.matches({width:1,height:1},f),false);
  assert.equal(C.matches({width:0,height:0},f),true);
  assert.equal(C.matches({width:0,height:0},{...f,shape:'square'}),false);
  assert.equal(C.matches({width:800,height:1200},{...f,shape:'portrait'}),true);
  assert.equal(C.matches({width:800,height:1200},{...f,shape:'landscape'}),false);
});
test('文件名防止路径穿越、保留设备名和非法字符',()=>{
  assert.equal(C.filename('CON'),'_CON');assert.equal(C.filename('..'),'商品图');
  assert(!C.filename('../a\\b:c*?').includes('/'));assert(!C.filename('a. ').endsWith('.'));
});
test('CSV 正确转义引号并避免表格公式注入',()=>{
  assert.equal(C.csvCell('a"b'),'"a""b"');assert.equal(C.csvCell('=SUM(A1)'), '"\'=SUM(A1)"');
  const csv=C.csv({url:'https://a.test',createdAt:'2026-10-15'},[{alt:'+1',width:8,height:9,url:'https://a.test/p.png'}]);assert(csv.startsWith('\uFEFF'));assert(csv.includes("'+1"));
});
test('商品页入口不会出现在主页及伪造相似域名',()=>{
  assert(C.productPage('https://item.taobao.com/item.htm?id=1'));assert(C.productPage('https://item.jd.com/12345.html'));assert(C.productPage('https://mobile.yangkeduo.com/goods.html?goods_id=1'));
  assert(!C.productPage('https://www.taobao.com/'));assert(!C.productPage('https://taobao.com.evil.test/item.htm?id=1'));
});
test('大量图片会封顶 400 张，重复图不占配额',()=>{
  assert.equal(C.normalizeImages(Array.from({length:500},(_,i)=>({url:`https://a.test/${i}.png`}))).length,400);
});
test('未知图片扩展名、大小写与 JPG 统一',()=>{
  assert.equal(C.fileType('https://a.test/P.JPEG?q=1'),'jpg');assert.equal(C.fileType('https://a.test/img?format=webp'),'未知');
});
