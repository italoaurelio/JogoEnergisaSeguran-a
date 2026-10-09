"""Render rapido SO da pose, sem assar nada.

Existe porque acertar angulo de braco pede 6 a 10 ciclos, e cada ciclo pelo
exportador custa os dez minutos do bake das 19 pecas de EPI. Aqui o corpo
nasce, e posado e renderizado em ~30 s.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P prova_pose.py
"""
import bpy, os, sys, math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import humano as H
import epi as E

SAIDA = os.path.join(C.RAIZ, "render")
FISICO = dict(genero=0.95, idade=0.58, musculo=0.62, peso=0.52, altura=0.55)


def render(nome, de, para, lente=50, larg=560, alt=760):
    cam_d = bpy.data.cameras.new(nome); cam_d.lens = lente
    cam = bpy.data.objects.new(nome, cam_d)
    bpy.context.collection.objects.link(cam)
    cam.location = de
    from mathutils import Vector
    cam.rotation_euler = (Vector(para) - Vector(de)).to_track_quat("-Z", "Y").to_euler()
    cena = bpy.context.scene
    cena.camera = cam
    cena.render.engine = "CYCLES"
    cena.cycles.device = "CPU"
    cena.cycles.samples = 48
    cena.render.resolution_x = larg
    cena.render.resolution_y = alt
    cena.render.filepath = os.path.join(SAIDA, f"pose_{nome}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDER:", cena.render.filepath)


def main():
    C.limpar()
    C.hdri(forca=0.5, rotacao=math.radians(205))
    H.luz_vestiario()
    corpo = H.criar_corpo(H.macro(**FISICO), tom=(0.30, 0.215, 0.165))
    arm = H.adicionar_rig(corpo)
    H.pose_descanso(arm)
    # a ROUPA DE BASE entra na prova porque ela é recortada do corpo POSADO:
    # mudar a pose muda o recorte, e o defeito aparece no tecido, não na pele
    ref = H.referencias(corpo)
    E.roupa_base(corpo, ref)
    chao = C.caixa("chao", (6, 6, 0.2), (0, 0, -0.1))
    C.aplicar(chao, C.mat_simples("chao", (0.17, 0.17, 0.165), rugosidade=0.9))
    os.makedirs(SAIDA, exist_ok=True)
    render("frente", (0.0, -4.2, 1.05), (0, 0, 0.95))
    render("coxa", (0.0, -1.5, 0.95), (0, 0, 0.82), lente=65, larg=560, alt=560)


main()
