<template>
  <transition name="loading-fade" mode="out-in">
    <div v-if="show" class="loading-overlay" :class="{ 'fixed-overlay': fixed }">
      <div class="loading-container">
        <!-- 主要載入動畫 -->
        <div class="loading-spinner">
          <div class="spinner-ring"></div>
          <div class="spinner-inner">
            <div class="pulse-dot"></div>
          </div>
        </div>
        
        <!-- 載入文字 -->
        <div class="loading-text">
          <div class="main-text">{{ currentMessage }}</div>
          <div v-if="subMessage" class="sub-text">{{ subMessage }}</div>
        </div>
        
        <!-- 進度條（如果有進度） -->
        <div v-if="showProgress" class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
          </div>
          <div class="progress-text">{{ progress }}%</div>
        </div>
        
        <!-- 載入步驟指示器 -->
        <div v-if="steps.length > 0" class="steps-indicator">
          <div 
            v-for="(step, index) in steps" 
            :key="index"
            class="step-item"
            :class="{ 
              'completed': index < currentStep, 
              'active': index === currentStep,
              'pending': index > currentStep 
            }"
          >
            <div class="step-icon">
              <span v-if="index < currentStep">✓</span>
              <span v-else-if="index === currentStep" class="loading-dot">●</span>
              <span v-else>○</span>
            </div>
            <div class="step-text">{{ step }}</div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    default: '載入中...'
  },
  subMessage: {
    type: String,
    default: ''
  },
  fixed: {
    type: Boolean,
    default: true
  },
  showProgress: {
    type: Boolean,
    default: false
  },
  progress: {
    type: Number,
    default: 0
  },
  steps: {
    type: Array,
    default: () => []
  },
  currentStep: {
    type: Number,
    default: 0
  },
  autoMessage: {
    type: Boolean,
    default: true
  }
})

// 動態訊息輪換
const loadingMessages = [
  '正在載入資料...',
  '正在處理報到記錄...',
  '正在更新統計數據...',
  '正在同步最新狀態...',
  '準備顯示結果...'
]

const currentMessage = ref(props.message)
const messageIndex = ref(0)
const messageTimer = ref(null)

// 自動輪換載入訊息
const startMessageRotation = () => {
  if (!props.autoMessage || !props.show) return
  
  messageTimer.value = setInterval(() => {
    messageIndex.value = (messageIndex.value + 1) % loadingMessages.length
    currentMessage.value = loadingMessages[messageIndex.value]
  }, 2000)
}

const stopMessageRotation = () => {
  if (messageTimer.value) {
    clearInterval(messageTimer.value)
    messageTimer.value = null
  }
}

// 監聽顯示狀態變化
watch(() => props.show, (newShow) => {
  if (newShow && props.autoMessage) {
    currentMessage.value = props.message || loadingMessages[0]
    messageIndex.value = 0
    startMessageRotation()
  } else {
    stopMessageRotation()
  }
})

// 監聽訊息變化
watch(() => props.message, (newMessage) => {
  if (newMessage && !props.autoMessage) {
    currentMessage.value = newMessage
  }
})

onMounted(() => {
  if (props.show && props.autoMessage) {
    startMessageRotation()
  }
})

onUnmounted(() => {
  stopMessageRotation()
})
</script>

<style scoped>
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.loading-overlay.fixed-overlay {
  position: fixed;
  z-index: 9999;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  background: rgba(45, 45, 45, 0.95);
  padding: 40px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  max-width: 400px;
  text-align: center;
}

/* 主要載入動畫 */
.loading-spinner {
  position: relative;
  width: 80px;
  height: 80px;
}

.spinner-ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 3px solid rgba(64, 158, 255, 0.2);
  border-top: 3px solid #409eff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner-inner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.pulse-dot {
  width: 12px;
  height: 12px;
  background: #409eff;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

/* 載入文字 */
.loading-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.main-text {
  color: #ffffff;
  font-size: 16px;
  font-weight: 500;
  white-space: nowrap;
}

.sub-text {
  color: #cccccc;
  font-size: 14px;
  opacity: 0.8;
}

/* 進度條 */
.progress-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #409eff, #66b1ff);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  color: #409eff;
  font-size: 12px;
  font-weight: bold;
  align-self: center;
}

/* 步驟指示器 */
.steps-indicator {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
}

.step-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 12px;
  font-weight: bold;
  flex-shrink: 0;
}

.step-item.completed .step-icon {
  background: #67c23a;
  color: white;
}

.step-item.active .step-icon {
  background: #409eff;
  color: white;
}

.step-item.active .loading-dot {
  animation: pulse 1s ease-in-out infinite;
}

.step-item.pending .step-icon {
  background: rgba(255, 255, 255, 0.1);
  color: #999999;
}

.step-text {
  color: #ffffff;
  font-size: 14px;
  flex: 1;
}

.step-item.pending .step-text {
  color: #999999;
}

.step-item.completed .step-text {
  color: #67c23a;
}

.step-item.active .step-text {
  color: #409eff;
  font-weight: 500;
}

/* 動畫 */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}

/* 過渡動畫 */
.loading-fade-enter-active, .loading-fade-leave-active {
  transition: all 0.3s ease;
}

.loading-fade-enter-from, .loading-fade-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

/* 響應式 */
@media (max-width: 480px) {
  .loading-container {
    margin: 20px;
    padding: 30px 20px;
    max-width: calc(100vw - 40px);
  }
  
  .loading-spinner {
    width: 60px;
    height: 60px;
  }
  
  .spinner-inner {
    width: 30px;
    height: 30px;
  }
  
  .pulse-dot {
    width: 10px;
    height: 10px;
  }
  
  .main-text {
    font-size: 14px;
  }
  
  .sub-text {
    font-size: 12px;
  }
}
</style>