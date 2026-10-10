/**
 * A GARAGEM, vista pelo vidro da cabine.
 *
 * A conferência da fase 2 acontecia com a cabine flutuando num vazio: pelo
 * para-brisa e pelas janelas via-se o HDRI, que é céu aberto, e saía um
 * branco chapado de horizonte a horizonte. O cliente escreveu "coloca um
 * cenário do lado de fora, como se estivesse na garagem".
 *
 * É cenário de fundo e nada mais: caixas, sem textura e sem detalhe, porque
 * tudo aqui é visto por trás de um vidro, a três metros ou mais, e sempre
 * desfocado pelo que está em primeiro plano. O que a cena precisa é de
 * PROFUNDIDADE e de uma direção de luz — não de um galpão modelado.
 *
 * Medidas da cabine, de `arte/blender/veiculo.py`: para-brisa em z +0,66,
 * parede traseira em z -1,06, portas em x ±0,83, forro em y 1,47.
 */
import { useMemo } from 'react'
import * as THREE from 'three'

/** Chão da garagem, abaixo do piso da cabine: a cabine de um caminhão fica
    mais de um metro acima do solo, e colar o chão nela achata a altura. */
const CHAO = -1.15
const TETO = 3.3
const MEIA_LARGURA = 4.3
const FUNDO = -7.5
const PORTA = 9.0

export default function Garagem3D() {
  const cinza = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#8d8f92', roughness: 0.95 }), [])
  const concreto = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#6f7175', roughness: 1 }), [])
  const metal = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#4a5058', roughness: 0.55, metalness: 0.6 }), [])
  const vigas = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#39414b', roughness: 0.7, metalness: 0.4 }), [])

  return (
    <group>
      <mesh position={[0, CHAO, 1]} rotation={[-Math.PI / 2, 0, 0]} material={concreto} receiveShadow>
        <planeGeometry args={[MEIA_LARGURA * 2, PORTA - FUNDO]} />
      </mesh>
      {/* paredes: planos virados para dentro, e não caixas — de dentro da
          cabine só a face interna é vista, e caixa aqui dobra o desenho */}
      {[-1, 1].map((lado) => (
        <mesh key={lado} position={[lado * MEIA_LARGURA, (CHAO + TETO) / 2, 1]}
              rotation={[0, lado > 0 ? -Math.PI / 2 : Math.PI / 2, 0]} material={cinza}>
          <planeGeometry args={[PORTA - FUNDO, TETO - CHAO]} />
        </mesh>
      ))}
      <mesh position={[0, (CHAO + TETO) / 2, FUNDO]} material={cinza}>
        <planeGeometry args={[MEIA_LARGURA * 2, TETO - CHAO]} />
      </mesh>
      <mesh position={[0, TETO, 1]} rotation={[Math.PI / 2, 0, 0]} material={cinza}>
        <planeGeometry args={[MEIA_LARGURA * 2, PORTA - FUNDO]} />
      </mesh>

      {/*
        O PORTÃO ABERTO FICA ATRÁS DO PARA-BRISA, não nas costas.

        É de lá que vem a luz do dia, e é com ela que o rosto do motorista e
        o painel ficam legíveis. Fechado dos dois lados, o interior some.
      */}
      <mesh position={[0, TETO - 0.35, PORTA]} material={metal}>
        <boxGeometry args={[MEIA_LARGURA * 2, 0.7, 0.12]} />
      </mesh>
      {/* trilhos e vigas do portão, que dão escala à abertura */}
      {[-1, 1].map((lado) => (
        <mesh key={lado} position={[lado * (MEIA_LARGURA - 0.12), (CHAO + TETO) / 2, PORTA]}
              material={vigas}>
          <boxGeometry args={[0.24, TETO - CHAO, 0.14]} />
        </mesh>
      ))}

      {/* bancada e tambores na parede do passageiro: é o que diz "oficina"
          sem custar um modelo */}
      <mesh position={[-3.5, CHAO + 0.45, -2.6]} material={metal} castShadow>
        <boxGeometry args={[1.3, 0.9, 3.2]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-3.8, CHAO + 0.45, 2.2 + i * 0.75]} material={vigas} castShadow>
          <cylinderGeometry args={[0.30, 0.30, 0.9, 12]} />
        </mesh>
      ))}
      {/* prateleira alta do outro lado, fora do alcance das vistas de perto */}
      <mesh position={[3.9, CHAO + 1.8, -1.0]} material={vigas}>
        <boxGeometry args={[0.7, 0.08, 4.5]} />
      </mesh>

      {/* duas luminárias no teto: elas não iluminam (a luz é a `LuzCabine`),
          mas sem nada o teto é um retângulo cinza morto */}
      {[-2.5, 3.5].map((z) => (
        <mesh key={z} position={[0, TETO - 0.12, z]}>
          <boxGeometry args={[0.22, 0.08, 2.4]} />
          <meshBasicMaterial color={new THREE.Color(2.4, 2.5, 2.6)} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
