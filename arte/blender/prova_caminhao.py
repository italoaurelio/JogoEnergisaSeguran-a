"""
Render de conferencia do caminhao, em Cycles.

Olhar o modelo dentro do jogo nao serve para julgar modelagem: a camera da
fase esta longe, a cena e noturna e o pos-processamento mascara defeito. Aqui
o caminhao aparece sozinho, iluminado, em tres angulos — e e assim que se ve
quina viva, face invertida e proporcao errada.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P prova_caminhao.py
"""
import bpy, os, sys, math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import caminhao as CAM

SAIDA = os.path.join(C.RAIZ, "render")


def processar():
    os.makedirs(SAIDA, exist_ok=True)
    C.limpar()
    C.hdri(forca=0.9, rotacao=math.radians(130))
    C.sol(energia=3.2, angulo=(math.radians(52), 0, math.radians(40)))

    CAM.montar("prova")

    chao = C.caixa("chao", (40, 40, 0.2), (0, 0, -0.1))
    C.aplicar(chao, C.mat_simples("chao", (0.16, 0.16, 0.155), rugosidade=0.9))

    vistas = {
        "tres_quartos": ((8.6, -9.6, 5.0), (0.0, 0, 1.5), 48),
        "lateral": ((0.0, -17.0, 2.2), (0.0, 0, 1.45), 50),
        "frente": ((-8.6, -5.2, 3.0), (-2.4, 0, 1.5), 58),
    }
    for nome, (pos, alvo, lente) in vistas.items():
        C.camera(pos, alvo, lente=lente, nome=f"cam_{nome}")
        destino = os.path.join(SAIDA, f"caminhao_{nome}.png")
        # resolucao modesta de proposito: a prova e para JULGAR FORMA, e
        # arquivo grande trava quem for abrir para olhar
        C.render(destino, largura=820, altura=560, amostras=70, gpu=True)
        print("RENDER:", destino)


if __name__ == "__main__":
    processar()
