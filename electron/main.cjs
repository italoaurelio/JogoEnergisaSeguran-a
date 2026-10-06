/**
 * Empacotamento para desktop e totem. CommonJS de propósito: o package é
 * "type": "module" e o processo principal do Electron não aceita ESM aqui.
 */
const { app, BrowserWindow, screen } = require('electron')
const path = require('node:path')

const DEV = process.env.VITE_DEV_SERVER_URL

function criarJanela() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const janela = new BrowserWindow({
    width: Math.min(1600, width),
    height: Math.min(1000, height),
    backgroundColor: '#0f1419',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })

  janela.once('ready-to-show', () => janela.show())

  if (DEV) {
    janela.loadURL(DEV)
  } else {
    janela.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // no totem o jogo abre em tela cheia; no desktop fica em janela
  if (process.env.TOTEM === '1') janela.setFullScreen(true)
}

app.whenReady().then(() => {
  criarJanela()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
