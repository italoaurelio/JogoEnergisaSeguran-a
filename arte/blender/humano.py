"""
Geracao do personagem: corpo parametrico (MPFB) + olhos + luz de vestiario.

O MPFB entrega o corpo e a pele; nao entrega olho, sobrancelha nem cabelo -
esses vem de pacotes de asset que nao instalamos. Olho e sobrancelha sao
modelados aqui, que e barato e da controle sobre o poligono que vai pro glTF.
"""
import sys, os, math, bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comum as C

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService
from bl_ext.user_default.mpfb.services.materialservice import MaterialService
from bl_ext.user_default.mpfb.services.nodeservice import NodeService


# ------------------------------------------------------------------ fisico

def macro(genero=0.95, idade=0.55, musculo=0.6, peso=0.5, altura=0.5,
          proporcao=0.5, etnia=(0.15, 0.45, 0.40)):
    """As alavancas fisicas do personagem. etnia = (asiatica, caucasiana, africana)."""
    d = TargetService.get_default_macro_info_dict()
    d.update(gender=genero, age=idade, muscle=musculo, weight=peso,
             height=altura, proportions=proporcao)
    d["race"] = {"asian": etnia[0], "caucasian": etnia[1], "african": etnia[2]}
    return d


def criar_corpo(macro_dict=None, nome="corpo", tom=(0.40, 0.22, 0.14)):
    """Corpo com a pele v2 do MPFB. `tom` e a cor base da pele."""
    corpo = HumanService.create_human(
        mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True,
        feet_on_ground=True, scale=0.1,
        macro_detail_dict=macro_dict or macro())
    corpo.name = nome

    mat = MaterialService.create_v2_skin_material("pele_" + nome, corpo)
    MaterialService.create_and_assign_material_slots(corpo)
    definir_tom(corpo, tom)
    return corpo


def definir_tom(corpo, cor):
    """Troca a cor da pele, e junto dela a das regioes que derivam do tom.

    Unha, labio e auréola tem cor propria no MasterColor e NAO acompanham a
    SkinColor. Deixando no padrao, a unha fica quase branca e o labio rosa
    forte: num corpo de tom escuro isso vira mancha clara na mao e na boca, e
    e a primeira coisa que salta aos olhos no jogo.
    """
    r, v, a = cor
    derivadas = {
        "FingernailsColor": (r * 1.22, v * 1.16, a * 1.12),
        "ToenailsColor": (r * 1.22, v * 1.16, a * 1.12),
        "LipsColor": (r * 1.10, v * 0.82, a * 0.80),
        "AureolaeColor": (r * 0.80, v * 0.66, a * 0.62),
        "EyelidColor": (r * 0.72, v * 0.60, a * 0.56),
        "GenitalsColor": (r * 0.85, v * 0.72, a * 0.68),
    }
    for slot in corpo.material_slots:
        if not slot.material or not slot.material.node_tree:
            continue
        mc = NodeService.find_first_group_node_by_tree_name(
            slot.material.node_tree, "MpfbSkinMasterColor")
        if not mc:
            continue
        if "SkinColor" in mc.inputs:
            mc.inputs["SkinColor"].default_value = (*cor, 1.0)
            # sem ligar o override a cor fica so decorando o no
            if "SkinOverride" in mc.inputs:
                mc.inputs["SkinOverride"].default_value = 1.0
        for nome, valor in derivadas.items():
            if nome in mc.inputs:
                mc.inputs[nome].default_value = (*valor, 1.0)
            chave = nome.replace("Color", "Override")
            chave = {"AurolaeOverride": "AurolaeOverride"}.get(chave, chave)
            for entrada in mc.inputs:
                if entrada.name.lower() == chave.lower():
                    entrada.default_value = 1.0


# ------------------------------------------------------------------ olhos

def _caixa_do_grupo(obj, nome_grupo, repouso=False):
    """Centro e raio do grupo de vertices, em coordenadas de mundo.

    Le a malha AVALIADA: `v.co` da malha crua ignora as shape keys, e o corpo do
    MPFB e todo feito de shape key (cada alavanca fisica e uma). Usar a malha
    crua poe o olho no lugar onde o olho estaria num corpo que nao existe.

    Os modificadores ficam desligados durante a leitura porque a mascara
    "Hide helpers" apaga exatamente os vertices de helper-*-eye que queremos.
    """
    idx = obj.vertex_groups[nome_grupo].index
    membros = [v.index for v in obj.data.vertices
               if any(g.group == idx for g in v.groups)]
    if not membros:
        return None, 0.0

    estado = [(m, m.show_viewport) for m in obj.modifiers]
    for m, _ in estado:
        if m.type != "ARMATURE" or repouso:
            m.show_viewport = False
    try:
        dep = bpy.context.evaluated_depsgraph_get()
        malha = obj.evaluated_get(dep).to_mesh()
        pts = [obj.matrix_world @ malha.vertices[i].co.copy() for i in membros]
        obj.evaluated_get(dep).to_mesh_clear()
    finally:
        for m, visivel in estado:
            m.show_viewport = visivel

    mn = Vector((min(p[i] for p in pts) for i in range(3)))
    mx = Vector((max(p[i] for p in pts) for i in range(3)))
    return (mn + mx) / 2, max((mx - mn)) / 2


def mat_olho(nome="olho", iris=(0.06, 0.035, 0.018)):
    """Esclera com iris e pupila por coordenada gerada. Procedural: vai ser assado."""
    mat = bpy.data.materials.new(nome)
    mat.use_nodes = True
    nt = mat.node_tree
    nos, links = nt.nodes, nt.links
    nos.clear()

    saida = nos.new("ShaderNodeOutputMaterial")
    bsdf = nos.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.08
    bsdf.inputs["IOR"].default_value = 1.38
    links.new(bsdf.outputs["BSDF"], saida.inputs["Surface"])

    # distancia ao eixo de visada (-Y), medida na coordenada gerada
    coord = nos.new("ShaderNodeTexCoord")
    sep = nos.new("ShaderNodeSeparateXYZ")
    links.new(coord.outputs["Generated"], sep.inputs["Vector"])

    # Generated vai de 0 a 1; centro em 0.5. Raio no plano XZ.
    comb = nos.new("ShaderNodeCombineXYZ")
    for eixo, saida_eixo in (("X", "X"), ("Y", "Z")):
        sub = nos.new("ShaderNodeMath")
        sub.operation = "SUBTRACT"
        sub.inputs[1].default_value = 0.5
        links.new(sep.outputs[saida_eixo], sub.inputs[0])
        links.new(sub.outputs[0], comb.inputs[eixo])
    comb.inputs["Z"].default_value = 0.0

    raio = nos.new("ShaderNodeVectorMath")
    raio.operation = "LENGTH"
    links.new(comb.outputs["Vector"], raio.inputs[0])

    rampa = nos.new("ShaderNodeValToRGB")
    r = rampa.color_ramp
    r.interpolation = "CONSTANT"
    r.elements[0].position = 0.0
    r.elements[0].color = (0.005, 0.005, 0.005, 1)          # pupila
    e = r.elements.new(0.105); e.color = (*iris, 1)          # iris
    e = r.elements.new(0.135); e.color = (0.02, 0.012, 0.008, 1)  # limbo
    e = r.elements.new(0.155); e.color = (0.62, 0.60, 0.58, 1)    # esclera
    links.new(raio.outputs["Value"], rampa.inputs["Fac"])
    links.new(rampa.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def criar_olhos(corpo, material=None):
    """Duas esferas dimensionadas pelos grupos helper-l-eye / helper-r-eye."""
    mat = material or mat_olho()
    olhos = []
    for lado in ("l", "r"):
        centro, raio = _caixa_do_grupo(corpo, f"helper-{lado}-eye")
        if centro is None:
            continue
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=32, ring_count=16, radius=raio * 0.92, location=centro)
        olho = bpy.context.object
        olho.name = f"olho_{lado}"
        C.suavizar(olho, 60)
        C.aplicar(olho, mat)
        olho.parent = corpo
        olho.matrix_parent_inverse = corpo.matrix_world.inverted()
        olhos.append(olho)
    return olhos


# ------------------------------------------------------------------ luz

def luz_vestiario():
    """Luz de ambiente coberto: principal suave, preenchimento e contorno.

    Nada de sol direto aqui - o vestiario e dentro, e luz dura no rosto e o que
    mais entrega personagem de computador.
    """
    def area(nome, pos, alvo, energia, tamanho, cor=(1, 1, 1)):
        dados = bpy.data.lights.new(nome, type="AREA")
        dados.energy = energia
        dados.size = tamanho
        dados.color = cor
        obj = bpy.data.objects.new(nome, dados)
        bpy.context.collection.objects.link(obj)
        obj.location = Vector(pos)
        direcao = Vector(alvo) - Vector(pos)
        obj.rotation_euler = direcao.to_track_quat("-Z", "Y").to_euler()
        return obj

    area("principal", (-1.1, -1.6, 2.15), (0, 0, 1.45), 90, 1.8)
    area("preenchimento", (1.5, -1.2, 1.35), (0, 0, 1.40), 28, 2.2, (0.86, 0.90, 1.0))
    area("contorno", (0.9, 1.5, 2.3), (0, 0, 1.55), 26, 1.6, (1.0, 0.95, 0.88))


# ------------------------------------------------------------- pelo e cabelo

def mat_pelo(nome="pelo", cor=(0.012, 0.007, 0.004), rugosidade=0.62):
    """Preto-acastanhado fosco. Serve para cabelo, sobrancelha e barba."""
    return C.mat_simples(nome, cor, rugosidade=rugosidade)


def _no_mascara_elipsoide(nt, centro, raios, suavidade=0.35):
    """Devolve o socket de uma mascara elipsoide em coordenadas de objeto.

    Sobrancelha recortada em geometria vira laje preta na testa: a superficie da
    testa e quase vertical, entao engrossar pela normal empurra a peca para
    fora do rosto. Mascara no shader nao tem esse problema, tem borda macia, e
    assa junto com a pele no mapa de cor que vai para o glTF.
    """
    coord = nt.nodes.new("ShaderNodeTexCoord")
    desloc = nt.nodes.new("ShaderNodeVectorMath")
    desloc.operation = "SUBTRACT"
    desloc.inputs[1].default_value = centro
    nt.links.new(coord.outputs["Object"], desloc.inputs[0])

    escala = nt.nodes.new("ShaderNodeVectorMath")
    escala.operation = "DIVIDE"
    escala.inputs[1].default_value = raios
    nt.links.new(desloc.outputs["Vector"], escala.inputs[0])

    dist = nt.nodes.new("ShaderNodeVectorMath")
    dist.operation = "LENGTH"
    nt.links.new(escala.outputs["Vector"], dist.inputs[0])

    rampa = nt.nodes.new("ShaderNodeValToRGB")
    rampa.color_ramp.elements[0].position = max(0.0, 1.0 - suavidade)
    rampa.color_ramp.elements[0].color = (1, 1, 1, 1)
    rampa.color_ramp.elements[1].position = 1.0
    rampa.color_ramp.elements[1].color = (0, 0, 0, 1)
    nt.links.new(dist.outputs["Value"], rampa.inputs["Fac"])
    return rampa.outputs["Color"]


def _no_mascara_plano(nt, normal, limite, suavidade=0.012):
    """Mascara de meio-espaco: liga onde dot(coordenada, normal) > limite.

    Usa Map Range e nao ColorRamp: a posicao dos pontos da ColorRamp e grampeada
    em [0,1], e o limite aqui e uma altura em metros (1,66 na cabeca). Com
    ColorRamp os dois pontos caem juntos em 1.0 e a mascara nunca liga - some
    sem dar erro nenhum.
    """
    coord = nt.nodes.new("ShaderNodeTexCoord")
    proj = nt.nodes.new("ShaderNodeVectorMath")
    proj.operation = "DOT_PRODUCT"
    proj.inputs[1].default_value = normal
    nt.links.new(coord.outputs["Object"], proj.inputs[0])

    faixa = nt.nodes.new("ShaderNodeMapRange")
    faixa.clamp = True
    faixa.inputs["From Min"].default_value = limite - suavidade
    faixa.inputs["From Max"].default_value = limite + suavidade
    faixa.inputs["To Min"].default_value = 0.0
    faixa.inputs["To Max"].default_value = 1.0
    nt.links.new(proj.outputs["Value"], faixa.inputs["Value"])
    return faixa.outputs["Result"]


def _no_mascara_grupo(nt, nome_grupo, dureza=0.45):
    """Mascara vinda de um grupo de vertices da propria malha.

    O grupo entra no shader como atributo de geometria. E o jeito mais fiel de
    marcar uma regiao: a linha do cabelo ja esta desenhada na topologia do
    MakeHuman (grupo `scalp`), entao nao ha por que aproximar com elipsoide.
    """
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_type = "GEOMETRY"
    attr.attribute_name = nome_grupo

    faixa = nt.nodes.new("ShaderNodeMapRange")
    faixa.clamp = True
    faixa.inputs["From Min"].default_value = max(0.0, dureza - 0.12)
    faixa.inputs["From Max"].default_value = min(1.0, dureza + 0.12)
    nt.links.new(attr.outputs["Fac"], faixa.inputs["Value"])
    return faixa.outputs["Result"]


def pintar_regioes(corpo, regioes, cor=(0.016, 0.010, 0.006),
                   saidas=("SkinColor", "VeinColor", "SpotColor")):
    """Escurece a pele nas regioes dadas.

    Cada regiao e ("elipsoide", centro, raios, suavidade) ou
    ("plano", normal, limite, suavidade).

    A pele v2 do MPFB nao tem Principled no nivel de cima: e um grupo por
    secao do corpo (MpfbBody, MpfbFace, MpfbEars...), todos alimentados pela
    saida SkinColor do MasterColor. Entao o lugar de entrar e nessa saida -
    uma unica mistura, e as tres secoes ja pegam a sobrancelha junto. Procurar
    BSDF_PRINCIPLED em nt.nodes nao acha nada e a pintura some sem erro.

    Veia e mancha vem por saidas proprias do MasterColor. Escurecendo so a
    SkinColor, elas continuam com a cor de pele por baixo do cabelo preto e
    aparecem como manchas roxas no couro cabeludo - por isso `saidas` cobre as
    tres de uma vez.
    """
    if not regioes:
        return
    vistos = set()
    for slot in corpo.material_slots:
        mat = slot.material
        if not mat or not mat.node_tree or mat.name in vistos:
            continue
        vistos.add(mat.name)
        nt = mat.node_tree

        porsaida = {}
        for l in nt.links:
            if (l.from_node.type == "GROUP"
                    and l.from_node.node_tree.name == "MpfbSkinMasterColor"
                    and l.from_socket.name in saidas):
                porsaida.setdefault(l.from_socket.name, []).append(l)
        if not porsaida:
            continue

        combinada = None
        for tipo, a, b, suave in regioes:
            if tipo == "elipsoide":
                m = _no_mascara_elipsoide(nt, a, b, suave)
            elif tipo == "grupo":
                m = _no_mascara_grupo(nt, a, suave)
            else:
                m = _no_mascara_plano(nt, a, b, suave)
            if combinada is None:
                combinada = m
            else:
                maior = nt.nodes.new("ShaderNodeMath")
                maior.operation = "MAXIMUM"
                nt.links.new(combinada, maior.inputs[0])
                nt.links.new(m, maior.inputs[1])
                combinada = maior.outputs["Value"]

        for alvos in porsaida.values():
            origem = alvos[0].from_socket
            destinos = [l.to_socket for l in alvos]

            mistura = nt.nodes.new("ShaderNodeMix")
            mistura.data_type = "RGBA"
            mistura.blend_type = "MIX"
            nt.links.new(combinada, mistura.inputs["Factor"])
            nt.links.new(origem, mistura.inputs[6])          # A
            mistura.inputs[7].default_value = (*cor, 1.0)    # B

            for ligacao in alvos:
                nt.links.remove(ligacao)
            for entrada in destinos:
                nt.links.new(mistura.outputs[2], entrada)


def sobrancelhas(corpo, olhos, cor=(0.016, 0.010, 0.006)):
    """Arco superciliar, um elipsoide achatado por olho."""
    regioes = []
    for olho in olhos:
        cx, cy, cz = olho.location
        regioes.append(("elipsoide",
                        (cx * 1.06, cy - 0.008, cz + 0.020),
                        (0.032, 0.024, 0.0085), 0.55))
    pintar_regioes(corpo, regioes, cor)


def recortar_grupo(corpo, nome_grupo, nome, peso_min=0.25,
                   deslocar=0.0015, espessura=0.003):
    """Recorta a superficie do corpo onde o grupo de vertices tem peso."""
    idx = corpo.vertex_groups[nome_grupo].index
    pesos = {}
    for v in corpo.data.vertices:
        for g in v.groups:
            if g.group == idx:
                pesos[v.index] = g.weight
    return recortar(corpo, lambda i, co: pesos.get(i, 0.0) >= peso_min,
                    nome, deslocar=deslocar, espessura=espessura)


def recortar(corpo, teste, nome, deslocar=0.0015, espessura=0.003, suave=50,
             so_corpo=True, subdividir=0, reduzir=1.0, repouso=False):
    """Recorta a superficie do corpo onde `teste(indice, coordenada)` vale.

    Recortar da propria malha garante assentamento perfeito, e faz a peca
    acompanhar sozinha o fisico que o jogador escolheu - shrinkwrap erra em
    orelha e em qualquer curvatura forte, e roupa modelada solta so serve para
    um corpo.

    `so_corpo` filtra a geometria de helper do MakeHuman. Ela e invisivel no
    render porque o modificador de mascara a esconde - mas o recorte desliga os
    modificadores para poder ler as shape keys, entao ela volta. Entre os
    helpers ha um `helper-skirt`, que e uma saia de verdade em volta das pernas:
    sem esse filtro a calca sai como um vestido ate o tornozelo.

    `repouso=True` roda o TESTE na malha em pose de descanso e constroi a peca
    a partir da malha POSADA. As duas tem a mesma topologia, entao a face que
    o teste aprova em repouso e a mesma face no corpo posado.

    Por que isso importa: um teste escrito como caixa em z/x de mundo so quer
    dizer o que pretende enquanto o corpo esta na pose em que foi escrito. Com
    a armadura ligada o mesmo teste no motorista SENTADO cortava a camisa na
    diagonal — deixava o antebraco nu e picava a mao em lascas azuis (ver
    `arte/render/epi_luva.png` de 06/10). Quem usar isto precisa passar
    `referencias(corpo, repouso=True)`: a caixa e as referencias tem de estar
    no MESMO espaco.
    """
    import bmesh
    do_corpo = None
    if so_corpo and "body" in corpo.vertex_groups:
        idx = corpo.vertex_groups["body"].index
        do_corpo = {v.index for v in corpo.data.vertices
                    if any(g.group == idx for g in v.groups)}

    # a armadura FICA ligada: desligar tudo devolveria o corpo em pose de
    # descanso, e as pecas recortadas de um corpo sentado sairiam em pe
    estado = [(m, m.show_viewport) for m in corpo.modifiers]
    for m, _ in estado:
        if m.type != "ARMATURE":
            m.show_viewport = False
    try:
        dep = bpy.context.evaluated_depsgraph_get()
        aval = corpo.evaluated_get(dep)
        origem = aval.to_mesh()
        bm = bmesh.new()
        bm.from_mesh(origem)
        aval.to_mesh_clear()
    finally:
        for m, visivel in estado:
            m.show_viewport = visivel

    # centro de cada face no corpo em DESCANSO, para o teste rodar ali
    centros_repouso = None
    if repouso:
        estado = [(m, m.show_viewport) for m in corpo.modifiers]
        for m, _ in estado:
            m.show_viewport = False
        try:
            dep = bpy.context.evaluated_depsgraph_get()
            aval = corpo.evaluated_get(dep)
            malha = aval.to_mesh()
            centros_repouso = [corpo.matrix_world @ f.center.copy()
                               for f in malha.polygons]
            aval.to_mesh_clear()
        finally:
            for m, visivel in estado:
                m.show_viewport = visivel

    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    mundo = corpo.matrix_world
    # o teste vale no CENTRO da face, nao em todos os vertices dela: exigir
    # todos recorta a peca em escada, porque cada face so entra quando o
    # quadrado inteiro cabe dentro da regiao. No centro a borda sai lisa.
    fora = []
    for f in bm.faces:
        if do_corpo is not None and not all(v.index in do_corpo for v in f.verts):
            fora.append(f)
            continue
        centro = (centros_repouso[f.index] if centros_repouso is not None
                  else mundo @ f.calc_center_median())
        indice = min(v.index for v in f.verts)
        if not teste(indice, centro):
            fora.append(f)
    bmesh.ops.delete(bm, geom=fora, context="FACES")
    if not bm.faces:
        bm.free()
        return None

    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * deslocar

    obj = C.obj_de_bmesh(bm, nome)
    obj.matrix_world = corpo.matrix_world.copy()
    if espessura:
        mod = obj.modifiers.new("espessura", "SOLIDIFY")
        mod.thickness = espessura
        mod.offset = 1.0
    if subdividir:
        # a malha do corpo e grossa demais para uma tira de 4 cm: mesmo testando
        # o centro da face, a borda sai serrilhada. Subdividir depois de
        # engrossar arredonda a borda e a quina, que e o que faz a peca parecer
        # tecido em vez de recorte de papel.
        mod = obj.modifiers.new("arredondar", "SUBSURF")
        mod.levels = subdividir
        mod.render_levels = subdividir
    if reduzir and reduzir < 1.0:
        # ... mas subdividir multiplica a malha por 4, e uma camiseta recortada
        # do corpo passava de 75 mil triangulos. Decimar DEPOIS do subsurf
        # devolve a silhueta arredondada com um terco do custo.
        mod = obj.modifiers.new("reduzir", "DECIMATE")
        mod.ratio = reduzir
    C.suavizar(obj, suave)
    obj.parent = corpo
    obj.matrix_parent_inverse = corpo.matrix_world.inverted()
    return obj


def cabelo(corpo, cor=(0.016, 0.011, 0.008), comprimento=0.004, peso_min=0.12):
    """Corte raspado: calota recortada pelo grupo `scalp` da propria malha.

    Duas tentativas anteriores nao servem e ficam registradas para nao voltarem:

    - Recortar por altura fixa vira boina: o corte sai reto e nao acompanha a
      linha do cabelo. O grupo `scalp` do MakeHuman ja tem essa linha desenhada.
    - Pintar o cabelo na pele (como a sobrancelha) parece certo e nao e: a
      pintura so troca a cor base, a pele continua com a especularidade dela, e
      o preto reflete a luz de preenchimento como se fosse uma careca lustrosa.
      Cabelo precisa de rugosidade propria, entao precisa de material proprio.

    Malha separada ainda resolve o jogo: o cabelo some junto quando entra o
    capacete, sem tocar no material da pele.
    """
    if "scalp" not in corpo.vertex_groups:
        return None
    peca = recortar_grupo(corpo, "scalp", "cabelo", peso_min=peso_min,
                          deslocar=0.0012, espessura=comprimento)
    if peca:
        C.aplicar(peca, mat_pelo("cabelo", cor=cor, rugosidade=0.82))
    return peca


def vestir_pelo(corpo, olhos, cor=(0.014, 0.009, 0.005)):
    """Cabelo e sobrancelha, ambos pintados na pele."""
    peca = cabelo(corpo, cor=cor)
    sobrancelhas(corpo, olhos, cor=cor)
    return [peca] if peca else []


# ------------------------------------------------------------- referencias

def referencias(corpo, repouso=False):
    """Pontos anatomicos do corpo, para assentar EPI em qualquer fisico.

    Tudo o que e peca rigida (capacete, botina, luva) se posiciona por aqui, e
    nao por numero fixo - senao o capacete flutua no personagem alto e afunda
    no baixo.

    `repouso=True` devolve os mesmos pontos com a ARMADURA DESLIGADA, isto e,
    no corpo em pose de descanso. Serve para quem recorta por regiao (camisa,
    calca, roupa de baixo): um limite escrito em z de mundo so quer dizer
    "altura da gola" enquanto o corpo esta em pe. No motorista sentado o mesmo
    z corta o personagem na diagonal. Ver `recortar(repouso=True)`, que e a
    outra metade do par — os dois andam juntos ou nenhum dos dois serve.
    """
    import bmesh
    ref = {}
    for g in corpo.vertex_groups:
        if g.name.startswith("joint-"):
            c, _ = _caixa_do_grupo(corpo, g.name, repouso=repouso)
            if c:
                ref[g.name[6:]] = c

    # a armadura FICA ligada: desligar tudo devolveria o corpo em pose de
    # descanso, e as pecas recortadas de um corpo sentado sairiam em pe
    estado = [(m, m.show_viewport) for m in corpo.modifiers]
    for m, _ in estado:
        if m.type != "ARMATURE" or repouso:
            m.show_viewport = False
    try:
        dep = bpy.context.evaluated_depsgraph_get()
        aval = corpo.evaluated_get(dep)
        malha = aval.to_mesh()
        pts = [corpo.matrix_world @ v.co.copy() for v in malha.vertices]
        aval.to_mesh_clear()
    finally:
        for m, visivel in estado:
            m.show_viewport = visivel

    ref["altura"] = max(p.z for p in pts)
    craneo = [p for p in pts if p.z > ref["head"].z + 0.05]
    ref["cabeca_raio"] = max(abs(p.x) for p in craneo) if craneo else 0.09
    ref["cabeca_fundo"] = max(p.y for p in craneo) if craneo else 0.07
    ref["cabeca_frente"] = min(p.y for p in craneo) if craneo else -0.11
    return ref


# -------------------------------------------------------------- superficie

def superficie(corpo, filtro=None):
    """Arvore BVH da pele do personagem, para assentar peca em cima dela.

    Usa a malha avaliada (shape keys valendo) e so as faces do grupo `body` -
    a geometria de helper do MakeHuman fica de fora, senao o `helper-skirt`
    rouba a projecao das pernas.
    """
    from mathutils.bvhtree import BVHTree

    do_corpo = None
    if "body" in corpo.vertex_groups:
        idx = corpo.vertex_groups["body"].index
        do_corpo = {v.index for v in corpo.data.vertices
                    if any(g.group == idx for g in v.groups)}

    # a armadura FICA ligada: desligar tudo devolveria o corpo em pose de
    # descanso, e as pecas recortadas de um corpo sentado sairiam em pe
    estado = [(m, m.show_viewport) for m in corpo.modifiers]
    for m, _ in estado:
        if m.type != "ARMATURE":
            m.show_viewport = False
    try:
        dep = bpy.context.evaluated_depsgraph_get()
        aval = corpo.evaluated_get(dep)
        malha = aval.to_mesh()
        mundo = corpo.matrix_world
        verts = [mundo @ v.co.copy() for v in malha.vertices]
        faces = []
        for p in malha.polygons:
            if do_corpo is not None and not all(v in do_corpo for v in p.vertices):
                continue
            if filtro is not None and not filtro(mundo @ p.center):
                continue
            faces.append(list(p.vertices))
        aval.to_mesh_clear()
    finally:
        for m, visivel in estado:
            m.show_viewport = visivel

    return BVHTree.FromPolygons(verts, faces, all_triangles=False)


def projetar(arvore, ponto, folga=0.0):
    """Ponto mais proximo na pele, afastado `folga` pela normal. Devolve (p, n)."""
    loc, nor, _, _ = arvore.find_nearest(Vector(ponto))
    if loc is None:
        return Vector(ponto), Vector((0, -1, 0))
    return loc + nor * folga, nor


def secao(arvore, centro, u, v, n=48, alcance=0.6, suavizar=2):
    """Contorno do corpo num plano, tracado por raio a partir de dentro.

    Devolve [(ponto, normal)] em volta do eixo. Substitui projetar uma
    circunferencia de fora: `find_nearest` colapsa varios pontos seguidos no
    mesmo canto quando a superficie acaba (borda do tronco filtrado, axila), e
    a fita sai dobrada sobre si mesma. Partindo de dentro, cada angulo devolve
    exatamente um ponto do contorno, ou nenhum.
    """
    centro = Vector(centro)
    u = Vector(u).normalized()
    v = Vector(v).normalized()
    direcoes, raios, normais = [], [], []
    for i in range(n):
        a = 2 * math.pi * i / n
        d = (u * math.cos(a) + v * math.sin(a)).normalized()
        golpe = arvore.ray_cast(centro, d, alcance)
        if not golpe or golpe[0] is None:
            continue
        direcoes.append(d)
        raios.append((golpe[0] - centro).length)
        normais.append(golpe[1])
    if len(raios) < 8:
        return []

    # media movel circular no raio. O peitoral e a axila nao sao convexos: um
    # angulo pega a dobra e o vizinho pega a costela, e a fita sai com dentes.
    # Suavizar o raio tira o pico e mantem a forma.
    for _ in range(suavizar):
        m = len(raios)
        raios = [(raios[(i - 1) % m] + 2 * raios[i] + raios[(i + 1) % m]) / 4
                 for i in range(m)]

    return [(centro + direcoes[i] * raios[i], normais[i])
            for i in range(len(raios))]


def varredura(arvore, origens, direcao, alcance=0.6):
    """Contorno tracado por raios paralelos. Devolve [(ponto, normal)].

    Serve para peca que corre ao longo do corpo (carcela no peito, costura na
    perna): `projetar` erra nessas porque o peito nao e liso e o ponto mais
    proximo pula entre o peitoral e o esterno, deixando a tira rasgada.
    """
    d = Vector(direcao).normalized()
    saida = []
    for o in origens:
        golpe = arvore.ray_cast(Vector(o), d, alcance)
        if golpe and golpe[0] is not None:
            saida.append((golpe[0], golpe[1]))
    return saida


def limites(corpo, teste, so_corpo=True):
    """Caixa envolvente da regiao do corpo onde `teste(coordenada)` vale.

    Filtra a geometria de helper como `recortar` e `superficie`. Sem isso a
    medida sai errada e em silencio: a caixa do pe passa a ter 23 cm de largura
    porque a gaiola do helper entra na conta, e tudo que se dimensiona ou se
    centra por ela nasce grande e fora do eixo.
    """
    do_corpo = None
    if so_corpo and "body" in corpo.vertex_groups:
        idx = corpo.vertex_groups["body"].index
        do_corpo = {v.index for v in corpo.data.vertices
                    if any(g.group == idx for g in v.groups)}
    # a armadura FICA ligada: desligar tudo devolveria o corpo em pose de
    # descanso, e as pecas recortadas de um corpo sentado sairiam em pe
    estado = [(m, m.show_viewport) for m in corpo.modifiers]
    for m, _ in estado:
        if m.type != "ARMATURE":
            m.show_viewport = False
    try:
        dep = bpy.context.evaluated_depsgraph_get()
        aval = corpo.evaluated_get(dep)
        malha = aval.to_mesh()
        mundo = corpo.matrix_world
        pts = [mundo @ v.co.copy() for i, v in enumerate(malha.vertices)
               if do_corpo is None or i in do_corpo]
        aval.to_mesh_clear()
    finally:
        for m, visivel in estado:
            m.show_viewport = visivel
    dentro = [p for p in pts if teste(p)]
    if not dentro:
        return None, None
    mn = Vector((min(p[i] for p in dentro) for i in range(3)))
    mx = Vector((max(p[i] for p in dentro) for i in range(3)))
    return mn, mx


# ------------------------------------------------------------------ pose

def adicionar_rig(corpo, nome_rig="game_engine"):
    """Poe o rig no corpo. Devolve a armadura."""
    HumanService.add_builtin_rig(corpo, nome_rig)
    return next((o for o in bpy.context.scene.objects if o.type == "ARMATURE"
                 and o.name.startswith(corpo.name)), None)


def _flexionar(arm, osso, graus, eixo=(1, 0, 0)):
    """Gira o osso em torno de um eixo dado NO ESPACO DA ARMADURA.

    Angulo em euler local nao serve: cada osso do rig tem rotacao de repouso
    propria (o `roll`), entao o mesmo valor em X dobra o quadril de um jeito e
    o joelho de outro, e o resultado sai torto e assimetrico. Convertendo o
    eixo do mundo para o espaco de repouso do osso, "dobrar o joelho" vira uma
    instrucao unica que vale para os dois lados.

    Como a conversao usa a matriz de REPOUSO, o eixo acompanha o pai: o joelho
    continua sendo dobradica da coxa depois que a coxa gira, que e o
    comportamento certo de uma articulacao.
    """
    from mathutils import Quaternion
    b = arm.pose.bones.get(osso)
    if not b:
        return
    base = b.bone.matrix_local.to_3x3()
    eixo_local = (base.inverted() @ Vector(eixo)).normalized()
    b.rotation_mode = "QUATERNION"
    b.rotation_quaternion = Quaternion(eixo_local, math.radians(graus))


def _girar(arm, osso, *passos):
    """Compoe VARIAS rotacoes no mesmo osso, cada uma com seu eixo de mundo.

    `_flexionar` ESCREVE `rotation_quaternion`, entao duas chamadas seguidas
    no mesmo osso nao somam: a segunda apaga a primeira. Para o braco em
    descanso isso nao serve — ele precisa descer (eixo da frente) E girar um
    pouco para dentro (eixo de cima) ao mesmo tempo.

    `passos` sao pares (graus, eixo), aplicados na ordem dada.
    """
    from mathutils import Quaternion
    b = arm.pose.bones.get(osso)
    if not b:
        return
    base = b.bone.matrix_local.to_3x3()
    total = Quaternion()
    for graus, eixo in passos:
        eixo_local = (base.inverted() @ Vector(eixo)).normalized()
        total = total @ Quaternion(eixo_local, math.radians(graus))
    b.rotation_mode = "QUATERNION"
    b.rotation_quaternion = total


def pose_descanso(arm):
    """Pessoa EM PE E PARADA, que e coisa diferente de pose de repouso.

    O personagem do vestiario nao tinha rig nenhum: saia na pose de descanso
    do MPFB, com os bracos abertos a quase 45 graus. Aquilo e pose de
    MODELAGEM — existe para a malha deformar bem, nao para alguem olhar. Era
    disso que vinha o "duraco, reto" do retorno do cliente, e nenhuma
    animacao de respiracao no jogo conserta um boneco de manequim.

    O que faz ler como gente parada, em ordem de importancia:

    1. BRACOS PARA BAIXO. 42 graus de aducao deixam o braco caindo rente ao
       tronco, com o cotovelo a 9 graus — braco humano parado nunca esta
       reto, e braco totalmente colado le como soldado em forma.
    2. ASSIMETRIA. Os dois lados NAO recebem o mesmo angulo. Corpo simetrico
       e a marca registrada de boneco; 3 ou 4 graus de diferenca entre um
       braco e o outro ja desfazem isso sem ninguem notar o porque.
    3. PESO NUMA PERNA SO. A bacia inclina 3 graus e o ombro compensa do
       outro lado — e o contraposto que todo mundo faz em pe sem perceber.

    Posar ANTES de recortar a roupa faz a roupa nascer na pose, como no
    motorista sentado: as pecas saem da superficie do corpo ja deformada.
    """
    # contraposto: peso na perna esquerda, bacia e ombros em sentidos opostos
    _girar(arm, "pelvis", (3, (0, 1, 0)))
    _girar(arm, "spine_01", (-2, (0, 1, 0)), (2, (1, 0, 0)))
    _girar(arm, "spine_02", (-1.5, (0, 1, 0)))
    _girar(arm, "neck_01", (2, (1, 0, 0)), (-2, (0, 0, 1)))

    for lado, sinal, extra in (("l", 1, 0.0), ("r", -1, 3.5)):
        # o braco desce em torno do eixo da FRENTE (Y da armadura); o sinal
        # inverte por lado, senao um desce e o outro sobe
        # 43 e nao 46: com 46 as maos vinham parar NA FRENTE da virilha, que
        # e postura de quem esta sendo fotografado, nao de quem esta parado.
        # Os -5 no eixo X jogam o braco um pouco para tras, e a mao cai ao
        # lado da coxa, que e onde mao relaxada fica.
        _girar(arm, f"upperarm_{lado}",
               (sinal * (43 + extra), (0, 1, 0)),
               (-5 + extra * 0.4, (1, 0, 0)))
        _girar(arm, f"lowerarm_{lado}", (7 + extra * 0.6, (1, 0, 0)))
        # maos levemente viradas para o corpo, como mao relaxada cai
        _girar(arm, f"hand_{lado}", (sinal * 8, (0, 1, 0)))
        # SEM ADUCAO DE COXA. Ja foi tentado, com 3,5 graus de cada lado: o
        # vao entre as pernas fechava a ponto de a oclusao ambiente do jogo
        # preencher a fresta de preto, e de frente aquilo lia como um rasgo
        # na bermuda. No Blender nao aparecia — a oclusao do jogo e que e
        # agressiva em vao estreito. O afastamento da base fica.
    bpy.context.view_layer.update()
    return arm


def pose_sentado(arm):
    """Poe o personagem sentado ao volante.

    Posar ANTES de recortar a roupa faz a roupa nascer sentada junto — as
    pecas saem da superficie do corpo ja deformada pela armadura. Modelar
    roupa em pe e depois dobrar nao funciona: a costura abre no joelho.

    Os angulos sao em torno do eixo X da armadura (o eixo esquerda-direita),
    que e o plano em que quadril, joelho e cotovelo dobram.
    """
    # tronco levemente reclinado, encostado no banco
    _flexionar(arm, "pelvis", 6)
    _flexionar(arm, "spine_01", -3)
    _flexionar(arm, "spine_02", -2)
    _flexionar(arm, "neck_01", 5)
    for lado in ("l", "r"):
        # com a bacia a ~46 cm do piso e perna de 85 cm, o pe so alcanca o
        # chao com a coxa quase horizontal e o joelho POUCO dobrado. Dobrar
        # muito (82 graus) joga a canela para tras e o pe para baixo do banco.
        _flexionar(arm, f"thigh_{lado}", -82)     # quadril: coxa a frente
        _flexionar(arm, f"calf_{lado}", 44)       # joelho: canela para baixo
        _flexionar(arm, f"foot_{lado}", 8)
        _flexionar(arm, f"upperarm_{lado}", -38)  # braco para a frente
        _flexionar(arm, f"lowerarm_{lado}", 64)   # cotovelo dobrado
    bpy.context.view_layer.update()
    return arm


def assentar(corpo, arm, destino):
    """Move o personagem para que a BACIA fique em `destino`.

    Duas armadilhas aqui, as duas silenciosas:

    - Alinhar pelo ponto mais baixo da malha nao serve: num corpo sentado o
      ponto mais baixo e o pe, e usar ele levanta a figura meio metro acima do
      banco. O alinhamento e pela cabeca do osso `pelvis`.
    - **Mover so a ARMADURA.** O MPFB prende o corpo como FILHO do rig, entao
      mover os dois aplica o deslocamento duas vezes — e ainda deforma a
      malha, porque a armadura passa a puxar de um lugar diferente de onde o
      corpo esta. O sintoma e a roupa recortada nascer meio metro abaixo do
      corpo.
    """
    bacia = arm.pose.bones.get("pelvis")
    if not bacia:
        return
    atual = arm.matrix_world @ bacia.head
    arm.location = arm.location + (Vector(destino) - atual)
    bpy.context.view_layer.update()
