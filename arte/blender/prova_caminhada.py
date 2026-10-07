"""
Render do CICLO DE CAMINHADA, em sequencia, para julgar o movimento.

Os outros provas julgam FORMA numa pose parada. Esta julga CADENCIA, que e a
unica coisa que a peca parada nao mostra — e o painel do navegador roda a
0,8 fps, entao gravar do jogo sai um slideshow.

A pose e a MESMA CONTA DO JOGO (`andar()` em src/cena/Via.tsx), repetida aqui:

    ang   = sin(metros / (quadril * 0.8) * pi) * BALANCO
    perna_e = +ang, perna_d = -ang
    quadril_z = quadril * (cos(ang) - 1)

Repetir conta e como prova passa a mentir, entao o script CONFERE contra os
numeros medidos no jogo rodando (window.__via, 07/10): angulo 0,407 rad com o
quadril em -0,0735. Se a conta daqui divergir, ele para antes de renderizar.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P prova_caminhada.py
"""
import bpy, os, sys, math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import via as V

SAIDA = os.path.join(C.RAIZ, "render", "caminhada")

BALANCO = math.radians(24)          # igual ao BALANCO de Via.tsx
PASSO = 0.8                         # passada = 0,8 do quadril, igual ao jogo
QUADRIL_ADULTO = V.QUADRIL_Z        # 0,90 m — a mesma constante do modelo
CICLOS = 2
QUADROS = 24


def pose(metros, quadril):
    """Devolve (angulo da perna esquerda, queda do quadril)."""
    ang = math.sin((metros / (quadril * PASSO)) * math.pi) * BALANCO
    return ang, quadril * (math.cos(ang) - 1)


def conferir():
    """A conta daqui tem de dar o que o JOGO deu. Medido no navegador em
    07/10 com 5 pessoas andando no patio."""
    ang_medido, bob_medido = 0.407, -0.0735
    bob = QUADRIL_ADULTO * (math.cos(ang_medido) - 1)
    assert abs(bob - bob_medido) < 5e-4, f"queda do quadril diverge: {bob}"
    maior = max(abs(pose(m / 200 * 1.44, QUADRIL_ADULTO)[0])
                for m in range(201))
    assert abs(maior - BALANCO) < 1e-6, f"amplitude diverge: {maior}"
    print(f"confere: queda {bob:.4f} (jogo {bob_medido}), "
          f"amplitude {math.degrees(maior):.1f} graus")


def pernas_de(corpo):
    e = d = None
    for f in corpo.children:
        if f.name.endswith("_perna_e"):
            e = f
        if f.name.endswith("_perna_d"):
            d = f
    assert e and d, f"{corpo.name} saiu sem perna solta"
    return e, d


def processar():
    conferir()
    os.makedirs(SAIDA, exist_ok=True)
    C.limpar()
    C.hdri(forca=0.85, rotacao=math.radians(120))
    C.sol(energia=3.0, angulo=(math.radians(54), 0, math.radians(200)))
    m = V.materiais()
    V.chao(m, nome="chao_prova", raio=120.0)
    V.trecho(m, nome="trecho_prova")

    adulto = V.pedestre(m, nome="and_adulto")
    crianca = V.crianca(m, nome="and_crianca")
    elenco = [(adulto, QUADRIL_ADULTO, 0.0),
              (crianca, QUADRIL_ADULTO * 1.25 / 1.72, -1.5)]

    # camera de lado: de perfil e que se ve a passada. De frente o ciclo
    # inteiro cabe em 20 cm de tela e nao da para julgar nada.
    C.camera((2.2, 7.4, 1.35), (0.6, 0.0, 0.95), lente=55, nome="cam_lado")

    andado = CICLOS * 2.0 * (QUADRIL_ADULTO * PASSO)
    for q in range(QUADROS):
        metros = andado * q / QUADROS
        for corpo, quadril, dy in elenco:
            ang, queda = pose(metros, quadril)
            e, d = pernas_de(corpo)
            # Blender: andar e no eixo X, subir e Z, entao a perna gira em Y.
            # O sinal e invertido em relacao ao three.js porque +Y aqui leva
            # o pe para -X; que perna vai na frente nao muda o ciclo.
            e.rotation_euler = (0.0, -ang, 0.0)
            d.rotation_euler = (0.0, ang, 0.0)
            corpo.location = (metros, dy, queda)
        destino = os.path.join(SAIDA, f"q{q:02d}.png")
        C.render(destino, largura=640, altura=430, amostras=40, gpu=True)

    print("QUADROS:", QUADROS, "em", SAIDA)


if __name__ == "__main__":
    processar()
