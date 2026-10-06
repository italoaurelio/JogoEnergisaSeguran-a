/**
 * Fase 2a — conferência do veículo, com ele desligado.
 *
 * A câmera vai até cada item e o jogador decide: está como tem de estar, ou
 * precisa corrigir antes de dar a partida. Não é caça ao erro escondido — é a
 * conferência do pátio, item por item, que é a decisão real do dia a dia.
 */
import { useCallback, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Acabamento } from '../cena/Acabamento'
import { Environment } from '@react-three/drei'
import { Cabine, CameraDaVista, LuzCabine } from '../cena/Cabine3D'
import { Motorista } from '../cena/Motorista'
import { ITENS_CABINE, MAXIMO_CABINE, type ItemCabine } from '../conteudo/cabine'
import type { Registro } from '../conteudo/pontuacao'

type Resposta = 'aceito' | 'corrigido'

export default function Fase2Cabine({
  aoConcluir, vestindo,
}: {
  aoConcluir: (registros: Registro[], maximo: number) => void
  /** O EPI escolhido no vestiário: o motorista aparece vestindo o que foi escolhido. */
  vestindo: string[]
}) {
  const [indice, setIndice] = useState(0)
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({})
  const [mostrandoRetorno, setMostrandoRetorno] = useState(false)

  const item = ITENS_CABINE[indice]
  const resposta = respostas[item.id]

  const ligados = useMemo(() => {
    const saida: string[] = []
    for (const i of ITENS_CABINE) {
      if (!i.no) continue
      saida.push(respostas[i.id] === 'corrigido' ? i.no.certo : i.no.errado)
    }
    return saida
  }, [respostas])

  const responder = useCallback(
    (r: Resposta) => {
      setRespostas((a) => ({ ...a, [item.id]: r }))
      setMostrandoRetorno(true)
    },
    [item.id],
  )

  function avancar() {
    setMostrandoRetorno(false)
    if (indice + 1 < ITENS_CABINE.length) {
      setIndice(indice + 1)
      return
    }
    aoConcluir(ITENS_CABINE.map(montarRegistro(respostas)), MAXIMO_CABINE)
  }

  return (
    <div className="vestiario">
      <div className="vestiario-palco">
        <Canvas dpr={[1, 1.5]} shadows camera={{ position: [0.22, 1.22, 0.1], fov: 45 }}
                gl={{ toneMappingExposure: 1.0 }}>
          {/* mesmo motivo do vestiário: o HDRI é céu aberto e lava a cena
              se passar de ~0,15 */}
          <Environment files="./hdri/ceu.hdr" environmentIntensity={0.12} />
          <LuzCabine />
          <Cabine ligados={ligados} />
          <Motorista vestindo={vestindo} />
          <CameraDaVista vista={item.camera} />
          <Acabamento raio={0.45} />
        </Canvas>
        <p className="vestiario-dica">
          Item {indice + 1} de {ITENS_CABINE.length}
        </p>
      </div>

      <aside className="vestiario-painel">
        <header className="painel-topo">
          <p className="sobretitulo">Fase 2 · Antes de dar a partida</p>
          <h2>{item.nome}</h2>
          <p className="painel-texto">{item.comoEsta}</p>
        </header>

        {!mostrandoRetorno ? (
          <>
            <section className="grupo">
              <h3>{item.pergunta}</h3>
              <div className="opcoes coluna">
                <button className="opcao alta" onClick={() => responder('aceito')}>
                  Está correto, pode sair assim
                </button>
                <button className="opcao alta" onClick={() => responder('corrigido')}>
                  Corrigir antes de sair
                </button>
              </div>
            </section>
            <div className="painel-rodape">
              <p className="painel-aviso">
                Ninguém vai avisar se você deixar passar. A conta aparece no fim.
              </p>
            </div>
          </>
        ) : (
          <Retorno item={item} resposta={resposta!} avancar={avancar}
                   ultimo={indice + 1 === ITENS_CABINE.length} />
        )}
      </aside>
    </div>
  )
}

function Retorno({
  item, resposta, avancar, ultimo,
}: {
  item: ItemCabine
  resposta: Resposta
  avancar: () => void
  ultimo: boolean
}) {
  const acertou = acerto(item, resposta)
  return (
    <>
      <section className="grupo cresce">
        <h3 className={acertou ? 'nota-ok' : 'nota-ruim'}>
          {acertou ? 'Decisão correta' : 'Decisão errada'}
        </h3>
        {resposta === 'corrigido' && item.depoisDeCorrigir && (
          <p className="painel-texto destaque">{item.depoisDeCorrigir}</p>
        )}
        <p className="painel-texto">{item.porque}</p>
        <p className="norma">{item.norma}</p>
      </section>
      <div className="painel-rodape">
        <button className="btn btn-grande" onClick={avancar}>
          {ultimo ? 'Dar a partida' : 'Próximo item'}
        </button>
      </div>
    </>
  )
}

/** Acertou quem corrigiu o que estava errado, e quem deixou o que estava certo. */
function acerto(item: ItemCabine, resposta: Resposta) {
  return item.correto ? resposta === 'aceito' : resposta === 'corrigido'
}

const montarRegistro =
  (respostas: Record<string, Resposta>) =>
  (item: ItemCabine): Registro => {
    const r = respostas[item.id]
    if (!r) {
      return {
        fase: 'cabine', id: item.id, titulo: item.nome, veredito: 'incorreta',
        pontos: 0, porque: 'Item não conferido.', norma: item.norma,
      }
    }
    if (acerto(item, r)) {
      return {
        fase: 'cabine', id: item.id, titulo: item.nome, veredito: 'correta',
        pontos: item.pontos, porque: item.porque, norma: item.norma,
      }
    }
    // mandar corrigir o que ja estava certo nao machuca ninguem: custa tempo,
    // nao seguranca. Deixar passar o que estava errado e o que machuca.
    const zeloExcessivo = item.correto && r === 'corrigido'
    return {
      fase: 'cabine', id: item.id, titulo: item.nome,
      veredito: zeloExcessivo ? 'incompleta' : 'incorreta',
      pontos: 0,
      porque: zeloExcessivo
        ? `Não havia o que corrigir aqui. ${item.porque}`
        : `Você saiu com isso como estava. ${item.porque}`,
      norma: item.norma,
    }
  }
