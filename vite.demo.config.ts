import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 演示页面构建配置：以 index.html 为入口，将包含 App.vue 的演示页打包为静态站点。
// 与默认的 library 构建（vite.config.ts）区分开，便于发布/分享 demo。
export default defineConfig({
  plugins: [vue()],
  // 默认 publicDir 为 "public"，会一并拷贝 favicon.svg 等静态资源
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
  },
})
