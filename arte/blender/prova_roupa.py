"""
Prova da ROUPA DE BASE, em pe, de frente e de perfil.

A roupa de baixo e a unica coisa que o jogador ve na fase 1 inteira, e nao
havia prova nenhuma dela: `prova_rosto` enquadra so a cabeca e `prova_epi`
mostra o uniforme POR CIMA. Julgar caimento de camisa por um render de
cabeca e o mesmo erro de julgar sobrancelha por um render que nao tem
sobrancelha.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P prova_roupa.py
"""
import bpy, os, sys, math
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import humano as H
import epi as E
import exportar_personagem as XP

SAIDA = os.path.join(C.RAIZ, "render")


def render(nome, de, para, lente=60, larg=560, alt=900):
    cd = bpy.data.cameras.new(nome); cd.lens = lente
    cam = bpy.data.objects.new(nome, cd)
    bpy.context.collection.objects.link(cam)
    cam.location = de
    cam.rotation_euler = (Vector(para) - Vector(de)).to_track_quat("-Z", "Y").to_euler()
    cena = bpy.context.scene
    cena.camera = cam
    cena.render.engine = "CYCLES"
    cena.cycles.device = "CPU"
    cena.cycles.samples = 48
    cena.render.resolution_x = larg
    cena.render.resolution_y = alt
    cena.render.filepath = os.path.join(SAIDA, f"roupa_{nome}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDER:", cena.render.filepath)


def main():
    C.limpar()
    C.hdri(forca=0.55, rotacao=math.radians(205))
    H.luz_vestiario()
    corpo = H.criar_corpo(H.macro(**XP.FISICO_PADRAO), tom=XP.TOM_NEUTRO)
    arm = H.adicionar_rig(corpo)
    H.pose_descanso(arm)
    ref = H.referencias(corpo)
    E.roupa_base(corpo, ref)
    E.botinas(corpo, ref, "tenis")
    render("frente", (0.0, -3.3, 1.05), (0.0, 0.0, 0.95), lente=72)
    render("perfil", (2.9, -0.5, 1.05), (0.0, 0.0, 0.95), lente=72)


if __name__ == "__main__":
    main()
