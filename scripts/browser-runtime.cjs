// 优先使用项目依赖；允许开发者通过环境变量指定已有 Playwright。
exports.playwright = function() {
  try{return require('playwright');}catch{}
  if(process.env.PLAYWRIGHT_MODULE)return require(process.env.PLAYWRIGHT_MODULE);
  throw new Error('请先 npm install，或设置 PLAYWRIGHT_MODULE 指向 Playwright 安装目录。');
};
