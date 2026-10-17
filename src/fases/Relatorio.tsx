/**
 * Fim de jogo.
 *
 * Era um relatório: uma folha que rolava, com o placar no alto e três listas
 * embaixo. O cliente chamou de "relatório de Excel" e está certo — é a tela
 * que fecha oito minutos de jogo, e fechava como um formulário enviado.
 *
 * Agora ela ocupa a tela inteira e não rola: quem rola são as LISTAS, dentro
 * das caixas delas. O número entra contando, o personagem do jogador está
 * ali reagindo, e quem fala é o gestor — porque alguém levar bronca (ou um
 * aperto de mão) é o que faz a nota significar alguma coisa.
 *
 * O conteúdo não mudou: cada decisão continua aparecendo com o porquê e a
 * norma, que é o que o instrutor leva para a conversa depois.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { Acabamento } from '../cena/Acabamento'
import { PalcoPronto } from '../cena/Carregando'
import Vestiario3D, { LuzVestiario, MiraFixa } from '../cena/Vestiario3D'
import Personagem, { type Fisico } from '../cena/Personagem'
import { som } from '../som'
import {
  CORTE, NOME_FASE, porFase, somar,
  type Fase, type Registro,
} from '../conteudo/pontuacao'

const ROTULO: Record<Registro['veredito'], string> = {
  correta: 'Correto',
  incompleta: 'Incompleto',
  incorreta: 'Incorreto',
}

/**
 * O que o gestor diz, por faixa de nota.
 *
 * Ele não repete o número — o número já está do lado, em 90 px. Ele diz o
 * que o número significa para o próximo turno, que é a única coisa que a
 * tela ainda não disse.
 */
function recado(fracao: number, erros: number) {
  if (fracao >= 0.95) {
    return {
      animo: 'feliz' as const,
      quem: 'Supervisão',
      fala: 'Saiu e voltou do mesmo jeito que foi. É isso que eu quero ver '
        + 'na equipe. Pode assinar a ordem.',
    }
  }
  if (fracao >= CORTE) {
    return {
      animo: 'ok' as const,
      quem: 'Supervisão',
      fala: `Passou. Mas ${erros === 1 ? 'ficou uma coisa' : `ficaram ${erros} coisas`} `
        + 'para trás, e nenhuma delas é detalhe. Lê comigo antes do próximo serviço.',
    }
  }
  if (fracao >= 0.45) {
    return {
      animo: 'triste' as const,
      quem: 'Supervisão',
      fala: 'Não passou. E o que me preocupa não é a nota: é que mais de uma '
        + 'dessas decisões tira alguém do serviço por bem tempo.',
    }
  }
  return {
    animo: 'triste' as const,
    quem: 'Supervisão',
    fala: 'Senta aqui. Do jeito que foi hoje, você não sai com a turma '
      + 'amanhã — e eu prefiro essa conversa a ligar para a sua casa.',
  }
}

/** Conta de zero até o valor, em 1,1 s, com freio no fim. */
function useContagem(alvo: number) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let cru = 0
    const inicio = performance.now()
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / 1100)
      // desacelera no fim: número que para seco parece que travou
      setN(Math.round(alvo * (1 - Math.pow(1 - t, 3))))
      if (t < 1) cru = requestAnimationFrame(passo)
    }
    cru = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(cru)
  }, [alvo])
  return n
}

export default function Relatorio({
  nome, registros, maximo, maximoPorFase, refazer, fisico, vestindo,
}: {
  nome: string
  registros: Registro[]
  maximo: number
  /** Quanto cada fase valia. Vem do `aoConcluir` de cada uma. */
  maximoPorFase: Partial<Record<Fase, number>>
  refazer: () => void
  /** O físico que o jogador montou — é ELE quem aparece reagindo. */
  fisico: Fisico
  /** O EPI que ele escolheu, para voltar vestido do mesmo jeito. */
  vestindo: string[]
}) {
  const resultado = somar(registros, maximo)
  const grupos = porFase(registros)
  const percentual = Math.round(resultado.fracao * 100)
  const erros = registros.filter((r) => r.veredito !== 'correta')
  const acertos = registros.filter((r) => r.veredito === 'correta')
  const mostrado = useContagem(percentual)
  const fala = useMemo(
    () => recado(resultado.fracao, erros.length), [resultado.fracao, erros.length],
  )
  const [aba, setAba] = useState<'erros' | 'acertos'>(
    erros.length > 0 ? 'erros' : 'acertos',
  )

  // O veredito soa UMA vez, depois da contagem — soar junto com a entrada da
  // tela sobrepõe o clique que trouxe o jogador até aqui.
  const tocou = useRef(false)
  useEffect(() => {
    if (tocou.current) return
    tocou.current = true
    const t = window.setTimeout(
      () => (resultado.aprovado ? som.acerto() : som.erro()), 1150,
    )
    return () => window.clearTimeout(t)
  }, [resultado.aprovado])

  const porFaseComNota = (Object.keys(grupos) as Fase[])
    .filter((f) => grupos[f].length > 0 && (maximoPorFase[f] ?? 0) > 0)
    .map((f) => {
      const feitos = grupos[f].reduce((t, r) => t + r.pontos, 0)
      const possiveis = maximoPorFase[f]!
      return { fase: f, feitos, possiveis, fracao: feitos / possiveis }
    })

  const lista = aba === 'erros' ? erros : acertos

  return (
    <div className={`fim ${resultado.aprovado ? 'fim-ok' : 'fim-ruim'}`}>
      <div className="fim-palco">
        <Canvas dpr={[1, 1.5]} shadows camera={{ position: [0.1, 1.5, 2.5], fov: 34 }}
                gl={{ antialias: true, toneMappingExposure: 1.0 }}>
          <Environment files="./hdri/ceu.hdr" environmentIntensity={0.10} />
          <LuzVestiario />
          <Vestiario3D />
          <Personagem fisico={fisico} vestindo={vestindo} giro={0} animo={fala.animo} />
          <MiraFixa para={[0, 1.08, 0]} />
          <Acabamento raio={0.9} />
          <PalcoPronto />
        </Canvas>

        {/* O gestor não aparece em cena: ele fala. Modelar mais uma pessoa
            para dizer três linhas custaria um round de Blender e entregaria
            menos que o balão, porque o que importa é O QUE ele diz. */}
        <div className="fim-gestor">
          <div className="gestor-avatar" aria-hidden>S</div>
          <div className="gestor-balao">
            <p className="gestor-quem">{fala.quem}</p>
            <p className="gestor-fala">{fala.fala}</p>
          </div>
        </div>
      </div>

      <aside className="fim-painel">
        <header className="fim-topo">
          <p className="sobretitulo">Fim do turno{nome ? ` · ${nome}` : ''}</p>
          <div className="fim-nota">
            <strong>{mostrado}<i>%</i></strong>
            <div>
              <p className="fim-veredito">
                {resultado.aprovado ? 'Aprovado' : 'Reprovado'}
              </p>
              <p className="fim-pontos">
                {resultado.pontos} de {maximo} pontos · corte em{' '}
                {Math.round(CORTE * 100)}%
              </p>
            </div>
          </div>

          <ul className="fim-placar">
            {porFaseComNota.map(({ fase, feitos, possiveis, fracao }, i) => (
              <li key={fase} className={fracao >= CORTE ? 'ok' : 'baixo'}>
                <b>{NOME_FASE[fase]}</b>
                <i style={{
                  width: `${Math.round(fracao * 100)}%`,
                  animationDelay: `${0.25 + i * 0.12}s`,
                }} />
                <span>{feitos}<em>/{possiveis}</em></span>
              </li>
            ))}
          </ul>
        </header>

        <div className="fim-abas" role="tablist">
          <button
            role="tab" aria-selected={aba === 'erros'}
            className={aba === 'erros' ? 'ativa' : ''}
            onClick={() => { setAba('erros'); som.clique() }}
          >
            A corrigir <span>{erros.length}</span>
          </button>
          <button
            role="tab" aria-selected={aba === 'acertos'}
            className={aba === 'acertos' ? 'ativa' : ''}
            onClick={() => { setAba('acertos'); som.clique() }}
          >
            Acertos <span>{acertos.length}</span>
          </button>
        </div>

        {/* A ÚNICA COISA QUE ROLA NA TELA. */}
        <ul className="fim-lista">
          {lista.length === 0 && (
            <li className="fim-vazio">
              {aba === 'erros'
                ? 'Nenhuma decisão fora do procedimento.'
                : 'Nenhum acerto registrado.'}
            </li>
          )}
          {lista.map((r) => (
            <li
              key={r.fase + r.id}
              className={
                r.veredito === 'correta' ? 'achado'
                  : r.veredito === 'incompleta' ? 'parcial' : 'perdido'
              }
            >
              <b>
                {r.titulo}
                <em className="selo-veredito">{ROTULO[r.veredito]}</em>
              </b>
              {r.veredito !== 'correta' && <span>{r.porque}</span>}
              <span className="norma">{r.norma}</span>
            </li>
          ))}
        </ul>

        <div className="fim-rodape">
          <button className="btn btn-grande" onClick={refazer}>
            Fazer o treinamento de novo
          </button>
        </div>
      </aside>
    </div>
  )
}
