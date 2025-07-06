// ========================================
// 數據處理服務 - 配置驅動版本
// ========================================

class DataProcessor {
  
  /**
   * 處理儀表板數據 - 配置驅動版本
   */
  processDashboardData(rawData, flowConfig = {}, filterType = 'all', previousCheckinLog = []) {
    const { 
      students: rawStudents, 
      checkinLog: rawCheckinLog, 
      displayConfig,
      metadata 
    } = rawData
    
    if (!displayConfig || !Array.isArray(displayConfig)) {
      throw new Error('缺少顯示配置數據')
    }
    
    // 學生數據和checkinLog已經在後端處理過了，包括：
    // 1. 資料融合（checkinLog已包含完整學生資料）
    // 2. 安全處理（idNumber已hash，敏感欄位已遮罩）
    // 3. UID統一（都使用相同的idNumber識別）
    const processedStudents = rawStudents || []
    let processedCheckinLog = rawCheckinLog || []
    
    // 標記新記錄
    if (previousCheckinLog.length > 0) {
      const previousIdNumbers = new Set(previousCheckinLog.map(record => record.idNumber))
      
      processedCheckinLog = processedCheckinLog.map(record => ({
        ...record,
        isNewRecord: !previousIdNumbers.has(record.idNumber)
      }))
      
      // 排序：將新記錄排在前面
      processedCheckinLog.sort((a, b) => {
        if (a.isNewRecord && !b.isNewRecord) return -1
        if (!a.isNewRecord && b.isNewRecord) return 1
        // 如果都是新記錄或都不是新記錄，按時間戳排序（最新的在前）
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
      })
      
      const newRecordsCount = processedCheckinLog.filter(r => r.isNewRecord).length
      if (newRecordsCount > 0) {
        console.log(`📝 標記了 ${newRecordsCount} 條新記錄`)
      }
    } else {
      // 如果沒有之前的記錄，所有記錄都標記為非新記錄
      processedCheckinLog = processedCheckinLog.map(record => ({
        ...record,
        isNewRecord: false
      }))
    }
    
    // 計算統計數據
    console.dir(processedStudents);
    console.dir(processedCheckinLog);
    const statistics = this.calculateStatistics(
      processedStudents, 
      processedCheckinLog, 
      displayConfig,
      flowConfig, 
      filterType
    )
    
    return {
      students: processedStudents,
      checkinLog: processedCheckinLog,
      statistics: statistics,
      displayConfig: displayConfig,
      timestamp: rawData.timestamp,
      totalStudents: processedStudents.length,
      metadata: metadata
    }
  }

  /**
   * 處理checkinLog（已廢棄）
   * 注意：此方法已不再使用，因為後端已經完成所有必要的處理：
   * 1. rawCheckinLog已經融合了學生資料
   * 2. idNumber已經統一且經過安全處理
   * 3. 敏感欄位已經遮罩保護
   * 
   * @deprecated 後端已處理完成，前端直接使用rawCheckinLog即可
   */
  processCheckinLog(rawCheckinLog, rawStudents) {
    console.warn('⚠️ processCheckinLog已廢棄，後端已處理完成，直接使用rawCheckinLog')
    return rawCheckinLog || []
  }

  /**
   * 計算統計數據 - 配置驅動版本
   */
  calculateStatistics(students, checkinLog, displayConfig, flowConfig = {}, filterType = 'all') {
    // 根據配置獲取統計維度
    const typeStatsConfig = this.getConfigForBlock(displayConfig, 'TypeStatistics')
    
    // 如果有篩選類型，先篩選學生
    const filteredStudents = filterType === 'all' ? students : 
      students.filter(s => this.getStudentTypeValue(s, typeStatsConfig) === filterType)
    
    const total = filteredStudents.length
    const checkedIn = filteredStudents.filter(s => s.checkedIn).length
    
    const statistics = {
      // 基本統計（根據篩選結果）
      total: total,
      checkedIn: checkedIn,
      uncheckedIn: total - checkedIn,
      checkinRate: total > 0 ? (checkedIn / total * 100).toFixed(1) : 0,
      
      // 篩選信息
      filterType: filterType,
      isFiltered: filterType !== 'all',
      
      // 全局統計（不受篩選影響）
      globalStats: {
        total: students.length,
        checkedIn: students.filter(s => s.checkedIn).length,
        uncheckedIn: students.length - students.filter(s => s.checkedIn).length,
        checkinRate: students.length > 0 ? 
          (students.filter(s => s.checkedIn).length / students.length * 100).toFixed(1) : 0
      },
      
      // 配置信息
      displayConfig: {
        hasTypeStats: !!typeStatsConfig,
        typeStatsField: typeStatsConfig?.欄位名稱
      }
    }
    
    // 動態生成統計（基於配置）
    // 支援多個 TypeStatistics 配置
    const allTypeStatsConfigs = this.getAllConfigsForBlock(displayConfig, 'TypeStatistics')
    if (allTypeStatsConfigs.length > 0) {
      // 保持向後相容性，第一個配置仍使用 typeStats
      statistics.typeStats = this.calculateCategoryStats(
        students, 
        allTypeStatsConfigs[0].欄位名稱, 
        allTypeStatsConfigs[0].統計名稱 || '身分別統計'
      )
      
      // 為額外的配置創建新的統計字段
      allTypeStatsConfigs.forEach((config, index) => {
        const key = index === 0 ? 'typeStats' : `typeStats${index}`
        statistics[key] = this.calculateCategoryStats(
          students, 
          config.欄位名稱, 
          config.統計名稱 || `統計${index + 1}`
        )
        // 添加配置元數據
        statistics[`${key}Config`] = {
          fieldName: config.欄位名稱,
          title: config.統計名稱 || `統計${index + 1}`,
          index: index
        }
      })
    }
    
    // 按性別統計（如果有配置性別欄位）
    const genderConfig = this.getConfigForField(displayConfig, '性別')
    if (genderConfig) {
      statistics.genderStats = this.calculateCategoryStats(
        filteredStudents, 
        genderConfig.欄位名稱, 
        '性別統計'
      )
    }
    
    // 流量統計
    statistics.flowStats = this.calculateFlowStats(checkinLog, flowConfig)
    
    return statistics
  }

  /**
   * 獲取指定顯示區塊的配置
   */
  getConfigForBlock(displayConfig, blockName) {
    const configs = displayConfig.filter(config => 
      config.顯示區塊 && config.顯示區塊.includes(blockName)
    )
    
    // 只返回第一個配置（因為這些區塊只支援單一欄位）
    return configs.length > 0 ? configs[0] : null
  }

  /**
   * 獲取指定區塊的所有配置（支援多個配置）
   */
  getAllConfigsForBlock(displayConfig, blockName) {
    return displayConfig.filter(config => 
      config.顯示區塊 && config.顯示區塊.includes(blockName)
    )
  }

  /**
   * 獲取指定欄位名稱的配置
   */
  getConfigForField(displayConfig, fieldName) {
    return displayConfig.find(config => 
      config.欄位名稱 === fieldName || 
      config.欄位名稱.includes(fieldName)
    )
  }

  /**
   * 獲取學生的類型值
   */
  getStudentTypeValue(student, typeStatsConfig) {
    if (!typeStatsConfig) return null
    return student[typeStatsConfig.欄位名稱] || '未分類'
  }

  /**
   * 通用分類統計計算
   */
  calculateCategoryStats(students, fieldName, categoryLabel = '分類統計') {
    if (!fieldName || students.length === 0) {
      return []
    }
    
    const categoryMap = new Map()
    
    students.forEach(student => {
      const categoryValue = student[fieldName] || '未分類'
      
      if (!categoryMap.has(categoryValue)) {
        categoryMap.set(categoryValue, { total: 0, checkedIn: 0 })
      }
      
      const stats = categoryMap.get(categoryValue)
      stats.total++
      if (student.checkedIn) {
        stats.checkedIn++
      }
    })
    
    const result = Array.from(categoryMap.entries()).map(([category, data]) => ({
      name: category,
      total: data.total,
      checkedIn: data.checkedIn,
      rate: data.total > 0 ? (data.checkedIn / data.total * 100).toFixed(1) : 0,
      color: this.getCategoryColor(category, data.checkedIn, data.total)
    })).sort((a, b) => b.total - a.total) // 按總人數排序
    
    console.log(`📊 ${categoryLabel} (${fieldName}): ${result.length} 個分類`)
    return result
  }

  /**
   * 根據分類和進度獲取顏色
   */
  getCategoryColor(category, checkedIn, total) {
    const rate = total > 0 ? (checkedIn / total) * 100 : 0
    
    if (rate >= 90) return '#67C23A' // 綠色 - 接近完成
    if (rate >= 70) return '#E6A23C' // 橙色 - 大部分完成
    if (rate >= 50) return '#409EFF' // 藍色 - 過半完成
    if (rate >= 30) return '#F56C6C' // 紅色 - 剛開始
    return '#909399' // 灰色 - 很少或無進度
  }

  /**
   * 計算流量統計 - 修改版本（使用後端時間戳）
   */
  calculateFlowStats(checkinLog, config = {}) {
    const {
      interval = 10, // 預設10分鐘間隔
      maxDataPoints = 20,
      timeFormat = 'HH:mm'
    } = config

    // 過濾出有有效時間戳的報到記錄
    const validCheckins = checkinLog.filter(record => 
      record.Timestamp && !isNaN(new Date(record.Timestamp).getTime())
    );

    if (validCheckins.length === 0) {
      console.log('📊 沒有有效的報到時間戳數據');
      return [];
    }

    // 獲取時間範圍
    const timestamps = validCheckins
      .map(record => new Date(record.Timestamp).getTime())
      .filter(t => t && !isNaN(t))
      .sort((a, b) => a - b);

    if (timestamps.length === 0) {
      console.log('📊 沒有有效的時間戳數據');
      return [];
    }

    const firstTime = timestamps[0];
    const lastTime = timestamps[timestamps.length - 1];
    const currentTime = Date.now();
    
    // 擴展時間範圍到當前時間（如果當前時間較晚）
    const endTime = Math.max(lastTime, currentTime);
    
    console.log(`📅 流量統計時間範圍: ${new Date(firstTime).toLocaleString('zh-TW')} ~ ${new Date(endTime).toLocaleString('zh-TW')}`);
    console.log(`📊 處理 ${timestamps.length} 筆報到記錄`);

    // 生成時間桶
    const timeSlots = this.generateTimeSlots(new Date(endTime), interval, maxDataPoints, firstTime);
    const flowMap = new Map();
    
    // 初始化所有時間桶為0
    timeSlots.forEach(slot => {
      flowMap.set(slot.key, {
        timestamp: slot.timestamp,
        timeLabel: slot.label,
        count: 0,
        startTime: slot.startTime,
        endTime: slot.endTime
      });
    });
    
    // 統計每個時間桶的報到數量
    timestamps.forEach(timestamp => {
      for (const [key, slot] of flowMap.entries()) {
        if (timestamp >= slot.startTime && timestamp < slot.endTime) {
          slot.count++;
          break;
        }
      }
    });
    
    // 轉換為數組並排序
    const flowData = Array.from(flowMap.values())
      .sort((a, b) => a.Timestamp - b.Timestamp)
      .slice(-maxDataPoints); // 只保留最近的數據點
    
    console.log(`📈 生成 ${flowData.length} 個流量數據點，最高流量: ${Math.max(...flowData.map(d => d.count))}`);
    
    return flowData;
  }

  /**
   * 搜索和過濾學生數據 - 配置驅動版本
   */
  filterStudents(students, filters, displayConfig) {
    let filtered = [...students]
    
    // 根據配置獲取可篩選的欄位
    const studentTableConfigs = displayConfig.filter(config => 
      config.顯示區塊 && config.顯示區塊.includes('StudentTable')
    )
    
    // 按姓名搜索（假設第一個 Text 欄位是姓名）
    if (filters.name) {
      const nameConfig = studentTableConfigs.find(config => 
        config.欄位性質 === 'Text'
      )
      
      if (nameConfig) {
        const searchTerm = filters.name.toLowerCase()
        filtered = filtered.filter(student => 
          (student[nameConfig.欄位名稱] || '').toLowerCase().includes(searchTerm)
        )
      }
    }
    
    // 按報到狀態過濾
    if (filters.status && filters.status !== 'all') {
      const checkedIn = filters.status === 'checkedIn'
      filtered = filtered.filter(student => student.checkedIn === checkedIn)
    }
    
    // 按分類過濾（使用配置的分類欄位）
    if (filters.category && filters.category !== 'all') {
      const typeStatsConfig = this.getConfigForBlock(displayConfig, 'TypeStatistics')
      if (typeStatsConfig) {
        filtered = filtered.filter(student => 
          student[typeStatsConfig.欄位名稱] === filters.category
        )
      }
    }
    
    return filtered
  }

  /**
   * 根據類型篩選獲取儀表顯示的統計數據
   */
  getMeterStats(statistics, filterType = 'all') {
    if (filterType === 'all') {
      return {
        total: statistics.total,
        checkedIn: statistics.checkedIn,
        uncheckedIn: statistics.uncheckedIn,
        rate: statistics.checkinRate,
        label: '整體報到進度'
      }
    } else {
      // 找到對應類型的統計
      const typeData = statistics.typeStats?.find(t => t.name === filterType)
      if (typeData) {
        return {
          total: typeData.total,
          checkedIn: typeData.checkedIn,
          uncheckedIn: typeData.total - typeData.checkedIn,
          rate: typeData.rate,
          label: `${filterType} 報到進度`
        }
      } else {
        return {
          total: 0,
          checkedIn: 0,
          uncheckedIn: 0,
          rate: 0,
          label: `${filterType} (無數據)`
        }
      }
    }
  }

  /**
   * 獲取 StudentTable 的欄位配置
   */
  getStudentTableConfig(displayConfig) {
    return displayConfig
      .filter(config => 
        config.顯示區塊 && config.顯示區塊.includes('StudentTable')
      )
      .sort((a, b) => {
        // 根據在配置表中的順序排序（如果有 order 欄位的話）
        const orderA = a.order || 0
        const orderB = b.order || 0
        return orderA - orderB
      })
  }

  /**
   * 驗證配置完整性
   */
  validateDisplayConfig(displayConfig) {
    const errors = []
    const warnings = []
    
    // 檢查 UID 配置
    const uidConfigs = displayConfig.filter(config => config.特殊功能 === 'UID')
    if (uidConfigs.length === 0) {
      errors.push('缺少 UID 配置')
    } else if (uidConfigs.length > 1) {
      warnings.push('多個 UID 配置，將使用第一個')
    }
    
    // 檢查顯示區塊
    const hasStudentTable = displayConfig.some(config => 
      config.顯示區塊 && config.顯示區塊.includes('StudentTable')
    )
    
    if (!hasStudentTable) {
      warnings.push('沒有 StudentTable 配置，將無法顯示學生列表')
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  // ========================================
  // 保持原有的輔助函數
  // ========================================
  generateTimeSlots(endTime, intervalMinutes, count, startTime = null) {
    const slots = [];
    const intervalMs = intervalMinutes * 60 * 1000;
    
    // 如果有起始時間，從起始時間開始生成
    let slotStartTime;
    if (startTime) {
      // 對齊到間隔邊界
      const startTimeAligned = Math.floor(startTime / intervalMs) * intervalMs;
      slotStartTime = startTimeAligned;
    } else {
      slotStartTime = endTime.getTime() - (count * intervalMs);
    }
    
    // 生成時間桶直到結束時間
    let currentTime = slotStartTime;
    const endTimeMs = endTime.getTime();
    
    while (currentTime <= endTimeMs && slots.length < count) {
      const slotEnd = currentTime + intervalMs;
      
      // 生成顯示標籤
      const label = this.formatTimeLabel(new Date(currentTime), new Date(slotEnd), intervalMinutes);
      
      slots.push({
        key: `${currentTime}-${slotEnd}`,
        timestamp: currentTime,
        label: label,
        startTime: currentTime,
        endTime: slotEnd
      });
      
      currentTime += intervalMs;
    }
    
    return slots;
  }

  /**
   * 格式化時間標籤
   */
  formatTimeLabel(startTime, endTime, intervalMinutes) {
    const formatTime = (date) => {
      return date.toLocaleTimeString('zh-TW', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
    }
    
    if (intervalMinutes < 60) {
      // 小於1小時，顯示開始時間
      return formatTime(startTime)
    } else {
      // 大於等於1小時，顯示時間範圍
      return `${formatTime(startTime)}-${formatTime(endTime)}`
    }
  }

  /**
   * 解析時間戳
   */
  parseTimestamp(timestamp) {
    try {
      let date
      
      // 如果是數字字符串（Unix 時間戳）
      if (/^\d+$/.test(timestamp)) {
        const num = parseInt(timestamp)
        if (timestamp.length === 13) {
          date = new Date(num) // 毫秒
        } else if (timestamp.length === 10) {
          date = new Date(num * 1000) // 秒
        } else if (timestamp.length > 13) {
          // 可能是特殊格式的時間戳，嘗試轉換
          date = new Date(num)
        } else {
          date = new Date(num * 1000)
        }
      } else {
        // 嘗試直接解析
        date = new Date(timestamp)
      }
      
      if (isNaN(date.getTime())) {
        return null
      }
      
      return date
    } catch (error) {
      console.warn('無法解析時間戳:', timestamp, error)
      return null
    }
  }

  /**
   * 格式化時間
   */
  formatTime(timestamp) {
    try {
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) {
        return '未知時間'
      }
      
      return date.toLocaleString('zh-TW', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      return '未知時間'
    }
  }

  /**
   * 分頁處理
   */
  paginateData(data, page, pageSize) {
    const total = data.length
    const totalPages = Math.ceil(total / pageSize)
    const start = (page - 1) * pageSize
    const end = start + pageSize
    
    return {
      data: data.slice(start, end),
      pagination: {
        current: page,
        pageSize: pageSize,
        total: total,
        totalPages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  }
}

export default new DataProcessor()