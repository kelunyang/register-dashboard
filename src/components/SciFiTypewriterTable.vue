<template>
  <div class="scifi-table-container">
    <!-- 控制面板 -->
    <div class="control-panel">
      <div class="status-info">
        <!-- 搜尋輸入框 -->
        <div class="search-container">
          <el-input
            v-model="searchQuery"
            placeholder="搜尋學生"
            clearable
            size="large"
            class="search-input"
            @input="handleSearch"
            @clear="clearSearch"
            @focus="showSearchHint"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
        
        <div class="page-info">
          <el-icon><Document /></el-icon>
          <span v-if="!isSearchMode">第 {{ currentPage }} / {{ totalPages }} 頁</span>
          <span v-else>搜尋模式 - {{ currentPageStudents.length }} 筆</span>
        </div>
        <div class="student-count">
          <el-icon><User /></el-icon>
          <span>{{ isSearchMode ? filteredStudents.length : totalStudents }} 位學生</span>
        </div>
      </div>
      
      <div class="controls">
        <template v-if="!isSearchMode">
          <!-- 自動播放控制 -->
          <el-button 
            @click="toggleAutoPlay"
            :type="isAutoPlay ? 'danger' : 'primary'"
            size="large"
            class="play-button"
          >
            <el-icon>
              <VideoPause v-if="isAutoPlay" />
              <VideoPlay v-else />
            </el-icon>
            {{ isAutoPlay ? '暫停輪播' : '開始輪播' }}
          </el-button>
          
          <!-- 倒數計時顯示 -->
          <div v-if="isAutoPlay" class="countdown-display">
            <div class="countdown-circle" :style="{ '--progress': countdownProgress }">
              <span class="countdown-number">{{ countdown }}</span>
            </div>
            <span class="countdown-text">秒後換頁</span>
          </div>
          
          <!-- 手動控制 -->
          <div class="manual-controls">
            <el-button 
              @click="previousPage"
              :disabled="currentPage === 1"
              size="large"
            >
              <el-icon><ArrowLeft /></el-icon>
            </el-button>
            <el-button 
              @click="nextPage"
              :disabled="currentPage === totalPages"
              size="large"
            >
              <el-icon><ArrowRight /></el-icon>
            </el-button>
          </div>
          
          <!-- 打字速度控制 -->
          <div class="typing-speed-control">
            <span class="control-label">打字速度</span>
            <el-select v-model="typingSpeed" @change="onTypingSpeedChange" size="large">
              <el-option label="慢速" :value="100" />
              <el-option label="中速" :value="50" />
              <el-option label="快速" :value="25" />
              <el-option label="極速" :value="10" />
            </el-select>
          </div>
        </template>
        
        <!-- 搜尋模式的控制 -->
        <template v-else>
          <div class="search-controls">
            <el-button 
              @click="clearSearch"
              type="primary"
              size="large"
            >
              <el-icon><Close /></el-icon>
              退出搜尋
            </el-button>
            
            <div v-if="filteredStudents.length > pageSize" class="search-pagination">
              <el-button 
                @click="previousSearchPage"
                :disabled="currentSearchPage === 1"
                size="large"
              >
                <el-icon><ArrowLeft /></el-icon>
              </el-button>
              <span class="search-page-info">
                第 {{ currentSearchPage }} / {{ totalSearchPages }} 頁
              </span>
              <el-button 
                @click="nextSearchPage"
                :disabled="currentSearchPage === totalSearchPages"
                size="large"
              >
                <el-icon><ArrowRight /></el-icon>
              </el-button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- 科幻打字機表格 -->
    <div class="typewriter-table-wrapper">
      <!-- 表格頭部 -->
      <div class="table-header">
        <div 
          v-for="(config, index) in visibleDisplayConfig" 
          :key="config.欄位名稱 || config.栏位名称"
          class="header-cell"
          :style="{ flex: getColumnFlex(config) }"
        >
          <span class="header-text">{{ config.顯示名稱 || config.显示名称 || config.欄位名稱 || config.栏位名称 }}</span>
          <div class="header-underline"></div>
        </div>
      </div>
      
      <!-- 打字機行容器 -->
      <div class="typewriter-rows-container">
        <div 
          v-for="(student, rowIndex) in currentPageStudents" 
          :key="`${currentPage}-${student._uid || student.idNumber || rowIndex}`"
          class="typewriter-row"
          :class="{ 
            'new-checkin': isNewCheckin(student),
            'typing-active': typingRows.has(rowIndex)
          }"
          :style="{ '--row-delay': rowIndex * 200 + 'ms' }"
        >
          <!-- 行號顯示 -->
          <div class="row-number">
            <span v-if="student.isNewRecord" class="new-record-marker" title="本次下載的新記錄">✨</span>
            <span class="row-index">{{ String(rowIndex + 1).padStart(2, '0') }}</span>
          </div>
          
          <!-- 每個欄位的打字機效果 -->
          <div 
            v-for="(config, colIndex) in visibleDisplayConfig" 
            :key="config.欄位名稱 || config.栏位名称"
            class="typewriter-cell"
            :style="{ flex: getColumnFlex(config) }"
          >
            <!-- 打字機游標 -->
            <span 
              v-if="shouldShowCursor(rowIndex, colIndex)"
              class="typewriter-cursor"
            >▌</span>
            
            <!-- 已打印的內容 -->
            <span 
              class="typewriter-content"
              :class="{ 
                'content-complete': isFieldComplete(rowIndex, colIndex),
                'is-time-field': isTimeField(config)
              }"
            >
              {{ getTypedContent(student, config, rowIndex, colIndex) }}
            </span>
          </div>
        </div>
        
        <!-- 空行填充 -->
        <div 
          v-for="n in emptyRows" 
          :key="`empty-${n}`"
          class="typewriter-row empty-row"
          :style="{ '--row-delay': (currentPageStudents.length + n - 1) * 200 + 'ms' }"
        >
          <div class="row-number">
            <span class="row-index">--</span>
          </div>
          <div 
            v-for="config in visibleDisplayConfig" 
            :key="config.欄位名稱 || config.栏位名称"
            class="typewriter-cell empty-cell"
            :style="{ flex: getColumnFlex(config) }"
          >
            <span class="empty-content">--</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 頁面指示器 -->
    <div v-if="!isSearchMode && totalPages > 1" class="page-indicators">
      <div 
        v-for="page in totalPages" 
        :key="page"
        class="page-dot"
        :class="{ 'active': page === currentPage }"
        @click="goToPage(page)"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  Document, User, VideoPause, VideoPlay, 
  ArrowLeft, ArrowRight, Search, Close 
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'

// Props
const props = defineProps({
  students: {
    type: Array,
    default: () => []
  },
  displayConfig: {
    type: Array,
    default: () => []
  },
  pageSize: {
    type: Number,
    default: 15
  },
  autoPlayInterval: {
    type: Number,
    default: 10 // 10秒自動換頁
  },
  newCheckins: {
    type: Array,
    default: () => []
  }
})

// Emits
const emit = defineEmits(['page-change'])

// 響應式數據
const currentPage = ref(1)
const isAutoPlay = ref(true)
const countdown = ref(props.autoPlayInterval)
const typingSpeed = ref(50) // 毫秒，每個字符的打字間隔

// 搜尋相關
const searchQuery = ref('')
const filteredStudents = ref([])
const isSearchMode = ref(false)
const currentSearchPage = ref(1)

// 打字機狀態 - 修复响应式问题
const typingStates = ref(new Map()) // 每行每列的打字狀態
const typingRows = ref(new Set()) // 正在打字的行
const completedFields = ref(new Set()) // 已完成的欄位

// 定時器
let autoPlayTimer = null
let countdownTimer = null
let typingTimers = []

// 計算屬性
const totalStudents = computed(() => props.students.length)
const totalPages = computed(() => Math.ceil(totalStudents.value / props.pageSize))

// 過濾掉不需要顯示的欄位（如狀態欄位）
const visibleDisplayConfig = computed(() => {
  return props.displayConfig.filter(config => {
    const fieldName = config.欄位名稱
    const fieldType = config.欄位性質 || ''
    
    // 過濾掉狀態相關欄位（因為後端只傳已報到的學生）
    if (fieldName.includes('狀態') || 
        fieldName.includes('報到狀態') || 
        fieldName === 'status' ||
        fieldName === 'checkedIn') {
      return false
    }
    
    // 只顯示 StudentTable 區塊的欄位
    return config.顯示區塊 && config.顯示區塊.includes('StudentTable')
  })
})

const currentPageStudents = computed(() => {
  if (isSearchMode.value) {
    const start = (currentSearchPage.value - 1) * props.pageSize
    const end = start + props.pageSize
    return filteredStudents.value.slice(start, end)
  } else {
    const start = (currentPage.value - 1) * props.pageSize
    const end = start + props.pageSize
    return props.students.slice(start, end)
  }
})

const totalSearchPages = computed(() => {
  return Math.ceil(filteredStudents.value.length / props.pageSize)
})

const emptyRows = computed(() => {
  const currentRows = currentPageStudents.value.length
  return currentRows < props.pageSize ? props.pageSize - currentRows : 0
})

const countdownProgress = computed(() => {
  return ((props.autoPlayInterval - countdown.value) / props.autoPlayInterval) * 100
})

// 方法
const isNewCheckin = (student) => {
  return props.newCheckins.some(newStudent => 
    newStudent._uid === student._uid || 
    newStudent.idNumber === student.idNumber
  )
}

const isTimeField = (config) => {
  const fieldType = config.欄位性質 || config.栏位性质 || config.fieldType || ''
  const fieldName = config.欄位名稱 || config.栏位名称 || config.fieldName || ''
  
  //console.log('🔍 检查时间字段:', fieldName, '类型:', fieldType)
  
  // 新逻辑：Timestamp 和 DateTime 都是时间字段，包括 checkinTime
  return fieldType.toLowerCase() === 'timestamp' ||
         fieldType.toLowerCase() === 'datetime' ||
         fieldName.toLowerCase() === 'timestamp' ||
         fieldName.includes('時間') ||
         fieldName.includes('时间') ||
         fieldName.includes('Time')
}

const formatTimeField = (value, config) => {
  if (!value) return ''
  
  try {
    // 如果已經是格式化的字符串，直接返回
    if (typeof value === 'string' && value.includes(':')) {
      return value
    }
    
    // 嘗試解析時間戳
    let timestamp = null
    if (typeof value === 'number') {
      timestamp = value
    } else if (typeof value === 'string' && /^\d+$/.test(value)) {
      const num = parseInt(value)
      if (value.length === 13) {
        timestamp = num // 毫秒時間戳
      } else if (value.length === 10) {
        timestamp = num * 1000 // 秒時間戳
      }
    } else {
      const parsed = dayjs(value)
      if (parsed.isValid()) {
        timestamp = parsed.valueOf()
      }
    }
    
    if (timestamp) {
      // 使用 dayjs 格式化
      const format = config.格式 || config.預處理 || ''
      
      if (format.includes('YYYY-MM-DD HH:mm:ss')) {
        return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')
      } else if (format.includes('HH:mm:ss')) {
        return dayjs(timestamp).format('HH:mm:ss')
      } else if (format.includes('MM-DD HH:mm')) {
        return dayjs(timestamp).format('MM-DD HH:mm')
      } else {
        // 預設格式：月日時分
        return dayjs(timestamp).format('MM-DD HH:mm')
      }
    }
    
    return value.toString()
  } catch (error) {
    console.warn('時間格式化失敗:', value, error)
    return value ? value.toString() : ''
  }
}

const getFieldValue = (student, config) => {
  const fieldName = config.欄位名稱 || config.栏位名称 || config.fieldName
  let value = student[fieldName]
  
  // 特殊處理時間欄位
  if (isTimeField(config)) {
    value = formatTimeField(value, config)
  }
  
  return value ? value.toString() : ''
}

const getColumnFlex = (config) => {
  const fieldName = config.欄位名稱 || config.栏位名称 || config.fieldName || ''
  
  // 根據欄位類型分配寬度
  if (fieldName.includes('姓名') || fieldName.includes('Name')) {
    return '1.5'
  } else if (fieldName.includes('性別') || fieldName.includes('性别') || fieldName.includes('Gender')) {
    return '0.8'
  } else if (fieldName.includes('學校') || fieldName.includes('学校') || fieldName.includes('School')) {
    return '2.5'
  } else if (isTimeField(config)) {
    return '2'
  } else {
    return '1'
  }
}

const getTypingKey = (rowIndex, colIndex) => {
  return `${rowIndex}-${colIndex}`
}

const getTypedContent = (student, config, rowIndex, colIndex) => {
  const key = getTypingKey(rowIndex, colIndex)
  const state = typingStates.value.get(key)
  
  if (!state) return ''
  
  const fullText = getFieldValue(student, config)
  return fullText.substring(0, state.currentIndex)
}

const shouldShowCursor = (rowIndex, colIndex) => {
  const key = getTypingKey(rowIndex, colIndex)
  const state = typingStates.value.get(key)
  
  return state && state.isTyping
}

const isFieldComplete = (rowIndex, colIndex) => {
  const key = getTypingKey(rowIndex, colIndex)
  return completedFields.value.has(key)
}

const startTypingAnimation = async () => {
  // 清除之前的打字狀態
  typingStates.value.clear()
  completedFields.value.clear()
  typingRows.value.clear()
  
  // 清除現有的定時器
  typingTimers.forEach(timer => clearTimeout(timer))
  typingTimers = []
  
  //console.log('🖨️ 開始打字機動畫')
  
  currentPageStudents.value.forEach((student, rowIndex) => {
    // 每行有不同的延遲開始時間
    const rowDelay = rowIndex * 300
    
    typingTimers.push(setTimeout(() => {
      typingRows.value.add(rowIndex)
      startRowTyping(student, rowIndex)
    }, rowDelay))
  })
}

const startRowTyping = (student, rowIndex) => {
  //console.log(`🖨️ 開始打字第 ${rowIndex + 1} 行`)
  
  // 按順序打字每個欄位
  let fieldDelay = 0
  
  visibleDisplayConfig.value.forEach((config, colIndex) => {
    typingTimers.push(setTimeout(() => {
      startFieldTyping(student, config, rowIndex, colIndex)
    }, fieldDelay))
    
    // 計算下一個欄位的延遲（基於當前欄位內容長度）
    const fieldText = getFieldValue(student, config)
    fieldDelay += Math.max(fieldText.length * typingSpeed.value, 500) + 200
  })
}

const startFieldTyping = (student, config, rowIndex, colIndex) => {
  const key = getTypingKey(rowIndex, colIndex)
  const fullText = getFieldValue(student, config)
  
  //console.log(`🖨️ 開始打字 [${rowIndex},${colIndex}]: ${fullText}`)
  
  // 初始化打字狀態
  typingStates.value.set(key, {
    currentIndex: 0,
    isTyping: true,
    fullText: fullText
  })
  
  // 開始逐字打字
  let currentIndex = 0
  
  const typeNextChar = () => {
    if (currentIndex >= fullText.length) {
      // 打字完成
      const state = typingStates.value.get(key)
      if (state) {
        state.isTyping = false
        typingStates.value.set(key, state)
      }
      completedFields.value.add(key)
      
      //console.log(`✅ 完成打字 [${rowIndex},${colIndex}]: ${fullText}`)
      
      // 檢查是否該行所有欄位都完成了
      const rowComplete = visibleDisplayConfig.value.every((_, cIdx) => {
        return completedFields.value.has(getTypingKey(rowIndex, cIdx))
      })
      
      if (rowComplete) {
        typingRows.value.delete(rowIndex)
        //console.log(`✅ 第 ${rowIndex + 1} 行打字完成`)
      }
      
      return
    }
    
    currentIndex++
    const state = typingStates.value.get(key)
    if (state) {
      state.currentIndex = currentIndex
      typingStates.value.set(key, state)
    }
    
    // 計算下一個字符的延遲（中文字符稍慢，數字和英文稍快）
    const currentChar = fullText[currentIndex - 1]
    let charDelay = typingSpeed.value
    
    if (/[\u4e00-\u9fa5]/.test(currentChar)) {
      // 中文字符
      charDelay = typingSpeed.value * 1.2
    } else if (/[0-9]/.test(currentChar)) {
      // 數字
      charDelay = typingSpeed.value * 0.8
    } else if (/[a-zA-Z]/.test(currentChar)) {
      // 英文字母
      charDelay = typingSpeed.value * 0.9
    }
    
    typingTimers.push(setTimeout(typeNextChar, charDelay))
  }
  
  // 開始打第一個字符
  typingTimers.push(setTimeout(typeNextChar, typingSpeed.value))
}

const onTypingSpeedChange = (newSpeed) => {
  //console.log(`⚡ 打字速度改為: ${newSpeed}ms`)
  // 如果正在打字，重新開始動畫
  if (typingRows.value.size > 0) {
    startTypingAnimation()
  }
}

// 自動播放控制
const startAutoPlay = () => {
  if (autoPlayTimer) clearInterval(autoPlayTimer)
  if (countdownTimer) clearInterval(countdownTimer)
  
  countdown.value = props.autoPlayInterval
  
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      nextPage()
      countdown.value = props.autoPlayInterval
    }
  }, 1000)
}

const stopAutoPlay = () => {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer)
    autoPlayTimer = null
  }
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

const toggleAutoPlay = () => {
  isAutoPlay.value = !isAutoPlay.value
  
  if (isAutoPlay.value) {
    startAutoPlay()
  } else {
    stopAutoPlay()
  }
}

const goToPage = async (newPage) => {
  if (newPage === currentPage.value || isSearchMode.value) return
  
  currentPage.value = newPage
  emit('page-change', newPage)
  
  if (isAutoPlay.value) {
    countdown.value = props.autoPlayInterval
  }
  
  await nextTick()
  startTypingAnimation()
}

const nextPage = () => {
  const next = currentPage.value >= totalPages.value ? 1 : currentPage.value + 1
  goToPage(next)
}

const previousPage = () => {
  const prev = currentPage.value <= 1 ? totalPages.value : currentPage.value - 1
  goToPage(prev)
}

// 搜尋功能
const handleSearch = async (query) => {
  if (!query || !query.trim()) {
    clearSearch()
    return
  }
  
  if (isAutoPlay.value) {
    stopAutoPlay()
  }
  
  isSearchMode.value = true
  currentSearchPage.value = 1
  
  const searchTerm = query.trim().toLowerCase()
  
  filteredStudents.value = props.students.filter(student => {
    // 搜尋所有可見欄位
    return visibleDisplayConfig.value.some(config => {
      const value = getFieldValue(student, config)
      return value.toLowerCase().includes(searchTerm)
    })
  })
  
  //console.log(`🔍 搜尋「${query}」找到 ${filteredStudents.value.length} 位學生`)
  
  // 開始搜尋結果的打字動畫
  await nextTick()
  startTypingAnimation()
}

const clearSearch = async () => {
  searchQuery.value = ''
  filteredStudents.value = []
  isSearchMode.value = false
  currentSearchPage.value = 1
  
  await nextTick()
  startTypingAnimation()
}

// 顯示搜索提示
const showSearchHint = () => {
  // 找到 UID 欄位的配置
  const uidConfig = props.displayConfig.find(config => 
    config.特殊功能 === 'UID'
  )
  
  if (!uidConfig) {
    ElMessage.info('遮罩模式下搜索功能受限')
    return
  }
  
  const fieldName = uidConfig.欄位名稱 || '唯一值'
  let searchablePart = '後幾碼'

  // 解析預處理規則，提取可搜索的部分
  if (uidConfig.預處理) {
    const rule = uidConfig.預處理
    
    // 匹配類似 ^.{5}(.{5})$ → *****$1 的模式
    const match = rule.match(/\^\.{(\d+)}\(\.\{(\d+)\}\)\$\s*→\s*\*+\$1/)
    if (match) {
      const hiddenLength = parseInt(match[1])
      const visibleLength = parseInt(match[2])
      searchablePart = `後${visibleLength}碼`
    }
    // 匹配類似 ^(.{4}).{6}$ → $1****** 的模式（前幾碼可搜索）
    else {
      const frontMatch = rule.match(/\^\(\.\{(\d+)\}\)\.\{\d+\}\$\s*→\s*\$1\*+/)
      if (frontMatch) {
        const visibleLength = parseInt(frontMatch[1])
        searchablePart = `前${visibleLength}碼`
      }
    }
  }
  
  ElMessage.info({
    message: `遮罩模式下你只能搜尋${fieldName}的${searchablePart}`,
    duration: 3000,
    showClose: true
  })
}

const nextSearchPage = async () => {
  if (currentSearchPage.value < totalSearchPages.value) {
    currentSearchPage.value++
    await nextTick()
    startTypingAnimation()
  }
}

const previousSearchPage = async () => {
  if (currentSearchPage.value > 1) {
    currentSearchPage.value--
    await nextTick()
    startTypingAnimation()
  }
}

// 監聽數據變化
watch(() => props.students, async () => {
  await nextTick()
  startTypingAnimation()
}, { deep: true })

watch(() => currentPageStudents.value, async () => {
  await nextTick()
  startTypingAnimation()
}, { deep: true })

// 生命周期
onMounted(async () => {
  if (isAutoPlay.value) {
    startAutoPlay()
  }
  
  await nextTick()
  startTypingAnimation()
})

onUnmounted(() => {
  stopAutoPlay()
  typingTimers.forEach(timer => clearTimeout(timer))
})
</script>

<style scoped>
.scifi-table-container {
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 
    0 0 20px rgba(0, 255, 127, 0.1),
    0 10px 30px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 2px solid #00ff7f;
  position: relative;
  overflow: hidden;
}

.scifi-table-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle at 20% 80%, rgba(0, 255, 127, 0.05) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(0, 150, 255, 0.05) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

.scifi-table-container > * {
  position: relative;
  z-index: 1;
}

/* 控制面板 */
.control-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 16px 20px;
  background: rgba(0, 50, 100, 0.1);
  border-radius: 12px;
  border: 1px solid rgba(0, 150, 255, 0.3);
  backdrop-filter: blur(10px);
}

.status-info {
  display: flex;
  gap: 24px;
  align-items: center;
  flex-wrap: wrap;
}

.search-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-input {
  max-width: 400px;
}

.search-input :deep(.el-input__wrapper) {
  background: rgba(0, 20, 40, 0.8);
  border: 1px solid rgba(0, 255, 127, 0.3);
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.search-input :deep(.el-input__inner) {
  color: #00ff7f;
  font-size: 16px;
  font-family: 'Courier New', monospace;
}

.search-input :deep(.el-input__inner::placeholder) {
  color: rgba(0, 255, 127, 0.5);
}

.page-info, .student-count {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #00d4ff;
  font-weight: 500;
  font-family: 'Courier New', monospace;
}

.controls {
  display: flex;
  align-items: center;
  gap: 20px;
}

.play-button {
  min-width: 120px;
  height: 44px;
  font-weight: bold;
  border-radius: 8px;
  background: linear-gradient(135deg, #00ff7f 0%, #00d4aa 100%);
  border: none;
  color: #000;
}

.countdown-display {
  display: flex;
  align-items: center;
  gap: 12px;
}

.countdown-circle {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: conic-gradient(
    #00ff7f 0deg,
    #00ff7f calc(var(--progress) * 3.6deg),
    rgba(0, 255, 127, 0.2) calc(var(--progress) * 3.6deg),
    rgba(0, 255, 127, 0.2) 360deg
  );
  display: flex;
  align-items: center;
  justify-content: center;
}

.countdown-circle::before {
  content: '';
  position: absolute;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-color: #0a0a0a;
}

.countdown-number {
  color: #00ff7f;
  font-weight: bold;
  font-size: 14px;
  z-index: 1;
  font-family: 'Courier New', monospace;
}

.countdown-text {
  color: #00d4ff;
  font-size: 14px;
  font-family: 'Courier New', monospace;
}

.manual-controls {
  display: flex;
  gap: 8px;
}

.typing-speed-control {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.control-label {
  color: #00d4ff;
  font-size: 12px;
  font-family: 'Courier New', monospace;
  white-space: nowrap;
}

.search-controls {
  display: flex;
  align-items: center;
  gap: 20px;
}

.search-pagination {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-page-info {
  color: #00d4ff;
  font-weight: 500;
  min-width: 100px;
  text-align: center;
  font-family: 'Courier New', monospace;
}

/* 打字機表格 */
.typewriter-table-wrapper {
  margin-bottom: 20px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(0, 255, 127, 0.2);
}

.table-header {
  display: flex;
  background: linear-gradient(135deg, rgba(0, 255, 127, 0.1) 0%, rgba(0, 150, 255, 0.1) 100%);
  border-bottom: 2px solid #00ff7f;
  font-weight: bold;
  color: #00ff7f;
  position: relative;
}

.table-header::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, #00ff7f 50%, transparent 100%);
  animation: headerScan 3s ease-in-out infinite;
}

@keyframes headerScan {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.header-cell {
  padding: 16px 12px;
  text-align: center;
  border-right: 1px solid rgba(0, 255, 127, 0.2);
  position: relative;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.header-cell:last-child {
  border-right: none;
}

.header-text {
  position: relative;
  z-index: 2;
}

.header-underline {
  position: absolute;
  bottom: 8px;
  left: 12px;
  right: 12px;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, #00ff7f 50%, transparent 100%);
  animation: underlinePulse 2s ease-in-out infinite;
}

@keyframes underlinePulse {
  0%, 100% { opacity: 0.5; transform: scaleX(0.8); }
  50% { opacity: 1; transform: scaleX(1); }
}

/* 打字機行容器 */
.typewriter-rows-container {
  background: rgba(0, 0, 0, 0.8);
  position: relative;
}

.typewriter-row {
  position: relative;
  display: flex;
  align-items: center;
  height: 80px;
  border-bottom: 1px solid rgba(0, 255, 127, 0.1);
  transition: all 0.3s ease;
  animation: rowFadeIn 0.5s ease-out;
  animation-delay: var(--row-delay);
  animation-fill-mode: both;
  background: linear-gradient(90deg, 
    rgba(0, 20, 40, 0.5) 0%, 
    rgba(0, 40, 80, 0.3) 50%, 
    rgba(0, 20, 40, 0.5) 100%
  );
}

.typewriter-row:last-child {
  border-bottom: none;
}

.typewriter-row.new-checkin {
  background: linear-gradient(90deg, 
    rgba(0, 255, 127, 0.1) 0%, 
    rgba(0, 200, 100, 0.2) 50%, 
    rgba(0, 255, 127, 0.1) 100%
  );
  border-left: 4px solid #00ff7f;
  box-shadow: 0 0 20px rgba(0, 255, 127, 0.3);
}

.typewriter-row.typing-active {
  background: linear-gradient(90deg, 
    rgba(0, 150, 255, 0.1) 0%, 
    rgba(0, 100, 200, 0.2) 50%, 
    rgba(0, 150, 255, 0.1) 100%
  );
  box-shadow: 0 0 15px rgba(0, 150, 255, 0.2);
}

@keyframes rowFadeIn {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.row-number {
  width: 60px;
  text-align: center;
  padding: 0 12px;
  border-right: 1px solid rgba(0, 255, 127, 0.2);
  flex-shrink: 0;
}

.row-index {
  color: #00d4ff;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  font-size: 16px;
  text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
}

.new-record-marker {
  font-size: 14px;
  margin-right: 4px;
  animation: pulse 2s ease-in-out infinite;
  cursor: help;
  display: inline-block;
}

/* 打字機單元格 */
.typewriter-cell {
  text-align: center;
  color: #ffffff;
  font-size: 18px;
  font-family: 'Courier New', monospace;
  padding: 0 12px;
  border-right: 1px solid rgba(0, 255, 127, 0.1);
  position: relative;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.typewriter-cell:last-child {
  border-right: none;
}

.typewriter-cursor {
  color: #00ff7f;
  font-weight: bold;
  animation: cursorBlink 1s infinite;
  text-shadow: 0 0 10px #00ff7f;
  position: absolute;
  z-index: 3;
}

@keyframes cursorBlink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.typewriter-content {
  position: relative;
  z-index: 2;
  line-height: 1.2;
  word-break: break-all;
  transition: all 0.3s ease;
}

.typewriter-content.content-complete {
  color: #00ff7f;
  text-shadow: 0 0 5px rgba(0, 255, 127, 0.5);
}

.typewriter-content.is-time-field.content-complete {
  color: #00d4ff;
  text-shadow: 0 0 5px rgba(0, 212, 255, 0.5);
  font-weight: bold;
}

/* 空行樣式 */
.empty-row {
  background: linear-gradient(90deg, 
    rgba(20, 20, 20, 0.5) 0%, 
    rgba(40, 40, 40, 0.3) 50%, 
    rgba(20, 20, 20, 0.5) 100%
  );
}

.empty-cell {
  opacity: 0.3;
}

.empty-content {
  color: #666666;
  font-style: italic;
}

/* 頁面指示器 */
.page-indicators {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
}

.page-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: rgba(0, 255, 127, 0.3);
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid rgba(0, 255, 127, 0.5);
}

.page-dot:hover {
  background-color: rgba(0, 255, 127, 0.6);
  transform: scale(1.2);
  box-shadow: 0 0 10px rgba(0, 255, 127, 0.5);
}

.page-dot.active {
  background-color: #00ff7f;
  box-shadow: 0 0 15px rgba(0, 255, 127, 0.8);
  animation: activeDotPulse 2s ease-in-out infinite;
}

@keyframes activeDotPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.3); }
}

/* 響應式設計 */
@media (max-width: 768px) {
  .control-panel {
    flex-direction: column;
    gap: 16px;
  }
  
  .status-info {
    flex-direction: column;
    gap: 12px;
    width: 100%;
    text-align: center;
  }
  
  .search-input {
    max-width: 100%;
  }
  
  .controls {
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
  }
  
  .typewriter-cell {
    font-size: 14px;
    padding: 0 8px;
  }
  
  .header-cell {
    padding: 12px 8px;
    font-size: 12px;
  }
  
  .row-number {
    width: 40px;
    padding: 0 8px;
  }
  
  .row-index {
    font-size: 14px;
  }
  
  .typewriter-row {
    height: 60px;
  }
}

@media (max-width: 480px) {
  .scifi-table-container {
    padding: 16px;
  }
  
  .typewriter-cell {
    font-size: 12px;
    padding: 0 6px;
  }
  
  .header-cell {
    padding: 10px 6px;
    font-size: 10px;
  }
}

/* Element Plus 深色主題適配 */
:deep(.el-button) {
  border-radius: 8px;
  font-family: 'Courier New', monospace;
}

:deep(.el-button--primary) {
  background: linear-gradient(135deg, #00ff7f 0%, #00d4aa 100%);
  border: none;
  color: #000;
  font-weight: bold;
}

:deep(.el-button--danger) {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
  border: none;
  color: #fff;
}

:deep(.el-button:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 255, 127, 0.3);
}

:deep(.el-select) {
  --el-select-input-color: #00ff7f;
  --el-select-input-focus-border-color: #00ff7f;
}

:deep(.el-select .el-input__wrapper) {
  background: rgba(0, 20, 40, 0.8);
  border: 1px solid rgba(0, 255, 127, 0.3);
  color: #00ff7f;
}

:deep(.el-select .el-input__inner) {
  color: #00ff7f;
  font-family: 'Courier New', monospace;
}

/* 特殊效果 */
.typewriter-row::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    #00ff7f 50%,
    transparent 100%
  );
  opacity: 0;
  animation: scanLine 3s ease-in-out infinite;
}

.typewriter-row.typing-active::before {
  opacity: 1;
}

@keyframes scanLine {
  0%, 100% {
    transform: translateY(-100%);
    opacity: 0;
  }
  50% {
    transform: translateY(0%);
    opacity: 1;
  }
}
</style>