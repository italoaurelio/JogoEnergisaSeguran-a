/**
 * Fase 3 — a ocorrência, em três etapas na mesma cena.
 *
 * 3a  chegar e isolar a área (decisões, com a peça aparecendo na cena)
 * 3b  separar o equipamento para ESTA falha
 * 3c  executar o reparo na ordem certa
 *
 * A ordem do reparo vale mais do que o resto da fase somado, porque é a parte
 * que mata quando invertida: aterrar antes de constatar ausência de tensão é
 * encostar um cabo de cobre numa rede que pode estar viva.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { som } from '../som'
import { Canvas } from '@react-three/fiber'
import { Acabamento } from '../cena/Acabamento'
import { Environment } from '@react-three/drei'
import {
  CameraDaCena, CenaOcorrencia, LuzOcorrencia, type Colocada, type Vista,
} from '../cena/Ocorrencia3D'
import {
  CHEGADA, FERRAMENTAL, MAXIMO_CHEGADA, MAXIMO_FERRAMENTAL, MAXIMO_REPARO,
  OCORRENCIA, PASSOS, type DecisaoChegada,
} from '../conteudo/ocorrencia'
import type { Registro } from '../conteudo/pontuacao'

const Q = Math.PI / 2

/** Onde cada escolha põe o caminhão. A rua corre no eixo X. */
const POSICOES_VEICULO: Record<string, Colocada> = {
  protegendo: { peca: 'oc_veiculo', pos: [-8.5, 0, 2.6] },
  depois: { peca: 'oc_veiculo', pos: [8.5, 0, 2.6] },
  calcada: { peca: 'oc_veiculo', pos: [-5.5, 0, -2.9] },
}

/**
 * Posição de espera: na pista, bem antes da área, no sentido do fluxo. É de
 * onde o caminhão "chega" — e é o que dá ao jogador a escala e o sentido do
 * trânsito para responder a primeira pergunta.
 */
const CHEGANDO: Colocada = { peca: 'oc_veiculo', pos: [-19.5, 0, 2.6] }

const SINALIZACAO: Record<string, Colocada[]> = {
  compativel: [
    { peca: 'oc_cavalete', pos: [-27, 0, 3.4], giro: Q },
    { peca: 'oc_cone', pos: [-22, 0, 3.5] },
    { peca: 'oc_cone', pos: [-18, 0, 3.1] },
    { peca: 'oc_cone', pos: [-14, 0, 2.7] },
  ],
  colado: [
    { peca: 'oc_cavalete', pos: [-11.8, 0, 3.0], giro: Q },
    { peca: 'oc_cone', pos: [-11.2, 0, 2.6] },
  ],
  nada: [],
}

/** A fita sai do Blender com 3 m ao longo de −Z; esticar é mais barato. */
const AREA: Record<string, Colocada[]> = {
  cercada: [
    { peca: 'oc_cone', pos: [2.6, 0, 3.0] },
    { peca: 'oc_cone', pos: [-2.6, 0, 3.0] },
    { peca: 'oc_cone', pos: [-2.6, 0, -1.8] },
    { peca: 'oc_cone', pos: [2.6, 0, -1.8] },
    { peca: 'oc_fita', pos: [2.6, 0.55, 3.0], escala: [1, 1, 1.6] },
    { peca: 'oc_fita', pos: [-2.6, 0.55, 3.0], escala: [1, 1, 1.6] },
    { peca: 'oc_fita', pos: [2.6, 0.55, 3.0], giro: Q, escala: [1, 1, 1.74] },
    { peca: 'oc_fita', pos: [2.6, 0.55, -1.8], giro: Q, escala: [1, 1, 1.74] },
  ],
  so_cones: [
    { peca: 'oc_cone', pos: [1.4, 0, 1.2] },
    { peca: 'oc_cone', pos: [-1.4, 0, 1.2] },
  ],
  nenhuma: [],
}

/** Ferramental e escada aparecem junto do poste a partir da etapa 3b. */
const APOIO: Colocada[] = [
  { peca: 'oc_caixa', pos: [-1.9, 0, -1.1], giro: 0.3 },
  // A escada é uma peça de 4,63 m centrada no próprio meio. Com giro 0 e
  // y 2,3 ela ficava EM PÉ, perfeitamente vertical, equilibrada no nada —
  // é a "escada que não encosta no poste" do retorno.
  //
  // Agora: pé em (0,85, 0, −1,15), topo em (0,15, 4,45, −0,20), ou seja
  // encostando no poste 25 cm fora do eixo dele. O vetor pé→topo tem 4,60 m,
  // que é o comprimento da peça, e faz 15° com a vertical — o ângulo de
  // ~75° com o chão que a NR-18 pede para escada de encosto.
  { peca: 'oc_escada', pos: [0.50, 2.253, -0.675], giro: 0.928,
    tombo: [0, 0.257] },
]

const VISTA_FERRAMENTAL: Vista = { de: [-4.2, 2.3, 3.4], para: [-1.6, 0.5, -0.8], lente: 30 }
const VISTA_REPARO: Vista = { de: [5.0, 4.6, 7.2], para: [0.3, 6.4, 0.1], lente: 40 }

type Etapa = 'briefing' | 'chegada' | 'ferramental' | 'reparo'

export default function Fase3Ocorrencia({
  aoConcluir,
}: {
  aoConcluir: (registros: Registro[], maximo: number) => void
}) {
  useEffect(() => { som.ambiente(true); return () => som.ambiente(false) }, [])
  const [etapa, setEtapa] = useState<Etapa>('briefing')
  const [indice, setIndice] = useState(0)
  const [escolhas, setEscolhas] = useState<Record<string, string>>({})
  const [retorno, setRetorno] = useState<string | null>(null)
  const [kit, setKit] = useState<string[]>([])
  const [ordem, setOrdem] = useState<string[]>([])
  const [erradosNaOrdem, setErrados] = useState<string[]>([])

  const colocadas = useMemo<Colocada[]>(() => {
    const saida: Colocada[] = []
    const v = escolhas.posicao_veiculo
    if (v && POSICOES_VEICULO[v]) saida.push(POSICOES_VEICULO[v])
    // Antes de escolher, o caminhão aparece PARADO ATRÁS, recém-chegado. Sem
    // isto a pergunta "onde parar o caminhão?" vinha sem caminhão nenhum em
    // quadro: o jogador via rua e casas e tinha de imaginar o veículo, o
    // tamanho dele e de que lado o trânsito vem. Quem não vê, chuta.
    else if (etapa === 'chegada') saida.push(CHEGANDO)
    const s = escolhas.distancia_sinalizacao
    if (s) saida.push(...(SINALIZACAO[s] ?? []))
    const a = escolhas.area_trabalho
    if (a) saida.push(...(AREA[a] ?? []))
    if (etapa === 'ferramental' || etapa === 'reparo') saida.push(...APOIO)
    return saida
  }, [escolhas, etapa])

  const vista: Vista = useMemo(() => {
    if (etapa === 'briefing') return { de: [-13, 6.5, 12], para: [0, 4.0, 0], lente: 30 }
    if (etapa === 'chegada') return CHEGADA[indice].camera
    if (etapa === 'ferramental') return VISTA_FERRAMENTAL
    return VISTA_REPARO
  }, [etapa, indice])

  const concluir = useCallback(() => {
    const registros: Registro[] = []

    for (const d of CHEGADA) {
      const op = d.opcoes.find((o) => o.id === escolhas[d.id])
      registros.push({
        fase: 'ocorrencia', id: d.id, titulo: d.nome,
        veredito: op?.certa ? 'correta' : 'incorreta',
        pontos: op?.certa ? d.pontos : 0,
        porque: op?.porque ?? 'Decisão não tomada.',
        norma: d.norma,
      })
    }

    for (const f of FERRAMENTAL) {
      const levou = kit.includes(f.id)
      if (f.necessaria) {
        registros.push({
          fase: 'ocorrencia', id: f.id, titulo: `Levou: ${f.nome}`,
          veredito: levou ? 'correta' : 'incorreta',
          pontos: levou ? f.pontos : 0,
          porque: levou ? f.porque : `Ficou para trás. ${f.porque}`,
          norma: f.norma,
        })
      } else if (levou) {
        registros.push({
          fase: 'ocorrencia', id: f.id, titulo: `Levou indevidamente: ${f.nome}`,
          veredito: 'incorreta', pontos: f.pontos, porque: f.porque,
          norma: f.norma,
        })
      }
    }

    for (let i = 0; i < PASSOS.length; i++) {
      const esperado = PASSOS[i]
      const acertou = ordem[i] === esperado.id
      registros.push({
        fase: 'ocorrencia', id: `passo_${esperado.id}`,
        titulo: `Passo ${i + 1}: ${esperado.texto}`,
        veredito: acertou ? 'correta' : 'incorreta',
        pontos: acertou ? 6 : 0,
        porque: acertou
          ? esperado.porque
          : `Este era o passo ${i + 1}. ${esperado.porque}`,
        norma: esperado.norma,
      })
    }

    aoConcluir(registros, MAXIMO_CHEGADA + MAXIMO_FERRAMENTAL + MAXIMO_REPARO)
  }, [escolhas, kit, ordem, aoConcluir])

  return (
    <div className="vestiario">
      <div className="vestiario-palco">
        <Canvas dpr={[1, 1.5]} shadows camera={{ position: [-16, 8, 18], fov: 40 }}>
          <Environment files="./hdri/ceu.hdr" environmentIntensity={0.22} />
          <LuzOcorrencia />
          <CenaOcorrencia colocadas={colocadas} />
          <CameraDaCena vista={vista} />
          <Acabamento raio={2.2} />
        </Canvas>
      </div>

      <aside className="vestiario-painel">
        {etapa === 'briefing' && (
          <Briefing comecar={() => setEtapa('chegada')} />
        )}

        {etapa === 'chegada' && (
          <Chegada
            decisao={CHEGADA[indice]}
            escolhida={escolhas[CHEGADA[indice].id]}
            retorno={retorno}
            escolher={(id) => {
              setEscolhas((a) => ({ ...a, [CHEGADA[indice].id]: id }))
              setRetorno(id)
            }}
            avancar={() => {
              setRetorno(null)
              if (indice + 1 < CHEGADA.length) setIndice(indice + 1)
              else setEtapa('ferramental')
            }}
            ultimo={indice + 1 === CHEGADA.length}
          />
        )}

        {etapa === 'ferramental' && (
          <Ferramental
            kit={kit}
            alternar={(id) =>
              setKit((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))
            }
            avancar={() => setEtapa('reparo')}
          />
        )}

        {etapa === 'reparo' && (
          <Reparo
            ordem={ordem}
            errados={erradosNaOrdem}
            escolher={(id) => {
              const esperado = PASSOS[ordem.length]
              if (id !== esperado.id) setErrados((a) => [...a, id])
              setOrdem((a) => [...a, id])
              // o estalo da chave marca que a manobra foi feita; não diz se
              // foi na ordem certa, que é o que esta fase está avaliando
              som.chave()
            }}
            concluir={concluir}
          />
        )}
      </aside>
    </div>
  )
}

function Briefing({ comecar }: { comecar: () => void }) {
  return (
    <>
      <header className="painel-topo">
        <p className="sobretitulo">Fase 3 · Ocorrência</p>
        <h2>{OCORRENCIA.titulo}</h2>
        <p className="painel-texto">{OCORRENCIA.endereco}</p>
      </header>
      <section className="grupo cresce">
        <h3>O chamado</h3>
        <p className="painel-texto">{OCORRENCIA.relato}</p>
        <h3 style={{ marginTop: 18 }}>O que você encontrou</h3>
        <p className="painel-texto">{OCORRENCIA.diagnostico}</p>
      </section>
      <div className="painel-rodape">
        <button className="btn btn-grande" onClick={comecar}>Chegar ao local</button>
      </div>
    </>
  )
}

function Chegada({
  decisao, escolhida, retorno, escolher, avancar, ultimo,
}: {
  decisao: DecisaoChegada
  escolhida?: string
  retorno: string | null
  escolher: (id: string) => void
  avancar: () => void
  ultimo: boolean
}) {
  const op = decisao.opcoes.find((o) => o.id === retorno)
  return (
    <>
      <header className="painel-topo">
        <p className="sobretitulo">Fase 3 · Chegada</p>
        <h2>{decisao.nome}</h2>
        <p className="painel-texto">{decisao.pergunta}</p>
      </header>

      {!op ? (
        <section className="grupo cresce">
          <div className="opcoes coluna">
            {decisao.opcoes.map((o) => (
              <button
                key={o.id}
                className={`opcao alta ${escolhida === o.id ? 'ativa' : ''}`}
                onClick={() => escolher(o.id)}
              >
                {o.texto}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="grupo cresce">
            <h3 className={op.certa ? 'nota-ok' : 'nota-ruim'}>
              {op.certa ? 'Decisão correta' : 'Decisão errada'}
            </h3>
            <p className="painel-texto">{op.porque}</p>
            <p className="norma">{decisao.norma}</p>
          </section>
          <div className="painel-rodape">
            <button className="btn btn-grande" onClick={avancar}>
              {ultimo ? 'Separar o equipamento' : 'Próxima decisão'}
            </button>
          </div>
        </>
      )}
    </>
  )
}

function Ferramental({
  kit, alternar, avancar,
}: { kit: string[]; alternar: (id: string) => void; avancar: () => void }) {
  return (
    <>
      <header className="painel-topo">
        <p className="sobretitulo">Fase 3 · Equipamento</p>
        <h2>Separe o que vai subir</h2>
        <p className="painel-texto">
          A caixa tem mais coisa do que este serviço pede. Leve o que é do
          serviço — e só o que está em condição de uso.
        </p>
      </header>
      <ul className="arara">
        {FERRAMENTAL.map((f) => (
          <li key={f.id}>
            <button
              className={`item ${kit.includes(f.id) ? 'ativa' : ''}`}
              onClick={() => alternar(f.id)}
              aria-pressed={kit.includes(f.id)}
              aria-label={`${f.nome} — ${f.descricao}`}
            >
              <span className="item-nome">{f.nome}</span>
              <span className="item-desc">{f.descricao}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="painel-rodape">
        <p className="painel-aviso">{kit.length} peça(s) separada(s)</p>
        <button className="btn btn-grande" onClick={avancar} disabled={!kit.length}>
          Subir para o serviço
        </button>
      </div>
    </>
  )
}

function Reparo({
  ordem, errados, escolher, concluir,
}: {
  ordem: string[]
  errados: string[]
  escolher: (id: string) => void
  concluir: () => void
}) {
  const restantes = PASSOS.filter((p) => !ordem.includes(p.id))
  const acabou = restantes.length === 0

  return (
    <>
      <header className="painel-topo">
        <p className="sobretitulo">Fase 3 · O reparo</p>
        <h2>Passo {Math.min(ordem.length + 1, PASSOS.length)} de {PASSOS.length}</h2>
        <p className="painel-texto">
          Qual é o próximo passo? A ordem é o que se está avaliando aqui.
        </p>
      </header>

      {!acabou ? (
        <ul className="arara">
          {restantes.map((p) => (
            <li key={p.id}>
              <button
                className="item"
                onClick={() => escolher(p.id)}
                aria-label={p.texto}
              >
                <span className="item-nome">{p.texto}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <section className="grupo cresce">
          <h3>Sequência executada</h3>
          <ol className="passos">
            {ordem.map((id, i) => {
              const p = PASSOS.find((x) => x.id === id)!
              const certo = PASSOS[i].id === id
              return (
                <li key={id} className={certo ? '' : 'perdido'}>
                  {p.texto}
                  {!certo && <em className="selo-veredito">fora de ordem</em>}
                </li>
              )
            })}
          </ol>
        </section>
      )}

      <div className="painel-rodape">
        {errados.length > 0 && (
          <p className="painel-aviso">
            {errados.length} passo(s) fora de ordem — aparecem no relatório.
          </p>
        )}
        {acabou && (
          <button className="btn btn-grande" onClick={concluir}>
            Encerrar o serviço
          </button>
        )}
      </div>
    </>
  )
}
