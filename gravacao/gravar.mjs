/**
 * Grava uma partida completa do jogo em vídeo.
 *
 * Dirige o jogo por teclado e mouse de verdade (Playwright), do vestiário ao
 * relatório, jogando BEM — respeitando limite, parando na faixa e guardando
 * distância. O objetivo é mostrar o jogo funcionando, não uma reprovação.
 *
 * O Playwright vem do projeto vizinho (frontIngressosEnergisa), que já o tem
 * instalado com o Chromium baixado — não vale acrescentar 130 MB de
 * dependência neste projeto só para gravar um vídeo.
 *
 * Uso: node gravacao/gravar.mjs [url]
 */
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// resolve o playwright a partir do package.json do vizinho, em vez de apontar
// para um arquivo dentro dele — o caminho interno muda entre versoes
const exigir = createRequire(
  '/Users/italoaurelio/Projetos/energisa/frontIngressosEnergisa/package.json',
)
const { chromium } = exigir('playwright')

const AQUI = dirname(fileURLToPath(import.meta.url))
const SAIDA = resolve(AQUI, 'bruto')
const URL_JOGO = process.argv[2] ?? 'http://localhost:5273/'
const LARGURA = 1280
const ALTURA = 720

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

/** Clica pelo texto visível, como um jogador clicaria. */
async function clicar(page, texto, { pausa = 700 } = {}) {
  const alvo = page.locator('button', { hasText: texto }).first()
  await alvo.waitFor({ state: 'visible', timeout: 15000 })
  await alvo.click()
  await espera(pausa)
}

/** Clica um elemento qualquer pelo seletor, como um jogador clicaria. */
async function tocar(page, seletor, { pausa = 700 } = {}) {
  const alvo = page.locator(seletor).first()
  await alvo.waitFor({ state: 'visible', timeout: 15000 })
  await alvo.click()
  await espera(pausa)
}

/**
 * Fase 1, refeita em 09/10: tela única, marcas no corpo e bancada de etiqueta.
 *
 * O roteiro antigo clicava "Ir para a arara de EPI" e uma altura de 1,86 m que
 * nunca existiu no catálogo — ele tinha parado de acompanhar a tela. Aqui a
 * vaga é trocada CLICANDO NO CORPO (`.marca`), que é a mecânica nova, e cada
 * peça passa pela bancada antes de ser vestida: é lá que está a etiqueta, e
 * uma gravação que pula a bancada não mostra o que a fase virou.
 */
async function vestiario(page) {
  // O ONBOARDING ENTRA NA GRAVAÇÃO, e não é enfeite: ele é a parte mais
  // nova do jogo e a primeira que o cliente vê. As esperas são medidas
  // pelas animações — as demonstrações do passo 3 fecham o ciclo em 4,0 s
  // e 4,4 s, então 7 s mostram cada uma dando mais de uma volta.
  //
  // O roteiro anterior clicava 'Começar', que deixou de existir quando a
  // abertura virou quatro passos. É o mesmo jeito de quebrar de sempre:
  // clicar por texto não dá erro, trava esperando um botão que não há.
  await clicar(page, 'Como funciona', { pausa: 3400 })
  await clicar(page, 'Como se joga', { pausa: 7000 })
  await clicar(page, 'Como é a nota', { pausa: 3600 })
  await clicar(page, 'Começar o dia', { pausa: 2600 })

  // deixa o físico à vista por um instante antes de mexer
  await clicar(page, '1,82 m', { pausa: 1100 })
  await clicar(page, 'Próximo', { pausa: 900 })
  await page.locator('.tom').nth(3).click()
  await espera(1400)
  await clicar(page, 'Próximo', { pausa: 900 })
  await page.locator('.tom').nth(1).click()
  await espera(1200)
  await clicar(page, 'Abrir o armário', { pausa: 1600 })

  const escolhas = [
    ['Cabeça', 'Capacete classe B'],
    ['Olhos e face', 'Protetor facial'],
    ['Corpo', 'Vestimenta antichama'],
    ['Mãos', 'Luva isolante com luva de cobertura'],
    ['Pés', 'Botina de segurança isolante'],
    ['Cintura', 'Cinturão paraquedista'],
    ['Objetos pessoais', 'Guardar tudo no armário'],
  ]
  for (const [vaga, peca] of escolhas) {
    // a marca sobre o corpo, não a aba do painel: é o alvo que o jogador usa
    await tocar(page, `.marca[title="${vaga}"]`, { pausa: 650 })
    await page.locator('.arara .item', { hasText: peca }).first().click()
    // a etiqueta fica em quadro o suficiente para dar para ler o CA e a data
    await espera(2100)
    await clicar(page, 'Vestir esta', { pausa: 1100 })
  }

  await espera(1200)
  await clicar(page, 'Conferir o EPI', { pausa: 900 })
  // a conferência revela um item a cada 650 ms; são sete
  await espera(6500)
  await clicar(page, 'Sair para o serviço', { pausa: 2600 })
}

async function cabine(page) {
  // o veículo chega com defeito em cinco dos seis itens
  const respostas = [
    'Corrigir antes de sair',      // cinto
    'Corrigir antes de sair',      // retrovisores
    'Corrigir antes de sair',      // apoio de cabeça
    'Está correto, pode sair assim', // freio de estacionamento
    'Corrigir antes de sair',      // celular
    'Corrigir antes de sair',      // checklist
  ]
  for (let i = 0; i < respostas.length; i++) {
    await espera(1600)                       // deixa ver o item
    await clicar(page, respostas[i], { pausa: 1500 })
    await clicar(page, i === respostas.length - 1 ? 'Dar a partida' : 'Próximo item',
                 { pausa: 900 })
  }
  await espera(2200)
}

/**
 * Piloto: mantém a velocidade compatível, para na faixa e guarda distância.
 *
 * Lê o estado pelo gancho de desenvolvimento `window.__trajeto` e responde com
 * tecla de verdade, para o vídeo mostrar o jogo reagindo a entrada real.
 */
async function trajeto(page, { aoVivo = () => {} } = {}) {
  const LOMBADA = 1130          // metro da lombada no trajeto
  let pedal = null

  const segurar = async (novo) => {
    if (novo === pedal) return
    if (pedal) await page.keyboard.up(pedal === 'acelera' ? 'ArrowUp' : 'ArrowDown')
    if (novo) await page.keyboard.down(novo === 'acelera' ? 'ArrowUp' : 'ArrowDown')
    pedal = novo
  }

  const inicio = Date.now()
  for (;;) {
    if (Date.now() - inicio > 260000) break          // rede de segurança
    const s = await page.evaluate(() => {
      const t = window.__trajeto
      if (!t) return null
      const al = document.querySelector('.trajeto-alerta')
      const parando = al && al.style.display !== 'none'
      return { ...t, parando }
    })
    if (!s) break                                     // saiu do trajeto
    aoVivo(s)

    let alvo = s.limite - 3
    // aproxima devagar da faixa e só então para: parar a cem metros é
    // exagero e deixa o vídeo parado olhando para o nada
    if (s.parando) alvo = s.ateParada != null && s.ateParada > 16 ? 14 : 0
    if (Math.abs(s.d - LOMBADA) < 55) alvo = Math.min(alvo, 17)
    if (s.vao != null && s.vao < Math.max(10, (s.kmh / 3.6) * 2.4)) {
      alvo = Math.min(alvo, Math.max(0, s.kmh - 12))
    }

    if (s.kmh < alvo - 2) await segurar('acelera')
    else if (s.kmh > alvo + 1) await segurar('freia')
    else await segurar(null)

    await espera(110)
  }
  await segurar(null)
  await espera(2000)
}

/**
 * Fase 3. Desde 09/10 a escolha NÃO vale ao ser clicada: ela aparece em
 * transparente na cena e só "Executar a manobra" a torna real.
 *
 * Na pergunta da distância o piloto marca de propósito a opção errada antes
 * da certa, e espera nas duas. É a única maneira de a gravação mostrar o que
 * a prévia serve para ensinar: com a sinalização colada no caminhão, a vista
 * de quem chega dirigindo não tem nada; recuada, o cavalete chega de longe.
 */
async function ocorrencia(page) {
  await clicar(page, 'Chegar ao local', { pausa: 2200 })

  const decisoes = [
    { certa: 'Antes da área de trabalho' },
    { certa: 'Recuado, numa distância compatível', antes: 'Logo atrás do veículo' },
    { certa: 'Cercar com cones e fita' },
  ]
  for (let i = 0; i < decisoes.length; i++) {
    await espera(1500)
    if (decisoes[i].antes) {
      await clicar(page, decisoes[i].antes, { pausa: 3200 })
    }
    await clicar(page, decisoes[i].certa, { pausa: 3200 })
    await clicar(page, 'Executar a manobra', { pausa: 2600 })
    await clicar(page, i === decisoes.length - 1 ? 'Separar o equipamento' : 'Próxima decisão',
                 { pausa: 1200 })
  }

  const kit = [
    'Vara de manobra isolante',
    'Detector de tensão para alta',
    'Conjunto de aterramento temporário',
    'Elo fusível de reposição',
    'Escada de fibra de vidro',
    'Alicate isolado 1000 V',
    'Corda de içamento com bolsa',
  ]
  for (const f of kit) {
    await page.locator('button', { hasText: f }).first().click()
    // a escada é a única peça do kit com malha: separar ela desenha a prévia
    // encostada no poste, e vale esperar para isso aparecer no vídeo
    await espera(f.startsWith('Escada') ? 2600 : 420)
  }
  await espera(900)
  await clicar(page, 'Subir para o serviço', { pausa: 2600 })

  /*
    O REPARO não é mais uma lista de frases para ordenar: o jogador pega uma
    ferramenta do cesto e encosta num ponto do poste. O roteiro anterior
    clicava as nove frases e, como sempre, não daria erro — ficaria 15 s
    esperando um botão que não existe mais.

    A sequência abaixo é a CERTA, e de propósito: o vídeo é demonstração, não
    prova. O acidente tem a sua própria gravação, se um dia alguém quiser.
  */
  const servico = [
    ['Rádio', 'Rádio'],
    ['Vara de manobra', 'Chave fusível'],
    ['Cadeado', 'Chave fusível'],
    ['Detector', 'Ramal'],
    ['Aterramento', 'Ramal'],
    ['Cobertura', 'Rede vizinha'],
    ['Elo fusível', 'Porta-fusível'],
    ['Aterramento', 'Ramal'],
    ['Cadeado', 'Chave fusível'],
  ]
  for (const [ferramenta, alvo] of servico) {
    await page.locator('.ferramenta', { hasText: ferramenta }).first().click()
    await espera(700)
    await page.locator('.opcoes.coluna .opcao', { hasText: alvo }).first().click()
    // 1,9 s: a pose do eletricista dura de 1,3 a 2,8 s, e cortar antes dela
    // terminar tira do vídeo justamente o que a cena ganhou
    await espera(1900)
  }
  await espera(1200)
  await clicar(page, 'Encerrar o serviço', { pausa: 3000 })
}

async function principal() {
  mkdirSync(SAIDA, { recursive: true })
  const navegador = await chromium.launch({
    headless: false,          // headless usa SwiftShader e o 3D fica lento
    args: [
      '--use-angle=metal',
      '--enable-gpu-rasterization',
      '--hide-scrollbars',
      '--autoplay-policy=no-user-gesture-required',
    ],
  })
  const contexto = await navegador.newContext({
    viewport: { width: LARGURA, height: ALTURA },
    deviceScaleFactor: 1,
    recordVideo: { dir: SAIDA, size: { width: LARGURA, height: ALTURA } },
  })
  const page = await contexto.newPage()
  page.on('pageerror', (e) => console.error('ERRO NA PAGINA:', e.message))

  await page.goto(URL_JOGO, { waitUntil: 'networkidle' })
  await espera(1500)

  console.log('-> vestiario')
  await vestiario(page)
  console.log('-> cabine')
  await cabine(page)
  console.log('-> trajeto')
  let ultimo = 0
  await trajeto(page, {
    aoVivo: (s) => {
      if (s.d - ultimo >= 250) { ultimo = s.d; console.log(`   ${Math.round(s.d)} m · ${s.kmh} km/h · ${s.trecho}`) }
    },
  })
  console.log('-> ocorrencia')
  await ocorrencia(page)

  const nota = await page.locator('h2').first().innerText().catch(() => '(sem relatorio)')
  console.log('-> relatorio:', nota.replace(/\n/g, ' '))

  // O RELATÓRIO É O FIM DA PARTIDA E PRECISA APARECER INTEIRO.
  //
  // A gravação anterior terminava no botão "Encerrar o serviço": os últimos
  // segundos não chegaram ao arquivo. São duas coisas somadas — o vídeo não
  // esperava o bastante, e `contexto.close()` corta o rabo do screencast se a
  // página não for fechada antes. Agora espera, ROLA a tela (a lista do que
  // precisa ser corrigido fica abaixo da dobra e é o que o cliente lê) e só
  // então fecha a página, que é o que finaliza o arquivo.
  await espera(3500)
  await page.mouse.move(LARGURA / 2, ALTURA / 2)
  for (let i = 0; i < 14; i++) {
    await page.mouse.wheel(0, 170)
    await espera(400)
  }
  await espera(3000)

  const video = page.video()
  await page.close()
  await contexto.close()
  await navegador.close()
  const caminho = video ? await video.path() : null
  console.log('VIDEO:', caminho)
}

principal().catch((e) => { console.error(e); process.exit(1) })
