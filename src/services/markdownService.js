// ========================================
// Markdown 服務 - 簡易 Markdown 轉 HTML
// ========================================

class MarkdownService {
  constructor() {
    console.log('📝 MarkdownService 初始化')
  }

  /**
   * 將 Markdown 轉換為 HTML
   */
  markdownToHtml(markdown) {
    if (!markdown || typeof markdown !== 'string') {
      return ''
    }

    let html = markdown
      // 處理標題
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      
      // 處理粗體
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      
      // 處理斜體
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      
      // 處理行內代碼
      .replace(/`(.*?)`/g, '<code>$1</code>')
      
      // 處理連結
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      
      // 處理無序列表
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      
      // 包裝列表項目
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      
      // 處理換行
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      
      // 包裝段落
      .replace(/^(?!<[h|u|l])(.+)$/gm, '<p>$1</p>')
      
      // 清理多餘的段落標籤
      .replace(/<p><\/p>/g, '')
      .replace(/<p>(<h[1-6]>.*<\/h[1-6]>)<\/p>/g, '$1')
      .replace(/<p>(<ul>.*<\/ul>)<\/p>/gs, '$1')

    return html.trim()
  }

  /**
   * 為報到系統特別優化的 Markdown 轉換
   * 支援 emoji 和特殊格式
   */
  noticeMarkdownToHtml(markdown) {
    if (!markdown || typeof markdown !== 'string') {
      return '<div class="notice-placeholder">暫無提醒內容</div>'
    }

    let html = markdown
      // 處理標題（帶樣式類）
      .replace(/^### (.*$)/gm, '<h3 class="notice-h3">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="notice-h2">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="notice-title">$1</h1>')
      
      // 處理粗體（重要資訊）
      .replace(/\*\*(.*?)\*\*/g, '<strong class="notice-important">$1</strong>')
      
      // 處理斜體
      .replace(/\*(.*?)\*/g, '<em class="notice-emphasis">$1</em>')
      
      // 處理行內代碼（時間、數字等）
      .replace(/`(.*?)`/g, '<code class="notice-code">$1</code>')
      
      // 處理特殊表情符號段落
      .replace(/^([🔔🔄⏰📧📞📅⚡🎯📋✅📊].*$)/gm, '<div class="notice-highlight">$1</div>')
      
      // 處理無序列表
      .replace(/^- (.*$)/gm, '<li class="notice-list-item">$1</li>')
      
      // 包裝列表
      .replace(/(<li class="notice-list-item">.*<\/li>)/gs, '<ul class="notice-list">$1</ul>')
      
      // 處理段落間的空行
      .replace(/\n\n/g, '</p><p class="notice-text">')
      .replace(/\n/g, '<br>')
      
      // 包裝普通段落
      .replace(/^(?!<[h|u|l|d])(.+)$/gm, '<p class="notice-text">$1</p>')
      
      // 清理多餘標籤
      .replace(/<p class="notice-text"><\/p>/g, '')
      .replace(/<p class="notice-text">(<h[1-6].*<\/h[1-6]>)<\/p>/g, '$1')
      .replace(/<p class="notice-text">(<div.*<\/div>)<\/p>/g, '$1')
      .replace(/<p class="notice-text">(<ul.*<\/ul>)<\/p>/gs, '$1')

    return `<div class="notice-content">${html.trim()}</div>`
  }

  /**
   * 清理 HTML 標籤（用於安全性）
   */
  sanitizeHtml(html) {
    // 允許的標籤
    const allowedTags = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'strong', 'em', 'code',
      'ul', 'ol', 'li', 'div', 'span',
      'a'
    ]
    
    // 移除不允許的標籤
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g
    
    return html.replace(tagRegex, (match, tagName) => {
      if (allowedTags.includes(tagName.toLowerCase())) {
        return match
      }
      return ''
    })
  }

  /**
   * 提取純文字內容（用於搜索等）
   */
  extractText(markdown) {
    return markdown
      .replace(/^#{1,6}\s+/gm, '') // 移除標題標記
      .replace(/\*\*(.*?)\*\*/g, '$1') // 移除粗體標記
      .replace(/\*(.*?)\*/g, '$1') // 移除斜體標記
      .replace(/`(.*?)`/g, '$1') // 移除代碼標記
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 移除連結，保留文字
      .replace(/^- /gm, '') // 移除列表標記
      .replace(/\n+/g, ' ') // 換行改為空格
      .trim()
  }

  /**
   * 檢查 Markdown 內容的複雜度
   */
  analyzeContent(markdown) {
    if (!markdown) {
      return {
        wordCount: 0,
        lineCount: 0,
        hasImages: false,
        hasLinks: false,
        hasLists: false,
        hasHeaders: false,
        complexity: 'empty'
      }
    }

    const lines = markdown.split('\n')
    const words = this.extractText(markdown).split(/\s+/).filter(w => w.length > 0)
    
    const analysis = {
      wordCount: words.length,
      lineCount: lines.length,
      hasImages: /!\[.*?\]\(.*?\)/.test(markdown),
      hasLinks: /\[.*?\]\(.*?\)/.test(markdown),
      hasLists: /^[-*+]\s/.test(markdown),
      hasHeaders: /^#{1,6}\s/.test(markdown),
      hasEmoji: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(markdown)
    }

    // 判斷複雜度
    if (analysis.wordCount === 0) {
      analysis.complexity = 'empty'
    } else if (analysis.wordCount < 20) {
      analysis.complexity = 'simple'
    } else if (analysis.wordCount < 100) {
      analysis.complexity = 'medium'
    } else {
      analysis.complexity = 'complex'
    }

    return analysis
  }

  /**
   * 格式化顯示用的提醒內容統計
   */
  getContentStats(markdown) {
    const analysis = this.analyzeContent(markdown)
    
    const features = []
    if (analysis.hasHeaders) features.push('標題')
    if (analysis.hasLists) features.push('列表')
    if (analysis.hasLinks) features.push('連結')
    if (analysis.hasEmoji) features.push('表情符號')
    
    return {
      ...analysis,
      featuresText: features.length > 0 ? features.join('、') : '純文字',
      summary: `${analysis.wordCount} 字，${analysis.lineCount} 行`
    }
  }
}

export default new MarkdownService()