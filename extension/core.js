/* 独立实现的可测试数据层。保留签名查询参数，不猜测或改写原图地址。 */
(function (root) {
  'use strict';
  const MAX_IMAGES = 400;
  function normalizeURL(value, base) {
    if (typeof value !== 'string' || value.length > 8192) return null;
    try {
      const u = new URL(value.trim(), base);
      if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return null;
      u.hash = '';
      return u.href;
    } catch { return null; }
  }
  function srcsetURLs(value = '') {
    // URL 内的逗号可能合法；仅去掉候选尾部的分隔逗号。
    const urls = []; let rest = value.trim();
    while (rest) {
      rest = rest.replace(/^[\s,]+/, ''); if (!rest) break;
      const token = rest.match(/^\S+/)[0]; rest = rest.slice(token.length);
      urls.push(token.replace(/,+$/, ''));
      if (!token.endsWith(',')) { const comma = rest.indexOf(','); rest = comma < 0 ? '' : rest.slice(comma + 1); }
    }
    return urls;
  }
  function fileType(url) {
    try { const m = new URL(url).pathname.match(/\.([a-z0-9]+)$/i); return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : '未知'; } catch { return '未知'; }
  }
  function normalizeImages(input, base) {
    const images = new Map();
    for (const item of input || []) {
      const url = normalizeURL(item.url, base); if (!url) continue;
      const old = images.get(url);
      const w = Math.max(0, Math.min(100000, Number(item.width) || 0));
      const h = Math.max(0, Math.min(100000, Number(item.height) || 0));
      if (old) { if (w * h > old.width * old.height) { old.width = w; old.height = h; } continue; }
      if (images.size >= MAX_IMAGES) break;
      images.set(url, {url, width: w, height: h, alt: String(item.alt || '').slice(0, 200), source: String(item.source || '图片').slice(0, 40), type: fileType(url)});
    }
    return [...images.values()];
  }
  function matches(item, filters) {
    const w = item.width || 0, h = item.height || 0;
    if (w && h && Math.min(w, h) < filters.min) return false;
    if (filters.type && item.type !== filters.type) return false;
    if (filters.shape && (!w || !h)) return false;
    if (filters.shape === 'landscape' && w / h <= 1.1) return false;
    if (filters.shape === 'portrait' && w / h >= 0.9) return false;
    if (filters.shape === 'square' && (w / h < .9 || w / h > 1.1)) return false;
    if (filters.query && !`${item.alt} ${item.url}`.toLowerCase().includes(filters.query.toLowerCase())) return false;
    return true;
  }
  function filename(value, fallback = '商品图') {
    let s = String(value || '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[.\s]+$/g, '').trim().slice(0, 64).replace(/[.\s]+$/g, '');
    if (!s || /^\.+$/.test(s)) s = fallback;
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)) s = '_' + s;
    return s;
  }
  function csvCell(value) {
    let s = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function csv(session, images) {
    const rows = [['序号', '图片说明', '宽度', '高度', '图片地址', '来源页面', '采集时间']];
    images.forEach((item, i) => rows.push([i + 1, item.alt, item.width, item.height, item.url, session.url, session.createdAt]));
    return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  }
  function productPage(url) {
    try {
      const u = new URL(url); const h = u.hostname;
      if (/(^|\.)(taobao|tmall)\.com$/.test(h)) return /\/item\.htm/.test(u.pathname) && u.searchParams.has('id');
      if (/(^|\.)jd\.com$/.test(h)) return /\/(?:product\/)?\d+\.html$/.test(u.pathname) || /\/product\//.test(u.pathname);
      if (/(^|\.)(pinduoduo|yangkeduo)\.com$/.test(h)) return /goods|detail/.test(u.pathname + u.hash) || u.searchParams.has('goods_id');
      return false;
    } catch { return false; }
  }
  const api = {MAX_IMAGES, normalizeURL, srcsetURLs, normalizeImages, fileType, matches, filename, csvCell, csv, productPage};
  root.Shitu = api;
  if (typeof module === 'object') module.exports = api;
})(globalThis);
