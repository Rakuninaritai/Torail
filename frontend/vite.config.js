import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      //   ① ブラウザが /api で始まるリクエストを出したら
      //   ② Vite が localhost:8000 へ転送してくれる
      // fetchにポート番号書いていないけど
      "/api": "http://127.0.0.1:8000",
    },
  },
})
