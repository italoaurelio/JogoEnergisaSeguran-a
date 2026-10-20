/**
 * Fase 2a — conferência do veículo, com ele desligado.
 *
 * A FASE NÃO FAZ MAIS PERGUNTAS. Era um item por tela, com os mesmos dois
 * botões seis vezes — doze cliques, nenhum deles dentro da cabine 3D que
 * está ali na frente — e o cliente já tinha chamado isso de formulário.
 *
 * Agora é a conferência de pátio que o nome da fase sempre prometeu: as seis
 * peças são pontos clicáveis na cabine, e a resposta é o GESTO. Clicar
 * afivela o cinto, abre o espelho, levanta o apoio, guarda o celular.
 * O que não for tocado sai como está — e não tocar é uma resposta tão válida
 * quanto tocar, porque uma das seis peças JÁ ESTÁ CERTA.
 *
 * Isso resolve de quebra a regra que a fase contradizia: não há mais
 * "Decisão correta" aparecendo a cada clique. O retorno é a peça se mexendo,
 * e a conta aparece no relatório, como no trajeto e no poste.
 */
import { useCallback, useMemo, useState } from 'react'
import { Html } from '@react-three/drei'
import { PalcoPronto } from '../cena/Carregando'
import Garagem3D from '../cena/Garagem3D'
import { Canvas } from '@react-three/fiber'
import { Acabamento } from '../cena/Acabamento'
import { DPR } from '../cena/desempenho'
import { Environment } from '@react-three/drei'
import { Cabine, CameraDaVista, LuzCabine } from '../cena/Cabine3D'
import { Motorista } from '../cena/Motorista'
import { som } from '../som'
import { ITENS_CABINE, MAXIMO_CABINE, type ItemCabine } from '../conteudo/cabine'
import type { Registro } from '../conteudo/pontuacao'

type Resposta = 'aceito' | 'corrigido'

/**
 * De onde se vê a cabine inteira, antes de escolher uma peça.
 *
 * Três quartos do banco do passageiro: daqui aparecem o volante, o painel, a
 * coluna com o cinto e o console — as marcas dos seis itens cabem todas em
 * quadro, que é o que permite escolher em vez de ser conduzido.
 */
const VISTA_GERAL = {
  /*
    DE FORA, pela porta do passageiro — o mesmo truque que resolveu o item
    dos retrovisores.

    As seis peças ficam entre x -0,40 e +0,95 e entre z -0,30 e +0,52. De um
    ponto à frente, o checklist e o freio — que estão atrás — caíam fora do
    quadro. Recuar para dentro resolveu isso e criou outro: a parede
    traseira está em z -1,06 e a câmera foi parar DENTRO do banco de trás,
    com a tela virando uma massa de planos. De fora não há geometria no
    caminho, e os seis pontos cabem.
  */
  de: [-2.05, 1.52, -0.72] as [number, number, number],
  para: [0.26, 0.84, 0.16] as [number, number, number],
  lente: 32,
}

export default function Fase2Cabine({
  aoConcluir, vestindo,
}: {
  aoConcluir: (registros: Registro[], maximo: number) => void
  /** O EPI escolhido no vestiário: o motorista aparece vestindo o que foi escolhido. */
  vestindo: string[]
}) {
  /** O que o jogador AJUSTOU. O que não está aqui, sai como estava. */
  const [ajustados, setAjustados] = useState<Record<string, boolean>>({})
  /*
    `?item=N` abre já olhando a peça N (1 é a primeira). Serve para conferir
    ENQUADRAMENTO: cada item tem a sua câmera, e achar um corpo na frente do
    apoio de cabeça custava clicar os anteriores a cada ajuste de meio
    centímetro. Fora da URL, começa na vista geral.
  */
  const [olhando, setOlhando] = useState<string | null>(() => {
    const n = Number(new URLSearchParams(window.location.search).get('item'))
    return n >= 1 && n <= ITENS_CABINE.length ? ITENS_CABINE[n - 1].id : null
  })

  const item = ITENS_CABINE.find((i) => i.id === olhando) ?? null
  const vista = item?.camera ?? VISTA_GERAL

  const ligados = useMemo(() => {
    const saida: string[] = []
    for (const i of ITENS_CABINE) {
      if (!i.no) continue
      saida.push(ajustados[i.id] ? i.no.certo : i.no.errado)
    }
    return saida
  }, [ajustados])

  /** O gesto: mexe na peça. Clicar de novo desfaz — ninguém fica preso. */
  const mexer = useCallback((id: string) => {
    setAjustados((a) => ({ ...a, [id]: !a[id] }))
    setOlhando(id)
    som.clique()
  }, [])

  const concluir = useCallback(() => {
    const respostas: Record<string, Resposta> = {}
    for (const i of ITENS_CABINE) respostas[i.id] = ajustados[i.id] ? 'corrigido' : 'aceito'
    aoConcluir(ITENS_CABINE.map(montarRegistro(respostas)), MAXIMO_CABINE)
  }, [ajustados, aoConcluir])

  const mexidos = ITENS_CABINE.filter((i) => ajustados[i.id]).length

  return (
    <div className="vestiario">
      <div className="vestiario-palco">
        <Canvas dpr={DPR} shadows camera={{ position: [0.22, 1.22, 0.1], fov: 45 }}
                gl={{ toneMappingExposure: 1.0 }}>
          <Environment files="./hdri/ceu.hdr" environmentIntensity={0.30} />
          <LuzCabine />
          <Garagem3D />
          <Cabine ligados={ligados} />
          <Motorista vestindo={vestindo} />
          {ITENS_CABINE.map((i) => (
            <Html key={i.id} position={i.camera.para} center zIndexRange={[14, 2]}>
              <button
                className={`alvo ${ajustados[i.id] ? 'alvo-feito' : ''} ${
                  olhando === i.id ? 'alvo-mirado' : ''}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); mexer(i.id) }}
                title={ajustados[i.id] ? i.desfazer : i.gesto}
              >
                <span className="alvo-ponto" />
                {/*
                  O NOME SÓ NA VISTA GERAL e no ponto que está sendo olhado.
                  De perto, dois pontos que estão longe um do outro no espaço
                  podem cair no mesmo lugar da tela — o celular e o freio
                  sobrepunham os rótulos um sobre o outro, ilegíveis. O ponto
                  continua clicável; o nome é que atrapalha.
                */}
                {(!olhando || olhando === i.id) && (
                  <span className="alvo-nome">{i.nome}</span>
                )}
              </button>
            </Html>
          ))}
          <CameraDaVista vista={vista} />
          <Acabamento raio={0.45} />
          <PalcoPronto />
        </Canvas>
        <p className="vestiario-dica">
          {!item
            ? 'Clique numa peça da cabine para mexer nela'
            : ajustados[item.id]
              ? (item.depoisDeCorrigir ?? 'Ajustado.')
              : item.comoEsta}
        </p>
      </div>

      <aside className="vestiario-painel">
        <header className="painel-topo">
          <p className="sobretitulo">Fase 2 · Antes de dar a partida</p>
          <h2>Conferência do veículo</h2>
          <p className="painel-texto">
            Ajuste o que precisar antes de sair. O que você não tocar sai como está.
          </p>
        </header>

        <section className="grupo cresce">
          <h3>Na cabine</h3>
          <ul className="conferencia-cabine">
            {ITENS_CABINE.map((i) => (
              <li key={i.id} className={ajustados[i.id] ? 'mexido' : ''}>
                <button
                  className={`linha-item ${olhando === i.id ? 'olhando' : ''}`}
                  onClick={() => { setOlhando(i.id); som.clique() }}
                >
                  <b>{i.nome}</b>
                  <span>{ajustados[i.id] ? (i.depoisDeCorrigir ?? 'Ajustado') : i.comoEsta}</span>
                </button>
                <button className="btn-gesto" onClick={() => mexer(i.id)}>
                  {ajustados[i.id] ? i.desfazer : i.gesto}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div className="painel-rodape">
          <p className="painel-aviso">
            {mexidos === 0
              ? 'Ninguém vai avisar se você deixar passar. A conta aparece no fim.'
              : `${mexidos} ${mexidos === 1 ? 'peça ajustada' : 'peças ajustadas'}.`}
          </p>
          <button className="btn btn-grande" onClick={concluir}>Dar a partida</button>
        </div>
      </aside>
    </div>
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
