"""Assa as texturas em UV e exporta o cenario inteiro em glTF para o jogo.

O material do Blender usa projecao BOX e ruido procedural, que NAO existem em
glTF. Sem assar, o modelo chega no navegador como plastico colorido. Aqui cada
grupo vira uma malha com UV proprio e tres mapas assados (cor com oclusao
embutida, rugosidade e normal).

Objetos com prefixo `risco_` ficam SEMPRE em malhas separadas: sao os alvos
clicaveis do jogo. Junto do .glb sai um `riscos.json` com o centro e o raio de
cada um, para o jogo posicionar marcador sem recalcular geometria.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P exportar.py
"""
import bpy, os, sys, math, json
import numpy as np

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import cenario as CEN

SAIDA = os.path.join(C.RAIZ, "export")
TEX_SAIDA = os.path.join(SAIDA, "tex")

# grupos de cenario: (nome, resolucao, prefixos que entram nele)
GRUPOS_CENARIO = [
    ("poste",         2048, ("poste",)),
    ("madeira",       1024, ("cruzeta", "suporte")),
    ("porcelana",     1024, ("isolador", "bucha")),
    ("metal",          512, ("pino", "pf", "amarra", "terra_")),
    ("ferragem",       512, ("mao",)),
    ("transformador", 2048, ("transformador",)),
    ("condutor",      1024, ("mt", "jumper")),
    ("veiculo",       2048, ("cenario_veiculo",)),
    ("quadra",        2048, ("cenario_quadra",)),
    ("via",           2048, ("via_",)),
    ("caixa",          512, ("cenario_caixa",)),
    ("cone",           512, ("cenario_cone",)),
]

AMOSTRAS_AO = 24


def preparar(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    return bpy.context.view_layer.objects.active


def desdobrar(obj, margem=0.02):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=margem)
    bpy.ops.object.mode_set(mode="OBJECT")


def alvo_de_bake(obj, imagem):
    """Todo material do objeto precisa de um no de imagem ativo para o bake."""
    nos_alvo = []
    for slot in obj.material_slots:
        mat = slot.material
        if not mat:
            continue
        no = mat.node_tree.nodes.new("ShaderNodeTexImage")
        no.image = imagem
        no.select = True
        mat.node_tree.nodes.active = no
        nos_alvo.append((mat, no))
    return nos_alvo


def assar(obj, nome, res, tipo, nao_cor=False, amostras=1, **extra):
    img = bpy.data.images.new(f"{nome}_{tipo}", res, res, alpha=False,
                              float_buffer=False, is_data=nao_cor)
    if nao_cor:
        img.colorspace_settings.name = "Non-Color"
    nos = alvo_de_bake(obj, img)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    cena = bpy.context.scene
    cena.cycles.samples = amostras
    cena.render.bake.margin = 12
    cena.render.bake.use_clear = True
    for k, v in extra.items():
        setattr(cena.render.bake, k, v)
    bpy.ops.object.bake(type=tipo)
    for mat, no in nos:
        mat.node_tree.nodes.remove(no)
    return img


def pixels(img):
    buf = np.empty(len(img.pixels), dtype=np.float32)
    img.pixels.foreach_get(buf)
    return buf


def salvar(img, caminho):
    img.filepath_raw = caminho
    img.file_format = "PNG"
    img.save()


def material_exportacao(nome, caminhos):
    mat = bpy.data.materials.new(f"{nome}_export")
    mat.use_nodes = True
    nos, links = mat.node_tree.nodes, mat.node_tree.links
    b = nos["Principled BSDF"]

    cor = nos.new("ShaderNodeTexImage")
    cor.image = bpy.data.images.load(caminhos["cor"])
    links.new(cor.outputs["Color"], b.inputs["Base Color"])

    rug = nos.new("ShaderNodeTexImage")
    rug.image = bpy.data.images.load(caminhos["rug"])
    rug.image.colorspace_settings.name = "Non-Color"
    links.new(rug.outputs["Color"], b.inputs["Roughness"])

    nor = nos.new("ShaderNodeTexImage")
    nor.image = bpy.data.images.load(caminhos["nor"])
    nor.image.colorspace_settings.name = "Non-Color"
    mapa = nos.new("ShaderNodeNormalMap")
    links.new(nor.outputs["Color"], mapa.inputs["Color"])
    links.new(mapa.outputs["Normal"], b.inputs["Normal"])

    b.inputs["Metallic"].default_value = 0.0
    return mat


def assar_grupo(alvo, nome, res, piso_ao=0.35):
    desdobrar(alvo)
    print(f"--- assando {nome} ({len(alvo.data.polygons)} faces, {res}px)")
    img_cor = assar(alvo, nome, res, "DIFFUSE",
                    use_pass_direct=False, use_pass_indirect=False)
    img_ao = assar(alvo, nome, res, "AO", amostras=AMOSTRAS_AO)
    img_rug = assar(alvo, nome, res, "ROUGHNESS", nao_cor=True)
    img_nor = assar(alvo, nome, res, "NORMAL", nao_cor=True)

    cor, ao = pixels(img_cor), pixels(img_ao)
    # oclusao embutida: profundidade sem luz calculada em tempo real.
    # `piso_ao` alto deixa a peca mais clara; pele pede piso alto, senao o
    # personagem fica preto quando o jogo tambem calcula sombra por cima.
    cor *= piso_ao + (1.0 - piso_ao) * ao
    cor[3::4] = 1.0
    img_cor.pixels.foreach_set(cor)

    caminhos = {}
    for chave, img in (("cor", img_cor), ("rug", img_rug), ("nor", img_nor)):
        caminho = os.path.join(TEX_SAIDA, f"{nome}_{chave}.png")
        salvar(img, caminho)
        caminhos[chave] = caminho

    alvo.data.materials.clear()
    alvo.data.materials.append(material_exportacao(nome, caminhos))


def caixa_mundo(obj):
    """Centro e raio do objeto em coordenadas de mundo (Z para cima)."""
    cantos = [obj.matrix_world @ v.co for v in obj.data.vertices]
    xs = [c.x for c in cantos]; ys = [c.y for c in cantos]; zs = [c.z for c in cantos]
    centro = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2,
              (min(zs) + max(zs)) / 2)
    raio = max(max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)) / 2
    return centro, raio


def processar():
    os.makedirs(TEX_SAIDA, exist_ok=True)
    CEN.montar()

    cena = bpy.context.scene
    cena.render.engine = "CYCLES"
    cena.cycles.device = "CPU"          # bake na GPU Metal e instavel

    exportaveis, riscos = [], {}

    # 1) cada risco sai numa malha propria, para o jogo saber no que se clicou
    for obj in [o for o in list(bpy.context.scene.objects)
                if o.name.startswith("risco_")]:
        alvo = preparar(obj)
        nome = alvo.name
        assar_grupo(alvo, nome, 1024)
        exportaveis.append(alvo)
        centro, raio = caixa_mundo(alvo)
        # glTF exporta com Y para cima: (x, y, z) do Blender vira (x, z, -y)
        riscos[nome] = {
            "centro": [round(centro[0], 3), round(centro[2], 3), round(-centro[1], 3)],
            "raio": round(raio, 3),
        }

    # 2) o resto vira grupo por material
    for nome, res, prefixos in GRUPOS_CENARIO:
        membros = [o for o in bpy.context.scene.objects
                   if o.type in {"MESH", "CURVE"} and o not in exportaveis
                   and o.name.startswith(prefixos)]
        if not membros:
            print("grupo vazio:", nome)
            continue
        membros = [preparar(o) for o in membros]
        alvo = C.juntar(membros, nome) if len(membros) > 1 else membros[0]
        alvo.name = nome
        assar_grupo(alvo, nome, res)
        exportaveis.append(alvo)

    for o in bpy.context.scene.objects:
        o.select_set(o in exportaveis)
    destino = os.path.join(SAIDA, "cenario.glb")
    bpy.ops.export_scene.gltf(filepath=destino, export_format="GLB",
                              use_selection=True, export_apply=True,
                              export_yup=True)
    with open(os.path.join(SAIDA, "riscos.json"), "w") as f:
        json.dump(riscos, f, indent=2, ensure_ascii=False)
    print("GLB:", destino, os.path.getsize(destino) // 1024, "KB")
    print("RISCOS:", ", ".join(sorted(riscos)))


if __name__ == "__main__":
    processar()
