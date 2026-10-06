"""
Cabine da caminhonete de servico, vista de dentro.

Serve as duas metades da fase 2: conferir o veiculo parado (cinto, retrovisor,
freio de mao, carga) e depois dirigir ate a ocorrencia. Por isso e modelada em
primeira pessoa, com o olho do motorista como referencia de tudo.

Sistema: Z para cima, o veiculo aponta para -Y (o motorista olha para -Y).

O volante fica a ESQUERDA do motorista, como no Brasil — e isso e **x POSITIVO**
aqui, nao negativo. Olhando na direcao -Y com Z para cima, a esquerda de quem
dirige e +X (esquerda = cima x frente). Montar o volante em x negativo faz um
veiculo de mao inglesa, e e a primeira coisa que um eletricista nota.
"""
import math, bmesh, bpy
from mathutils import Vector

import comum as C

# ---------------------------------------------------------------- medidas
# Caminhonete cabine dupla. Tudo em metros, a partir do piso da cabine.
LARGURA = 1.58          # entre as portas
COMPRIMENTO = 1.72      # do para-brisa ao banco traseiro
ALTURA = 1.42           # piso ao forro

X_MOTORISTA = 0.38
OLHO = Vector((X_MOTORISTA, 0.20, 1.21))   # olho do motorista
VOLANTE = Vector((X_MOTORISTA, -0.30, 0.755))
RAIO_VOLANTE = 0.185
INCLINACAO_VOLANTE = math.radians(24)

PAINEL_Y = -0.62        # face do painel voltada para o motorista
PARABRISA_BASE = -0.80
PAINEL_TOPO = 0.925     # altura do cocuruto do painel
PARABRISA_TOPO = -0.26


# ---------------------------------------------------------------- materiais

def mat_plastico_painel(cor=(0.048, 0.051, 0.058)):
    """Plastico texturizado do painel: escuro e MUITO fosco.

    Painel de carro e quase sem brilho especular de proposito - reflexo no
    painel ofusca quem dirige. Com rugosidade baixa a cabine vira um brinquedo
    de plastico brilhante.
    """
    return C.mat_simples("painel", cor, rugosidade=0.88, ior=1.45)


def mat_tecido_banco(cor=(0.078, 0.084, 0.096)):
    mat = C.mat_simples("tecido_banco", cor, rugosidade=0.92)
    b = mat.node_tree.nodes["Principled BSDF"]
    for entrada, valor in (("Sheen Weight", 0.30), ("Sheen Roughness", 0.55)):
        if entrada in b.inputs:
            b.inputs[entrada].default_value = valor
    return mat


def mat_vidro():
    """Vidro do para-brisa, propositalmente quase sem reflexo.

    Com IOR de vidro de verdade (1.52) o para-brisa espelha o painel e o
    volante em cima da propria vista, e em primeira pessoa isso mascara a
    cabine inteira. Baixar o IOR mata o Fresnel e deixa o vidro apenas como uma
    lamina transparente — que e o que o jogo precisa mostrar.
    """
    mat = C.mat_simples("vidro", (0.96, 0.97, 0.98), rugosidade=0.0, ior=1.04)
    b = mat.node_tree.nodes["Principled BSDF"]
    for nome, valor in (("Transmission Weight", 1.0),
                        ("Specular IOR Level", 0.04)):
        if nome in b.inputs:
            b.inputs[nome].default_value = valor
    return mat


def mat_cinto(cor=(0.062, 0.064, 0.070)):
    mat = C.mat_simples("cinto", cor, rugosidade=0.78)
    b = mat.node_tree.nodes["Principled BSDF"]
    if "Sheen Weight" in b.inputs:
        b.inputs["Sheen Weight"].default_value = 0.35
    return mat


def mat_metal_escovado():
    return C.mat_simples("metal_escovado", (0.56, 0.57, 0.58),
                         rugosidade=0.32, metalico=1.0)


def mat_espelho():
    return C.mat_simples("espelho", (0.58, 0.59, 0.60), rugosidade=0.03,
                         metalico=1.0)


def mat_borracha_tapete():
    return C.mat_simples("tapete", (0.015, 0.016, 0.018), rugosidade=0.94)


# ---------------------------------------------------------------- geometria

def extrudar(nome, perfil_yz, x0, x1, suave=True):
    """Extruda um perfil fechado do plano YZ ao longo de X.

    E a forma natural de painel, console e soleira: secao constante na largura
    da cabine. Perfil no sentido anti-horario visto de +X.
    """
    bm = bmesh.new()
    a = [bm.verts.new((x0, y, z)) for y, z in perfil_yz]
    b = [bm.verts.new((x1, y, z)) for y, z in perfil_yz]
    n = len(a)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = C.obj_de_bmesh(bm, nome)
    if suave:
        C.suavizar(obj, 42)
    return obj


def _torus(nome, raio_maior, raio_menor, segmentos=40, aneis=14,
           centro=(0, 0, 0), rot=None):
    bm = bmesh.new()
    for i in range(segmentos):
        a = 2 * math.pi * i / segmentos
        for j in range(aneis):
            b = 2 * math.pi * j / aneis
            r = raio_maior + raio_menor * math.cos(b)
            bm.verts.new((r * math.cos(a), r * math.sin(a),
                          raio_menor * math.sin(b)))
    bm.verts.ensure_lookup_table()
    for i in range(segmentos):
        for j in range(aneis):
            i2, j2 = (i + 1) % segmentos, (j + 1) % aneis
            bm.faces.new((bm.verts[i * aneis + j], bm.verts[i2 * aneis + j],
                          bm.verts[i2 * aneis + j2], bm.verts[i * aneis + j2]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    giro = None if rot is None else __import__("mathutils").Euler(rot)
    for v in bm.verts:
        if giro:
            v.co.rotate(giro)
        v.co += Vector(centro)
    obj = C.obj_de_bmesh(bm, nome)
    C.suavizar(obj, 60)
    return obj


# ---------------------------------------------------------------- casco

def casco():
    """Piso, forro, laterais e traseira. A cabine e vista de dentro, entao o
    que importa e a face interna - por isso as pecas sao lajes e nao uma caixa
    invertida: laje tem espessura e a quina nao fica de papel."""
    pecas = []
    meia = LARGURA / 2
    y0, y1 = PARABRISA_BASE, COMPRIMENTO + PARABRISA_BASE

    piso = C.caixa("cab_piso", (LARGURA + 0.10, COMPRIMENTO + 0.10, 0.06),
                   (0, (y0 + y1) / 2, -0.03))
    C.aplicar(piso, mat_borracha_tapete())
    pecas.append(piso)

    # O forro comeca no TOPO do para-brisa, nao na base dele. Indo ate a base
    # ele vira um beiral de meio metro por cima do vidro, e come a faixa de
    # visao inteira: no video da partida a metade de cima da tela era essa
    # sombra. O teto de um veiculo acaba onde o vidro comeca.
    y_forro0, y_forro1 = PARABRISA_TOPO, y1 + 0.05
    forro = C.caixa("cab_forro",
                    (LARGURA + 0.10, y_forro1 - y_forro0, 0.05),
                    (0, (y_forro0 + y_forro1) / 2, ALTURA + 0.025))
    C.aplicar(forro, C.mat_simples("forro", (0.165, 0.166, 0.160), rugosidade=0.95))
    pecas.append(forro)

    plastico = mat_plastico_painel()
    for lado in (-1, 1):
        # o forro da porta vai so ate a linha de cintura: modelado do piso ao
        # teto ele tapa a janela lateral inteira, e com ela o retrovisor
        # externo — que e um dos itens conferidos na fase 2
        altura_porta = 0.95
        porta = C.caixa(f"cab_porta_{lado}", (0.07, 1.00, altura_porta),
                        (lado * (meia + 0.035), y0 + 0.78, altura_porta / 2))
        C.chanfrar(porta, largura=0.010, segmentos=2)
        # a porta mais clara que o painel: sem essa diferenca o interior vira
        # uma mancha cinza so e nao se distingue uma peca da outra na tela
        C.aplicar(porta, mat_plastico_painel((0.082, 0.087, 0.097)))
        pecas.append(porta)

        peitoril = C.caixa(f"cab_peitoril_{lado}", (0.085, 1.00, 0.045),
                           (lado * (meia + 0.030), y0 + 0.78,
                            altura_porta + 0.020))
        C.chanfrar(peitoril, largura=0.008, segmentos=2)
        C.aplicar(peitoril, mat_plastico_painel((0.060, 0.064, 0.072)))
        pecas.append(peitoril)

        # moldura da janela: pilar B atras e travessa no teto
        pilar = C.caixa(f"cab_pilar_b_{lado}", (0.06, 0.075, 0.52),
                        (lado * (meia + 0.015), y0 + 1.27, 1.16))
        C.aplicar(pilar, mat_plastico_painel((0.072, 0.076, 0.085)))
        pecas.append(pilar)

        apoio = C.caixa(f"cab_apoio_{lado}", (0.10, 0.52, 0.09),
                        (lado * (meia - 0.020), y0 + 0.74, 0.66))
        C.chanfrar(apoio, largura=0.014, segmentos=3)
        C.aplicar(apoio, plastico)
        pecas.append(apoio)

    travessa = C.caixa("cab_travessa", (LARGURA + 0.06, 0.10, 0.075),
                       (0, PARABRISA_TOPO - 0.03, ALTURA - 0.020))
    C.chanfrar(travessa, largura=0.010, segmentos=2)
    C.aplicar(travessa, plastico)
    pecas.append(travessa)

    fundo = C.caixa("cab_fundo", (LARGURA, 0.08, ALTURA),
                    (0, y1 - 0.04, ALTURA / 2))
    C.aplicar(fundo, mat_tecido_banco((0.045, 0.048, 0.055)))
    pecas.append(fundo)
    return pecas


def painel():
    """Painel, capo do instrumento e coluna de direcao."""
    # o cocuruto do painel fica ~29 cm abaixo do olho: mais alto que isso e
    # ele toma metade da tela e o motorista nao ve a via
    perfil = [
        (PARABRISA_BASE, PAINEL_TOPO - 0.025),
        (-0.70, PAINEL_TOPO),
        (-0.585, PAINEL_TOPO - 0.020),
        (-0.495, PAINEL_TOPO - 0.070),
        (-0.470, PAINEL_TOPO - 0.150),
        (-0.495, PAINEL_TOPO - 0.300),
        (-0.560, PAINEL_TOPO - 0.415),
        (-0.800, PAINEL_TOPO - 0.470),
    ]
    plastico = mat_plastico_painel()
    p = extrudar("cab_painel", perfil, -LARGURA / 2, LARGURA / 2)
    C.aplicar(p, plastico)
    pecas = [p]

    # capo do painel de instrumentos, em cima do volante
    capo = [
        (-0.640, PAINEL_TOPO + 0.010),
        (-0.520, PAINEL_TOPO + 0.042),
        (-0.430, PAINEL_TOPO - 0.003),
        (-0.440, PAINEL_TOPO - 0.078),
        (-0.600, PAINEL_TOPO - 0.083),
    ]
    c = extrudar("cab_capo", capo, VOLANTE.x - 0.145, VOLANTE.x + 0.145)
    C.aplicar(c, plastico)
    pecas.append(c)

    # mostrador: uma placa escura sob o capo, levemente inclinada
    mostrador = C.caixa("cab_mostrador", (0.255, 0.008, 0.105),
                        (VOLANTE.x, -0.505, PAINEL_TOPO - 0.035),
                        rot=(math.radians(-18), 0, 0))
    C.aplicar(mostrador, C.mat_simples("mostrador", (0.008, 0.009, 0.011),
                                       rugosidade=0.25))
    pecas.append(mostrador)

    # saidas de ar
    for x in (VOLANTE.x + 0.30, VOLANTE.x - 0.46, -0.60):
        ar = C.caixa(f"cab_ar_{x:.2f}", (0.115, 0.030, 0.062),
                     (x, -0.492, PAINEL_TOPO - 0.130))
        C.chanfrar(ar, largura=0.006, segmentos=2)
        C.aplicar(ar, C.mat_simples("grelha_ar", (0.012, 0.013, 0.015),
                                    rugosidade=0.55))
        pecas.append(ar)

    # central: tela e comandos
    central = C.caixa("cab_central", (0.30, 0.026, 0.19),
                      (-0.16, -0.500, PAINEL_TOPO - 0.230))
    C.chanfrar(central, largura=0.006, segmentos=2)
    C.aplicar(central, C.mat_simples("tela_central", (0.010, 0.011, 0.014),
                                     rugosidade=0.22))
    pecas.append(central)
    return pecas


def volante():
    """Aro, cubo e tres raios."""
    metal = mat_metal_escovado()
    couro = C.mat_simples("volante_couro", (0.020, 0.021, 0.024),
                          rugosidade=0.72)
    rot = (INCLINACAO_VOLANTE, 0, 0)
    aro = _torus("cab_volante_aro", RAIO_VOLANTE, 0.019, centro=tuple(VOLANTE),
                 rot=rot)
    C.aplicar(aro, couro)
    pecas = [aro]

    cubo = C.cilindro("cab_volante_cubo", 0.058, 0.055, tuple(VOLANTE),
                      segmentos=24, rot=(math.pi / 2 + INCLINACAO_VOLANTE, 0, 0))
    C.aplicar(cubo, couro)
    pecas.append(cubo)

    for ang in (math.radians(200), math.radians(340), math.radians(90)):
        raio = C.caixa(f"cab_raio_{int(math.degrees(ang))}",
                       (RAIO_VOLANTE * 0.96, 0.040, 0.016), (0, 0, 0))
        # gira no plano do volante e depois inclina junto com ele
        bm = bmesh.new()
        bm.from_mesh(raio.data)
        eu = __import__("mathutils").Euler
        for v in bm.verts:
            v.co.rotate(eu((0, 0, ang)))
            v.co += Vector((RAIO_VOLANTE / 2 * math.cos(ang),
                            RAIO_VOLANTE / 2 * math.sin(ang), 0))
            v.co.rotate(eu(rot))
            v.co += VOLANTE
        bm.to_mesh(raio.data)
        bm.free()
        raio.data.update()
        C.aplicar(raio, metal)
        pecas.append(raio)

    coluna = C.cilindro("cab_coluna", 0.042, 0.24,
                        tuple(VOLANTE + Vector((0, 0.10, -0.045))),
                        segmentos=16,
                        rot=(math.pi / 2 + INCLINACAO_VOLANTE, 0, 0))
    C.aplicar(coluna, mat_plastico_painel((0.014, 0.015, 0.017)))
    pecas.append(coluna)
    return pecas


# Altura do estofado acima do piso da cabine. Num utilitario o ponto do
# quadril fica a ~40 cm: com o assento a 50 cm a perna do motorista nao
# alcanca o pedal e o corpo sentado fica com os pes abaixo do piso.
ALTURA_ASSENTO = 0.40


def banco(nome, x, encosto=1.02, recuo=0.0):
    """Assento, encosto e apoio de cabeca. O apoio e peca separada porque a
    altura dele e um dos itens conferidos na fase 2."""
    tecido = mat_tecido_banco()
    y = 0.26 + recuo
    pecas = []

    assento = C.caixa(f"{nome}_assento", (0.50, 0.50, 0.14),
                      (x, y, ALTURA_ASSENTO - 0.07))
    C.chanfrar(assento, largura=0.030, segmentos=3)
    C.aplicar(assento, tecido)
    pecas.append(assento)

    costas = C.caixa(f"{nome}_encosto", (0.50, 0.15, encosto - ALTURA_ASSENTO),
                     (x, y + 0.29, ALTURA_ASSENTO + (encosto - ALTURA_ASSENTO) / 2),
                     rot=(math.radians(-9), 0, 0))
    C.chanfrar(costas, largura=0.030, segmentos=3)
    C.aplicar(costas, tecido)
    pecas.append(costas)

    for lado in (-1, 1):
        lateral = C.caixa(f"{nome}_lateral_{lado}", (0.075, 0.46, 0.10),
                          (x + lado * 0.235, y, ALTURA_ASSENTO + 0.07))
        C.chanfrar(lateral, largura=0.022, segmentos=3)
        C.aplicar(lateral, tecido)
        pecas.append(lateral)
    return pecas


def apoio_cabeca(nome, x, altura=1.22, encosto=0.98):
    """Apoio de cabeca. `altura` e o topo dele - baixo demais, em vez de
    proteger, vira alavanca no pescoco numa colisao traseira."""
    y = 0.26 + 0.30
    pecas = []
    bloco = C.caixa(f"{nome}_apoio", (0.26, 0.13, 0.15), (x, y + 0.02, altura - 0.075),
                    rot=(math.radians(-9), 0, 0))
    C.chanfrar(bloco, largura=0.030, segmentos=3)
    C.aplicar(bloco, mat_tecido_banco())
    pecas.append(bloco)
    for lado in (-1, 1):
        haste = C.cilindro(f"{nome}_haste_{lado}", 0.010,
                           max(0.04, altura - encosto + 0.10),
                           (x + lado * 0.075, y + 0.04,
                            encosto - 0.05 + (altura - encosto) / 2),
                           segmentos=10)
        C.aplicar(haste, mat_metal_escovado())
        pecas.append(haste)
    return pecas


def console():
    """Console central, alavanca de cambio e freio de mao."""
    plastico = mat_plastico_painel((0.016, 0.017, 0.020))
    perfil = [
        (-0.56, 0.18), (-0.10, 0.30), (0.50, 0.30), (0.50, 0.0), (-0.62, 0.0),
    ]
    p = extrudar("cab_console", perfil, -0.16, 0.16, suave=False)
    C.aplicar(p, plastico)
    pecas = [p]

    haste = C.cilindro("cab_cambio_haste", 0.016, 0.20, (0, -0.16, 0.38),
                       segmentos=12, rot=(math.radians(-12), 0, 0))
    C.aplicar(haste, mat_metal_escovado())
    manopla = C.cilindro("cab_cambio_manopla", 0.034, 0.075, (0, -0.185, 0.49),
                         segmentos=18)
    C.aplicar(manopla, C.mat_simples("manopla", (0.022, 0.023, 0.026),
                                     rugosidade=0.62))
    pecas += [haste, manopla]
    return pecas


def freio_de_mao(puxado=True):
    """Freio de mao. Puxado ou solto — e um dos itens da conferencia."""
    ang = math.radians(-38 if puxado else -6)
    base = Vector((-0.09, 0.06, 0.30))
    alavanca = C.caixa("cab_freio", (0.036, 0.30, 0.040),
                       (0, 0, 0), rot=(ang, 0, 0))
    bm = bmesh.new(); bm.from_mesh(alavanca.data)
    for v in bm.verts:
        v.co += base + Vector((0, -0.13 * math.cos(ang), -0.13 * math.sin(ang)))
    bm.to_mesh(alavanca.data); bm.free(); alavanca.data.update()
    C.chanfrar(alavanca, largura=0.010, segmentos=2)
    C.aplicar(alavanca, C.mat_simples("freio", (0.024, 0.025, 0.028),
                                      rugosidade=0.58))
    return [alavanca]


def cinto(afivelado=True, lado=1):
    """Cinto de tres pontos. Afivelado cruza o peito; solto fica junto ao
    pilar. E o item mais importante da conferencia — e o unico que o jogador
    vai procurar primeiro."""
    x = -X_MOTORISTA if lado < 0 else X_MOTORISTA
    meia = LARGURA / 2
    ancora_alta = Vector((lado * (meia - 0.04), 0.42, 1.18))
    fivela = Vector((x - 0.22, 0.30, ALTURA_ASSENTO + 0.04))
    ancora_baixa = Vector((lado * (meia - 0.06), 0.30, ALTURA_ASSENTO - 0.08))

    if afivelado:
        caminho = [
            tuple(ancora_alta),
            tuple(Vector((x + 0.02, 0.18, 0.92))),
            tuple(Vector((x - 0.10, 0.20, ALTURA_ASSENTO + 0.20))),
            tuple(fivela),
            tuple(Vector((x + 0.05, 0.26, ALTURA_ASSENTO - 0.02))),
            tuple(ancora_baixa),
        ]
    else:
        caminho = [
            tuple(ancora_alta),
            tuple(Vector((lado * (meia - 0.05), 0.40, 0.86))),
            tuple(Vector((lado * (meia - 0.06), 0.36, ALTURA_ASSENTO + 0.10))),
            tuple(ancora_baixa),
        ]

    bm = bmesh.new()
    pts = [Vector(p) for p in caminho]
    ant = None
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)])
        if d.length < 1e-6:
            d = Vector((0, 1, 0))
        d.normalize()
        lat = d.cross(Vector((0, 1, 0)))
        if lat.length < 1e-4:
            lat = d.cross(Vector((1, 0, 0)))
        lat.normalize()
        # 66 mm: um pouco mais largo que o cinto real, de proposito. Com a
        # largura exata ele some contra o pilar escuro na tela do jogo.
        a = bm.verts.new(p + lat * 0.033)
        b = bm.verts.new(p - lat * 0.033)
        if ant:
            bm.faces.new((ant[0], ant[1], b, a))
        ant = (a, b)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = C.obj_de_bmesh(bm, "cab_cinto")
    mod = obj.modifiers.new("espessura", "SOLIDIFY")
    mod.thickness = 0.004
    C.suavizar(obj, 40)
    C.aplicar(obj, mat_cinto())
    return [obj]


def retrovisor_interno():
    espelho = mat_espelho()
    moldura = mat_plastico_painel((0.018, 0.019, 0.022))
    interno = C.caixa("cab_retro_interno", (0.28, 0.035, 0.085),
                      (-0.02, -0.46, 1.335), rot=(0, 0, math.radians(-4)))
    C.chanfrar(interno, largura=0.010, segmentos=2)
    C.aplicar(interno, moldura)
    face = C.caixa("cab_retro_interno_face", (0.26, 0.006, 0.072),
                   (-0.02, -0.479, 1.335), rot=(0, 0, math.radians(-4)))
    C.aplicar(face, espelho)
    return [interno, face]


def retrovisores(desregulado=False, sufixo=""):
    """Os dois retrovisores externos.

    `desregulado` gira os espelhos para dentro — o defeito mais comum, e o que
    tira do motorista justamente o ponto cego que ele mais precisa na via.
    """
    espelho = mat_espelho()
    moldura = mat_plastico_painel((0.018, 0.019, 0.022))
    pecas = []
    giro = math.radians(26 if desregulado else 0)
    for lado in (-1, 1):
        base = Vector((lado * (LARGURA / 2 + 0.16), -0.56, 1.02))
        corpo = C.caixa(f"cab_retro{sufixo}_{lado}", (0.16, 0.070, 0.115),
                        tuple(base), rot=(0, 0, lado * giro))
        C.chanfrar(corpo, largura=0.012, segmentos=2)
        C.aplicar(corpo, moldura)
        vidro = C.caixa(f"cab_retro{sufixo}_face_{lado}", (0.145, 0.006, 0.100),
                        tuple(base + Vector((0, -0.036, 0))),
                        rot=(0, 0, lado * giro))
        C.aplicar(vidro, espelho)
        braco = C.caixa(f"cab_retro{sufixo}_braco_{lado}", (0.13, 0.030, 0.030),
                        tuple(base + Vector((-lado * 0.13, 0.03, -0.01))))
        C.aplicar(braco, moldura)
        pecas += [corpo, vidro, braco]
    return pecas


def vidros():
    """Para-brisa e janelas laterais."""
    v = mat_vidro()
    pecas = []
    perfil = [
        (PARABRISA_BASE, PAINEL_TOPO - 0.02), (PARABRISA_TOPO, ALTURA),
        (PARABRISA_TOPO + 0.012, ALTURA), (PARABRISA_BASE + 0.012, PAINEL_TOPO - 0.02),
    ]
    pb = extrudar("cab_parabrisa", perfil, -LARGURA / 2 + 0.02,
                  LARGURA / 2 - 0.02, suave=False)
    C.aplicar(pb, v)
    pecas.append(pb)
    for lado in (-1, 1):
        jan = C.caixa(f"cab_janela_{lado}", (0.010, 0.86, 0.46),
                      (lado * (LARGURA / 2 + 0.002), PARABRISA_BASE + 0.80, 1.13))
        C.aplicar(jan, v)
        pecas.append(jan)
    for p in pecas:
        # vidro limpo nao faz sombra. Deixando fazer, o sol e o HDRI param na
        # superficie, a cabine inteira vira silhueta e nenhuma quantidade de
        # amostra resolve: a luz so entraria por refracao, que e cara e ruidosa.
        p.visible_shadow = False
    return pecas


def detalhes():
    """Quebra-sol, coluna, pedais, mostradores e o capo visto pelo para-brisa.

    O capo e o item que mais faz diferenca: sem ele o para-brisa da para o
    vazio e a cena nao le como "dentro de uma caminhonete", le como uma caixa
    com uma janela. Custa duas formas.
    """
    plastico = mat_plastico_painel()
    claro = mat_plastico_painel((0.105, 0.110, 0.120))
    pecas = []

    # capo, la fora, descendo para longe
    # o capo entra no quadro so como uma faixa na base do para-brisa. Alto
    # demais ele vira uma mesa azul tapando a via, que e justamente o que o
    # jogador precisa ver na fase do trajeto.
    capo = C.caixa("cab_capo_externo", (1.76, 1.60, 0.09),
                   (0, PARABRISA_BASE - 0.80, PAINEL_TOPO - 0.215),
                   rot=(math.radians(7.0), 0, 0))
    C.chanfrar(capo, largura=0.022, segmentos=3)
    C.aplicar(capo, C.mat_simples("pintura", (0.030, 0.062, 0.115),
                                  rugosidade=0.22))
    pecas.append(capo)

    paralama = []
    for lado in (-1, 1):
        p = C.caixa(f"cab_paralama_{lado}", (0.20, 1.52, 0.15),
                    (lado * 0.86, PARABRISA_BASE - 0.78, PAINEL_TOPO - 0.175),
                    rot=(math.radians(7.0), 0, 0))
        C.chanfrar(p, largura=0.035, segmentos=3)
        C.aplicar(p, C.mat_simples("pintura2", (0.030, 0.062, 0.115),
                                   rugosidade=0.22))
        paralama.append(p)
    pecas += paralama

    # cowl e palhetas do limpador, na base do para-brisa
    cowl = C.caixa("cab_cowl", (1.72, 0.17, 0.045),
                   (0, PARABRISA_BASE - 0.055, PAINEL_TOPO - 0.062))
    C.chanfrar(cowl, largura=0.010, segmentos=2)
    C.aplicar(cowl, plastico)
    pecas.append(cowl)
    for lado, dx in (("e", -0.34), ("d", 0.40)):
        palheta = C.caixa(f"cab_palheta_{lado}", (0.62, 0.016, 0.012),
                          (dx, PARABRISA_BASE - 0.045, PAINEL_TOPO - 0.030),
                          rot=(0, 0, math.radians(7)))
        C.aplicar(palheta, C.mat_simples("palheta", (0.016, 0.017, 0.019),
                                         rugosidade=0.80))
        pecas.append(palheta)

    # quebra-sol
    for lado in (-1, 1):
        # recolhido contra o forro: inclinado e baixo ele corta a visao a
        # menos de 12 graus acima da linha do horizonte
        q = C.caixa(f"cab_quebrasol_{lado}", (0.62, 0.20, 0.016),
                    (lado * 0.40, -0.20, ALTURA - 0.030),
                    rot=(math.radians(-5), 0, 0))
        C.chanfrar(q, largura=0.008, segmentos=2)
        C.aplicar(q, claro)
        pecas.append(q)

    # coluna A: a faixa entre o para-brisa e a janela lateral
    for lado in (-1, 1):
        col = C.caixa(f"cab_coluna_a_{lado}", (0.040, 0.62, 0.052),
                      (lado * (LARGURA / 2 - 0.025), PARABRISA_BASE + 0.27,
                       1.19), rot=(math.radians(38), 0, 0))
        C.aplicar(col, plastico)
        pecas.append(col)

    # pedais
    # pedais no lado do motorista: freio a esquerda do acelerador, e a
    # esquerda de quem dirige e +X
    for nome, x, larg in (("freio", 0.30, 0.075), ("acel", 0.16, 0.055)):
        ped = C.caixa(f"cab_pedal_{nome}", (larg, 0.030, 0.155),
                      (x, -0.52, 0.16), rot=(math.radians(-22), 0, 0))
        C.aplicar(ped, C.mat_simples("pedal", (0.022, 0.023, 0.026),
                                     rugosidade=0.72))
        haste = C.cilindro(f"cab_pedal_haste_{nome}", 0.011, 0.20,
                           (x, -0.53, 0.31), segmentos=8,
                           rot=(math.radians(-22), 0, 0))
        C.aplicar(haste, mat_metal_escovado())
        pecas += [ped, haste]

    # mostradores: dois anéis no painel de instrumentos
    aro = mat_metal_escovado()
    fundo = C.mat_simples("mostrador_fundo", (0.012, 0.013, 0.016),
                          rugosidade=0.30)
    for i, dx in enumerate((-0.062, 0.062)):
        disco = C.cilindro(f"cab_disco_{i}", 0.052, 0.006,
                           (VOLANTE.x + dx, -0.502, PAINEL_TOPO - 0.035), segmentos=28,
                           rot=(math.radians(72), 0, 0))
        C.aplicar(disco, fundo)
        anel = C.anel(f"cab_anel_{i}", raio=0.054, espessura=0.005,
                      pos=(VOLANTE.x + dx, -0.505, PAINEL_TOPO - 0.035),
                      rot=(math.radians(72), 0, 0))
        C.aplicar(anel, aro)
        pecas += [disco, anel]

    # porta-objetos do painel, do lado do passageiro
    porta_luvas = C.caixa("cab_porta_luvas", (0.34, 0.020, 0.145),
                          (-0.52, -0.488, PAINEL_TOPO - 0.270))
    C.chanfrar(porta_luvas, largura=0.006, segmentos=2)
    C.aplicar(porta_luvas, claro)
    pecas.append(porta_luvas)

    return pecas


def celular(guardado=False):
    """Celular. Solto no painel e o estado errado; guardado no console e o certo."""
    pos = (-0.10, -0.455, PAINEL_TOPO - 0.015) if not guardado else (0.0, -0.05, 0.315)
    rot = (math.radians(-14), 0, math.radians(8)) if not guardado else (0, 0, 0)
    tela = C.caixa("cab_celular", (0.072, 0.148, 0.009), pos, rot=rot)
    C.chanfrar(tela, largura=0.003, segmentos=2)
    C.aplicar(tela, C.mat_simples("celular", (0.010, 0.011, 0.014),
                                  rugosidade=0.15))
    return [tela]


def prancheta(preenchida=False):
    """Prancheta com o checklist, no banco do passageiro."""
    base = Vector((-0.40, 0.30, ALTURA_ASSENTO + 0.112))
    tabua = C.caixa("cab_prancheta", (0.225, 0.315, 0.010), tuple(base),
                    rot=(math.radians(-6), 0, math.radians(-12)))
    C.chanfrar(tabua, largura=0.004, segmentos=2)
    C.aplicar(tabua, C.mat_simples("prancheta", (0.085, 0.062, 0.038),
                                   rugosidade=0.72))
    folha = C.caixa("cab_folha", (0.200, 0.285, 0.002),
                    tuple(base + Vector((0, 0, 0.007))),
                    rot=(math.radians(-6), 0, math.radians(-12)))
    C.aplicar(folha, C.mat_simples("papel", (0.72, 0.71, 0.68), rugosidade=0.90))
    pecas = [tabua, folha]
    if preenchida:
        tinta = C.mat_simples("tinta", (0.020, 0.030, 0.090), rugosidade=0.6)
        for i in range(7):
            marca = C.caixa(f"cab_marca_{i}", (0.014, 0.014, 0.0012),
                            tuple(base + Vector((-0.072, 0.108 - i * 0.033, 0.009))),
                            rot=(math.radians(-6), 0, math.radians(-12)))
            C.aplicar(marca, tinta)
            pecas.append(marca)
    return pecas


def extintor():
    """Extintor preso embaixo do banco do passageiro."""
    corpo = C.cilindro("cab_extintor", 0.047, 0.30, (-0.44, 0.34, 0.20),
                       segmentos=18)
    C.aplicar(corpo, C.mat_simples("extintor", (0.32, 0.020, 0.012),
                                   rugosidade=0.38))
    gatilho = C.caixa("cab_extintor_gatilho", (0.055, 0.035, 0.040),
                      (-0.44, 0.34, 0.368))
    C.aplicar(gatilho, mat_metal_escovado())
    return [corpo, gatilho]


# ---------------------------------------------------------------- montagem

def fixo():
    """Tudo o que nao muda de estado durante a conferencia."""
    pecas = []
    pecas += casco()
    pecas += painel()
    pecas += volante()
    pecas += banco("cab_banco_mot", X_MOTORISTA)
    pecas += banco("cab_banco_pas", -X_MOTORISTA)
    pecas += apoio_cabeca("cab_apoio_pas", -X_MOTORISTA, altura=1.18)
    pecas += console()
    pecas += freio_de_mao(True)
    pecas += retrovisor_interno()
    pecas += extintor()
    pecas += detalhes()
    pecas += vidros()
    return pecas


def estados():
    """Os pares de estado que a fase 2 liga e desliga.

    Cada item conferido tem um no errado e um certo no .glb; mandar corrigir no
    jogo troca um pelo outro, e o jogador VE a correcao acontecer. A alternativa
    — so marcar certo numa lista — ensina menos e nao prova nada.
    """
    return {
        "cinto_solto": cinto(afivelado=False),
        "cinto_afivelado": cinto(afivelado=True),
        "retro_desregulado": retrovisores(True, sufixo="_des"),
        "retro_ok": retrovisores(False, sufixo="_ok"),
        "apoio_baixo": apoio_cabeca("cab_apoio_mot_b", X_MOTORISTA, altura=1.03),
        "apoio_alto": apoio_cabeca("cab_apoio_mot_a", X_MOTORISTA, altura=1.22),
        "celular": celular(guardado=False),
        "celular_guardado": celular(guardado=True),
        "checklist_branco": prancheta(preenchida=False),
        "checklist_feito": prancheta(preenchida=True),
    }


def montar():
    """Cabine inteira com todos os estados presentes. So para conferir por
    render — no jogo quem escolhe o estado e o jogador."""
    pecas = fixo()
    for grupo in estados().values():
        pecas += grupo
    return pecas


def luz_cabine(sol_az=318, sol_el=52):
    """Iluminacao da cabine em dia claro.

    A luz vem do HDRI atravessando o vidro, mais um sol para dar direcao. NAO
    se usa painel de area grande na frente do para-brisa: mesmo escondido da
    camera, o vidro o reflete como espelho e o para-brisa inteiro vira um
    retangulo branco estourado. O preenchimento interno fica ATRAS do olho do
    motorista, onde o reflexo nao entra no quadro.
    """
    az, el = math.radians(sol_az), math.radians(sol_el)
    C.sol(energia=3.2, angulo=(el, 0, az), tamanho=0.02)

    def area(nome, pos, alvo, energia, tamanho, cor=(1, 1, 1)):
        dados = bpy.data.lights.new(nome, type="AREA")
        dados.energy = energia
        dados.size = tamanho
        dados.color = cor
        obj = bpy.data.objects.new(nome, dados)
        bpy.context.collection.objects.link(obj)
        obj.location = Vector(pos)
        d = Vector(alvo) - Vector(pos)
        obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        obj.visible_camera = False
        obj.visible_glossy = False      # nada de espelho no vidro nem no painel
        return obj

    # preenchimento atras do motorista, simulando a luz que entra pelas
    # janelas laterais e rebate no forro
    area("preench_forro", (0.0, 0.55, 1.34), (0.0, -0.35, 0.72), 26, 1.2,
         (0.90, 0.94, 1.0))
    area("preench_piso", (0.0, 0.10, 0.22), (0.0, -0.20, 1.10), 9, 1.0,
         (1.0, 0.95, 0.88))
    area("preench_lat", (-1.0, 0.30, 1.05), (-0.2, -0.20, 0.80), 14, 0.9,
         (0.92, 0.95, 1.0))
