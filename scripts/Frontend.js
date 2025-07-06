// ========================================
// Google Apps Script 前端 - 標準版 (純 HTML Service)
// ========================================

function doGet(e) {
  try {
    console.log('🌐 渲染前端頁面');
    
    return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setTitle('學生報到系統');
      
  } catch (error) {
    console.error('❌ doGet 錯誤:', error);
    
    // 返回錯誤頁面
    return HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>系統錯誤</title>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px;
            background-color: #1a1a1a;
            color: #ffffff;
          }
          .error { 
            color: #ff6b6b; 
            background: #2d2d2d; 
            padding: 20px; 
            border-radius: 8px;
            border: 1px solid #ff6b6b;
          }
        </style>
      </head>
      <body>
        <div class="error">
          <h2>系統錯誤</h2>
          <p>發生未預期的錯誤，請稍後再試。</p>
          <p><small>錯誤時間: ${new Date().toLocaleString('zh-TW')}</small></p>
          <p><small>錯誤詳情: ${error.toString()}</small></p>
        </div>
      </body>
      </html>
    `);
  }
}

function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (error) {
    console.error(`❌ 載入檔案失敗: ${filename}`, error);
    return `<!-- 載入 ${filename} 失敗: ${error.toString()} -->`;
  }
}