<template>
  <div class="dashboard-container">
    <!-- 統一的活動狀態/錯誤覆蓋層 -->
    <UnifiedOverlay
      :showOverlay="showUnifiedOverlay"
      :mode="overlayMode"
      :activityStatus="overlayStatus"
      :allowClose="allowOverlayClose"
      :currentSheetId="currentSheetId"
      :displayConfig="displayConfig"
      :storageStats="storageStats"
      :configDetails="configDetails"
      :loadingConfigDetails="loadingConfigDetails"
      @close="handleUnifiedOverlayClose"
      @refresh="handleActivityRefresh"
      @mode-change="handleModeChange"
      @load-config-details="loadConfigDetails"
      @clear-ui-settings="clearUISettings"
      @clear-current-sheet-history="clearCurrentSheetHistory"
      @clear-all-data="clearAllData"
      @export-data="exportData"
      @import-data="handleImportData"
      @config-debug-change="handleConfigDebugChange"
      @auto-refresh-interval-change="handleAutoRefreshIntervalChange"
    />

    <!-- 載入動畫 -->
    <LoadingAnimation
      :show="showLoadingAnimation"
      :message="loadingMessage"
      :subMessage="loadingSubMessage"
      :steps="loadingSteps"
      :currentStep="currentLoadingStep"
      :fixed="true"
    />

    <!-- 頭部標題和控制區 -->
    <div class="header">
      <div class="header-left">
        <h1>學生報到系統儀表板</h1>
        
        <!-- 表單選擇器 -->
        <SheetSelector
          :currentSheetId="currentSheetId"
          :availableSheets="availableSheets"
          :loading="loadingSheets"
          @sheet-change="handleSheetChange"
          @refresh-sheets="refreshSheets"
        />
      </div>
      
      <div class="header-right">
        <div class="refresh-info">
          <el-button @click="refreshData" :loading="loading" type="primary" size="small">
            <el-icon><Refresh /></el-icon>
            {{ apiService.hasAutoRefresh ? '立即刷新' : '手動刷新' }}
          </el-button>
          <!-- 自動刷新倒數計時器 -->
          <div v-if="isAutoRefreshActive" class="refresh-countdown-display">
            <div class="refresh-countdown-circle" :style="{ '--progress': refreshCountdownProgress }">
              <span class="refresh-countdown-number">{{ refreshCountdown }}</span>
            </div>
            <span class="refresh-countdown-text">秒後刷新</span>
          </div>
          
          <!-- 統一的設定按鈕 -->
          <el-button @click="openOverlay('settings')" size="small" type="default">
            <el-icon><Setting /></el-icon>
            設定
          </el-button>
          
          <!-- 看板配置按鈕 -->
          <el-button @click="openOverlay('config')" size="small" type="info">
            <el-icon><InfoFilled /></el-icon>
            看板配置
          </el-button>
          
          <!-- 活動狀態指示器 -->
          <div class="activity-status-indicator" :class="`status-${activityStatus.status}`">
            <div class="status-dot"></div>
            <span class="status-text">{{ getActivityStatusText() }}</span>
            <el-button 
              text 
              size="small" 
              @click="openOverlay('activity')"
              class="status-detail-btn"
            >
              詳情
            </el-button>
          </div>
          
          
          <div class="refresh-status">
            <div class="update-time">最後更新: {{ lastUpdateTime }}</div>
            <div class="refresh-mode" :class="{ 'auto-mode': isAutoRefreshActive }">
              {{ isAutoRefreshActive ? `🟢 自動刷新 (${refreshInterval}秒)` : '🔴 手動刷新模式' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="dashboard-content">

      <!-- 活動進行中的正常內容 -->
      <template v-if="canShowDashboard && !configError">
        <!-- 最重要：已報到統計儀表 -->
        <div class="priority-1">
          <CheckinMeter 
            :statistics="statistics"
            :filterType="selectedFilterType"
          />
        </div>

        <!-- 第二重要：學生報到清單 -->
        <div class="priority-2">
          <StudentTable 
            :students="filteredStudents" 
            :loading="loading"
            :newCheckins="filteredNewCheckins"
            :displayConfig="displayConfig"
            :showConfigInfo="showConfigDebug"
            @refresh="refreshData"
          />
        </div>

        <!-- 第三重要：流量表和其他統計 -->
        <div class="priority-3">
          <div class="statistics-grid">
            <!-- 桌面版：儀表在統計區域頂部 -->
            <div class="desktop-meter">
              <CheckinMeter 
                :statistics="statistics"
                :filterType="selectedFilterType"
              />
            </div>
            
            <!-- 流量表 -->
            <el-card class="stat-card flow-chart">
              <template #header>
                <h4>{{ flowChartConfig.title }}</h4>
              </template>
              <FlowChart 
                :data="flowData" 
                :config="flowChartConfig"
                :filterType="selectedFilterType"
                @config-change="onFlowIntervalChange"
              />
            </el-card>

            <!-- 動態統計組件 -->
            <div class="other-stats">
              <TypeStatistics 
                v-for="(config, index) in typeStatisticsConfigs"
                :key="`type-stats-${index}`"
                :statistics="statistics"
                :selectedType="selectedFilterType"
                :config="{ ...config, index }"
                @type-select="handleTypeSelect"
              />
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Setting, Download, Upload, InfoFilled } from '@element-plus/icons-vue'
import StudentTable from './StudentTable.vue'
import CheckinMeter from './CheckinMeter.vue'
import FlowChart from './FlowChart.vue'
import TypeStatistics from './TypeStatistics.vue'
import UnifiedOverlay from './UnifiedOverlay.vue'
import SheetSelector from './SheetSelector.vue'
import LoadingAnimation from './LoadingAnimation.vue'
import apiService from '../services/apiService.js'
import dataProcessor from '../services/dataProcessor.js'
import storageService from '../services/storageService.js'
import markdownService from '../services/markdownService.js'

// 響應式數據
const students = ref([])
const statistics = ref({})
const displayConfig = ref([])
const loading = ref(false)
const lastUpdateTime = ref('')
const newCheckins = ref([])

// 配置錯誤狀態
const configError = ref(null)

// 載入動畫相關
const showLoadingAnimation = ref(false)
const loadingMessage = ref('正在載入資料...')
const loadingSubMessage = ref('')
const loadingSteps = ref([])
const currentLoadingStep = ref(0)
const isInitialLoad = ref(true)
const componentsReady = ref(false)

// 表單管理
const availableSheets = ref([])
const currentSheetId = ref(null)
const loadingSheets = ref(false)

// 篩選類型
const selectedFilterType = ref('all')
const selectedFilterConfig = ref(null) // 追蹤當前選中的過濾器屬於哪個配置

// 修改計算屬性，允許已結束的活動也顯示數據
const canShowDashboard = computed(() => {
  return ['active', 'ended'].includes(activityStatus.value.status)
})

// 活動狀態相關
const activityStatus = ref({
  status: 'inactive',
  message: '載入中...',
  currentEvent: null,
  targetSheetId: null
})
const overlayDismissed = ref(false)

// 自動刷新控制
const refreshInterval = ref(30)
const refreshTimer = ref(null)
const refreshCountdown = ref(30)
const refreshCountdownTimer = ref(null)
const isAutoRefreshActive = computed(() => {
  const hasAutoRefresh = apiService.hasAutoRefresh
  const timerActive = refreshTimer.value
  const activityActive = isActivityActive.value
  const result = hasAutoRefresh && timerActive && activityActive
  
  /*console.log('🔍 isAutoRefreshActive 計算:', {
    hasAutoRefresh,
    timerActive,
    activityActive,
    result,
    timerType: typeof refreshTimer.value,
    timerValue: refreshTimer.value
  })*/
  
  return result
})

// 倒數計時器進度計算
const refreshCountdownProgress = computed(() => {
  return ((refreshInterval.value - refreshCountdown.value) / refreshInterval.value) * 100
})

// 設定對話框
const showUnifiedOverlay = ref(false)
const overlayMode = ref('activity') 
const showConfigDebug = ref(false)
const clearingSettings = ref(false)
const clearingHistory = ref(false)
const clearingAll = ref(false)
const storageStats = ref({})
const checkinLog = ref([]);

// 配置詳情
const configDetails = ref(null)
const loadingConfigDetails = ref(false)

// 流量表配置
const flowChartConfig = ref({
  title: '報到流量表',
  interval: 10,
  timeFormat: 'HH:mm',
  maxDataPoints: 20,
  showGrid: true,
  showPoints: true,
  lineColor: '#409eff',
  fillColor: 'rgba(64, 158, 255, 0.1)'
})

// 計算屬性
const isActivityActive = computed(() => activityStatus.value.status === 'active')

// 統一的覆蓋層狀態 - 這是關鍵改動
const overlayStatus = computed(() => {
  // 如果有配置錯誤，返回錯誤狀態
  if (configError.value) {
    return {
      status: 'error',
      message: configError.value.message,
      details: configError.value.details, // 新增 details 欄位
      currentEvent: null
    }
  }
  
  // 否則返回正常的活動狀態
  return activityStatus.value
})

// 修正 allowOverlayClose 計算屬性
const allowOverlayClose = computed(() => {
  // 配置錯誤時不允許關閉，需要修復
  if (configError.value) {
    return false
  }
  
  // 活動已結束時允許關閉
  if (activityStatus.value.status === 'ended') {
    return true
  }
  
  // 錯誤狀態或已經活躍時才允許關閉
  return activityStatus.value.status === 'error' || activityStatus.value.status === 'active'
})

// 獲取所有 TypeStatistics 配置
const typeStatisticsConfigs = computed(() => {
  return displayConfig.value.filter(config => 
    config.顯示區塊 && config.顯示區塊.includes('TypeStatistics')
  )
})

// 檢查統計組件是否應該顯示
const hasTypeStatistics = computed(() => {
  return typeStatisticsConfigs.value.length > 0
})


const studentTableFieldCount = computed(() => {
  return displayConfig.value.filter(config => 
    config.顯示區塊 && config.顯示區塊.includes('StudentTable')
  ).length
})

const flowData = computed(() => {
  // 如果是全部模式，使用原始統計
  if (selectedFilterType.value === 'all') {
    if (!statistics.value.flowStats) return []
    
    return statistics.value.flowStats.map(item => ({
      time: item.timeLabel,
      count: item.count,
      timestamp: item.timestamp
    }))
  }
  
  // 篩選模式：基於篩選後的學生重新計算流量
  try {
    const filteredFlowStats = dataProcessor.calculateFlowStats(filteredStudents.value, flowChartConfig.value)
    
    return filteredFlowStats.map(item => ({
      time: item.timeLabel,
      count: item.count,
      timestamp: item.timestamp
    }))
  } catch (error) {
    console.error('計算篩選模式流量時發生錯誤:', error)
    return []
  }
})

// 篩選後的學生數據
const filteredStudents = computed(() => {
  if (selectedFilterType.value === 'all') {
    return checkinLog.value
  }
  
  try {
    // 使用當前選中的過濾器配置，如果沒有則使用第一個配置
    let typeStatsConfig = selectedFilterConfig.value
    
    if (!typeStatsConfig) {
      // 兜底方案：使用第一個 TypeStatistics 配置
      typeStatsConfig = displayConfig.value.find(config => 
        config.顯示區塊 && config.顯示區塊.includes('TypeStatistics')
      )
    }
    
    if (!typeStatsConfig) {
      console.warn('找不到 TypeStatistics 配置，返回所有學生')
      return checkinLog.value
    }
    
    // 根據選中的類型篩選學生
    return checkinLog.value.filter(student => {
      const studentType = dataProcessor.getStudentTypeValue(student, typeStatsConfig)
      return studentType === selectedFilterType.value
    })
  } catch (error) {
    console.error('篩選學生時發生錯誤:', error)
    return checkinLog.value
  }
})

// 篩選後的新報到學生
const filteredNewCheckins = computed(() => {
  if (selectedFilterType.value === 'all') {
    return newCheckins.value
  }
  
  try {
    // 使用當前選中的過濾器配置，如果沒有則使用第一個配置
    let typeStatsConfig = selectedFilterConfig.value
    
    if (!typeStatsConfig) {
      // 兜底方案：使用第一個 TypeStatistics 配置
      typeStatsConfig = displayConfig.value.find(config => 
        config.顯示區塊 && config.顯示區塊.includes('TypeStatistics')
      )
    }
    
    if (!typeStatsConfig) {
      return newCheckins.value
    }
    
    return newCheckins.value.filter(student => {
      const studentType = dataProcessor.getStudentTypeValue(student, typeStatsConfig)
      return studentType === selectedFilterType.value
    })
  } catch (error) {
    console.error('篩選新報到學生時發生錯誤:', error)
    return newCheckins.value
  }
})

// 方法定義
const getBlockDisplayName = (blockName) => {
  const names = {
    'StudentTable': '📋 學生列表',
    'TypeStatistics': '📊 身分別統計',
    'Other': '📦 其他'
  }
  return names[blockName] || blockName
}

const formatTooltip = (value) => {
  if (value < 60) {
    return `${value}秒`
  } else {
    const minutes = Math.floor(value / 60)
    const seconds = value % 60
    return seconds === 0 ? `${minutes}分鐘` : `${minutes}.${seconds/60*10}分鐘`
  }
}

const formatDateTime = (timestamp) => {
  if (!timestamp) return '未設定'
  const date = new Date(timestamp)
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short'
  })
}

const getEventDuration = () => {
  if (!activityStatus.value.currentEvent) return '未知'
  
  const start = activityStatus.value.currentEvent.startTimestamp
  const end = activityStatus.value.currentEvent.endTimestamp
  
  if (!start || !end) return '未知'
  
  const duration = end - start
  const hours = Math.floor(duration / (1000 * 60 * 60))
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))
  
  if (hours > 0) {
    return `${hours}小時${minutes > 0 ? ` ${minutes}分鐘` : ''}`
  } else {
    return `${minutes}分鐘`
  }
}

// 滑動條配置
const sliderMarks = {
  30: '30秒',
  60: '1分鐘',
  90: '1.5分鐘',
  120: '2分鐘',
  150: '2.5分鐘',
  180: '3分鐘'
}

const getEventInfoTitle = () => {
  switch (activityStatus.value.status) {
    case 'pending':
      return '📅 即將開始的活動'
    case 'ended':
      return '📋 剛結束的活動'
    case 'error':
      return '⚠️ 活動資訊'
    default:
      return '📋 活動資訊'
  }
}

const getActivityStatusText = () => {
  switch (activityStatus.value.status) {
    case 'active':
      return '進行中'
    case 'pending':
      return '準備中'
    case 'ended':
      return '已結束'
    case 'error':
      return '系統錯誤'
    default:
      return '待機中'
  }
}

// 載入 UI 設定
const loadUISettings = () => {
  const settings = storageService.getUISettings()
  refreshInterval.value = settings.refreshInterval
  flowChartConfig.value.interval = settings.flowChartInterval
  selectedFilterType.value = settings.filterType
  currentSheetId.value = settings.selectedSheetId
  showConfigDebug.value = settings.showConfigDebug || false
  
  console.log('📋 已載入 UI 設定:', settings)
}

// 保存 UI 設定
const saveUISettings = () => {
  const settings = {
    refreshInterval: refreshInterval.value,
    flowChartInterval: flowChartConfig.value.interval,
    filterType: selectedFilterType.value,
    selectedSheetId: currentSheetId.value,
    showConfigDebug: showConfigDebug.value
  }
  
  storageService.saveUISettings(settings)
}

// 載入配置詳情
const loadConfigDetails = async () => {
  if (!currentSheetId.value) {
    ElMessage.warning('請先選擇表單')
    return
  }
  
  loadingConfigDetails.value = true
  try {
    const response = await apiService.getConfigDetails(currentSheetId.value)
    
    if (response.success) {
      configDetails.value = response.details
    } else {
      ElMessage.error(`載入配置詳情失敗: ${response.error}`)
    }
  } catch (error) {
    console.error('載入配置詳情失敗:', error)
    ElMessage.error('載入配置詳情失敗')
  } finally {
    loadingConfigDetails.value = false
  }
}

// 刷新表單列表
const refreshSheets = async () => {
  loadingSheets.value = true
  try {
    const response = await apiService.getAvailableSheets()
    if (response.success) {
      availableSheets.value = response.sheets || []
      currentSheetId.value = response.defaultSheetId
      
      console.log(`📋 已載入 ${availableSheets.value.length} 個表單`)
    }
  } catch (error) {
    console.error('載入表單列表失敗:', error)
    ElMessage.error('載入表單列表失敗')
  } finally {
    loadingSheets.value = false
  }
}

// 處理表單切換
const handleSheetChange = (sheetId) => {
  const previousSheetId = currentSheetId.value
  currentSheetId.value = sheetId
  
  // 重置篩選
  selectedFilterType.value = 'all'
  selectedFilterConfig.value = null
  
  // 清空錯誤狀態
  configError.value = null
  overlayDismissed.value = false // 重置覆蓋層狀態
  
  // 清空配置詳情
  configDetails.value = null
  
  // 保存設定
  saveUISettings()
  
  // 清空當前數據
  students.value = []
  checkinLog.value = []
  statistics.value = {}
  displayConfig.value = []
  newCheckins.value = []
  
  console.log(`📋 表單切換: ${previousSheetId} → ${sheetId}`)
  
  // 刷新數據
  refreshData()
}

// 處理類型選擇
const handleTypeSelect = (typeName, config = null) => {
  selectedFilterType.value = typeName
  selectedFilterConfig.value = config
  saveUISettings()
  
  console.log(`📊 類型篩選切換為: ${typeName}`, config ? `，使用配置: ${config.欄位名稱}` : '')
}

// 設置自動刷新 - 改良版本
const setupAutoRefresh = () => {
  // 清除舊的計時器
  if (refreshTimer.value) {
    // refreshTimer 現在只用於狀態標記，不是實際的定時器 ID
    refreshTimer.value = null
  }
  if (refreshCountdownTimer.value) {
    clearInterval(refreshCountdownTimer.value)
    refreshCountdownTimer.value = null
  }
  
  // 確保組件都已準備好且不是初次載入
  if (apiService.hasAutoRefresh && isActivityActive.value && componentsReady.value && !isInitialLoad.value) {
    // 重置倒數計時器
    refreshCountdown.value = refreshInterval.value
    
    // 啟動倒數計時器（每秒更新一次）
    refreshCountdownTimer.value = setInterval(() => {
      refreshCountdown.value--
      if (refreshCountdown.value <= 0) {
        refreshData()
        refreshCountdown.value = refreshInterval.value
      }
    }, 1000)
    
    // 設置 refreshTimer 為 true 表示自動刷新已啟用 (用於狀態檢查)
    refreshTimer.value = true
    
    console.log(`✅ 自動刷新已啟用（每${refreshInterval.value}秒），倒數計時器已啟動`)
    console.log('🔧 setupAutoRefresh 設置後:', {
      refreshTimerValue: refreshTimer.value,
      apiServiceHasAutoRefresh: apiService.hasAutoRefresh,
      isActivityActiveValue: isActivityActive.value,
      componentsReadyValue: componentsReady.value,
      isInitialLoadValue: isInitialLoad.value
    })
  } else {
    console.log(`⏸️ 自動刷新暫停：活動狀態=${isActivityActive.value}, 組件準備=${componentsReady.value}, 初次載入=${isInitialLoad.value}`)
  }
}

// 監聽刷新間隔變化
const onRefreshIntervalChange = (value) => {
  refreshInterval.value = value
  saveUISettings()
  setupAutoRefresh()
}

// 修改流量表間隔變化處理
const onFlowIntervalChange = (newInterval) => {
  flowChartConfig.value.interval = newInterval
  saveUISettings()
  console.log(`流量表間隔已更改為: ${newInterval}分鐘`)
  
  // 重新計算流量統計
  if (checkinLog.value.length > 0) {
    const newFlowData = dataProcessor.calculateFlowStats(checkinLog.value, {
      interval: newInterval,
      maxDataPoints: 20,
      timeFormat: 'HH:mm'
    });
    
    // 更新統計中的流量數據
    statistics.value = {
      ...statistics.value,
      flowStats: newFlowData
    };
  }
}

// 完整的 refreshData 函數 - 加入載入動畫
const refreshData = async () => {
  if (!currentSheetId.value) {
    console.log('📋 沒有選中的表單，跳過數據刷新')
    return
  }
  
  // 重置倒數計時器（如果有的話）
  if (isAutoRefreshActive.value) {
    refreshCountdown.value = refreshInterval.value
  }
  
  loading.value = true
  configError.value = null // 清空配置錯誤
  
  // 顯示載入動畫（僅在初次載入或大量資料時）
  const shouldShowLoading = isInitialLoad.value || checkinLog.value.length > 100
  if (shouldShowLoading) {
    showLoadingAnimation.value = true
    loadingSteps.value = [
      '連接伺服器',
      '載入表單資料', 
      '處理報到記錄',
      '計算統計數據',
      '更新介面'
    ]
    currentLoadingStep.value = 0
    loadingMessage.value = '正在載入資料...'
    loadingSubMessage.value = `表單: ${currentSheetId.value}`
  }
  
  try {
    // 步驟 1: 連接伺服器
    if (shouldShowLoading) {
      currentLoadingStep.value = 1
      loadingMessage.value = '正在載入表單資料...'
    }
    
    const rawData = await apiService.getDashboardData(currentSheetId.value)
    
    // 步驟 2: 載入完成，開始處理
    if (shouldShowLoading) {
      currentLoadingStep.value = 2
      loadingMessage.value = '正在處理報到記錄...'
    }
    
    // 檢查配置錯誤
    if (!rawData.success && rawData.configErrors) {
      configError.value = {
        message: rawData.error || '配置錯誤',
        details: rawData.configErrors
      }
      // 顯示覆蓋層
      overlayMode.value = 'activity'
      showUnifiedOverlay.value = true
      overlayDismissed.value = false
      return
    }
    
    // 更新活動狀態
    if (rawData.activityStatus) {
      const previousStatus = activityStatus.value.status
      activityStatus.value = rawData.activityStatus
      
      // 檢查狀態變化
      if (previousStatus !== activityStatus.value.status) {
        console.log(`📊 活動狀態變化: ${previousStatus} → ${activityStatus.value.status}`)
        
        // 如果狀態改變且覆蓋層被關閉，重新顯示
        if (!allowOverlayClose.value || (previousStatus === 'active' && activityStatus.value.status !== 'active')) {
          overlayDismissed.value = false
        }
      }
    }
    
    // 修改：允許 active 和 ended 狀態都處理學生數據
    if (canShowDashboard.value && rawData.students && rawData.displayConfig) {
      displayConfig.value = rawData.displayConfig
      
      // 步驟 3: 計算統計數據
      if (shouldShowLoading) {
        currentLoadingStep.value = 3
        loadingMessage.value = '正在計算統計數據...'
      }
      
      const processedData = dataProcessor.processDashboardData(rawData, flowChartConfig.value, selectedFilterType.value, checkinLog.value)
      // 只有在活動進行中才檢測新報到學生
      if (isActivityActive.value) {
        // 使用 localStorage 檢測新報到學生
        const detectedNewCheckins = storageService.detectNewCheckins(processedData.students, currentSheetId.value)
        
        if (detectedNewCheckins.length > 0) {
          newCheckins.value = detectedNewCheckins
          ElMessage.success(`🎉 ${detectedNewCheckins.length} 位學生新完成報到！`)
          setTimeout(() => {
            newCheckins.value = []
          }, 8000)
        }
      } else {
        // 活動已結束，清空新報到提示但保留歷史數據
        newCheckins.value = []
        
        // 如果活動剛剛結束，顯示最終統計
        if (activityStatus.value.status === 'ended') {
          const finalStats = processedData.statistics
          console.log('📊 活動已結束，最終統計:', {
            totalStudents: finalStats.total,
            checkedIn: finalStats.checkedIn,
            checkinRate: finalStats.checkinRate + '%'
          })
        }
      }
      
      // 步驟 4: 更新介面
      if (shouldShowLoading) {
        currentLoadingStep.value = 4
        loadingMessage.value = '正在更新介面...'
      }
      
      students.value = processedData.students
      checkinLog.value = processedData.checkinLog
      statistics.value = processedData.statistics
      
      console.log('數據更新成功:', {
        sheetId: currentSheetId.value,
        activityStatus: activityStatus.value.status,
        studentsCount: students.value.length,
        checkinLogCount: checkinLog.value.length,
        checkedInCount: statistics.value.checkedIn || 0,
        checkinRate: statistics.value.checkinRate || 0,
        newCheckins: newCheckins.value.length,
        filterType: selectedFilterType.value,
        configFields: displayConfig.value.length,
        canShowDashboard: canShowDashboard.value
      })
      
      // 根據活動狀態給出不同提示
      if (activityStatus.value.status === 'ended') {
        console.log('📋 活動已結束，顯示最終報到統計')
      } else if (activityStatus.value.status === 'active') {
        console.log('🟢 活動進行中，實時更新報到數據')
      }
      
    } else if (!canShowDashboard.value) {
      // 活動狀態不允許顯示儀表板（pending, error, inactive 等）
      students.value = []
      checkinLog.value = []
      statistics.value = {}
      displayConfig.value = []
      newCheckins.value = []
      
      console.log(`📋 活動狀態為 ${activityStatus.value.status}，清空儀表板數據`)
      
    } else {
      // 數據不完整或有其他問題
      console.warn('⚠️ 數據不完整，無法顯示儀表板:', {
        hasStudents: !!rawData.students,
        hasDisplayConfig: !!rawData.displayConfig,
        canShowDashboard: canShowDashboard.value
      })
      
      // 如果之前有數據，保留它們（避免閃爍）
      if (students.value.length === 0) {
        statistics.value = {}
        checkinLog.value = []
        displayConfig.value = []
        newCheckins.value = []
      }
    }
    
    // 更新最後更新時間
    lastUpdateTime.value = new Date().toLocaleString('zh-TW')
    
    // 根據活動狀態決定是否需要重新設置自動刷新
    if (activityStatus.value.status === 'ended') {
      // 活動結束，可以考慮降低刷新頻率或停止自動刷新
      console.log('📋 活動已結束，考慮調整自動刷新策略')
    }
    
  } catch (error) {
    console.error('刷新數據失敗:', error)
    ElMessage.error(`數據刷新失敗: ${error.message}`)
    
    // 增強的錯誤處理 - 檢測 API key 錯誤
    let errorMessage = `連線錯誤: ${error.message}`
    let isApiKeyError = false
    
    // 檢測可能的 API key 相關錯誤
    if (error.message) {
      const errorMsg = error.message.toLowerCase()
      if (errorMsg.includes('unauthorized') || 
          errorMsg.includes('forbidden') || 
          errorMsg.includes('access denied') ||
          errorMsg.includes('api key') ||
          errorMsg.includes('authentication') ||
          errorMsg.includes('permission')) {
        errorMessage = 'API 密鑰驗證失敗，自動更新已停止'
        isApiKeyError = true
      }
    }
    
    // 如果是網路錯誤，更新活動狀態
    activityStatus.value = {
      status: 'error',
      message: errorMessage,
      currentEvent: null,
      isApiKeyError: isApiKeyError // 標記是否為 API key 錯誤
    }
    
    // 顯示錯誤覆蓋層
    overlayMode.value = 'activity'
    showUnifiedOverlay.value = true
    overlayDismissed.value = false
    
    // 如果是 API key 錯誤，額外提示
    if (isApiKeyError) {
      console.warn('🔑 檢測到 API 密鑰錯誤，自動刷新功能已停止')
      ElMessage.warning('API 密鑰驗證失敗，請檢查系統設定')
      
      // 停止自動刷新
      if (refreshTimer.value) {
        refreshTimer.value = null
      }
      if (refreshCountdownTimer.value) {
        clearInterval(refreshCountdownTimer.value)
        refreshCountdownTimer.value = null
      }
    }
    
    // 保留現有數據，避免因為網路錯誤而清空已顯示的數據
    console.log('💾 保留現有數據以避免數據丟失')
    
  } finally {
    loading.value = false
    
    // 隱藏載入動畫
    if (shouldShowLoading) {
      currentLoadingStep.value = 4 // 完成
      loadingMessage.value = '載入完成'
      
      // 延遲隱藏動畫，讓用戶看到完成狀態
      setTimeout(() => {
        showLoadingAnimation.value = false
      }, 500)
    }
  }
}

// 活動狀態刷新
const handleActivityRefresh = async () => {
  await refreshData()
}

// 更新存儲統計
const updateStorageStats = () => {
  storageStats.value = storageService.getStorageStats()
}

// 清除 UI 設定
const clearUISettings = async () => {
  try {
    storageService.clearUISettings()
    loadUISettings()
    ElMessage.success('UI 設定已清除')
    updateStorageStats()
  } catch (error) {
    ElMessage.error('清除 UI 設定失敗')
  }
}

// 清除當前表單的報到記錄
const clearCurrentSheetHistory = async () => {
  if (!currentSheetId.value) return
  
  try {
    storageService.clearSheetCheckinHistory(currentSheetId.value)
    ElMessage.success('當前表單的報到記錄已清除')
    updateStorageStats()
  } catch (error) {
    ElMessage.error('清除報到記錄失敗')
  }
}

// 清除所有本地數據
const clearAllData = async () => {
  try {
    storageService.clearAllData()
    loadUISettings()
    ElMessage.success('所有本地數據已清除')
    updateStorageStats()
  } catch (error) {
    ElMessage.error('清除數據失敗')
  }
}

// 導出數據
const exportData = () => {
  const exportResult = storageService.exportData()
  if (exportResult.success) {
    const dataStr = JSON.stringify(exportResult, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `checkin-data-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
    ElMessage.success('數據導出成功')
  } else {
    ElMessage.error('數據導出失敗')
  }
}

// 導入數據
const handleImportData = (file) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const importData = JSON.parse(e.target.result)
      const result = storageService.importData(importData)
      
      if (result.success) {
        ElMessage.success('數據導入成功')
        loadUISettings()
        updateStorageStats()
      } else {
        ElMessage.error(`數據導入失敗: ${result.error}`)
      }
    } catch (error) {
      ElMessage.error('無效的數據格式')
    }
  }
  reader.readAsText(file.raw)
}

const openOverlay = (mode) => {
  overlayMode.value = mode
  showUnifiedOverlay.value = true
  overlayDismissed.value = false
  
  // 如果是配置模式且沒有數據，則載入
  if (mode === 'config' && !configDetails.value) {
    loadConfigDetails()
  }
  
  // 如果是設定模式，更新存儲統計
  if (mode === 'settings') {
    updateStorageStats()
  }
}

const handleUnifiedOverlayClose = () => {
  showUnifiedOverlay.value = false
  overlayDismissed.value = true
}

const handleModeChange = (mode) => {
  overlayMode.value = mode
  
  // 模式切換時的特殊處理
  if (mode === 'config' && !configDetails.value) {
    loadConfigDetails()
  }
  
  if (mode === 'settings') {
    updateStorageStats()
  }
}

const handleConfigDebugChange = (value) => {
  showConfigDebug.value = value
  saveUISettings()
}

const handleAutoRefreshIntervalChange = (value) => {
  console.log(`🔄 更新自動刷新間隔: ${value}秒`)
  refreshInterval.value = value
  saveUISettings()
  setupAutoRefresh() // 重新設置自動刷新
}

// 監聽活動狀態變化
watch(() => activityStatus.value.status, (newStatus, oldStatus) => {
  setupAutoRefresh()
  
  // 簡化處理：活動開啟時自動顯示詳情
  if (newStatus !== 'inactive' && !overlayDismissed.value) {
    overlayMode.value = 'activity'
    showUnifiedOverlay.value = true
  }
}, { immediate: false })

// 監聽組件準備狀態變化
watch(componentsReady, (ready) => {
  if (ready) {
    setupAutoRefresh()
  }
})

// 監聽配置錯誤變化
watch(configError, (newError) => {
  if (newError) {
    overlayMode.value = 'activity'
    showUnifiedOverlay.value = true
    overlayDismissed.value = false
  }
})

// 監聽活動激活狀態
watch(isActivityActive, (isActive) => {
  setupAutoRefresh()
  
  if (isActive) {
    ElMessage.success('📢 報到活動已開始！')
  } else {
    ElMessage.info('📋 報到活動已暫停')
  }
})

// 監聽篩選類型變化，重新計算統計
watch(selectedFilterType, (newType) => {
  if (checkinLog.value.length > 0 && displayConfig.value.length > 0) {
    const lastRawData = {
      students: checkinLog.value,
      checkinLog: [],
      displayConfig: displayConfig.value,
      timestamp: new Date().toISOString()
    }
    
    const processedData = dataProcessor.processDashboardData(lastRawData, flowChartConfig.value, newType, [])
    statistics.value = processedData.statistics
  }
})

onMounted(async () => {
  console.log('🚀 StudentDashboard 開始載入')
  
  // 檢查 localStorage 支援
  if (!storageService.isSupported()) {
    ElMessage.warning('瀏覽器不支援本地存儲，部分功能可能無法正常使用')
  }
  
  // 載入 UI 設定
  loadUISettings()
  
  // 載入表單列表
  await refreshSheets()
  
  // 初始化數據
  if (currentSheetId.value) {
    await refreshData()
  }
  
  // 等待 DOM 更新完成
  await nextTick()
  
  // 等待一小段時間確保所有組件都已渲染
  setTimeout(async () => {
    componentsReady.value = true
    isInitialLoad.value = false
    console.log('✅ 所有組件已準備完成，可以開始自動刷新')
    
    // 設置自動刷新
    setupAutoRefresh()
    
    // 首次加載時，如果不是活躍狀態或有配置錯誤則顯示覆蓋層
    // 修正：活動已結束時不自動顯示覆蓋層
    if (!isActivityActive.value && activityStatus.value.status !== 'ended' || configError.value) {
      overlayMode.value = 'activity'
      showUnifiedOverlay.value = true
    }
  }, 2000) // 給足夠時間讓所有組件載入
  
  // 更新存儲統計
  updateStorageStats()
})

onUnmounted(() => {
  if (refreshTimer.value) {
    refreshTimer.value = null
  }
  if (refreshCountdownTimer.value) {
    clearInterval(refreshCountdownTimer.value)
    refreshCountdownTimer.value = null
  }
})
</script>

<style scoped>
.dashboard-container {
  min-height: 100vh;
  background-color: #1a1a1a;
  padding: 20px;
  /* 修正：防止橫向滾動條 */
  overflow-x: hidden;
  box-sizing: border-box;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #4a4a4a;
  gap: 20px;
  /* 修正：確保頭部不會超出容器 */
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 20px;
  /* 修正：確保左側內容不會過度擴展 */
  flex: 0 1 auto;
  min-width: 0;
  flex-wrap: wrap;
}

.header-left h1 {
  color: #ffffff;
  font-size: 24px;
  font-weight: bold;
  margin: 0;
  /* 修正：允許標題換行 */
  word-wrap: break-word;
}

.header-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  /* 修正：確保右側內容不會超出 */
  min-width: 0;
}

.refresh-info {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  /* 修正：確保內容不會超出容器 */
  max-width: 100%;
}

/* 自動刷新倒數計時器樣式 */
.refresh-countdown-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.refresh-countdown-circle {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: conic-gradient(
    #409eff 0deg,
    #409eff calc(var(--progress) * 3.6deg),
    rgba(64, 158, 255, 0.2) calc(var(--progress) * 3.6deg),
    rgba(64, 158, 255, 0.2) 360deg
  );
  display: flex;
  align-items: center;
  justify-content: center;
}

.refresh-countdown-circle::before {
  content: '';
  position: absolute;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: #1a1a1a;
}

.refresh-countdown-number {
  color: #409eff;
  font-size: 12px;
  font-weight: 600;
  z-index: 1;
  position: relative;
}

.refresh-countdown-text {
  color: #a0a0a0;
  font-size: 12px;
  white-space: nowrap;
}

.activity-status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  /* 修正：確保狀態指示器不會過寬 */
  max-width: 300px;
  min-width: 0;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: statusPulse 2s ease-in-out infinite;
  flex-shrink: 0;
}

.status-active .status-dot {
  background-color: #67C23A;
  box-shadow: 0 0 8px rgba(103, 194, 58, 0.6);
}

.status-pending .status-dot {
  background-color: #E6A23C;
  box-shadow: 0 0 8px rgba(230, 162, 60, 0.6);
}

.status-ended .status-dot, 
.status-error .status-dot {
  background-color: #F56C6C;
  box-shadow: 0 0 8px rgba(245, 108, 108, 0.6);
}

.status-inactive .status-dot {
  background-color: #909399;
  box-shadow: 0 0 8px rgba(144, 147, 153, 0.6);
}

@keyframes statusPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.2);
  }
}

.status-text {
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  /* 修正：允許文字換行 */
  word-wrap: break-word;
  flex: 1;
  min-width: 0;
}

.status-detail-btn {
  color: #409eff !important;
  padding: 2px 6px !important;
  height: auto !important;
  font-size: 12px !important;
  flex-shrink: 0;
}

.refresh-control {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  /* 修正：確保控制器不會過寬 */
  max-width: 250px;
}

.control-label {
  color: #cccccc;
  font-size: 12px;
  white-space: nowrap;
}

.slider-container {
  display: flex;
  align-items: center;
  /* 修正：確保滑塊容器寬度合適 */
  width: 100%;
  max-width: 200px;
}

.refresh-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
  /* 修正：確保狀態顯示不會過寬 */
  max-width: 200px;
  min-width: 0;
}

.update-time {
  color: #cccccc;
  font-size: 14px;
  /* 修正：允許時間文字換行 */
  word-wrap: break-word;
}

.refresh-mode {
  color: #F56C6C;
  font-size: 12px;
  font-weight: bold;
  /* 修正：允許模式文字換行 */
  word-wrap: break-word;
}

.refresh-mode.auto-mode {
  color: #67C23A;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: calc(100vh - 140px);
  /* 修正：確保內容不會超出 */
  overflow-x: hidden;
}

.notice-row {
  width: 100%;
  /* 修正：確保通知行不會超出 */
  box-sizing: border-box;
}

/* 動態 Notice 內容樣式 */
.dynamic-notice-content {
  line-height: 1.6;
  font-size: 14px;
  color: #333333;
  /* 修正：確保通知內容不會超出 */
  word-wrap: break-word;
}

.dynamic-notice-content :deep(.notice-content) {
  color: #333333;
}

.dynamic-notice-content :deep(.notice-title) {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 15px;
  color: #E6A23C;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  gap: 8px;
  /* 修正：允許標題換行 */
  flex-wrap: wrap;
}

.dynamic-notice-content :deep(.notice-h2) {
  font-size: 18px;
  font-weight: bold;
  margin: 15px 0 10px 0;
  color: #409eff;
  border-left: 4px solid #409eff;
  padding-left: 12px;
  /* 修正：允許標題換行 */
  word-wrap: break-word;
}

.dynamic-notice-content :deep(.notice-h3) {
  font-size: 16px;
  font-weight: 600;
  margin: 12px 0 8px 0;
  color: #67C23A;
  word-wrap: break-word;
}

.dynamic-notice-content :deep(.notice-text) {
  margin-bottom: 12px;
  line-height: 1.8;
  color: #333333;
  word-wrap: break-word;
}

.dynamic-notice-content :deep(.notice-important) {
  color: #E6A23C;
  font-weight: bold;
  background-color: rgba(230, 162, 60, 0.1);
  padding: 2px 4px;
  border-radius: 3px;
  word-wrap: break-word;
}

.dynamic-notice-content :deep(.notice-emphasis) {
  color: #409eff;
  font-style: normal;
  font-weight: 500;
}

.dynamic-notice-content :deep(.notice-code) {
  background-color: rgba(0, 0, 0, 0.1);
  color: #E6A23C;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  word-break: break-all;
}

.dynamic-notice-content :deep(.notice-highlight) {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.1) 0%, rgba(103, 194, 58, 0.1) 100%);
  border-left: 4px solid #409eff;
  padding: 8px 12px;
  margin: 8px 0;
  border-radius: 4px;
  font-weight: 500;
  word-wrap: break-word;
}

.dynamic-notice-content :deep(.notice-list) {
  margin: 10px 0;
  padding-left: 20px;
}

.dynamic-notice-content :deep(.notice-list-item) {
  margin-bottom: 6px;
  line-height: 1.6;
  color: #333333;
  word-wrap: break-word;
}

.dynamic-notice-content :deep(.notice-list-item::marker) {
  color: #409eff;
}

/* 活動未啟動時的占位內容 */
.inactive-content {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  padding: 40px 20px;
}

.inactive-placeholder {
  text-align: center;
  max-width: 600px;
  padding: 40px;
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  border-radius: 16px;
  border: 2px solid #4a4a4a;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  /* 修正：確保占位內容不會超出 */
  width: 100%;
  box-sizing: border-box;
  word-wrap: break-word;
}

.placeholder-icon {
  font-size: 64px;
  margin-bottom: 20px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

.placeholder-title {
  color: #ffffff;
  font-size: 28px;
  font-weight: bold;
  margin: 0 0 15px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  word-wrap: break-word;
}

.placeholder-message {
  color: #cccccc;
  font-size: 16px;
  line-height: 1.6;
  margin: 0 0 30px 0;
  word-wrap: break-word;
}

.next-event-info {
  margin: 30px 0;
  padding: 20px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border-left: 4px solid #409eff;
  word-wrap: break-word;
}

.next-event-info h3 {
  color: #ffffff;
  font-size: 18px;
  margin: 0 0 15px 0;
  word-wrap: break-word;
}

.event-card {
  background: rgba(255, 255, 255, 0.05);
  padding: 15px;
  border-radius: 6px;
}

.event-title {
  color: #409eff;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 8px;
  word-wrap: break-word;
}

.event-time-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.time-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.03);
  transition: all 0.2s ease;
  /* 修正：允許時間行換行 */
  flex-wrap: wrap;
}

.time-row:hover {
  background: rgba(255, 255, 255, 0.08);
}

.time-row.primary {
  background: rgba(64, 158, 255, 0.15);
  border-left: 3px solid #409eff;
}

.time-row.primary.ended {
  background: rgba(245, 108, 108, 0.15);
  border-left-color: #F56C6C;
}

.time-row.duration {
  background: rgba(103, 194, 58, 0.1);
  border-left: 3px solid #67C23A;
}

.time-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.time-label {
  color: #cccccc;
  font-size: 13px;
  min-width: 70px;
  flex-shrink: 0;
}

.time-value {
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Courier New', monospace;
  flex: 1;
  word-wrap: break-word;
}

.time-row.primary .time-value {
  color: #66b1ff;
  font-weight: bold;
}

.time-row.primary.ended .time-value {
  color: #ff8a8a;
  font-weight: bold;
}

.time-row.duration .time-value {
  color: #85ce61;
  font-weight: bold;
}

.placeholder-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
  flex-wrap: wrap;
}

/* 預設隱藏桌面版儀表 */
.desktop-meter {
  display: none;
}

/* 流量表卡片樣式 */
.stat-card {
  background-color: #2d2d2d;
  border: 1px solid #4a4a4a;
  /* 修正：確保卡片不會超出 */
  overflow: hidden;
}

.stat-card :deep(.el-card__header) {
  background-color: #3a3a3a;
  border-bottom: 1px solid #4a4a4a;
  padding: 15px 20px;
}

.stat-card h4 {
  color: #ffffff;
  margin: 0;
  font-size: 14px;
  font-weight: bold;
  word-wrap: break-word;
}

/* 預設隱藏桌面版儀表 */
.desktop-meter {
  display: none;
}

/* 響應式布局 */
@media (min-width: 1024px) {
  .dashboard-content {
    display: grid;
    grid-template-columns: 1fr 400px;
    grid-template-rows: auto 1fr;
    grid-template-areas: 
      "notice notice"
      "table stats";
    gap: 20px;
  }
  
  .priority-1 {
    display: none;
  }
  
  .priority-2 {
    grid-area: table;
  }
  
  .priority-3 {
    grid-area: stats;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .notice-row {
    grid-area: notice;
  }
  
  .statistics-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
    height: 100%;
  }
  
  .desktop-meter {
    display: block;
  }
  
  .other-stats {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  
  .inactive-content {
    grid-column: 1 / -1;
    grid-row: 1 / -1;
  }
  
  .ended-activity-notice {
    grid-area: notice;
  }
  
  .ended-notice {
    background: linear-gradient(135deg, #E8F4FD 0%, #E1F3F8 100%);
    border: 2px solid #409eff;
    border-radius: 12px;
  }
  
  .ended-notice :deep(.el-alert__icon) {
    color: #409eff;
    font-size: 24px;
  }
  
  .dynamic-notice-content {
    font-size: 16px;
  }
  
  .dynamic-notice-content :deep(.notice-title) {
    font-size: 22px;
  }
  
  .dynamic-notice-content :deep(.notice-h2) {
    font-size: 20px;
  }
  
  .dynamic-notice-content :deep(.notice-text) {
    font-size: 16px;
  }
}

/* 手機版響應式 */
@media (max-width: 767px) {
  .dashboard-container {
    padding: 10px;
  }
  
  .header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
  
  .header-left {
    width: 100%;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 15px;
  }
  
  .header-left h1 {
    font-size: 18px;
  }
  
  .header-right {
    width: 100%;
    justify-content: center;
  }
  
  .refresh-info {
    flex-direction: column;
    gap: 12px;
    width: 100%;
    align-items: center;
  }
  
  .activity-status-indicator {
    justify-content: center;
    width: 100%;
    max-width: none;
  }
  
  .refresh-control {
    width: 100%;
    max-width: none;
  }
  
  .slider-container {
    width: 100%;
    justify-content: center;
    max-width: none;
  }
  
  .refresh-control .el-slider {
    width: 250px !important;
  }
  
  .refresh-status {
    width: 100%;
    max-width: none;
    text-align: center;
  }
  
  .dashboard-content {
    gap: 15px;
  }
  
  .statistics-grid {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  
  .other-stats {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  
  .placeholder-actions {
    flex-direction: column;
    gap: 10px;
  }
  
  .placeholder-actions .el-button {
    width: 100%;
  }
  
  .dynamic-notice-content {
    font-size: 13px;
  }
  
  .dynamic-notice-content :deep(.notice-title) {
    font-size: 16px;
    margin-bottom: 10px;
  }
  
  .dynamic-notice-content :deep(.notice-h2) {
    font-size: 15px;
    margin: 10px 0 6px 0;
  }
  
  .dynamic-notice-content :deep(.notice-h3) {
    font-size: 14px;
    margin: 8px 0 4px 0;
  }
  
  .dynamic-notice-content :deep(.notice-text) {
    line-height: 1.6;
    margin-bottom: 8px;
  }
  
  .dynamic-notice-content :deep(.notice-highlight) {
    padding: 6px 8px;
    margin: 6px 0;
  }
  
  .dynamic-notice-content :deep(.notice-list) {
    padding-left: 16px;
  }
}

.ended-activity-notice {
  margin-bottom: 20px;
  /* 修正：確保通知不會超出 */
  width: 100%;
  box-sizing: border-box;
}

.ended-notice {
  background: linear-gradient(135deg, #E8F4FD 0%, #E1F3F8 100%);
  border: 2px solid #409eff;
  border-radius: 12px;
}

.ended-notice-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  /* 修正：確保內容不會超出 */
  word-wrap: break-word;
}

.data-note {
  font-size: 12px;
  color: #666666;
  font-style: italic;
}

/* Element Plus 深色主題適配 */
:deep(.el-button) {
  border-radius: 8px;
}

:deep(.el-button--primary) {
  background-color: #409eff;
  border-color: #409eff;
}

:deep(.el-button--primary:hover) {
  background-color: #66b1ff;
  border-color: #66b1ff;
}

:deep(.el-button--default) {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

:deep(.el-button--default:hover) {
  background-color: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

:deep(.el-button.is-loading) {
  opacity: 0.7;
}

/* 深色主題下的 Alert 樣式 */
:deep(.el-alert--info) {
  background-color: rgba(64, 158, 255, 0.1);
  border-color: #409eff;
  color: #ffffff;
}

:deep(.el-alert__icon) {
  color: #409eff;
}

:deep(.el-alert__title) {
  color: #ffffff;
  font-weight: 500;
}

/* 滾動條樣式 */
.dashboard-container::-webkit-scrollbar {
  width: 8px;
}

.dashboard-container::-webkit-scrollbar-track {
  background: #2d2d2d;
}

.dashboard-container::-webkit-scrollbar-thumb {
  background: #4a4a4a;
  border-radius: 4px;
}

.dashboard-container::-webkit-scrollbar-thumb:hover {
  background: #666666;
}
</style>