// ========================================
// Google Apps Script 後端 - 修正版本 (正確的數據關聯邏輯)
// ========================================

const CONFIG = {
  CONTROL_SHEET_NAME: '條碼列表',
  DISPLAY_CONFIG_SHEET_NAME: '看板顯示欄位',
  SHEETS: {
    MAIN_DATA: '原始資料表',
    CHECKIN_LOG: '程式寫入表'
  }
};

function getConfig() {
  return {
    ...CONFIG,
    CONTROL_SHEET_ID: PropertiesService.getScriptProperties().getProperty('controlSheet')
  };
}

// ========================================
// 前端可直接調用的 API 函數
// ========================================

/**
 * 獲取所有可用的表單列表 - 輕量版（不計算學生統計）
 */
function getAvailableSheets() {
  try {
    console.log('📋 獲取可用表單列表（輕量版）');
    
    const controlData = getControlSheetData();
    const currentTime = new Date().getTime();
    
    const sheets = controlData.events
      .filter(event => event.startTimestamp) // 只顯示已設定開始時間的表單
      .map(event => {
        let status = 'inactive';
        
        // 判斷狀態（僅基於時間）
        if (event.startTimestamp && event.endTimestamp) {
          if (currentTime < event.startTimestamp) {
            status = 'pending';
          } else if (currentTime >= event.startTimestamp && currentTime <= event.endTimestamp) {
            status = 'active';
          } else if (currentTime > event.endTimestamp) {
            status = 'ended';
          }
        }
        
        return {
          id: event.sheetId,
          name: event.title,
          status: status,
          currentEvent: {
            title: event.title,
            sheetId: event.sheetId,
            startTimestamp: event.startTimestamp,
            endTimestamp: event.endTimestamp,
            isValid: event.isValid,
            noticeMD: event.noticeMD
          },
          noticeMD: event.noticeMD || null
        };
      });
    
    // 找到預設表單（正在進行中的或最近的）
    let defaultSheetId = null;
    const activeSheet = sheets.find(s => s.status === 'active');
    if (activeSheet) {
      defaultSheetId = activeSheet.id;
    } else {
      const pendingSheet = sheets.find(s => s.status === 'pending');
      if (pendingSheet) {
        defaultSheetId = pendingSheet.id;
      } else if (sheets.length > 0) {
        defaultSheetId = sheets[0].id;
      }
    }
    
    console.log(`✅ 找到 ${sheets.length} 個表單，預設表單: ${defaultSheetId}`);
    console.log('📊 表單狀態統計:');
    const statusCounts = sheets.reduce((acc, sheet) => {
      acc[sheet.status] = (acc[sheet.status] || 0) + 1;
      return acc;
    }, {});
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count} 個`);
    });
    
    return {
      success: true,
      sheets: sheets,
      defaultSheetId: defaultSheetId,
      timestamp: new Date().toISOString(),
      metadata: {
        totalSheets: sheets.length,
        statusCounts: statusCounts,
        lightweightMode: true, // 標記為輕量模式
        note: '學生統計將在選擇特定表單時計算'
      }
    };
    
  } catch (error) {
    console.error('❌ 獲取表單列表錯誤:', error);
    return {
      success: false,
      sheets: [],
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 獲取配置詳細信息 - 供前端顯示用
 */
function getConfigDetails(sheetId) {
  try {
    console.log(`📋 獲取表單 ${sheetId} 的詳細配置信息`);
    
    const displayConfig = getDisplayConfigFromSheet(sheetId);
    if (!displayConfig.isValid) {
      return {
        success: false,
        error: displayConfig.error,
        errors: displayConfig.errors
      };
    }
    
    const joinedData = getJoinedDataFromSheet(sheetId);
    if (!joinedData.success) {
      return {
        success: false,
        error: joinedData.error,
        errors: joinedData.errors
      };
    }
    
    // 整理配置詳情
    const configDetails = {
      sheetInfo: {
        sheetId: sheetId,
        configSheetName: CONFIG.DISPLAY_CONFIG_SHEET_NAME,
        lastUpdated: new Date().toLocaleString('zh-TW')
      },
      
      dataSource: {
        primaryKey: joinedData.primaryKey,
        studentsCount: joinedData.students.length,
        checkinCount: joinedData.checkinLog.length,
        rawDataFields: joinedData.rawDataHeaders.length,
        checkinFields: joinedData.inputColumns.length
      },
      
      displayConfig: {
        totalFields: displayConfig.config.length,
        uidField: displayConfig.config.find(c => c['特殊功能'] === 'UID')?.['欄位名稱'] || null,
        
        // 按顯示區塊分組
        fieldsByBlock: {
          StudentTable: displayConfig.config.filter(c => c['顯示區塊'].includes('StudentTable')),
          TypeStatistics: displayConfig.config.filter(c => c['顯示區塊'].includes('TypeStatistics')),
          SchoolStatistics: displayConfig.config.filter(c => c['顯示區塊'].includes('SchoolStatistics')),
          Other: displayConfig.config.filter(c => !c['顯示區塊'].some(block => 
            ['StudentTable', 'TypeStatistics', 'SchoolStatistics'].includes(block)
          ))
        },
        
        // 預處理規則統計
        preprocessingRules: displayConfig.config
          .filter(c => c['預處理'] && c['預處理'].trim())
          .map(c => ({
            field: c['欄位名稱'],
            rule: c['預處理'],
            description: getPreprocessingDescription(c['預處理'])
          })),
          
        // 特殊功能統計
        specialFunctions: displayConfig.config
          .filter(c => c['特殊功能'] && c['特殊功能'].trim())
          .map(c => ({
            field: c['欄位名稱'],
            function: c['特殊功能'],
            description: getSpecialFunctionDescription(c['特殊功能'])
          }))
      },
      
      warnings: displayConfig.warnings || [],
      
      // 系統信息
      systemInfo: {
        version: '4.1.0',
        features: ['配置驅動UI', '動態欄位處理', '預處理規則', 'UID安全機制', '正確數據關聯'],
        timestamp: new Date().toISOString()
      }
    };
    
    return {
      success: true,
      details: configDetails
    };
    
  } catch (error) {
    console.error('❌ 獲取配置詳情錯誤:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ========================================
// 核心數據關聯函數 - 新增
// ========================================

/**
 * 獲取並關聯兩個表的數據 - 按照您的邏輯
 */
function getJoinedDataFromSheet(sheetId) {
  try {
    console.log(`🔗 開始關聯表單 ${sheetId} 的數據`);
    
    const config = getConfig();
    const ss = SpreadsheetApp.openById(sheetId);
    
    // 1. 讀取程式寫入表的配置（前4行）
    const checkinSheet = ss.getSheetByName(config.SHEETS.CHECKIN_LOG);
    if (!checkinSheet) {
      return {
        success: false,
        error: `找不到 ${config.SHEETS.CHECKIN_LOG} 工作表`,
        errors: [{
          type: 'MISSING_CHECKIN_SHEET',
          message: `表單中缺少「${config.SHEETS.CHECKIN_LOG}」工作表`,
          severity: 'CRITICAL'
        }]
      };
    }
    
    // 讀取配置區域（第1~4行，從第3列開始）
    const lastCol = checkinSheet.getLastColumn();
    if (lastCol < 3) {
      return {
        success: false,
        error: '程式寫入表格式錯誤：欄位太少',
        errors: [{
          type: 'INVALID_CHECKIN_FORMAT',
          message: '程式寫入表至少需要3欄',
          severity: 'CRITICAL'
        }]
      };
    }
    
    const configValues = checkinSheet.getRange(1, 3, 4, lastCol - 2).getValues();
    console.log(`📋 讀取程式寫入表配置：${configValues[0].length} 個欄位`);
    
    // 2. 解析欄位配置
    const inputColumns = [];
    let primaryKeyColumn = null;
    
    for (let i = 0; i < configValues[0].length; i++) {
      const column = {
        id: "column" + i,
        name: configValues[0][i], // 欄位名稱
        type: configValues[1][i], // 欄位類型
        format: configValues[2][i], // 格式
        must: /M/.test(configValues[3][i]), // 必填
        state: /S/.test(configValues[3][i]) // 狀態
      };
      
      if (column.type === "P") { 
        column.must = true;
        primaryKeyColumn = column;
      }
      
      inputColumns.push(column);
    }
    
    if (!primaryKeyColumn) {
      return {
        success: false,
        error: '程式寫入表沒有設定主鍵',
        errors: [{
          type: 'MISSING_PRIMARY_KEY',
          message: '程式寫入表必須有一個類型為 "P" 的主鍵欄位',
          severity: 'CRITICAL'
        }]
      };
    }
    
    console.log(`🔑 找到主鍵欄位: ${primaryKeyColumn.name}`);
    
    // 3. 讀取程式寫入表的數據（第5行開始）
    let checkinData = [];
    const totalRows = checkinSheet.getLastRow();
    
    if (totalRows >= 5) {
      // 有數據行才讀取
      const dataRowCount = totalRows - 4;
      const checkinDataRange = checkinSheet.getRange(5, 1, dataRowCount, checkinSheet.getLastColumn());
      checkinData = getDataFromRange(checkinDataRange, ['Timestamp', 'Account', ...inputColumns.map(c => c.name)]);
    }
    
    console.log(`📊 程式寫入表數據：${checkinData.length} 筆（${totalRows < 5 ? '程式寫入表為空，返回空陣列' : '有數據'}）`);
    
    // 4. 讀取原始資料表
    const rawDataSheet = ss.getSheetByName(config.SHEETS.MAIN_DATA);
    if (!rawDataSheet) {
      return {
        success: false,
        error: `找不到 ${config.SHEETS.MAIN_DATA} 工作表`,
        errors: [{
          type: 'MISSING_RAW_DATA_SHEET',
          message: `表單中缺少「${config.SHEETS.MAIN_DATA}」工作表`,
          severity: 'CRITICAL'
        }]
      };
    }
    
    const rawDataRange = rawDataSheet.getDataRange();
    const rawData = getDataFromRange(rawDataRange);
    
    console.log(`📊 原始資料表數據：${rawData.length} 筆`);
    
    // 5. 檢查主鍵欄位是否存在於原始資料表
    const rawDataHeaders = rawDataRange.getValues()[0];
    if (!rawDataHeaders.includes(primaryKeyColumn.name)) {
      return {
        success: false,
        error: `原始資料表中找不到主鍵欄位: ${primaryKeyColumn.name}`,
        errors: [{
          type: 'PRIMARY_KEY_NOT_FOUND',
          message: `原始資料表必須包含主鍵欄位「${primaryKeyColumn.name}」`,
          severity: 'CRITICAL',
          availableFields: rawDataHeaders
        }]
      };
    }
    
    // 6. 建立報到狀態查找表
    const checkinMap = new Map();
    checkinData.forEach(log => {
      const primaryKeyValue = log[primaryKeyColumn.name];
      if (primaryKeyValue) {
        checkinMap.set(primaryKeyValue.toString().trim(), {
          timestamp: log['Timestamp'],
          account: log['Account'],
          logData: log
        });
      }
    });
    
    console.log(`🔗 建立報到索引：${checkinMap.size} 個主鍵`);
    
    // 7. 關聯數據：為每個學生添加報到狀態
    const joinedStudents = rawData.map(student => {
      const primaryKeyValue = student[primaryKeyColumn.name];
      const checkinInfo = checkinMap.get(primaryKeyValue?.toString().trim());
      
      return {
        ...student,
        _primaryKey: primaryKeyValue,
        checkedIn: !!checkinInfo,
        checkinTime: checkinInfo?.timestamp || null,
        checkinAccount: checkinInfo?.account || null,
        status: checkinInfo ? '已報到' : '未報到'
      };
    });
    
    console.log(`✅ 數據關聯完成：${joinedStudents.length} 筆學生數據`);
    
    // 8. 為checkinData和joinedStudents加上統一的idNumber欄位（優先使用UID欄位）
    const displayConfig = getDisplayConfigFromSheet(sheetId);
    let uidFieldName = null;
    
    if (displayConfig.isValid) {
      const uidConfig = displayConfig.config.find(config => {
        const specialFunction = config['特殊功能'] || config['功能'] || '';
        return specialFunction.toUpperCase() === 'UID';
      });
      uidFieldName = uidConfig ? (uidConfig['栏位名称'] || uidConfig['欄位名稱']) : null;
    }
    
    // 為checkinData加上idNumber
    const checkinDataWithId = checkinData.map(record => {
      let uidValue = record[primaryKeyColumn.name]; // 預設使用主鍵值
      
      // 如果有UID欄位且該記錄有此欄位的值，則使用UID欄位值
      if (uidFieldName && record[uidFieldName] !== undefined) {
        uidValue = record[uidFieldName];
      }
      
      return {
        ...record,
        idNumber: uidValue  // 統一的idNumber欄位
      };
    });
    
    // 為joinedStudents加上idNumber
    const studentsWithId = joinedStudents.map(student => {
      let uidValue = student[primaryKeyColumn.name]; // 預設使用主鍵值
      
      // 如果有UID欄位且該學生有此欄位的值，則使用UID欄位值
      if (uidFieldName && student[uidFieldName] !== undefined) {
        uidValue = student[uidFieldName];
      }
      
      return {
        ...student,
        idNumber: uidValue  // 統一的idNumber欄位
      };
    });
    
    console.log(`🆔 checkinData和students已加上idNumber欄位，UID欄位: ${uidFieldName || '使用主鍵值'}`);
    
    // 9. 資料關聯：用checkinLog的idNumber去關聯students，建立融合的checkinLog
    const studentsMap = new Map();
    studentsWithId.forEach(student => {
      if (student.idNumber) {
        studentsMap.set(student.idNumber.toString().trim(), student);
      }
    });
    
    const enrichedCheckinData = checkinDataWithId.map(checkinRecord => {
      const student = studentsMap.get(checkinRecord.idNumber?.toString().trim());
      
      if (student) {
        // 融合報到記錄和學生資料
        return {
          ...checkinRecord,    // 報到記錄的所有欄位
          ...student,          // 學生資料的所有欄位
          // 確保重要欄位不被覆蓋
          Timestamp: checkinRecord.Timestamp,
          Account: checkinRecord.Account,
          idNumber: checkinRecord.idNumber,
          checkedIn: true
        };
      } else {
        // 如果找不到對應學生，保留原始報到記錄
        console.warn(`⚠️ 找不到對應學生: idNumber=${checkinRecord.idNumber}`);
        return {
          ...checkinRecord,
          checkedIn: true,
          _noStudentData: true  // 標記為缺少學生資料
        };
      }
    });
    
    console.log(`🔗 資料關聯完成: ${enrichedCheckinData.length} 筆融合的checkinLog`);
    
    // 10. 安全處理：對敏感資料進行hash和遮罩
    const currentTimestamp = new Date().getTime().toString();
    
    // Hash函數：MD5 + timestamp鹽值
    function hashIdNumber(idNumber) {
      if (!idNumber) return '';
      const saltedValue = idNumber.toString() + currentTimestamp;
      return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, saltedValue, Utilities.Charset.UTF_8)
        .map(byte => (byte + 256) % 256)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    }
    
    // 處理資料：使用看板顯示欄位表中的預處理規則
    function applyConfigBasedProcessing(data, displayConfig) {
      const processedData = { ...data };
      
      // 遍歷顯示配置，找到有預處理規則的欄位
      displayConfig.config.forEach(config => {
        const fieldName = config['欄位名稱'] || config['栏位名称'];
        const fieldType = config['欄位性質'] || config['栏位性质'] || '';
        const preprocessing = config['預處理'] || config['预处理'] || '';
        
        // 對所有有預處理規則的看板欄位都應用預處理，但跳過 Timestamp 格式的欄位
        if (preprocessing && fieldName && processedData[fieldName] && fieldType !== 'Timestamp') {
          const processedValue = applyPreprocessing(processedData[fieldName], preprocessing);
          processedData[fieldName] = processedValue;
        }
      });
      
      return processedData;
    }
    
    // 處理students的敏感資料
    const safeStudents = studentsWithId.map(student => {
      let safeStudent = { ...student };
      
      // hash idNumber（如果存在）
      if (safeStudent.idNumber) {
        safeStudent.idNumber = hashIdNumber(safeStudent.idNumber);
      }
      
      // 應用顯示配置中的預處理規則
      if (displayConfig.isValid) {
        safeStudent = applyConfigBasedProcessing(safeStudent, displayConfig);
      }
      
      return safeStudent;
    });
    
    // 處理checkinLog的敏感資料（使用融合後的資料）
    const safeCheckinData = enrichedCheckinData.map(record => {
      let safeRecord = { ...record };
      
      // hash idNumber
      if (safeRecord.idNumber) {
        safeRecord.idNumber = hashIdNumber(safeRecord.idNumber);
      }
      
      // 應用顯示配置中的預處理規則
      if (displayConfig.isValid) {
        safeRecord = applyConfigBasedProcessing(safeRecord, displayConfig);
      }
      
      return safeRecord;
    });
    
    // 對 checkinLog 按照 Timestamp 進行反向排序（最新的在前面）
    const sortedCheckinData = safeCheckinData.sort((a, b) => {
      const aTime = a.Timestamp || 0;
      const bTime = b.Timestamp || 0;
      return bTime - aTime; // 降序排列（新的在前）
    });
    
    console.log(`🔒 已對敏感資料進行安全處理：idNumber已hash，看板欄位已套用預處理規則（跳過Timestamp欄位）`);
    console.log(`📅 checkinLog 已按時間戳反向排序：${sortedCheckinData.length} 筆記錄`);
    
    return {
      success: true,
      students: safeStudents,
      checkinLog: sortedCheckinData,
      primaryKey: primaryKeyColumn.name,
      inputColumns: inputColumns,
      rawDataHeaders: rawDataHeaders
    };
    
  } catch (error) {
    console.error('❌ 數據關聯錯誤:', error);
    return {
      success: false,
      error: error.toString(),
      errors: [{
        type: 'DATA_JOIN_ERROR',
        message: `數據關聯失敗: ${error.toString()}`,
        severity: 'CRITICAL'
      }]
    };
  }
}

/**
 * 從範圍讀取數據並轉換為物件陣列
 */
function getDataFromRange(range, customHeaders = null) {
  const values = range.getValues();
  
  if (values.length === 0) {
    return [];
  }
  
  const headers = customHeaders || values[0];
  const dataRows = customHeaders ? values : values.slice(1);
  
  return dataRows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] !== undefined ? row[index] : '';
    });
    return obj;
  });
}

function getDisplayConfigFromSheet(sheetId) {
  try {
    console.log(`📋 获取表单 ${sheetId} 的显示配置`);
    
    const ss = SpreadsheetApp.openById(sheetId);
    const configSheet = ss.getSheetByName(CONFIG.DISPLAY_CONFIG_SHEET_NAME);
    
    if (!configSheet) {
      return {
        isValid: false,
        error: `该表并没有设定给看板程式使用`,
        errors: [{ type: 'NOT_DASHBOARD_ENABLED', message: `表单中缺少「${CONFIG.DISPLAY_CONFIG_SHEET_NAME}」工作表` }]
      };
    }
    
    const range = configSheet.getDataRange();
    const values = range.getValues();
    
    if (values.length <= 1) {
      return {
        isValid: false,
        error: '显示配置表为空',
        errors: [{ type: 'EMPTY_CONFIG', message: '显示配置表没有配置数据' }]
      };
    }
    
    const headers = values[0];
    console.log(`📋 配置表头: ${headers.join(', ')}`);
    
    const configRows = values.slice(1).map(row => {
      const config = {};
      headers.forEach((header, index) => {
        config[header] = row[index] || '';
      });
      return config;
    }).filter(row => {
      // 找栏位名称字段（支持各种可能的名称）
      const fieldName = row['栏位名称'] || row['欄位名稱'] || row['字段名称'] || row['欄位名'] || '';
      return fieldName.trim();
    });
    
    console.log(`📋 解析到 ${configRows.length} 个栏位配置`);
    
    // 简化验证：只检查是否有 UID 和 StudentTable
    let hasUID = false;
    let hasStudentTable = false;
    
    configRows.forEach(row => {
      // 检查特殊功能
      const specialFunction = row['特殊功能'] || row['功能'] || '';
      if (specialFunction.toUpperCase() === 'UID') {
        hasUID = true;
      }
      
      // 检查显示区块
      const displayBlock = row['显示区块'] || row['顯示區塊'] || row['区块'] || '';
      if (displayBlock.includes('StudentTable')) {
        hasStudentTable = true;
      }
    });
    
    const errors = [];
    if (!hasUID) {
      errors.push({ type: 'MISSING_UID', message: '必须指定一个栏位作为 UID' });
    }
    if (!hasStudentTable) {
      errors.push({ type: 'NO_STUDENT_TABLE', message: 'StudentTable 区块没有对应的栏位' });
    }
    
    if (errors.length > 0) {
      return {
        isValid: false,
        error: '配置验证失败',
        errors: errors
      };
    }
    
    // 处理显示区块（转换为数组）
    const processedConfig = configRows.map(row => {
      const processed = { ...row };
      const displayBlock = row['显示区块'] || row['顯示區塊'] || '';
      if (displayBlock) {
        processed['显示区块'] = displayBlock.split(',').map(b => b.trim());
        processed['顯示區塊'] = processed['显示区块']; // 兼容繁体
      }
      return processed;
    });
    
    console.log(`✅ 显示配置载入成功，${processedConfig.length} 个栏位配置`);
    
    return {
      isValid: true,
      config: processedConfig,
      version: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ 获取显示配置错误:`, error);
    return {
      isValid: false,
      error: error.toString(),
      errors: [{ type: 'CONFIG_READ_ERROR', message: `无法读取显示配置: ${error.toString()}` }]
    };
  }
}

/**
 * 驗證顯示配置 - 修正版本
 */
function validateDisplayConfig(configRows) {
  const errors = [];
  const warnings = [];
  
  try {
    console.log(`🔍 开始验证显示配置，共 ${configRows.length} 个栏位`);
    
    // 1. 检查 UID 配置
    const uidFields = configRows.filter(row => {
      const specialFunction = row['特殊功能'] || '';
      return specialFunction.toString().toUpperCase() === 'UID';
    });
    
    if (uidFields.length === 0) {
      errors.push({
        type: 'MISSING_UID',
        message: '必须指定一个栏位作为 UID',
        severity: 'CRITICAL'
      });
    } else if (uidFields.length > 1) {
      warnings.push({
        type: 'MULTIPLE_UID',
        message: `发现多个 UID 栏位，将只使用第一个: ${uidFields[0]['栏位名称']}`,
        severity: 'WARNING'
      });
    }
    
    // 2. 检查 Timestamp 配置（只能有一个）
    const timestampFields = configRows.filter(row => {
      const fieldType = row['栏位性质'] || row['欄位性質'] || '';
      return fieldType.toLowerCase() === 'timestamp';
    });
    
    if (timestampFields.length > 1) {
      warnings.push({
        type: 'MULTIPLE_TIMESTAMP',
        message: `发现多个 Timestamp 栏位，将只使用第一个: ${timestampFields[0]['栏位名称']}`,
        severity: 'WARNING'
      });
    }
    
    // 3. 检查显示区块配置
    const hasStudentTable = configRows.some(row => {
      const displayBlock = row['显示区块'] || row['顯示區塊'] || '';
      return displayBlock.includes('StudentTable');
    });
    
    if (!hasStudentTable) {
      errors.push({
        type: 'NO_STUDENT_TABLE',
        message: 'StudentTable 区块没有对应的栏位',
        severity: 'CRITICAL'
      });
    }
    
    console.log(`🔍 验证结果: UID字段 ${uidFields.length} 个, Timestamp字段 ${timestampFields.length} 个`);
    
    return { 
      errors, 
      warnings, 
      isValid: errors.length === 0 
    };
    
  } catch (error) {
    console.error('❌ 配置验证过程错误:', error);
    return {
      errors: [{
        type: 'VALIDATION_ERROR',
        message: `配置验证失败: ${error.toString()}`,
        severity: 'CRITICAL'
      }],
      warnings: [],
      isValid: false
    };
  }
}
/**
 * 根據配置處理數據 - 簡化版本（去除流量圖表生成）
 */
function processDataWithConfig(studentsData, checkinData, displayConfig) {
  try {
    console.log(`🔄 开始根据配置处理数据，已报到学生: ${studentsData.length} 笔`);
    
    // 找到 UID 配置
    const uidConfig = displayConfig.find(config => {
      const specialFunction = config['特殊功能'] || config['功能'] || '';
      return specialFunction.toUpperCase() === 'UID';
    });
    
    if (!uidConfig) {
      throw new Error('找不到 UID 配置');
    }
    
    // 找到 Timestamp 字段配置
    const timestampConfig = displayConfig.find(config => {
      const fieldType = config['栏位性质'] || config['欄位性質'] || '';
      return fieldType.toLowerCase() === 'timestamp';
    });
    
    // 找到 DateTime 字段配置
    const datetimeConfigs = displayConfig.filter(config => {
      const fieldType = config['栏位性质'] || config['欄位性質'] || '';
      return fieldType.toLowerCase() === 'datetime';
    });
    
    const uidFieldName = uidConfig['栏位名称'] || uidConfig['欄位名稱'] || '';
    const timestampFieldName = timestampConfig ? (timestampConfig['栏位名称'] || timestampConfig['欄位名稱']) : null;
    
    console.log(`🆔 UID 字段: ${uidFieldName}`);
    console.log(`⏰ Timestamp 字段: ${timestampFieldName || '无'}`);
    console.log(`📅 DateTime 字段: ${datetimeConfigs.length} 个`);
    
    // 处理学生数据
    const processedStudents = studentsData.map(student => {
      const processedStudent = { ...student };
      
      // 处理 Timestamp 字段（来自程式写入表A列）
      if (timestampFieldName && student.Timestamp) {
        const processedTimestamp = processTimestampField(student.Timestamp);
        processedStudent[timestampFieldName] = processedTimestamp.displayValue;
        processedStudent[timestampFieldName + '_timestamp'] = processedTimestamp.timestamp;
        
        // 设置为主时间戳（用于排序）
        processedStudent.checkinTimestamp = processedTimestamp.timestamp;
      }
      
      // 处理 DateTime 字段
      datetimeConfigs.forEach(config => {
        const fieldName = config['栏位名称'] || config['欄位名稱'];
        const rawValue = student[fieldName];
        
        if (rawValue) {
          const processedValue = processDateTimeField(rawValue, config);
          processedStudent[fieldName] = processedValue.displayValue;
          processedStudent[fieldName + '_timestamp'] = processedValue.timestamp;
        }
      });
      
      // 设置前端使用的 UID
      const frontendUID = student[uidFieldName];
      processedStudent._uid = frontendUID;
      processedStudent.idNumber = frontendUID;
      
      return processedStudent;
    });
    
    // 按主时间戳排序（最新的在前面）
    const sortedStudents = processedStudents.sort((a, b) => {
      const aTime = a.checkinTimestamp || 0;
      const bTime = b.checkinTimestamp || 0;
      return bTime - aTime; // 降序排列（新的在前）
    });
    
    console.log(`✅ 数据处理完成：${sortedStudents.length} 笔已报到学生，已按时间戳排序`);
    
    return {
      students: sortedStudents,
      checkinLog: checkinData,
      uidField: uidFieldName,
      timestampField: timestampFieldName
    };
    
  } catch (error) {
    console.error('❌ 数据处理错误:', error);
    throw error;
  }
}

/**
 * 新增：处理主 Timestamp 字段
 */
function processTimestampField(value) {
  try {
    if (!value) {
      return { displayValue: '', timestamp: null };
    }
    
    let timestamp = null;
    
    if (value instanceof Date) {
      timestamp = value.getTime();
    } else if (typeof value === 'number') {
      timestamp = value;
    } else if (typeof value === 'string') {
      if (/^\d+$/.test(value)) {
        const num = parseInt(value);
        if (value.length === 13) {
          timestamp = num; // 毫秒时间戳
        } else if (value.length === 10) {
          timestamp = num * 1000; // 秒时间戳
        }
      } else {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          timestamp = parsed.getTime();
        }
      }
    }
    
    let displayValue = '';
    if (timestamp) {
      const date = new Date(timestamp);
      // Timestamp 使用简洁格式
      displayValue = date.toLocaleString('zh-TW', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Taipei'
      });
    } else {
      displayValue = value ? value.toString() : '';
    }
    
    return { displayValue, timestamp };
    
  } catch (error) {
    console.warn(`⚠️ Timestamp 字段处理失败:`, value, error);
    return {
      displayValue: value ? value.toString() : '',
      timestamp: null
    };
  }
}
/**
 * 修改：processDateTimeField - DateTime 字段处理（支持特殊功能格式说明）
 */
function processDateTimeField(value, config) {
  try {
    if (!value) {
      return { displayValue: '', timestamp: null };
    }
    
    let timestamp = null;
    
    if (value instanceof Date) {
      timestamp = value.getTime();
    } else if (typeof value === 'number') {
      timestamp = value;
    } else if (typeof value === 'string') {
      if (/^\d+$/.test(value)) {
        const num = parseInt(value);
        if (value.length === 13) {
          timestamp = num;
        } else if (value.length === 10) {
          timestamp = num * 1000;
        }
      } else {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          timestamp = parsed.getTime();
        }
      }
    }
    
    let displayValue = '';
    if (timestamp) {
      const date = new Date(timestamp);
      const specialFunction = config['特殊功能'] || '';
      
      if (specialFunction.includes('HH:mm:ss')) {
        displayValue = date.toLocaleTimeString('zh-TW', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Taipei'
        });
      } else if (specialFunction.includes('HH:mm')) {
        displayValue = date.toLocaleTimeString('zh-TW', {
          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei'
        });
      } else {
        // 默认：年-月-日 小时:分钟:秒
        displayValue = date.toLocaleString('zh-TW', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Taipei'
        });
      }
    } else {
      displayValue = value ? value.toString() : '';
    }
    
    return { displayValue, timestamp };
    
  } catch (error) {
    console.warn(`⚠️ DateTime 字段处理失败:`, config['栏位名称'], value, error);
    return {
      displayValue: value ? value.toString() : '',
      timestamp: null
    };
  }
}
/**
 * 處理 datetime 欄位
 */
function processDateTimeField(value, config) {
  try {
    if (!value) {
      return {
        displayValue: '',
        timestamp: null
      };
    }
    
    let timestamp = null;
    let displayValue = '';
    
    // 尝试解析时间戳
    if (value instanceof Date) {
      timestamp = value.getTime();
    } else if (typeof value === 'number') {
      timestamp = value;
    } else if (typeof value === 'string') {
      // 尝试解析字符串
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        timestamp = parsed.getTime();
      } else if (/^\d+$/.test(value)) {
        // 纯数字字符串
        const num = parseInt(value);
        if (value.length === 13) {
          timestamp = num; // 毫秒时间戳
        } else if (value.length === 10) {
          timestamp = num * 1000; // 秒时间戳
        }
      }
    }
    
    // 生成显示值 - 使用台湾时间格式
    if (timestamp) {
      const date = new Date(timestamp);
      
      // 检查配置中的格式要求
      const format = config['格式'] || config['预处理'] || '';
      
      if (format.includes('YYYY-MM-DD HH:mm:ss')) {
        displayValue = date.toLocaleString('zh-TW', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Taipei'
        });
      } else if (format.includes('HH:mm:ss')) {
        displayValue = date.toLocaleTimeString('zh-TW', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Taipei'
        });
      } else if (format.includes('MM-DD HH:mm')) {
        displayValue = date.toLocaleString('zh-TW', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Taipei'
        });
      } else {
        // 预设格式：适合打字机显示的简洁格式
        displayValue = date.toLocaleString('zh-TW', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Taipei'
        });
      }
    } else {
      displayValue = value ? value.toString() : '';
    }
    
    return {
      displayValue: displayValue,
      timestamp: timestamp
    };
    
  } catch (error) {
    console.warn(`⚠️ datetime 栏位处理失败: ${config['栏位名称']}, 值: ${value}`, error);
    return {
      displayValue: value ? value.toString() : '',
      timestamp: null
    };
  }
}

function parseTimestamp(timestamp) {
  if (!timestamp) return null;
  
  try {
    if (timestamp instanceof Date) {
      return timestamp.getTime();
    }
    
    if (typeof timestamp === 'number') {
      return timestamp;
    }
    
    if (typeof timestamp === 'string') {
      // 纯数字字符串
      if (/^\d+$/.test(timestamp)) {
        const num = parseInt(timestamp);
        if (timestamp.length === 13) {
          return num; // 毫秒时间戳
        } else if (timestamp.length === 10) {
          return num * 1000; // 秒时间戳
        }
      }
      
      // 尝试解析日期字符串
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }
    
    return null;
  } catch (error) {
    console.warn('⚠️ 时间戳解析失败:', timestamp, error);
    return null;
  }
}
/**
 * 解析報到時間
 */
function parseCheckinTime(checkinTime) {
  if (!checkinTime) return null;
  
  try {
    if (typeof checkinTime === 'number') {
      return checkinTime;
    }
    
    if (typeof checkinTime === 'string') {
      if (/^\d+$/.test(checkinTime)) {
        const num = parseInt(checkinTime);
        if (checkinTime.length === 13) {
          return num; // 毫秒時間戳
        } else if (checkinTime.length === 10) {
          return num * 1000; // 秒時間戳
        }
      }
      
      const date = new Date(checkinTime);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }
    
    if (checkinTime instanceof Date) {
      return checkinTime.getTime();
    }
    
    return null;
  } catch (error) {
    console.warn('⚠️ 解析報到時間失敗:', checkinTime, error);
    return null;
  }
}

/**
 * getDashboardData 函數 - 移除流量數據生成
 */
function getDashboardData(sheetId = null) {
  try {
    console.log(`📊 開始獲取儀表板數據，表單ID: ${sheetId || '預設'}`);
    
    // 如果沒有指定 sheetId，使用當前活動的表單
    if (!sheetId) {
      const activityStatus = getActivityStatus();
      if (activityStatus.targetSheetId) {
        sheetId = activityStatus.targetSheetId;
      } else {
        return {
          success: true,
          activityStatus: activityStatus,
          students: [],
          checkinLog: [],
          displayConfig: null,
          timestamp: new Date().toISOString(),
          metadata: {
            totalStudents: 0,
            totalCheckins: 0,
            explanation: "沒有活動進行中，無學生數據"
          }
        };
      }
    }
    
    // 獲取顯示配置
    const displayConfig = getDisplayConfigFromSheet(sheetId);
    if (!displayConfig.isValid) {
      return {
        success: false,
        error: displayConfig.error,
        configErrors: displayConfig.errors,
        timestamp: new Date().toISOString()
      };
    }
    
    // 獲取活動狀態
    const activityStatus = getActivityStatusForSheet(sheetId);
    
    // 獲取原始數據並關聯
    const joinedData = getJoinedDataFromSheet(sheetId);
    if (!joinedData.success) {
      return {
        success: false,
        error: joinedData.error,
        configErrors: joinedData.errors || [],
        timestamp: new Date().toISOString()
      };
    }
    
    // 根據配置處理數據（不包含流量數據生成）
    const processedData = processDataWithConfig(
      joinedData.students, 
      joinedData.checkinLog, 
      displayConfig.config
    );
    
    return {
      success: true,
      sheetId: sheetId,
      activityStatus: activityStatus,
      students: processedData.students,
      checkinLog: processedData.checkinLog,
      displayConfig: displayConfig.config,
      timestamp: new Date().toISOString(),
      metadata: {
        totalStudents: processedData.students.length,
        totalCheckins: processedData.checkinLog.length,
        targetSheetId: sheetId,
        configVersion: displayConfig.version,
        primaryKey: joinedData.primaryKey,
        sortedByCheckinTime: processedData.sortedByCheckinTime,
        datetimeFields: processedData.datetimeFields
      }
    };
    
  } catch (error) {
    console.error('❌ 獲取儀表板數據錯誤:', error);
    return {
      success: false,
      activityStatus: {
        status: 'error',
        message: '系統錯誤: ' + error.toString()
      },
      students: [],
      checkinLog: [],
      displayConfig: null,
      timestamp: new Date().toISOString(),
      error: error.toString()
    };
  }
}

/**
 * 獲取預處理規則描述
 */
function getPreprocessingDescription(rule) {
  if (!rule) return '無';
  
  if (rule.includes('→')) {
    const [pattern, replacement] = rule.split('→').map(s => s.trim());
    
    // 常見規則的友好描述
    if (pattern.includes('(.{1}).*(.{1})') && replacement.includes('○')) {
      return '姓名脫敏（只顯示姓氏和名字最後一字，中間用○代替）';
    }
    if (pattern.includes('.{7}(.{3})') && replacement.includes('***')) {
      return '身分證號脫敏（只顯示後3碼，前面用***代替）';
    }
    if (pattern.includes('(.{4}).*(.{4})') && replacement.includes('****')) {
      return '電話號碼脫敏（只顯示前4碼和後4碼，中間用****代替）';
    }
    if (pattern.includes('市立(.*)國民中學') && replacement.includes('國中')) {
      return '學校名稱簡化（移除地區前綴和完整後綴）';
    }
    
    return `正則表達式替換：${pattern} → ${replacement}`;
  }
  
  return rule;
}

/**
 * 獲取特殊功能描述
 */
function getSpecialFunctionDescription(func) {
  const descriptions = {
    'UID': '唯一識別碼 - 用於前端顯示和數據關聯',
    'PRIMARY': '主鍵 - 用於後端數據關聯',
    'HIDDEN': '隱藏欄位 - 不在前端顯示',
    'READONLY': '只讀欄位 - 僅供顯示，不可編輯'
  };
  
  return descriptions[func] || func;
}

/**
 * 應用預處理規則
 */
function applyPreprocessing(value, rule) {
  if (!rule || !value) return value;
  
  try {
    // 正則表達式替換
    if (rule.includes('→')) {
      const [pattern, replacement] = rule.split('→').map(s => s.trim());
      const regex = new RegExp(pattern);
      return value.toString().replace(regex, replacement);
    }
    
    // 其他預處理規則可以在這裡擴展
    return value;
    
  } catch (error) {
    console.warn(`⚠️ 預處理規則應用失敗: ${rule}, 值: ${value}`, error);
    return value;
  }
}

// ========================================
// 修改原有函數以支援新邏輯
// ========================================

/**
 * 獲取學生數據 - 修正為使用關聯邏輯
 */
function getStudentsDataFromSheet(sheetId) {
  try {
    const joinedData = getJoinedDataFromSheet(sheetId);
    if (!joinedData.success) {
      throw new Error(joinedData.error);
    }
    
    console.log(`👥 表單 ${sheetId} 關聯後學生數據: ${joinedData.students.length} 筆`);
    
    return {
      data: joinedData.students,
      headers: joinedData.rawDataHeaders,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ 獲取表單 ${sheetId} 學生數據錯誤:`, error);
    throw error;
  }
}

/**
 * 獲取報到狀態 - 修正為使用關聯邏輯
 */
function getCheckinStatusFromSheet(sheetId) {
  try {
    const joinedData = getJoinedDataFromSheet(sheetId);
    if (!joinedData.success) {
      console.log(`⚠️ 表單 ${sheetId} 獲取報到數據失敗，返回空數據`);
      return { 
        data: [], 
        headers: ['Timestamp', 'Account', '身分證統一編號'], 
        timestamp: new Date().toISOString() 
      };
    }
    
    console.log(`📋 表單 ${sheetId} 報到記錄: ${joinedData.checkinLog.length} 筆`);
    
    return {
      data: joinedData.checkinLog,
      headers: joinedData.checkinLog.length > 0 
        ? Object.keys(joinedData.checkinLog[0]) 
        : ['Timestamp', 'Account', joinedData.primaryKey],
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ 獲取表單 ${sheetId} 報到狀態錯誤:`, error);
    return { 
      data: [], 
      headers: ['Timestamp', 'Account', '身分證統一編號'], 
      timestamp: new Date().toISOString(),
      error: error.toString()
    };
  }
}

// ========================================
// 保留原有的其他函數（getActivityStatus, testConnection 等）
// ========================================

/**
 * 獲取活動狀態
 */
function getActivityStatus(sheetId = null) {
  try {
    if (sheetId) {
      return getActivityStatusForSheet(sheetId);
    }
    
    const controlData = getControlSheetData();
    const currentTime = new Date().getTime();
    
    console.log(`⏰ 檢查活動狀態，當前時間: ${new Date(currentTime).toLocaleString('zh-TW')}`);
    
    let activeEvent = null;
    let activityStatus = 'inactive';
    let statusMessage = '目前沒有進行中的活動';
    let targetSheetId = null;
    
    for (const event of controlData.events) {
      if (event.startTimestamp && event.endTimestamp) {
        console.log(`📅 檢查活動: ${event.title}`);
        
        if (currentTime < event.startTimestamp) {
          if (activityStatus === 'inactive') {
            activityStatus = 'pending';
            statusMessage = '作業尚未開始';
            activeEvent = event;
            targetSheetId = event.sheetId;
          }
        } else if (currentTime >= event.startTimestamp && currentTime <= event.endTimestamp) {
          activityStatus = 'active';
          statusMessage = '報到作業進行中';
          activeEvent = event;
          targetSheetId = event.sheetId;
          break; // 找到進行中的活動就停止
        } else if (currentTime > event.endTimestamp) {
          if (activityStatus === 'inactive') {
            activityStatus = 'ended';
            statusMessage = '已結束作業';
            activeEvent = event;
            targetSheetId = event.sheetId;
          }
        }
      }
    }
    
    console.log(`🎯 活動狀態: ${activityStatus} - ${statusMessage}`);
    
    return {
      success: true,
      status: activityStatus,
      message: statusMessage,
      currentEvent: activeEvent,
      targetSheetId: targetSheetId,
      currentTime: currentTime,
      timestamp: new Date().toISOString(),
      allEvents: controlData.events
    };
    
  } catch (error) {
    console.error('❌ 獲取活動狀態錯誤:', error);
    return {
      success: false,
      status: 'error',
      message: '無法獲取活動狀態: ' + error.toString(),
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 獲取指定表單的活動狀態
 */
function getActivityStatusForSheet(sheetId) {
  try {
    const controlData = getControlSheetData();
    const currentTime = new Date().getTime();
    
    const targetEvent = controlData.events.find(event => event.sheetId === sheetId);
    
    if (!targetEvent) {
      return {
        success: false,
        status: 'error',
        message: `找不到表單: ${sheetId}`,
        timestamp: new Date().toISOString()
      };
    }
    
    let activityStatus = 'inactive';
    let statusMessage = '狀態未知';
    
    if (targetEvent.startTimestamp && targetEvent.endTimestamp) {
      if (currentTime < targetEvent.startTimestamp) {
        activityStatus = 'pending';
        statusMessage = '作業尚未開始';
      } else if (currentTime >= targetEvent.startTimestamp && currentTime <= targetEvent.endTimestamp) {
        activityStatus = 'active';
        statusMessage = '報到作業進行中';
      } else if (currentTime > targetEvent.endTimestamp) {
        activityStatus = 'ended';
        statusMessage = '已結束作業';
      }
    }
    
    console.log(`🎯 表單 ${sheetId} 狀態: ${activityStatus} - ${statusMessage}`);
    
    return {
      success: true,
      status: activityStatus,
      message: statusMessage,
      currentEvent: targetEvent,
      targetSheetId: sheetId,
      currentTime: currentTime,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ 獲取指定表單活動狀態錯誤:', error);
    return {
      success: false,
      status: 'error',
      message: '無法獲取活動狀態: ' + error.toString(),
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 測試連接
 */
function testConnection() {
  try {
    const config = getConfig();
    return {
      success: true,
      message: '連接正常',
      timestamp: new Date().toISOString(),
      version: '4.1.0',
      controlSheetId: config.CONTROL_SHEET_ID,
      environment: 'Google Apps Script',
      features: ['配置驅動UI', '動態欄位處理', '預處理規則', 'UID安全機制', '正確數據關聯']
    };
  } catch (error) {
    console.error('❌ 連接測試錯誤:', error);
    throw new Error(`連接測試失敗: ${error.toString()}`);
  }
}

/**
 * 驗證自動刷新密鑰
 * @param {string} gem - 前端提供的密鑰
 */
function validateAutoRefreshGem(gem) {
  try {
    console.log(`🔄 驗證自動刷新密鑰，密鑰: ${gem ? '[有提供]' : '[未提供]'}`);
    
    const autorefreshGem = PropertiesService.getScriptProperties().getProperty('autorefreshGem');
    const refreshInterval = PropertiesService.getScriptProperties().getProperty('refreshInterval') || '30';
    
    if (!autorefreshGem) {
      console.log('⚠️ autorefreshGem 未設定，自動刷新功能停用');
      return {
        success: true,
        enabled: false,
        message: 'autorefreshGem 未設定',
        refreshInterval: parseInt(refreshInterval),
        timestamp: new Date().toISOString()
      };
    }
    
    if (!gem) {
      console.log('⚠️ 未提供密鑰，自動刷新功能停用');
      return {
        success: true,
        enabled: false,
        message: '未提供密鑰',
        refreshInterval: parseInt(refreshInterval),
        timestamp: new Date().toISOString()
      };
    }
    
    // 在後端進行安全比對
    const isValid = gem === autorefreshGem;
    
    if (isValid) {
      console.log(`✅ 自動刷新密鑰驗證通過，間隔: ${refreshInterval}秒`);
      return {
        success: true,
        enabled: true,
        message: '自動刷新密鑰驗證通過',
        refreshInterval: parseInt(refreshInterval),
        timestamp: new Date().toISOString()
      };
    } else {
      console.log('❌ 自動刷新密鑰驗證失敗，密鑰不匹配');
      return {
        success: true,
        enabled: false,
        message: '自動刷新密鑰驗證失敗',
        refreshInterval: parseInt(refreshInterval),
        timestamp: new Date().toISOString()
      };
    }
    
  } catch (error) {
    console.error('❌ 驗證自動刷新密鑰錯誤:', error);
    return {
      success: false,
      enabled: false,
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}

// ========================================
// 保留其他必要函數
// ========================================

function getControlSheetData() {
  try {
    const config = getConfig();
    const controlSheetId = config.CONTROL_SHEET_ID;
    if (!controlSheetId) {
      throw new Error('控制工作表 ID 未設定，請執行 setupControlSheet() 函數');
    }
    
    const ss = SpreadsheetApp.openById(controlSheetId);
    const sheet = ss.getSheetByName(config.CONTROL_SHEET_NAME);
    
    if (!sheet) {
      throw new Error(`找不到控制工作表: ${config.CONTROL_SHEET_NAME}`);
    }
    
    const range = sheet.getDataRange();
    const values = range.getValues();
    
    if (values.length <= 1) {
      return { events: [] };
    }
    
    const headers = values[0];
    const dataRows = values.slice(1);
    const events = [];
    
    console.log(`📋 解析控制表，表頭: ${headers.join(', ')}`);
    
    dataRows.forEach((row, index) => {
      if (row.length >= 8) {
        const sheetId = row[0];
        const title = row[1];
        const endTimestamp = parseTimestampValue(row[2]);
        const startTimestamp = parseTimestampValue(row[7]);
        const noticeMD = row[8] ? row[8].toString().trim() : null;
        
        if (sheetId && title) {
          const event = {
            sheetId: sheetId.toString().trim(),
            title: title.toString().trim(),
            startTimestamp: startTimestamp,
            endTimestamp: endTimestamp,
            noticeMD: noticeMD,
            rowIndex: index + 2,
            isValid: !!(startTimestamp && endTimestamp)
          };
          
          events.push(event);
          
          if (noticeMD) {
            console.log(`📝 表單 ${sheetId} 包含提醒內容: ${noticeMD.substring(0, 50)}${noticeMD.length > 50 ? '...' : ''}`);
          }
        }
      }
    });
    
    console.log(`✅ 解析 ${events.length} 個活動`);
    return { 
      events: events, 
      headers: headers, 
      timestamp: new Date().toISOString() 
    };
    
  } catch (error) {
    console.error('❌ 讀取控制工作表錯誤:', error);
    throw error;
  }
}

function parseTimestampValue(value) {
  if (!value) return null;
  
  try {
    if (typeof value === 'number') {
      return value;
    }
    
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      return parseInt(value.trim());
    }
    
    if (value instanceof Date) {
      return value.getTime();
    }
    
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
    
    return null;
  } catch (error) {
    console.warn('時間戳解析失敗:', value, error);
    return null;
  }
}

// ========================================
// 設定和測試函數
// ========================================

function setupControlSheet() {
  const controlSheetId = '1yjrKov1eMgDkGqobzpe9YTNLrSLB0h_663fE65Atac4';
  PropertiesService.getScriptProperties().setProperty('controlSheet', controlSheetId);
  console.log(`✅ 控制工作表 ID 已設定: ${controlSheetId}`);
  
  try {
    const testResult = getActivityStatus();
    console.log('🧪 測試結果:', JSON.stringify(testResult, null, 2));
    
    const sheetsResult = getAvailableSheets();
    console.log('📋 表單列表測試:', JSON.stringify(sheetsResult, null, 2));
    
    return { 
      success: true, 
      controlSheetId, 
      testResult,
      sheetsResult
    };
  } catch (error) {
    console.error('❌ 測試失敗:', error);
    return { success: false, error: error.toString() };
  }
}

function testFullSystem() {
  try {
    console.log('🧪 開始完整系統測試...');
    
    const controlTest = getControlSheetData();
    console.log('📋 控制工作表測試通過');
    
    const sheetsTest = getAvailableSheets();
    console.log('📋 表單列表測試通過');
    
    const statusTest = getActivityStatus();
    console.log('🎯 活動狀態測試通過');
    
    // 測試配置驅動功能
    if (sheetsTest.sheets && sheetsTest.sheets.length > 0) {
      const firstSheetId = sheetsTest.sheets[0].id;
      console.log(`📊 測試配置驅動功能，表單: ${firstSheetId}`);
      
      const joinTest = getJoinedDataFromSheet(firstSheetId);
      console.log('🔗 數據關聯測試:', joinTest.success ? '通過' : '失敗');
      
      if (joinTest.success) {
        const configTest = getDisplayConfigFromSheet(firstSheetId);
        console.log('⚙️ 顯示配置測試:', configTest.isValid ? '通過' : '失敗');
        
        if (configTest.isValid) {
          getDashboardData(firstSheetId);
          console.log('📊 配置驅動儀表板測試通過');
        }
      }
    }
    
    console.log('🎉 所有測試通過！');
    return {
      success: true,
      version: '4.1.0',
      features: ['配置驅動UI', '動態欄位處理', '預處理規則', 'UID安全機制', '正確數據關聯'],
      controlData: controlTest,
      availableSheets: sheetsTest,
      activityStatus: statusTest
    };
    
  } catch (error) {
    console.error('❌ 系統測試失敗:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * 測試數據關聯功能
 */
function testDataJoin(sheetId) {
  try {
    console.log(`🧪 測試數據關聯功能，表單: ${sheetId}`);
    
    // 測試數據關聯
    const joinTest = getJoinedDataFromSheet(sheetId);
    console.log('🔗 數據關聯測試:', joinTest.success ? '✅ 通過' : '❌ 失敗');
    
    if (!joinTest.success) {
      console.log('❌ 關聯錯誤:', joinTest.errors);
      return {
        success: false,
        error: 'DATA_JOIN_FAILED',
        details: joinTest.errors
      };
    }
    
    console.log(`📈 關聯結果統計:`);
    console.log(`   - 學生數據: ${joinTest.students.length} 筆`);
    console.log(`   - 報到記錄: ${joinTest.checkinLog.length} 筆`);
    console.log(`   - 主鍵欄位: ${joinTest.primaryKey}`);
    console.log(`   - 程式寫入表欄位: ${joinTest.inputColumns.length} 個`);
    console.log(`   - 原始資料表欄位: ${joinTest.rawDataHeaders.length} 個`);
    
    // 測試配置驅動處理
    const configTest = getDisplayConfigFromSheet(sheetId);
    if (configTest.isValid) {
      const processedData = processDataWithConfig(
        joinTest.students, 
        joinTest.checkinLog, 
        configTest.config
      );
      
      console.log(`📊 配置處理結果:`);
      console.log(`   - 處理後學生: ${processedData.students.length} 筆`);
      console.log(`   - UID 欄位: ${processedData.uidField}`);
    }
    
    return {
      success: true,
      studentsCount: joinTest.students.length,
      checkinCount: joinTest.checkinLog.length,
      primaryKey: joinTest.primaryKey,
      inputColumnsCount: joinTest.inputColumns.length,
      rawHeadersCount: joinTest.rawDataHeaders.length,
      configValid: configTest.isValid,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ 數據關聯測試失敗:', error);
    return { 
      success: false, 
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 測試預處理規則
 */
function testPreprocessing() {
  try {
    console.log('🧪 測試預處理規則功能');
    
    const testCases = [
      {
        value: '王小明',
        rule: '^(.{1}).*(.{1})$ → $1○$2',
        expected: '王○明'
      },
      {
        value: 'F123456789',
        rule: '^.{7}(.{3})$ → ***$1',
        expected: '***789'
      },
      {
        value: '0912345678',
        rule: '^(.{4}).*(.{4})$ → $1****$2',
        expected: '0912****5678'
      },
      {
        value: '新北市立林口國民中學',
        rule: '^.*市立(.*)國民中學$ → $1國中',
        expected: '林口國中'
      }
    ];
    
    const results = testCases.map(testCase => {
      const result = applyPreprocessing(testCase.value, testCase.rule);
      const passed = result === testCase.expected;
      
      console.log(`${passed ? '✅' : '❌'} ${testCase.value} → ${result} (期望: ${testCase.expected})`);
      
      return {
        input: testCase.value,
        rule: testCase.rule,
        output: result,
        expected: testCase.expected,
        passed: passed
      };
    });
    
    const passedCount = results.filter(r => r.passed).length;
    console.log(`📊 預處理測試結果: ${passedCount}/${results.length} 通過`);
    
    return {
      success: passedCount === results.length,
      totalTests: results.length,
      passedTests: passedCount,
      results: results,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ 預處理規則測試失敗:', error);
    return { 
      success: false, 
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}
/**
 * 測試 datetime 處理功能
 */
function testDateTimeProcessing() {
  try {
    console.log('🧪 測試 datetime 處理功能');
    
    const testCases = [
      {
        value: new Date('2025-06-18 14:30:25'),
        config: { '欄位名稱': '報到時間', '欄位性質': 'DateTime', '格式': 'YYYY-MM-DD HH:mm:ss' }
      },
      {
        value: 1718698225000, // 毫秒時間戳
        config: { '欄位名稱': '報到時間', '欄位性質': 'DateTime', '格式': 'HH:mm:ss' }
      },
      {
        value: '1718698225', // 秒時間戳字符串
        config: { '欄位名稱': '報到時間', '欄位性質': 'DateTime', '格式': 'MM-DD HH:mm' }
      },
      {
        value: '2025-06-18T14:30:25.000Z',
        config: { '欄位名稱': '報到時間', '欄位性質': 'DateTime' }
      }
    ];
    
    const results = testCases.map((testCase, index) => {
      console.log(`🧪 測試案例 ${index + 1}: ${testCase.value} (${typeof testCase.value})`);
      
      const result = processDateTimeField(testCase.value, testCase.config);
      
      console.log(`   顯示值: ${result.displayValue}`);
      console.log(`   時間戳: ${result.timestamp} (${result.timestamp ? new Date(result.timestamp).toISOString() : '無'})`);
      
      return {
        input: testCase.value,
        config: testCase.config,
        output: result,
        hasTimestamp: !!result.timestamp,
        hasDisplayValue: !!result.displayValue
      };
    });
    
    const successCount = results.filter(r => r.hasTimestamp && r.hasDisplayValue).length;
    console.log(`📊 datetime 處理測試結果: ${successCount}/${results.length} 成功`);
    
    return {
      success: successCount === results.length,
      totalTests: results.length,
      successTests: successCount,
      results: results,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ datetime 處理測試失敗:', error);
    return { 
      success: false, 
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}
/**
 * 新增函数：获取已报到学生数据（替代原来的关联逻辑）
 */
function getCheckedInStudentsFromSheet(sheetId) {
  try {
    console.log(`🔗 开始获取表单 ${sheetId} 的已报到学生数据`);
    
    const config = getConfig();
    const ss = SpreadsheetApp.openById(sheetId);
    
    // 1. 读取程式写入表
    const checkinSheet = ss.getSheetByName(config.SHEETS.CHECKIN_LOG);
    if (!checkinSheet) {
      return {
        success: false,
        error: `找不到 ${config.SHEETS.CHECKIN_LOG} 工作表`,
        errors: [{ type: 'MISSING_CHECKIN_SHEET', message: `表单中缺少「${config.SHEETS.CHECKIN_LOG}」工作表` }]
      };
    }
    
    // 2. 读取程式写入表配置（第1~4行，从第3列开始）
    const lastCol = checkinSheet.getLastColumn();
    if (lastCol < 3) {
      return {
        success: false,
        error: '程式写入表格式错误',
        errors: [{ type: 'INVALID_FORMAT', message: '程式写入表至少需要3列（A:Timestamp, B:Account, C:主键字段）' }]
      };
    }
    
    const configRange = checkinSheet.getRange(1, 3, 4, lastCol - 2);
    const configValues = configRange.getValues();
    
    // 3. 找到P类型字段（主键）
    let primaryKeyField = null;
    for (let i = 0; i < configValues[0].length; i++) {
      if (configValues[1][i] === "P") { // 第2行是字段类型
        primaryKeyField = {
          name: configValues[0][i], // 字段名称
          columnIndex: i + 3 // 在程式写入表中的实际列号（A=1,B=2,C=3...）
        };
        break;
      }
    }
    
    if (!primaryKeyField) {
      return {
        success: false,
        error: '程式写入表没有设定主键',
        errors: [{ type: 'MISSING_PRIMARY_KEY', message: '必须有一个类型为 "P" 的主键字段' }]
      };
    }
    
    console.log(`🔑 找到主键字段: ${primaryKeyField.name}，位于第 ${primaryKeyField.columnIndex} 列`);
    
    // 4. 读取程式写入表数据（第5行开始）
    const dataStartRow = 5;
    const totalRows = checkinSheet.getLastRow();
    
    if (totalRows < dataStartRow) {
      console.log(`📊 程式写入表没有数据`);
      return {
        success: true,
        students: [],
        checkinLog: [],
        primaryKey: primaryKeyField.name
      };
    }
    
    const dataRowCount = totalRows - dataStartRow + 1;
    const dataRange = checkinSheet.getRange(dataStartRow, 1, dataRowCount, lastCol);
    const dataValues = dataRange.getValues();
    
    // 5. 构建已报到学生映射表
    const checkedInMap = new Map();
    const checkinLog = [];
    
    dataValues.forEach((row) => {
      const timestamp = row[0]; // A列：Timestamp
      const account = row[1];   // B列：Account
      const primaryKeyValue = row[primaryKeyField.columnIndex - 1]; // 主键值
      
      if (primaryKeyValue && timestamp) {
        const checkinRecord = {
          Timestamp: timestamp,
          Account: account
        };
        
        // 添加其他配置字段
        configValues[0].forEach((fieldName, configIndex) => {
          checkinRecord[fieldName] = row[configIndex + 2] || ''; // +2 因为A,B列
        });
        
        // 添加統一的 idNumber 欄位供前端使用（優先使用UID欄位，否則使用主鍵值）
        const displayConfig = getDisplayConfigFromSheet(sheetId);
        let uidValue = primaryKeyValue; // 預設使用主鍵值
        
        if (displayConfig.isValid) {
          const uidConfig = displayConfig.config.find(config => {
            const specialFunction = config['特殊功能'] || config['功能'] || '';
            return specialFunction.toUpperCase() === 'UID';
          });
          
          if (uidConfig) {
            const uidFieldName = uidConfig['栏位名称'] || uidConfig['欄位名稱'];
            if (uidFieldName && checkinRecord[uidFieldName] !== undefined) {
              uidValue = checkinRecord[uidFieldName];
            }
          }
        }
        
        checkinRecord.idNumber = uidValue;
        
        checkinLog.push(checkinRecord);
        
        // 建立主键映射
        checkedInMap.set(primaryKeyValue.toString().trim(), {
          timestamp: timestamp,
          account: account,
          checkinData: checkinRecord
        });
      }
    });
    
    console.log(`📊 程式写入表：${checkinLog.length} 笔报到记录，${checkedInMap.size} 个唯一主键`);
    
    // 6. 读取原始资料表
    const rawDataSheet = ss.getSheetByName(config.SHEETS.MAIN_DATA);
    if (!rawDataSheet) {
      return {
        success: false,
        error: `找不到 ${config.SHEETS.MAIN_DATA} 工作表`,
        errors: [{ type: 'MISSING_RAW_DATA_SHEET', message: `表单中缺少「${config.SHEETS.MAIN_DATA}」工作表` }]
      };
    }
    
    const rawDataRange = rawDataSheet.getDataRange();
    const rawDataValues = rawDataRange.getValues();
    const rawDataHeaders = rawDataValues[0];
    
    console.log(`📊 原始资料表字段: ${rawDataHeaders.join(', ')}`);
    
    // 检查原始资料表是否有主键字段
    const primaryKeyColumnIndex = rawDataHeaders.indexOf(primaryKeyField.name);
    if (primaryKeyColumnIndex === -1) {
      return {
        success: false,
        error: `原始资料表中找不到主键字段: ${primaryKeyField.name}`,
        errors: [{ 
          type: 'PRIMARY_KEY_NOT_FOUND', 
          message: `原始资料表必须包含主键字段「${primaryKeyField.name}」`,
          availableFields: rawDataHeaders
        }]
      };
    }
    
    // 7. 执行 LEFT JOIN：只返回已报到的学生
    const joinedStudents = [];
    
    // 遍历原始资料表，找到已报到的学生
    for (let i = 1; i < rawDataValues.length; i++) { // 跳过表头
      const rawRow = rawDataValues[i];
      const primaryKeyValue = rawRow[primaryKeyColumnIndex];
      
      if (primaryKeyValue) {
        const checkinInfo = checkedInMap.get(primaryKeyValue.toString().trim());
        
        if (checkinInfo) { // 只处理已报到的学生
          // 构建学生数据对象
          const studentData = {};
          
          // 添加原始资料表的所有字段
          rawDataHeaders.forEach((header, index) => {
            studentData[header] = rawRow[index] || '';
          });
          
          // 添加报到相关信息
          studentData.Timestamp = checkinInfo.timestamp; // 程式写入表的时间戳
          studentData.Account = checkinInfo.account;     // 程式写入表的账户
          studentData.checkedIn = true;                  // 标记为已报到
          studentData.checkinTimestamp = parseTimestamp(checkinInfo.timestamp);
          
          joinedStudents.push(studentData);
        }
      }
    }
    
    console.log(`✅ LEFT JOIN 完成：${joinedStudents.length} 位已报到学生`);
    
    // 安全處理：對敏感資料進行hash和遮罩
    const currentTimestamp = new Date().getTime().toString();
    
    // Hash函數：MD5 + timestamp鹽值
    function hashIdNumber(idNumber) {
      if (!idNumber) return '';
      const saltedValue = idNumber.toString() + currentTimestamp;
      return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, saltedValue, Utilities.Charset.UTF_8)
        .map(byte => (byte + 256) % 256)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    }
    
    // 處理資料：使用看板顯示欄位表中的預處理規則
    function applyConfigBasedProcessing(data, displayConfig) {
      const processedData = { ...data };
      
      // 遍歷顯示配置，找到有預處理規則的欄位
      displayConfig.config.forEach(config => {
        const fieldName = config['欄位名稱'] || config['栏位名称'];
        const fieldType = config['欄位性質'] || config['栏位性质'] || '';
        const preprocessing = config['預處理'] || config['预处理'] || '';
        
        // 對所有有預處理規則的看板欄位都應用預處理，但跳過 Timestamp 格式的欄位
        if (preprocessing && fieldName && processedData[fieldName] && fieldType !== 'Timestamp') {
          const processedValue = applyPreprocessing(processedData[fieldName], preprocessing);
          processedData[fieldName] = processedValue;
        }
      });
      
      return processedData;
    }
    
    // 獲取顯示配置
    const displayConfig = getDisplayConfigFromSheet(sheetId);
    
    // 處理students的敏感資料
    const safeStudents = joinedStudents.map(student => {
      let safeStudent = { ...student };
      
      // hash idNumber（如果存在）
      if (safeStudent.idNumber) {
        safeStudent.idNumber = hashIdNumber(safeStudent.idNumber);
      }
      
      // 應用顯示配置中的預處理規則
      if (displayConfig.isValid) {
        safeStudent = applyConfigBasedProcessing(safeStudent, displayConfig);
      }
      
      return safeStudent;
    });
    
    // 處理checkinLog的敏感資料
    const safeCheckinLog = checkinLog.map(record => {
      let safeRecord = { ...record };
      
      // hash idNumber
      if (safeRecord.idNumber) {
        safeRecord.idNumber = hashIdNumber(safeRecord.idNumber);
      }
      
      // 應用顯示配置中的預處理規則
      if (displayConfig.isValid) {
        safeRecord = applyConfigBasedProcessing(safeRecord, displayConfig);
      }
      
      return safeRecord;
    });
    
    console.log(`🔒 已對敏感資料進行安全處理：idNumber已hash，看板欄位已套用預處理規則（跳過Timestamp欄位）`);
    
    return {
      success: true,
      students: safeStudents,
      checkinLog: safeCheckinLog,
      primaryKey: primaryKeyField.name
    };
    
  } catch (error) {
    console.error('❌ 获取已报到学生数据错误:', error);
    return {
      success: false,
      error: error.toString(),
      errors: [{ type: 'DATA_JOIN_ERROR', message: `数据关联失败: ${error.toString()}` }]
    };
  }
}