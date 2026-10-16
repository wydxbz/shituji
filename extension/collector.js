/* 只读取当前页面 DOM；不调用商家接口，也不绕过登录。 */
globalThis.collectShituImages = function () {
  const C = globalThis.Shitu, found = [];
  const add = (url, source, alt = '', width = 0, height = 0) => found.push({url, source, alt, width, height});
  const roots = [document]; let scanned = 0;
  for (let r = 0; r < roots.length && r < 100; r++) {
    for (const el of roots[r].querySelectorAll('*')) {
      if (++scanned > 16000 || found.length > 6000) break;
      if (el.shadowRoot) roots.push(el.shadowRoot);
      if (el instanceof HTMLImageElement) {
        const alt = el.alt || el.title || '';
        if (el.currentSrc) add(el.currentSrc, '图片', alt, el.naturalWidth, el.naturalHeight);
        for (const attr of ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-ks-lazyload', 'data-lazyload', 'data-url']) {
          const url = el.getAttribute(attr); if (url) add(url, attr === 'src' ? '图片' : '懒加载', alt);
        }
        for (const attr of ['srcset', 'data-srcset']) for (const url of C.srcsetURLs(el.getAttribute(attr) || '')) add(url, '响应式', alt);
      }
      if (el.tagName === 'SOURCE' && el.parentElement?.tagName === 'PICTURE') {
        for (const url of C.srcsetURLs(el.getAttribute('srcset') || '')) add(url, '响应式', el.parentElement.querySelector('img')?.alt || '');
      }
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none') {
        for (const match of bg.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) add(match[1], '背景图', el.getAttribute('aria-label') || '背景图片');
      }
    }
  }
  const images = C.normalizeImages(found, document.baseURI);
  return {title: document.title.slice(0, 160), url: location.href, images, scanned, limited: images.length >= C.MAX_IMAGES || scanned > 16000 || found.length > 6000};
};
// 已注入的采集器通过消息补扫，无需额外申请整站脚本注入权限。
if (globalThis.chrome?.runtime?.id && !globalThis.shituListenerInstalled) {
  globalThis.shituListenerInstalled = true;
  chrome.runtime.onMessage.addListener((message,sender,reply) => {
    if(sender.id === chrome.runtime.id && message.type === 'COLLECT_SHITU') {
      try {reply({ok:true,data:globalThis.collectShituImages()});}
      catch(e) {reply({ok:false,error:e.message});}
    }
  });
}
