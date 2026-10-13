import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  // `host: true` serve também no IP da rede, e não só em localhost — é o que
  // deixa abrir o jogo no celular, que é onde o cliente costuma ver primeiro.
  server: { port: 5273, host: true },
  resolve: {
    // Uma cópia só de cada. Ao instalar o pós-processamento o Vite passou a
    // pré-empacotar um segundo React e a aplicação quebrou inteira com
    // "Invalid hook call"; o `three` tem o mesmo problema por causa de uma
    // cópia aninhada em stats-gl, e duas cópias dele quebram instanceof.
    dedupe: ['react', 'react-dom', 'three'],
  },
  optimizeDeps: {
    include: [
      'react', 'react-dom', 'three',
      '@react-three/fiber', '@react-three/drei',
      '@react-three/postprocessing', 'postprocessing',
    ],
  },
})
