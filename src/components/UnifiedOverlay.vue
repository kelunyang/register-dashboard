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
    <div class="overlay-modal">
      <!-- 頁面標題 -->
      <div class="modal-header">
        <h2 class="modal-title">系統控制台</h2>
        <!-- 關閉按鈕 -->
        <button 
          class="close-button" 
          @click="handleCloseClick"
          :aria-label="'關閉'"
        >
          <el-icon size="20"><Close /></el-icon>
        </button>
      </div>
      
      <!-- Tabs 導航和內容 -->
      <el-tabs v-model="currentMode" @tab-change="handleTabChange" class="overlay-tabs">
        <!-- 活動狀態 Tab -->
        <el-tab-pane name="activity">
          <template #label>
            <div class="tab-label">
              <el-icon><Monitor /></el-icon>
              <span>活動狀態</span>
            </div>
          </template>
          
          <div class="tab-pane activity-pane">
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
        </el-tab-pane>

        <!-- 系統設定 Tab -->
        <el-tab-pane name="settings">
          <template #label>
            <div class="tab-label">
              <el-icon><Setting /></el-icon>
              <span>系統設定</span>
            </div>
          </template>
          
          <div class="tab-pane settings-pane">
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

        <!-- 字體大小設定 -->
        <div class="settings-section">
          <h3>🔤 字體大小設定</h3>
          <div class="font-size-config">
            <div class="config-row">
              <span class="config-label">當前大小:</span>
              <span class="config-value">{{ fontSize }}px</span>
            </div>
            
            <div class="config-row">
              <span class="config-label">調整範圍:</span>
              <div class="font-size-slider-container">
                <el-slider
                  v-model="fontSize"
                  :min="12"
                  :max="32"
                  :step="1"
                  :marks="fontSizeMarks"
                  :show-tooltip="true"
                  :format-tooltip="formatFontSizeTooltip"
                  @change="onFontSizeChange"
                  style="width: 200px;"
                />
                <span class="font-size-display">{{ fontSize }}px</span>
              </div>
            </div>
            
            <div class="font-size-preview">
              <div class="preview-text">預覽文字 - 這是調整後的字體大小效果</div>
            </div>
          </div>
        </div>

        <!-- 換頁倒數計時設定 -->
        <div class="settings-section">
          <h3>⏰ 換頁倒數計時設定</h3>
          <div class="countdown-config">
            <div class="config-row">
              <span class="config-label">當前間隔:</span>
              <span class="config-value">{{ autoPlayIntervalSetting }}秒</span>
            </div>
            
            <div class="config-row">
              <span class="config-label">調整範圍:</span>
              <div class="countdown-slider-container">
                <el-slider
                  v-model="autoPlayIntervalSetting"
                  :min="3"
                  :max="30"
                  :step="1"
                  :marks="countdownMarks"
                  :show-tooltip="true"
                  :format-tooltip="formatCountdownTooltip"
                  @change="onAutoPlayIntervalSettingChange"
                  style="width: 200px;"
                />
                <span class="countdown-display">{{ autoPlayIntervalSetting }}秒</span>
              </div>
            </div>
            
            <div class="countdown-preview">
              <div class="preview-text">設定科幻表格的自動換頁間隔時間</div>
            </div>
          </div>
        </div>

        <!-- 打字機速度設定 -->
        <div class="settings-section">
          <h3>⚡ 打字機速度設定</h3>
          <div class="typing-speed-config">
            <div class="config-row">
              <span class="config-label">當前速度:</span>
              <span class="config-value">{{ getTypingSpeedLabel(typingSpeedSetting) }}</span>
            </div>
            
            <div class="config-row">
              <span class="config-label">調整範圍:</span>
              <div class="typing-speed-slider-container">
                <el-slider
                  v-model="typingSpeedSetting"
                  :min="10"
                  :max="150"
                  :step="10"
                  :marks="typingSpeedMarks"
                  :show-tooltip="true"
                  :format-tooltip="formatTypingSpeedTooltip"
                  @change="onTypingSpeedSettingChange"
                  style="width: 200px;"
                />
                <span class="typing-speed-display">{{ typingSpeedSetting }}ms</span>
              </div>
            </div>
            
            <div class="typing-speed-preview">
              <div class="preview-text">設定科幻表格的打字動畫速度</div>
            </div>
          </div>
        </div>

        <!-- 輪播範圍設定 -->
        <div class="settings-section">
          <h3>🎯 輪播範圍設定</h3>
          <div class="carousel-range-config">
            <div class="config-row">
              <span class="config-label">當前設定:</span>
              <span class="config-value">{{ getCarouselRangeLabel(carouselRangeSetting) }}</span>
            </div>
            
            <div class="config-row">
              <span class="config-label">選擇範圍:</span>
              <div class="carousel-range-selector-container">
                <el-select
                  v-model="carouselRangeSetting"
                  placeholder="選擇輪播範圍"
                  @change="onCarouselRangeSettingChange"
                  style="width: 200px"
                >
                  <el-option
                    v-for="option in carouselRangeOptions"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  />
                </el-select>
              </div>
            </div>
            
            <div class="carousel-range-preview">
              <div class="preview-text">設定科幻表格自動輪播的頁數範圍</div>
            </div>
          </div>
        </div>

        <!-- 打字機顏色設定 -->
        <div class="settings-section">
          <h3>🎨 打字機顏色設定</h3>
          <div class="color-config">
            <!-- 一般欄位完成顏色 -->
            <div class="color-group">
              <h4>📝 一般欄位完成顏色</h4>
              <div class="config-row">
                <span class="config-label">文字顏色:</span>
                <div class="color-picker-container">
                  <el-color-picker 
                    v-model="normalFieldCompleteColor"
                    @change="onNormalFieldColorChange"
                    show-alpha
                    size="large"
                  />
                  <span class="color-value">{{ normalFieldCompleteColor }}</span>
                </div>
              </div>
              <div class="config-row">
                <span class="config-label">陰影顏色:</span>
                <div class="color-picker-container">
                  <el-color-picker 
                    v-model="normalFieldShadowColor"
                    @change="onNormalFieldShadowColorChange"
                    show-alpha
                    size="large"
                  />
                  <span class="color-value">{{ normalFieldShadowColor }}</span>
                </div>
              </div>
              <div class="color-preview">
                <span 
                  class="preview-text" 
                  :style="{ 
                    color: normalFieldCompleteColor, 
                    textShadow: `0 0 5px ${normalFieldShadowColor}` 
                  }"
                >
                  學生姓名 預覽效果
                </span>
              </div>
            </div>

            <!-- 時間欄位完成顏色 -->
            <div class="color-group">
              <h4>⏰ 時間欄位完成顏色</h4>
              <div class="config-row">
                <span class="config-label">文字顏色:</span>
                <div class="color-picker-container">
                  <el-color-picker 
                    v-model="timeFieldCompleteColor"
                    @change="onTimeFieldColorChange"
                    show-alpha
                    size="large"
                  />
                  <span class="color-value">{{ timeFieldCompleteColor }}</span>
                </div>
              </div>
              <div class="config-row">
                <span class="config-label">陰影顏色:</span>
                <div class="color-picker-container">
                  <el-color-picker 
                    v-model="timeFieldShadowColor"
                    @change="onTimeFieldShadowColorChange"
                    show-alpha
                    size="large"
                  />
                  <span class="color-value">{{ timeFieldShadowColor }}</span>
                </div>
              </div>
              <div class="color-preview">
                <span 
                  class="preview-text time-field-preview" 
                  :style="{ 
                    color: timeFieldCompleteColor, 
                    textShadow: `0 0 5px ${timeFieldShadowColor}`,
                    fontWeight: 'bold'
                  }"
                >
                  2024/12/07 14:30 預覽效果
                </span>
              </div>
            </div>

            <div class="color-reset">
              <el-button @click="resetColorsToDefault" type="default" size="large">
                <el-icon><Refresh /></el-icon>
                重置為預設顏色
              </el-button>
            </div>
          </div>
        </div>

        <!-- 界面顯示設定 -->
        <div class="settings-section">
          <h3>👁️ 界面顯示設定</h3>
          <div class="display-config">
            <!-- 公告區塊顯示開關 -->
            <div class="config-row">
              <span class="config-label">公告區塊顯示:</span>
              <div class="config-control">
                <el-switch
                  v-model="showNoticeSection"
                  @change="handleNoticeDisplayChange"
                  active-text="顯示"
                  inactive-text="隱藏"
                  active-color="#67C23A"
                  inactive-color="#DCDFE6"
                />
              </div>
            </div>
            
            <!-- StudentTable 分頁大小設定 -->
            <div class="config-row">
              <span class="config-label">每頁顯示學生數:</span>
              <span class="config-value">{{ tablePageSize }}位</span>
            </div>
            
            <div class="config-row">
              <span class="config-label">調整範圍:</span>
              <div class="page-size-slider-container">
                <el-slider
                  v-model="tablePageSize"
                  :min="5"
                  :max="50"
                  :step="5"
                  :marks="pageSizeMarks"
                  :format-tooltip="formatPageSizeTooltip"
                  @change="handlePageSizeChange"
                  show-tooltip
                />
              </div>
            </div>
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
        </el-tab-pane>
        
        <!-- 看板配置 Tab -->
        <el-tab-pane name="config">
          <template #label>
            <div class="tab-label">
              <el-icon><InfoFilled /></el-icon>
              <span>看板配置</span>
            </div>
          </template>
          
          <div class="tab-pane config-pane">
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
                <span class="label">應報到總數:</span>
                <span class="value">{{ configDetails.dataSource.studentsCount }} 筆</span>
              </div>
              <div class="info-item">
                <span class="label">已報到記錄:</span>
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
        </el-tab-pane>
      </el-tabs>
      
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
  Delete, DocumentDelete, Download, Upload, Warning
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
  'auto-refresh-interval-change', 'auto-play-interval-change', 'auto-refresh-status-change'
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

// 字體大小相關
const fontSize = ref(16)

// 換頁倒數計時相關
const autoPlayIntervalSetting = ref(10)

// 打字機速度相關
const typingSpeedSetting = ref(50)

// 輪播範圍相關
const carouselRangeSetting = ref('unlimited')
const carouselRangeOptions = [
  { value: '1', label: '前 1 頁' },
  { value: '2', label: '前 2 頁' },
  { value: '3', label: '前 3 頁' },
  { value: '4', label: '前 4 頁' },
  { value: '5', label: '前 5 頁' },
  { value: 'unlimited', label: '無限制' }
]

// 打字機顏色設定相關
const normalFieldCompleteColor = ref('#00ff7f')
const normalFieldShadowColor = ref('rgba(0, 255, 127, 0.5)')

// 界面顯示設定相關
const showNoticeSection = ref(true)
const tablePageSize = ref(10)
const timeFieldCompleteColor = ref('#00d4ff')
const timeFieldShadowColor = ref('rgba(0, 212, 255, 0.5)')

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

// 字體大小相關計算屬性
const fontSizeMarks = computed(() => ({
  12: '12',
  14: '14',
  16: '16',
  18: '18',
  20: '20',
  22: '22',
  24: '24'
}))

// 換頁倒數計時相關計算屬性
const countdownMarks = computed(() => ({
  3: '3s',
  5: '5s',
  10: '10s',
  15: '15s',
  20: '20s',
  25: '25s',
  30: '30s'
}))

// 打字機速度相關計算屬性
const typingSpeedMarks = computed(() => ({
  10: '極速',
  25: '快速',
  50: '中速',
  100: '慢速',
  150: '超慢'
}))

// 分頁大小相關計算屬性
const pageSizeMarks = computed(() => ({
  5: '5',
  10: '10',
  15: '15',
  20: '20',
  25: '25',
  30: '30',
  40: '40',
  50: '50'
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

const formatFontSizeTooltip = (value) => {
  return `${value}px`
}

const formatCountdownTooltip = (value) => {
  return `${value}秒`
}

const formatPageSizeTooltip = (value) => {
  return `${value}位學生`
}

// markdown 內容處理
const noticeMarkdownHtml = computed(() => {
  if (!props.activityStatus.currentEvent?.welcomeMD) {
    return null
  }
  
  try {
    return markdownService.noticeMarkdownToHtml(props.activityStatus.currentEvent.welcomeMD)
  } catch (error) {
    console.error('Markdown 處理錯誤:', error)
    return null
  }
})

// 方法
const handleTabChange = (mode) => {
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

const handleCloseClick = () => {
  // 如果在設定 tab，確保設定已儲存
  if (currentMode.value === 'settings') {
    // 設定已經在各個 onChange 事件中即時儲存到 localStorage
    console.log('✅ 設定已儲存，關閉視窗')
  }
  closeOverlay()
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
      
      // 通知父組件自動刷新狀態已改變
      emit('auto-refresh-status-change', true)
      emit('auto-refresh-interval-change', autoRefreshInterval.value)
      
      ElMessage.success('自動刷新已啟用')
    } else {
      gemSuccess.value = false
      gemMessage.value = `❌ ${result.message || '密鑰驗證失敗'}`
      ElMessage.error(result.message || '密鑰驗證失敗')
      
      // 如果是清除設定，也要通知父組件
      if (!autoRefreshGemInput.value.trim()) {
        emit('auto-refresh-status-change', false)
      }
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

// 字體大小相關方法
const onFontSizeChange = (value) => {
  // 更新 CSS 變數
  document.documentElement.style.setProperty('--base-font-size', `${value}px`)
  
  // 保存到 localStorage
  localStorage.setItem('fontSize', value.toString())
  
  console.log(`🔤 字體大小已更新為: ${value}px`)
}

// 換頁倒數計時相關方法
const onAutoPlayIntervalSettingChange = (value) => {
  // 保存到 localStorage
  localStorage.setItem('autoPlayInterval', value.toString())
  
  // 通知父組件更新倒數計時間隔
  emit('auto-play-interval-change', value)
  
  // 發送自定義事件，讓其他組件立即更新
  window.dispatchEvent(new CustomEvent('autoPlayIntervalChange', {
    detail: { interval: value }
  }))
  
  console.log(`⏰ 換頁倒數計時已更新為: ${value}秒`)
}

// 打字機速度相關方法
const formatTypingSpeedTooltip = (value) => {
  return `${value}ms - ${getTypingSpeedLabel(value)}`
}

const getTypingSpeedLabel = (value) => {
  if (value <= 10) return '極速'
  if (value <= 25) return '快速'
  if (value <= 50) return '中速'
  if (value <= 100) return '慢速'
  return '超慢'
}

const onTypingSpeedSettingChange = (value) => {
  // 保存到 localStorage
  localStorage.setItem('typingSpeed', value.toString())
  
  // 觸發自定義事件通知其他組件
  window.dispatchEvent(new CustomEvent('typingSpeedChange', {
    detail: { speed: value }
  }))
  
  console.log(`⚡ 打字機速度已更新為: ${value}ms (${getTypingSpeedLabel(value)})`)
}

// 輪播範圍相關方法
const getCarouselRangeLabel = (value) => {
  const option = carouselRangeOptions.find(opt => opt.value === value)
  return option ? option.label : '無限制'
}

const onCarouselRangeSettingChange = (value) => {
  // 保存到 localStorage
  localStorage.setItem('carouselRange', value)
  
  // 觸發自定義事件通知其他組件
  window.dispatchEvent(new CustomEvent('carouselRangeChange', {
    detail: { range: value }
  }))
  
  console.log(`🎯 輪播範圍已更新為: ${getCarouselRangeLabel(value)}`)
}

// 打字機顏色相關方法
const onNormalFieldColorChange = (color) => {
  // 保存到 localStorage
  localStorage.setItem('normalFieldCompleteColor', color)
  
  // 更新 CSS 變數
  document.documentElement.style.setProperty('--normal-field-complete-color', color)
  
  console.log(`🎨 一般欄位完成顏色已更新為: ${color}`)
}

const onNormalFieldShadowColorChange = (color) => {
  // 保存到 localStorage
  localStorage.setItem('normalFieldShadowColor', color)
  
  // 更新 CSS 變數
  document.documentElement.style.setProperty('--normal-field-shadow-color', color)
  
  console.log(`🎨 一般欄位陰影顏色已更新為: ${color}`)
}

const onTimeFieldColorChange = (color) => {
  // 保存到 localStorage
  localStorage.setItem('timeFieldCompleteColor', color)
  
  // 更新 CSS 變數
  document.documentElement.style.setProperty('--time-field-complete-color', color)
  
  console.log(`🎨 時間欄位完成顏色已更新為: ${color}`)
}

const onTimeFieldShadowColorChange = (color) => {
  // 保存到 localStorage
  localStorage.setItem('timeFieldShadowColor', color)
  
  // 更新 CSS 變數
  document.documentElement.style.setProperty('--time-field-shadow-color', color)
  
  console.log(`🎨 時間欄位陰影顏色已更新為: ${color}`)
}

// 界面顯示設定相關方法
const handleNoticeDisplayChange = (value) => {
  // 保存到 localStorage
  localStorage.setItem('showNoticeSection', value.toString())
  
  // 觸發自定義事件通知 StudentDashboard
  window.dispatchEvent(new CustomEvent('noticeSectionDisplayChange', {
    detail: { show: value }
  }))
  
  console.log(`👁️ 公告區塊顯示已更新為: ${value ? '顯示' : '隱藏'}`)
}

const handlePageSizeChange = (value) => {
  // 保存到 localStorage
  localStorage.setItem('tablePageSize', value.toString())
  
  // 觸發自定義事件通知 StudentTable
  window.dispatchEvent(new CustomEvent('tablePagesizeChange', {
    detail: { pageSize: value }
  }))
  
  console.log(`📋 每頁顯示學生數已更新為: ${value}位`)
}


const resetColorsToDefault = () => {
  // 重置為預設值
  normalFieldCompleteColor.value = '#00ff7f'
  normalFieldShadowColor.value = 'rgba(0, 255, 127, 0.5)'
  timeFieldCompleteColor.value = '#00d4ff'
  timeFieldShadowColor.value = 'rgba(0, 212, 255, 0.5)'
  
  // 觸發變更事件
  onNormalFieldColorChange('#00ff7f')
  onNormalFieldShadowColorChange('rgba(0, 255, 127, 0.5)')
  onTimeFieldColorChange('#00d4ff')
  onTimeFieldShadowColorChange('rgba(0, 212, 255, 0.5)')
  
  ElMessage.success('顏色已重置為預設值')
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
  
  // 載入已保存的字體大小
  const savedFontSize = localStorage.getItem('fontSize')
  if (savedFontSize) {
    fontSize.value = parseInt(savedFontSize)
    document.documentElement.style.setProperty('--base-font-size', `${fontSize.value}px`)
  } else {
    // 設定預設字體大小
    document.documentElement.style.setProperty('--base-font-size', '16px')
  }
  
  // 載入已保存的換頁倒數計時間隔
  const savedAutoPlayInterval = localStorage.getItem('autoPlayInterval')
  if (savedAutoPlayInterval) {
    autoPlayIntervalSetting.value = parseInt(savedAutoPlayInterval)
  }
  
  // 載入已保存的打字機速度
  const savedTypingSpeed = localStorage.getItem('typingSpeed')
  if (savedTypingSpeed) {
    typingSpeedSetting.value = parseInt(savedTypingSpeed)
  }
  
  // 載入已保存的輪播範圍設定
  const savedCarouselRange = localStorage.getItem('carouselRange')
  if (savedCarouselRange) {
    carouselRangeSetting.value = savedCarouselRange
  }
  
  // 載入已保存的顏色設定
  const savedNormalColor = localStorage.getItem('normalFieldCompleteColor')
  if (savedNormalColor) {
    normalFieldCompleteColor.value = savedNormalColor
    document.documentElement.style.setProperty('--normal-field-complete-color', savedNormalColor)
  } else {
    document.documentElement.style.setProperty('--normal-field-complete-color', '#00ff7f')
  }
  
  const savedNormalShadow = localStorage.getItem('normalFieldShadowColor')
  if (savedNormalShadow) {
    normalFieldShadowColor.value = savedNormalShadow
    document.documentElement.style.setProperty('--normal-field-shadow-color', savedNormalShadow)
  } else {
    document.documentElement.style.setProperty('--normal-field-shadow-color', 'rgba(0, 255, 127, 0.5)')
  }
  
  const savedTimeColor = localStorage.getItem('timeFieldCompleteColor')
  if (savedTimeColor) {
    timeFieldCompleteColor.value = savedTimeColor
    document.documentElement.style.setProperty('--time-field-complete-color', savedTimeColor)
  } else {
    document.documentElement.style.setProperty('--time-field-complete-color', '#00d4ff')
  }
  
  const savedTimeShadow = localStorage.getItem('timeFieldShadowColor')
  if (savedTimeShadow) {
    timeFieldShadowColor.value = savedTimeShadow
    document.documentElement.style.setProperty('--time-field-shadow-color', savedTimeShadow)
  } else {
    document.documentElement.style.setProperty('--time-field-shadow-color', 'rgba(0, 212, 255, 0.5)')
  }
  
  // 載入已保存的界面顯示設定
  const savedShowNoticeSection = localStorage.getItem('showNoticeSection')
  if (savedShowNoticeSection !== null) {
    showNoticeSection.value = savedShowNoticeSection === 'true'
  }
  
  const savedTablePageSize = localStorage.getItem('tablePageSize')
  if (savedTablePageSize) {
    tablePageSize.value = parseInt(savedTablePageSize)
  }
  
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
  z-index: 1000;
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
  padding: 0;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 2px solid #4a4a4a;
  max-width: 1000px;
  width: 90vw;
  max-height: 85vh;
  overflow: hidden;
  text-align: center;
  animation: modalSlideIn 0.4s ease-out;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

/* 彈窗頭部 */
.modal-header {
  padding: 20px 30px 0 30px;
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  border-bottom: 1px solid #4a4a4a;
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.modal-title {
  color: #ffffff;
  font-size: calc(var(--base-font-size) * 1.5);
  font-weight: bold;
  margin: 0 0 20px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* Tabs 樣式 */
.overlay-tabs {
  flex-shrink: 0;
  margin: 0;
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: calc(var(--base-font-size) * 0.875);
  font-weight: 500;
}

/* Tab 內容區域 */
.tab-pane {
  padding: 30px;
  max-height: 60vh;
  overflow-y: auto;
  text-align: left;
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
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  color: #cccccc;
  cursor: pointer;
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 10;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  transform: scale(1.1);
}


.content-title {
  color: #ffffff;
  font-size: calc(var(--base-font-size) * 1.5);
  font-weight: bold;
  margin: 0 0 25px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* 活動狀態樣式 */
.activity-pane {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.status-icon {
  margin-bottom: 20px;
}

.icon {
  font-size: calc(var(--base-font-size) * 3.0);
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
  font-size: calc(var(--base-font-size) * 1.5);
  font-weight: bold;
  margin: 0 0 15px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  /* 修正：確保標題不會超出容器 */
  word-wrap: break-word;
}

.status-message {
  color: #cccccc;
  font-size: var(--base-font-size);
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
  font-size: calc(var(--base-font-size) * 2.0);
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
  font-size: var(--base-font-size);
  font-weight: bold;
}

.notice-content p {
  color: #ffffff;
  margin: 0 0 15px 0;
  line-height: 1.5;
  font-size: calc(var(--base-font-size) * 0.875);
  word-wrap: break-word;
}

.notice-hint {
  color: #cccccc;
  font-size: calc(var(--base-font-size) * 0.8125);
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
  font-size: calc(var(--base-font-size) * 1.125);
  font-weight: bold;
}

.error-message {
  color: #ffffff;
  margin: 0 0 15px 0;
  line-height: 1.5;
  font-size: calc(var(--base-font-size) * 0.9375);
  word-wrap: break-word;
}

.field-error-details {
  margin-top: 15px;
}

.error-field {
  margin: 8px 0;
  color: #ffffff;
  font-size: calc(var(--base-font-size) * 0.875);
  word-wrap: break-word;
}

.available-fields-details {
  margin-top: 12px;
}

.fields-summary {
  color: #409eff;
  cursor: pointer;
  margin: 10px 0;
  font-size: calc(var(--base-font-size) * 0.875);
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
  font-size: calc(var(--base-font-size) * 0.875);
  flex-shrink: 0;
}

.info-value {
  color: #ffffff;
  font-size: calc(var(--base-font-size) * 0.875);
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
  font-size: calc(var(--base-font-size) * 0.8125);
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
  font-size: calc(var(--base-font-size) * 0.875);
}

.countdown-timer {
  font-size: calc(var(--base-font-size) * 1.25);
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
  font-size: calc(var(--base-font-size) * 0.75);
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
  font-size: var(--base-font-size);
  font-weight: bold;
}

.ended-note {
  color: #cccccc;
  font-size: calc(var(--base-font-size) * 0.75);
  font-style: italic;
}

.ended-view-data {
  color: #67C23A;
  font-size: calc(var(--base-font-size) * 0.8125);
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
  font-size: calc(var(--base-font-size) * 0.875);
}

.time-display {
  color: #67C23A;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  font-size: calc(var(--base-font-size) * 0.875);
}

/* 設定和配置內容樣式 */
.settings-pane,
.config-pane {
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.settings-section,
.config-section {
  background-color: #363636;
  border-radius: 12px;
  padding: 20px;
  margin-top: 2px;
  margin-bottom: 2px;
  /*border-left: 4px solid #409eff;*/
  /* 修正：確保在小屏幕上不會超出 */
  word-wrap: break-word;
}

.settings-section h3,
.config-section h3 {
  color: #ffffff;
  margin: 0 0 15px 0;
  font-size: calc(var(--base-font-size) * 1.125);
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
  font-size: calc(var(--base-font-size) * 0.875);
  font-weight: 500;
}

.stat-value {
  color: #409eff;
  font-size: calc(var(--base-font-size) * 0.875);
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
  font-size: calc(var(--base-font-size) * 0.875);
  font-weight: 500;
}

.info-item .value {
  color: #ffffff;
  font-size: calc(var(--base-font-size) * 0.875);
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
  font-size: var(--base-font-size);
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
  font-size: calc(var(--base-font-size) * 0.875);
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
  font-size: calc(var(--base-font-size) * 0.75);
  font-weight: bold;
  flex-shrink: 0;
}

.preprocessing-rule {
  background-color: #1a1a1a;
  color: #E6A23C;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: calc(var(--base-font-size) * 0.75);
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
  font-size: calc(var(--base-font-size) * 0.75);
  font-weight: bold;
  flex-shrink: 0;
}

.note-text {
  color: #cccccc;
  font-size: calc(var(--base-font-size) * 0.75);
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
  font-size: calc(var(--base-font-size) * 1.125);
  flex-shrink: 0;
}

.warning-text {
  color: #ffffff;
  font-size: calc(var(--base-font-size) * 0.875);
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
  font-size: calc(var(--base-font-size) * 0.75);
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
    margin: 20px;
    max-width: none;
    width: calc(100vw - 40px);
    max-height: calc(100vh - 40px);
  }
  
  .modal-header {
    padding: 15px 20px 0 20px;
  }
  
  .modal-title {
    font-size: calc(var(--base-font-size) * 1.25);
  }
  
  .tab-pane {
    padding: 20px;
  }
  
  :deep(.el-tabs__nav-wrap) {
    padding: 0 10px;
  }
  
  :deep(.el-tabs__item) {
    font-size: calc(var(--base-font-size) * 0.875);
    padding: 0 15px;
  }
  
  .content-title {
    font-size: calc(var(--base-font-size) * 1.25);
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
    font-size: calc(var(--base-font-size) * 1.75);
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
    font-size: calc(var(--base-font-size) * 1.125);
  }
  
  .status-title {
    font-size: calc(var(--base-font-size) * 1.25);
  }
  
  .settings-section h3,
  .config-section h3 {
    font-size: var(--base-font-size);
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

/* Element Plus Tabs 深色主題適配 */
:deep(.el-tabs) {
  --el-tabs-header-height: 60px;
}

:deep(.el-tabs__header) {
  background: linear-gradient(135deg, #2d2d2d 0%, #3a3a3a 100%);
  margin: 0;
  border-bottom: 2px solid #4a4a4a;
}

:deep(.el-tabs__nav-wrap) {
  background: transparent;
  padding: 0 20px;
}

:deep(.el-tabs__nav) {
  border: none;
}

:deep(.el-tabs__item) {
  color: #cccccc;
  border: none;
  font-size: var(--base-font-size);
  font-weight: 500;
  padding: 0 20px;
  height: 60px;
  line-height: 60px;
  transition: all 0.3s ease;
}

:deep(.el-tabs__item:hover) {
  color: #409eff;
  background: rgba(64, 158, 255, 0.1);
}

:deep(.el-tabs__item.is-active) {
  color: #409eff;
  background: rgba(64, 158, 255, 0.15);
  border-bottom: 3px solid #409eff;
}

:deep(.el-tabs__active-bar) {
  background-color: #409eff;
  height: 3px;
}

:deep(.el-tabs__content) {
  padding: 0;
  overflow: visible;
  flex: 1;
}

:deep(.el-tab-pane) {
  height: 100%;
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
  font-size: var(--base-font-size);
  font-weight: bold;
  margin-bottom: 15px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 255, 127, 0.3);
  text-shadow: 0 0 8px currentColor;
}

.notice-markdown {
  color: #ffffff;
  line-height: 1.6;
  font-size: calc(var(--base-font-size) * 0.875);
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

.notice-markdown :deep(h1) { font-size: calc(var(--base-font-size) * 1.125); }
.notice-markdown :deep(h2) { font-size: var(--base-font-size); }
.notice-markdown :deep(h3) { font-size: calc(var(--base-font-size) * 0.9375); }
.notice-markdown :deep(h4) { font-size: calc(var(--base-font-size) * 0.875); }

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
    font-size: calc(var(--base-font-size) * 0.875);
    margin-bottom: 12px;
  }
  
  .notice-markdown {
    font-size: calc(var(--base-font-size) * 0.8125);
  }
  
  .notice-markdown :deep(h1) { font-size: var(--base-font-size); }
  .notice-markdown :deep(h2) { font-size: calc(var(--base-font-size) * 0.9375); }
  .notice-markdown :deep(h3) { font-size: calc(var(--base-font-size) * 0.875); }
  .notice-markdown :deep(h4) { font-size: calc(var(--base-font-size) * 0.8125); }
}

/* 字體大小設定樣式 */
.font-size-config {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.font-size-slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.font-size-display {
  color: #409eff;
  font-weight: 600;
  min-width: 40px;
  text-align: right;
  font-family: 'Courier New', monospace;
}

.font-size-preview {
  margin-top: 12px;
  padding: 12px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  border-left: 3px solid #67C23A;
}

.preview-text {
  color: #ffffff;
  font-size: var(--base-font-size, 16px);
  line-height: 1.5;
  transition: font-size 0.2s ease;
}

/* 換頁倒數計時設定樣式 */
.countdown-config {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.countdown-slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.page-size-slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.countdown-display {
  color: #E6A23C;
  font-weight: 600;
  min-width: 40px;
  text-align: right;
  font-family: 'Courier New', monospace;
}

.countdown-preview {
  margin-top: 12px;
  padding: 12px;
  background-color: rgba(230, 162, 60, 0.05);
  border-radius: 6px;
  border-left: 3px solid #E6A23C;
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
  font-size: calc(var(--base-font-size) * 0.875);
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

/* 打字機顏色設定樣式 */
.color-config {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.color-group {
  background-color: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.color-group h4 {
  color: #ffffff;
  font-size: calc(var(--base-font-size) * 0.9375);
  margin: 0 0 12px 0;
  font-weight: 600;
}

.color-picker-container {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.color-value {
  color: #a0a0a0;
  font-family: 'Courier New', monospace;
  font-size: calc(var(--base-font-size) * 0.8125);
  min-width: 120px;
}

.color-preview {
  margin-top: 12px;
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.color-preview .preview-text {
  font-size: calc(var(--base-font-size) * 1.0625);
  font-weight: 500;
}

.color-preview .time-field-preview {
  font-family: 'Courier New', monospace;
}

.color-reset {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: center;
}

/* 打字機速度設定樣式 */
.typing-speed-config {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.typing-speed-slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.typing-speed-display {
  color: #E6A23C;
  font-weight: 600;
  min-width: 50px;
  text-align: right;
  font-family: 'Courier New', monospace;
}

.carousel-range-config {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.carousel-range-selector-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.carousel-range-selector-container :deep(.el-select) {
  flex: 1;
}

.carousel-range-preview {
  margin-top: 10px;
}

.typing-speed-preview {
  margin-top: 12px;
  padding: 12px;
  background-color: rgba(230, 162, 60, 0.05);
  border-radius: 6px;
  border-left: 3px solid #E6A23C;
}

/* Element Plus ColorPicker 樣式覆蓋，確保彈出層不被遮住 */
:deep(.el-color-picker) {
  --el-color-picker-size: 32px;
}

:deep(.el-color-picker__trigger) {
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  transition: all 0.3s ease;
}

:deep(.el-color-picker__trigger:hover) {
  border-color: #409eff;
}

/* 確保 ColorPicker 彈出層有足夠高的 z-index */
</style>
<style>
/* 全域樣式，確保 ColorPicker 彈出層不被遮住 */
.el-color-dropdown {
  z-index: 10000 !important;
}

.el-color-picker__panel {
  z-index: 10000 !important;
}

.el-popper {
  z-index: 10000 !important;
}
</style>