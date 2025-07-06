<template>
  <!-- 統一覆蓋層 -->
  <div 
    v-if="showOverlay" 
    class="unified-overlay"
    :class="{ 'overlay-visible': showOverlay }"
  >
    <!-- 毛玻璃背景 -->
    <div class="overlay-backdrop" @click="handleBackdropClick"></div>
    
    <!-- 主要彈窗 -->
    <div class="overlay-modal" :class="`mode-${currentMode}`">
      <!-- 關閉按鈕 -->
      <button 
        class="close-button" 
        @click="closeOverlay"
        :aria-label="'關閉'"
        v-if="allowClose"
      >
        <el-icon size="20"><Close /></el-icon>
      </button>
      
      <!-- 模式切換器（只在非活動狀態模式顯示） -->
      <div v-if="currentMode !== 'activity'" class="mode-switcher">
        <el-button 
          :type="currentMode === 'settings' ? 'primary' : 'default'"
          @click="switchMode('settings')"
          size="large"
        >
          <el-icon><Setting /></el-icon>
          系統設定
        </el-button>
        <el-button 
          :type="currentMode === 'config' ? 'primary' : 'default'"
          @click="switchMode('config')"
          size="large"
          :loading="loadingConfigDetails"
        >
          <el-icon><InfoFilled /></el-icon>
          看板配置
        </el-button>
        <el-button 
          :type="currentMode === 'activity' ? 'primary' : 'default'"
          @click="switchMode('activity')"
          size="large"
        >
          <el-icon><Monitor /></el-icon>
          活動狀態
        </el-button>
      </div>

      <!-- 活動狀態模式 -->
      <div v-if="currentMode === 'activity'" class="activity-content">
        <!-- 狀態圖示 -->
        <div class="status-icon">
          <div v-if="activityStatus.status === 'pending'" class="icon pending-icon">⏳</div>
          <div v-else-if="activityStatus.status === 'ended'" class="icon ended-icon">⏰</div>
          <div v-else-if="activityStatus.status === 'error'" class="icon error-icon">❌</div>
          <div v-else class="icon inactive-icon">💤</div>
        </div>
        
        <!-- 狀態標題 -->
        <h2 class="status-title">{{ statusTitle }}</h2>
        
        <!-- 狀態訊息 -->
        <p class="status-message">{{ getStatusMessage() }}</p>
        
        <!-- API key 錯誤特別提示 -->
        <div v-if="activityStatus.status === 'error' && activityStatus.isApiKeyError" class="api-key-error-notice">
          <div class="error-notice-box">
            <div class="notice-icon">🔑</div>
            <div class="notice-content">
              <h4>自動更新已停止</h4>
              <p>由於 API 密鑰驗證失敗，系統已自動停止背景更新功能以避免重複錯誤。</p>
              <div class="notice-actions">
                <span class="notice-hint">請聯繫系統管理員檢查設定，或手動重新載入頁面。</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 配置錯誤詳細資訊 -->
        <div v-if="activityStatus.status === 'error' && activityStatus.details" class="error-details-section">
          <div class="error-details">
            <div v-for="error in activityStatus.details" :key="error.type" class="error-item">
              <h4 class="error-title">{{ getErrorTitle(error.type) }}</h4>
              <p class="error-message">{{ error.message }}</p>
              
              <div v-if="error.type === 'FIELD_NOT_FOUND'" class="field-error-details">
                <p class="error-field"><strong>錯誤欄位：</strong>{{ error.field }}</p>
                <details v-if="error.availableFields" class="available-fields-details">
                  <summary class="fields-summary">可用欄位列表 ({{ error.availableFields.length }} 個)</summary>
                  <div class="available-fields">
                    <el-tag 
                      v-for="field in error.availableFields" 
                      :key="field"
                      size="small"
                      type="info"
                      class="field-tag"
                    >
                      {{ field }}
                    </el-tag>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 活動詳細資訊 -->
        <div v-if="activityStatus.currentEvent && activityStatus.status !== 'error'" class="event-details">
          <div class="event-info">
            <div class="info-row">
              <span class="info-label">活動名稱：</span>
              <span class="info-value">{{ activityStatus.currentEvent.title }}</span>
            </div>
            
            <div v-if="activityStatus.status === 'pending'" class="info-row">
              <span class="info-label">預計開始：</span>
              <span class="info-value time-value highlight-time">
                {{ formatDateTime(activityStatus.currentEvent.startTimestamp) }}
              </span>
            </div>
            
            <div v-if="activityStatus.status === 'pending'" class="info-row">
              <span class="info-label">預計結束：</span>
              <span class="info-value time-value">
                {{ formatDateTime(activityStatus.currentEvent.endTimestamp) }}
              </span>
            </div>
            
            <div v-if="activityStatus.status === 'ended'" class="info-row">
              <span class="info-label">活動時間：</span>
              <span class="info-value time-value">
                {{ formatDateTime(activityStatus.currentEvent.startTimestamp) }}
              </span>
            </div>
            
            <div v-if="activityStatus.status === 'ended'" class="info-row">
              <span class="info-label">結束時間：</span>
              <span class="info-value time-value highlight-time">
                {{ formatDateTime(activityStatus.currentEvent.endTimestamp) }}
              </span>
            </div>
            
            <div v-if="activityStatus.status === 'active'" class="info-row">
              <span class="info-label">開始時間：</span>
              <span class="info-value time-value">
                {{ formatDateTime(activityStatus.currentEvent.startTimestamp) }}
              </span>
            </div>
            
            <div v-if="activityStatus.status === 'active'" class="info-row">
              <span class="info-label">預計結束：</span>
              <span class="info-value time-value highlight-time">
                {{ formatDateTime(activityStatus.currentEvent.endTimestamp) }}
              </span>
            </div>
          </div>
          
          <!-- 倒數計時 -->
          <div v-if="activityStatus.status === 'pending'" class="countdown-section">
            <div class="countdown-label">⏰ 距離開始還有：</div>
            <div class="countdown-timer">{{ countdown }}</div>
            <div class="countdown-hint">系統將自動開始接受報到</div>
            
            <!-- 活動說明（Markdown） -->
            <div v-if="noticeMarkdownHtml" class="notice-content">
              <div class="notice-header">📋 活動說明</div>
              <div class="notice-markdown" v-html="noticeMarkdownHtml"></div>
            </div>
          </div>
          
          <div v-else-if="activityStatus.status === 'active'" class="countdown-section">
            <div class="countdown-label">⚠️ 距離結束還有：</div>
            <div class="countdown-timer">{{ countdown }}</div>
            <div class="countdown-hint">請把握時間完成報到</div>
            
            <!-- 活動說明（Markdown） -->
            <div v-if="noticeMarkdownHtml" class="notice-content">
              <div class="notice-header">📋 活動說明</div>
              <div class="notice-markdown" v-html="noticeMarkdownHtml"></div>
            </div>
          </div>
          
          <div v-else-if="activityStatus.status === 'ended'" class="countdown-section ended">
            <div class="countdown-label">🔚 活動已結束</div>
            <div class="ended-info">
              <div class="ended-duration">活動持續了 {{ getActivityDuration() }}</div>
              <div class="ended-note">感謝您的參與</div>
              <div class="ended-view-data">
                <el-icon><View /></el-icon>
                您可以關閉此視窗查看已完成的報到數據
              </div>
            </div>
            
            <!-- 活動說明（Markdown） -->
            <div v-if="noticeMarkdownHtml" class="notice-content">
              <div class="notice-header">📋 活動說明</div>
              <div class="notice-markdown" v-html="noticeMarkdownHtml"></div>
            </div>
          </div>
        </div>
        
        <!-- 當前時間 -->
        <div class="current-time" v-if="activityStatus.status !== 'error'">
          <span class="time-label">現在時間：</span>
          <span class="time-display">{{ currentTimeDisplay }}</span>
        </div>
      </div>

      <!-- 系統設定模式 -->
      <div v-if="currentMode === 'settings'" class="settings-content">
        <h2 class="content-title">🛠️ 系統設定</h2>
        
        <!-- 顯示配置資訊 -->
        <div class="settings-section">
          <h3>📊 顯示配置資訊</h3>
          <div class="config-stats">
            <div class="stat-row">
              <span class="stat-label">當前表單:</span>
              <span class="stat-value">{{ currentSheetId || '未選擇' }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">配置欄位數:</span>
              <span class="stat-value">{{ displayConfig.length }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">StudentTable 欄位:</span>
              <span class="stat-value">{{ studentTableFieldCount }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">TypeStatistics:</span>
              <span class="stat-value">{{ hasTypeStatistics ? '✅ 已配置' : '❌ 未配置' }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">UID 欄位:</span>
              <span class="stat-value highlight">{{ uidFieldName || '未設定' }}</span>
            </div>
          </div>
          
          <div class="config-actions">
            <el-switch
              v-model="showConfigDebug"
              active-text="顯示配置詳情"
              inactive-text="隱藏配置詳情"
              @change="handleConfigDebugChange"
            />
          </div>
        </div>

        <!-- 自動刷新設定 -->
        <div class="settings-section">
          <h3>🔄 自動刷新設定</h3>
          <div class="auto-refresh-config">
            <div class="config-row">
              <span class="config-label">狀態:</span>
              <span class="config-value" :class="{ 'enabled': autoRefreshEnabled }">
                {{ autoRefreshEnabled ? '✅ 已啟用' : '❌ 未啟用' }}
              </span>
            </div>
            
            <div class="config-row">
              <span class="config-label">密鑰設定:</span>
              <div class="gem-input-container">
                <el-input
                  v-model="autoRefreshGemInput"
                  placeholder="輸入自動刷新密鑰"
                  :type="showGemInput ? 'text' : 'password'"
                  size="small"
                  clearable
                  @keyup.enter="setAutoRefreshGem"
                  style="width: 200px;"
                >
                  <template #append>
                    <el-button 
                      :icon="showGemInput ? 'Hide' : 'View'" 
                      @click="showGemInput = !showGemInput"
                      size="small"
                    />
                  </template>
                </el-input>
                <el-button 
                  @click="setAutoRefreshGem" 
                  :loading="settingGem"
                  type="primary" 
                  size="small"
                  style="margin-left: 8px;"
                >
                  設定
                </el-button>
              </div>
            </div>
            
            <div class="config-row" v-if="autoRefreshEnabled">
              <span class="config-label">刷新間隔:</span>
              <div class="interval-slider-container">
                <el-slider
                  v-model="autoRefreshInterval"
                  :min="15"
                  :max="180"
                  :step="15"
                  :marks="intervalMarks"
                  :show-tooltip="true"
                  :format-tooltip="formatIntervalTooltip"
                  @change="onIntervalChange"
                  style="width: 200px;"
                />
                <span class="interval-display">{{ autoRefreshInterval }}秒</span>
              </div>
            </div>
            
            <div class="config-status" v-if="gemMessage">
              <small :class="{ 'success': gemSuccess, 'error': !gemSuccess }">
                {{ gemMessage }}
              </small>
            </div>
          </div>
        </div>

        <!-- 本地存儲統計 -->
        <div class="settings-section">
          <h3>💾 本地存儲統計</h3>
          <div class="storage-stats">
            <div class="stat-row">
              <span class="stat-label">存儲項目數量:</span>
              <span class="stat-value">{{ storageStats.itemCount || 0 }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">存儲大小:</span>
              <span class="stat-value">{{ Math.round((storageStats.totalSize || 0) / 1024) }} KB</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">追蹤表單數:</span>
              <span class="stat-value">{{ (storageStats.sheets || []).length }}</span>
            </div>
          </div>
        </div>

        <!-- 快速操作 -->
        <div class="settings-section">
          <h3>⚡ 快速操作</h3>
          <div class="quick-actions">
            <el-button 
              @click="clearUISettings" 
              type="warning"
              :loading="clearingSettings"
              size="large"
            >
              <el-icon><Delete /></el-icon>
              清除 UI 設定
            </el-button>
            <el-button 
              @click="clearCurrentSheetHistory" 
              type="danger"
              :loading="clearingHistory"
              :disabled="!currentSheetId"
              size="large"
            >
              <el-icon><DocumentDelete /></el-icon>
              清除當前表單記錄
            </el-button>
            <el-button 
              @click="clearAllData" 
              type="danger"
              :loading="clearingAll"
              size="large"
            >
              <el-icon><Delete /></el-icon>
              清除所有本地數據
            </el-button>
          </div>
        </div>

        <!-- 數據備份 -->
        <div class="settings-section">
          <h3>📦 數據備份</h3>
          <div class="backup-actions">
            <el-button @click="exportData" type="primary" size="large">
              <el-icon><Download /></el-icon>
              導出數據
            </el-button>
            <el-upload
              ref="uploadRef"
              :auto-upload="false"
              :show-file-list="false"
              accept=".json"
              @change="handleImportData"
              class="import-upload"
            >
              <el-button type="default" size="large">
                <el-icon><Upload /></el-icon>
                導入數據
              </el-button>
            </el-upload>
          </div>
        </div>
      </div>
      
      <!-- 看板配置模式 -->
      <div v-if="currentMode === 'config'" class="config-content">
        <h2 class="content-title">📋 看板配置詳情</h2>
        
        <div v-if="loadingConfigDetails" class="loading-config">
          <el-skeleton :rows="8" animated />
        </div>
        
        <div v-else-if="configDetails" class="config-details">
          <!-- 基本信息 -->
          <div class="config-section">
            <h3>📋 基本信息</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">表單ID:</span>
                <span class="value">{{ configDetails.sheetInfo.sheetId }}</span>
              </div>
              <div class="info-item">
                <span class="label">配置表名稱:</span>
                <span class="value">{{ configDetails.sheetInfo.configSheetName }}</span>
              </div>
              <div class="info-item">
                <span class="label">最後更新:</span>
                <span class="value">{{ configDetails.sheetInfo.lastUpdated }}</span>
              </div>
            </div>
          </div>

          <!-- 數據源信息 -->
          <div class="config-section">
            <h3>📊 數據源信息</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">主鍵欄位:</span>
                <span class="value highlight">{{ configDetails.dataSource.primaryKey }}</span>
              </div>
              <div class="info-item">
                <span class="label">學生總數:</span>
                <span class="value">{{ configDetails.dataSource.studentsCount }} 筆</span>
              </div>
              <div class="info-item">
                <span class="label">報到記錄:</span>
                <span class="value">{{ configDetails.dataSource.checkinCount }} 筆</span>
              </div>
              <div class="info-item">
                <span class="label">原始資料欄位:</span>
                <span class="value">{{ configDetails.dataSource.rawDataFields }} 個</span>
              </div>
            </div>
          </div>

          <!-- 顯示配置 -->
          <div class="config-section">
            <h3>🎨 顯示配置</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">配置欄位總數:</span>
                <span class="value">{{ configDetails.displayConfig.totalFields }} 個</span>
              </div>
              <div class="info-item">
                <span class="label">前端UID欄位:</span>
                <span class="value highlight">{{ configDetails.displayConfig.uidField || '未設定' }}</span>
              </div>
            </div>

            <!-- 按區塊顯示欄位 -->
            <div class="blocks-section">
              <div v-for="(fields, blockName) in configDetails.displayConfig.fieldsByBlock" :key="blockName" class="block-group">
                <h4 class="block-title">
                  {{ getBlockDisplayName(blockName) }}
                  <el-tag size="small" type="info">{{ fields.length }} 個欄位</el-tag>
                </h4>
                
                <div v-if="fields.length > 0" class="field-list">
                  <div v-for="field in fields" :key="field['欄位名稱']" class="field-item">
                    <div class="field-header">
                      <span class="field-name">{{ field['欄位名稱'] }}</span>
                      <div class="field-tags">
                        <el-tag v-if="field['欄位性質']" size="small" type="primary">{{ field['欄位性質'] }}</el-tag>
                        <el-tag v-if="field['特殊功能']" size="small" type="warning">{{ field['特殊功能'] }}</el-tag>
                      </div>
                    </div>
                    
                    <div v-if="field['預處理'] && field['預處理'].trim()" class="field-preprocessing">
                      <span class="preprocessing-label">預處理:</span>
                      <code class="preprocessing-rule">{{ field['預處理'] }}</code>
                    </div>
                    
                    <div v-if="field['備註'] && field['備註'].trim()" class="field-note">
                      <span class="note-label">備註:</span>
                      <span class="note-text">{{ field['備註'] }}</span>
                    </div>
                  </div>
                </div>
                
                <div v-else class="no-fields">
                  <span class="empty-text">此區塊未配置任何欄位</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 警告信息 -->
          <div v-if="configDetails.warnings && configDetails.warnings.length > 0" class="config-section">
            <h3>⚠️ 警告信息</h3>
            <div class="warnings-list">
              <div
                v-for="(warning, index) in configDetails.warnings"
                :key="index"
                class="warning-item"
              >
                <div class="warning-content">
                  <el-icon class="warning-icon"><Warning /></el-icon>
                  <span class="warning-text">{{ warning.message }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 系統信息 -->
          <div class="config-section">
            <h3>🔧 系統信息</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">系統版本:</span>
                <span class="value">{{ configDetails.systemInfo.version }}</span>
              </div>
              <div class="info-item full-width">
                <span class="label">支援功能:</span>
                <div class="features-list">
                  <el-tag v-for="feature in configDetails.systemInfo.features" :key="feature" size="small" type="success">
                    {{ feature }}
                  </el-tag>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div v-else class="no-config">
          <el-empty description="無法載入配置詳情" :image-size="80">
            <el-button @click="loadConfigDetails" type="primary" size="large">
              <el-icon><Refresh /></el-icon>
              重新載入
            </el-button>
          </el-empty>
        </div>
      </div>
      
      <!-- 操作按鈕 -->
      <div class="action-buttons">
        <!-- 活動狀態模式的按鈕 -->
        <template v-if="currentMode === 'activity'">
          <el-button 
            v-if="activityStatus.status !== 'error'"
            @click="refreshStatus" 
            :loading="refreshing"
            type="primary"
            size="large"
          >
            <el-icon><Refresh /></el-icon>
            重新檢查
          </el-button>
          
          <el-button 
            v-if="activityStatus.status === 'error' && !activityStatus.isApiKeyError"
            @click="refreshStatus" 
            :loading="refreshing"
            type="primary"
            size="large"
          >
            <el-icon><Refresh /></el-icon>
            重新載入
          </el-button>
          
          <el-button 
            v-if="activityStatus.status === 'error' && activityStatus.isApiKeyError"
            @click="reloadPage" 
            type="primary"
            size="large"
          >
            <el-icon><RefreshRight /></el-icon>
            重新載入頁面
          </el-button>
        </template>
        
        <!-- 配置模式的按鈕 -->
        <el-button 
          v-if="currentMode === 'config'"
          @click="loadConfigDetails" 
          :loading="loadingConfigDetails" 
          type="primary"
          size="large"
        >
          <el-icon><Refresh /></el-icon>
          重新載入配置
        </el-button>
        
        <!-- 通用關閉按鈕 -->
        <el-button 
          @click="handleCloseAction" 
          size="large"
          :type="getCloseButtonType()"
          v-if="allowClose"
        >
          {{ getCloseButtonText() }}
        </el-button>
      </div>
      
      <!-- 提示文字 -->
      <div v-if="allowClose && currentMode === 'activity'" class="close-hint">
        <small v-if="activityStatus.status === 'ended'">
          ※ 活動已結束，您可以關閉此視窗查看報到數據統計
        </small>
        <small v-else-if="activityStatus.status !== 'error'">
          ※ 可以暫時關閉此提示，但建議等活動開始後再使用系統
        </small>
      </div>
      
      <div v-if="currentMode === 'activity' && activityStatus.status === 'error'" class="error-hint">
        <small v-if="activityStatus.isApiKeyError">
          ※ API 密鑰問題需要系統管理員處理，或嘗試重新載入頁面
        </small>
        <small v-else>
          ※ 請檢查並修復配置後重新載入系統
        </small>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { 
  Close, Refresh, RefreshRight, View, Setting, InfoFilled, Monitor,
  Delete, DocumentDelete, Download, Upload, Warning, Hide
} from '@element-plus/icons-vue'
import markdownService from '../services/markdownService.js'
import apiService from '../services/apiService.js'

// Props
const props = defineProps({
  showOverlay: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'activity', // activity, settings, config
    validator: (value) => ['activity', 'settings', 'config'].includes(value)
  },
  // 活動狀態相關
  activityStatus: {
    type: Object,
    default: () => ({
      status: 'inactive',
      message: '載入中...',
      currentEvent: null,
      details: null,
      isApiKeyError: false
    })
  },
  allowClose: {
    type: Boolean,
    default: true
  },
  // 設定相關
  currentSheetId: {
    type: String,
    default: null
  },
  displayConfig: {
    type: Array,
    default: () => []
  },
  storageStats: {
    type: Object,
    default: () => ({})
  },
  configDetails: {
    type: Object,
    default: null
  },
  loadingConfigDetails: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits([
  'close', 'refresh', 'mode-change',
  'load-config-details', 'clear-ui-settings', 'clear-current-sheet-history', 
  'clear-all-data', 'export-data', 'import-data', 'config-debug-change',
  'auto-refresh-interval-change'
])

// 響應式數據
const currentMode = ref(props.mode)
const refreshing = ref(false)
const currentTime = ref(Date.now())
const countdown = ref('')
const currentTimeDisplay = ref('')
const showConfigDebug = ref(false)
const clearingSettings = ref(false)
const clearingHistory = ref(false)
const clearingAll = ref(false)

// autoRefresh 相關
const autoRefreshGemInput = ref('')
const showGemInput = ref(false)
const settingGem = ref(false)
const gemMessage = ref('')
const gemSuccess = ref(false)
const autoRefreshInterval = ref(30)
const autoRefreshEnabled = computed(() => {
  return apiService.hasAutoRefresh
})

// 監聽 props.mode 變化
watch(() => props.mode, (newMode) => {
  console.log(`🔄 UnifiedOverlay mode 變更: ${currentMode.value} -> ${newMode}`)
  currentMode.value = newMode
}, { immediate: true })

// 定時器
let timeUpdateTimer = null

// 計算屬性
const statusTitle = computed(() => {
  switch (props.activityStatus.status) {
    case 'pending':
      return '📅 活動準備中'
    case 'active':
      return '🟢 活動進行中'
    case 'ended':
      return '🔴 活動已結束'
    case 'error':
      return props.activityStatus.isApiKeyError ? '🔑 API 密鑰錯誤' : '⚠️ 系統配置錯誤'
    default:
      return '💤 系統待機中'
  }
})

const studentTableFieldCount = computed(() => {
  return props.displayConfig.filter(config => 
    config.顯示區塊 && config.顯示區塊.includes('StudentTable')
  ).length
})

const hasTypeStatistics = computed(() => {
  return props.displayConfig.some(config => 
    config.顯示區塊 && config.顯示區塊.includes('TypeStatistics')
  )
})


const uidFieldName = computed(() => {
  const uidConfig = props.displayConfig.find(config => 
    config.特殊功能 === 'UID'
  )
  return uidConfig?.欄位名稱 || '未設定'
})

// autoRefresh 相關計算屬性
const intervalMarks = computed(() => ({
  15: '15s',
  30: '30s',
  60: '1m',
  120: '2m',
  180: '3m'
}))

const formatIntervalTooltip = (value) => {
  if (value < 60) {
    return `${value}秒`
  } else {
    const minutes = Math.floor(value / 60)
    const seconds = value % 60
    return seconds > 0 ? `${minutes}分${seconds}秒` : `${minutes}分鐘`
  }
}

// markdown 內容處理
const noticeMarkdownHtml = computed(() => {
  if (!props.activityStatus.currentEvent?.noticeMD) {
    return null
  }
  
  try {
    return markdownService.noticeMarkdownToHtml(props.activityStatus.currentEvent.noticeMD)
  } catch (error) {
    console.error('Markdown 處理錯誤:', error)
    return null
  }
})

// 方法
const switchMode = (mode) => {
  currentMode.value = mode
  emit('mode-change', mode)
  
  if (mode === 'config' && !props.configDetails) {
    emit('load-config-details')
  }
}

const closeOverlay = () => {
  emit('close')
}

const handleBackdropClick = () => {
  if (props.allowClose) {
    closeOverlay()
  }
}

const handleCloseAction = () => {
  closeOverlay()
}

const getCloseButtonType = () => {
  if (currentMode.value === 'activity') {
    if (props.activityStatus.status === 'ended') {
      return 'primary'
    }
  }
  return 'default'
}

const getCloseButtonText = () => {
  if (currentMode.value === 'activity') {
    if (props.activityStatus.status === 'ended') {
      return '關閉並查看數據'
    }
    if (props.activityStatus.status === 'error' && props.activityStatus.isApiKeyError) {
      return '關閉 (查看現有數據)'
    }
    return '暫時關閉'
  }
  return '關閉'
}

const refreshStatus = () => {
  refreshing.value = true
  try {
    emit('refresh')
  } finally {
    refreshing.value = false
  }
}

const reloadPage = () => {
  window.location.reload()
}

const getStatusMessage = () => {
  if (props.activityStatus.isApiKeyError) {
    return 'API 密鑰驗證失敗，無法連接到後端服務'
  }
  return props.activityStatus.message || '系統狀態未知'
}

const getErrorTitle = (errorType) => {
  const titles = {
    'MISSING_UID': '缺少 UID 配置',
    'NO_DISPLAY_BLOCKS': '沒有顯示區塊',
    'FIELD_NOT_FOUND': '欄位不存在',
    'MISSING_CONFIG_SHEET': '缺少配置表',
    'EMPTY_CONFIG': '配置為空',
    'CONFIG_READ_ERROR': '配置讀取錯誤',
    'VALIDATION_ERROR': '配置驗證錯誤',
    'NOT_DASHBOARD_ENABLED': '未啟用看板功能'
  }
  return titles[errorType] || errorType
}

const getActivityDuration = () => {
  if (!props.activityStatus.currentEvent) return '未知'
  
  const start = props.activityStatus.currentEvent.startTimestamp
  const end = props.activityStatus.currentEvent.endTimestamp
  
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

const updateCountdown = () => {
  if (!props.activityStatus.currentEvent || props.activityStatus.status === 'error') {
    countdown.value = ''
    return
  }

  const now = currentTime.value
  let targetTime

  if (props.activityStatus.status === 'pending') {
    targetTime = props.activityStatus.currentEvent.startTimestamp
  } else if (props.activityStatus.status === 'active') {
    targetTime = props.activityStatus.currentEvent.endTimestamp
  } else {
    countdown.value = ''
    return
  }

  const timeDiff = targetTime - now

  if (timeDiff <= 0) {
    countdown.value = props.activityStatus.status === 'pending' ? '即將開始！' : '即將結束！'
    return
  }

  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000)

  let countdownText = ''
  if (days > 0) {
    countdownText = `${days}天 ${hours}小時 ${minutes}分鐘`
  } else if (hours > 0) {
    countdownText = `${hours}小時 ${minutes}分鐘 ${seconds}秒`
  } else if (minutes > 0) {
    countdownText = `${minutes}分鐘 ${seconds}秒`
  } else {
    countdownText = `${seconds}秒`
  }

  countdown.value = countdownText
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

const updateCurrentTime = () => {
  const now = new Date()
  currentTime.value = now.getTime()
  currentTimeDisplay.value = now.toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 設定相關方法
const loadConfigDetails = () => {
  emit('load-config-details')
}

const handleConfigDebugChange = (value) => {
  emit('config-debug-change', value)
}

const clearUISettings = async () => {
  try {
    await ElMessageBox.confirm(
      '這將清除所有 UI 設定（表單選擇、篩選類型、刷新間隔等），確定要繼續嗎？',
      '確認清除',
      {
        confirmButtonText: '確定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    clearingSettings.value = true
    emit('clear-ui-settings')
  } catch {
    // 用戶取消
  } finally {
    clearingSettings.value = false
  }
}

const clearCurrentSheetHistory = async () => {
  try {
    await ElMessageBox.confirm(
      `這將清除表單「${props.currentSheetId}」的所有報到記錄，下次刷新時所有學生都會顯示為新報到。確定要繼續嗎？`,
      '確認清除',
      {
        confirmButtonText: '確定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    clearingHistory.value = true
    emit('clear-current-sheet-history')
  } catch {
    // 用戶取消
  } finally {
    clearingHistory.value = false
  }
}

const clearAllData = async () => {
  try {
    await ElMessageBox.confirm(
      '這將清除所有本地存儲的數據（UI設定、報到記錄等），此操作不可恢復！確定要繼續嗎？',
      '確認清除',
      {
        confirmButtonText: '確定清除',
        cancelButtonText: '取消',
        type: 'error'
      }
    )
    
    clearingAll.value = true
    emit('clear-all-data')
  } catch {
    // 用戶取消
  } finally {
    clearingAll.value = false
  }
}

const exportData = () => {
  emit('export-data')
}

const handleImportData = (file) => {
  emit('import-data', file)
}

// autoRefresh 相關方法
const setAutoRefreshGem = async () => {
  settingGem.value = true
  gemMessage.value = ''
  
  try {
    const result = await apiService.setAutoRefreshGem(autoRefreshGemInput.value)
    
    if (result.success && result.enabled) {
      gemSuccess.value = true
      gemMessage.value = '✅ 自動刷新密鑰設定成功！'
      autoRefreshInterval.value = result.refreshInterval || 30
      
      // 清空輸入框
      autoRefreshGemInput.value = ''
      showGemInput.value = false
      
      ElMessage.success('自動刷新已啟用')
    } else {
      gemSuccess.value = false
      gemMessage.value = `❌ ${result.message || '密鑰驗證失敗'}`
      ElMessage.error(result.message || '密鑰驗證失敗')
    }
  } catch (error) {
    gemSuccess.value = false
    gemMessage.value = `❌ 設定失敗: ${error.message}`
    ElMessage.error('設定失敗，請稍後再試')
  } finally {
    settingGem.value = false
    
    // 5秒後清除訊息
    setTimeout(() => {
      gemMessage.value = ''
    }, 5000)
  }
}

const onIntervalChange = (value) => {
  // 更新後端的刷新間隔設定
  if (apiService.autoRefreshConfig) {
    apiService.autoRefreshConfig.refreshInterval = value
  }
  
  // 這裡可能需要通知父組件更新刷新間隔
  // 由於 autoRefresh 邏輯在 StudentDashboard.vue 中，我們需要通過 emit 通知
  emit('auto-refresh-interval-change', value)
}

const getBlockDisplayName = (blockName) => {
  const names = {
    'StudentTable': '📋 學生列表',
    'TypeStatistics': '📊 身分別統計',
    'Other': '📦 其他'
  }
  return names[blockName] || blockName
}

// 生命周期
onMounted(() => {
  updateCurrentTime()
  updateCountdown()
  
  // 每秒更新時間和倒數計時
  timeUpdateTimer = setInterval(() => {
    updateCurrentTime()
    updateCountdown()
  }, 1000)
})

onUnmounted(() => {
  if (timeUpdateTimer) {
    clearInterval(timeUpdateTimer)
  }
})
</script>

<style scoped>
.unified-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.overlay-visible {
  opacity: 1;
}

.overlay-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.overlay-modal {
  position: relative;
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 2px solid #4a4a4a;
  max-width: 900px;
  width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
  text-align: center;
  animation: modalSlideIn 0.4s ease-out;
  /* 修正：防止橫向滾動條 */
  overflow-x: hidden;
  box-sizing: border-box;
}

/* 狀態特定樣式 */
.mode-activity.overlay-modal {
  border-color: #409eff;
  box-shadow: 0 20px 60px rgba(64, 158, 255, 0.2);
}

@keyframes modalSlideIn {
  from {
    transform: translateY(-30px) scale(0.95);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

.close-button {
  position: absolute;
  top: 15px;
  right: 15px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  color: #cccccc;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  transform: scale(1.1);
}

.mode-switcher {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-bottom: 30px;
  flex-wrap: wrap;
}

.content-title {
  color: #ffffff;
  font-size: 24px;
  font-weight: bold;
  margin: 0 0 25px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* 活動狀態樣式 */
.activity-content {
  text-align: center;
  /* 修正：確保內容不會超出容器 */
  max-width: 100%;
  word-wrap: break-word;
}

.status-icon {
  margin-bottom: 20px;
}

.icon {
  font-size: 48px;
  display: block;
  margin: 0 auto;
  animation: iconPulse 2s ease-in-out infinite;
}

@keyframes iconPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.pending-icon {
  filter: drop-shadow(0 0 10px rgba(230, 162, 60, 0.5));
}

.ended-icon {
  filter: drop-shadow(0 0 10px rgba(245, 108, 108, 0.5));
}

.error-icon {
  filter: drop-shadow(0 0 10px rgba(245, 108, 108, 0.6));
  animation: shake 0.5s ease-in-out infinite alternate;
}

@keyframes shake {
  0% { transform: translateX(-2px); }
  100% { transform: translateX(2px); }
}

.status-title {
  color: #ffffff;
  font-size: 24px;
  font-weight: bold;
  margin: 0 0 15px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  /* 修正：確保標題不會超出容器 */
  word-wrap: break-word;
}

.status-message {
  color: #cccccc;
  font-size: 16px;
  line-height: 1.5;
  margin: 0 0 25px 0;
  /* 修正：確保訊息文字換行 */
  word-wrap: break-word;
}

/* API Key 錯誤特別樣式 */
.api-key-error-notice {
  margin: 25px 0;
  text-align: left;
}

.error-notice-box {
  background: linear-gradient(135deg, rgba(245, 108, 108, 0.15) 0%, rgba(230, 162, 60, 0.1) 100%);
  border: 2px solid #F56C6C;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: flex-start;
  gap: 15px;
  /* 修正：確保在小屏幕上正確顯示 */
  flex-wrap: wrap;
}

.notice-icon {
  font-size: 32px;
  flex-shrink: 0;
  margin-top: 5px;
}

.notice-content {
  flex: 1;
  min-width: 0; /* 修正：允許內容收縮 */
}

.notice-content h4 {
  color: #F56C6C;
  margin: 0 0 10px 0;
  font-size: 16px;
  font-weight: bold;
}

.notice-content p {
  color: #ffffff;
  margin: 0 0 15px 0;
  line-height: 1.5;
  font-size: 14px;
  word-wrap: break-word;
}

.notice-hint {
  color: #cccccc;
  font-size: 13px;
  font-style: italic;
}

/* 配置錯誤詳細資訊樣式 */
.error-details-section {
  margin: 25px 0;
  text-align: left;
}

.error-details {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.error-item {
  padding: 20px;
  background-color: rgba(245, 108, 108, 0.1);
  border-radius: 8px;
  border-left: 4px solid #F56C6C;
  border: 1px solid rgba(245, 108, 108, 0.3);
  /* 修正：確保在小屏幕上不會超出 */
  word-wrap: break-word;
}

.error-title {
  color: #F56C6C;
  margin: 0 0 10px 0;
  font-size: 18px;
  font-weight: bold;
}

.error-message {
  color: #ffffff;
  margin: 0 0 15px 0;
  line-height: 1.5;
  font-size: 15px;
  word-wrap: break-word;
}

.field-error-details {
  margin-top: 15px;
}

.error-field {
  margin: 8px 0;
  color: #ffffff;
  font-size: 14px;
  word-wrap: break-word;
}

.available-fields-details {
  margin-top: 12px;
}

.fields-summary {
  color: #409eff;
  cursor: pointer;
  margin: 10px 0;
  font-size: 14px;
  font-weight: 500;
}

.fields-summary:hover {
  color: #66b1ff;
}

.available-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  max-height: 150px;
  overflow-y: auto;
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}

.field-tag {
  background-color: rgba(64, 158, 255, 0.2) !important;
  border-color: #409eff !important;
  color: #66b1ff !important;
  /* 修正：確保標籤文字不會被截斷 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-details {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
  text-align: left;
  /* 修正：確保內容不會超出 */
  word-wrap: break-word;
}

.event-info {
  margin-bottom: 15px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 10px;
  /* 修正：在小屏幕上允許換行 */
  flex-wrap: wrap;
}

.info-label {
  color: #999999;
  font-size: 14px;
  flex-shrink: 0;
}

.info-value {
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  text-align: right;
  /* 修正：允許文字換行 */
  word-wrap: break-word;
  flex: 1;
  min-width: 0;
}

.time-value {
  font-family: 'Courier New', monospace;
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
}

.highlight-time {
  background: rgba(64, 158, 255, 0.2);
  color: #66b1ff !important;
  font-weight: bold;
  box-shadow: 0 0 8px rgba(64, 158, 255, 0.3);
  animation: highlightPulse 2s ease-in-out infinite alternate;
}

@keyframes highlightPulse {
  0% {
    box-shadow: 0 0 8px rgba(64, 158, 255, 0.3);
  }
  100% {
    box-shadow: 0 0 16px rgba(64, 158, 255, 0.6);
  }
}

.countdown-section {
  text-align: center;
  padding: 15px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.countdown-label {
  color: #cccccc;
  font-size: 14px;
}

.countdown-timer {
  font-size: 20px;
  font-weight: bold;
  color: #E6A23C;
  font-family: 'Courier New', monospace;
  text-shadow: 0 0 10px rgba(230, 162, 60, 0.3);
  animation: countdownGlow 2s ease-in-out infinite alternate;
  /* 修正：確保倒數計時文字可以換行 */
  word-wrap: break-word;
}

@keyframes countdownGlow {
  0% {
    text-shadow: 0 0 10px rgba(230, 162, 60, 0.3);
  }
  100% {
    text-shadow: 0 0 20px rgba(230, 162, 60, 0.6);
  }
}

.countdown-hint {
  color: #999999;
  font-size: 12px;
  margin-top: 6px;
  font-style: italic;
}

.countdown-section.ended {
  border-top-color: #F56C6C;
}

.ended-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.ended-duration {
  color: #F56C6C;
  font-size: 16px;
  font-weight: bold;
}

.ended-note {
  color: #cccccc;
  font-size: 12px;
  font-style: italic;
}

.ended-view-data {
  color: #67C23A;
  font-size: 13px;
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  justify-content: center;
  /* 修正：允許在小屏幕上換行 */
  flex-wrap: wrap;
}

.current-time {
  margin: 20px 0;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  /* 修正：允許在小屏幕上換行 */
  flex-wrap: wrap;
  gap: 8px;
}

.time-label {
  color: #999999;
  font-size: 14px;
}

.time-display {
  color: #67C23A;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  font-size: 14px;
}

/* 設定和配置內容樣式 */
.settings-content,
.config-content {
  display: flex;
  flex-direction: column;
  gap: 25px;
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 10px;
  text-align: left;
  /* 修正：確保內容不會超出 */
  overflow-x: hidden;
}

.settings-section,
.config-section {
  background-color: #363636;
  border-radius: 12px;
  padding: 20px;
  border-left: 4px solid #409eff;
  /* 修正：確保在小屏幕上不會超出 */
  word-wrap: break-word;
}

.settings-section h3,
.config-section h3 {
  color: #ffffff;
  margin: 0 0 15px 0;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
  /* 修正：允許標題換行 */
  flex-wrap: wrap;
}

.config-stats,
.storage-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  transition: background-color 0.2s ease;
  /* 修正：允許在小屏幕上換行 */
  flex-wrap: wrap;
  gap: 8px;
}

.stat-row:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.stat-label {
  color: #cccccc;
  font-size: 14px;
  font-weight: 500;
}

.stat-value {
  color: #409eff;
  font-size: 14px;
  font-weight: bold;
  /* 修正：允許文字換行 */
  word-wrap: break-word;
}

.stat-value.highlight {
  color: #67C23A;
  background-color: rgba(103, 194, 58, 0.15);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}

.config-actions {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #4a4a4a;
}

.quick-actions,
.backup-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.import-upload {
  display: contents;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  /* 修正：允許在小屏幕上換行 */
  flex-wrap: wrap;
  gap: 8px;
}

.info-item.full-width {
  grid-column: 1 / -1;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.info-item .label {
  color: #cccccc;
  font-size: 14px;
  font-weight: 500;
}

.info-item .value {
  color: #ffffff;
  font-size: 14px;
  font-weight: bold;
  /* 修正：允許文字換行 */
  word-wrap: break-word;
}

.info-item .value.highlight {
  color: #66b1ff;
  background-color: rgba(64, 158, 255, 0.15);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}

.features-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.blocks-section {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.block-group {
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 15px;
  border: 1px solid #4a4a4a;
  /* 修正：確保內容不會超出 */
  word-wrap: break-word;
}

.block-title {
  color: #ffffff;
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* 修正：允許標題換行 */
  flex-wrap: wrap;
  gap: 8px;
}

.field-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-item {
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 12px;
  border-left: 3px solid #67C23A;
  /* 修正：確保內容不會超出 */
  word-wrap: break-word;
}

.field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.field-name {
  color: #ffffff;
  font-weight: bold;
  font-size: 14px;
  /* 修正：允許欄位名稱換行 */
  word-wrap: break-word;
}

.field-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.field-preprocessing {
  margin-bottom: 6px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.preprocessing-label {
  color: #E6A23C;
  font-size: 12px;
  font-weight: bold;
  flex-shrink: 0;
}

.preprocessing-rule {
  background-color: #1a1a1a;
  color: #E6A23C;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  word-break: break-all;
}

.field-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  /* 修正：允許備註換行 */
  flex-wrap: wrap;
}

.note-label {
  color: #909399;
  font-size: 12px;
  font-weight: bold;
  flex-shrink: 0;
}

.note-text {
  color: #cccccc;
  font-size: 12px;
  line-height: 1.4;
  word-wrap: break-word;
}

.no-fields {
  text-align: center;
  padding: 20px;
}

.empty-text {
  color: #666666;
  font-style: italic;
}

.warnings-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.warning-item {
  background-color: rgba(230, 162, 60, 0.1);
  border: 1px solid #E6A23C;
  border-radius: 6px;
  padding: 12px;
  /* 修正：確保警告內容不會超出 */
  word-wrap: break-word;
}

.warning-content {
  display: flex;
  align-items: center;
  gap: 10px;
  /* 修正：允許警告內容換行 */
  flex-wrap: wrap;
}

.warning-icon {
  color: #E6A23C;
  font-size: 18px;
  flex-shrink: 0;
}

.warning-text {
  color: #ffffff;
  font-size: 14px;
  line-height: 1.4;
  word-wrap: break-word;
}

.loading-config {
  padding: 40px 20px;
}

.no-config {
  padding: 40px;
  text-align: center;
}

.action-buttons {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #4a4a4a;
  flex-wrap: wrap;
}

.action-buttons .el-button {
  min-width: 140px;
}

.close-hint, .error-hint {
  margin-top: 15px;
  color: #666666;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
  /* 修正：確保提示文字可以換行 */
  word-wrap: break-word;
}

.error-hint {
  color: #F56C6C;
  font-weight: 500;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .overlay-modal {
    padding: 20px;
    margin: 20px;
    max-width: none;
    width: calc(100vw - 40px);
    max-height: calc(100vh - 40px);
  }
  
  .mode-switcher {
    flex-direction: column;
    gap: 10px;
  }
  
  .content-title {
    font-size: 20px;
  }
  
  .settings-section,
  .config-section {
    padding: 15px;
  }
  
  .quick-actions,
  .backup-actions {
    grid-template-columns: 1fr;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .field-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .field-preprocessing,
  .field-note {
    flex-direction: column;
    gap: 4px;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .action-buttons .el-button {
    min-width: auto;
    width: 100%;
  }
  
  .info-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .info-value {
    text-align: left;
  }
  
  .error-notice-box {
    flex-direction: column;
    gap: 12px;
    padding: 15px;
  }
  
  .notice-icon {
    font-size: 28px;
    margin-top: 0;
    text-align: center;
  }
  
  .stat-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .current-time {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}

@media (max-width: 480px) {
  .overlay-modal {
    padding: 15px;
    margin: 15px;
    width: calc(100vw - 30px);
  }
  
  .content-title {
    font-size: 18px;
  }
  
  .status-title {
    font-size: 20px;
  }
  
  .settings-section h3,
  .config-section h3 {
    font-size: 16px;
  }
}

/* 滾動條樣式 */
.settings-content::-webkit-scrollbar,
.config-content::-webkit-scrollbar {
  width: 6px;
}

.settings-content::-webkit-scrollbar-track,
.config-content::-webkit-scrollbar-track {
  background: #4a4a4a;
  border-radius: 3px;
}

.settings-content::-webkit-scrollbar-thumb,
.config-content::-webkit-scrollbar-thumb {
  background: #666666;
  border-radius: 3px;
}

.settings-content::-webkit-scrollbar-thumb:hover,
.config-content::-webkit-scrollbar-thumb:hover {
  background: #888888;
}

.available-fields::-webkit-scrollbar {
  width: 6px;
}

.available-fields::-webkit-scrollbar-track {
  background: #4a4a4a;
  border-radius: 3px;
}

.available-fields::-webkit-scrollbar-thumb {
  background: #666666;
  border-radius: 3px;
}

.available-fields::-webkit-scrollbar-thumb:hover {
  background: #888888;
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

:deep(.el-button--warning) {
  background-color: #E6A23C;
  border-color: #E6A23C;
}

:deep(.el-button--danger) {
  background-color: #F56C6C;
  border-color: #F56C6C;
}

:deep(.el-button.is-loading) {
  opacity: 0.7;
}

:deep(.el-switch) {
  --el-switch-on-color: #409eff;
  --el-switch-off-color: #4a4a4a;
}

:deep(.el-switch__label) {
  color: #ffffff;
}

:deep(.el-switch__label.is-active) {
  color: #409eff;
}

:deep(.el-tag) {
  border-radius: 4px;
}

:deep(.el-skeleton) {
  --el-skeleton-color: #3a3a3a;
  --el-skeleton-to-color: #4a4a4a;
}

:deep(.el-empty) {
  --el-empty-description-color: #cccccc;
}

:deep(.el-upload) {
  width: 100%;
}

:deep(.el-upload .el-button) {
  width: 100%;
}

/* 活動說明（Markdown）樣式 */
.notice-content {
  margin-top: 25px;
  padding: 20px;
  background: linear-gradient(135deg, #1a2332 0%, #243447 100%);
  border: 1px solid #00ff7f;
  border-radius: 8px;
  box-shadow: 
    0 0 15px rgba(0, 255, 127, 0.1),
    0 4px 20px rgba(0, 0, 0, 0.3);
}

.notice-header {
  color: #00ff7f;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 15px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 255, 127, 0.3);
  text-shadow: 0 0 8px currentColor;
}

.notice-markdown {
  color: #ffffff;
  line-height: 1.6;
  font-size: 14px;
}

/* Markdown 內容樣式 */
.notice-markdown :deep(h1),
.notice-markdown :deep(h2),
.notice-markdown :deep(h3),
.notice-markdown :deep(h4),
.notice-markdown :deep(h5),
.notice-markdown :deep(h6) {
  color: #00ff7f;
  margin: 15px 0 10px 0;
  font-weight: bold;
  text-shadow: 0 0 4px currentColor;
}

.notice-markdown :deep(h1) { font-size: 18px; }
.notice-markdown :deep(h2) { font-size: 16px; }
.notice-markdown :deep(h3) { font-size: 15px; }
.notice-markdown :deep(h4) { font-size: 14px; }

.notice-markdown :deep(p) {
  margin: 10px 0;
  color: #cccccc;
}

.notice-markdown :deep(ul),
.notice-markdown :deep(ol) {
  margin: 10px 0;
  padding-left: 20px;
  color: #cccccc;
}

.notice-markdown :deep(li) {
  margin: 5px 0;
}

.notice-markdown :deep(strong) {
  color: #ffffff;
  font-weight: bold;
}

.notice-markdown :deep(em) {
  color: #e6a23c;
  font-style: italic;
}

.notice-markdown :deep(code) {
  background-color: #2d2d2d;
  color: #e6a23c;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  border: 1px solid #4a4a4a;
}

.notice-markdown :deep(pre) {
  background-color: #1a1a1a;
  border: 1px solid #4a4a4a;
  border-radius: 4px;
  padding: 15px;
  overflow-x: auto;
  margin: 15px 0;
}

.notice-markdown :deep(pre code) {
  background: none;
  border: none;
  padding: 0;
  color: #ffffff;
}

.notice-markdown :deep(blockquote) {
  border-left: 4px solid #00ff7f;
  padding-left: 15px;
  margin: 15px 0;
  color: #999999;
  font-style: italic;
  background-color: rgba(0, 255, 127, 0.05);
  padding: 10px 15px;
  border-radius: 0 4px 4px 0;
}

.notice-markdown :deep(hr) {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, #00ff7f, transparent);
  margin: 20px 0;
}

.notice-markdown :deep(a) {
  color: #409eff;
  text-decoration: none;
  border-bottom: 1px solid rgba(64, 158, 255, 0.3);
  transition: all 0.3s ease;
}

.notice-markdown :deep(a:hover) {
  color: #66b3ff;
  border-bottom-color: #66b3ff;
  text-shadow: 0 0 4px currentColor;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .notice-content {
    margin-top: 20px;
    padding: 15px;
  }
  
  .notice-header {
    font-size: 14px;
    margin-bottom: 12px;
  }
  
  .notice-markdown {
    font-size: 13px;
  }
  
  .notice-markdown :deep(h1) { font-size: 16px; }
  .notice-markdown :deep(h2) { font-size: 15px; }
  .notice-markdown :deep(h3) { font-size: 14px; }
  .notice-markdown :deep(h4) { font-size: 13px; }
}

/* autoRefresh 設定樣式 */
.auto-refresh-config {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.config-label {
  min-width: 80px;
  color: #a0a0a0;
  font-size: 14px;
}

.config-value {
  color: #ff6b6b;
}

.config-value.enabled {
  color: #51cf66;
}

.gem-input-container {
  display: flex;
  align-items: center;
  flex: 1;
}

.interval-slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.interval-display {
  color: #409eff;
  font-weight: 600;
  min-width: 40px;
  text-align: right;
}

.config-status {
  margin-top: 8px;
}

.config-status .success {
  color: #51cf66;
}

.config-status .error {
  color: #ff6b6b;
}

/* Element Plus 元件樣式覆蓋 */
.auto-refresh-config .el-input {
  --el-input-bg-color: rgba(255, 255, 255, 0.05);
  --el-input-border-color: rgba(255, 255, 255, 0.2);
  --el-input-hover-border-color: #409eff;
  --el-input-focus-border-color: #409eff;
}

.auto-refresh-config .el-slider {
  --el-slider-main-bg-color: #409eff;
  --el-slider-runway-bg-color: rgba(255, 255, 255, 0.1);
  --el-slider-button-bg-color: #409eff;
}
</style>