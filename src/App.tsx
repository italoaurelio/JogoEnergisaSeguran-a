/**
 * Fluxo da sessão: abertura → vestiário → trânsito → ocorrência → relatório.
 *
 * As fases 2 e 3 ainda não estão montadas; o fluxo já prevê o lugar delas para
 * a pontuação ser somada de uma vez só no fim, que é como o cliente pediu.
 */
import { useCallback, useState } from 'react'
import { som } from './som'
import Carregando from './cena/Carregando'
import Abertura from './fases/Abertura'
import Vestiario from './fases/Vestiario'
import Fase2Cabine from './fases/Cabine'
import Fase2Trajeto from './fases/Trajeto'
import Fase3Ocorrencia from './fases/Ocorrencia'
import Relatorio from './fases/Relatorio'
import type { Fisico } from './cena/Personagem'
import type { Fase, Registro } from './conteudo/pontuacao'
import {
  MAXIMO_EXEMPLO, MAXIMO_POR_FASE_EXEMPLO, REGISTROS_EXEMPLO,
} from './conteudo/amostra'

type Etapa =
  | 'abertura' | 'vestiario' | 'cabine' | 'trajeto' | 'ocorrencia' | 'relatorio'

/**
 * Atalho de desenvolvimento: `?fase=ocorrencia` entra direto na fase.
 *
 * Sem isso, conferir um ajuste na fase 3 exige refazer o vestiário, a cabine
 * e dois quilômetros de trajeto a cada vez. Só vale em desenvolvimento.
 */
function etapaInicial(): Etapa {
  if (!import.meta.env.DEV) return 'abertura'
  const pedida = new URLSearchParams(window.location.search).get('fase')
  const validas: Etapa[] = [
    'abertura', 'vestiario', 'cabine', 'trajeto', 'ocorrencia', 'relatorio',
  ]
  return (validas as string[]).includes(pedida ?? '') ? (pedida as Etapa) : 'abertura'
}

/**
 * Quando se pula direto para uma fase pelo atalho de desenvolvimento, não há
 * vestiário para escolher o EPI — e sem ele o motorista apareceria de camiseta
 * na conferência. Entra o conjunto correto.
 */
function epiInicial(): string[] {
  if (!import.meta.env.DEV) return []
  const pedida = new URLSearchParams(window.location.search).get('fase')
  if (!pedida || pedida === 'abertura' || pedida === 'vestiario') return []
  return ['capacete_b', 'protetor_facial_arco', 'vestimenta_fr',
          'luva_isolante_cobertura', 'botina_isolante',
          'paraquedista_talabarte', 'nada_no_corpo']
}

export default function App() {
  const [etapa, setEtapa] = useState<Etapa>(etapaInicial)
  const [nome, setNome] = useState('')
  // `?fase=relatorio` abre o relatório com uma partida de exemplo. Sem isso a
  // única forma de olhar a tela é jogar as quatro fases inteiras.
  const amostra = import.meta.env.DEV && etapaInicial() === 'relatorio'
  const [registros, setRegistros] = useState<Registro[]>(
    () => (amostra ? REGISTROS_EXEMPLO : []),
  )
  const [maximo, setMaximo] = useState(amostra ? MAXIMO_EXEMPLO : 0)
  // Guardado por fase, e não só somado: o relatório mostra onde a nota caiu,
  // e sem isto ele teria de adivinhar o denominador de cada fase.
  const [maximoPorFase, setMaximoPorFase] = useState<Partial<Record<Fase, number>>>(
    () => (amostra ? MAXIMO_POR_FASE_EXEMPLO : {}),
  )
  const guardarMaximo = useCallback((fase: Fase, quanto: number) => {
    setMaximoPorFase((m) => ({ ...m, [fase]: (m[fase] ?? 0) + quanto }))
  }, [])
  const [, setFisico] = useState<Fisico | null>(null)
  const [epi, setEpi] = useState<string[]>(epiInicial)

  const concluirVestiario = useCallback(
    (novos: Registro[], fisicoEscolhido: Fisico, maximoFase: number,
     vestindo: string[]) => {
      setRegistros((a) => [...a, ...novos])
      setMaximo((m) => m + maximoFase)
      guardarMaximo('vestiario', maximoFase)
      setFisico(fisicoEscolhido)
      setEpi(vestindo)
      setEtapa('cabine')
    },
    [],
  )

  const concluirCabine = useCallback((novos: Registro[], maximoFase: number) => {
    setRegistros((a) => [...a, ...novos])
    setMaximo((m) => m + maximoFase)
      guardarMaximo('cabine', maximoFase)
    setEtapa('trajeto')
  }, [])

  const concluirTrajeto = useCallback((novos: Registro[], maximoFase: number) => {
    setRegistros((a) => [...a, ...novos])
    setMaximo((m) => m + maximoFase)
      guardarMaximo('trajeto', maximoFase)
    setEtapa('ocorrencia')
  }, [])

  const concluirOcorrencia = useCallback(
    (novos: Registro[], maximoFase: number) => {
      setRegistros((a) => [...a, ...novos])
      setMaximo((m) => m + maximoFase)
      guardarMaximo('ocorrencia', maximoFase)
      setEtapa('relatorio')
    }, [])

  function reiniciar() {
    setRegistros([])
    setMaximo(0)
    setMaximoPorFase({})
    setEtapa('vestiario')
  }

  return (
    <div className="app">
      <BotaoMudo />
      {/* Uma só, aqui: o `useProgress` é global, então a mesma cobertura
          serve as cinco fases e aparece de novo a cada troca. */}
      <Carregando chave={etapa} temPalco={etapa !== 'relatorio'} />
      {etapa === 'abertura' && (
        <Abertura nome={nome} setNome={setNome} avancar={() => setEtapa('vestiario')} />
      )}
      {etapa === 'vestiario' && <Vestiario aoConcluir={concluirVestiario} />}
      {etapa === 'cabine' && (
        <Fase2Cabine aoConcluir={concluirCabine} vestindo={epi} />
      )}
      {etapa === 'trajeto' && <Fase2Trajeto aoConcluir={concluirTrajeto} />}
      {etapa === 'ocorrencia' && (
        <Fase3Ocorrencia aoConcluir={concluirOcorrencia} />
      )}
      {etapa === 'relatorio' && (
        <Relatorio
          nome={nome}
          registros={registros}
          maximo={maximo}
          maximoPorFase={maximoPorFase}
          refazer={reiniciar}
        />
      )}
    </div>
  )
}

/**
 * O jogo roda em sala de treinamento e em totem. Em sala, quem apresenta
 * precisa conseguir cortar o som sem sair da partida.
 */
function BotaoMudo() {
  const [mudo, setMudo] = useState(som.mudo)
  return (
    <button
      className="btn-mudo"
      title={mudo ? 'Ligar o som' : 'Desligar o som'}
      aria-label={mudo ? 'Ligar o som' : 'Desligar o som'}
      onClick={() => setMudo(som.alternarMudo())}
    >
      {mudo ? '🔇' : '🔊'}
    </button>
  )
}
