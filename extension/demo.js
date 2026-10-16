if(location.protocol!=='chrome-extension:') {
  document.querySelector('#demo-open').href='index.html#install';
  document.querySelector('#demo-open').textContent='查看插件安装步骤';
  document.querySelector('#demo-tip').textContent='安装后，在此网页点击工具栏的拾图集，进行真实页面提取测试。';
}
