<template>
  <div class="table-container">
    <el-card class="table-card">
      <template #header>
        <div class="card-header">
          <h3>最新報到學生名單</h3>
          
          <!-- 顯示模式切換器
          <div class="display-mode-switcher">
            <el-switch
              v-model="useSciFiMode"
              active-text="科幻打字機"
              inactive-text="傳統表格"
              :active-icon="Monitor"
              :inactive-icon="List"
              size="large"
              @change="onDisplayModeChange"
            />
          </div> -->
        </div>
      </template>
      
      <!-- 科幻打字機模式 -->
      <SciFiTypewriterTable
        v-if="useSciFiMode"
        :students="sortedStudents"
        :pageSize="pageSize"
        :autoPlayInterval="autoPlayInterval"
        :newCheckins="newCheckins"
        :displayConfig="displayConfig"
        @page-change="handleSciFiPageChange"
      />
      
      <!-- 傳統表格模式 -->
      <div v-else class="traditional-table-wrapper">
        <el-table
          :data="paginatedStudents"
          :loading="loading"
          style="width: 100%"
          :header-cell-style="headerCellStyle"
          :cell-style="cellStyle"
          :row-style="rowStyle"
          stripe
          :height="tableHeight"
          size="default"
          class="responsive-table"
        >
          <!-- 新記錄標記欄位 -->
          <el-table-column label="" width="40" align="center">
            <template #default="{ row }">
              <span v-if="row.isNewRecord" class="new-record-emoji" title="本次下載的新記錄">
                📥
              </span>
            </template>
          </el-table-column>
          
          <el-table-column prop="name" label="姓名" :width="nameColumnWidth" align="center">
            <template #default="{ row }">
              <div class="student-info">
                <span class="student-name" :class="{ 'new-checkin': isNewCheckin(row) }">
                  {{ getStudentName(row) }}
                  <span v-if="isNewCheckin(row)" class="new-badge">🎉 新報到</span>
                </span>
                <!-- 顯示報到時間 -->
                <div v-if="getCheckinTimeDisplay(row)" class="checkin-time">
                  {{ getCheckinTimeDisplay(row) }}
                </div>
              </div>
            </template>
          </el-table-column>
          
          <el-table-column prop="gender" label="性別" :width="genderColumnWidth" align="center" v-if="!isMobile">
            <template #default="{ row }">
              <el-tag :type="getGenderValue(row) === '男' ? 'primary' : 'success'" :size="tagSize">
                {{ getGenderValue(row) }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="school" label="畢業學校" :min-width="schoolColumnWidth" align="center" v-if="!isMobile">
            <template #default="{ row }">
              <span class="school-name">{{ getSchoolValue(row) }}</span>
            </template>
          </el-table-column>
          
          <!-- 手機版合併列 -->
          <el-table-column label="詳細資訊" min-width="200" align="left" v-if="isMobile">
            <template #default="{ row }">
              <div class="mobile-info">
                <div class="mobile-row">
                  <el-tag :type="getGenderValue(row) === '男' ? 'primary' : 'success'" size="small">
                    {{ getGenderValue(row) }}
                  </el-tag>
                  <span class="mobile-school">{{ shortenSchoolName(getSchoolValue(row)) }}</span>
                </div>
                <div class="mobile-row">
                  <span class="mobile-type">{{ getStudentType(row) }}</span>
                </div>
              </div>
            </template>
          </el-table-column>
        </el-table>
        
        <!-- 傳統分頁 -->
        <div class="pagination-container">
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="sortedStudents.length"
            :layout="paginationLayout"
            :pager-count="pagerCount"
            @current-change="handlePageChange"
            background
          />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Monitor, List } from '@element-plus/icons-vue'
import SciFiTypewriterTable from './SciFiTypewriterTable.vue'
import dayjs from 'dayjs'

// Props
const props = defineProps({
  students: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  newCheckins: {
    type: Array,
    default: () => []
  },
  displayConfig: {
    type: Array,
    default: () => []
  },
  showConfigInfo: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['refresh'])

// 響應式檢測
const isMobile = ref(false)
const windowWidth = ref(window.innerWidth)
const windowHeight = ref(window.innerHeight)

// 顯示模式
const useSciFiMode = ref(true) // 預設使用科幻打字機模式

// 換頁倒數計時設定
const autoPlayInterval = ref(10) // 預設10秒

// 分頁相關
const currentPage = ref(1)
const pageSize =  10 // 科幻模式建議較少行數以便顯示效果

// 響應式列寬和字體大小
const nameColumnWidth = computed(() => isMobile.value ? 100 : 150)
const genderColumnWidth = computed(() => isMobile.value ? 80 : 100)
const schoolColumnWidth = computed(() => isMobile.value ? 150 : 300)
const tableHeight = computed(() => isMobile.value ? 400 : 600)
const tagSize = computed(() => isMobile.value ? 'small' : 'default')

// 計算屬性：按時間戳排序的學生列表
const sortedStudents = computed(() => {
  if (!props.students || props.students.length === 0) {
    return []
  }
  
  // 創建副本避免修改原數據
  const studentsCopy = [...props.students]
  
  return studentsCopy.sort((a, b) => {
    // 首先：新記錄排在最前面
    if (a.isNewRecord && !b.isNewRecord) return -1
    if (!a.isNewRecord && b.isNewRecord) return 1
    
    // 其次：獲取報到時間戳排序
    const aTime = getCheckinTimestamp(a)
    const bTime = getCheckinTimestamp(b)
    
    // 按時間戳排序（新的在前）
    if (aTime && bTime) {
      return bTime - aTime // 降序排列（新的在前）
    }
    
    // 有時間戳的排在前面
    if (aTime && !bTime) return -1
    if (!aTime && bTime) return 1
    
    // 都沒有時間戳則保持原順序
    return 0
  })
})

// 計算分頁後的數據（只用於傳統表格）
const paginatedStudents = computed(() => {
  if (useSciFiMode.value) return []
  
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return sortedStudents.value.slice(start, end)
})

// 響應式分頁配置
const paginationLayout = computed(() => {
  return isMobile.value ? 'prev, pager, next' : 'prev, pager, next, jumper, total'
})

const pagerCount = computed(() => {
  return isMobile.value ? 3 : 5
})

// 數據提取方法
const getStudentName = (student) => {
  // 從 displayConfig 中找到姓名欄位
  const nameConfig = props.displayConfig.find(config => 
    config.顯示區塊 && config.顯示區塊.includes('StudentTable') && 
    (config.欄位名稱.includes('姓名') || config.欄位名稱.includes('Name'))
  )
  
  if (nameConfig) {
    return student[nameConfig.欄位名稱] || '未知'
  }
  
  // 備用邏輯
  return student.name || student.姓名 || student.Name || '未知'
}

const getGenderValue = (student) => {
  // 從 displayConfig 中找到性別欄位
  const genderConfig = props.displayConfig.find(config => 
    config.欄位名稱.includes('性別') || config.欄位名稱.includes('Gender')
  )
  
  if (genderConfig) {
    return student[genderConfig.欄位名稱] || '未知'
  }
  
  // 備用邏輯
  return student.gender || student.性別 || student.Gender || '未知'
}

const getSchoolValue = (student) => {
  // 從 displayConfig 中找到學校欄位
  const schoolConfig = props.displayConfig.find(config => 
    config.欄位名稱.includes('學校') || config.欄位名稱.includes('School') || 
    config.欄位名稱.includes('國中') || config.欄位名稱.includes('高中')
  )
  
  if (schoolConfig) {
    return student[schoolConfig.欄位名稱] || '未知'
  }
  
  // 備用邏輯
  return student.school || student.學校 || student.School || '未知'
}

const getStudentType = (student) => {
  // 從 displayConfig 中找到身分別欄位
  const typeConfig = props.displayConfig.find(config => 
    config.顯示區塊 && config.顯示區塊.includes('TypeStatistics')
  )
  
  if (typeConfig) {
    return student[typeConfig.欄位名稱] || '一般生'
  }
  
  // 備用邏輯
  return student.studentType || student.身分別 || student.Type || '一般生'
}

const getCheckinTimestamp = (student) => {
  // 尋找 datetime 類型的欄位
  const datetimeConfig = props.displayConfig.find(config => 
    config.欄位性質 && config.欄位性質.toLowerCase().includes('datetime')
  )
  
  if (datetimeConfig) {
    const timestampField = datetimeConfig.欄位名稱 + '_timestamp'
    return student[timestampField]
  }
  
  // 備用邏輯
  return student.checkinTimestamp || null
}

const getCheckinTimeDisplay = (student) => {
  // 尋找 datetime 類型的欄位
  const datetimeConfig = props.displayConfig.find(config => 
    config.欄位性質 && config.欄位性質.toLowerCase().includes('datetime')
  )
  
  if (datetimeConfig) {
    const displayValue = student[datetimeConfig.欄位名稱]
    if (displayValue) {
      return displayValue
    }
  }
  
  // 備用：使用時間戳格式化
  const timestamp = getCheckinTimestamp(student)
  if (timestamp) {
    return dayjs(timestamp).format('MM-DD HH:mm')
  }
  
  return ''
}

// 方法
const isNewCheckin = (student) => {
  return props.newCheckins.some(newStudent => {
    const studentUID = student._uid || student.idNumber
    const newStudentUID = newStudent._uid || newStudent.idNumber
    return studentUID && newStudentUID && studentUID === newStudentUID
  })
}

// 縮短學校名稱
const shortenSchoolName = (schoolName) => {
  if (!schoolName) return '未知'
  
  return schoolName
    .replace(/^新北市立/, '')
    .replace(/^台北市立/, '')
    .replace(/^桃園市立/, '')
    .replace(/國民中學$/, '國中')
    .replace(/中學$/, '中')
    .substring(0, 8)
}

// 顯示模式切換
const onDisplayModeChange = (sciFi) => {
  console.log(`📊 切換顯示模式: ${sciFi ? '科幻打字機' : '傳統表格'}`)
  
  // 保存用戶偏好到 localStorage
  localStorage.setItem('studentTableDisplayMode', sciFi ? 'scifi' : 'traditional')
  
  // 如果切換到傳統模式，重置分頁
  if (!sciFi) {
    currentPage.value = 1
  }
}

// 科幻模式的頁面變化處理
const handleSciFiPageChange = (page) => {
  //console.log(`📄 科幻模式切換到第 ${page} 頁`)
  // 可以在這裡添加額外的邏輯
}

// 傳統表格的分頁變化處理
const handlePageChange = (page) => {
  currentPage.value = page
}

// 響應式處理
const updateScreenSize = () => {
  windowWidth.value = window.innerWidth
  windowHeight.value = window.innerHeight
  isMobile.value = window.innerWidth < 768
}

// 載入用戶偏好
const loadUserPreferences = () => {
  const savedMode = localStorage.getItem('studentTableDisplayMode')
  if (savedMode === 'traditional') {
    useSciFiMode.value = false
  } else {
    useSciFiMode.value = true // 預設科幻模式
  }
  
  // 載入換頁倒數計時設定
  const savedAutoPlayInterval = localStorage.getItem('autoPlayInterval')
  if (savedAutoPlayInterval) {
    autoPlayInterval.value = parseInt(savedAutoPlayInterval)
  }
}

// 監聽 localStorage 變化
const handleStorageChange = (event) => {
  if (event.key === 'autoPlayInterval') {
    const newValue = parseInt(event.newValue)
    if (!isNaN(newValue)) {
      autoPlayInterval.value = newValue
      console.log(`⏰ 偵測到換頁倒數計時設定變更: ${newValue}秒`)
    }
  }
}

onMounted(() => {
  updateScreenSize()
  loadUserPreferences()
  window.addEventListener('resize', updateScreenSize)
  window.addEventListener('storage', handleStorageChange)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScreenSize)
  window.removeEventListener('storage', handleStorageChange)
})

// 表格樣式
const headerCellStyle = {
  backgroundColor: '#3a3a3a',
  color: '#ffffff',
  fontWeight: 'bold',
  textAlign: 'center'
}

const cellStyle = {
  backgroundColor: '#2d2d2d',
  color: '#ffffff',
  textAlign: 'center'
}

const rowStyle = ({ row, rowIndex }) => {
  const baseStyle = {
    backgroundColor: rowIndex % 2 === 0 ? '#2d2d2d' : '#363636'
  }
  
  // 新報到學生高亮
  if (isNewCheckin(row)) {
    return {
      ...baseStyle,
      backgroundColor: '#1e3a8a',
      borderLeft: '4px solid #3b82f6',
      animation: 'newCheckinGlow 2s ease-in-out infinite alternate',
      boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
    }
  }
  
  return baseStyle
}
</script>
<style scoped>
.table-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.table-card {
  flex: 1;
  background-color: #2d2d2d;
  border: 1px solid #4a4a4a;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  border-bottom: 1px solid #4a4a4a;
}

.card-header h3 {
  color: #ffffff;
  font-size: calc(var(--base-font-size) * 1.125);
  margin: 0;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.display-mode-switcher {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.traditional-table-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #2d2d2d;
}

.student-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.student-name {
  font-weight: bold;
  color: #ffffff;
  transition: all 0.3s ease;
  font-size: calc(var(--base-font-size) * 0.875);
}

.student-name.new-checkin {
  color: #60a5fa;
  text-shadow: 0 0 8px rgba(96, 165, 250, 0.6);
  font-weight: 900;
}

.new-badge {
  display: block;
  font-size: calc(var(--base-font-size) * 0.625);
  color: #fbbf24;
  margin-top: 2px;
  animation: bounce 1s ease-in-out infinite;
}

.new-record-emoji {
  font-size: var(--base-font-size);
  animation: pulse 2s ease-in-out infinite;
  cursor: help;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
}

.checkin-time {
  font-size: calc(var(--base-font-size) * 0.625);
  color: #67C23A;
  background-color: rgba(103, 194, 58, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  border: 1px solid rgba(103, 194, 58, 0.2);
}

.school-name {
  color: #cccccc;
  font-size: calc(var(--base-font-size) * 0.875);
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 20px;
  padding: 20px 0;
  background: #2d2d2d;
  border-top: 1px solid #4a4a4a;
}

/* 手機版樣式 */
.mobile-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mobile-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mobile-school {
  color: #cccccc;
  font-size: calc(var(--base-font-size) * 0.75);
  flex: 1;
}

.mobile-type {
  color: #999999;
  font-size: calc(var(--base-font-size) * 0.6875);
  background-color: #4a4a4a;
  padding: 2px 6px;
  border-radius: 3px;
}

/* 動畫效果 */
@keyframes newCheckinGlow {
  0% {
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
  }
  100% {
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.8);
  }
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-3px);
  }
  60% {
    transform: translateY(-2px);
  }
}

/* 響應式設計 */
@media (max-width: 768px) {
  .card-header {
    flex-direction: column;
    text-align: center;
    padding: 12px 16px;
  }
  
  .card-header h3 {
    font-size: var(--base-font-size);
  }
  
  .display-mode-switcher {
    width: 100%;
    justify-content: center;
  }
  
  .pagination-container {
    margin-top: 15px;
    padding: 15px 0;
  }
  
  .student-name {
    font-size: 13px;
  }
  
  .checkin-time {
    font-size: 9px;
    padding: 1px 4px;
  }
}

@media (max-width: 480px) {
  .table-card :deep(.el-card__header) {
    padding: 0;
  }
  
  .card-header {
    padding: 10px 12px;
  }
  
  .card-header h3 {
    font-size: calc(var(--base-font-size) * 0.875);
  }
  
  .mobile-school {
    font-size: calc(var(--base-font-size) * 0.6875);
  }
  
  .mobile-type {
    font-size: calc(var(--base-font-size) * 0.625);
    padding: 1px 4px;
  }
  
  .student-name {
    font-size: calc(var(--base-font-size) * 0.75);
  }
}

/* Element Plus 深色主題覆蓋 */
:deep(.el-card) {
  background-color: #2d2d2d;
  border: 1px solid #4a4a4a;
  border-radius: 12px;
  overflow: hidden;
}

:deep(.el-card__header) {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  border-bottom: 1px solid #4a4a4a;
  padding: 0;
}

:deep(.el-card__body) {
  padding: 0;
  background-color: #2d2d2d;
  flex: 1;
  display: flex;
  flex-direction: column;
}

:deep(.el-table) {
  background-color: #2d2d2d;
  color: #ffffff;
  flex: 1;
}

:deep(.el-table .el-table__header-wrapper) {
  background-color: #3a3a3a;
}

:deep(.el-table .el-table__header) {
  background-color: #3a3a3a;
}

:deep(.el-table .el-table__body-wrapper) {
  background-color: #2d2d2d;
  flex: 1;
}

:deep(.el-table .el-table__row) {
  background-color: #2d2d2d;
}

:deep(.el-table .el-table__row:hover) {
  background-color: #3a3a3a;
}

:deep(.el-table .el-table__row--striped) {
  background-color: #363636;
}

:deep(.el-table .el-table__row--striped:hover) {
  background-color: #3a3a3a;
}

:deep(.el-table .el-table__empty-block) {
  background-color: #2d2d2d;
  color: #999999;
}

:deep(.el-table .el-table__empty-text) {
  color: #999999;
}

:deep(.el-pagination) {
  color: #ffffff;
  background-color: #2d2d2d;
}

:deep(.el-pagination .el-pager li) {
  background-color: #3a3a3a;
  color: #ffffff;
  border: 1px solid #4a4a4a;
  border-radius: 4px;
  margin: 0 2px;
}

:deep(.el-pagination .el-pager li:hover) {
  color: #409eff;
  background-color: #4a4a4a;
}

:deep(.el-pagination .el-pager li.is-active) {
  background-color: #409eff;
  color: #ffffff;
  border-color: #409eff;
}

:deep(.el-pagination .btn-prev),
:deep(.el-pagination .btn-next) {
  background-color: #3a3a3a;
  color: #ffffff;
  border: 1px solid #4a4a4a;
  border-radius: 4px;
}

:deep(.el-pagination .btn-prev:hover),
:deep(.el-pagination .btn-next:hover) {
  color: #409eff;
  background-color: #4a4a4a;
}

:deep(.el-pagination .btn-prev:disabled),
:deep(.el-pagination .btn-next:disabled) {
  color: #666666;
  background-color: #2d2d2d;
}

:deep(.el-pagination .el-pagination__jump) {
  color: #ffffff;
}

:deep(.el-pagination .el-pagination__total) {
  color: #ffffff;
}

:deep(.el-input__inner) {
  background-color: #3a3a3a;
  border-color: #4a4a4a;
  color: #ffffff;
}

:deep(.el-input__inner:focus) {
  border-color: #409eff;
}

/* 切換器樣式 */
:deep(.el-switch) {
  --el-switch-on-color: #00ff7f;
  --el-switch-off-color: #4a4a4a;
  --el-switch-border-color: #666666;
}

:deep(.el-switch__label) {
  color: #ffffff;
  font-size: calc(var(--base-font-size) * 0.875);
  font-weight: 500;
}

:deep(.el-switch__label.is-active) {
  color: #00ff7f;
  text-shadow: 0 0 5px rgba(0, 255, 127, 0.3);
}

:deep(.el-switch .el-switch__core) {
  border: 2px solid #666666;
  background-color: #4a4a4a;
  transition: all 0.3s ease;
}

:deep(.el-switch.is-checked .el-switch__core) {
  background-color: #00ff7f;
  border-color: #00ff7f;
  box-shadow: 0 0 10px rgba(0, 255, 127, 0.3);
}

:deep(.el-switch .el-switch__action) {
  background-color: #ffffff;
  transition: all 0.3s ease;
}

/* 科幻風格增強 */
.display-mode-switcher:hover {
  background: rgba(0, 255, 127, 0.1);
  border-color: rgba(0, 255, 127, 0.3);
  transition: all 0.3s ease;
}

.card-header {
  position: relative;
  overflow: hidden;
}

.card-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(0, 255, 127, 0.1),
    transparent
  );
  transition: left 0.5s ease;
}

.card-header:hover::before {
  left: 100%;
}
</style>