"""Utilitarios compartilhados de cena, material e render para os assets do jogo."""
import bpy, bmesh, os, math
from mathutils import Vector, Euler

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX = os.path.join(RAIZ, "tex")
HDRI = os.path.join(RAIZ, "ceu.hdr")
RENDER = os.path.join(RAIZ, "render")


# ---------------------------------------------------------------- cena

def limpar():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def hdri(forca=1.0, rotacao=0.0):
    mundo = bpy.data.worlds.new("mundo")
    bpy.context.scene.world = mundo
    mundo.use_nodes = True
    nos, links = mundo.node_tree.nodes, mundo.node_tree.links
    nos.clear()
    saida = nos.new("ShaderNodeOutputWorld")
    fundo = nos.new("ShaderNodeBackground")
    fundo.inputs["Strength"].default_value = forca
    env = nos.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(HDRI)
    mapa = nos.new("ShaderNodeMapping")
    mapa.inputs["Rotation"].default_value[2] = rotacao
    coord = nos.new("ShaderNodeTexCoord")
    links.new(coord.outputs["Generated"], mapa.inputs["Vector"])
    links.new(mapa.outputs["Vector"], env.inputs["Vector"])
    links.new(env.outputs["Color"], fundo.inputs["Color"])
    links.new(fundo.outputs["Background"], saida.inputs["Surface"])
    return mundo


def sol(energia=3.0, angulo=(math.radians(50), 0, math.radians(35)), tamanho=0.02):
    dados = bpy.data.lights.new("sol", type="SUN")
    dados.energy = energia
    dados.angle = tamanho
    obj = bpy.data.objects.new("sol", dados)
    obj.rotation_euler = angulo
    bpy.context.collection.objects.link(obj)
    return obj


def camera(pos, alvo, lente=50, nome="cam"):
    dados = bpy.data.cameras.new(nome)
    dados.lens = lente
    obj = bpy.data.objects.new(nome, dados)
    bpy.context.collection.objects.link(obj)
    obj.location = Vector(pos)
    direcao = Vector(alvo) - Vector(pos)
    obj.rotation_euler = direcao.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = obj
    return obj


def render(saida, largura=1100, altura=1450, amostras=180, gpu=True,
           exposicao=0.0, look="AgX - Punchy"):
    cena = bpy.context.scene
    cena.render.engine = "CYCLES"
    cena.cycles.samples = amostras
    cena.cycles.use_denoising = True
    if gpu:
        prefs = bpy.context.preferences.addons.get("cycles")
        if prefs:
            try:
                prefs.preferences.compute_device_type = "METAL"
                prefs.preferences.get_devices()
                for d in prefs.preferences.devices:
                    d.use = True
                cena.cycles.device = "GPU"
            except Exception as e:
                print("GPU indisponivel, CPU:", e)
    cena.render.resolution_x = largura
    cena.render.resolution_y = altura
    cena.render.film_transparent = False
    cena.view_settings.view_transform = "AgX"
    cena.view_settings.look = look
    cena.view_settings.exposure = exposicao
    cena.render.filepath = os.path.join(RENDER, saida)
    bpy.ops.render.render(write_still=True)
    print("RENDER:", cena.render.filepath + ".png")


# ---------------------------------------------------------------- material

def _principled(mat):
    return mat.node_tree.nodes["Principled BSDF"]


def _set(bsdf, nome, valor):
    """Nomes de entrada mudam entre versoes; ignora o que nao existir."""
    if nome in bsdf.inputs:
        bsdf.inputs[nome].default_value = valor


def mat_simples(nome, cor, rugosidade=0.5, metalico=0.0, ior=1.45):
    mat = bpy.data.materials.new(nome)
    mat.use_nodes = True
    b = _principled(mat)
    _set(b, "Base Color", (*cor, 1.0))
    _set(b, "Roughness", rugosidade)
    _set(b, "Metallic", metalico)
    _set(b, "IOR", ior)
    return mat


def mat_textura(nome, pasta, escala=1.0, rugosidade_extra=0.0, cor_mistura=None,
                forca_normal=1.0, projecao="BOX", saturacao=1.0, brilho=1.0):
    """Monta PBR a partir de <tex>/<pasta>/<pasta>_{diff,nor,rough}.jpg.

    `escala` aceita numero ou tupla (x, y, z). Projecao BOX dispensa UV e
    funciona bem em peca comprida (poste, cruzeta) sem esticar a textura.
    """
    base = os.path.join(TEX, pasta)
    mat = bpy.data.materials.new(nome)
    mat.use_nodes = True
    nos, links = mat.node_tree.nodes, mat.node_tree.links
    b = _principled(mat)

    if not isinstance(escala, (tuple, list)):
        escala = (escala, escala, escala)
    coord = nos.new("ShaderNodeTexCoord")
    mapa = nos.new("ShaderNodeMapping")
    mapa.inputs["Scale"].default_value = escala
    links.new(coord.outputs["Object"], mapa.inputs["Vector"])

    def img(sufixo, nao_cor=False):
        caminho = os.path.join(base, f"{pasta}_{sufixo}.jpg")
        if not os.path.exists(caminho):
            return None
        no = nos.new("ShaderNodeTexImage")
        no.image = bpy.data.images.load(caminho)
        if nao_cor:
            no.image.colorspace_settings.name = "Non-Color"
        if projecao == "BOX":
            no.projection = "BOX"
            no.projection_blend = 0.25
        links.new(mapa.outputs["Vector"], no.inputs["Vector"])
        return no

    diff = img("diff")
    if diff:
        saida_cor = diff.outputs["Color"]
        if saturacao != 1.0 or brilho != 1.0:
            hs = nos.new("ShaderNodeHueSaturation")
            hs.inputs["Saturation"].default_value = saturacao
            hs.inputs["Value"].default_value = brilho
            links.new(saida_cor, hs.inputs["Color"])
            saida_cor = hs.outputs["Color"]
        if cor_mistura:
            mix = nos.new("ShaderNodeMixRGB")
            mix.blend_type = "MULTIPLY"
            mix.inputs["Fac"].default_value = 1.0
            mix.inputs["Color2"].default_value = (*cor_mistura, 1.0)
            links.new(saida_cor, mix.inputs["Color1"])
            saida_cor = mix.outputs["Color"]
        links.new(saida_cor, b.inputs["Base Color"])

    rough = img("rough", nao_cor=True)
    if rough:
        if rugosidade_extra:
            somar = nos.new("ShaderNodeMath")
            somar.operation = "ADD"
            somar.inputs[1].default_value = rugosidade_extra
            links.new(rough.outputs["Color"], somar.inputs[0])
            links.new(somar.outputs["Value"], b.inputs["Roughness"])
        else:
            links.new(rough.outputs["Color"], b.inputs["Roughness"])

    nor = img("nor", nao_cor=True)
    if nor:
        mapa_n = nos.new("ShaderNodeNormalMap")
        mapa_n.inputs["Strength"].default_value = forca_normal
        links.new(nor.outputs["Color"], mapa_n.inputs["Color"])
        links.new(mapa_n.outputs["Normal"], b.inputs["Normal"])
    return mat


def sujar(mat, escala=6.0, forca=0.35, aspereza=0.25):
    """Quebra a uniformidade: ruido sutil na cor e na rugosidade.

    E a ausencia disso que faz superficie pintada parecer plastico de render.
    """
    nos, links = mat.node_tree.nodes, mat.node_tree.links
    b = _principled(mat)
    ruido = nos.new("ShaderNodeTexNoise")
    ruido.inputs["Scale"].default_value = escala
    ruido.inputs["Detail"].default_value = 8.0
    ruido.inputs["Roughness"].default_value = 0.6

    cor_atual = b.inputs["Base Color"]
    if not cor_atual.is_linked:
        mix = nos.new("ShaderNodeMixRGB")
        mix.blend_type = "MULTIPLY"
        mix.inputs["Fac"].default_value = forca
        mix.inputs["Color1"].default_value = cor_atual.default_value
        links.new(ruido.outputs["Fac"], mix.inputs["Color2"])
        links.new(mix.outputs["Color"], b.inputs["Base Color"])

    rug = b.inputs["Roughness"]
    if not rug.is_linked:
        base = rug.default_value
        mapa = nos.new("ShaderNodeMapRange")
        mapa.inputs["To Min"].default_value = max(0.02, base - aspereza / 2)
        mapa.inputs["To Max"].default_value = min(1.0, base + aspereza / 2)
        links.new(ruido.outputs["Fac"], mapa.inputs["Value"])
        links.new(mapa.outputs["Result"], rug)

    # micro-relevo, tira o aspecto de superficie perfeita
    bump = nos.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    ruido2 = nos.new("ShaderNodeTexNoise")
    ruido2.inputs["Scale"].default_value = escala * 14
    ruido2.inputs["Detail"].default_value = 6.0
    links.new(ruido2.outputs["Fac"], bump.inputs["Height"])
    if not b.inputs["Normal"].is_linked:
        links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return mat


def aplicar(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


# ---------------------------------------------------------------- geometria

def obj_de_bmesh(bm, nome):
    malha = bpy.data.meshes.new(nome)
    bm.to_mesh(malha)
    bm.free()
    obj = bpy.data.objects.new(nome, malha)
    bpy.context.collection.objects.link(obj)
    return obj


def suavizar(obj, angulo=35):
    for p in obj.data.polygons:
        p.use_smooth = True
    m = obj.modifiers.new("suave", "SMOOTH_BY_ANGLE") if "SMOOTH_BY_ANGLE" in \
        {i.identifier for i in bpy.types.Modifier.bl_rna.properties["type"].enum_items} else None
    if m:
        m["Input_1"] = math.radians(angulo)
    return obj


def chanfrar(obj, largura=0.004, segmentos=2, angulo=40):
    """Quebra as quinas da peca — APLICANDO o modificador na hora.

    Antes esta funcao so EMPILHAVA o Bevel e ia embora. Parece inofensivo, e
    nao e: `juntar` usa `bpy.ops.object.join()`, e o join do Blender **descarta
    os modificadores de todo objeto que nao e o ativo**. Como `juntar` elege
    `objs[0]` como ativo, de cada grupo sobrevivia UM chanfro e todo o resto
    chegava no jogo com quina viva.

    Sao 89 chamadas de `chanfrar` no pipeline de arte — 33 no cenario, 20 na
    cabine, 9 no poste. A maioria nunca chegou na tela, e e provavelmente
    metade do "tudo muito chapado" do retorno do cliente: o chanfro estava
    escrito no codigo e nao existia na imagem.

    Aplicar na hora custa poligono (o bevel multiplica aresta), mas e o preco
    de a peca realmente ter a quina quebrada. Quem precisar de peca crua tem
    de simplesmente nao chamar esta funcao.
    """
    for p in obj.data.polygons:
        p.use_smooth = True
    m = obj.modifiers.new("chanfro", "BEVEL")
    m.width = largura
    m.segments = segmentos
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(angulo)
    m.harden_normals = True
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=m.name)
    obj.select_set(False)
    return obj


def perfil_revolucao(pontos, nome, segmentos=32, suave=True):
    """Gira um perfil (x, z) em torno do eixo Z. Perfil deve comecar e terminar no eixo."""
    bm = bmesh.new()
    verts = [bm.verts.new((x, 0.0, z)) for x, z in pontos]
    arestas = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    bmesh.ops.spin(
        bm, geom=verts + arestas, axis=(0, 0, 1), cent=(0, 0, 0),
        dvec=(0, 0, 0), angle=math.radians(360), steps=segmentos, use_merge=True,
    )
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = obj_de_bmesh(bm, nome)
    if suave:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def caixa(nome, tamanho, centro=(0, 0, 0), rot=None):
    """Caixa centrada em `centro`. Se `rot` vier, a GEOMETRIA e girada antes de
    ser movida — usar isso em vez de `obj.rotation_euler` para peca criada fora
    da origem, senao ela gira em torno da origem do objeto e voa para longe."""
    sx, sy, sz = (t / 2 for t in tamanho)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    giro = Euler(rot) if rot else None
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz
        if giro:
            v.co.rotate(giro)
        v.co += Vector(centro)
    obj = obj_de_bmesh(bm, nome)
    return obj


def cilindro(nome, raio, altura, centro=(0, 0, 0), segmentos=32, tampas=True,
             rot=None):
    """Cilindro no eixo Z. Ver a nota de `rot` em caixa()."""
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=tampas, cap_tris=False, segments=segmentos,
        radius1=raio, radius2=raio, depth=altura,
    )
    giro = Euler(rot) if rot else None
    for v in bm.verts:
        if giro:
            v.co.rotate(giro)
        v.co += Vector(centro)
    obj = obj_de_bmesh(bm, nome)
    for p in obj.data.polygons:
        if abs(p.normal.z) < 0.9:
            p.use_smooth = True
    return obj


def barra(nome, p0, p1, secao=(0.05, 0.006)):
    """Cantoneira/barra chata ligando dois pontos no espaco."""
    a, b = Vector(p0), Vector(p1)
    d = b - a
    obj = caixa(nome, (d.length, secao[0], secao[1]))
    obj.rotation_euler = d.to_track_quat("X", "Z").to_euler()
    obj.location = (a + b) / 2
    chanfrar(obj, largura=0.003, segmentos=2)
    return obj


def parafuso(nome, pos, eixo="Z", raio=0.011, comprimento=0.14):
    p = cilindro(nome, raio, comprimento, (0, 0, 0), segmentos=12)
    cab = cilindro(nome + "_cab", raio * 1.9, 0.014,
                   (0, 0, comprimento / 2 + 0.007), segmentos=6)
    obj = juntar([p, cab], nome)
    if eixo == "Y":
        obj.rotation_euler = (math.radians(90), 0, 0)
    elif eixo == "X":
        obj.rotation_euler = (0, math.radians(90), 0)
    obj.location = pos
    return obj


def juntar(objs, nome):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    objs[0].name = nome
    return objs[0]


def estriar(mat, escala=260.0, forca=0.30):
    """Relevo helicoidal: da ao condutor o aspecto de cabo encordoado."""
    nos, links = mat.node_tree.nodes, mat.node_tree.links
    b = _principled(mat)
    coord = nos.new("ShaderNodeTexCoord")
    onda = nos.new("ShaderNodeTexWave")
    onda.wave_type = "BANDS"
    onda.bands_direction = "DIAGONAL"
    onda.inputs["Scale"].default_value = escala
    onda.inputs["Distortion"].default_value = 0.0
    links.new(coord.outputs["Object"], onda.inputs["Vector"])
    bump = nos.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = forca
    links.new(onda.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return mat


def anel(nome, raio=0.05, espessura=0.004, pos=(0, 0, 0), rot=(0, 0, 0)):
    """Aro de arame: serve de amarracao do condutor no isolador."""
    curva = bpy.data.curves.new(nome, "CURVE")
    curva.dimensions = "3D"
    curva.bevel_depth = espessura
    curva.bevel_resolution = 3
    curva.resolution_u = 6
    spline = curva.splines.new("BEZIER")
    n = 8
    spline.bezier_points.add(n - 1)
    spline.use_cyclic_u = True
    for i, bp in enumerate(spline.bezier_points):
        a = i * (2 * math.pi / n)
        bp.co = (math.cos(a) * raio, math.sin(a) * raio, 0.0)
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(nome, curva)
    obj.location = pos
    obj.rotation_euler = rot
    bpy.context.collection.objects.link(obj)
    return obj
