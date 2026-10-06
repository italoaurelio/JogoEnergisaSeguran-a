// Sobe o Vite e abre o Electron apontado para ele.
import { spawn } from 'node:child_process'
import { createServer } from 'vite'

const servidor = await createServer({ server: { port: 5273 } })
await servidor.listen()
const url = servidor.resolvedUrls.local[0]
console.log('dev server em', url)

const filho = spawn('electron', ['electron/main.cjs'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
  shell: true,
})
filho.on('close', async () => {
  await servidor.close()
  process.exit(0)
})
