'use strict';
let current;
chrome.tabs.query({active:true,currentWindow:true}).then(([tab]) => {
  current = tab;
  document.querySelector('#page-title').textContent = tab?.title || '先打开一个普通网页';
  try { document.querySelector('#host').textContent = new URL(tab.url).hostname; } catch {}
  const valid = /^https?:/.test(tab?.url || '') || tab?.url?.startsWith(chrome.runtime.getURL('demo.html'));
  document.querySelector('#capture').disabled = !valid;
  if(!valid) document.querySelector('#status').textContent = '浏览器设置页、扩展商店和本地文件无法提取。请打开商品网页，或使用示例页。';
});
document.querySelector('#capture').onclick = async (e) => {
  e.target.disabled = true; document.querySelector('#status').textContent = '正在读取页面图片…';
  try {
    if(current?.url?.startsWith(chrome.runtime.getURL('demo.html'))) { await chrome.tabs.create({url:chrome.runtime.getURL('gallery.html')+'?demo=1'}); window.close(); return; }
    const res = await chrome.runtime.sendMessage({type:'CAPTURE', tabId:current.id});
    if(!res.ok) throw new Error(res.error); window.close();
  } catch(e) { document.querySelector('#status').textContent = '提取未完成：' + e.message; document.querySelector('#capture').disabled = false; }
};
document.querySelector('#history').onclick = () => chrome.tabs.create({url:chrome.runtime.getURL('gallery.html')});
document.querySelector('#demo').onclick = () => chrome.tabs.create({url:chrome.runtime.getURL('demo.html')});
