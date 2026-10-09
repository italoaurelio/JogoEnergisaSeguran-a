"""Render de conferencia das quatro poses do eletricista.

Carrega o .glb exportado e poe as quatro lado a lado. E assim que se julga
pose — no jogo ele tem 120 px de altura e qualquer coisa passa.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P prova_eletricista.py
"""
import bpy, os, sys, math
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C

SAIDA = os.path.join(C.RAIZ, "render")
GLB = os.path.join(C.RAIZ, "export", "eletricista.glb")

C.limpar()
C.hdri(forca=0.6, rotacao=math.radians(205))
C.sol(energia=2.6, angulo=(math.radians(50), 0, math.radians(26)), tamanho=0.08)

bpy.ops.import_scene.gltf(filepath=GLB)
poses = [o for o in bpy.context.scene.objects if o.name.startswith("el_")]
poses.sort(key=lambda o: o.name)
print("IMPORTADAS:", [o.name for o in poses])

# lado a lado, 1 m de intervalo
for i, o in enumerate(poses):
    o.location = (i * 1.05 - (len(poses) - 1) * 0.525, 0, 0)

chao = C.caixa("chao", (12, 12, 0.2), (0, 0, -0.1))
C.aplicar(chao, C.mat_simples("chao_prova", (0.17, 0.17, 0.165), rugosidade=0.9))

os.makedirs(SAIDA, exist_ok=True)
C.camera((0.9, -5.4, 1.35), (0, 0, 0.95), lente=40, nome="cam_poses")
C.render("eletricista_poses", largura=1300, altura=760, amostras=90, exposicao=-0.1)
print("PRONTO")
