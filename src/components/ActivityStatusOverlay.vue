<template>
  <!-- 活動狀態覆蓋層 -->
  <div 
    v-if="showOverlay" 
    class="activity-overlay"
    :class="{ 'overlay-visible': showOverlay }"
  >
    <!-- 毛玻璃背景 -->
    <div class="overlay-backdrop" @click="handleBackdropClick"></div>
    
    <!-- 狀態彈窗 -->
    <div class="status-modal" :class="`status-${activityStatus.status}`">
      <!-- 關閉按鈕 -->
      <button 
        class="close-button" 
        @click="closeOverlay"
        :aria-label="'關閉'"
        v-if="computedAllowClose">
      >
        <el-icon size="20"><Close /></el-icon>
      </button>
      
      <!-- 狀態圖示 -->
      <div class="status-icon">
        <div v-if="activityStatus.status === 'pending'" class="icon pending-icon">
          ⏳
        </div>
        <div v-else-if="activityStatus.status === 'ended'" class="icon ended-icon">
          ⏰
        </div>
        <div v-else-if="activityStatus.status === 'error'" class="icon error-icon">
          ❌
        </div>
        <div v-else class="icon inactive-icon">
          💤
        </div>
      </div>
      
      <!-- 狀態標題 -->
      <h2 class="status-title">
        {{ statusTitle }}
      </h2>
      
      <!-- 狀態訊息 -->
      <p class="status-message">
        {{ getStatusMessage() }}
      </p>
      
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
            
            <!-- 欄位錯誤特殊處理 -->
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
        </div>
        
        <div v-else-if="activityStatus.status === 'active'" class="countdown-section">
          <div class="countdown-label">⚠️ 距離結束還有：</div>
          <div class="countdown-timer">{{ countdown }}</div>
          <div class="countdown-hint">請把握時間完成報到</div>
        </div>
        
        <div v-else-if="activityStatus.status === 'ended'" class="countdown-section ended">
          <div class="countdown-label">🔚 活動已結束</div>
          <div class="ended-info">
            <div class="ended-duration">
              活動持續了 {{ getActivityDuration() }}
            </div>
            <div class="ended-note">感謝您的參與</div>
            <div class="ended-view-data">
              <el-icon><View /></el-icon>
              您可以關閉此視窗查看已完成的報到數據
            </div>
          </div>
        </div>
      </div>
      
      <!-- 當前時間 -->
      <div class="current-time" v-if="activityStatus.status !== 'error'">
        <span class="time-label">現在時間：</span>
        <span class="time-display">{{ currentTimeDisplay }}</span>
      </div>
      
      <!-- 操作按鈕 -->
      <div class="action-buttons">
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
        
        <!-- 配置錯誤時的重新載入按鈕 -->
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
        
        <!-- API Key 錯誤時的特殊按鈕 -->
        <el-button 
          v-if="activityStatus.status === 'error' && activityStatus.isApiKeyError"
          @click="reloadPage" 
          type="primary"
          size="large"
        >
          <el-icon><RefreshRight /></el-icon>
          重新載入頁面
        </el-button>
        
        <!-- 關閉按鈕 -->
        <el-button 
          @click="handleCloseAction" 
          size="large"
          :type="getCloseButtonType()"
          v-if="computedAllowClose"
        >
          {{ getCloseButtonText() }}
        </el-button>
        
        <!-- 配置錯誤時不允許關閉，只顯示重新載入 -->
        <el-button 
          v-if="activityStatus.status === 'error' && !computedAllowClose && !activityStatus.isApiKeyError"
          @click="refreshStatus" 
          :loading="refreshing"
          type="primary"
          size="large"
        >
          <el-icon><Refresh /></el-icon>
          修復後重新載入
        </el-button>
      </div>
      
      <!-- 允許關閉的提示 -->
      <div v-if="computedAllowClose && activityStatus.status !== 'error'" class="close-hint">
        <small v-if="activityStatus.status === 'ended'">
          ※ 活動已結束，您可以關閉此視窗查看報到數據統計
        </small>
        <small v-else>
          ※ 可以暫時關閉此提示，但建議等活動開始後再使用系統
        </small>
      </div>
      
      <!-- 錯誤提示 -->
      <div v-if="activityStatus.status === 'error'" class="error-hint">
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Close, Refresh, RefreshRight, View } from '@element-plus/icons-vue'

// Props
const props = defineProps({
  activityStatus: {
    type: Object,
    required: true,
    default: () => ({
      status: 'inactive',
      message: '載入中...',
      currentEvent: null,
      details: null,
      isApiKeyError: false // 新增：標記是否為 API key 錯誤
    })
  },
  allowClose: {
    type: Boolean,
    default: true
  }
})

// Emits
const emit = defineEmits(['close', 'refresh'])

// 響應式數據
const showOverlay = ref(true)
const refreshing = ref(false)
const currentTime = ref(Date.now())
const countdown = ref('')
const currentTimeDisplay = ref('')

// 計算屬性
const isActiveStatus = computed(() => props.activityStatus.status === 'active')

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

// 增強的關閉邏輯
const computedAllowClose = computed(() => {
  // 配置錯誤時不允許關閉，需要修復
  if (props.activityStatus.status === 'error' && props.activityStatus.details) {
    return false
  }
  
  // API Key 錯誤允許關閉（因為用戶可能想查看數據）
  if (props.activityStatus.status === 'error' && props.activityStatus.isApiKeyError) {
    return true
  }
  
  // 活動結束允許關閉（用戶可以查看已完成的數據）
  if (props.activityStatus.status === 'ended') {
    return true
  }
  
  // 其他情況按照原邏輯
  return props.allowClose && (props.activityStatus.status === 'error' || props.activityStatus.status === 'active')
})

// 定時器
let timeUpdateTimer = null

// 方法
const getStatusMessage = () => {
  if (props.activityStatus.isApiKeyError) {
    return 'API 密鑰驗證失敗，無法連接到後端服務'
  }
  return props.activityStatus.message || '系統狀態未知'
}

const getCloseButtonType = () => {
  if (props.activityStatus.status === 'ended') {
    return 'primary' // 活動結束時使用主要按鈕樣式
  }
  return 'default'
}

const getCloseButtonText = () => {
  if (props.activityStatus.status === 'ended') {
    return '關閉並查看數據'
  }
  if (props.activityStatus.status === 'error' && props.activityStatus.isApiKeyError) {
    return '關閉 (查看現有數據)'
  }
  return '暫時關閉'
}

const reloadPage = () => {
  window.location.reload()
}

// 錯誤標題映射
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

const closeOverlay = () => {
  showOverlay.value = false
  emit('close')
}

const handleBackdropClick = () => {
  if (computedAllowClose.value) {
    closeOverlay()
  }
}

const handleCloseAction = () => {
  closeOverlay()
}

const refreshStatus = async () => {
  refreshing.value = true
  try {
    await emit('refresh')
  } finally {
    refreshing.value = false
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
.activity-overlay {
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

.status-modal {
  position: relative;
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 2px solid #4a4a4a;
  max-width: 600px;
  width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  text-align: center;
  animation: modalSlideIn 0.4s ease-out;
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

/* 狀態特定樣式 */
.status-pending {
  border-color: #E6A23C;
  box-shadow: 0 20px 60px rgba(230, 162, 60, 0.2);
}

.status-active {
  border-color: #67C23A;
  box-shadow: 0 20px 60px rgba(103, 194, 58, 0.2);
}

.status-ended {
  border-color: #F56C6C;
  box-shadow: 0 20px 60px rgba(245, 108, 108, 0.2);
}

.status-error {
  border-color: #F56C6C;
  box-shadow: 0 20px 60px rgba(245, 108, 108, 0.3);
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
}

.status-message {
  color: #cccccc;
  font-size: 16px;
  line-height: 1.5;
  margin: 0 0 25px 0;
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
}

.notice-icon {
  font-size: 32px;
  flex-shrink: 0;
  margin-top: 5px;
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
}

.field-error-details {
  margin-top: 15px;
}

.error-field {
  margin: 8px 0;
  color: #ffffff;
  font-size: 14px;
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
}

.event-details {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
  text-align: left;
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

/* 活動結束特殊樣式 */
.ended-view-data {
  color: #67C23A;
  font-size: 13px;
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.current-time {
  margin: 20px 0;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.action-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 25px;
  flex-wrap: wrap;
}

.action-buttons .el-button {
  min-width: 120px;
}

.close-hint, .error-hint {
  margin-top: 15px;
  color: #666666;
  font-size: 12px;
  line-height: 1.4;
}

.error-hint {
  color: #F56C6C;
  font-weight: 500;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .status-modal {
    padding: 30px 20px;
    margin: 20px;
    max-width: none;
    width: calc(100vw - 40px);
  }
  
  .status-title {
    font-size: 20px;
  }
  
  .status-message {
    font-size: 15px;
  }
  
  .icon {
    font-size: 40px;
  }
  
  .countdown-timer {
    font-size: 18px;
  }
  
  .action-buttons {
    flex-direction: column;
    gap: 8px;
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
  
  .error-item {
    padding: 15px;
  }
  
  .error-title {
    font-size: 16px;
  }
  
  .available-fields {
    gap: 6px;
    padding: 10px;
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
  
  .notice-content h4 {
    font-size: 15px;
  }
  
  .notice-content p {
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .status-modal {
    padding: 25px 15px;
    margin: 15px;
    width: calc(100vw - 30px);
  }
  
  .status-title {
    font-size: 18px;
  }
  
  .status-message {
    font-size: 14px;
  }
  
  .icon {
    font-size: 36px;
  }
  
  .event-details {
    padding: 15px;
  }
  
  .countdown-timer {
    font-size: 16px;
  }
  
  .error-item {
    padding: 12px;
  }
}

/* 滾動條樣式 */
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

:deep(.el-button.is-loading) {
  opacity: 0.7;
}
</style>