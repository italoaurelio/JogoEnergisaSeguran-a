"""
Render de conferencia das pecas da via, em Cycles.

Espelha `prova_caminhao.py`. Dentro do jogo a via passa a 30 km/h, de noite e
com pos-processamento por cima: nada disso serve para julgar se a arvore tem
silhueta de arvore. Aqui cada peca aparece parada, de dia, do ponto de vista
de quem dirige (o veiculo aponta para -Y, entao a camera fica em +Y olhando
para -Y) e tambem de tres quartos, que e onde quina viva aparece.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P prova_via.py
     ... -P prova_via.py -- beira      (so um grupo, para iterar rapido)
"""
import bpy, os, sys, math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import via as V

SAIDA = os.path.join(C.RAIZ, "render")


def _chao(m):
    """O chao da prova e a PECA DO JOGO, nao um plano inventado aqui.

    O plano de antes tinha o topo em z=0 e enterrava o acostamento (topo em
    -0,02) e a faixa de mato (-0,03): no render a pista encostava direto na
    grama e parecia que a peca nao tinha acostamento nenhum.
    """
    return V.chao(m, nome="chao_prova", raio=120.0)


# Cada grupo e uma cena pequena: pecas enfileiradas em X, camera em +Y.
# `vistas` sao (posicao, alvo, lente).
GRUPOS = {
    "beira": dict(
        pecas=[("arvore", (-9.0, 0, 0)), ("arvore", (-3.0, -4.0, 0)),
               ("arbusto", (1.0, 0, 0)), ("arbusto", (2.6, -1.4, 0)),
               ("casa", (9.0, -2.0, 0)), ("poste_da_via", (4.6, 0, 0)),
               ("placa", (0.0, 3.0, 0))],
        vistas={"frente": ((0.0, 30.0, 6.0), (0.0, -2.0, 3.4), 42),
                "tres_quartos": ((17.0, 20.0, 9.0), (0.0, -2.0, 3.0), 44)},
    ),
    "arvore": dict(
        pecas=[("arvore", (-4.2, 0, 0)), ("arvore", (0.0, -2.5, 0)),
               ("arbusto", (3.4, 0, 0))],
        vistas={"perto": ((0.5, 15.0, 4.2), (-1.0, -1.0, 3.2), 55),
                "contra": ((-10.0, 11.0, 2.0), (-1.0, -1.0, 3.0), 50)},
    ),
    "pista": dict(
        pecas=[("trecho", (0, 0, 0)), ("lombada", (0, -14.0, 0)),
               ("faixa_pedestre", (0, -24.0, 0)), ("carro", (0, -20.0, 0)),
               ("poste_da_via", (-4.6, -8.0, 0)),
               ("poste_da_via", (-4.6, -34.0, 0)),
               ("arvore", (8.5, -10.0, 0)), ("arvore", (9.5, -26.0, 0)),
               ("casa", (12.0, -18.0, 0)), ("arbusto", (6.4, -6.0, 0))],
        vistas={"motorista": ((0.0, 6.0, 2.3), (0.4, -26.0, 1.4), 38),
                "alto": ((16.0, 4.0, 13.0), (0.0, -18.0, 0.0), 40)},
    ),
    "decisao": dict(
        pecas=[("semaforo", (-5.2, 0, 0)), ("onibus", (4.0, -4.0, 0)),
               ("ciclista", (0.0, 2.0, 0))],
        vistas={"frente": ((0.0, 22.0, 4.6), (0.0, -1.0, 2.6), 44)},
    ),
}


def montar(grupo):
    C.limpar()
    C.hdri(forca=0.85, rotacao=math.radians(120))
    C.sol(energia=3.0, angulo=(math.radians(54), 0, math.radians(200)))
    m = V.materiais()
    _chao(m)
    cfg = GRUPOS[grupo]
    for i, (fn, pos) in enumerate(cfg["pecas"]):
        obj = getattr(V, fn)(m, nome=f"p_{grupo}_{i}_{fn}")
        obj.location = pos
    return cfg["vistas"]


def processar(grupos):
    os.makedirs(SAIDA, exist_ok=True)
    for grupo in grupos:
        vistas = montar(grupo)
        for nome, (pos, alvo, lente) in vistas.items():
            C.camera(pos, alvo, lente=lente, nome=f"cam_{nome}")
            destino = os.path.join(SAIDA, f"via_{grupo}_{nome}.png")
            C.render(destino, largura=820, altura=560, amostras=64, gpu=True)
            print("RENDER:", destino)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    processar(args or list(GRUPOS))
