"""Prova rapida da pose SENTADA, com o volante no lugar certo.

Mesmo motivo do `prova_pose.py`: cada ciclo pelo exportador do motorista
custa o bake inteiro. Aqui o corpo nasce, senta e e medido em ~40 s.

Alem do render, IMPRIME onde cada mao parou em relacao ao aro. Acertar mao
em volante por olho leva dez ciclos; com a distancia escrita leva dois.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P prova_sentado.py
"""
import bpy, os, sys, math
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import humano as H
import epi as E
import veiculo as V
import exportar_personagem as XP

SAIDA = os.path.join(C.RAIZ, "render")
BACIA = (0.0, 0.16, V.ALTURA_ASSENTO + 0.055)
# o corpo e montado centrado em x=0 e so vai para o banco no fim, entao aqui
# o volante tambem anda para x=0
ARO = Vector((0.0, V.VOLANTE.y, V.VOLANTE.z))


def render(nome, de, para, lente=50, larg=620, alt=620):
    cd = bpy.data.cameras.new(nome); cd.lens = lente
    cam = bpy.data.objects.new(nome, cd)
    bpy.context.collection.objects.link(cam)
    cam.location = de
    cam.rotation_euler = (Vector(para) - Vector(de)).to_track_quat("-Z", "Y").to_euler()
    cena = bpy.context.scene
    cena.camera = cam
    cena.render.engine = "CYCLES"
    cena.cycles.device = "CPU"
    cena.cycles.samples = 40
    cena.render.resolution_x = larg
    cena.render.resolution_y = alt
    cena.render.filepath = os.path.join(SAIDA, f"sentado_{nome}.png")
    bpy.ops.render.render(write_still=True)


def main():
    C.limpar()
    C.hdri(forca=0.55, rotacao=math.radians(205))
    H.luz_vestiario()

    corpo = H.criar_corpo(H.macro(**XP.FISICO_PADRAO), tom=XP.TOM_NEUTRO)
    arm = H.adicionar_rig(corpo)
    H.pose_sentado(arm)
    H.assentar(corpo, arm, BACIA)
    def grip(sx):
        return ARO + Vector((sx * V.RAIO_VOLANTE, 0, 0))
    H.maos_no_alvo(arm, grip(1), grip(-1))
    for lado in ('l', 'r'):
        H.fechar_mao(arm, lado)
    ref = H.referencias(corpo)
    E.roupa_base(corpo, ref)

    # aro do volante, so para conferir: torus na inclinacao de veiculo.py
    bpy.ops.mesh.primitive_torus_add(
        major_radius=V.RAIO_VOLANTE, minor_radius=0.017,
        location=ARO, rotation=(math.pi / 2 - V.INCLINACAO_VOLANTE, 0, 0))
    aro = bpy.context.object
    aro.name = "aro"
    C.aplicar(aro, C.mat_simples("aro", (0.02, 0.02, 0.025), rugosidade=0.6))

    # banco simples, para a pose ter contexto
    banco = C.caixa("banco", (0.5, 0.5, 0.08), (0, V.Y_BANCO, V.ALTURA_ASSENTO - 0.04))
    C.aplicar(banco, C.mat_simples("banco", (0.09, 0.10, 0.13), rugosidade=0.85))

    bpy.context.view_layer.update()

    # ONDE AS MAOS PARARAM, em relacao ao aro
    print("\n--- MAOS x ARO ---")
    print(f"aro: centro {tuple(round(v, 3) for v in ARO)} "
          f"raio {V.RAIO_VOLANTE} inclinacao {math.degrees(V.INCLINACAO_VOLANTE):.0f} graus")
    om = arm.matrix_world @ arm.pose.bones["upperarm_l"].head
    co = arm.matrix_world @ arm.pose.bones["lowerarm_l"].head
    mo = arm.matrix_world @ arm.pose.bones["hand_l"].head
    print(f"ombro {tuple(round(v,3) for v in om)}  cotovelo {tuple(round(v,3) for v in co)}")
    print(f"braco={(co-om).length:.3f} antebraco={(mo-co).length:.3f} "
          f"alcance={(co-om).length+(mo-co).length:.3f}")
    print(f"bacia {tuple(round(v,3) for v in (arm.matrix_world @ arm.pose.bones['pelvis'].head))}")
    for lado in ("l", "r"):
        b = arm.pose.bones.get(f"hand_{lado}")
        if not b:
            continue
        p = arm.matrix_world @ b.head
        d = (p - ARO).length
        print(f"mao_{lado}: {tuple(round(v, 3) for v in p)}  "
              f"distancia ao centro do aro = {d:.3f} m  (raio = {V.RAIO_VOLANTE})")
    print("--- fim ---\n")

    os.makedirs(SAIDA, exist_ok=True)
    render("perfil", (2.6, 0.10, 1.05), (0, -0.10, 0.80), lente=55)
    render("tresquartos", (1.5, -1.9, 1.35), (0, -0.05, 0.85), lente=45)


main()
