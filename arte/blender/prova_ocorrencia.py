"""
Render de conferencia das pecas da ocorrencia (fase 3), em Cycles.

Espelha `prova_caminhao.py`. Dentro do jogo a camera da fase fica longe e o
pos-processamento mascara defeito; aqui o poste aparece iluminado e de perto,
que e como se ve quina viva, face invertida e proporcao errada.

A vista `topo` e a mais importante: e para la que o jogador olha durante a
sequencia de 9 passos da NR-10 (transformador, cruzeta, chave fusivel).

CHAO: a prova usa o MESMO chao de `poste.montar()` (topo em z=0). Nao inventar
um plano aqui — ja houve prova em que o plano inventado enterrou a peca e
quase levou a "consertar" o que estava certo.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P prova_ocorrencia.py
     ... -P prova_ocorrencia.py -- topo       (so uma vista, para iterar rapido)
"""
import bpy, os, sys, math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import poste as P
import cenario as CEN
import ocorrencia as OC

SAIDA = os.path.join(C.RAIZ, "render")

# (posicao, alvo, lente)
VISTAS = {
    "geral": ((7.4, -7.0, 5.4), (0.0, 0.0, 5.4), 36),
    "topo": ((5.4, -5.8, 9.1), (0.25, 0.0, 8.45), 35),
    "trafo": ((2.3, -2.1, 7.1), (0.52, 0.0, 6.75), 50),
    "soltas": ((4.3, -4.9, 2.4), (1.55, 0.25, 0.60), 46),
    "ferramental": ((1.0, 0.1, 1.45), (2.75, -2.25, 0.15), 40),
}


def montar(com_soltas=True):
    """Poste completo + as pecas que o jogador posiciona, enfileiradas no chao."""
    P.montar()
    m = OC.materiais()
    if not com_soltas:
        return m
    # enfileiradas em X positivo, longe do poste, todas assentadas em z=0
    cone = CEN.cone(m, "prova_cone")
    cone.location = (1.5, -0.5, 0.0)
    cav = OC.cavalete(m)
    cav.location = (2.6, 0.7, 0.0)
    fita = OC.fita_zebrada(m)
    fita.rotation_euler = (0, 0, math.radians(-62))
    fita.location = (0.7, -1.5, 0.80)
    cx = CEN.caixa_ferramentas(m)
    cx.location = (1.9, -1.5, 0.0)
    esc = CEN.escada(m)
    # Escada DEITADA. O giro e em Y, nao em X: Rx(90) manda a LARGURA da
    # escada para o eixo Z e ela fica de pe sobre um montante, como uma
    # cerca. Ry(90) manda o COMPRIMENTO para X e mantem a largura em Y, que
    # e a escada no chao. z = metade da profundidade do montante (0,080).
    esc.rotation_euler = (0, math.radians(90), math.radians(18))
    esc.location = (3.1, -2.3, 0.042)
    return m


def processar(vistas):
    os.makedirs(SAIDA, exist_ok=True)
    montar()
    for nome in vistas:
        pos, alvo, lente = VISTAS[nome]
        C.camera(pos, alvo, lente=lente, nome=f"cam_{nome}")
        destino = os.path.join(SAIDA, f"ocorrencia_{nome}.png")
        C.render(destino, largura=820, altura=560, amostras=64, gpu=True)
        print("RENDER:", destino)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    processar(args or list(VISTAS))
