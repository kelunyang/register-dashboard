<template>
  <el-card class="stat-card ibm-style">
    <template #header>
      <div class="card-header">
        <h4>{{ componentTitle }}</h4>
        <div class="header-actions">
          <el-button 
            v-if="selectedType !== 'all'"
            text 
            type="primary" 
            size="small"
            @click="clearFilter"
            class="clear-filter-btn"
          >
            <el-icon><Close /></el-icon>
            清除篩選
          </el-button>
        </div>
      </div>
    </template>
    
    <div class="type-stats-container">
      <!-- 全部選項 -->
      <div 
        class="ibm-stat-item all-types"
        :class="{ 'selected': selectedType === 'all' }"
        @click="handleTypeSelect('all')"
      >
        <div class="ibm-stat-header">
          <span class="stat-label">全部</span>
          <span class="stat-numbers">
            {{ globalStats.checkedIn }}/{{ globalStats.total }} ({{ globalStats.checkinRate }}%)
          </span>
        </div>
        <div class="ibm-progress-bar" :style="{ '--progress-color': '#409eff', '--stat-label-color': '#409eff', '--progress-percentage': globalStats.checkinRate }">
          <div class="progress-fill"></div>
          <div class="progress-background"></div>
          <div class="scan-line"></div>
          <div v-if="selectedType === 'all'" class="selection-indicator"></div>
        </div>
      </div>

      <!-- 各類型選項 -->
      <div 
        v-for="item in typeStats" 
        :key="item.name"
        class="ibm-stat-item"
        :class="{ 'selected': selectedType === item.name }"
        @click="handleTypeSelect(item.name)"
      >
        <div class="ibm-stat-header">
          <span class="stat-label">{{ item.name }}</span>
          <span class="stat-numbers">
            {{ item.checkedIn }}/{{ item.total }} ({{ item.rate }}%)
          </span>
        </div>
        <div class="ibm-progress-bar" :style="{ '--progress-color': item.color, '--stat-label-color': '#00ff7f', '--progress-percentage': item.rate }">
          <div class="progress-fill"></div>
          <div class="progress-background"></div>
          <div class="scan-line"></div>
          <div v-if="selectedType === item.name" class="selection-indicator"></div>
        </div>
      </div>
      
      <div v-if="!typeStats.length" class="no-data">
        <el-empty description="暫無身分別統計數據" :image-size="60" />
      </div>
    </div>

    <!-- 篩選提示
    <div v-if="selectedType !== 'all'" class="filter-hint">
      <el-alert
        :title="`目前顯示: ${selectedType} 類別`"
        type="info"
        :closable="false"
        show-icon
        class="filter-alert"
      >
        <template #default>
          <div class="hint-content">
            <span>儀表板已切換為 "{{ selectedType }}" 專用模式</span>
            <el-button 
              text 
              type="primary" 
              size="small"
              @click="clearFilter"
              class="inline-clear-btn"
            >
              返回全部
            </el-button>
          </div>
        </template>
      </el-alert>
    </div> -->
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'

// Props
const props = defineProps({
  statistics: {
    type: Object,
    default: () => ({})
  },
  selectedType: {
    type: String,
    default: 'all'
  },
  config: {
    type: Object,
    default: () => ({})
  }
})

// Emits
const emit = defineEmits(['type-select'])

// 計算屬性
const componentTitle = computed(() => {
  if (props.config.統計名稱) {
    return props.config.統計名稱
  }
  if (props.config.欄位名稱) {
    return `各${props.config.欄位名稱}報到狀況`
  }
  return '各身分別報到狀況'
})

const typeStats = computed(() => {
  // 根據配置索引確定使用哪個統計數據
  let statsKey = 'typeStats'
  if (props.config.index !== undefined) {
    statsKey = props.config.index === 0 ? 'typeStats' : `typeStats${props.config.index}`
  }
  
  const stats = props.statistics[statsKey] || []
  
  // 為每個類別分配顏色和狀態
  return stats.map((item) => {
    const rate = parseFloat(item.rate)
    let color = '#909399' // 預設灰色
    let status = '未開始'
    
    if (rate >= 90) {
      color = '#67C23A' // 綠色
      status = '接近完成'
    } else if (rate >= 70) {
      color = '#E6A23C' // 橙色
      status = '剩下1/3！'
    } else if (rate >= 50) {
      color = '#409EFF' // 藍色
      status = '進度過半'
    } else if (rate >= 30) {
      color = '#F56C6C' // 紅色
      status = '完成1/3了'
    }
    
    return {
      ...item,
      color,
      status,
      rate: rate
    }
  })
})

const globalStats = computed(() => {
  return props.statistics.globalStats || {
    total: 0,
    checkedIn: 0,
    checkinRate: 0
  }
})

// 方法
const handleTypeSelect = (typeName) => {
  if (typeName === props.selectedType) {
    return // 如果點擊的是當前選中的類型，不做任何操作
  }
  
  console.log(`📊 選擇類型篩選: ${typeName}`)
  // 當選擇具體類型時，傳遞配置信息；選擇 'all' 時傳遞 null
  const configToPass = typeName === 'all' ? null : props.config
  emit('type-select', typeName, configToPass)
  
  if (typeName === 'all') {
    ElMessage.success({
      message: '✅ 已切換到全部學生模式',
      type: 'success',
      duration: 2000,
      customClass: 'ibm-message'
    })
  } else {
    const selectedTypeData = typeStats.value.find(t => t.name === typeName)
    if (selectedTypeData) {
      ElMessage.success({
        message: `🎯 已切換到 "${typeName}" 專用模式 | 顯示 ${selectedTypeData.checkedIn}/${selectedTypeData.total} 學生`,
        type: 'success',
        duration: 3000,
        customClass: 'ibm-message'
      })
    }
  }
}

const clearFilter = () => {
  handleTypeSelect('all')
}
</script>

<style scoped>
.stat-card {
  background-color: #2d2d2d;
  border: 1px solid #4a4a4a;
  height: 100%;
}

.stat-card.ibm-style {
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
  border: 2px solid #00ff7f;
  border-radius: 8px;
  box-shadow: 
    0 0 15px rgba(0, 255, 127, 0.1),
    0 5px 20px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.stat-card :deep(.el-card__header) {
  background-color: #3a3a3a;
  border-bottom: 1px solid #4a4a4a;
  padding: 12px 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h4 {
  color: #ffffff;
  margin: 0;
  font-size: calc(var(--base-font-size) * 0.875);
  font-weight: bold;
}

.header-actions {
  display: flex;
  align-items: center;
}

.clear-filter-btn {
  color: #409eff !important;
  padding: 4px 8px !important;
  height: auto !important;
  font-size: calc(var(--base-font-size) * 0.75) !important;
}

.type-stats-container {
  padding: 16px;
  min-height: 200px;
  font-family: 'Courier New', monospace;
}

/* IBM主機風格統計條 */
.ibm-stat-item {
  margin-bottom: 12px;
  padding: 8px 12px;
  background-color: #1a1a1a;
  border: 1px solid #4a4a4a;
  border-radius: 2px;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  box-shadow: 
    inset 0 1px 2px rgba(0, 0, 0, 0.3),
    0 1px 3px rgba(0, 0, 0, 0.5);
}

.ibm-stat-item:hover {
  background-color: #2a2a2a;
  border-color: #666;
  transform: translateX(1px);
  box-shadow: 
    inset 0 1px 2px rgba(0, 0, 0, 0.3),
    0 2px 6px rgba(0, 0, 0, 0.4);
}

.ibm-stat-item.selected {
  background-color: #0a2a4a;
  border-color: #409eff;
  box-shadow: 
    inset 0 1px 2px rgba(0, 0, 0, 0.3),
    0 0 12px rgba(64, 158, 255, 0.4),
    0 2px 6px rgba(0, 0, 0, 0.4);
}

.ibm-stat-item.all-types {
  border-color: #409eff;
  background-color: #1a2a3a;
}

.ibm-stat-item.all-types.selected {
  background-color: #0a3a5a;
  box-shadow: 
    inset 0 1px 2px rgba(0, 0, 0, 0.3),
    0 0 15px rgba(64, 158, 255, 0.5),
    0 2px 8px rgba(0, 0, 0, 0.4);
}

.ibm-stat-item:last-child {
  margin-bottom: 0;
}

.ibm-stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.stat-label {
  color: #00ff7f;
  font-size: calc(var(--base-font-size) * 0.6875);
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
  text-shadow: 0 0 4px currentColor;
}

.all-types .stat-label {
  color: #409eff;
}

.stat-numbers {
  color: #ffffff;
  font-size: calc(var(--base-font-size) * 0.625);
  font-weight: bold;
  letter-spacing: 0.5px;
}

.ibm-progress-bar {
  position: relative;
  width: 100%;
  height: 20px;
  background-color: #0a0a0a;
  border: 1px solid #333;
  border-radius: 1px;
  overflow: hidden;
  box-shadow: 
    inset 0 1px 3px rgba(0, 0, 0, 0.7),
    0 0 5px rgba(var(--stat-label-color), 0.2);
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
    transparent 3px,
    #222 3px,
    #222 4px
  );
  opacity: 0.3;
  z-index: 1;
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: calc(var(--progress-percentage) * 1%);
  background-color: var(--stat-label-color);
  background-image: 
    repeating-linear-gradient(
      90deg,
      transparent 0px,
      transparent 2px,
      rgba(255, 255, 255, 0.1) 2px,
      rgba(255, 255, 255, 0.1) 3px
    );
  opacity: 0;
  z-index: 2;
  animation: progressFillStat 1.5s ease-out 1.5s forwards;
  box-shadow: 
    inset 0 0 5px rgba(255, 255, 255, 0.2),
    0 0 10px rgba(var(--stat-label-color), 0.5);
}

@keyframes progressFillStat {
  0% {
    width: 0%;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    width: calc(var(--progress-percentage) * 1%);
    opacity: 1;
  }
}

.scan-line {
  position: absolute;
  top: 0;
  left: -1px;
  width: 1px;
  height: 100%;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    var(--stat-label-color) 20%,
    white 50%,
    var(--stat-label-color) 80%,
    transparent 100%
  );
  animation: scanLineStat 1.5s ease-in-out 1;
  opacity: 0.8;
  z-index: 3;
  box-shadow: 0 0 6px var(--stat-label-color);
}

@keyframes scanLineStat {
  0% {
    left: -1px;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    left: calc(var(--progress-percentage) * 1%);
    opacity: 1;
  }
  100% {
    left: calc(var(--progress-percentage) * 1%);
    opacity: 0;
  }
}

/* 選中狀態指示器 */
.selection-indicator {
  position: absolute;
  top: 0;
  left: -1px;
  width: 1px;
  height: 100%;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    var(--stat-label-color) 20%,
    white 50%,
    var(--stat-label-color) 80%,
    transparent 100%
  );
  animation: selectionBlink 1.5s ease-in-out infinite;
  opacity: 0.8;
  z-index: 4;
  box-shadow: 0 0 6px var(--stat-label-color);
}

@keyframes selectionBlink {
  0%, 100% {
    left: -1px;
    opacity: 0.3;
  }
  50% {
    left: calc(var(--progress-percentage) * 1%);
    opacity: 1;
  }
}

.filter-hint {
  margin: 16px;
  margin-top: 0;
}

.filter-alert {
  background-color: rgba(64, 158, 255, 0.1);
  border-color: #409eff;
}

.hint-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.inline-clear-btn {
  color: #409eff !important;
  padding: 2px 6px !important;
  height: auto !important;
  font-size: calc(var(--base-font-size) * 0.75) !important;
}

.no-data {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 150px;
  color: #666666;
}

/* IBM主機風格互動效果 */
.ibm-stat-item::after {
  content: '[█]';
  position: absolute;
  top: 4px;
  right: 6px;
  color: var(--stat-label-color, #00ff7f);
  font-size: calc(var(--base-font-size) * 0.5);
  opacity: 0;
  transition: opacity 0.3s ease;
  font-family: 'Courier New', monospace;
  text-shadow: 0 0 4px currentColor;
}

.ibm-stat-item:hover::after {
  opacity: 0.6;
}

.ibm-stat-item.selected::after {
  opacity: 1;
  animation: blinkCursor 1.5s infinite;
}

@keyframes blinkCursor {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0.3;
  }
}

/* 響應式設計 */
@media (max-width: 768px) {
  .type-stats-container {
    padding: 12px;
  }
  
  .ibm-stat-item {
    margin-bottom: 8px;
    padding: 6px 10px;
  }
  
  .ibm-stat-header {
    margin-bottom: 4px;
  }
  
  .stat-label {
    font-size: calc(var(--base-font-size) * 0.625);
  }
  
  .stat-numbers {
    font-size: calc(var(--base-font-size) * 0.5625);
  }
  
  .ibm-progress-bar {
    height: 16px;
  }
  
  .ibm-stat-item::after {
    font-size: calc(var(--base-font-size) * 0.4375);
    top: 3px;
    right: 4px;
  }
  
  .hint-content {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }
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

/* IBM風格消息樣式 */
:global(.el-message.ibm-message) {
  background: linear-gradient(135deg, #0a2a1a 0%, #1a3a2a 100%);
  border: 1px solid #00ff7f;
  border-radius: 4px;
  box-shadow: 
    0 0 10px rgba(0, 255, 127, 0.3),
    0 2px 8px rgba(0, 0, 0, 0.5);
  color: #00ff7f;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  text-shadow: 0 0 4px currentColor;
}
</style>