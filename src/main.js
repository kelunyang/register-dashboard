import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

// 引入服務
import apiService from './services/apiService.js'
import dataProcessor from './services/dataProcessor.js'
import storageService from './services/storageService.js'
import markdownService from './services/markdownService.js'

const app = createApp(App)

// 手動啟用 Vue DevTools
app.config.devtools = true

app.use(ElementPlus)

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 全局提供服務（可選）
app.provide('apiService', apiService)
app.provide('dataProcessor', dataProcessor)
app.provide('storageService', storageService)
app.provide('markdownService', markdownService)

// 檢查 localStorage 支援性
if (storageService.isSupported()) {
  console.log('✅ LocalStorage 支援已啟用')
} else {
  console.warn('⚠️ LocalStorage 不支援，某些功能可能受限')
}

app.mount('#app')