<template>
  <div class="flow-chart-container">
    <div class="chart-controls">
      <el-button-group size="small">
        <el-button 
          @click="changeInterval(5)"
          :type="config.interval === 5 ? 'primary' : ''"
        >5分鐘</el-button>
        <el-button 
          @click="changeInterval(10)"
          :type="config.interval === 10 ? 'primary' : ''"
        >10分鐘</el-button>
        <el-button 
          @click="changeInterval(30)"
          :type="config.interval === 30 ? 'primary' : ''"
        >30分鐘</el-button>
        <el-button 
          @click="changeInterval(60)"
          :type="config.interval === 60 ? 'primary' : ''"
        >1小時</el-button>
      </el-button-group>
    </div>
    
    <div class="chart-wrapper">
      <canvas 
        v-if="props.data.length > 0"
        ref="chartCanvas" 
        :width="canvasWidth" 
        :height="canvasHeight"
      ></canvas>
      
      <!-- 無資料狀態 -->
      <div v-else class="no-flow-data">
        <div class="no-data-icon">📊</div>
        <div class="no-data-title" :class="{ 'filtered': isFilterMode }">
          {{ isFilterMode ? '此類別暫無報到流量' : '暫無報到流量' }}
        </div>
        <div class="no-data-subtitle">
          {{ isFilterMode ? `${filterType} 類別等待報到` : '等待學生開始報到' }}
        </div>
      </div>
    </div>
    
    <div class="chart-info">
      <el-statistic
        title="時間間隔"
        :value="config.interval"
        suffix="分鐘"
        class="flow-statistic"
      />
      <el-statistic
        title="最高流量"
        :value="maxFlow"
        suffix="人"
        class="flow-statistic"
      />
      <el-statistic
        title="平均流量"
        :value="avgFlow"
        suffix="人"
        class="flow-statistic"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import * as d3 from 'd3'

// Props
const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  config: {
    type: Object,
    default: () => ({
      interval: 10,
      timeFormat: 'HH:mm',
      maxDataPoints: 20,
      showGrid: true,
      showPoints: true,
      lineColor: '#00FF00',
      fillColor: 'rgba(0, 255, 0, 0.1)'
    })
  },
  filterType: {
    type: String,
    default: 'all'
  }
})

// Emits
const emit = defineEmits(['config-change'])

const chartCanvas = ref(null)
const canvasWidth = ref(400)
const canvasHeight = ref(200)

// 動畫相關
const animationFrameId = ref(null)
const glowPosition = ref(0)
const glowRadius = ref(8)
const breathingPhase = ref(0)
const pathPoints = ref([])

// 計算屬性
const isFilterMode = computed(() => {
  return props.filterType !== 'all'
})

const maxFlow = computed(() => {
  if (!props.data.length) return 0
  return Math.max(...props.data.map(d => d.count))
})

const avgFlow = computed(() => {
  if (!props.data.length) return 0
  const sum = props.data.reduce((acc, d) => acc + d.count, 0)
  return Math.round(sum / props.data.length * 10) / 10
})

// 響應式畫布尺寸
const updateCanvasSize = () => {
  if (!chartCanvas.value) return
  
  const container = chartCanvas.value.parentElement
  const rect = container.getBoundingClientRect()
  
  // 響應式寬度
  if (window.innerWidth < 768) {
    canvasWidth.value = Math.min(rect.width - 20, 350)
    canvasHeight.value = 150
  } else {
    canvasWidth.value = Math.min(rect.width - 20, 400)
    canvasHeight.value = 200
  }
  
  nextTick(() => {
    drawChart()
  })
}

// 改變時間間隔
const changeInterval = (interval) => {
  emit('config-change', interval) // 只傳送新的間隔值
}

// 繪製圖表
const drawChart = () => {
  if (!chartCanvas.value || !props.data.length) return

  const canvas = chartCanvas.value
  const ctx = canvas.getContext('2d')
  
  // 清除畫布
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // 計算繪圖區域
  const padding = { 
    top: 20, 
    right: window.innerWidth < 768 ? 15 : 20, 
    bottom: window.innerWidth < 768 ? 35 : 40, 
    left: window.innerWidth < 768 ? 35 : 40 
  }
  const chartWidth = canvas.width - padding.left - padding.right
  const chartHeight = canvas.height - padding.top - padding.bottom

  if (chartWidth <= 0 || chartHeight <= 0) return

  const maxCount = Math.max(...props.data.map(d => d.count), 1)
  
  // 繪製網格線
  if (props.config.showGrid) {
    drawGrid(ctx, padding, chartWidth, chartHeight, maxCount)
  }
  
  // 繪製填充區域
  drawFillArea(ctx, padding, chartWidth, chartHeight, maxCount)
  
  // 繪製折線
  drawLine(ctx, padding, chartWidth, chartHeight, maxCount)
  
  // 繪製數據點
  if (props.config.showPoints) {
    drawPoints(ctx, padding, chartWidth, chartHeight, maxCount)
  }
  
  // 繪製軸標籤
  drawLabels(ctx, padding, chartWidth, chartHeight, maxCount)
}

// 繪製網格線
const drawGrid = (ctx, padding, chartWidth, chartHeight, maxCount) => {
  ctx.strokeStyle = 'rgba(0, 255, 0, 0.15)'
  ctx.lineWidth = 1
  
  // 水平網格線
  const gridLines = 4
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartHeight / gridLines) * i
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(padding.left + chartWidth, y)
    ctx.stroke()
  }
  
  // 垂直網格線（時間點）
  if (props.data.length > 1) {
    const step = Math.max(1, Math.floor(props.data.length / 6))
    for (let i = 0; i < props.data.length; i += step) {
      const x = padding.left + (chartWidth / (props.data.length - 1)) * i
      ctx.beginPath()
      ctx.moveTo(x, padding.top)
      ctx.lineTo(x, padding.top + chartHeight)
      ctx.stroke()
    }
  }
}

// 繪製填充區域
const drawFillArea = (ctx, padding, chartWidth, chartHeight, maxCount) => {
  if (props.data.length < 2) return
  
  ctx.fillStyle = props.config.fillColor
  ctx.beginPath()
  
  // 起始點
  ctx.moveTo(padding.left, padding.top + chartHeight)
  
  // 數據點
  props.data.forEach((point, index) => {
    const x = padding.left + (chartWidth / (props.data.length - 1)) * index
    const y = padding.top + chartHeight - (point.count / maxCount) * chartHeight
    ctx.lineTo(x, y)
  })
  
  // 結束點
  ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight)
  ctx.closePath()
  ctx.fill()
}

// 繪製折線
const drawLine = (ctx, padding, chartWidth, chartHeight, maxCount) => {
  if (props.data.length < 2) return
  
  // 儲存路徑點用於動畫
  pathPoints.value = props.data.map((point, index) => {
    const x = padding.left + (chartWidth / (props.data.length - 1)) * index
    const y = padding.top + chartHeight - (point.count / maxCount) * chartHeight
    return { x, y }
  })
  
  // 繪製粗綠色螢光線條
  ctx.strokeStyle = '#00FF00'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = '#00FF00'
  ctx.shadowBlur = 10
  ctx.beginPath()

  pathPoints.value.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y)
    } else {
      ctx.lineTo(point.x, point.y)
    }
  })

  ctx.stroke()
  
  // 重設陰影
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  
  // 繪製螢光點
  drawGlowingDot(ctx)
}

// 繪製數據點
const drawPoints = (ctx, padding, chartWidth, chartHeight, maxCount) => {
  ctx.fillStyle = '#FFFFFF'
  
  props.data.forEach((point, index) => {
    const x = padding.left + (chartWidth / (props.data.length - 1)) * index
    const y = padding.top + chartHeight - (point.count / maxCount) * chartHeight

    ctx.beginPath()
    ctx.arc(x, y, 2, 0, 2 * Math.PI)
    ctx.fill()

    // 在較大屏幕上顯示數值
    if (window.innerWidth >= 768) {
      ctx.fillStyle = '#ffffff'
      const baseFontSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--base-font-size')) || 16
      ctx.font = `${Math.max(baseFontSize * 0.625, 10)}px Monaco, monospace`
      ctx.textAlign = 'center'
      ctx.fillText(point.count.toString(), x, y - 8)
      ctx.fillStyle = '#FFFFFF'
    }
  })
}

// 繪製標籤
const drawLabels = (ctx, padding, chartWidth, chartHeight, maxCount) => {
  ctx.fillStyle = '#cccccc'
  const baseFontSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--base-font-size')) || 16
  const fontSize = window.innerWidth < 768 ? Math.max(baseFontSize * 0.625, 10) : Math.max(baseFontSize * 0.6875, 11)
  ctx.font = `${fontSize}px Arial`
  
  // Y軸標籤
  ctx.textAlign = 'right'
  const ySteps = 4
  for (let i = 0; i <= ySteps; i++) {
    const value = Math.round((maxCount / ySteps) * (ySteps - i))
    const y = padding.top + (chartHeight / ySteps) * i + 4
    ctx.fillText(value.toString(), padding.left - 8, y)
  }

  // X軸標籤（時間）
  ctx.textAlign = 'center'
  const labelStep = window.innerWidth < 768 ? Math.max(2, Math.floor(props.data.length / 4)) : Math.max(1, Math.floor(props.data.length / 6))
  
  props.data.forEach((point, index) => {
    if (index % labelStep === 0 || index === props.data.length - 1) {
      const x = padding.left + (chartWidth / (props.data.length - 1)) * index
      const y = padding.top + chartHeight + 20
      ctx.fillText(point.time, x, y)
    }
  })
}

// 繪製移動的grow螢光點
const drawGlowingDot = (ctx) => {
  if (pathPoints.value.length < 2) return
  
  // 計算在路徑上的位置
  const totalLength = pathPoints.value.length - 1
  const position = (glowPosition.value % 1) * totalLength
  const segmentIndex = Math.floor(position)
  const segmentProgress = position - segmentIndex
  
  if (segmentIndex >= pathPoints.value.length - 1) return
  
  const currentPoint = pathPoints.value[segmentIndex]
  const nextPoint = pathPoints.value[segmentIndex + 1]
  
  // 線性插值計算位置
  const x = currentPoint.x + (nextPoint.x - currentPoint.x) * segmentProgress
  const y = currentPoint.y + (nextPoint.y - currentPoint.y) * segmentProgress
  
  // grow效果 - 從小到大再到小的循環
  const growScale = 0.3 + 0.7 * (Math.sin(breathingPhase.value) * 0.5 + 0.5)
  const currentRadius = glowRadius.value * growScale
  
  // 最外層光暈
  const outerGradient = ctx.createRadialGradient(x, y, 0, x, y, currentRadius * 3)
  outerGradient.addColorStop(0, 'rgba(0, 255, 0, 0.6)')
  outerGradient.addColorStop(0.5, 'rgba(0, 255, 0, 0.3)')
  outerGradient.addColorStop(0.8, 'rgba(0, 255, 0, 0.1)')
  outerGradient.addColorStop(1, 'rgba(0, 255, 0, 0)')
  
  ctx.beginPath()
  ctx.arc(x, y, currentRadius * 3, 0, 2 * Math.PI)
  ctx.fillStyle = outerGradient
  ctx.fill()
  
  // 中層螢光圈
  const middleGradient = ctx.createRadialGradient(x, y, 0, x, y, currentRadius * 2)
  middleGradient.addColorStop(0, 'rgba(0, 255, 0, 0.8)')
  middleGradient.addColorStop(0.6, 'rgba(0, 255, 0, 0.4)')
  middleGradient.addColorStop(1, 'rgba(0, 255, 0, 0)')
  
  ctx.beginPath()
  ctx.arc(x, y, currentRadius * 2, 0, 2 * Math.PI)
  ctx.fillStyle = middleGradient
  ctx.fill()
  
  // 內層核心光點
  const innerGradient = ctx.createRadialGradient(x, y, 0, x, y, currentRadius)
  innerGradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  innerGradient.addColorStop(0.4, 'rgba(0, 255, 0, 0.9)')
  innerGradient.addColorStop(1, 'rgba(0, 255, 0, 0.6)')
  
  ctx.beginPath()
  ctx.arc(x, y, currentRadius, 0, 2 * Math.PI)
  ctx.fillStyle = innerGradient
  ctx.fill()
}

// 動畫循環
const animate = () => {
  if (!props.data.length) return
  
  // 更新動畫參數
  glowPosition.value += 0.005 // 移動速度
  breathingPhase.value += 0.08 // 呼吸速度
  
  // 重新繪製
  drawChart()
  
  // 繼續動畫
  animationFrameId.value = requestAnimationFrame(animate)
}

// 停止動畫
const stopAnimation = () => {
  if (animationFrameId.value) {
    cancelAnimationFrame(animationFrameId.value)
    animationFrameId.value = null
  }
}

// 開始動畫
const startAnimation = () => {
  stopAnimation()
  if (props.data.length > 0) {
    animate()
  }
}

// 監聽數據變化重新繪製
watch(() => props.data, () => {
  nextTick(() => {
    drawChart()
    startAnimation()
  })
}, { deep: true })

watch(() => props.config, () => {
  nextTick(() => {
    drawChart()
    startAnimation()
  })
}, { deep: true })

// 響應式處理
let resizeObserver = null

onMounted(() => {
  updateCanvasSize()
  drawChart()
  startAnimation()
  
  // 監聽窗口大小變化
  window.addEventListener('resize', updateCanvasSize)
  
  // 使用 ResizeObserver 監聽容器大小變化
  if (chartCanvas.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      updateCanvasSize()
    })
    resizeObserver.observe(chartCanvas.value.parentElement)
  }
})

onUnmounted(() => {
  stopAnimation()
  window.removeEventListener('resize', updateCanvasSize)
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})
</script>

<style scoped>
.flow-chart-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
  height: 100%;
  background-color: #1a1a1a;
  border-radius: 6px;
  padding: 10px;
  border: 1px solid rgba(0, 255, 0, 0.3);
  box-shadow: 0 0 20px rgba(0, 255, 0, 0.1);
}

.chart-controls {
  display: flex;
  justify-content: center;
  padding: 10px 0;
  border-bottom: 1px solid #4a4a4a;
}

.chart-controls :deep(.el-button) {
  background-color: #3a3a3a;
  border-color: #4a4a4a;
  color: #ffffff;
}

.chart-controls :deep(.el-button:hover) {
  background-color: #4a4a4a;
  border-color: #5a5a5a;
  color: #ffffff;
}

.chart-controls :deep(.el-button--primary) {
  background-color: #409eff;
  border-color: #409eff;
  color: #ffffff;
}

.chart-wrapper {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 150px;
  background-color: #0a0a0a;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

.chart-wrapper::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: repeating-linear-gradient(
    90deg,
    transparent,
    transparent 2px,
    rgba(0, 255, 0, 0.03) 2px,
    rgba(0, 255, 0, 0.03) 4px
  );
  pointer-events: none;
  z-index: 1;
}

canvas {
  max-width: 100%;
  height: auto;
  position: relative;
  z-index: 2;
  filter: drop-shadow(0 0 8px rgba(0, 255, 0, 0.3));
}

.chart-info {
  display: flex;
  justify-content: space-around;
  padding: 10px 0;
  border-top: 1px solid rgba(0, 255, 0, 0.3);
  background-color: #0f0f0f;
  border-radius: 6px;
}

.flow-statistic {
  text-align: center;
}

/* Element Plus Statistic 樣式覆蓋 */
.flow-statistic :deep(.el-statistic__head) {
  font-size: calc(var(--base-font-size) * 0.75);
  color: #00AA00;
  font-family: Monaco, monospace;
  margin-bottom: 2px;
}

.flow-statistic :deep(.el-statistic__content) {
  font-size: calc(var(--base-font-size) * 0.875);
  color: #00FF00;
  font-weight: bold;
  font-family: Monaco, monospace;
  text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
}

.no-flow-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 150px;
  color: #666666;
  text-align: center;
}

.no-data-icon {
  font-size: calc(var(--base-font-size) * 2.0);
  margin-bottom: 12px;
}

.no-data-title {
  font-size: calc(var(--base-font-size) * 1.0);
  font-weight: bold;
  color: #cccccc;
  margin-bottom: 4px;
}

.no-data-subtitle {
  font-size: calc(var(--base-font-size) * 0.875);
  color: #999999;
}

/* 篩選模式下的無資料狀態 */
.no-data-title.filtered {
  color: #ff8c00;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .chart-controls {
    padding: 8px 0;
  }
  
  .chart-controls :deep(.el-button-group) {
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .chart-controls :deep(.el-button) {
    padding: 6px 12px;
    font-size: calc(var(--base-font-size) * 0.75);
  }
  
  .chart-info {
    flex-direction: column;
    gap: 8px;
    padding: 8px;
  }
  
  .flow-statistic {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .flow-statistic :deep(.el-statistic__head) {
    margin-bottom: 0;
  }
}

@media (max-width: 480px) {
  .chart-controls :deep(.el-button) {
    padding: 4px 8px;
    font-size: calc(var(--base-font-size) * 0.6875);
  }
  
  .flow-statistic :deep(.el-statistic__content) {
    font-size: calc(var(--base-font-size) * 0.8125);
  }
  
  .flow-statistic :deep(.el-statistic__head) {
    font-size: calc(var(--base-font-size) * 0.6875);
  }
}
</style>