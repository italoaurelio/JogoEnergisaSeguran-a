/**
 * Relatório final. É o material que o instrutor leva para a conversa depois,
 * então cada decisão aparece com o que era o certo e a norma correspondente —
 * não só a nota.
 */
import {
  CORTE, NOME_FASE, porFase, somar,
  type Fase, type Registro,
} from '../conteudo/pontuacao'

const ROTULO: Record<Registro['veredito'], string> = {
  correta: 'Correto',
  incompleta: 'Incompleto',
  incorreta: 'Incorreto',
}

export default function Relatorio({
  nome, registros, maximo, maximoPorFase, refazer,
}: {
  nome: string
  registros: Registro[]
  maximo: number
  /** Quanto cada fase valia. Vem do `aoConcluir` de cada uma. */
  maximoPorFase: Partial<Record<Fase, number>>
  refazer: () => void
}) {
  const resultado = somar(registros, maximo)
  const grupos = porFase(registros)
  const percentual = Math.round(resultado.fracao * 100)
  const erros = registros.filter((r) => r.veredito !== 'correta')

  // O registro errado chega com `pontos: 0` e não carrega o peso que a falta
  // valia — esse número mora no catálogo de cada fase. Em vez de estimar o
  // denominador (que daria um placar bonito e errado), cada fase entrega o
  // próprio máximo no `aoConcluir`, e ele é guardado em vez de somado e
  // esquecido.
  const porFaseComNota = (Object.keys(grupos) as Fase[])
    .filter((f) => grupos[f].length > 0 && (maximoPorFase[f] ?? 0) > 0)
    .map((f) => {
      const feitos = grupos[f].reduce((t, r) => t + r.pontos, 0)
      const possiveis = maximoPorFase[f]!
      return { fase: f, feitos, possiveis, fracao: feitos / possiveis }
    })

  return (
    <div className="tela tela-rolagem">
      <div className="cartao-tela largo">
        <p className="sobretitulo">Relatório do treinamento</p>
        <h2 className={resultado.aprovado ? 'nota-ok' : 'nota-ruim'}>
          {percentual}% — {resultado.aprovado ? 'aprovado' : 'reprovado'}
        </h2>
        <p className="nota">
          {nome ? `${nome} · ` : ''}
          {resultado.pontos} de {maximo} pontos · corte em {Math.round(CORTE * 100)}%
        </p>

        {/* Onde a nota caiu. Sem isto o relatório dá um número só para a
            sessão inteira, e o instrutor não sabe se a conversa é sobre EPI,
            sobre direção ou sobre o procedimento de reparo — que são três
            conversas diferentes. */}
        <ul className="placar">
          {porFaseComNota.map(({ fase, feitos, possiveis, fracao }) => (
            <li key={fase} className={fracao >= CORTE ? 'ok' : 'baixo'}>
              <b>{NOME_FASE[fase]}</b>
              <i style={{ width: `${Math.round(fracao * 100)}%` }} />
              <span>{feitos}<em>/{possiveis}</em></span>
            </li>
          ))}
        </ul>

        {erros.length > 0 ? (
          <>
            <h3 className="secao">O que precisa ser corrigido</h3>
            <ul className="lista">
              {erros.map((r) => (
                <li key={r.fase + r.id} className={r.veredito === 'incompleta' ? 'parcial' : 'perdido'}>
                  <b>
                    {r.titulo}
                    <em className="selo-veredito">{ROTULO[r.veredito]}</em>
                  </b>
                  <span>{r.porque}</span>
                  <span className="norma">{r.norma}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="nota destaque">
            Nenhuma decisão fora do procedimento. Todas as escolhas batem com a
            norma.
          </p>
        )}

        {(Object.keys(grupos) as Fase[])
          .filter((f) => grupos[f].some((r) => r.veredito === 'correta'))
          .map((f) => (
            <div key={f}>
              <h3 className="secao">{NOME_FASE[f]} — o que você acertou</h3>
              <ul className="lista">
                {grupos[f]
                  .filter((r) => r.veredito === 'correta')
                  .map((r) => (
                    <li key={r.id} className="achado">
                      <b>{r.titulo}</b>
                      <span className="norma">{r.norma}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}

        <div className="acoes">
          <button className="btn btn-grande" onClick={refazer}>
            Fazer o treinamento de novo
          </button>
        </div>
      </div>
    </div>
  )
}
