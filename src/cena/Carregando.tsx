/**
 * A TELA PRETA DO CARREGAMENTO.
 *
 * Cada fase traz um `.glb` e o `<Canvas>` do react-three-fiber suspende
 * enquanto ele não chega: até lá o palco é um retângulo preto, e do lado
 * dele um painel pedindo para o jogador decidir alguma coisa sobre uma cena
 * que ele não está vendo. Aqui, na rede local, isso durou de dez a vinte
 * segundos; no mini-PC do totem vai durar mais.
 *
 * `useProgress` do drei escuta o `DefaultLoadingManager` do three — o mesmo
 * que o `useGLTF` alimenta — então funciona FORA do Canvas, que é onde esta
 * cobertura precisa estar para tapar o palco inteiro.
 */
import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'

/*
  O CARREGADOR TERMINA ANTES DA CENA APARECER.

  Medido: `useProgress` diz 100% em 471 ms, e o palco continua preto muito
  depois — o que falta é decodificar o Draco, montar a árvore e compilar os
  shaders, e nada disso passa pelo `LoadingManager`. Cobrir só enquanto
  `active` é verdadeiro deixava a tela preta aparecer do mesmo jeito.

  `PalcoPronto` vai DENTRO do `<Canvas>`. O react-three-fiber embrulha os
  filhos num Suspense próprio, então este componente só monta quando todo o
  resto já resolveu — e o primeiro quadro depois disso é a cena na tela.
*/
const ouvintes = new Set<(pronto: boolean) => void>()

export function PalcoPronto() {
  useEffect(() => {
    const id = requestAnimationFrame(() => ouvintes.forEach((f) => f(true)))
    return () => cancelAnimationFrame(id)
  }, [])
  return null
}

/**
 * @param chave  A fase atual. Trocar de fase derruba o `pronto`: o palco
 *   seguinte começa preto e precisa avisar de novo.
 * @param temPalco  Falso no relatório, que não tem 3D nenhum. Sem isto a
 *   cobertura subia no fim da partida e não descia mais, porque ninguém
 *   jamais avisaria que o palco inexistente ficou pronto.
 */
export default function Carregando({ chave, temPalco = true }:
  { chave: string; temPalco?: boolean }) {
  const { active, progress, item } = useProgress()
  const [pronto, setPronto] = useState(false)
  useEffect(() => {
    setPronto(false)
    ouvintes.add(setPronto)
    return () => { ouvintes.delete(setPronto) }
  }, [chave])
  const cobrindo = temPalco && (active || !pronto)
  return (
    <div className={`carregando${cobrindo ? '' : ' carregando-fora'}`} aria-hidden={!cobrindo}>
      <div className="carregando-caixa">
        <p className="carregando-titulo">Preparando a cena</p>
        <div className="carregando-trilho">
          <div className="carregando-barra" style={{ width: `${progress}%` }} />
        </div>
        {/*
          O NOME DO ARQUIVO, e não um número de porcentagem sozinho: numa
          espera longa o que tranquiliza é ver que alguma coisa diferente
          está chegando a cada segundo. O caminho é cortado no último `/`
          porque o resto é pasta.
        */}
        <p className="carregando-item">{item.split('/').pop() ?? ''}</p>
      </div>
    </div>
  )
}
