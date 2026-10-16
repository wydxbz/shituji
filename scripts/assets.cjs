/* 下面的商品图全部由本项目独立绘制，不含外部品牌、照片或竞品素材。 */
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('./browser-runtime.cjs').playwright();
const root=path.resolve(__dirname,'..');
const objects=[
  '<path d="M310 600H650" stroke="#355060" stroke-width="35" stroke-linecap="round"/><path d="M480 585V290" stroke="#466a79" stroke-width="25"/><path d="M300 310Q310 150 480 145Q650 150 660 310Z" fill="#88aeba"/><ellipse cx="480" cy="310" rx="180" ry="25" fill="#cadbce"/><ellipse cx="480" cy="314" rx="125" ry="10" fill="#f9edc5"/>',
  '<path d="M290 320Q480 360 670 320L710 700Q480 770 250 700Z" fill="#b78b59"/><path d="M355 360V240Q355 135 480 135Q605 135 605 240V360" fill="none" stroke="#875e36" stroke-width="30"/><path d="M320 365L300 665M640 365L660 665" fill="none" stroke="#d8b282" stroke-width="4"/><rect x="406" y="420" width="148" height="135" rx="10" fill="#c69c68" stroke="#d5b17f" stroke-width="3"/><path d="M440 467H520M440 485H500" stroke="#f3e2c5" stroke-width="6"/>',
  '<path d="M290 490V350Q290 145 480 145Q670 145 670 350V490" fill="none" stroke="#324765" stroke-width="60"/><path d="M300 350Q300 165 480 165Q660 165 660 350" fill="none" stroke="#8a9ab2" stroke-width="20"/><rect x="255" y="350" width="105" height="220" rx="48" fill="#506986"/><rect x="600" y="350" width="105" height="220" rx="48" fill="#506986"/><rect x="315" y="365" width="45" height="190" rx="20" fill="#bbc9d7"/><rect x="600" y="365" width="45" height="190" rx="20" fill="#bbc9d7"/>',
  '<ellipse cx="470" cy="625" rx="200" ry="24" fill="#b7b9a3"/><path d="M610 330H655Q760 330 760 435Q760 540 625 530" fill="none" stroke="#718a71" stroke-width="45"/><path d="M300 300H650L625 575Q480 650 325 575Z" fill="#8ea48a"/><ellipse cx="475" cy="300" rx="175" ry="36" fill="#dce0cd"/><ellipse cx="475" cy="303" rx="145" ry="22" fill="#614537"/><path d="M352 350L368 530" stroke="#bdcdb0" stroke-width="18" stroke-linecap="round"/>',
  '<rect x="210" y="275" width="540" height="310" rx="45" fill="#33454b"/><path d="M345 275L380 200H550L585 275" fill="#70818a"/><rect x="210" y="275" width="540" height="80" rx="25" fill="#9aacae"/><circle cx="485" cy="430" r="155" fill="#233540"/><circle cx="485" cy="430" r="125" fill="#617980"/><circle cx="485" cy="430" r="98" fill="#18303b"/><circle cx="485" cy="430" r="65" fill="#245565"/><circle cx="453" cy="400" r="26" fill="#689eaa" opacity=".6"/><rect x="635" y="298" width="70" height="40" rx="8" fill="#e8d8b0"/><rect x="265" y="245" width="70" height="30" rx="8" fill="#3a4b50"/>',
  '<path d="M200 470Q245 395 285 290L440 335L490 450L700 485Q790 500 785 570H200Z" fill="#ecdfcc"/><path d="M200 560H790V610H190Q165 590 200 560" fill="#b8b8ae"/><path d="M285 325L365 445L470 470" stroke="#e59073" stroke-width="35" fill="none"/><path d="M380 350L475 380M395 380L490 410M410 410L505 440" stroke="#8d8a7d" stroke-width="12" stroke-linecap="round"/><path d="M535 475L560 530L665 540L650 495" fill="#728d91"/>',
  '<path d="M350 610L390 555M610 610L570 555" stroke="#7b5745" stroke-width="25" stroke-linecap="round"/><circle cx="480" cy="380" r="220" fill="#ca9271"/><circle cx="480" cy="380" r="185" fill="#fff3db"/><path d="M480 235V255M480 505V525M335 380H355M605 380H625" stroke="#9a8b75" stroke-width="10"/><path d="M480 280V380L560 430" stroke="#3f6269" stroke-width="14" stroke-linecap="round" fill="none"/><circle cx="480" cy="380" r="15" fill="#4b6b70"/>',
  '<rect x="350" y="290" width="260" height="420" rx="40" fill="#bd967c"/><rect x="350" y="330" width="260" height="380" rx="30" fill="#d5b39a"/><rect x="400" y="200" width="160" height="110" rx="14" fill="#736252"/><path d="M420 220H540M420 240H540M420 260H540" stroke="#9a8671" stroke-width="4"/><rect x="380" y="420" width="200" height="185" fill="#f1e6d8"/><path d="M420 460H540M420 485H520M440 550H520" stroke="#937b66" stroke-width="8"/><path d="M375 350V650" stroke="#e6cfbb" stroke-width="12" opacity=".7"/>'
];
const palettes=[['#e9efec','#c6d8d1'],['#f1e5d7','#dcc5ad'],['#e6ecf4','#bccbdc'],['#edf0dc','#c6ccb2'],['#dce9eb','#b0cbd0'],['#f3e6e0','#d7bfaf'],['#f0e7e0','#dfc7b5'],['#ece2d9','#d0bba9']];
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  const page=await browser.newPage({viewport:{width:960,height:800},deviceScaleFactor:1});
  for(let i=0;i<8;i++){
    const h=i===1||i===7?1200:800, [a,b]=palettes[i];
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${h}" viewBox="0 0 960 ${h}"><defs><linearGradient id="bg" x2=".7" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="16"/></filter></defs><rect width="960" height="${h}" fill="url(#bg)"/><circle cx="800" cy="100" r="360" fill="white" opacity=".19"/><path d="M0 ${h*.64}Q400 ${h*.57} 960 ${h*.72}V${h}H0" fill="white" opacity=".14"/><g transform="translate(0,${(h-800)/2})"><ellipse cx="480" cy="670" rx="225" ry="26" fill="#33474d" opacity=".16" filter="url(#blur)"/>${objects[i]}</g></svg>`;
    for(const base of ['extension','docs']){const folder=path.join(root,base,'assets/products');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,`product-${i+1}.svg`),svg);}
    await page.setViewportSize({width:960,height:h});await page.setContent('<html><body style="margin:0">'+svg+'</body></html>');
    const png=await page.screenshot();
    for(const base of ['extension','docs'])fs.writeFileSync(path.join(root,base,'assets/products',`product-${i+1}.png`),png);
  }
  for(const size of [16,48,128]){
    await page.setViewportSize({width:size,height:size});
    await page.setContent(`<body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128"><rect width="128" height="128" rx="30" fill="#3156d3"/><rect x="28" y="23" width="73" height="75" rx="12" fill="#91adf2" transform="rotate(12 64 64)"/><rect x="22" y="31" width="78" height="74" rx="12" fill="white"/><circle cx="77" cy="52" r="8" fill="#e5af59"/><path d="M31 90L50 62L65 78L76 67L92 90Z" fill="#3156d3"/></svg></body>`);
    const png=await page.screenshot({omitBackground:true});for(const base of ['extension','docs']){fs.mkdirSync(path.join(root,base,'assets'),{recursive:true});fs.writeFileSync(path.join(root,base,'assets',`icon${size}.png`),png);}
  }
  await browser.close();console.log('生成 8 幅原创商品插画及插件图标。');
})().catch(e=>{console.error(e);process.exit(1);});
