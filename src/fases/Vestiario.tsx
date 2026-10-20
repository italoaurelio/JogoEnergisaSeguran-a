/**
 * Fase 1 — Vestiário.
 *
 * REFEITA. A versão anterior era um questionário de sete telas com um boneco
 * ao lado: cada tela mostrava três nomes de peça, o jogador clicava num, a
 * resposta certa aparecia na hora e a tela seguinte entrava. Três defeitos,
 * e nenhum deles era de cor:
 *
 *  1. Cobrava MEMÓRIA, não leitura. "Capacete classe A" e "Capacete classe B"
 *     são dois nomes: quem não sabe de cor qual é a classe elétrica chuta.
 *     Agora cada peça tem ETIQUETA — CA, classe e data do ensaio elétrico —
 *     e o cabeçalho diz que dia é hoje. A luva vencida é achável lendo.
 *  2. Não tinha escolha espacial. Agora o jogador clica NO CORPO: sete marcas
 *     sobre o personagem abrem o que vai em cada parte, na ordem que ele
 *     quiser, e ele pode voltar e trocar antes de sair.
 *  3. Entregava o veredito peça por peça, o que transforma o jogo em gabarito
 *     interativo. O veredito agora é a CONFERÊNCIA no fim: o jogador fecha o
 *     conjunto, manda conferir, e a avaliação desce o corpo item a item. É a
 *     conferência de EPI que se faz de verdade antes de sair para a rua.
 *
 * O 3D também mudou de lugar: o personagem estava num disco cinza no vazio e
 * agora está num vestiário com armários, banco e luz quente (`Vestiario3D`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PalcoPronto } from '../cena/Carregando'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Environment, Html } from '@react-three/drei'
import { Acabamento } from '../cena/Acabamento'
import { LEVE, DPR } from '../cena/desempenho'
import Personagem, { ALTURA_BASE, type Fisico } from '../cena/Personagem'
import Vestiario3D, { LuzVestiario } from '../cena/Vestiario3D'
import {
  ALTURAS, CABELOS, CORTES, TONS, FISICO_INICIAL, type CorteId,
} from '../conteudo/fisico'
import {
  ETIQUETAS, PECAS, VAGAS, dataDoEnsaio, pecasDaVaga, type Peca, type Vaga,
} from '../conteudo/epi'
import { IconePeca } from '../icones'
import { som } from '../som'
import type { Registro } from '../conteudo/pontuacao'

const ORDEM_VAGAS: Vaga[] = [
  'cabeca', 'face', 'corpo', 'maos', 'pes', 'cintura', 'adorno',
]

/**
 * Onde cada marca pousa no personagem, em metros do MODELO (origem nos pés,
 * 1,7996 m de altura). Medido no jogo rodando, varrendo o `matrixWorld` das
 * peças do .glb: capacete em 1,65, visor em 1,59, peito em 1,25, cintura em
 * 0,88, punhos em 0,85 e a ±0,57 do eixo, botina em 0,11.
 *
 * A mão esquerda é a vaga das LUVAS e a direita a dos ADORNOS: são as duas
 * coisas que ficam no punho, e separá-las em punhos diferentes é o que faz
 * "tirar o relógio" virar uma decisão com lugar no corpo em vez de um item
 * de lista.
 */
const MARCAS: Record<Vaga, [number, number, number]> = {
  cabeca: [0, 1.74, 0.08],
  face: [0.27, 1.58, 0.16],
  corpo: [0, 1.26, 0.24],
  maos: [-0.62, 0.86, 0.12],
  // cintura e adorno ficavam os dois na altura do punho e os rótulos se
  // atropelavam em tela estreita; 18 cm de diferença separa as duas linhas
  cintura: [0, 1.00, 0.27],
  adorno: [0.62, 0.80, 0.12],
  pes: [0.20, 0.12, 0.22],
}

/** Quanto o personagem gira por pixel arrastado. */
const SENSIBILIDADE = 0.011

type Escolhas = Partial<Record<Vaga, string>>
type Ato = 'fisico' | 'equipar' | 'conferencia'

const HOJE = new Date()
const HOJE_TEXTO = HOJE.toLocaleDateString('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
})

export default function Vestiario({
  aoConcluir,
}: {
  aoConcluir: (
    registros: Registro[], fisico: Fisico, maximo: number, vestindo: string[],
  ) => void
}) {
  /*
    `?conferencia=1` cai direto na conferência com o EPI vestido — uma peça
    certa, uma incompleta e uma errada, para os três tons do veredito
    aparecerem na mesma tela.

    Existe porque conferir esta tela exigia vestir sete vagas a três cliques
    cada, e um roteiro de captura que erra um clique no meio não chega lá.
    Só em desenvolvimento.
  */
  const atalho = import.meta.env.DEV
    && new URLSearchParams(window.location.search).has('conferencia')
  const [ato, setAto] = useState<Ato>(atalho ? 'conferencia' : 'fisico')
  const [altura, setAltura] = useState(FISICO_INICIAL.altura)
  const [tom, setTom] = useState(FISICO_INICIAL.tom)
  const [cabelo, setCabelo] = useState(FISICO_INICIAL.cabelo)
  const [corte, setCorte] = useState(FISICO_INICIAL.corte)
  const [passoFisico, setPassoFisico] = useState(0)
  const [escolhas, setEscolhas] = useState<Escolhas>(atalho ? {
    cabeca: 'capacete_b',               // certa
    face: 'oculos_incolor',             // vale pouco
    corpo: 'vestimenta_fr',             // certa
    maos: 'luva_isolante_so',           // incompleta
    cintura: 'paraquedista_talabarte',  // certa
    pes: 'botina_biqueira',             // errada
    adorno: 'nada_no_corpo',            // certa
  } : {})
  const [vaga, setVaga] = useState<Vaga>('cabeca')
  /*
    QUANTAS PEÇAS JÁ FORAM REVELADAS na conferência.

    Mora aqui, e não dentro do painel, porque o BONECO precisa saber: a
    conferência é o pagamento da fase e acontecia inteira na coluna da
    direita, em cartões de texto, enquanto o personagem ficava parado à
    esquerda sem participar da própria avaliação. O ritmo estava certo —
    650 ms por peça, com som — e o destino do olho, errado.
  */
  const [reveladas, setReveladas] = useState(0)
  const [inspecionando, setInspecionando] = useState<string | null>(null)
  const [giro, setGiro] = useState(0)
  const arrasto = useRef<{ x: number; giro: number } | null>(null)

  const fisico: Fisico = useMemo(
    () => ({ altura, tom, cabelo, corte }), [altura, tom, cabelo, corte],
  )
  const escala = altura / ALTURA_BASE

  const vestindo = useMemo(() => {
    const ids = Object.values(escolhas).filter(Boolean) as string[]
    const cobre = ids.some((id) => PECAS.find((p) => p.id === id)?.substituiBase)
    if (cobre) return ids
    /*
      O TÊNIS ENTRA COM A ROUPA DE BASE, e sai quando a botina entra.

      Ele andava descalço a fase 1 inteira — montando o físico, escolhendo o
      tom de pele, e de novo no fim do turno. O calçado pessoal já existia no
      catálogo (`botinas(tipo='tenis')`) e nunca tinha sido usado fora dele.
    */
    const comBotina = ids.some((id) => id.startsWith('botina'))
    return comBotina
      ? ['base_roupa', ...ids]
      : ['base_roupa', 'base_tenis', ...ids]
  }, [escolhas])

  const completo = ORDEM_VAGAS.every((v) => escolhas[v])

  const aoDescer = useCallback((e: React.PointerEvent) => {
    arrasto.current = { x: e.clientX, giro }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }, [giro])

  const aoMover = useCallback((e: React.PointerEvent) => {
    if (!arrasto.current) return
    setGiro(arrasto.current.giro + (e.clientX - arrasto.current.x) * SENSIBILIDADE)
  }, [])

  const aoSubir = useCallback((e: React.PointerEvent) => {
    arrasto.current = null
    // o release lança para ponteiro não capturado; sem o try o handler morre
    try {
      ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    } catch { /* ponteiro já solto */ }
  }, [])

  /** Vestir: a peça entra no corpo e o armário pula para a próxima vaga vazia. */
  const vestir = useCallback((p: Peca) => {
    setEscolhas((a) => {
      const novas = { ...a, [p.vaga]: p.id }
      const proxima = ORDEM_VAGAS.find((v) => !novas[v])
      if (proxima) setVaga(proxima)
      return novas
    })
    setInspecionando(null)
    som.confirmar()
  }, [])

  const concluir = useCallback(() => {
    const registros: Registro[] = []
    let maximo = 0
    for (const v of ORDEM_VAGAS) {
      const opcoes = PECAS.filter((p) => p.vaga === v)
      maximo += opcoes.reduce((m, p) => Math.max(m, p.pontos), 0)
      const escolhida = opcoes.find((p) => p.id === escolhas[v])
      registros.push(escolhida ? {
        fase: 'vestiario', id: escolhida.id, titulo: escolhida.nome,
        veredito: escolhida.veredito, pontos: escolhida.pontos,
        porque: escolhida.porque, norma: escolhida.norma,
      } : {
        fase: 'vestiario', id: `sem_${v}`,
        titulo: `${VAGAS[v].nome}: sem proteção`,
        veredito: 'incorreta', pontos: 0,
        porque: `Você saiu para o serviço sem nada em ${VAGAS[v].nome.toLowerCase()}.`,
        norma: 'NR-6 — uso obrigatório de EPI na área',
      })
    }
    // as peças seguem para as fases seguintes: o motorista sentado veste o
    // que foi escolhido aqui
    aoConcluir(registros, fisico, maximo,
               Object.values(escolhas).filter(Boolean) as string[])
  }, [escolhas, fisico, aoConcluir])

  return (
    <div className="vestiario vest">
      <div
        className="vestiario-palco"
        onPointerDown={aoDescer}
        onPointerMove={aoMover}
        onPointerUp={aoSubir}
        onPointerCancel={aoSubir}
      >
        <Canvas
          dpr={DPR}
          shadows
          camera={{ position: [0.2, 1.62, 4.05], fov: 34 }}
          gl={{ antialias: !LEVE, toneMappingExposure: 1.0 }}
        >
          {/* Sem IBL, TODO METAL RENDERIZA PRETO: ele só tem reflexo para
              mostrar. O puxador do armário (metalness 0,85), as fivelas e a
              argola dorsal do cinturão sumiam numa massa chapada. Sem
              `background` — o cenário é fechado, o que se quer é o reflexo. */}
          <Environment files="./hdri/ceu.hdr" environmentIntensity={0.10} />
          <LuzVestiario />
          <Vestiario3D />
          <Personagem fisico={fisico} vestindo={vestindo} giro={giro} />
          {ato === 'conferencia' && (
            <MarcasVeredito
              escala={escala}
              giro={giro}
              escolhas={escolhas}
              reveladas={reveladas}
            />
          )}
          {ato === 'equipar' && (
            <Marcas
              escala={escala}
              giro={giro}
              escolhas={escolhas}
              vaga={vaga}
              abrir={(v) => { setVaga(v); setInspecionando(null); som.clique() }}
            />
          )}
          <OlharVestiario ato={ato} passo={passoFisico} />
          {/* raio curto: o vestiário é um ambiente de 2 a 3 m entre as peças,
              e o raio de rua espalha a oclusão até o personagem ficar sujo */}
          <Acabamento raio={0.9} />
        <PalcoPronto />
        </Canvas>
        <p className="vestiario-dica">Arraste para girar o personagem</p>
      </div>

      <aside className="vestiario-painel">
        {ato === 'fisico' && (
          <AtoFisico
            passo={passoFisico}
            altura={altura} setAltura={setAltura}
            tom={tom} setTom={setTom}
            cabelo={cabelo} setCabelo={setCabelo}
            corte={corte} setCorte={setCorte}
            voltar={() => setPassoFisico((n) => n - 1)}
            avancar={() => (passoFisico < 2
              ? setPassoFisico((n) => n + 1)
              : setAto('equipar'))}
          />
        )}

        {ato === 'equipar' && (
          <AtoEquipar
            vaga={vaga}
            escolhas={escolhas}
            inspecionando={inspecionando}
            abrirVaga={(v) => { setVaga(v); setInspecionando(null) }}
            inspecionar={(id) => { setInspecionando(id); som.clique() }}
            devolver={() => setInspecionando(null)}
            vestir={vestir}
            completo={completo}
            conferir={() => setAto('conferencia')}
            voltarAoFisico={() => setAto('fisico')}
          />
        )}

        {ato === 'conferencia' && (
          <AtoConferencia
            escolhas={escolhas}
            reveladas={reveladas}
            setReveladas={setReveladas}
            refazer={() => { setReveladas(0); setAto('equipar') }}
            sair={concluir}
          />
        )}
      </aside>
    </div>
  )
}

/* --------------------------------------------------------------- câmera */

/**
 * A câmera vai até o que está em jogo.
 *
 * No ato do físico ela fecha no rosto (tom de pele e cor de cabelo são
 * diferenças de poucos por cento: a dois metros ninguém vê o que escolheu).
 * No ato de equipar ela FICA PARADA no corpo inteiro de propósito — as sete
 * marcas têm de estar todas em quadro e clicáveis o tempo todo, e câmera que
 * se move a cada escolha tira marca da tela debaixo do dedo de quem joga.
 */
const OLHARES: Record<string, { de: [number, number, number]; para: [number, number, number] }> = {
  corpo: { de: [0.20, 1.62, 4.05], para: [0, 0.96, 0] },
  rosto: { de: [0.34, 1.86, 1.30], para: [0, 1.66, 0] },
  cabeca: { de: [0.16, 2.02, 1.18], para: [0, 1.74, 0] },
  equipar: { de: [0.62, 1.52, 3.85], para: [-0.06, 0.96, 0] },
  conferencia: { de: [0.26, 1.54, 3.60], para: [0, 0.98, 0] },
}

function OlharVestiario({ ato, passo }: { ato: Ato; passo: number }) {
  const chave = ato === 'equipar' ? 'equipar'
    : ato === 'conferencia' ? 'conferencia'
    : passo === 1 ? 'rosto' : passo === 2 ? 'cabeca' : 'corpo'
  const mira = useRef(new THREE.Vector3(...OLHARES.corpo.para))
  useFrame(({ camera }, dt) => {
    const o = OLHARES[chave]
    const t = Math.min(1, dt * 3.2)
    camera.position.lerp(new THREE.Vector3(...o.de), t)
    mira.current.lerp(new THREE.Vector3(...o.para), t)
    camera.lookAt(mira.current)
  })
  return null
}

/* ---------------------------------------------------------------- marcas */

/**
 * As sete marcas sobre o corpo. São HTML projetado pelo three (`Html` do
 * drei), não sprite: o alvo precisa ser do tamanho do dedo num totem, e
 * sprite dimensiona em metros de mundo — encolhe quando a câmera recua.
 *
 * Elas acompanham o giro do personagem porque estão DENTRO do grupo girado,
 * e somem quando passam para trás dele (`occlude` não serve aqui: o corpo é
 * decimado e a oclusão pisca na borda). Em vez disso a marca atrás fica com
 * opacidade baixa, o que também diz ao jogador que aquele lado está de costas.
 */
/**
 * O VEREDITO ACENDENDO NO CORPO, parte por parte.
 *
 * A mesma cadência do painel — 650 ms por peça, de cima para baixo — mas no
 * boneco. Verde para a peça certa, âmbar para a certa-mas-incompleta,
 * vermelho para a errada. Antes a conferência acontecia inteira numa coluna
 * de texto e o personagem assistia; agora é ele que é avaliado, na frente de
 * quem jogou.
 *
 * Reaproveita as posições de `MARCAS`, que são as mesmas sete vagas do ato de
 * equipar — a parte do corpo que acende é literalmente a que foi clicada.
 */
function MarcasVeredito({
  escala, giro, escolhas, reveladas,
}: {
  escala: number
  giro: number
  escolhas: Escolhas
  reveladas: number
}) {
  return (
    <group rotation={[0, giro, 0]} scale={escala}>
      {ORDEM_VAGAS.slice(0, reveladas).map((v) => {
        const p = MARCAS[v]
        const frente = Math.cos(giro) * p[2] - Math.sin(giro) * p[0]
        const atras = frente < -0.05 || Math.abs(Math.sin(giro)) > 0.75
        const peca = PECAS.find((x) => x.id === escolhas[v])
        const tom = peca?.veredito ?? 'incorreta'
        return (
          <Html key={v} position={p} center zIndexRange={[12, 2]}>
            <span
              className={`marca-veredito v-${tom}`}
              style={{ opacity: atras ? 0.22 : 1 }}
              title={VAGAS[v].nome}
            />
          </Html>
        )
      })}
    </group>
  )
}

function Marcas({
  escala, giro, escolhas, vaga, abrir,
}: {
  escala: number
  giro: number
  escolhas: Escolhas
  vaga: Vaga
  abrir: (v: Vaga) => void
}) {
  return (
    <group rotation={[0, giro, 0]} scale={escala}>
      {ORDEM_VAGAS.map((v) => {
        const p = MARCAS[v]
        // o quanto a marca está virada para a câmera: −1 de costas, +1 de
        // frente. A câmera está em +Z, então basta o Z do ponto já girado.
        const frente = Math.cos(giro) * p[2] - Math.sin(giro) * p[0]
        const lateral = Math.cos(giro) * p[0] + Math.sin(giro) * p[2]
        const atras = frente < -0.05 || Math.abs(Math.sin(giro)) > 0.75
        return (
          <Html key={v} position={p} center zIndexRange={[12, 2]}>
            <button
              className={`marca ${escolhas[v] ? 'cheia' : 'vazia'} ${vaga === v ? 'aberta' : ''}`}
              style={{ opacity: atras ? 0.22 : 1 }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); abrir(v) }}
              title={VAGAS[v].nome}
            >
              <span className="marca-ponto" />
              <span
                className="marca-nome"
                /* marca no lado direito da tela põe o nome à ESQUERDA dela,
                   senão o texto sai pela borda do palco */
                style={{ left: lateral > 0.3 ? 'auto' : undefined,
                         right: lateral > 0.3 ? '130%' : undefined }}
              >
                {VAGAS[v].nome}
              </span>
            </button>
          </Html>
        )
      })}
    </group>
  )
}

/* ------------------------------------------------------------ ato físico */

function AtoFisico({
  passo, altura, setAltura, tom, setTom, cabelo, setCabelo, corte, setCorte,
  voltar, avancar,
}: {
  passo: number
  altura: number; setAltura: (v: number) => void
  tom: [number, number, number]; setTom: (v: [number, number, number]) => void
  cabelo: [number, number, number]; setCabelo: (v: [number, number, number]) => void
  corte: CorteId; setCorte: (v: CorteId) => void
  voltar: () => void
  avancar: () => void
}) {
  const etapas = [
    {
      titulo: 'Qual a sua altura?',
      nota: 'É você quem vai para a rua daqui a pouco. Deixe o boneco parecido.',
      corpo: (
        <div className="opcoes">
          {ALTURAS.map((a) => (
            <button
              key={a.id}
              className={`opcao ${altura === a.metros ? 'ativa' : ''}`}
              onClick={() => setAltura(a.metros)}
            >
              {a.nome}
            </button>
          ))}
        </div>
      ),
    },
    {
      titulo: 'Tom de pele',
      nota: 'A câmera foi para o rosto: a diferença entre um tom e o seguinte é pequena de perto e invisível de longe.',
      corpo: (
        <div className="tons">
          {TONS.map((t) => (
            <button
              key={t.id}
              className={`tom ${tom === t.tom ? 'ativa' : ''}`}
              style={{ background: t.amostra }}
              onClick={() => setTom(t.tom)}
              aria-label={t.nome}
              title={t.nome}
            />
          ))}
        </div>
      ),
    },
    {
      titulo: 'Cor do cabelo',
      // A nota aqui dizia "o corte é o mesmo — raspado": texto de quando só
      // havia um corte. Os três existem desde 17/10 e a etapa seguinte
      // escolhe entre eles — a tela estava DESMENTINDO o próprio jogo, e foi
      // por isso que o cliente perguntou de novo onde estavam os três cortes.
      nota: 'A cor; o corte vem na etapa seguinte.',
      corpo: (
        <div className="tons">
          {CABELOS.map((c) => (
            <button
              key={c.id}
              className={`tom ${cabelo === c.cor ? 'ativa' : ''}`}
              style={{ background: c.amostra }}
              onClick={() => setCabelo(c.cor)}
              aria-label={c.nome}
              title={c.nome}
            />
          ))}
        </div>
      ),
    },
    {
      titulo: 'Corte do cabelo',
      nota: 'Três cortes, e são peças diferentes de verdade. Debaixo do capacete os três ficam iguais: sobram nuca e costeleta.',
      corpo: (
        <div className="opcoes">
          {CORTES.map((c) => (
            <button
              key={c.id}
              className={`opcao ${corte === c.id ? 'ativa' : ''}`}
              onClick={() => setCorte(c.id)}
            >
              {c.nome}
            </button>
          ))}
        </div>
      ),
    },
  ]
  const atual = etapas[Math.max(0, Math.min(etapas.length - 1, passo))]
  const ultimo = passo >= etapas.length - 1

  return (
    <>
      <header className="painel-topo">
        <p className="sobretitulo">Fase 1 · Vestiário · {passo + 1} de {etapas.length}</p>
        <h2>{atual.titulo}</h2>
        <p className="painel-texto">{atual.nota}</p>
        <ol className="trilha" aria-label="Progresso da montagem">
          {etapas.map((e, i) => (
            <li key={e.titulo} className={i === passo ? 'atual' : i < passo ? 'feita' : ''} />
          ))}
        </ol>
      </header>

      <section className="grupo cresce">{atual.corpo}</section>

      <div className="painel-rodape">
        <div className="linha-botoes">
          <button className="btn btn-fraco" onClick={voltar} disabled={passo === 0}>
            Voltar
          </button>
          <button className="btn btn-grande" onClick={avancar}>
            {ultimo ? 'Abrir o armário' : 'Próximo'}
          </button>
        </div>
      </div>
    </>
  )
}

/* ---------------------------------------------------------- ato equipar */

function AtoEquipar({
  vaga, escolhas, inspecionando, abrirVaga, inspecionar, devolver, vestir,
  completo, conferir, voltarAoFisico,
}: {
  vaga: Vaga
  escolhas: Escolhas
  inspecionando: string | null
  abrirVaga: (v: Vaga) => void
  inspecionar: (id: string) => void
  devolver: () => void
  vestir: (p: Peca) => void
  completo: boolean
  conferir: () => void
  voltarAoFisico: () => void
}) {
  const opcoes = pecasDaVaga(vaga)
  const peca = inspecionando ? PECAS.find((p) => p.id === inspecionando) : null
  const quantos = ORDEM_VAGAS.filter((v) => escolhas[v]).length

  return (
    <>
      <header className="painel-topo">
        <p className="sobretitulo">Fase 1 · Vestiário · armário</p>
        <h2>{peca ? 'Na bancada' : VAGAS[vaga].nome}</h2>
        <p className="painel-texto">
          {peca
            ? 'Vire a peça na mão e leia a etiqueta antes de vestir.'
            : 'Clique numa parte do corpo para trocar de vaga. Tem mais peça no armário do que você precisa.'}
        </p>
        <p className="vest-data">Hoje é {HOJE_TEXTO}</p>
      </header>

      {!peca && (
        <nav className="abas" aria-label="Partes do corpo">
          {ORDEM_VAGAS.map((v) => (
            <button
              key={v}
              className={`aba ${v === vaga ? 'ativa' : ''} ${escolhas[v] ? 'feita' : ''}`}
              onClick={() => abrirVaga(v)}
            >
              {VAGAS[v].nome}
            </button>
          ))}
        </nav>
      )}

      {peca ? (
        <Bancada peca={peca} devolver={devolver} vestir={() => vestir(peca)} />
      ) : (
        <ul className="arara">
          {opcoes.map((p) => (
            <li key={p.id}>
              <button
                className={`item ${escolhas[vaga] === p.id ? 'ativa' : ''}`}
                onClick={() => inspecionar(p.id)}
                aria-label={`${p.nome} — ${p.descricao}`}
              >
                <span className="item-icone"><IconePeca id={p.id} /></span>
                <span className="item-texto">
                  <span className="item-nome">{p.nome}</span>
                  <span className="item-desc">{p.descricao}</span>
                </span>
                <span className="item-acao">
                  {escolhas[vaga] === p.id ? 'vestido' : 'inspecionar'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!peca && (
        <div className="painel-rodape">
          <p className="vest-contagem">
            <b>{quantos}</b> de {ORDEM_VAGAS.length} partes resolvidas
            {!completo && ' — falta fechar o conjunto antes de sair'}
          </p>
          <div className="linha-botoes">
            <button className="btn btn-fraco" onClick={voltarAoFisico}>Físico</button>
            <button className="btn btn-grande" onClick={conferir} disabled={!completo}>
              Conferir o EPI
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * A bancada de inspeção — o miolo novo da fase.
 *
 * Aqui não há nenhum sinal de certo ou errado: nem cor, nem ícone, nem ordem.
 * O que há é o que está escrito na peça. Pintar de vermelho a linha do ensaio
 * vencido seria entregar a resposta e devolver a fase ao gabarito de onde ela
 * saiu — a graça é o jogador comparar a data com o "hoje" do cabeçalho.
 */
function Bancada({
  peca, devolver, vestir,
}: { peca: Peca; devolver: () => void; vestir: () => void }) {
  const e = ETIQUETAS[peca.id]
  return (
    <>
      <section className="bancada">
        <div className="bancada-peca">
          <span className="bancada-icone"><IconePeca id={peca.id} /></span>
          <div>
            <h3>{peca.nome}</h3>
            <p className="painel-texto">{peca.descricao}</p>
          </div>
        </div>

        {e && (
          <dl className="etiqueta">
            <div>
              <dt>Certificado de aprovação</dt>
              <dd>{e.ca ?? 'Não tem CA'}</dd>
            </div>
            <div>
              <dt>Classe declarada</dt>
              <dd>{e.classe}</dd>
            </div>
            {e.ensaioMeses !== undefined && (
              <div>
                <dt>Ensaio elétrico</dt>
                <dd>válido até {dataDoEnsaio(e.ensaioMeses, HOJE)}</dd>
              </div>
            )}
            <div>
              <dt>Estado da peça</dt>
              <dd>{e.estado}</dd>
            </div>
          </dl>
        )}
      </section>

      <div className="painel-rodape">
        <div className="linha-botoes">
          <button className="btn btn-fraco" onClick={devolver}>Devolver</button>
          <button className="btn btn-grande" onClick={vestir}>Vestir esta</button>
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------ ato conferência */

/**
 * A conferência de EPI: o veredito desce o corpo item a item, 650 ms por
 * parte, com o som de cada um. É o pagamento da fase — e, como vem DEPOIS de
 * o conjunto estar fechado, é avaliação e não gabarito.
 *
 * O jogador ainda pode voltar e trocar peça: quem errou a luva e entendeu por
 * quê deve poder sair para a rua com a luva certa. O relatório final lê o
 * conjunto com que ele efetivamente saiu.
 */
function AtoConferencia({
  escolhas, reveladas, setReveladas, refazer, sair,
}: {
  escolhas: Escolhas
  reveladas: number
  setReveladas: React.Dispatch<React.SetStateAction<number>>
  refazer: () => void
  sair: () => void
}) {
  const linhas = useMemo(
    () => ORDEM_VAGAS.map((v) => ({
      vaga: v, peca: PECAS.find((p) => p.id === escolhas[v]),
    })),
    [escolhas],
  )
  useEffect(() => {
    if (reveladas >= linhas.length) return
    const t = setTimeout(() => {
      const p = linhas[reveladas].peca
      som.veredito(p?.veredito === 'correta')
      setReveladas((n) => n + 1)
    }, reveladas === 0 ? 260 : 650)
    return () => clearTimeout(t)
  }, [reveladas, linhas])

  const pronto = reveladas >= linhas.length
  const certas = linhas.slice(0, reveladas)
    .filter((l) => l.peca?.veredito === 'correta').length

  return (
    <>
      <header className="painel-topo">
        <p className="sobretitulo">Fase 1 · Conferência de EPI</p>
        <h2>Antes de sair</h2>
        <p className="painel-texto">
          O encarregado confere o conjunto de cima a baixo. Agora, sim, as
          respostas.
        </p>
      </header>

      <ul className="conferencia">
        {linhas.slice(0, reveladas).map(({ vaga, peca }) => (
          <li key={vaga} className={`conf-${peca?.veredito ?? 'incorreta'}`}>
            <p className="conf-vaga">{VAGAS[vaga].nome}</p>
            <p className="conf-peca">{peca?.nome ?? 'Sem proteção'}</p>
            <p className="conf-selo">
              {peca?.veredito === 'correta' ? 'Aprovado'
                : peca?.veredito === 'incompleta' ? 'Protege, mas não basta'
                : 'Reprovado'}
            </p>
            <p className="conf-porque">{peca?.porque}</p>
            <p className="conf-norma">{peca?.norma}</p>
          </li>
        ))}
      </ul>

      <div className="painel-rodape">
        <p className="vest-contagem">
          <b>{certas}</b> de {linhas.length} partes aprovadas
        </p>
        <div className="linha-botoes">
          <button className="btn btn-fraco" onClick={refazer} disabled={!pronto}>
            Trocar peça
          </button>
          <button className="btn btn-grande" onClick={sair} disabled={!pronto}>
            Sair para o serviço
          </button>
        </div>
      </div>
    </>
  )
}
