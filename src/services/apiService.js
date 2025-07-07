// ========================================
// API 服務 - Google Apps Script 標準版 (多表單支援) - 智能排序版
// ========================================

class ApiService {
  constructor() {
    // 檢測運行環境
    this.isDevelopment = this.detectEnvironment()
    
    // 自動刷新配置
    this.hasAutoRefresh = false
    this.autoRefreshConfig = null
    
    console.log('🔗 API Service 初始化:', {
      isDevelopment: this.isDevelopment,
      hasGoogleScript: typeof google !== 'undefined' && google.script
    })
    
    // 初始化自動刷新配置（異步進行，不阻塞其他初始化）
    this.autoRefreshInitialized = false
    this.initializeAutoRefresh().then(() => {
      this.autoRefreshInitialized = true
      console.log('🔄 自動刷新配置初始化完成')
    })
  }

  /**
   * 檢測運行環境
   */
  detectEnvironment() {
    const currentUrl = window.location.href
    
    const isLocalDev = 
      currentUrl.includes('localhost') || 
      currentUrl.includes('127.0.0.1') ||
      currentUrl.includes(':3000') ||
      currentUrl.includes(':5173') ||
      currentUrl.includes(':8080') ||
      currentUrl.includes('vite')
    
    if (isLocalDev) {
      console.log('🔧 檢測到本地開發環境')
      return true
    } else {
      console.log('✅ 檢測到 Google Apps Script 環境')
      return false
    }
  }

  /**
   * 初始化自動刷新配置
   */
  async initializeAutoRefresh() {
    try {
      console.log('🔄 初始化自動刷新配置')
      
      // 從 localStorage 讀取 autoRefresh 設定
      const savedGem = localStorage.getItem('autoRefreshGem')
      
      if (savedGem) {
        // 向後端驗證儲存的密鑰
        const validationResult = await this.validateAutoRefreshGem(savedGem)
        
        if (validationResult.success && validationResult.enabled) {
          console.log(`✅ 自動刷新配置載入成功，間隔: ${validationResult.refreshInterval}秒`)
          this.hasAutoRefresh = true
          this.autoRefreshConfig = validationResult
        } else {
          console.log(`⚠️ 儲存的 autoRefresh 密鑰無效，已清除`)
          localStorage.removeItem('autoRefreshGem')
          this.hasAutoRefresh = false
        }
      } else {
        console.log('⚠️ 未設定 autoRefresh 密鑰')
        this.hasAutoRefresh = false
      }
      
    } catch (error) {
      console.error('❌ 初始化自動刷新配置失敗:', error)
      this.hasAutoRefresh = false
    }
  }

  /**
   * 驗證自動刷新密鑰
   */
  async validateAutoRefreshGem(gem) {
    if (this.isDevelopment) {
      // 開發環境：模擬後端驗證邏輯
      console.log('🔧 開發環境：模擬自動刷新密鑰驗證')
      return {
        success: true,
        enabled: !!gem, // 只要有提供密鑰就啟用
        message: gem ? '開發環境驗證通過' : '開發環境未提供密鑰',
        refreshInterval: 30
      }
    }

    console.log('🔄 向 Google Apps Script 驗證自動刷新密鑰')
    
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((data) => {
          console.log('📦 收到自動刷新驗證結果:', data)
          resolve(data)
        })
        .withFailureHandler((error) => {
          console.error('❌ 驗證自動刷新密鑰失敗:', error)
          reject(new Error(`驗證自動刷新密鑰失敗: ${error.message || error.toString()}`))
        })
        .validateAutoRefreshGem(gem)
    })
  }

  /**
   * 設定自動刷新密鑰
   */
  async setAutoRefreshGem(gem) {
    if (!gem || !gem.trim()) {
      // 清除設定
      localStorage.removeItem('autoRefreshGem')
      this.hasAutoRefresh = false
      this.autoRefreshConfig = null
      console.log('🔄 已清除自動刷新設定')
      return { success: true, enabled: false, message: '已清除自動刷新設定' }
    }

    try {
      // 向後端驗證密鑰
      const validationResult = await this.validateAutoRefreshGem(gem.trim())
      
      if (validationResult.success && validationResult.enabled) {
        // 儲存到 localStorage
        localStorage.setItem('autoRefreshGem', gem.trim())
        this.hasAutoRefresh = true
        this.autoRefreshConfig = validationResult
        console.log('✅ 自動刷新密鑰設定成功')
      } else {
        this.hasAutoRefresh = false
        this.autoRefreshConfig = null
      }
      
      return validationResult
    } catch (error) {
      console.error('❌ 設定自動刷新密鑰失敗:', error)
      return { success: false, enabled: false, message: error.message }
    }
  }

  /**
   * 獲取刷新間隔
   */
  getRefreshInterval() {
    if (this.autoRefreshConfig && this.autoRefreshConfig.refreshInterval) {
      return this.autoRefreshConfig.refreshInterval
    }
    return 30 // 預設30秒
  }

  /**
   * 獲取所有可用的表單列表 - 智能排序版
   */
  async getAvailableSheets() {
    if (this.isDevelopment) {
      console.log('🔧 使用開發環境 Mock 數據 - 表單列表')
      const mockData = await this.getMockSheetsList()
      // 對 Mock 數據也進行排序
      if (mockData.sheets && mockData.sheets.length > 0) {
        mockData.sheets = this.sortSheetsByPriority(mockData.sheets)
        // 強制使用排序後的第一個作為預設
        mockData.defaultSheetId = mockData.sheets[0].id
        console.log('🎯 Mock 數據排序完成，預設表單:', mockData.sheets[0].name, `(${mockData.defaultSheetId})`)
      }
      return mockData
    }

    console.log('📋 向 Google Apps Script 獲取表單列表')
    
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((data) => {
          console.log('📦 收到原始表單列表:', data)
          
          // 對表單進行智能排序
          if (data.success && data.sheets && data.sheets.length > 0) {
            data.sheets = this.sortSheetsByPriority(data.sheets)
            
            // 強制使用排序後的第一個作為預設（忽略後端的 defaultSheetId）
            data.defaultSheetId = data.sheets[0].id
            
            console.log('🎯 表單已按優先級排序，強制設定預設表單:', data.sheets[0].name, `(${data.defaultSheetId})`)
          }
          
          resolve(data)
        })
        .withFailureHandler((error) => {
          console.error('❌ 獲取表單列表失敗:', error)
          reject(new Error(`獲取表單列表失敗: ${error.message || error.toString()}`))
        })
        .getAvailableSheets()
    })
  }

  /**
   * 智能表單排序算法
   * 排序邏輯：
   * 1. 正在進行中的活動 (active) - 按即將結束順序
   * 2. 即將開始的活動 (pending) - 按即將開始順序  
   * 3. 剛結束的活動 (ended) - 按結束時間倒序
   * 4. 其他狀態活動 - 按狀態和名稱排序
   */
  sortSheetsByPriority(sheets) {
    if (!Array.isArray(sheets) || sheets.length === 0) {
      return sheets
    }

    const currentTime = Date.now()
    
    // 為每個表單計算優先級分數和排序資訊
    const sheetsWithPriority = sheets.map(sheet => {
      const analysis = this.analyzeSheetPriority(sheet, currentTime)
      return {
        ...sheet,
        _priority: analysis.priority,
        _sortKey: analysis.sortKey,
        _timeToEvent: analysis.timeToEvent,
        _priorityReason: analysis.reason
      }
    })

    // 按優先級分數排序
    const sortedSheets = sheetsWithPriority.sort((a, b) => {
      // 優先級分數越高越重要
      if (a._priority !== b._priority) {
        return b._priority - a._priority
      }
      
      // 同優先級按排序鍵排序
      return a._sortKey - b._sortKey
    })

    // 移除臨時屬性並記錄排序結果
    const finalSheets = sortedSheets.map(sheet => {
      const { _priority, _sortKey, _timeToEvent, _priorityReason, ...cleanSheet } = sheet
      return cleanSheet
    })

    // 記錄排序詳情
    console.log('📊 表單排序詳情:')
    sortedSheets.forEach((sheet, index) => {
      const timeInfo = sheet._timeToEvent > 0 
        ? `${Math.round(sheet._timeToEvent / (1000 * 60 * 60))}小時`
        : '已過期'
      console.log(`  ${index + 1}. ${sheet.name} (${sheet.status}) - ${sheet._priorityReason} - ${timeInfo}`)
    })

    return finalSheets
  }

  /**
   * 分析表單優先級
   */
  analyzeSheetPriority(sheet, currentTime) {
    const status = sheet.status
    let priority = 0
    let sortKey = 0
    let timeToEvent = 0
    let reason = '未知狀態'

    // 嘗試從表單資訊中獲取時間資訊
    const timeInfo = this.extractTimeInfo(sheet)
    
    switch (status) {
      case 'active':
        // 正在進行中的活動 - 最高優先級
        priority = 1000
        if (timeInfo.endTime) {
          timeToEvent = timeInfo.endTime - currentTime
          sortKey = timeToEvent // 即將結束的排前面
          reason = timeToEvent > 0 ? '進行中，即將結束' : '進行中，已超時'
        } else {
          sortKey = 0
          reason = '進行中'
        }
        break

      case 'pending':
        // 即將開始的活動 - 次高優先級
        priority = 800
        if (timeInfo.startTime) {
          timeToEvent = timeInfo.startTime - currentTime
          sortKey = Math.abs(timeToEvent) // 即將開始的排前面
          reason = timeToEvent > 0 ? '即將開始' : '應該已開始'
        } else {
          sortKey = 999999999 // 沒有時間資訊的排後面
          reason = '準備中'
        }
        break

      case 'ended':
        // 剛結束的活動 - 中等優先級
        priority = 600
        if (timeInfo.endTime) {
          timeToEvent = currentTime - timeInfo.endTime
          sortKey = timeToEvent // 剛結束的排前面
          reason = '剛結束'
        } else {
          sortKey = 999999999
          reason = '已結束'
        }
        break

      case 'error':
        // 錯誤狀態 - 低優先級但需要注意
        priority = 400
        sortKey = 0
        reason = '系統錯誤'
        break

      default:
        // 其他狀態 - 最低優先級
        priority = 200
        sortKey = sheet.name ? sheet.name.localeCompare('') : 999999999
        reason = '待機中'
        break
    }

    return {
      priority,
      sortKey,
      timeToEvent,
      reason
    }
  }

  /**
   * 從表單資訊中提取時間資訊
   */
  extractTimeInfo(sheet) {
    const timeInfo = {
      startTime: null,
      endTime: null
    }

    // 優先從 currentEvent 獲取時間
    if (sheet.currentEvent) {
      timeInfo.startTime = sheet.currentEvent.startTimestamp
      timeInfo.endTime = sheet.currentEvent.endTimestamp
      return timeInfo
    }

    // 嘗試從表單名稱中解析時間（如果後端沒提供）
    // 這裡可以根據您的表單命名規則進行調整
    if (sheet.name) {
      const timePattern = /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})/
      const match = sheet.name.match(timePattern)
      if (match) {
        const [, year, month, day] = match
        // 假設活動在當天進行，可以根據實際情況調整
        const eventDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        timeInfo.startTime = eventDate.getTime()
        timeInfo.endTime = eventDate.getTime() + (8 * 60 * 60 * 1000) // 假設持續8小時
      }
    }

    return timeInfo
  }

  /**
   * 獲取指定表單的儀表板數據
   */
  async getDashboardData(sheetId = null) {
    if (this.isDevelopment) {
      console.log('🔧 使用開發環境 Mock 數據', sheetId ? `- 表單: ${sheetId}` : '')
      return this.getMockDashboardData(sheetId)
    }

    console.log('🌐 向 Google Apps Script 後端發送請求', sheetId ? `- 表單: ${sheetId}` : '')
    
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((data) => {
          console.log('📦 收到儀表板數據:', data)
          resolve(data)
        })
        .withFailureHandler((error) => {
          console.error('❌ 獲取儀表板數據失敗:', error)
          reject(new Error(`獲取儀表板數據失敗: ${error.message || error.toString()}`))
        })
        .getDashboardData(sheetId)
    })
  }

  /**
   * 獲取配置詳情 - 新增功能
   */
  async getConfigDetails(sheetId) {
    if (this.isDevelopment) {
      console.log('🔧 使用開發環境 Mock 配置詳情')
      return this.getMockConfigDetails(sheetId)
    }

    console.log(`📋 向 Google Apps Script 獲取配置詳情 - 表單: ${sheetId}`)
    
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((data) => {
          console.log('📦 收到配置詳情:', data)
          resolve(data)
        })
        .withFailureHandler((error) => {
          console.error('❌ 獲取配置詳情失敗:', error)
          reject(new Error(`獲取配置詳情失敗: ${error.message || error.toString()}`))
        })
        .getConfigDetails(sheetId)
    })
  }

  /**
   * 獲取活動狀態
   */
  async getActivityStatus(sheetId = null) {
    if (this.isDevelopment) {
      console.log('🔧 使用開發環境 Mock 數據')
      const mockData = await this.getMockDashboardData(sheetId)
      return mockData.activityStatus
    }

    console.log('🎯 向 Google Apps Script 獲取活動狀態')
    
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((data) => {
          console.log('📦 收到活動狀態數據:', data)
          resolve(data)
        })
        .withFailureHandler((error) => {
          console.error('❌ 獲取活動狀態失敗:', error)
          reject(new Error(`獲取活動狀態失敗: ${error.message || error.toString()}`))
        })
        .getActivityStatus(sheetId)
    })
  }

  /**
   * 獲取學生數據
   */
  async getStudentsData(sheetId = null) {
    if (this.isDevelopment) {
      console.log('🔧 使用開發環境 Mock 數據')
      const mockData = await this.getMockDashboardData(sheetId)
      return { data: mockData.students, headers: Object.keys(mockData.students[0] || {}) }
    }

    console.log('👥 向 Google Apps Script 獲取學生數據')
    
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((data) => {
          console.log('📦 收到學生數據:', data)
          resolve(data)
        })
        .withFailureHandler((error) => {
          console.error('❌ 獲取學生數據失敗:', error)
          reject(new Error(`獲取學生數據失敗: ${error.message || error.toString()}`))
        })
        .getStudentsData(sheetId)
    })
  }

  /**
   * 獲取報到狀態
   */
  async getCheckinStatus(sheetId = null) {
    if (this.isDevelopment) {
      console.log('🔧 使用開發環境 Mock 數據')
      const mockData = await this.getMockDashboardData(sheetId)
      return { data: mockData.checkinLog, headers: ['Timestamp', 'Account', '身分證統一編號'] }
    }

    console.log('✅ 向 Google Apps Script 獲取報到狀態')
    
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((data) => {
          console.log('📦 收到報到狀態數據:', data)
          resolve(data)
        })
        .withFailureHandler((error) => {
          console.error('❌ 獲取報到狀態失敗:', error)
          reject(new Error(`獲取報到狀態失敗: ${error.message || error.toString()}`))
        })
        .getCheckinStatus(sheetId)
    })
  }

  /**
   * 測試與後端的連接
   */
  async testConnection() {
    if (this.isDevelopment) {
      return { 
        success: true, 
        message: '開發環境 Mock 模式',
        environment: 'development'
      }
    }

    console.log('🔍 測試 Google Apps Script 連接')
    
    return new Promise((resolve) => {
      google.script.run
        .withSuccessHandler((data) => {
          console.log('✅ 連接測試成功:', data)
          resolve({ 
            success: true, 
            message: '連接成功', 
            data,
            environment: 'production'
          })
        })
        .withFailureHandler((error) => {
          console.error('❌ 連接測試失敗:', error)
          resolve({ 
            success: false, 
            message: error.message || error.toString(),
            environment: 'production'
          })
        })
        .testConnection()
    })
  }

  /**
   * 開發環境模擬表單列表 - 增強時間資訊
   */
  getMockSheetsList() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const now = Date.now()
        const oneHour = 60 * 60 * 1000
        
        resolve({
          success: true,
          sheets: [
            {
              id: 'sheet1',
              name: '[2024]資訊科報到活動',
              status: 'active',
              welcomeMD: this.getMockNoticeMarkdown('sheet1'),
              noticeMD: this.getMockNoticeMarkdown('sheet1'),
              currentEvent: {
                title: '[2024]資訊科報到活動',
                startTimestamp: now - 2 * oneHour, // 2小時前開始
                endTimestamp: now + 1 * oneHour,   // 1小時後結束
                isValid: true
              }
            },
            {
              id: 'sheet2', 
              name: '[2024]電機科報到活動',
              status: 'pending',
              welcomeMD: this.getMockNoticeMarkdown('sheet2'),
              noticeMD: this.getMockNoticeMarkdown('sheet2'),
              currentEvent: {
                title: '[2024]電機科報到活動',
                startTimestamp: now + 3 * oneHour,  // 3小時後開始
                endTimestamp: now + 8 * oneHour,    // 8小時後結束
                isValid: true
              }
            },
            {
              id: 'sheet3',
              name: '[2024]機械科報到活動', 
              status: 'ended',
              welcomeMD: this.getMockNoticeMarkdown('sheet3'),
              noticeMD: this.getMockNoticeMarkdown('sheet3'),
              currentEvent: {
                title: '[2024]機械科報到活動',
                startTimestamp: now - 24 * oneHour,    // 1天前開始
                endTimestamp: now - 2 * oneHour,       // 2小時前結束
                isValid: true
              }
            },
            {
              id: 'sheet4',
              name: '[2024]建築科報到活動',
              status: 'pending',
              welcomeMD: this.getMockNoticeMarkdown('sheet4'),
              noticeMD: this.getMockNoticeMarkdown('sheet4'),
              currentEvent: {
                title: '[2024]建築科報到活動',
                startTimestamp: now + 30 * 60 * 1000, // 30分鐘後開始
                endTimestamp: now + 5 * oneHour,       // 5小時後結束
                isValid: true
              }
            },
            {
              id: 'sheet5',
              name: '[2024]化工科報到活動',
              status: 'active',
              welcomeMD: this.getMockNoticeMarkdown('sheet5'),
              noticeMD: this.getMockNoticeMarkdown('sheet5'),
              currentEvent: {
                title: '[2024]化工科報到活動',
                startTimestamp: now - oneHour,     // 1小時前開始
                endTimestamp: now + 4 * oneHour,   // 4小時後結束
                isValid: true
              }
            }
          ],
          defaultSheetId: null // 讓排序算法決定預設表單
        })
      }, 300)
    })
  }

  /**
   * 開發環境模擬配置詳情 - 新增
   */
  getMockConfigDetails(sheetId) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          details: {
            sheetInfo: {
              sheetId: sheetId,
              configSheetName: '看板顯示欄位',
              lastUpdated: new Date().toLocaleString('zh-TW')
            },
            
            dataSource: {
              primaryKey: '身分證統一編號',
              studentsCount: 8,
              checkinCount: 6,
              rawDataFields: 12,
              checkinFields: 5
            },
            
            displayConfig: {
              totalFields: 8,
              uidField: '身分證統一編號',
              
              fieldsByBlock: {
                StudentTable: [
                  {
                    '欄位名稱': '姓名',
                    '欄位性質': 'Text',
                    '特殊功能': '',
                    '預處理': '^(.{1}).*(.{1})$ → $1○$2',
                    '備註': '學生姓名，經過脫敏處理'
                  },
                  {
                    '欄位名稱': '性別',
                    '欄位性質': 'Select',
                    '特殊功能': '',
                    '預處理': '',
                    '備註': '學生性別'
                  },
                  {
                    '欄位名稱': '畢業國中名稱',
                    '欄位性質': 'Text',
                    '特殊功能': '',
                    '預處理': '^.*市立(.*)國民中學$ → $1國中',
                    '備註': '畢業學校，簡化顯示'
                  }
                ],
                TypeStatistics: [
                  {
                    '欄位名稱': '學生身分別',
                    '欄位性質': 'Category',
                    '特殊功能': '',
                    '預處理': '',
                    '備註': '用於身分別統計'
                  }
                ],
                SchoolStatistics: [
                  {
                    '欄位名稱': '畢業國中名稱',
                    '欄位性質': 'Text',
                    '特殊功能': '',
                    '預處理': '^.*市立(.*)國民中學$ → $1國中',
                    '備註': '用於學校統計'
                  }
                ],
                Other: [
                  {
                    '欄位名稱': '身分證統一編號',
                    '欄位性質': 'ID',
                    '特殊功能': 'UID',
                    '預處理': '^.{6}(.{4})$ → ******$1',
                    '備註': '系統識別用，部分脫敏顯示'
                  }
                ]
              },
              
              preprocessingRules: [
                {
                  field: '姓名',
                  rule: '^(.{1}).*(.{1})$ → $1○$2',
                  description: '姓名脫敏（只顯示姓氏和名字最後一字，中間用○代替）'
                },
                {
                  field: '身分證統一編號',
                  rule: '^.{6}(.{4})$ → ******$1',
                  description: '身分證號脫敏（只顯示後4碼，前面用******代替）'
                },
                {
                  field: '畢業國中名稱',
                  rule: '^.*市立(.*)國民中學$ → $1國中',
                  description: '學校名稱簡化（移除地區前綴和完整後綴）'
                }
              ],
              
              specialFunctions: [
                {
                  field: '身分證統一編號',
                  function: 'UID',
                  description: '唯一識別碼 - 用於前端顯示和數據關聯'
                }
              ]
            },
            
            warnings: [
              {
                type: 'MULTIPLE_FIELDS_FOR_SINGLE_BLOCK',
                message: 'SchoolStatistics 區塊有重複欄位配置，將只使用第一個',
                severity: 'WARNING'
              }
            ],
            
            systemInfo: {
              version: '4.1.0',
              features: ['配置驅動UI', '動態欄位處理', '預處理規則', 'UID安全機制', '正確數據關聯'],
              timestamp: new Date().toISOString()
            }
          }
        })
      }, 800)
    })
  }

  /**
   * 開發環境模擬數據
   */
  getMockDashboardData(sheetId = 'sheet1') {
    return new Promise((resolve) => {
      setTimeout(() => {
        const now = Date.now()
        const mockCheckinTimes = [
          now - 4 * 60 * 60 * 1000,
          now - 3 * 60 * 60 * 1000,
          now - 2 * 60 * 60 * 1000,
          now - 1 * 60 * 60 * 1000,
          now - 30 * 60 * 1000,
          now - 10 * 60 * 1000
        ]

        // 根據不同表單返回不同的 mock 數據
        const mockDataSets = {
          sheet1: {
            students: [
              {
                '姓名': '黃○璃',
                '性別': '男',
                '身分證統一編號': 'F132949783',
                '出生年': 99,
                '出生月': 6,
                '出生日': 13,
                '學生身分別': '原住民',
                '錄取身分別': '原住民',
                '畢業國中名稱': '新北市立林口國民中學'
              },
              {
                '姓名': '張○恩',
                '性別': '女',
                '身分證統一編號': 'F231716380',
                '出生年': 99,
                '出生月': 4,
                '出生日': 15,
                '學生身分別': '一般生',
                '錄取身分別': '經濟弱勢',
                '畢業國中名稱': '新北市立八里國民中學'
              },
              {
                '姓名': '阮○晧',
                '性別': '男',
                '身分證統一編號': 'H126265509',
                '出生年': 99,
                '出生月': 5,
                '出生日': 24,
                '學生身分別': '身心障礙',
                '錄取身分別': '身心障礙',
                '畢業國中名稱': '新北市立中平國民中學'
              },
              {
                '姓名': '周○謙',
                '性別': '男',
                '身分證統一編號': 'H126696148',
                '出生年': 99,
                '出生月': 3,
                '出生日': 29,
                '學生身分別': '身心障礙',
                '錄取身分別': '身心障礙',
                '畢業國中名稱': '新北市立林口國民中學'
              },
              {
                '姓名': '陳○雯',
                '性別': '女',
                '身分證統一編號': 'A231873170',
                '出生年': 99,
                '出生月': 6,
                '出生日': 15,
                '學生身分別': '原住民',
                '錄取身分別': '原住民',
                '畢業國中名稱': '新北市立林口國民中學'
              },
              {
                '姓名': '張○庭',
                '性別': '女',
                '身分證統一編號': 'H226456897',
                '出生年': 98,
                '出生月': 12,
                '出生日': 15,
                '學生身分別': '原住民',
                '錄取身分別': '原住民',
                '畢業國中名稱': '新北市立崇林國民中學'
              },
              {
                '姓名': '楊○嵐',
                '性別': '女',
                '身分證統一編號': 'F232272270',
                '出生年': 99,
                '出生月': 6,
                '出生日': 5,
                '學生身分別': '原住民',
                '錄取身分別': '經濟弱勢',
                '畢業國中名稱': '新北市立泰山國民中學'
              },
              {
                '姓名': '王○凱',
                '性別': '男',
                '身分證統一編號': 'W100533470',
                '出生年': 98,
                '出生月': 11,
                '出生日': 3,
                '學生身分別': '一般生',
                '錄取身分別': '一般生',
                '畢業國中名稱': '新北市立佳林國民中學'
              }
            ],
            checkinLog: [
              {
                'Timestamp': mockCheckinTimes[0].toString(),
                'Account': '林老師',
                '身分證統一編號': 'F132949783'
              },
              {
                'Timestamp': mockCheckinTimes[1].toString(),
                'Account': '王老師',
                '身分證統一編號': 'A231873170'
              },
              {
                'Timestamp': mockCheckinTimes[2].toString(),
                'Account': '李老師',
                '身分證統一編號': 'H226456897'
              },
              {
                'Timestamp': mockCheckinTimes[3].toString(),
                'Account': '張老師',
                '身分證統一編號': 'F232272270'
              },
              {
                'Timestamp': mockCheckinTimes[4].toString(),
                'Account': '陳老師',
                '身分證統一編號': 'H126265509'
              },
              {
                'Timestamp': mockCheckinTimes[5].toString(),
                'Account': '劉老師',
                '身分證統一編號': 'W100533470'
              }
            ]
          },
          sheet2: {
            students: [
              {
                '姓名': '李○明',
                '性別': '男',
                '身分證統一編號': 'A123456789',
                '出生年': 99,
                '出生月': 3,
                '出生日': 15,
                '學生身分別': '一般生',
                '錄取身分別': '一般生',
                '畢業國中名稱': '新北市立永和國民中學'
              },
              {
                '姓名': '王○美',
                '性別': '女',
                '身分證統一編號': 'B234567890',
                '出生年': 99,
                '出生月': 7,
                '出生日': 22,
                '學生身分別': '原住民',
                '錄取身分別': '原住民',
                '畢業國中名稱': '新北市立板橋國民中學'
              }
            ],
            checkinLog: []
          },
          sheet3: {
            students: [
              {
                '姓名': '劉○華',
                '性別': '男',
                '身分證統一編號': 'C345678901',
                '出生年': 98,
                '出生月': 12,
                '出生日': 8,
                '學生身分別': '身心障礙',
                '錄取身分別': '身心障礙',
                '畢業國中名稱': '新北市立中和國民中學'
              }
            ],
            checkinLog: [
              {
                'Timestamp': (now - 5 * 60 * 60 * 1000).toString(),
                'Account': '系統管理員',
                '身分證統一編號': 'C345678901'
              }
            ]
          },
          sheet4: {
            students: [
              {
                '姓名': '吳○峰',
                '性別': '男',
                '身分證統一編號': 'D456789012',
                '出生年': 99,
                '出生月': 1,
                '出生日': 20,
                '學生身分別': '一般生',
                '錄取身分別': '一般生',
                '畢業國中名稱': '新北市立新莊國民中學'
              }
            ],
            checkinLog: []
          },
          sheet5: {
            students: [
              {
                '姓名': '林○雅',
                '性別': '女',
                '身分證統一編號': 'E567890123',
                '出生年': 99,
                '出生月': 8,
                '出生日': 12,
                '學生身分別': '經濟弱勢',
                '錄取身分別': '經濟弱勢',
                '畢業國中名稱': '新北市立三重國民中學'
              }
            ],
            checkinLog: [
              {
                'Timestamp': mockCheckinTimes[0].toString(),
                'Account': '化工科老師',
                '身分證統一編號': 'E567890123'
              }
            ]
          }
        }

        const selectedData = mockDataSets[sheetId] || mockDataSets.sheet1
        
        // 根據表單 ID 決定活動狀態
        const statusMap = {
          sheet1: 'active',    // 資訊科 - 進行中
          sheet2: 'pending',   // 電機科 - 準備中  
          sheet3: 'ended',     // 機械科 - 已結束
          sheet4: 'pending',   // 建築科 - 準備中
          sheet5: 'active'     // 化工科 - 進行中
        }

        const currentStatus = statusMap[sheetId] || 'active'
        
        // 根據狀態生成時間戳
        let startTimestamp, endTimestamp
        const oneHour = 60 * 60 * 1000
        
        switch (currentStatus) {
          case 'active':
            if (sheetId === 'sheet1') {
              startTimestamp = now - 2 * oneHour
              endTimestamp = now + 1 * oneHour
            } else { // sheet5
              startTimestamp = now - oneHour
              endTimestamp = now + 4 * oneHour
            }
            break
          case 'pending':
            if (sheetId === 'sheet4') {
              startTimestamp = now + 30 * 60 * 1000 // 30分鐘後
              endTimestamp = now + 5 * oneHour
            } else { // sheet2
              startTimestamp = now + 3 * oneHour
              endTimestamp = now + 8 * oneHour
            }
            break
          case 'ended':
            startTimestamp = now - 24 * oneHour
            endTimestamp = now - 2 * oneHour
            break
        }
        
        resolve({
          success: true,
          timestamp: new Date().toISOString(),
          sheetId: sheetId,
          
          activityStatus: {
            success: true,
            status: currentStatus,
            message: this.getStatusMessage(currentStatus),
            currentEvent: {
              title: this.getSheetTitle(sheetId),
              sheetId: sheetId,
              startTimestamp: startTimestamp,
              endTimestamp: endTimestamp,
              isValid: true,
              welcomeMD: this.getMockNoticeMarkdown(sheetId),
              noticeMD: this.getMockNoticeMarkdown(sheetId)
            },
            targetSheetId: sheetId,
            currentTime: now,
            timestamp: new Date().toISOString()
          },
          
          students: selectedData.students,
          checkinLog: selectedData.checkinLog
        })
      }, 800)
    })
  }

  /**
   * 根據狀態獲取訊息
   */
  getStatusMessage(status) {
    const messages = {
      'active': '報到活動進行中',
      'pending': '活動尚未開始',
      'ended': '活動已結束'
    }
    return messages[status] || '狀態未知'
  }

  /**
   * 根據表單 ID 獲取標題
   */
  getSheetTitle(sheetId) {
    const titles = {
      'sheet1': '[2024]資訊科報到活動',
      'sheet2': '[2024]電機科報到活動',
      'sheet3': '[2024]機械科報到活動',
      'sheet4': '[2024]建築科報到活動',
      'sheet5': '[2024]化工科報到活動'
    }
    return titles[sheetId] || '[2024]未知科報到活動'
  }

  /**
   * 獲取模擬的提醒 Markdown 內容
   */
  getMockNoticeMarkdown(sheetId) {
    const noticeTemplates = {
      sheet1: `# 📢 資訊科報到重要提醒

## 報到流程
- **依叫號報到**，準備學生的**身分證**、**畢業證書**和**切結書**到任一櫃檯報到
- 報到完成請**確認本名單更新後再離開**

## 重要注意事項
- 🔔 **經濟弱勢、特殊生無備取**
- 🔄 備取生序號依序備取，備取序號相同，增額錄取
- ⏰ **正取生請在11點前報到**

## 線上觀看提醒
網路觀看者，請手動刷新網頁（預設15分鐘更新，現場30秒更新）`,

      sheet2: `# 📢 電機科報到重要提醒

## 報到須知
- **依序報到**，攜帶完整**證件資料**
- 報到後請**等候確認**

## 特別說明
- 🎯 電機科採用**專業測驗**制度
- 📋 需額外填寫**專業志願表**
- ⚡ **技能檢定**相關文件請備妥

## 系統提醒
線上名單每**10分鐘**更新一次，請耐心等候`,

      sheet3: `# 📢 機械科報到重要提醒

## 報到已結束
- ✅ 本次報到活動已圓滿結束
- 📊 報到率達 **93.3%**

## 後續事項
- 📧 未報到學生將收到**個別通知**
- 📞 如有疑問請聯繫**教務處**
- 📅 補報到時間另行公告

## 感謝參與
感謝所有學生和家長的配合！`,

      sheet4: `# 📢 建築科報到重要提醒

## 即將開始報到
- ⏰ **30分鐘後**開始報到活動
- 📍 地點：**建築科大樓1樓**

## 準備事項
- 📋 攜帶**身分證正本**
- 📜 **畢業證書**或同等學歷證明
- ✍️ **家長同意書**（未滿18歲）

## 注意事項
- 🔔 請**提前10分鐘**到達現場
- 📱 現場將有**QR Code**快速報到`,

      sheet5: `# 📢 化工科報到重要提醒

## 報到進行中
- 🟢 **活動正在進行**，預計持續4小時
- 📊 目前報到率：**20%**

## 實驗室參觀
- 🧪 報到完成後可參觀**化學實驗室**
- 👨‍🔬 專業老師現場**設備介紹**
- 🔬 **安全護具**現場提供

## 特色課程說明
- 💡 **綠色化學**課程介紹
- 🏭 **產業實習**機會說明`
    }

    return noticeTemplates[sheetId] || noticeTemplates.sheet1
  }
}

export default new ApiService()