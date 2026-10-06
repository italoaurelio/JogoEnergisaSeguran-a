/**
 * Textura nas superfícies grandes da via.
 *
 * O retorno do cliente foi "amador, tudo muito chapado". O asfalto é a
 * superfície que o jogador encara o trajeto inteiro e era cor lisa: nenhum
 * grão, nenhuma variação, nenhum relevo.
 *
 * Duas armadilhas resolvidas aqui:
 *
 * 1. **Não há UV.** As peças saem de `C.caixa`/`C.cilindro` no Blender, que
 *    não desembrulham nada. Sem UV o `map` amostra sempre o mesmo pixel e a
 *    pista sai de uma cor só. A UV é gerada da própria posição, em metros —
 *    o que, numa peça plana deitada no chão, é exatamente o que um
 *    desembrulho plano daria, e de graça.
 *
 * 2. **Anisotropia.** A pista é vista quase de raspão, e sem filtro
 *    anisotrópico o asfalto a vinte metros vira um borrão cinza que pisca
 *    quando o veículo anda. É pior que a cor chapada.
 *
 * A cor base do material tem de ser clareada junto: o `map` MULTIPLICA a cor,
 * e o asfalto nasceu com albedo 0,042 — a textura sumiria sob ele.
 */
import * as THREE from 'three'

/** Lado do ladrilho em metros. Asfalto de 4 m tem grão de tamanho crível. */
const LADRILHO: Record<string, number> = {
  via_asfalto: 2.5,
  via_terra: 2.2,
  via_mato: 3.5,
}

/**
 * Grão do interior da cabine, por prefixo de material.
 *
 * Em centímetros, não em metros: aqui a peça está a meio metro do olho, e um
 * ladrilho de escala de estrada viraria uma superfície lisa de novo.
 */
export const GRAO_CABINE: { prefixo: string; mapa: 'grao' | 'trama'; cm: number }[] = [
  { prefixo: 'tecido_banco', mapa: 'trama', cm: 3.0 },
  { prefixo: 'forro', mapa: 'trama', cm: 4.0 },
  { prefixo: 'tapete', mapa: 'trama', cm: 2.2 },
  { prefixo: 'volante_couro', mapa: 'grao', cm: 1.2 },
  { prefixo: 'painel', mapa: 'grao', cm: 2.0 },
  { prefixo: 'plastico', mapa: 'grao', cm: 2.0 },
  { prefixo: 'grelha_ar', mapa: 'grao', cm: 1.5 },
  { prefixo: 'console', mapa: 'grao', cm: 2.0 },
  { prefixo: 'porta', mapa: 'grao', cm: 2.5 },
]

/**
 * Gera UV a partir do plano x–z da própria geometria, em metros.
 *
 * Fica na geometria, não no mundo: as cópias da via são recicladas e
 * reposicionadas a cada quadro, e uma UV de mundo faria a textura deslizar
 * por baixo da pista em vez de andar com ela.
 */
export function uvPorPosicao(geometria: THREE.BufferGeometry) {
  if (geometria.getAttribute('uv')) return
  const pos = geometria.getAttribute('position')
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i)
    uv[i * 2 + 1] = pos.getZ(i)
  }
  geometria.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

/**
 * UV por eixo DOMINANTE de cada vértice — um triplanar de pobre.
 *
 * A UV plana de `uvPorPosicao` serve para peça deitada no chão (pista, mato),
 * mas estica em listras em qualquer face vertical. No interior da cabine, que
 * é feito de caixas em todas as orientações, isso apareceria no painel, na
 * porta e no encosto do banco.
 *
 * Aqui cada vértice escolhe o plano de projeção pela própria normal. Onde dois
 * planos se encontram há uma descontinuidade no padrão — invisível num grão
 * isotrópico, que é só para o que esta função serve. Numa textura com desenho
 * (tijolo, madeira com veio) a emenda apareceria e aí o caminho é desdobrar
 * UV no Blender.
 */
export function uvPorEixoDominante(geometria: THREE.BufferGeometry) {
  if (geometria.getAttribute('uv')) return
  const pos = geometria.getAttribute('position')
  const nor = geometria.getAttribute('normal')
  if (!nor) { uvPorPosicao(geometria); return }

  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i))
    const ny = Math.abs(nor.getY(i))
    const nz = Math.abs(nor.getZ(i))
    let u: number, v: number
    if (ny >= nx && ny >= nz) {        // face para cima/baixo: planta
      u = pos.getX(i); v = pos.getZ(i)
    } else if (nx >= nz) {             // face lateral: corte em x
      u = pos.getZ(i); v = pos.getY(i)
    } else {                           // face de frente: corte em z
      u = pos.getX(i); v = pos.getY(i)
    }
    uv[i * 2] = u
    uv[i * 2 + 1] = v
  }
  geometria.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

type Mapas = { cor?: THREE.Texture; relevo?: THREE.Texture }

function preparar(tex: THREE.Texture, ladrilho: number, cor: boolean,
                 anisotropia: number) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1 / ladrilho, 1 / ladrilho)
  tex.anisotropy = anisotropia
  if (cor) tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
}

/**
 * Veste um material pelo nome. Cada material recebe a SUA cópia da textura,
 * porque o ladrilho é diferente em cada um e `repeat` mora na textura.
 */
export function vestir(
  material: THREE.MeshStandardMaterial,
  mapas: Mapas,
  anisotropia: number,
  clarear = 0.85,
  ladrilhoExplicito?: number,
) {
  const ladrilho = ladrilhoExplicito ?? LADRILHO[material.name] ?? 4
  if (mapas.cor) {
    const t = mapas.cor.clone()
    preparar(t, ladrilho, true, anisotropia)
    material.map = t
    // o `map` multiplica a cor base; sem clarear, o albedo original apaga
    material.color.setScalar(clarear)
  }
  if (mapas.relevo) {
    const t = mapas.relevo.clone()
    preparar(t, ladrilho, false, anisotropia)
    material.normalMap = t
    material.normalScale.set(0.75, 0.75)
  }
  material.needsUpdate = true
}
