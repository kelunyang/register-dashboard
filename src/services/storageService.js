// ========================================
// 本地存儲服務 - 管理 UI 設定和報到狀態
// ========================================

class StorageService {
  constructor() {
    this.STORAGE_KEYS = {
      UI_SETTINGS: 'checkin_ui_settings',
      CHECKIN_HISTORY: 'checkin_history',
      SELECTED_SHEET: 'selected_sheet_id',
      FILTER_TYPE: 'selected_filter_type'
    }
    
    console.log('💾 StorageService 初始化')
  }

  /**
   * 生成學生報到狀態的 hash
   */
  generateStudentHash(student, sheetId) {
    const data = `${sheetId}_${student.idNumber}_${student.checkinTime || ''}`
    return this.simpleHash(data)
  }

  /**
   * 簡單 hash 函數
   */
  simpleHash(str) {
    let hash = 0
    if (str.length === 0) return hash
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString(36)
  }

  /**
   * 保存已報到學生的 hash 記錄
   */
  saveCheckinHistory(students, sheetId) {
    try {
      const checkedInStudents = students.filter(s => s.checkedIn)
      const history = this.getCheckinHistory()
      
      if (!history[sheetId]) {
        history[sheetId] = {}
      }

      checkedInStudents.forEach(student => {
        const hash = this.generateStudentHash(student, sheetId)
        history[sheetId][student.idNumber] = {
          hash: hash,
          checkinTime: student.checkinTime,
          name: student.name,
          timestamp: Date.now()
        }
      })

      localStorage.setItem(this.STORAGE_KEYS.CHECKIN_HISTORY, JSON.stringify(history))
      console.log(`💾 已保存 ${checkedInStudents.length} 位學生的報到記錄 (表單: ${sheetId})`)
      
      return true
    } catch (error) {
      console.error('保存報到記錄失敗:', error)
      return false
    }
  }

  /**
   * 獲取已報到學生的 hash 記錄
   */
  getCheckinHistory() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.CHECKIN_HISTORY)
      return stored ? JSON.parse(stored) : {}
    } catch (error) {
      console.error('讀取報到記錄失敗:', error)
      return {}
    }
  }

  /**
   * 檢測新報到的學生
   */
  detectNewCheckins(students, sheetId) {
    const history = this.getCheckinHistory()
    const sheetHistory = history[sheetId] || {}
    const newCheckins = []

    students.filter(s => s.checkedIn).forEach(student => {
      const currentHash = this.generateStudentHash(student, sheetId)
      const storedRecord = sheetHistory[student.idNumber]
      
      // 如果沒有記錄或 hash 不同，則為新報到
      if (!storedRecord || storedRecord.hash !== currentHash) {
        newCheckins.push(student)
        console.log(`🎉 檢測到新報到學生: ${student.name} (${student.idNumber})`)
      }
    })

    // 保存更新後的記錄
    if (newCheckins.length > 0) {
      this.saveCheckinHistory(students, sheetId)
    }

    return newCheckins
  }

  /**
   * 保存 UI 設定
   */
  saveUISettings(settings) {
    try {
      const currentSettings = this.getUISettings()
      const updatedSettings = { ...currentSettings, ...settings }
      
      localStorage.setItem(this.STORAGE_KEYS.UI_SETTINGS, JSON.stringify(updatedSettings))
      console.log('💾 UI設定已保存:', settings)
      return true
    } catch (error) {
      console.error('保存UI設定失敗:', error)
      return false
    }
  }

  /**
   * 獲取 UI 設定
   */
  getUISettings() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.UI_SETTINGS)
      const defaultSettings = {
        refreshInterval: 30,
        flowChartInterval: 10,
        selectedSheetId: null,
        filterType: 'all',
        tablePageSize: 4,
        autoRefreshEnabled: true,
        theme: 'dark'
      }
      
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings
    } catch (error) {
      console.error('讀取UI設定失敗:', error)
      return this.getDefaultUISettings()
    }
  }

  /**
   * 獲取預設 UI 設定
   */
  getDefaultUISettings() {
    return {
      refreshInterval: 30,
      flowChartInterval: 10,
      selectedSheetId: null,
      filterType: 'all',
      tablePageSize: 4,
      autoRefreshEnabled: true,
      theme: 'dark'
    }
  }

  /**
   * 保存選中的表單 ID
   */
  saveSelectedSheet(sheetId) {
    try {
      localStorage.setItem(this.STORAGE_KEYS.SELECTED_SHEET, sheetId)
      this.saveUISettings({ selectedSheetId: sheetId })
      console.log(`💾 已保存選中的表單: ${sheetId}`)
      return true
    } catch (error) {
      console.error('保存選中表單失敗:', error)
      return false
    }
  }

  /**
   * 獲取選中的表單 ID
   */
  getSelectedSheet() {
    try {
      return localStorage.getItem(this.STORAGE_KEYS.SELECTED_SHEET) || this.getUISettings().selectedSheetId
    } catch (error) {
      console.error('讀取選中表單失敗:', error)
      return null
    }
  }

  /**
   * 保存篩選類型
   */
  saveFilterType(filterType) {
    try {
      localStorage.setItem(this.STORAGE_KEYS.FILTER_TYPE, filterType)
      this.saveUISettings({ filterType: filterType })
      console.log(`💾 已保存篩選類型: ${filterType}`)
      return true
    } catch (error) {
      console.error('保存篩選類型失敗:', error)
      return false
    }
  }

  /**
   * 獲取篩選類型
   */
  getFilterType() {
    try {
      return localStorage.getItem(this.STORAGE_KEYS.FILTER_TYPE) || this.getUISettings().filterType || 'all'
    } catch (error) {
      console.error('讀取篩選類型失敗:', error)
      return 'all'
    }
  }

  /**
   * 清除所有本地數據
   */
  clearAllData() {
    try {
      Object.values(this.STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key)
      })
      console.log('🗑️ 已清除所有本地數據')
      return true
    } catch (error) {
      console.error('清除本地數據失敗:', error)
      return false
    }
  }

  /**
   * 清除特定表單的報到記錄
   */
  clearSheetCheckinHistory(sheetId) {
    try {
      const history = this.getCheckinHistory()
      if (history[sheetId]) {
        delete history[sheetId]
        localStorage.setItem(this.STORAGE_KEYS.CHECKIN_HISTORY, JSON.stringify(history))
        console.log(`🗑️ 已清除表單 ${sheetId} 的報到記錄`)
      }
      return true
    } catch (error) {
      console.error('清除表單報到記錄失敗:', error)
      return false
    }
  }

  /**
   * 清除 UI 設定
   */
  clearUISettings() {
    try {
      localStorage.removeItem(this.STORAGE_KEYS.UI_SETTINGS)
      localStorage.removeItem(this.STORAGE_KEYS.SELECTED_SHEET)
      localStorage.removeItem(this.STORAGE_KEYS.FILTER_TYPE)
      console.log('🗑️ 已清除UI設定')
      return true
    } catch (error) {
      console.error('清除UI設定失敗:', error)
      return false
    }
  }

  /**
   * 獲取存儲統計信息
   */
  getStorageStats() {
    try {
      const stats = {
        totalSize: 0,
        itemCount: 0,
        sheets: [],
        uiSettings: this.getUISettings()
      }

      Object.values(this.STORAGE_KEYS).forEach(key => {
        const item = localStorage.getItem(key)
        if (item) {
          stats.totalSize += item.length
          stats.itemCount++
        }
      })

      // 統計各表單的報到記錄
      const history = this.getCheckinHistory()
      stats.sheets = Object.keys(history).map(sheetId => ({
        sheetId,
        checkinCount: Object.keys(history[sheetId]).length,
        lastUpdate: Math.max(...Object.values(history[sheetId]).map(r => r.timestamp || 0))
      }))

      return stats
    } catch (error) {
      console.error('獲取存儲統計失敗:', error)
      return { totalSize: 0, itemCount: 0, sheets: [], uiSettings: {} }
    }
  }

  /**
   * 檢查瀏覽器是否支援 localStorage
   */
  isSupported() {
    try {
      const test = '__localStorage_test__'
      localStorage.setItem(test, 'test')
      localStorage.removeItem(test)
      return true
    } catch (error) {
      console.warn('LocalStorage 不支援或被禁用')
      return false
    }
  }

  /**
   * 導出所有數據（用於備份）
   */
  exportData() {
    try {
      const data = {}
      Object.values(this.STORAGE_KEYS).forEach(key => {
        const item = localStorage.getItem(key)
        if (item) {
          data[key] = JSON.parse(item)
        }
      })
      return {
        success: true,
        data: data,
        exportTime: new Date().toISOString()
      }
    } catch (error) {
      console.error('導出數據失敗:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 導入數據（用於恢復）
   */
  importData(importData) {
    try {
      if (!importData.data) {
        throw new Error('無效的導入數據')
      }

      Object.entries(importData.data).forEach(([key, value]) => {
        if (Object.values(this.STORAGE_KEYS).includes(key)) {
          localStorage.setItem(key, JSON.stringify(value))
        }
      })

      console.log('📥 數據導入成功')
      return { success: true }
    } catch (error) {
      console.error('導入數據失敗:', error)
      return { success: false, error: error.message }
    }
  }
}

export default new StorageService()