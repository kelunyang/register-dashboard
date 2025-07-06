import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // 啟用 Vue DevTools
          isCustomElement: tag => tag.startsWith('vue-devtools')
        }
      }
    }),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
  define: {
    // 啟用 Vue DevTools 在所有環境中（包含生產環境）
    __VUE_PROD_DEVTOOLS__: JSON.stringify(true),
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'es2015',
    modulePreload: false,
    rollupOptions: {
      output: {
        format: 'iife',
        globals: {
          vue: 'Vue'
        }
      }
    }
  }
})
