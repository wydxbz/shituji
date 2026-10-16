'use strict';
importScripts('core.js');
// 会话仅保存本机，最多保留最近八次。不存网页正文和账号信息。
let storageQueue = Promise.resolve();
async function saveSession(data, tabId) {
  const task = storageQueue.then(async () => {
    const id = crypto.randomUUID();
    const session = {id, title: String(data.title || '未命名页面').slice(0,160), url: Shitu.normalizeURL(data.url) || '', images: Shitu.normalizeImages(data.images, data.url), tabId, limited: !!data.limited, createdAt: new Date().toISOString()};
    const {sessions = []} = await chrome.storage.local.get('sessions');
    await chrome.storage.local.set({sessions: [session, ...sessions].slice(0, 8)});
    return id;
  });
  storageQueue = task.catch(() => {});
  return task;
}
async function collect(tabId) {
  if (!Number.isInteger(tabId)) throw new Error('没有可采集的网页。请先打开商品详情页。');
  try {
    const response = await chrome.tabs.sendMessage(tabId,{type:'COLLECT_SHITU'});
    if(response?.ok)return response.data;
  } catch {}
  await chrome.scripting.executeScript({target:{tabId}, files:['core.js','collector.js']});
  const [result] = await chrome.scripting.executeScript({target:{tabId}, func: () => globalThis.collectShituImages()});
  return result.result;
}
async function handle(message, sender) {
  if (sender.id !== chrome.runtime.id) throw new Error('来源无效。');
  const fromExtension = !!sender.url?.startsWith(chrome.runtime.getURL(''));
  if (message.type === 'CAPTURE') {
    // 网页脚本只能提交自己所在标签页的采集结果。
    const tabId = fromExtension ? message.tabId : sender.tab?.id;
    const data = fromExtension ? await collect(tabId) : {...message.data, url: sender.tab?.url};
    const id = await saveSession(data, tabId);
    await chrome.tabs.create({url: chrome.runtime.getURL('gallery.html') + '?id=' + id});
    return {id};
  }
  if (!fromExtension) throw new Error('仅工作台可以执行此操作。');
  if (message.type === 'RESCAN') {
    const {sessions = []} = await chrome.storage.local.get('sessions');
    const old = sessions.find(s => s.id === message.id);
    if (!old) throw new Error('这次采集已清除，请重新提取。');
    const data = await collect(old.tabId);
    if (data.url !== old.url) throw new Error('来源标签页已跳转，请在新页面重新提取。');
    const task = storageQueue.then(async () => {
      const current = (await chrome.storage.local.get('sessions')).sessions || [];
      const session = current.find(s => s.id === old.id);
      if (!session) throw new Error('这次采集已清除。');
      session.images = Shitu.normalizeImages([...session.images, ...data.images], data.url);
      session.limited = data.limited || session.images.length >= Shitu.MAX_IMAGES;
      await chrome.storage.local.set({sessions: current});
      return session;
    });
    storageQueue = task.catch(() => {}); return await task;
  }
  if (message.type === 'CLEAR') {
    const task = storageQueue.then(() => chrome.storage.local.remove('sessions'));
    storageQueue = task.catch(() => {}); await task; return {};
  }
  throw new Error('无法识别的操作。');
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  handle(message, sender).then(data => respond({ok:true, data}), e => respond({ok:false, error:e.message || '操作失败，请重新打开网页后再试。'}));
  return true;
});
chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}).catch(() => {});
