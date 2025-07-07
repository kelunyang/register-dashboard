<template>
  <el-card class="checkin-meter-card">
    <template #header>
      <div class="meter-header">
        <h3>{{ meterTitle }}</h3>
        <div v-if="filterType !== 'all'" class="filter-indicator">
          <el-tag type="primary" size="small" class="filter-tag">
            {{ filterType }}
          </el-tag>
        </div>
      </div>
    </template>
    
    <div class="meter-container">
      <!-- 桌面版IBM主機風格進度條 -->
      <div class="large-meter">
        <div class="ibm-progress-container" v-if="displayStats.total > 0">
          <!-- 進度條 -->
          <div class="ibm-progress-bar" :style="{ '--progress-color': progressColor, '--progress-percentage': parseFloat(displayStats.rate) }">
            <div class="progress-fill"></div>
            <div class="progress-background"></div>
            <div class="scan-line"></div>
          </div>
          
          <!-- 數據顯示 -->
          <div class="meter-info">
            <div class="meter-stats">
              <span class="meter-number" :style="{ color: progressColor }">{{ displayStats.checkedIn }}</span>
              <span class="meter-separator">/</span>
              <span class="meter-total">{{ displayStats.total }}</span>
              <span class="meter-percentage" :style="{ color: progressColor }">{{ displayStats.rate }}%</span>
            </div>
            <div class="meter-labels">
              <span class="meter-label">{{ meterLabel }}</span>
              <!-- <span class="meter-status" :style="{ color: progressColor }">{{ progressStatus }}</span> -->
            </div>
          </div>
        </div>
        
        <!-- 無學生資料狀態 -->
        <div class="ibm-progress-container no-data" v-else>
          <!-- 空的進度條 -->
          <div class="ibm-progress-bar no-data-bar">
            <div class="progress-background"></div>
          </div>
          
          <!-- 無資料訊息 -->
          <div class="meter-info">
            <div class="meter-stats no-data-stats">
              <span class="meter-number error">0</span>
              <span class="meter-separator">/</span>
              <span class="meter-total">0</span>
              <span class="meter-percentage error">0%</span>
            </div>
            <div class="meter-labels">
              <span class="meter-label">{{ meterLabel }}</span>
              <span class="meter-status error">
                {{ filterType === 'all' ? '等待學生資料載入' : `無 ${filterType} 類別學生` }}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 手機版簡化顯示 -->
      <div class="mobile-meter">
        <div class="mobile-stats" v-if="displayStats.total > 0">
          <div class="stat-item">
            <div class="stat-number">{{ displayStats.checkedIn }}</div>
            <div class="stat-label">已報到</div>
          </div>
          <div class="stat-divider">/</div>
          <div class="stat-item">
            <div class="stat-number">{{ displayStats.total }}</div>
            <div class="stat-label">總人數</div>
          </div>
        </div>
        
        <!-- 手機版無資料狀態 -->
        <div class="mobile-no-data" v-else>
          <div class="no-data-icon">📋</div>
          <div class="no-data-text">
            {{ filterType === 'all' ? '等待學生資料載入' : `暫無 ${filterType} 類別學生` }}
          </div>
        </div>
        
        <div class="mobile-progress" v-if="displayStats.total > 0">
          <el-progress 
            :percentage="parseFloat(displayStats.rate)" 
            :stroke-width="8"
            :show-text="false"
            :color="progressColor"
          />
          <div class="progress-text" :style="{ color: progressColor }">
            {{ displayStats.rate }}% <!-- {{ progressStatus }} -->
          </div>
        </div>
      </div>
      
      <!-- 快速統計
      <div class="quick-stats" v-if="displayStats.total > 0">
        <div class="quick-stat-item">
          <div class="quick-stat-number">{{ displayStats.uncheckedIn }}</div>
          <div class="quick-stat-label">未報到</div>
        </div>
        <div class="quick-stat-item success">
          <div class="quick-stat-number">{{ displayStats.checkedIn }}</div>
          <div class="quick-stat-label">已完成</div>
        </div>
      </div>
      
      <div v-if="filterType !== 'all' && globalStats.total > 0" class="global-comparison">
        <div class="comparison-title">全局統計對比</div>
        <div class="comparison-stats">
          <div class="comparison-item">
            <span class="comparison-label">全部學生:</span>
            <span class="comparison-value">{{ globalStats.checkedIn }}/{{ globalStats.total }} ({{ globalStats.rate }}%)</span>
          </div>
          <div class="comparison-item current">
            <span class="comparison-label">{{ filterType }}:</span>
            <span class="comparison-value" :style="{ color: progressColor }">
              {{ displayStats.checkedIn }}/{{ displayStats.total }} ({{ displayStats.rate }}%)
            </span>
          </div>
        </div>
      </div>
      
      <div class="system-status" v-else-if="filterType === 'all'">
        <div class="status-item">
          <div class="status-icon">🟢</div>
          <div class="status-text">系統運行正常</div>
        </div>
        <div class="status-item">
          <div class="status-icon">⏳</div>
          <div class="status-text">等待資料同步</div>
        </div>
      </div>-->
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'

// Props
const props = defineProps({
  statistics: {
    type: Object,
    default: () => ({})
  },
  filterType: {
    type: String,
    default: 'all'
  }
})

// 計算屬性
const displayStats = computed(() => {
  if (props.filterType === 'all') {
    // 顯示全局統計
    return {
      total: props.statistics.total || 0,
      checkedIn: props.statistics.checkedIn || 0,
      uncheckedIn: props.statistics.uncheckedIn || 0,
      rate: props.statistics.checkinRate || 0
    }
  } else {
    // 顯示特定類型的統計
    const typeData = props.statistics.typeStats?.find(t => t.name === props.filterType)
    if (typeData) {
      return {
        total: typeData.total,
        checkedIn: typeData.checkedIn,
        uncheckedIn: typeData.total - typeData.checkedIn,
        rate: typeData.rate
      }
    } else {
      return {
        total: 0,
        checkedIn: 0,
        uncheckedIn: 0,
        rate: 0
      }
    }
  }
})

const globalStats = computed(() => {
  return props.statistics.globalStats || {
    total: 0,
    checkedIn: 0,
    rate: 0
  }
})

const meterTitle = computed(() => {
  if (props.filterType === 'all') {
    return '已報到人數統計'
  } else {
    return `${props.filterType} 報到統計`
  }
})

const meterLabel = computed(() => {
  if (props.filterType === 'all') {
    return '依號次報到'
  } else {
    return `${props.filterType} 類別`
  }
})

// 根據完成度動態計算顏色
const progressColor = computed(() => {
  const rate = parseFloat(displayStats.value.rate)
  if (rate >= 90) return '#67C23A' // 綠色 - 接近完成
  if (rate >= 70) return '#E6A23C' // 橙色 - 大部分完成
  if (rate >= 50) return '#409EFF' // 藍色 - 過半完成
  if (rate >= 30) return '#F56C6C' // 紅色 - 剛開始
  return '#909399' // 灰色 - 很少或無進度
})

// 進度狀態文字
const progressStatus = computed(() => {
  const rate = parseFloat(displayStats.value.rate)
  if (rate >= 90) return '即將完成'
  if (rate >= 70) return '進度良好'
  if (rate >= 50) return '進度過半'
  if (rate >= 30) return '報到進行中'
  return '開始報到'
})
</script>

<style scoped>
.checkin-meter-card {
  background-color: #2d2d2d;
  border: 1px solid #4a4a4a;
}

.checkin-meter-card :deep(.el-card__header) {
  background-color: #3a3a3a;
  border-bottom: 1px solid #4a4a4a;
  padding: 15px 20px;
}

.meter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.meter-header h3 {
  color: #ffffff;
  margin: 0;
  font-size: calc(var(--base-font-size) * 1.125);
  font-weight: bold;
}

.filter-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-tag {
  background-color: #409eff;
  border-color: #409eff;
  color: white;
  animation: filterPulse 2s ease-in-out infinite alternate;
}

@keyframes filterPulse {
  0% {
    box-shadow: 0 0 4px rgba(64, 158, 255, 0.4);
  }
  100% {
    box-shadow: 0 0 12px rgba(64, 158, 255, 0.8);
  }
}

.meter-container {
  padding: 20px;
}

/* 桌面版IBM主機風格進度條 */
.large-meter {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
}

.ibm-progress-container {
  width: 100%;
  max-width: 500px;
  font-family: 'Courier New', monospace;
}

.ibm-progress-bar {
  position: relative;
  width: 100%;
  height: 40px;
  background-color: #1a1a1a;
  border: 2px solid #4a4a4a;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 16px;
  box-shadow: 
    inset 0 2px 4px rgba(0, 0, 0, 0.5),
    0 0 10px rgba(var(--progress-color), 0.3);
}

.progress-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(
    90deg,
    transparent 0px,
    transparent 8px,
    #333 8px,
    #333 9px
  );
  opacity: 0.3;
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 0%;
  background: transparent;
  background-size: 20px 100%;
  background-image: 
    repeating-linear-gradient(
      90deg,
      transparent 0px,
      transparent 3px,
      rgba(255, 255, 255, 0.1) 3px,
      rgba(255, 255, 255, 0.1) 4px
    );
  animation: 
    progressFill 2s ease-out forwards,
    progressColorFill 2.5s ease-out forwards;
  box-shadow: 
    inset 0 0 10px rgba(255, 255, 255, 0.2),
    0 0 20px rgba(var(--progress-color), 0.6);
}

@keyframes progressFill {
  0% {
    width: 0%;
  }
  100% {
    width: calc(var(--progress-percentage) * 1%);
  }
}

@keyframes progressColorFill {
  0%, 80% {
    background: transparent;
  }
  100% {
    background: linear-gradient(
      90deg,
      var(--progress-color) 0%,
      color-mix(in srgb, var(--progress-color) 80%, white) 50%,
      var(--progress-color) 100%
    );
  }
}

.scan-line {
  position: absolute;
  top: 0;
  left: -2px;
  width: 2px;
  height: 100%;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    var(--progress-color) 20%,
    white 50%,
    var(--progress-color) 80%,
    transparent 100%
  );
  animation: scanAnimation 2.5s ease-in-out 1;
  opacity: 0.8;
  box-shadow: 0 0 10px var(--progress-color);
}

@keyframes scanAnimation {
  0% {
    left: -2px;
    opacity: 0;
  }
  5% {
    opacity: 1;
  }
  85% {
    left: calc(var(--progress-percentage) * 1%);
    opacity: 1;
  }
  100% {
    left: calc(var(--progress-percentage) * 1%);
    opacity: 0;
  }
}

.meter-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.meter-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: calc(var(--base-font-size) * 1.125);
  font-weight: bold;
}

.meter-labels {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: calc(var(--base-font-size) * 0.75);
}

.meter-number {
  font-size: calc(var(--base-font-size) * 1.5);
  font-weight: bold;
  color: #67C23A;
  font-family: 'Courier New', monospace;
  animation: numberPop 1s ease-out;
  text-shadow: 0 0 8px currentColor;
}

@keyframes numberPop {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

.meter-separator {
  font-size: calc(var(--base-font-size) * 1.25);
  color: #cccccc;
  font-family: 'Courier New', monospace;
}

.meter-total {
  font-size: calc(var(--base-font-size) * 1.25);
  font-weight: bold;
  color: #ffffff;
  font-family: 'Courier New', monospace;
}

.meter-label {
  font-size: calc(var(--base-font-size) * 0.6875);
  color: #999999;
  font-family: 'Courier New', monospace;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.meter-percentage {
  font-size: calc(var(--base-font-size) * 1.0);
  color: #409eff;
  font-weight: bold;
  font-family: 'Courier New', monospace;
  text-shadow: 0 0 6px currentColor;
}

.meter-status {
  font-size: calc(var(--base-font-size) * 0.625);
  color: #409eff;
  font-family: 'Courier New', monospace;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 無資料狀態樣式 */
.no-data-bar {
  border-color: #666;
  box-shadow: 
    inset 0 2px 4px rgba(0, 0, 0, 0.5),
    0 0 5px rgba(255, 0, 0, 0.2);
}

.no-data-stats .error {
  color: #ff4444;
  animation: errorBlink 2s ease-in-out infinite;
}

.meter-status.error {
  color: #ff4444;
  animation: errorBlink 2s ease-in-out infinite;
}

@keyframes errorBlink {
  0%, 50% {
    opacity: 1;
  }
  75% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

/* 手機版簡化顯示 */
.mobile-meter {
  display: none;
}

.mobile-stats {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
}

.stat-item {
  text-align: center;
}

.stat-number {
  font-size: calc(var(--base-font-size) * 2.0);
  font-weight: bold;
  color: #ffffff;
}

.stat-label {
  font-size: calc(var(--base-font-size) * 0.875);
  color: #cccccc;
  margin-top: 4px;
}

.stat-divider {
  font-size: calc(var(--base-font-size) * 1.5);
  color: #666666;
}

.mobile-progress {
  margin-bottom: 20px;
}

.progress-text {
  text-align: center;
  color: #67C23A;
  font-weight: bold;
  margin-top: 8px;
}

/* 快速統計 */
.quick-stats {
  display: flex;
  justify-content: space-around;
  gap: 20px;
  padding-top: 20px;
  border-top: 1px solid #4a4a4a;
}

.quick-stat-item {
  text-align: center;
  flex: 1;
  padding: 15px;
  background-color: #363636;
  border-radius: 8px;
  border-left: 4px solid #F56C6C;
  transition: all 0.3s ease;
}

.quick-stat-item:hover {
  background-color: #3a3a3a;
  transform: translateY(-2px);
}

.quick-stat-item.success {
  border-left-color: #67C23A;
}

.quick-stat-number {
  font-size: calc(var(--base-font-size) * 1.5);
  font-weight: bold;
  color: #ffffff;
}

.quick-stat-label {
  font-size: calc(var(--base-font-size) * 0.75);
  color: #cccccc;
  margin-top: 4px;
}

/* 全局對比 */
.global-comparison {
  margin-top: 20px;
  padding: 15px;
  background: linear-gradient(135deg, #363636 0%, #3a3a3a 100%);
  border-radius: 8px;
  border-left: 4px solid #409eff;
}

.comparison-title {
  color: #409eff;
  font-size: calc(var(--base-font-size) * 0.875);
  font-weight: bold;
  margin-bottom: 10px;
  text-align: center;
}

.comparison-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comparison-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.05);
}

.comparison-item.current {
  background-color: rgba(64, 158, 255, 0.1);
  border: 1px solid rgba(64, 158, 255, 0.3);
}

.comparison-label {
  color: #cccccc;
  font-size: calc(var(--base-font-size) * 0.8125);
}

.comparison-value {
  color: #ffffff;
  font-size: calc(var(--base-font-size) * 0.8125);
  font-weight: 500;
  font-family: 'Courier New', monospace;
}


.mobile-no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background-color: #363636;
  border-radius: 8px;
  margin-bottom: 20px;
}

.mobile-no-data .no-data-icon {
  font-size: calc(var(--base-font-size) * 1.5);
  margin-bottom: 8px;
}

.mobile-no-data .no-data-text {
  color: #cccccc;
  font-size: calc(var(--base-font-size) * 0.875);
}

.system-status {
  display: flex;
  justify-content: space-around;
  gap: 20px;
  padding-top: 20px;
  border-top: 1px solid #4a4a4a;
}

.status-item {
  text-align: center;
  flex: 1;
  padding: 15px;
  background-color: #363636;
  border-radius: 8px;
  border-left: 4px solid #67C23A;
}

.status-icon {
  font-size: calc(var(--base-font-size) * 1.25);
  margin-bottom: 8px;
}

.status-text {
  color: #cccccc;
  font-size: calc(var(--base-font-size) * 0.75);
}

/* 響應式設計 */
@media (max-width: 768px) {
  .large-meter {
    display: none;
  }
  
  .ibm-progress-bar {
    height: 32px;
  }
  
  .meter-stats {
    font-size: calc(var(--base-font-size) * 1.0);
  }
  
  .meter-percentage {
    font-size: calc(var(--base-font-size) * 0.875);
  }
  
  .mobile-meter {
    display: block;
  }
  
  .meter-container {
    padding: 15px;
  }
  
  .meter-header {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }
  
  .meter-header h3 {
    font-size: calc(var(--base-font-size) * 1.0);
  }
  
  .quick-stats {
    flex-direction: column;
    gap: 10px;
  }
  
  .quick-stat-item {
    padding: 12px;
  }
  
  .quick-stat-number {
    font-size: calc(var(--base-font-size) * 1.25);
  }
  
  .comparison-stats {
    gap: 6px;
  }
  
  .comparison-item {
    flex-direction: column;
    gap: 4px;
    text-align: center;
  }
}

@media (max-width: 480px) {
  .mobile-stats {
    gap: 15px;
  }
  
  .stat-number {
    font-size: calc(var(--base-font-size) * 1.75);
  }
  
  .stat-label {
    font-size: calc(var(--base-font-size) * 0.75);
  }
  
  .meter-header h3 {
    font-size: calc(var(--base-font-size) * 0.875);
  }
  
  .filter-tag {
    font-size: calc(var(--base-font-size) * 0.6875);
    padding: 2px 6px;
  }
}
</style>