/**
 * O selo de acerto e erro, em cima da tela inteira.
 *
 * O jogo julgava em voz baixa: um `<h3>` verde ou vermelho dentro do painel,
 * do mesmo tamanho dos outros títulos. O cliente jogou a fase da ocorrência
 * inteira e não registrou que tinha errado — e ele estava certo, porque num
 * jogo o veredito é um EVENTO, não um parágrafo.
 *
 * Mora acima de tudo, no centro, e sai sozinho. Não substitui a explicação
 * no painel: aquele texto é o que ensina, este é o que avisa que há o que
 * ler. Por isso o selo some em 1,1 s e o texto fica.
 */
import { useEffect } from 'react'
import { som } from './som'

export type Selo = 'acerto' | 'erro' | null

export function SeloVeredito({ tipo, aoFim }: { tipo: Selo; aoFim?: () => void }) {
  useEffect(() => {
    if (!tipo) return
    // o som sai daqui e não de quem chama: foi o esquecimento de tocá-lo que
    // deixou metade dos vereditos mudos na primeira versão
    if (tipo === 'erro') som.erro()
    else som.acerto()
    const t = window.setTimeout(() => aoFim?.(), 1150)
    return () => window.clearTimeout(t)
  }, [tipo, aoFim])

  if (!tipo) return null
  const erro = tipo === 'erro'
  return (
    <div className={`selo-grande ${erro ? 'selo-erro' : 'selo-acerto'}`} aria-hidden>
      <div className="selo-disco">
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          {erro ? (
            <g stroke="currentColor" strokeWidth="11" strokeLinecap="round">
              <line x1="30" y1="30" x2="70" y2="70" />
              <line x1="70" y1="30" x2="30" y2="70" />
            </g>
          ) : (
            <polyline
              points="27,52 44,69 74,33" fill="none" stroke="currentColor"
              strokeWidth="11" strokeLinecap="round" strokeLinejoin="round"
            />
          )}
        </svg>
      </div>
      <p className="selo-palavra">{erro ? 'Errou' : 'Certo'}</p>
    </div>
  )
}
