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
/*
  `--ocorrencia` grava SÓ a última fase, a partir de `?fase=ocorrencia`.

  Existe porque a partida inteira dá quase cinco minutos e quem precisa
  revisar o reparo não vai assistir ao vestiário e à estrada de novo. Cortar
  do vídeo cheio com ffmpeg daria o mesmo quadro, mas obrigaria a gravar os
  quatro minutos antes para jogar fora.
*/
const SO_OCORRENCIA = process.argv.includes('--ocorrencia')
/*
  `--sem-video` joga a partida sem gravar nada.

  Serve para CONFERIR, que é o uso mais frequente: a gravação é o que pesa,
  não o jogo. Medido com o `top`, o `ffmpeg` do Playwright come 84% de um
  núcleo sozinho e segura os quadros de 1280x720 na memória — e nesta
  máquina, com 65 MB livres, isso põe o sistema a paginar e o load passa de
  25. A partida que leva 5 minutos passava de 20 e travava.

  Sem vídeo sobra o navegador, que é o que se quer medir.
*/
const SEM_VIDEO = process.argv.includes('--sem-video')
const URL_JOGO = (process.argv[2] ?? '').startsWith('http')
  ? process.argv[2]
  : 'http://localhost:5273/'
const LARGURA = 1280
const ALTURA = 720

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

/** Relógio da gravação, para saber ONDE o tempo foi. */
const T0 = Date.now()
const agora = () => {
  const s = Math.round((Date.now() - T0) / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
const marcar = (o) => console.log(`   [${agora()}] ${o}`)

/** Clica pelo texto visível, como um jogador clicaria. */
async function clicar(page, texto, { pausa = 700 } = {}) {
  const t = Date.now()
  const alvo = page.locator('button', { hasText: texto }).first()
  await alvo.waitFor({ state: 'visible', timeout: 15000 })
  await alvo.click()
  const gasto = Date.now() - t
  // só reporta o que demorou mais do que a pausa pedida: é aí que mora
  // qualquer espera que eu não escrevi
  if (gasto > 1200) marcar(`clique "${texto}" levou ${(gasto / 1000).toFixed(1)}s`)
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

/**
 * A conferência do veículo, que deixou de ser pergunta-e-dois-botões.
 *
 * Agora se clica NA PEÇA: cada gesto ajusta uma coisa da cabine, e o que não
 * for tocado sai como está. O freio de estacionamento é o único item que já
 * chega certo — deixá-lo em paz É a resposta, e por isso ele não aparece
 * nesta lista.
 *
 * O roteiro clica pelo botão do PAINEL e não pela marca 3D de propósito: a
 * marca é um alvo de 22 px que se move com a câmera, e clique por
 * coordenada em cena animada é a receita de roteiro que quebra em silêncio.
 */
async function cabine(page) {
  const gestos = [
    'Afivelar o cinto',
    'Abrir os retrovisores',
    'Levantar o apoio',
    'Guardar o celular',
    'Preencher o checklist',
  ]
  for (const g of gestos) {
    await espera(1500)                   // deixa a câmera chegar na peça
    await clicar(page, g, { pausa: 1700 })  // e deixa ver a peça se mexer
  }
  await espera(1800)
  await clicar(page, 'Dar a partida', { pausa: 2200 })
}

/**
 * Piloto: mantém a velocidade compatível, para na faixa e guarda distância.
 *
 * Lê o estado pelo gancho de desenvolvimento `window.__trajeto` e responde com
 * tecla de verdade, para o vídeo mostrar o jogo reagindo a entrada real.
 */
/**
 * Piloto: mantém a velocidade compatível, para na faixa e guarda distância.
 *
 * ELE RODA DENTRO DA PÁGINA, não aqui. A versão anterior lia o estado por
 * `page.evaluate` e mandava tecla por CDP a cada 110 ms — e cada ida e volta
 * custa caro num Chromium com janela visível gravando vídeo. O piloto reagia
 * a cada ~250 ms, oscilava entre acelerar e frear e o trajeto de 87 segundos
 * levava 4min22 no vídeo. Medido: a página entrega 14,8 fps gravando, e o
 * caminhão anda em velocidade real — o atraso era todo do controle remoto.
 *
 * Dentro da página ele decide a cada quadro, que é como um jogador decide.
 * Daqui só se espera o fim e se lê o progresso de vez em quando.
 */
async function trajeto(page, { aoVivo = () => {} } = {}) {
  await page.evaluate(() => {
    const t = window.__trajeto
    const LOMBADA = t?.lombada ?? 370
    const ONIBUS = t?.onibus ?? null
    const CICLISTA = t?.ciclista ?? null
    const bA = [...document.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Acelerar'))
    const bF = [...document.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Frear'))
    const ap = (el, tipo) =>
      el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, pointerId: 1 }))
    let pedal = null
    const segurar = (n) => {
      if (n === pedal) return
      if (pedal) ap(pedal === 'a' ? bA : bF, 'pointerup')
      if (n) ap(n === 'a' ? bA : bF, 'pointerdown')
      pedal = n
    }
    window.__pilotoVivo = true
    const passo = () => {
      if (!document.querySelector('.trajeto-palco')) {
        segurar(null)
        window.__pilotoVivo = false
        return
      }
      const s = window.__trajeto
      if (!s) { requestAnimationFrame(passo); return }
      const al = document.querySelector('.trajeto-alerta')
      const parando = al && al.style.display !== 'none'
      let alvo = s.limite - 3
      // aproxima devagar da faixa e só então para: parar a cem metros é
      // exagero e deixa o vídeo parado olhando para o nada
      if (parando) alvo = s.ateParada != null && s.ateParada > 16 ? 14 : 0
      if (Math.abs(s.d - LOMBADA) < 55) alvo = Math.min(alvo, 17)
      // o jogo cobra ≤20 no ônibus escolar e ≤30 no ciclista
      if (ONIBUS != null && Math.abs(s.d - ONIBUS) < 45) alvo = Math.min(alvo, 16)
      if (CICLISTA != null && Math.abs(s.d - CICLISTA) < 40) alvo = Math.min(alvo, 24)
      if (s.vao != null && s.vao < Math.max(10, (s.kmh / 3.6) * 2.4)) {
        alvo = Math.min(alvo, Math.max(0, s.kmh - 12))
      }
      if (s.kmh < alvo - 2) segurar('a')
      else if (s.kmh > alvo + 1) segurar('f')
      else segurar(null)
      requestAnimationFrame(passo)
    }
    requestAnimationFrame(passo)
  })

  const inicio = Date.now()
  for (;;) {
    if (Date.now() - inicio > 260000) break        // rede de segurança
    const s = await page.evaluate(() => ({
      vivo: window.__pilotoVivo === true,
      t: window.__trajeto,
      naTela: !!document.querySelector('.trajeto-palco'),
    }))
    if (!s.vivo || !s.naTela) break
    if (s.t) aoVivo(s.t)
    await espera(900)
  }
  await espera(2000)
}

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

    A sequência passa DE PROPÓSITO pelo acidente. Abrir a chave e ir direto
    no porta-fusível sem o cadeado é a omissão que a NR-10 inteira existe
    para evitar, e é o que o cliente pediu para ver acontecendo: o Centro
    religa o ramal, o arco estoura, e o jogador perde o passo anterior e
    refaz. Mostrar só o caminho certo não ensina por que o cadeado existe.
  */
  const servico = [
    ['Rádio', 'Rádio'],
    ['Vara de manobra', 'Chave fusível'],
    // sem bloquear: daqui sai o arco. 4,6 s porque o clarão come 1,5 s e a
    // pose do choque dura 2,8 s — cortar antes tira do vídeo o acidente
    ['Elo fusível', 'Porta-fusível', 4600],
    ['Vara de manobra', 'Chave fusível'],   // refaz o passo que o acidente levou
    ['Cadeado', 'Chave fusível'],
    ['Detector', 'Ramal'],
    ['Aterramento', 'Ramal'],
    ['Cobertura', 'Rede vizinha'],
    ['Elo fusível', 'Porta-fusível'],
    ['Aterramento', 'Ramal'],
    ['Cadeado', 'Chave fusível'],
  ]
  for (const [ferramenta, alvo, pausa] of servico) {
    await page.locator('.ferramenta', { hasText: ferramenta }).first().click()
    await espera(700)
    await page.locator('.opcoes.coluna .opcao', { hasText: alvo }).first().click()
    // 1,9 s: a pose do eletricista dura de 1,3 a 2,8 s, e cortar antes dela
    // terminar tira do vídeo justamente o que a cena ganhou
    await espera(pausa ?? 1900)
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
    ...(SEM_VIDEO
      ? {}
      : { recordVideo: { dir: SAIDA, size: { width: LARGURA, height: ALTURA } } }),
  })
  const page = await contexto.newPage()
  page.on('pageerror', (e) => console.error('ERRO NA PAGINA:', e.message))

  const alvo = SO_OCORRENCIA
    ? URL_JOGO + (URL_JOGO.includes('?') ? '&' : '?') + 'fase=ocorrencia'
    : URL_JOGO
  await page.goto(alvo, { waitUntil: 'networkidle' })
  await espera(1500)

  if (!SO_OCORRENCIA) {
    console.log(`-> vestiario [${agora()}]`)
    await vestiario(page)
    console.log(`-> cabine [${agora()}]`)
    await cabine(page)
    console.log(`-> trajeto [${agora()}]`)
    let ultimo = 0
    await trajeto(page, {
      aoVivo: (s) => {
        if (s.d - ultimo >= 250) { ultimo = s.d; console.log(`   ${Math.round(s.d)} m · ${s.kmh} km/h · ${s.trecho}`) }
      },
    })
  }
  console.log(`-> ocorrencia [${agora()}]`)
  await ocorrencia(page)

  const nota = await page.locator('h2').first().innerText().catch(() => '(sem relatorio)')
  console.log(`-> relatorio [${agora()}]:`, nota.replace(/\n/g, ' '))

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
