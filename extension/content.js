(() => {
  if (document.getElementById('shituji-launcher') || !Shitu.productPage(location.href)) return;
  const host = document.createElement('div'); host.id = 'shituji-launcher';
  host.style.cssText = 'position:fixed;right:24px;bottom:28px;z-index:2147483647';
  const root = host.attachShadow({mode:'closed'});
  root.innerHTML = '<style>button{font:600 14px system-ui;cursor:pointer;border:0;color:#fff;background:#284cc5;border-radius:14px;padding:15px 22px;box-shadow:0 6px 24px #15316840}button:focus-visible{outline:3px solid #efa536;outline-offset:4px}button:disabled{opacity:.65}.close{padding:5px 8px;font-size:12px;margin-left:5px;background:#1b2844}p{font:13px system-ui;max-width:230px;background:white;color:#1b2844;padding:8px;border-radius:8px}</style><button id="capture">拾图集 · 获取图片</button><button class="close" aria-label="隐藏拾图集按钮">×</button><p hidden role="status"></p>';
  root.querySelector('.close').onclick = () => host.remove();
  root.querySelector('#capture').onclick = async (e) => {
    const button = e.target, status = root.querySelector('p'); button.disabled = true; button.textContent = '正在整理图片…';
    try { const res = await chrome.runtime.sendMessage({type:'CAPTURE', data:collectShituImages()}); if (!res.ok) throw new Error(res.error); }
    catch(e) { status.hidden = false; status.textContent = e.message || '请刷新页面再试。'; }
    finally { button.disabled = false; button.textContent = '拾图集 · 获取图片'; }
  };
  document.documentElement.append(host);
})();
