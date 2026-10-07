"""
Render de conferencia da CABINE, em Cycles. Espelhado em `prova_caminhao.py`.

Nao existia, e por isso o interior nunca foi julgado: no jogo ele aparece no
terco inferior da tela, de noite e com pos-processamento, que e exatamente a
condicao em que peca solta e haste faltando passam despercebidas.

A vista `motorista` reproduz o OLHO e o campo da fase 2b — e a unica que
responde "o jogador ve o volante?".

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P prova_cabine.py
     ... -- motorista cinto      (so as vistas pedidas)
"""
import bpy, os, sys, math
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import veiculo as V

SAIDA = os.path.join(C.RAIZ, "render")


def montar(estados=("cinto_afivelado", "retro_ok", "apoio_alto",
                    "celular_guardado", "checklist_feito")):
    C.limpar()
    V.luz_cabine()
    V.fixo()
    grupos = V.estados()
    for nome, objs in grupos.items():
        for o in objs:
            if o:
                o.hide_render = nome not in estados


def vistas():
    """Posicao, alvo e lente. `motorista` copia a camera da fase 2b."""
    olho = V.OLHO
    # fov 52 vertical em 820x560 -> lente equivalente, para o render dizer o
    # mesmo que a tela: f = (36/proporcao)/2 / tan(fov/2)
    prop = 820 / 560
    f = (36 / prop) / 2 / math.tan(math.radians(52) / 2)
    return {
        # a cabine olha para -Y (para-brisa em y=-0,80), nao para +Y
        "motorista": (tuple(olho), (olho.x + 0.02, olho.y - 6, olho.z - 0.42), f),
        "volante": ((V.X_MOTORISTA + 0.52, V.VOLANTE.y - 0.62, V.VOLANTE.z + 0.34),
                    tuple(V.VOLANTE), 50),
        "cinto": ((V.X_MOTORISTA + 0.78, 0.46, 1.26),
                  (V.X_MOTORISTA - 0.04, -0.02, 0.92), 48),
        "geral": ((1.95, 1.75, 1.72), (0.0, -0.30, 0.80), 34),
    }


def processar(pedidas=None):
    os.makedirs(SAIDA, exist_ok=True)
    montar()
    for nome, (pos, alvo, lente) in vistas().items():
        if pedidas and nome not in pedidas:
            continue
        C.camera(pos, alvo, lente=lente, nome=f"cam_{nome}")
        destino = os.path.join(SAIDA, f"cab_{nome}.png")
        C.render(destino, largura=820, altura=560, amostras=64, gpu=True)
        print("RENDER:", destino)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    processar(set(argv) or None)
