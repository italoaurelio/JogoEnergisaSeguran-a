"""
Render de conferencia do ROSTO, de perto, em Cycles.

O rosto e a peca mais fraca do jogo e a unica que o jogador ve a 40 cm de
distancia: a tela de tom de pele e um close. No jogo ele chega com
pos-processamento, oclusao azul e uma luz de vestiario por cima, e nao da
para separar o que e defeito do modelo do que e tratamento da cena.

Aqui ele aparece cru, em tres vistas, com luz neutra. E o unico jeito de
julgar se a correcao melhorou alguma coisa — comparar dois renders iguais,
nao dois quadros de jogo.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P prova_rosto.py
"""
import bpy, os, sys, math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import humano as H
import exportar_personagem as XP

SAIDA = os.path.join(C.RAIZ, "render")

VISTAS = {
    # (posicao da camera, ponto de mira, lente)
    "frente": ((0.0, -0.70, 1.60), (0.0, 0.0, 1.57), 72),
    "tresquartos": ((0.40, -0.50, 1.64), (0.0, 0.0, 1.61), 85),
    "perfil": ((0.62, -0.10, 1.63), (0.0, 0.0, 1.61), 85),
}


def montar():
    """A MESMA montagem do exportador, e nao uma mais simples.

    A primeira versao desta prova chamava so `criar_corpo` + `criar_olhos`, e
    o rosto saiu careca de sobrancelha — eu quase anotei isso como defeito do
    modelo. Sobrancelha e cabelo vem DEPOIS da pose, em `exportar_personagem`,
    e uma prova que pula etapa mede a prova, nao o personagem.
    """
    C.limpar()
    corpo = H.criar_corpo(H.macro(**XP.FISICO_PADRAO), tom=XP.TOM_NEUTRO)
    corpo.name = "corpo"
    arm = H.adicionar_rig(corpo)
    H.pose_descanso(arm)
    olhos = H.criar_olhos(corpo)
    H.cabelo(corpo)
    H.sobrancelhas(corpo, olhos)
    # a roupa base entra: a gola da camiseta e o que se quer julgar aqui
    import epi as E
    E.roupa_base(corpo, H.referencias(corpo))
    return corpo


def luz_neutra():
    """Chave suave + preenchimento. Nada de luz dura: ela esconde a forma do
    rosto em contraste e e justamente a forma que se quer julgar."""
    C.hdri(forca=0.55, rotacao=math.radians(200))
    bpy.ops.object.light_add(type="AREA", location=(0.55, -0.85, 1.95))
    chave = bpy.context.object
    chave.data.energy = 55
    chave.data.size = 0.7
    chave.rotation_euler = (math.radians(58), 0, math.radians(32))
    bpy.ops.object.light_add(type="AREA", location=(-0.70, -0.60, 1.55))
    fill = bpy.context.object
    fill.data.energy = 14
    fill.data.size = 1.1
    fill.rotation_euler = (math.radians(80), 0, math.radians(-48))


def main():
    montar()
    luz_neutra()
    pedidas = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(VISTAS)
    for nome in pedidas:
        de, para, lente = VISTAS[nome]
        C.camera(de, para, lente=lente)
        C.render(f"rosto_{nome}", largura=760, altura=900, amostras=160)


main()
