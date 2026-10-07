/**
 * Fase 1 — Vestiário.
 *
 * Duas etapas na mesma tela: montar o físico do personagem e escolher o EPI
 * numa arara com mais peça errada do que certa. O personagem aparece de corpo
 * inteiro e veste na hora — o jogador tem de ver no que ele se transformou
 * antes de sair para o serviço.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Acabamento } from '../cena/Acabamento'
import { Environment } from '@react-three/drei'
import Personagem, { type Fisico } from '../cena/Personagem'
import { ALTURAS, CABELOS, TONS, FISICO_INICIAL } from '../conteudo/fisico'
import { PECAS, VAGAS, pecasDaVaga, type Peca, type Vaga } from '../conteudo/epi'
import { IconePeca } from '../icones'
import { som } from '../som'
import type { Registro } from '../conteudo/pontuacao'

const ORDEM_VAGAS: Vaga[] = [
  'cabeca', 'face', 'corpo', 'maos', 'pes', 'cintura', 'adorno',
]

/** Quanto o personagem gira por pixel arrastado. */
const SENSIBILIDADE = 0.011

type Escolhas = Partial<Record<Vaga, string>>

export default function Vestiario({
  aoConcluir,
}: {
  aoConcluir: (
    registros: Registro[], fisico: Fisico, maximo: number, vestindo: string[],
  ) => void
}) {
  const [etapa, setEtapa] = useState<'fisico' | 'epi'>('fisico')
  const [altura, setAltura] = useState(FISICO_INICIAL.altura)
  const [tom, setTom] = useState(FISICO_INICIAL.tom)
  const [cabelo, setCabelo] = useState(FISICO_INICIAL.cabelo)
  const [passoFisico, setPassoFisico] = useState(0)
  const [escolhas, setEscolhas] = useState<Escolhas>({})
  const [passo, setPasso] = useState(0)
  const vaga = ORDEM_VAGAS[passo]
  const [giro, setGiro] = useState(0)
  const arrasto = useRef<{ x: number; giro: number } | null>(null)

  const fisico: Fisico = useMemo(
    () => ({ altura, tom, cabelo }), [altura, tom, cabelo],
  )
  const vestindo = useMemo(() => {
    const ids = Object.values(escolhas).filter(Boolean) as string[]
    const cobre = ids.some(
      (id) => PECAS.find((p) => p.id === id)?.substituiBase,
    )
    return cobre ? ids : ['base_roupa', ...ids]
  }, [escolhas])


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

  function concluir() {
    const registros: Registro[] = []
    let maximo = 0
    for (const v of ORDEM_VAGAS) {
      const opcoes = PECAS.filter((p) => p.vaga === v)
      maximo += opcoes.reduce((m, p) => Math.max(m, p.pontos), 0)
      const escolhida = opcoes.find((p) => p.id === escolhas[v])
      if (escolhida) {
        registros.push({
          fase: 'vestiario',
          id: escolhida.id,
          titulo: escolhida.nome,
          veredito: escolhida.veredito,
          pontos: escolhida.pontos,
          porque: escolhida.porque,
          norma: escolhida.norma,
        })
      } else {
        registros.push({
          fase: 'vestiario',
          id: `sem_${v}`,
          titulo: `${VAGAS[v].nome}: sem proteção`,
          veredito: 'incorreta',
          pontos: 0,
          porque: `Você saiu para o serviço sem nada em ${VAGAS[v].nome.toLowerCase()}.`,
          norma: 'NR-6 — uso obrigatório de EPI na área',
        })
      }
    }
    // as peças seguem para as fases seguintes: o motorista sentado veste o
    // que foi escolhido aqui
    aoConcluir(registros, fisico, maximo,
               Object.values(escolhas).filter(Boolean) as string[])
  }

  return (
    <div className="vestiario">
      <div
        className="vestiario-palco"
        onPointerDown={aoDescer}
        onPointerMove={aoMover}
        onPointerUp={aoSubir}
        onPointerCancel={aoSubir}
      >
        <Canvas
          dpr={[1, 1.5]}
          shadows
          camera={{ position: [0, 1.15, 3.1], fov: 34 }}
          gl={{ antialias: true, toneMappingExposure: 1.0 }}
        >
          {/* O HDRI é um céu aberto: a irradiância dele é altíssima, e acima
              de ~0,15 ele lava a cena inteira — tecido de albedo 0,05 chega a
              parecer cinza claro. Aqui ele serve só para dar reflexo; quem
              ilumina são as três direcionais. */}
          <Environment files="./hdri/ceu.hdr" environmentIntensity={0.10} />
          <directionalLight
            position={[-1.6, 3.0, 2.6]}
            intensity={3.6}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-1.4}
            shadow-camera-right={1.4}
            shadow-camera-top={2.4}
            shadow-camera-bottom={-0.2}
          />
          <directionalLight position={[2.4, 1.4, 1.2]} intensity={1.1} color="#cfe0ff" />
          <directionalLight position={[0.8, 2.2, -2.4]} intensity={1.9} color="#ffeccd" />
          <group position={[0, -0.9, 0]}>
            <Personagem fisico={fisico} vestindo={vestindo} giro={giro} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <circleGeometry args={[2.4, 48]} />
              <meshStandardMaterial color="#141a22" roughness={0.9} />
            </mesh>
          </group>
          <OlharFisico alvo={etapa === 'fisico' ? passoFisico : 0} />
          <Acabamento raio={0.35} />
        </Canvas>
        <p className="vestiario-dica">Arraste para girar o personagem</p>
      </div>

      <aside className="vestiario-painel">
        {etapa === 'fisico' ? (
          <EtapaFisico
            passo={passoFisico}
            altura={altura}
            setAltura={setAltura}
            tom={tom}
            setTom={setTom}
            cabelo={cabelo}
            setCabelo={setCabelo}
            voltar={() => setPassoFisico((n) => n - 1)}
            avancar={() => (passoFisico < 2
              ? setPassoFisico((n) => n + 1)
              : setEtapa('epi'))}
          />
        ) : (
          <EtapaEpi
            passo={passo}
            vaga={vaga}
            escolhas={escolhas}
            escolher={(v, id) => setEscolhas((a) => ({ ...a, [v]: id }))}
            voltar={() => (passo === 0 ? setEtapa('fisico') : setPasso(passo - 1))}
            avancar={() => setPasso(passo + 1)}
            concluir={concluir}
          />
        )}
      </aside>
    </div>
  )
}

/**
 * A câmera vai até o que está sendo escolhido: corpo inteiro para a altura,
 * rosto para o tom de pele e para o cabelo.
 *
 * É o que faz a montagem parecer viva em vez de um formulário com um boneco
 * ao lado — e tem razão prática junto: tom de pele e cor de cabelo são
 * diferenças de poucos por cento, e a dois metros de distância o jogador não
 * vê o que acabou de escolher.
 */
const OLHARES: { de: [number, number, number]; para: [number, number, number] }[] = [
  { de: [0, 1.15, 3.10], para: [0, 0.10, 0] },
  { de: [0.34, 0.96, 1.30], para: [0, 0.76, 0] },
  { de: [0.16, 1.16, 1.18], para: [0, 0.84, 0] },
]

function OlharFisico({ alvo }: { alvo: number }) {
  const mira = useRef(new THREE.Vector3(...OLHARES[0].para))
  useFrame(({ camera }, dt) => {
    const o = OLHARES[Math.max(0, Math.min(OLHARES.length - 1, alvo))]
    const passo = Math.min(1, dt * 3.2)
    camera.position.lerp(new THREE.Vector3(...o.de), passo)
    mira.current.lerp(new THREE.Vector3(...o.para), passo)
    camera.lookAt(mira.current)
  })
  return null
}

function EtapaFisico({
  passo, altura, setAltura, tom, setTom, cabelo, setCabelo, voltar, avancar,
}: {
  passo: number
  altura: number
  setAltura: (v: number) => void
  tom: [number, number, number]
  setTom: (v: [number, number, number]) => void
  cabelo: [number, number, number]
  setCabelo: (v: [number, number, number]) => void
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
      titulo: 'Cabelo',
      nota: 'O corte é o mesmo — raspado, que é o que cabe embaixo do capacete.',
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
  ]
  const atual = etapas[Math.max(0, Math.min(etapas.length - 1, passo))]
  const ultimo = passo >= etapas.length - 1

  return (
    <>
      <header className="painel-topo">
        <p className="sobretitulo">
          Fase 1 · Vestiário · {passo + 1} de {etapas.length}
        </p>
        <h2>{atual.titulo}</h2>
        <p className="painel-texto">{atual.nota}</p>
        <ol className="trilha" aria-label="Progresso da montagem">
          {etapas.map((e, i) => (
            <li key={e.titulo} className={i === passo ? 'atual' : i < passo ? 'feita' : ''} />
          ))}
        </ol>
      </header>

      <section className="grupo">{atual.corpo}</section>

      <div className="painel-rodape">
        <div className="linha-botoes">
          <button className="btn btn-fraco" onClick={voltar} disabled={passo === 0}>
            Voltar
          </button>
          <button className="btn btn-grande" onClick={avancar}>
            {ultimo ? 'Ir para a arara de EPI' : 'Próximo'}
          </button>
        </div>
      </div>
    </>
  )
}

function EtapaEpi({
  passo, vaga, escolhas, escolher, voltar, avancar, concluir,
}: {
  passo: number
  vaga: Vaga
  escolhas: Escolhas
  escolher: (v: Vaga, id: string) => void
  voltar: () => void
  avancar: () => void
  concluir: () => void
}) {
  const opcoes = pecasDaVaga(vaga)
  const escolhida = opcoes.find((p) => p.id === escolhas[vaga])
  const ultimo = passo === ORDEM_VAGAS.length - 1

  return (
    <>
      <header className="painel-topo">
        <p className="sobretitulo">
          Fase 1 · Vestiário · {passo + 1} de {ORDEM_VAGAS.length}
        </p>
        <h2>{VAGAS[vaga].nome}</h2>
        <p className="painel-texto">
          {escolhida
            ? 'Veja por que essa escolha vale o que vale, e siga.'
            : 'Tem mais peça na arara do que você precisa. Escolha uma.'}
        </p>
        <ol className="trilha" aria-label="Progresso do vestiário">
          {ORDEM_VAGAS.map((v, i) => (
            <li
              key={v}
              className={
                i === passo ? 'atual' : escolhas[v] ? 'feita' : ''
              }
              title={VAGAS[v].nome}
            />
          ))}
        </ol>
      </header>

      <ul className="arara">
        {opcoes.map((p) => (
          <ItemArara
            key={p.id}
            peca={p}
            escolhida={escolhas[vaga] === p.id}
            travada={!!escolhida}
            escolher={() => {
              escolher(vaga, p.id)
              som.veredito(p.veredito === 'correta')
            }}
          />
        ))}
      </ul>

      {/*
        O veredito aparece AQUI, no vestiário, e só aqui. Trajeto e ocorrência
        seguem em silêncio até o relatório, como combinado: aquilo é prova.
        Esta fase é onde se ENSINA o EPI, e não se reprova alguém em EPI antes
        de ensinar. A escolha trava junto com o veredito — explicação que ainda
        deixa trocar de resposta é gabarito, não ensino.
      */}
      {escolhida && (
        <section className={`veredito veredito-${escolhida.veredito}`}>
          <p className="veredito-selo">
            {escolhida.veredito === 'correta' ? 'Escolha certa'
              : escolhida.veredito === 'incompleta' ? 'Protege, mas não basta'
              : 'Não protege'}
          </p>
          <p className="veredito-porque">{escolhida.porque}</p>
          <p className="veredito-norma">{escolhida.norma}</p>
        </section>
      )}

      <div className="painel-rodape">
        <div className="linha-botoes">
          <button className="btn btn-fraco" onClick={voltar}>
            {passo === 0 ? 'Voltar ao físico' : 'Voltar'}
          </button>
          <button
            className="btn btn-grande"
            onClick={ultimo ? concluir : avancar}
            disabled={!escolhida}
          >
            {ultimo ? 'Sair para o serviço' : 'Próximo'}
          </button>
        </div>
      </div>
    </>
  )
}

function ItemArara({
  peca, escolhida, travada, escolher,
}: {
  peca: Peca
  escolhida: boolean
  travada: boolean
  escolher: () => void
}) {
  return (
    <li>
      <button
        className={`item ${escolhida ? 'ativa' : ''} ${travada && !escolhida ? 'recusada' : ''}`}
        onClick={escolher}
        disabled={travada}
        aria-pressed={escolhida}
        aria-label={`${peca.nome} — ${peca.descricao}`}
      >
        <span className="item-icone"><IconePeca id={peca.id} /></span>
        <span className="item-texto">
          <span className="item-nome">{peca.nome}</span>
          <span className="item-desc">{peca.descricao}</span>
        </span>
      </button>
    </li>
  )
}
