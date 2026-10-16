/**
 * O vestiário, como lugar.
 *
 * Antes desta peça o personagem ficava de pé num disco cinza, no vazio, com
 * um fundo azul-quase-preto — e esse era metade do "tá uma merda" do retorno:
 * cinza sobre cinza, sem sombra projetada em nada, sem nada que dissesse ONDE
 * aquilo era. Nenhuma troca de paleta na interface resolve isso sozinha,
 * porque dois terços da tela são o 3D.
 *
 * O que entra aqui é um vestiário de empresa: piso de cimento queimado, fila
 * de armários de metal verde, banco de madeira, parede de bloco e uma
 * luminária acesa no teto. Tudo em caixa e cilindro — custa ~90 malhas e
 * nenhum arquivo novo. A cor forte são os armários: é deles que vem o
 * rebatimento verde que tira o personagem do cinza.
 *
 * Convenção: o personagem fica na origem, de pé em y = 0, olhando para +Z.
 * A câmera também está em +Z. Os armários ficam ATRÁS dele, em −Z.
 */
import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const VERDE_ARMARIO = '#226148'
const VERDE_PORTA = '#2a6e52'

/** Fila de armários. Um nó por peça; são estáticos, não valem instancing. */
function Armarios({ n = 9, x0 = -2.1, passo = 0.47, z = -2.62 }) {
  const corpos = useMemo(() => Array.from({ length: n }, (_, i) => x0 + i * passo), [n, x0, passo])
  return (
    <group position={[0, 0, z]}>
      {/* base corrida: armário de vestiário assenta em pedestal, não no chão */}
      <mesh position={[x0 + ((n - 1) * passo) / 2, 0.06, 0.02]} castShadow receiveShadow>
        <boxGeometry args={[n * passo + 0.08, 0.12, 0.5]} />
        <meshStandardMaterial color="#2a2d31" roughness={0.85} metalness={0.1} />
      </mesh>
      {corpos.map((x, i) => (
        <group key={x} position={[x, 0, 0]}>
          {/* caixa */}
          <mesh position={[0, 1.08, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.45, 1.92, 0.46]} />
            <meshStandardMaterial color={VERDE_ARMARIO} roughness={0.52} metalness={0.35} />
          </mesh>
          {/* porta, levemente saliente e um pouco mais clara: é a saliência
              que faz a fila ler como ARMÁRIOS e não como uma parede verde */}
          <mesh position={[0, 1.08, 0.245]} castShadow>
            <boxGeometry args={[0.41, 1.84, 0.03]} />
            <meshStandardMaterial
              color={VERDE_PORTA} roughness={0.42} metalness={0.45}
            />
          </mesh>
          {/* venezianas: três rasgos no alto, a marca registrada do armário
              de vestiário — é por onde o armário respira */}
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[0, 1.74 - k * 0.075, 0.262]}>
              <boxGeometry args={[0.26, 0.022, 0.012]} />
              <meshStandardMaterial color="#123524" roughness={0.6} metalness={0.4} />
            </mesh>
          ))}
          {/* puxador e plaqueta numerada */}
          <mesh position={[0.15, 1.0, 0.272]} castShadow>
            <boxGeometry args={[0.025, 0.17, 0.022]} />
            <meshStandardMaterial color="#c9ccd1" roughness={0.3} metalness={0.85} />
          </mesh>
          <mesh position={[-0.02, 1.46, 0.266]}>
            <boxGeometry args={[0.12, 0.06, 0.006]} />
            <meshStandardMaterial
              color="#e8e3d6" roughness={0.8}
              emissive="#2a2114" emissiveIntensity={0.3 + (i % 3) * 0.05}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Banco de ripa, encostado nos armários. Dá escala e quebra a fila. */
function Banco({ x = 2.72, z = -1.75 }) {
  return (
    <group position={[x, 0, z]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.44, -0.24 + i * 0.16]} castShadow receiveShadow>
          <boxGeometry args={[1.9, 0.045, 0.13]} />
          <meshStandardMaterial color="#8a5f36" roughness={0.72} />
        </mesh>
      ))}
      {[-0.78, 0.78].map((dx) => (
        <group key={dx} position={[dx, 0, 0]}>
          <mesh position={[0, 0.21, 0]} castShadow>
            <boxGeometry args={[0.07, 0.42, 0.07]} />
            <meshStandardMaterial color="#3a3f45" roughness={0.5} metalness={0.6} />
          </mesh>
          <mesh position={[0, 0.41, 0]} castShadow>
            <boxGeometry args={[0.09, 0.05, 0.56]} />
            <meshStandardMaterial color="#3a3f45" roughness={0.5} metalness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export default function Vestiario3D() {
  return (
    <group>
      {/* piso: cimento queimado, mais quente que o cinza-azulado de antes */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[26, 26]} />
        <meshStandardMaterial color="#4b4741" roughness={0.94} />
      </mesh>
      {/* faixa de piso sob os armários: cimento de vestiário tem a marca de
          onde ficava o rodapé, e é ela que ancora a fila no chão */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, -2.22]} receiveShadow>
        <planeGeometry args={[9.2, 1.5]} />
        <meshStandardMaterial color="#3f3b36" roughness={0.96} />
      </mesh>

      {/* parede de bloco atrás e nas laterais: sem elas o vinhete morde o
          vazio e a cena volta a parecer um boneco num estúdio */}
      <mesh position={[0, 1.6, -3.05]} receiveShadow>
        <boxGeometry args={[26, 3.2, 0.2]} />
        <meshStandardMaterial color="#6d6459" roughness={0.95} />
      </mesh>
      <mesh position={[-5.0, 1.6, -1.0]} receiveShadow>
        <boxGeometry args={[0.2, 3.2, 10]} />
        <meshStandardMaterial color="#645c52" roughness={0.95} />
      </mesh>
      <mesh position={[0, 3.12, -1.0]} receiveShadow>
        <boxGeometry args={[26, 0.18, 10]} />
        <meshStandardMaterial color="#2b2721" roughness={0.98} />
      </mesh>

      {/* luminária: a fonte de luz TEM de estar visível em quadro, senão a
          sombra dura do personagem não tem de onde vir */}
      <mesh position={[0.2, 2.96, 0.1]}>
        <boxGeometry args={[2.6, 0.08, 0.26]} />
        <meshStandardMaterial
          color="#fff6e2" emissive="#ffe9c0" emissiveIntensity={2.4}
        />
      </mesh>

      <Armarios />
      <Banco />

      {/* mancha de luz no piso, logo abaixo da luminária: dá ao personagem um
          palco sem precisar de um disco cinza desenhado embaixo dele */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0.15]}>
        <circleGeometry args={[2.1, 48]} />
        <meshBasicMaterial
          color="#ffdfae" transparent opacity={0.07}
          blending={THREE.AdditiveBlending} depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/**
 * A luz do vestiário.
 *
 * Três fontes com TEMPERATURAS diferentes, que é o que faltava: a cena antiga
 * tinha três direcionais quase brancas e por isso tudo nela caía no mesmo
 * cinza. Aqui a chave é quente (a luminária), o preenchimento é frio (a porta
 * do corredor) e o rebatimento vem verde dos armários.
 */
export function LuzVestiario() {
  return (
    <>
      <hemisphereLight args={['#cfe2d4', '#4a3f33', 0.55]} />
      <directionalLight
        position={[-1.4, 3.4, 2.4]}
        intensity={3.1}
        color="#ffe7c2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-3.2}
        shadow-camera-right={3.2}
        shadow-camera-top={3.0}
        shadow-camera-bottom={-0.3}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[3.2, 1.8, 2.0]} intensity={0.85} color="#bcd4ff" />
      {/* rebatimento dos armários: entra por trás e desenha a silhueta */}
      {/* 0,40 e não 1,15. Isto representa o REBATIMENTO dos armários verdes, e
          rebatimento de parede é difuso, fraco e vem de uma área grande — uma
          direcional saturada a 1,15 vinda de trás não rebate, PINTA. A tela se
          chama "Tom de pele" e o tom de pele era a única coisa que ela não
          mostrava: o lado de sombra do maxilar e do pescoço saía
          cinza-esverdeado, e o marrom escolhido no painel chegava bege. */}
      <directionalLight position={[0.4, 1.9, -2.6]} intensity={0.40} color="#a8c9b6" />
    </>
  )
}

/**
 * Mira fixa: aponta a câmera para um ponto e fica lá.
 *
 * A câmera padrão do Canvas olha para a origem, que no vestiário é o CHÃO
 * entre os pés do personagem. Quem usa o cenário precisa de uma linha para
 * subir o olhar até o peito, e não de um controlador inteiro.
 */
export function MiraFixa({ para }: { para: [number, number, number] }) {
  const alvo = useMemo(() => new THREE.Vector3(...para), [para])
  useFrame(({ camera }) => { camera.lookAt(alvo) })
  return null
}
