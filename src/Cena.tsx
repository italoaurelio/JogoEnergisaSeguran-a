/**
 * A cena 3D e a interação de vistoria.
 *
 * A câmera fica parada em pontos de observação; o jogador arrasta para olhar em
 * volta e clica no que está errado. É de propósito que não exista andar, correr
 * nem girar livre: quem joga pode nunca ter pegado num jogo.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { PONTOS, type Ponto } from './dados'

const MODELO = './modelos/cenario.glb'
// decodificador Draco local: o padrao do drei baixa de CDN, o que quebraria
// o jogo no totem sem internet e no empacotamento Electron
const DRACO = './draco/gltf/'
const LIMITE_ARRASTO = 7        // px: acima disso é olhar, abaixo é clique
const CAMPO_PADRAO = 55
const TOLERANCIA = 0.06         // teto do perdão do toque, em fração da tela
const MINIMO_TOQUE = 20         // px: piso do perdão, para alvo pequeno e distante

useGLTF.preload(MODELO, DRACO)

type Marcador = { alvo: string; centro: [number, number, number]; ordem: number }

/** Sobe na hierarquia até achar o nó cujo nome é de um risco. */
function riscoDoObjeto(obj: THREE.Object3D | null): string | null {
  let atual: THREE.Object3D | null = obj
  while (atual) {
    if (atual.name.startsWith('risco_')) return atual.name
    atual = atual.parent
  }
  return null
}

type AlvoTolerante = { nome: string; centro: THREE.Vector3; raio: number }

/**
 * Acha o risco visível mais próximo do ponto tocado. Só aceita se nada estiver
 * na frente dele — senão daria para "acertar" a luva através da caminhonete.
 */
function porProximidade(
  alvos: AlvoTolerante[],
  camera: THREE.Camera,
  cena: THREE.Object3D,
  raio: THREE.Raycaster,
  ponteiro: THREE.Vector2,
  limite: number,
  largura: number,
  altura: number,
): string | null {
  let melhor: { nome: string; dist: number } | null = null
  const projetado = new THREE.Vector3()

  const perspectiva = camera as THREE.PerspectiveCamera
  const meioCampo = Math.tan(((perspectiva.fov ?? 55) * Math.PI) / 360)

  for (const alvo of alvos) {
    projetado.copy(alvo.centro).project(camera)
    if (projetado.z > 1) continue
    const dx = ((projetado.x - ponteiro.x) / 2) * largura
    const dy = ((projetado.y - ponteiro.y) / 2) * altura
    const dist = Math.hypot(dx, dy)

    // O perdão acompanha o tamanho aparente do alvo. Sem isso, um risco
    // distante de 30 px rouba o clique de um vizinho a 50 px de distância.
    const ateAlvo = camera.position.distanceTo(alvo.centro)
    const raioPx = (alvo.raio / ateAlvo / meioCampo) * (altura / 2)
    const limiteAlvo = Math.min(limite, Math.max(MINIMO_TOQUE, raioPx * 1.8))
    if (dist > limiteAlvo || (melhor && dist >= melhor.dist)) continue

    raio.setFromCamera(
      new THREE.Vector2(projetado.x, projetado.y), camera,
    )
    const acertos = raio.intersectObjects(cena.children, true)
    const primeiro = acertos[0]
    const livre =
      !primeiro ||
      primeiro.distance >= ateAlvo - alvo.raio - 0.05 ||
      riscoDoObjeto(primeiro.object) === alvo.nome
    if (livre) melhor = { nome: alvo.nome, dist }
  }
  return melhor?.nome ?? null
}

function Cenario({ aoCarregar }: { aoCarregar: (raiz: THREE.Object3D) => void }) {
  const { scene } = useGLTF(MODELO, DRACO)
  const pronto = useRef(false)

  useEffect(() => {
    if (pronto.current) return
    pronto.current = true
    scene.traverse((o) => {
      const malha = o as THREE.Mesh
      if (!malha.isMesh) return
      malha.castShadow = true
      malha.receiveShadow = true
      const mat = malha.material as THREE.MeshStandardMaterial
      if (mat?.map) mat.map.anisotropy = 8
    })
    aoCarregar(scene)
  }, [scene, aoCarregar])

  return <primitive object={scene} />
}

/**
 * Olhar em volta e selecionar. Mantém a câmera no ponto e anima a troca de
 * ponto de observação.
 */
function Camera({
  ponto,
  ativo,
  alvos,
  aoClicar,
}: {
  ponto: Ponto
  ativo: boolean
  alvos: AlvoTolerante[]
  aoClicar: (risco: string | null) => void
}) {
  const { camera, gl, scene } = useThree()
  const giro = useRef({ yaw: 0, pitch: 0 })
  const destino = useRef({
    yaw: 0, pitch: 0, campo: CAMPO_PADRAO, pos: new THREE.Vector3(),
  })
  const arrastando = useRef(false)
  const inicio = useRef({ x: 0, y: 0, moveu: 0 })
  const raio = useMemo(() => new THREE.Raycaster(), [])
  const alvosRef = useRef(alvos)
  alvosRef.current = alvos

  // troca de ponto: calcula para onde olhar e deixa a animação alcançar
  useEffect(() => {
    const pos = new THREE.Vector3(...ponto.posicao)
    const alvo = new THREE.Vector3(...ponto.alvo)
    const dir = alvo.clone().sub(pos)
    destino.current.pos.copy(pos)
    destino.current.yaw = Math.atan2(-dir.x, -dir.z)
    destino.current.pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z))
    destino.current.campo = ponto.campo ?? CAMPO_PADRAO
  }, [ponto])

  // acesso para conferencia por script durante o desenvolvimento
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __camera: camera, __cena: scene })
  }, [camera, scene])

  useEffect(() => {
    const tela = gl.domElement

    const baixar = (e: PointerEvent) => {
      if (!ativo) return
      arrastando.current = true
      inicio.current = { x: e.clientX, y: e.clientY, moveu: 0 }
      // captura é um reforço, não um requisito: se falhar (o navegador recusa
      // ponteiro não ativo) o clique tem de continuar funcionando
      try { tela.setPointerCapture(e.pointerId) } catch { /* segue sem captura */ }
    }

    const mover = (e: PointerEvent) => {
      if (!arrastando.current || !ativo) return
      const dx = e.movementX || 0
      const dy = e.movementY || 0
      inicio.current.moveu += Math.abs(dx) + Math.abs(dy)
      giro.current.yaw -= dx * 0.0032
      giro.current.pitch = THREE.MathUtils.clamp(
        giro.current.pitch - dy * 0.0032, -0.62, 1.15,
      )
      destino.current.yaw = giro.current.yaw
      destino.current.pitch = giro.current.pitch
    }

    const soltar = (e: PointerEvent) => {
      if (!arrastando.current) return
      arrastando.current = false
      try { tela.releasePointerCapture(e.pointerId) } catch { /* nunca capturou */ }
      if (!ativo || inicio.current.moveu > LIMITE_ARRASTO) return

      const r = tela.getBoundingClientRect()
      const ponteiro = new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      )
      raio.setFromCamera(ponteiro, camera)
      const acertos = raio.intersectObjects(scene.children, true)
      const direto = acertos.length ? riscoDoObjeto(acertos[0].object) : null
      if (direto) {
        aoClicar(direto)
        return
      }
      // Tolerância: alvo pequeno (luva, capacete, isolador lá em cima) é quase
      // impossível de acertar no pixel. Se o toque caiu perto de um risco que
      // está visível daqui, vale como acerto.
      aoClicar(porProximidade(
        alvosRef.current, camera, scene, raio, ponteiro,
        Math.max(r.width, r.height) * TOLERANCIA,
        r.width, r.height,
      ))
    }

    tela.addEventListener('pointerdown', baixar)
    tela.addEventListener('pointermove', mover)
    tela.addEventListener('pointerup', soltar)
    tela.addEventListener('pointercancel', soltar)
    return () => {
      tela.removeEventListener('pointerdown', baixar)
      tela.removeEventListener('pointermove', mover)
      tela.removeEventListener('pointerup', soltar)
      tela.removeEventListener('pointercancel', soltar)
    }
  }, [gl, camera, scene, raio, ativo, aoClicar])

  useFrame((_, dt) => {
    const k = 1 - Math.pow(0.001, dt)     // suavização independente de fps
    camera.position.lerp(destino.current.pos, k)
    giro.current.yaw += (destino.current.yaw - giro.current.yaw) * k
    giro.current.pitch += (destino.current.pitch - giro.current.pitch) * k
    camera.rotation.set(giro.current.pitch, giro.current.yaw, 0, 'YXZ')
    const cam = camera as THREE.PerspectiveCamera
    if (Math.abs(cam.fov - destino.current.campo) > 0.01) {
      cam.fov += (destino.current.campo - cam.fov) * k
      cam.updateProjectionMatrix()
    }
  })

  return null
}

function Selo({ marcador }: { marcador: Marcador }) {
  return (
    // sem distanceFactor: o selo tem tamanho de tela fixo, como um alfinete de
    // mapa. Escalando com a distância ele cobria o próprio objeto de perto.
    <Html position={marcador.centro} center zIndexRange={[8, 0]}>
      <div className="selo">{marcador.ordem}</div>
    </Html>
  )
}

export default function Cena({
  ponto,
  ativo,
  marcadores,
  centros,
  aoClicar,
  aoCarregar,
}: {
  ponto: Ponto
  ativo: boolean
  marcadores: Marcador[]
  centros: Record<string, { centro: [number, number, number]; raio: number }>
  aoClicar: (risco: string | null) => void
  aoCarregar: () => void
}) {
  const [carregado, setCarregado] = useState(false)
  const alvos = useMemo<AlvoTolerante[]>(
    () =>
      Object.entries(centros).map(([nome, d]) => ({
        nome,
        centro: new THREE.Vector3(...d.centro),
        raio: d.raio,
      })),
    [centros],
  )

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      camera={{ fov: CAMPO_PADRAO, near: 0.05, far: 400, position: PONTOS[0].posicao }}
      onCreated={({ gl }) => {
        gl.shadowMap.type = THREE.PCFSoftShadowMap
      }}
    >
      <Environment files="./hdri/ceu.hdr" background backgroundBlurriness={0.04} />
      <directionalLight
        position={[-7.5, 12, 8.5]}
        intensity={3.0}
        color="#fff3e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={46}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={16}
        shadow-camera-bottom={-6}
      />
      <ambientLight intensity={0.25} />
      <Cenario
        aoCarregar={() => {
          if (carregado) return
          setCarregado(true)
          aoCarregar()
        }}
      />
      <Camera ponto={ponto} ativo={ativo} alvos={alvos} aoClicar={aoClicar} />
      {marcadores.map((m) => (
        <Selo key={m.alvo} marcador={m} />
      ))}
    </Canvas>
  )
}

export type { Marcador }
