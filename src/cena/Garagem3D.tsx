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
  const caixa = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#8a7049', roughness: 0.95 }), [])
  const madeira = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#6d5736', roughness: 0.96 }), [])
  const borracha = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#1d2023', roughness: 0.94 }), [])
  const vermelho = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#8e2b22', roughness: 0.6 }), [])
  const laranja = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#a8521a', roughness: 0.8 }), [])
  const amarelo = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#9a8433', roughness: 0.95 }), [])
  const painel = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#5a6168', roughness: 0.9 }), [])

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

      {/*
        ============================================================
        A OFICINA, e não três caixas.
        ============================================================
        "Tá parecendo protótipo, não projeto final." Estava: chão, três
        paredes, uma bancada e dois tambores. O que falta numa garagem não é
        detalhe fino — é a QUANTIDADE DE COISAS. Oficina de frota é cheia, e
        o vazio é o que denuncia o cenário montado às pressas.

        Tudo aqui continua sendo caixa e cilindro, sem textura: é visto por
        trás de um vidro, a três metros ou mais. O que muda é a contagem e a
        variação de altura, que é o que o olho lê como "lugar usado".
      */}

      {/* NERVURAS das paredes: telha metálica tem onda, e é a repetição
          vertical que tira o "plano infinito" das laterais */}
      {[-1, 1].map((lado) => (
        <group key={`nerv${lado}`}>
          {Array.from({ length: 14 }, (_, i) => (
            <mesh key={i} material={vigas}
                  position={[lado * (MEIA_LARGURA - 0.05), (CHAO + TETO) / 2, FUNDO + 0.6 + i * 1.2]}>
              <boxGeometry args={[0.07, TETO - CHAO, 0.1]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* TESOURAS do telhado: as vigas transversais que dão altura ao galpão */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={`tes${i}`} material={vigas}
              position={[0, TETO - 0.28, FUNDO + 1.4 + i * 2.6]}>
          <boxGeometry args={[MEIA_LARGURA * 2, 0.22, 0.16]} />
        </mesh>
      ))}

      {/* FAIXA DE DEMARCAÇÃO no chão: é o que diz que isto é uma vaga de
          veículo e não um salão. Amarelo gasto, não amarelo de tinta nova. */}
      {[-1, 1].map((lado) => (
        <mesh key={`faixa${lado}`} material={amarelo} receiveShadow
              position={[lado * 2.3, CHAO + 0.01, 1]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.14, 11]} />
        </mesh>
      ))}

      {/* bancada do passageiro, agora com o que se põe em cima dela */}
      <mesh position={[-3.5, CHAO + 0.45, -2.6]} material={metal} castShadow>
        <boxGeometry args={[1.3, 0.9, 3.2]} />
      </mesh>
      {[-3.6, -2.4, -1.4].map((z, i) => (
        <mesh key={`cx${i}`} position={[-3.5, CHAO + 1.02, z]} material={caixa} castShadow>
          <boxGeometry args={[0.5, 0.26, 0.62]} />
        </mesh>
      ))}

      {/* PAINEL DE FERRAMENTAS na parede: o retângulo claro com os vultos
          das chaves penduradas. De longe é só um padrão, e é o bastante. */}
      <mesh position={[-4.24, CHAO + 1.75, -2.6]} rotation={[0, Math.PI / 2, 0]} material={painel}>
        <planeGeometry args={[2.6, 1.3]} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={`fer${i}`} material={vigas}
              position={[-4.2, CHAO + 1.95 - (i % 2) * 0.42, -3.7 + i * 0.26]}>
          <boxGeometry args={[0.03, 0.34, 0.06]} />
        </mesh>
      ))}

      {/* tambores, agora em duas alturas e com tampa */}
      {[0, 1, 2, 3].map((i) => (
        <group key={`tam${i}`}>
          <mesh position={[-3.8, CHAO + 0.45, 2.2 + i * 0.75]} material={vigas} castShadow>
            <cylinderGeometry args={[0.30, 0.30, 0.9, 12]} />
          </mesh>
          <mesh position={[-3.8, CHAO + 0.91, 2.2 + i * 0.75]} material={metal}>
            <cylinderGeometry args={[0.31, 0.31, 0.04, 12]} />
          </mesh>
        </group>
      ))}

      {/* PNEUS empilhados: silhueta redonda no meio de tanta quina reta */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`pn${i}`} position={[3.6, CHAO + 0.14 + i * 0.26, 3.4]}
              material={borracha} castShadow>
          <cylinderGeometry args={[0.44, 0.44, 0.25, 14]} />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh key={`pn2${i}`} position={[3.5, CHAO + 0.14 + i * 0.26, 4.5]}
              material={borracha} castShadow>
          <cylinderGeometry args={[0.44, 0.44, 0.25, 14]} />
        </mesh>
      ))}

      {/* PALETES com caixas: enche o fundo, que é o que se vê pelo vigia */}
      {[0, 1, 2].map((i) => (
        <group key={`pal${i}`} position={[-2.2 + i * 2.1, CHAO, FUNDO + 0.9]}>
          <mesh position={[0, 0.07, 0]} material={madeira} castShadow>
            <boxGeometry args={[1.2, 0.14, 1.0]} />
          </mesh>
          <mesh position={[0, 0.45 + i * 0.1, 0]} material={caixa} castShadow>
            <boxGeometry args={[1.0, 0.62 + i * 0.2, 0.86]} />
          </mesh>
        </group>
      ))}

      {/* CARRINHO de ferramentas, vermelho: o único ponto de cor saturada,
          e por isso o que ancora o olho no fundo da garagem */}
      <group position={[2.6, CHAO, -3.2]}>
        <mesh position={[0, 0.52, 0]} material={vermelho} castShadow>
          <boxGeometry args={[0.72, 1.04, 0.5]} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.28 + i * 0.3, 0.26]} material={metal}>
            <boxGeometry args={[0.66, 0.04, 0.02]} />
          </mesh>
        ))}
      </group>

      {/* ESCADA encostada na parede: a diagonal que quebra o reticulado */}
      <group position={[4.0, CHAO + 1.3, -0.4]} rotation={[0, 0, 0.14]}>
        <mesh material={metal}><boxGeometry args={[0.06, 2.8, 0.06]} /></mesh>
        <mesh position={[0, 0, 0.42]} material={metal}>
          <boxGeometry args={[0.06, 2.8, 0.06]} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[0, -1.2 + i * 0.35, 0.21]} material={metal}>
            <boxGeometry args={[0.05, 0.04, 0.42]} />
          </mesh>
        ))}
      </group>

      {/* EXTINTOR e a placa dele: numa garagem de concessionária de energia
          isso não é enfeite, é o que tem em toda parede */}
      <mesh position={[4.22, CHAO + 0.95, 2.0]} material={vermelho} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.6, 10]} />
      </mesh>
      <mesh position={[4.26, CHAO + 1.6, 2.0]} rotation={[0, -Math.PI / 2, 0]} material={vermelho}>
        <planeGeometry args={[0.34, 0.34]} />
      </mesh>

      {/* CONES no canto, do mesmo tipo dos que ele vai usar na fase 3 */}
      {[0, 1, 2].map((i) => (
        <mesh key={`co${i}`} position={[3.2 + i * 0.34, CHAO + 0.26, 5.6]}
              material={laranja} castShadow>
          <coneGeometry args={[0.2, 0.52, 10]} />
        </mesh>
      ))}

      {/* prateleira alta do outro lado, fora do alcance das vistas de perto */}
      <mesh position={[3.9, CHAO + 1.8, -1.0]} material={vigas}>
        <boxGeometry args={[0.7, 0.08, 4.5]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`pr${i}`} position={[3.9, CHAO + 2.0, -2.6 + i * 1.1]} material={caixa}>
          <boxGeometry args={[0.6, 0.34, 0.7]} />
        </mesh>
      ))}

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
