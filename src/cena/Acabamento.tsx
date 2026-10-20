/**
 * Acabamento de imagem compartilhado pelas fases.
 *
 * Oclusão ambiente, brilho suave nas partes claras, escurecimento de canto e
 * antisserrilhado. O tonemap é o mesmo AgX dos renders do Blender, para o que
 * se aprova no render bater com o que aparece no jogo.
 *
 * A oclusão é o que mais muda a cena: sem ela nada parece POUSADO em nada —
 * o cone não toca o asfalto, a caixa não toca a calçada. Usamos o `N8AO`, que
 * a própria `@react-three/postprocessing` já embrulha (o pacote `n8ao` entra
 * como dependência dela). Importar de `n8ao` direto é que não resolvia no
 * pré-bundler do Vite.
 */
import {
  Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette,
} from '@react-three/postprocessing'
import { useEffect } from 'react'
import { AgXToneMapping } from 'three'
import { useThree } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import { ToneMappingMode } from 'postprocessing'
import { LEVE, MOSTRAR_FPS } from './desempenho'

export type Qualidade = 'cheia' | 'leve'

/**
 * `raio` é em metros de mundo. A cabine é um ambiente de meio metro entre as
 * peças; a via e a ocorrência são de dezenas de metros. Um raio só não serve
 * para os dois: na cabine ele vaza e suja tudo, na rua ele some.
 */
export function Acabamento(
  { qualidade = 'cheia', raio = 1.4, intensidade = 2.6 }:
  { qualidade?: Qualidade; raio?: number; intensidade?: number },
) {
  const leve = qualidade === 'leve'
  /*
    GPU de tablet: NENHUM passe depois da cena.

    Saem a oclusão (passe próprio, com ruído e limpeza), o bloom (cadeia de
    mipmaps) e o SMAA (mais um passe de tela cheia) — e sai também o
    `EffectComposer` inteiro, que é o que mais pesa num aparelho móvel e o
    que menos aparece na conta de desenhos: ele obriga a cena a ser pintada
    numa textura de meia-precisão e depois copiada para a tela. Numa GPU de
    ladrilho isso é a cena inteira indo e voltando da memória a cada quadro.

    O tom AgX é o único que não dá para perder — sem ele a imagem aprovada
    no Blender vira outra — e ele não precisa de passe: é conta do próprio
    material. A vinheta é que fica para trás.
  */
  if (LEVE) {
    return (
      <>
        {MOSTRAR_FPS && <Stats />}
        <TomDireto />
      </>
    )
  }
  return (
    <>
    {MOSTRAR_FPS && <Stats />}
    <EffectComposer multisampling={leve ? 0 : 4} enableNormalPass={false}>
      <N8AO
        halfRes={leve}
        aoRadius={raio}
        intensity={intensidade}
        distanceFalloff={0.9}
        aoSamples={leve ? 8 : 16}
        denoiseSamples={leve ? 2 : 4}
        denoiseRadius={12}
        color="#0d1526"
      />
      {/*
        LIMIAR EM 0,58, e não 0,72. O AgX do tom comprime justamente os
        altos, então quase nada atravessava o limiar antigo: o bloom estava
        sendo pago e não fazia trabalho nenhum, exceto acender os dois pontos
        especulares do volante — que, sozinhos numa cena sem nenhum outro
        brilho, liam como erro e não como reflexo. A 0,58 o sol e a lâmpada
        do semáforo ganham halo, e os do volante deixam de ser os únicos.
      */}
      <Bloom
        intensity={0.5}
        luminanceThreshold={0.58}
        luminanceSmoothing={0.25}
        mipmapBlur
      />
      {/* Mais suave: somada ao painel escuro do trajeto, a vinheta antiga
          (0,28 / 0,42) levava os dois cantos de baixo a preto puro. */}
      <Vignette offset={0.34} darkness={0.30} eskil={false} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <SMAA />
    </EffectComposer>
    </>
  )
}

/**
 * AgX no próprio renderizador, sem passe nenhum.
 *
 * O three refaz o programa do material quando o tom do renderizador muda
 * (ele compara os dois em `setProgram`), então trocar depois de montado
 * basta — não é preciso marcar material por material.
 */
function TomDireto() {
  const gl = useThree((e) => e.gl)
  useEffect(() => {
    const antes = gl.toneMapping
    gl.toneMapping = AgXToneMapping
    return () => { gl.toneMapping = antes }
  }, [gl])
  return null
}
