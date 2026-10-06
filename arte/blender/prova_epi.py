"""
Render de conferencia do EPI, em Cycles. Espelhado em `prova_caminhao.py`.

Dentro do jogo o vestiario esta longe e com pos-processamento; e assim que
capacete chapado e botina de caixote passam despercebidos. Aqui cada peca
aparece de perto, iluminada, no proprio corpo que ela veste — que e o unico
jeito de julgar silhueta, quina viva e face invertida.

NAO cria chao proprio: o personagem nasce com os pes em z=0 e um chao com
espessura centrado em 0 enterraria a botina (ja aconteceu em outra prova e
quase levou a "consertar" o que estava certo). O chao aqui fica em z<0 com a
face de cima exatamente em 0.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P prova_epi.py
     ... -- capacete luva        (so as vistas pedidas)
"""
import bpy, os, sys, math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import humano as H
import epi as E

SAIDA = os.path.join(C.RAIZ, "render")

FISICO = dict(genero=0.95, idade=0.58, musculo=0.62, peso=0.52, altura=0.55)


def montar():
    C.limpar()
    C.hdri(forca=0.55, rotacao=math.radians(205))
    C.sol(energia=2.4, angulo=(math.radians(48), 0, math.radians(30)),
          tamanho=0.09)

    corpo = H.criar_corpo(H.macro(**FISICO), tom=(0.30, 0.215, 0.165))
    ref = H.referencias(corpo)

    # chao com a FACE DE CIMA em z=0, nao o centro
    chao = C.caixa("chao", (6, 6, 0.2), (0, 0, -0.1))
    C.aplicar(chao, C.mat_simples("chao_prova", (0.17, 0.17, 0.165),
                                  rugosidade=0.9))
    return corpo, ref


def vistas(ref):
    """Camera por peca: posicao, alvo e lente, em metros do personagem."""
    cab = ref["head"].z + 0.10
    mao = ref["l-hand"]
    pe = ref["l-ankle"]
    tronco = ref["spine-1"]
    return {
        "capacete": ((0.46, -0.62, cab + 0.10), (0.0, 0.01, cab - 0.03), 70),
        "capacete_lado": ((0.78, 0.04, cab + 0.02), (0.0, 0.01, cab - 0.04), 75),
        "luva": ((mao.x + 0.44, mao.y - 0.52, mao.z + 0.26),
                 (mao.x, mao.y, mao.z - 0.05), 55),
        "botina": ((pe.x + 0.42, pe.y - 0.58, pe.z + 0.30),
                   (pe.x, pe.y - 0.05, pe.z - 0.05), 55),
        "cinturao": ((0.70, -1.05, tronco.z + 0.14),
                     (0.0, 0.0, tronco.z - 0.08), 62),
    }


def processar(pedidas=None):
    os.makedirs(SAIDA, exist_ok=True)
    corpo, ref = montar()

    E.capacete(corpo, ref, classe="B", jugular=True)
    E.luvas(corpo, ref, "conjunto")
    E.botinas(corpo, ref, "isolante")
    E.cinturao(corpo, ref, "paraquedista")

    for nome, (pos, alvo, lente) in vistas(ref).items():
        if pedidas and nome not in pedidas:
            continue
        C.camera(pos, alvo, lente=lente, nome=f"cam_{nome}")
        destino = os.path.join(SAIDA, f"epi_{nome}.png")
        C.render(destino, largura=820, altura=560, amostras=64, gpu=True)
        print("RENDER:", destino)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    processar(set(argv) or None)
