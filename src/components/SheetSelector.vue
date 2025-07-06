<template>
  <div class="sheet-selector">
    <el-dropdown 
      @command="handleSheetChange"
      placement="bottom-start"
      :disabled="loading"
      class="sheet-dropdown"
    >
      <el-button 
        type="primary" 
        :loading="loading"
        class="selector-button"
      >
        <el-icon><DocumentCopy /></el-icon>
        <span class="current-sheet-name">{{ currentSheetName }}</span>
        <el-icon class="dropdown-icon"><ArrowDown /></el-icon>
      </el-button>
      
      <template #dropdown>
        <el-dropdown-menu class="sheet-menu">
          <div class="menu-header">
            <span class="menu-title">選擇報到表單</span>
            <el-button 
              text 
              size="small" 
              @click="refreshSheets"
              :loading="refreshing"
              class="refresh-btn"
            >
              <el-icon><Refresh /></el-icon>
            </el-button>
          </div>
          
          <el-divider class="menu-divider" />
          
          <div class="sheets-list">
            <el-dropdown-item
              v-for="sheet in availableSheets"
              :key="sheet.id"
              :command="sheet.id"
              :class="{
                'current-sheet': sheet.id === currentSheetId,
                [`status-${sheet.status}`]: true
              }"
              class="sheet-item"
            >
              <div class="sheet-info">
                <div class="sheet-header">
                  <span class="sheet-name">{{ sheet.name }}</span>
                  <el-tag 
                    :type="getStatusTagType(sheet.status)" 
                    size="small"
                    class="status-tag"
                  >
                    {{ getStatusText(sheet.status) }}
                  </el-tag>
                </div>
              </div>
              
              <div v-if="sheet.id === currentSheetId" class="current-indicator">
                <el-icon><Check /></el-icon>
              </div>
            </el-dropdown-item>
          </div>
          
          <div v-if="!availableSheets.length && !loading" class="no-sheets">
            <el-empty description="沒有可用的表單" :image-size="60" />
          </div>
          
          <div v-if="loading" class="loading-sheets">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>載入表單列表中...</span>
          </div>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    
    <!-- 表單狀態指示器
    <div class="sheet-status-indicator" :class="`status-${currentSheetStatus}`">
      <div class="status-dot"></div>
      <span class="status-text">{{ getStatusText(currentSheetStatus) }}</span>
    </div>-->
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  DocumentCopy, 
  ArrowDown, 
  Refresh, 
  User, 
  Select, 
  Check, 
  Loading 
} from '@element-plus/icons-vue'

// Props
const props = defineProps({
  currentSheetId: {
    type: String,
    default: null
  },
  availableSheets: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['sheet-change', 'refresh-sheets'])

// 響應式數據
const refreshing = ref(false)

// 計算屬性
const currentSheetName = computed(() => {
  if (!props.currentSheetId) return '選擇表單'
  
  const currentSheet = props.availableSheets.find(s => s.id === props.currentSheetId)
  return currentSheet ? currentSheet.name : '未知表單'
})

const currentSheetStatus = computed(() => {
  if (!props.currentSheetId) return 'inactive'
  
  const currentSheet = props.availableSheets.find(s => s.id === props.currentSheetId)
  return currentSheet ? currentSheet.status : 'inactive'
})

// 方法
const handleSheetChange = (sheetId) => {
  if (sheetId === props.currentSheetId) {
    return // 不需要切換
  }
  
  const targetSheet = props.availableSheets.find(s => s.id === sheetId)
  if (targetSheet) {
    console.log(`📋 切換到表單: ${targetSheet.name} (${sheetId})`)
    emit('sheet-change', sheetId)
    ElMessage.success(`已切換到: ${targetSheet.name}`)
  }
}

const refreshSheets = async () => {
  refreshing.value = true
  try {
    await emit('refresh-sheets')
    ElMessage.success('表單列表已更新')
  } catch (error) {
    ElMessage.error('更新表單列表失敗')
  } finally {
    refreshing.value = false
  }
}

const getStatusTagType = (status) => {
  switch (status) {
    case 'active':
      return 'success'
    case 'pending':
      return 'warning'
    case 'ended':
      return 'info'
    case 'error':
      return 'danger'
    default:
      return 'info'
  }
}

const getStatusText = (status) => {
  switch (status) {
    case 'active':
      return '進行中'
    case 'pending':
      return '準備中'
    case 'ended':
      return '已結束'
    case 'error':
      return '錯誤'
    default:
      return '待機中'
  }
}

onMounted(() => {
  console.log('📋 SheetSelector 組件已載入')
})
</script>

<style scoped>
.sheet-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selector-button {
  min-width: 200px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-radius: 8px;
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  border: none;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
  transition: all 0.3s ease;
}

.selector-button:hover {
  background: linear-gradient(135deg, #66b1ff 0%, #85ce61 100%);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
  transform: translateY(-1px);
}

.current-sheet-name {
  flex: 1;
  text-align: left;
  margin: 0 8px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-icon {
  transition: transform 0.3s ease;
}

.sheet-dropdown.is-opened .dropdown-icon {
  transform: rotate(180deg);
}

.sheet-menu {
  min-width: 320px;
  max-width: 400px;
  background-color: #2d2d2d;
  border: 1px solid #4a4a4a;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  padding: 0;
}

.menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #3a3a3a;
  border-radius: 8px 8px 0 0;
}

.menu-title {
  color: #ffffff;
  font-weight: bold;
  font-size: 14px;
}

.refresh-btn {
  color: #409eff !important;
  padding: 4px !important;
}

.menu-divider {
  margin: 0;
  border-color: #4a4a4a;
}

.sheets-list {
  max-height: 300px;
  overflow-y: auto;
  padding: 8px 0;
}

.sheet-item {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
}

.sheet-item:hover {
  background-color: #3a3a3a;
  border-left-color: #409eff;
}

.sheet-item.current-sheet {
  background-color: rgba(64, 158, 255, 0.1);
  border-left-color: #409eff;
}

.sheet-item.status-active {
  border-left-color: #67C23A;
}

.sheet-item.status-pending {
  border-left-color: #E6A23C;
}

.sheet-item.status-ended {
  border-left-color: #909399;
}

.sheet-item.status-error {
  border-left-color: #F56C6C;
}

.sheet-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sheet-name {
  color: #ffffff;
  font-weight: 500;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.status-tag {
  font-size: 11px;
  padding: 2px 6px;
}

.current-indicator {
  color: #67C23A;
  font-size: 16px;
  margin-left: 8px;
}

.no-sheets, .loading-sheets {
  padding: 20px;
  text-align: center;
  color: #666666;
}

.loading-sheets {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.sheet-status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: statusPulse 2s ease-in-out infinite;
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
  font-size: 12px;
  font-weight: 500;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .sheet-selector {
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }
  
  .selector-button {
    min-width: auto;
    width: 100%;
  }
  
  .sheet-menu {
    min-width: 280px;
    max-width: 90vw;
  }
  
  .sheet-status-indicator {
    align-self: center;
  }
}

@media (max-width: 480px) {
  .current-sheet-name {
    font-size: 13px;
  }
  
  .sheet-name {
    font-size: 13px;
    max-width: 150px;
  }
}

/* 深色主題下的下拉菜單樣式 */
:deep(.el-dropdown-menu) {
  background-color: #2d2d2d;
  border-color: #4a4a4a;
}

:deep(.el-dropdown-menu__item) {
  color: #ffffff;
  background-color: transparent;
}

:deep(.el-dropdown-menu__item:hover) {
  background-color: #3a3a3a;
  color: #ffffff;
}

:deep(.el-dropdown-menu__item.is-disabled) {
  color: #666666;
}

/* 滾動條樣式 */
.sheets-list::-webkit-scrollbar {
  width: 6px;
}

.sheets-list::-webkit-scrollbar-track {
  background: #4a4a4a;
  border-radius: 3px;
}

.sheets-list::-webkit-scrollbar-thumb {
  background: #666666;
  border-radius: 3px;
}

.sheets-list::-webkit-scrollbar-thumb:hover {
  background: #888888;
}
</style>