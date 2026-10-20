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
    GPU de tablet: só o tom e a vinheta, que a `postprocessing` funde num
    passe só. Quem sai é o caro — oclusão (passe próprio, com ruído e
    limpeza), bloom (cadeia de mipmaps) e SMAA (mais um passe de tela
    cheia). A cena perde o "pousado" que a oclusão dava; num aparelho em que
    ela rodava a punhado de quadros por segundo, isso não era escolha.
  */
  if (LEVE) {
    return (
      <>
        {MOSTRAR_FPS && <Stats />}
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Vignette offset={0.34} darkness={0.30} eskil={false} />
          <ToneMapping mode={ToneMappingMode.AGX} />
        </EffectComposer>
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
