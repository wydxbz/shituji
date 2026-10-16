document.querySelector('#copy-address').onclick=async()=>{
  try{await navigator.clipboard.writeText('chrome://extensions');document.querySelector('#copy-status').textContent='已复制，请粘贴到 Chrome 地址栏打开扩展管理。';}
  catch{document.querySelector('#copy-status').textContent='请手动复制此地址：chrome://extensions';}
};
