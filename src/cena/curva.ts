/**
 * O traçado do trajeto: onde a via dobra e onde ela sobe.
 *
 * O mundo continua sendo um túnel reto em +Z — quem dobra é o VÉRTICE, no
 * shader. Cada vértice ganha um desvio lateral e uma subida proporcionais ao
 * quadrado da distância à frente, e o `uCurva`/`uColina` do quadro vem do
 * perfil abaixo. É o truque dos jogos de corrida dos anos 80 e ele resolve de
 * uma vez a pista, o cenário, as placas e o carro da frente: todos dobram
 * juntos porque todos leem a mesma uniform.
 *
 * A alternativa — reposicionar peça a peça em JS sobre uma linha de centro
 * integrada — custa uma tabela, trigonometria por peça por quadro e ainda
 * deixa a pista facetada nas emendas. Esta não custa nada e o erro de corda
 * num trecho de 40 m fica em 7 cm.
 *
 * Sinal: `curva` positiva joga a via para a DIREITA de quem dirige.
 */

/** Desvio lateral em metros a 100 m de distância, por unidade de `curva`. */
const FORCA_CURVA = 2.8e-4
/** Subida em metros a 100 m de distância, por unidade de `colina`. */
const FORCA_COLINA = 1.2e-4

export type NoTracado = {
  /** Metro do trajeto onde este valor vale cheio. */
  metro: number
  /** -1 a 1. Negativo dobra para a esquerda. */
  curva: number
  /** -1 a 1. Positivo é subida. */
  colina: number
}

/**
 * Interpolação suave entre os nós. Sem o amaciamento a via "pula" de uma
 * curvatura para outra e a imagem inteira salta de lado — enjoa quem joga.
 */
function amaciar(t: number) {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

export function perfilEm(tracado: NoTracado[], metro: number) {
  if (tracado.length === 0) return { curva: 0, colina: 0 }
  if (metro <= tracado[0].metro) return tracado[0]
  const ultimo = tracado[tracado.length - 1]
  if (metro >= ultimo.metro) return ultimo

  let i = 0
  while (i + 1 < tracado.length && metro >= tracado[i + 1].metro) i++
  const a = tracado[i]
  const b = tracado[i + 1]
  const t = amaciar((metro - a.metro) / (b.metro - a.metro))
  return {
    curva: a.curva + (b.curva - a.curva) * t,
    colina: a.colina + (b.colina - a.colina) * t,
  }
}

/** As uniforms compartilhadas por todo material da via. */
export type Dobra = {
  uCurva: { value: number }
  uColina: { value: number }
}

export function criarDobra(): Dobra {
  return { uCurva: { value: 0 }, uColina: { value: 0 } }
}

export function aplicarPerfil(dobra: Dobra, tracado: NoTracado[], metro: number) {
  const p = perfilEm(tracado, metro)
  dobra.uCurva.value = p.curva * FORCA_CURVA
  dobra.uColina.value = p.colina * FORCA_COLINA
}

/**
 * Enfia a dobra no shader de um material.
 *
 * O deslocamento é feito em espaço de MUNDO, depois da matriz do objeto: a
 * peça é posicionada em JS no túnel reto e o shader a leva para a curva. Se
 * fosse em espaço local, cada peça dobraria em torno do próprio centro e o
 * mundo se desmontaria.
 */
export function dobrarMaterial(material: unknown, dobra: Dobra) {
  const m = material as {
    onBeforeCompile?: (s: { vertexShader: string; uniforms: Record<string, unknown> }) => void
    customProgramCacheKey?: () => string
    userData?: Record<string, unknown>
  }
  if (!m || m.userData?.dobrado) return
  ;(m.userData ??= {}).dobrado = true

  m.onBeforeCompile = (shader) => {
    shader.uniforms.uCurva = dobra.uCurva
    shader.uniforms.uColina = dobra.uColina
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uCurva;
         uniform float uColina;`,
      )
      // Substitui o project_vertex inteiro: precisamos da posição de mundo,
      // que o original não guarda. O z não é tocado, então a névoa e o
      // buffer de profundidade continuam valendo.
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4( transformed, 1.0 );
         #ifdef USE_INSTANCING
           mvPosition = instanceMatrix * mvPosition;
         #endif
         mvPosition = modelMatrix * mvPosition;
         float zf = max( mvPosition.z, 0.0 );
         // A subida PARA de crescer a 200 m. Sem o teto, o disco de chão de
         // 400 m de raio continua subindo e vira um muro acima do horizonte —
         // uma rampa de 2% vista da cabine já esconde a linha do céu. Depois
         // dos 200 m a névoa cobre o patamar.
         float zc = min( zf, 200.0 );
         mvPosition.x += uCurva * zf * zf;
         mvPosition.y += uColina * zc * zc;
         mvPosition = viewMatrix * mvPosition;
         gl_Position = projectionMatrix * mvPosition;`,
      )
  }
  // Sem isto o three reaproveita o programa do material NÃO dobrado.
  //
  // A chave descreve os RECURSOS do material, não o nome dele. Pelo nome,
  // cada um dos materiais da via compilava um programa próprio — 49 no
  // total, quando três bastam. Pela feição, quem tem os mesmos mapas divide
  // o mesmo programa, e quem não tem continua separado (que é a armadilha
  // que a chave fixa original criava).
  const mat = m as { map?: unknown; normalMap?: unknown }
  m.customProgramCacheKey = () =>
    `via-dobrada:${mat.map ? 1 : 0}${mat.normalMap ? 1 : 0}`
}
