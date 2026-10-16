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
  /**
   * Tingimento, para a textura não trazer a cor dela sozinha.
   *
   * Sem isto o `setScalar` abaixo TROCAVA a cor base por um cinza neutro e
   * jogava fora a cor escolhida no Blender — o acostamento virava o salmão
   * cru da textura do Poly Haven. E esse salmão era a coisa mais saturada da
   * tela inteira do trajeto: o olho ia para o acostamento, que não carrega
   * informação nenhuma, em vez de ir para o ciclista que estava em cima
   * dele. Problema de composição, não de técnica.
   */
  tinta?: [number, number, number],
) {
  const ladrilho = ladrilhoExplicito ?? LADRILHO[material.name] ?? 4
  if (mapas.cor) {
    const t = mapas.cor.clone()
    preparar(t, ladrilho, true, anisotropia)
    material.map = t
    // o `map` multiplica a cor base; sem clarear, o albedo original apaga
    if (tinta) material.color.setRGB(tinta[0], tinta[1], tinta[2]).multiplyScalar(clarear / 0.5)
    else material.color.setScalar(clarear)
  }
  if (mapas.relevo) {
    const t = mapas.relevo.clone()
    preparar(t, ladrilho, false, anisotropia)
    material.normalMap = t
    material.normalScale.set(0.75, 0.75)
  }
  material.needsUpdate = true
}


/**
 * DOMA O SHEEN DO TECIDO, que chega do `.glb` em branco e no máximo.
 *
 * O cliente escreveu duas vezes que o personagem está "esquisito". Medido na
 * tela: o material do uniforme chega como `MeshPhysicalMaterial` com
 * `sheen = 1` e `sheenColor` BRANCO.
 *
 * Sheen é brilho de fio, e ele cresce no ângulo rasante. Num peito, que é
 * quase plano para a câmera, só a borda fica rasante e o efeito passa
 * despercebido — num BRAÇO, que é um cilindro, quase toda a superfície
 * visível é rasante, e o braço inteiro vira um tubo branco e nublado. Era
 * isso, e não a textura: o atlas do uniforme é um jeans escuro correto.
 *
 * A origem é o forno: `resgatar_sheen` devolve `Sheen Weight = 0,55` no
 * Blender, mas o `KHR_materials_sheen` do glTF não tem peso escalar — ele
 * tem só uma COR, e o exportador escreve branco. O 0,55 se perde no caminho
 * e o jogo recebe o efeito no dobro.
 *
 * Conferido com três valores lado a lado no mesmo quadro: branco apaga o
 * jeans, 0,2 ainda lava o braço, e sem sheen nenhum o tecido lê certo. Fica
 * um décimo, que devolve o fio sem devolver o problema.
 */
export function domarSheen(raiz: THREE.Object3D) {
  raiz.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial
    if (!m || !('sheen' in m) || !m.sheen) return
    m.sheenColor.setRGB(0.10, 0.11, 0.13)
    m.needsUpdate = true
  })
  assentarCadarco(raiz)
}

/**
 * BAIXA O CADARÇO DO CINTURÃO, que rouba a silhueta do personagem.
 *
 * O material nasce em `arte/blender/epi.py` com albedo (0,55 · 0,30 · 0,03)
 * e brilho de fio 0,35. Fita de poliamida de cinturão de verdade fica entre
 * 0,10 e 0,22. A 0,55, contra um uniforme de ~0,06, a razão de valor passa de
 * 8 para 1: o acessório vence o personagem. Na tela de abertura — a primeira
 * coisa que qualquer pessoa vê — não se lia "eletricista de cinturão
 * paraquedista", se lia "boneco com tubos laranja amarrados no peito".
 *
 * O sheen piora: cada tirante é um cilindro, então quase toda a superfície
 * visível é rasante, que é o mesmo mecanismo do uniforme branco já corrigido
 * acima — só que o cadarço tinha ficado de fora.
 *
 * Está aqui, e não no Blender, de propósito: assim dá para ver o resultado
 * sem pagar um rebake. Se ficar como se quer, o valor sobe para
 * `mat_cadarco` e esta função perde a razão de existir.
 */
function assentarCadarco(raiz: THREE.Object3D) {
  raiz.traverse((o) => {
    const malha = o as THREE.Mesh
    if (!malha.isMesh) return
    for (const mat of Array.isArray(malha.material) ? malha.material : [malha.material]) {
      const m = mat as THREE.MeshPhysicalMaterial
      if (!m?.name?.startsWith('cadarco')) continue
      m.color.setRGB(0.165, 0.090, 0.022)
      if ('sheen' in m) m.sheenColor.setRGB(0.08, 0.07, 0.06)
      m.needsUpdate = true
    }
  })
}
