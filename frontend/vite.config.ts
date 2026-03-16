import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Minificação agressiva com terser para obfuscar strings e nomes de variáveis
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,   // remove console.log em produção
        drop_debugger: true,
        passes: 2,
      },
      mangle: {
        // Obfusca nomes de variáveis/funções
        toplevel: true,
      },
      format: {
        comments: false,      // remove todos os comentários
      },
    },
    rollupOptions: {
      output: {
        // Nomes de chunks sem informação semântica
        chunkFileNames: 'assets/[hash].js',
        entryFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash].[ext]',
        // Separar vendor para cache mais eficiente
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
    // Não gerar sourcemaps em produção (evita exposição de código fonte)
    sourcemap: false,
  },
})
