const fs = require('fs');
const path = require('path');

// 1. 确保dist目录存在
const distPath = path.join(__dirname, '../dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ 错误：请先运行 npm run build 生成dist目录');
  process.exit(1);
}

// 2. 确保gas-deploy目录存在
const gasDeployPath = path.join(__dirname, '../gas-deploy');
if (!fs.existsSync(gasDeployPath)) {
  fs.mkdirSync(gasDeployPath);
}

// 3. 处理Vite构建结果
try {
  // 检查 assets 目录是否存在
  const assetsPath = path.join(distPath, 'assets');
  if (!fs.existsSync(assetsPath)) {
    throw new Error('未找到 assets 目录');
  }

  // 获取生成的JS和CSS文件
  const jsFiles = fs.readdirSync(assetsPath)
    .filter(file => file.endsWith('.js'));
  const cssFiles = fs.readdirSync(assetsPath)
    .filter(file => file.endsWith('.css'));

  if (jsFiles.length === 0) {
    throw new Error('未找到构建的 JS 文件');
  }

  console.log(`找到 ${jsFiles.length} 个 JS 文件: ${jsFiles.join(', ')}`);
  console.log(`找到 ${cssFiles.length} 个 CSS 文件: ${cssFiles.join(', ')}`);

  // 創建Scripts.html
  let jsContent = fs.readFileSync(path.join(assetsPath, jsFiles[0]), 'utf8');
  
  // 簡單檢查ES6模塊語法
  if (jsContent.includes('export ') || jsContent.includes('import ')) {
    console.warn('⚠️ 警告：檢測到可能的ES6模塊語法，請確保Vite配置正確');
  }
  fs.writeFileSync(
    path.join(gasDeployPath, 'Scripts.html'),
    `<script>${jsContent}</script>`
  );
  console.log('✅ Scripts.html 创建完成');

  // 創建Styles.html (CSS 文件可選)
  if (cssFiles.length > 0) {
    fs.writeFileSync(
      path.join(gasDeployPath, 'Styles.html'),
      `<style>${fs.readFileSync(path.join(assetsPath, cssFiles[0]), 'utf8')}</style>`
    );
    console.log('✅ Styles.html 创建完成');
  } else {
    // 如果没有 CSS 文件，创建一个空的 Styles.html
    fs.writeFileSync(
      path.join(gasDeployPath, 'Styles.html'),
      '<style>/* No CSS files found */</style>'
    );
    console.log('⚠️ 未找到 CSS 文件，创建空的 Styles.html');
  }

  console.log('✅ 前端资源处理完成');
} catch (error) {
  console.error('❌ 处理前端资源失败:', error);
  process.exit(1);
}

// 4. 復制並轉換後端邏輯文件 (.js -> .gs)
const backendFiles = [
  { source: 'Backend.js', target: 'Backend.gs' },
  { source: 'Frontend.js', target: 'Frontend.gs' }
];

backendFiles.forEach(({ source, target }) => {
  const sourcePath = path.join(__dirname, source);
  const targetPath = path.join(gasDeployPath, target);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`✅ 已复制 ${source} -> ${target}`);
  } else {
    console.warn(`⚠️ 未找到 ${source}，跳过复制`);
  }
});

// 5. 復制其他必要文件
const otherFiles = ['Index.html', '.clasp.json', 'appsscript.json'];
otherFiles.forEach(file => {
  const sourcePath = path.join(__dirname, file);
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, path.join(gasDeployPath, file));
    console.log(`✅ 已复制 ${file}`);
  } else {
    console.warn(`⚠️ 未找到 ${file}，跳过复制`);
  }
});

// 6. 输出部署包文件列表
function logDeploymentFiles() {
  const files = fs.readdirSync(gasDeployPath);
  const rootPath = path.resolve(__dirname, '..');
  
  console.log('🚀 GAS部署包准备完成');
  console.log('包含以下文件:');
  
  files.forEach(file => {
    const filePath = path.join(gasDeployPath, file);
    const relativePath = path.relative(rootPath, filePath);
    console.log(`└─ ${relativePath}`);
  });
}

logDeploymentFiles();
