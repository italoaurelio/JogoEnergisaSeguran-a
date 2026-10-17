"""
EPI da fase 1 - vestiario.

Duas familias de peca, com tratamento diferente:

- **Vestimenta** (uniforme, colete, luva) e recortada da propria superficie do
  corpo e engrossada. Assim ela veste sozinha qualquer fisico que o jogador
  montar, sem modelar uma roupa por tamanho.
- **Peca rigida** (capacete, visor, botina, cinturao) e modelada e posicionada
  pelos pontos anatomicos de `humano.referencias()`, nunca por numero fixo.

O catalogo de qual peca e certa ou errada, e por que, mora em
`src/conteudo/epi.ts`. Aqui e so a forma.
"""
import math, bmesh, bpy
from mathutils import Vector, Euler

import comum as C
import humano as H


# Altura de cada camada acima da pele, em metros. Mantidas juntas porque o
# problema nao e cada numero e sim a ORDEM: faixa refletiva a 1 mm da camisa
# briga por z-fighting e sai rasgada, e tirante por baixo da faixa atravessa.
CAMADA = {
    "camisa": 0.019,
    "calca": 0.024,
    "acabamento": 0.030,   # gola, punho, carcela, bolso
    # A faixa tem de limpar o acabamento INTEIRO, nao so a folga dele: carcela
    # e bolso tem 4 mm de espessura e ainda incham com o subsurf, entao a
    # superficie de cima deles fica em ~0,036. Com a faixa tambem em 0,036 a
    # carcela atravessava a faixa bem no meio do peito e a fita parecia um no
    # de gravata — o defeito que o usuario chamou de "borda serrilhada no
    # peito". 6 mm de folga real.
    "faixa": 0.042,        # retrorrefletiva, por cima da camisa
    "colete": 0.040,
    "tirante": 0.062,      # cinturao por cima de tudo
}


# ------------------------------------------------------------------ materiais
# Metalico e chave, nao potenciometro: 0 para tudo que nao e metal cru.

def mat_casco(cor=(0.62, 0.27, 0.02)):
    """ABS do capacete: brilho de plastico injetado, com verniz por cima."""
    mat = C.mat_simples("casco_abs", cor, rugosidade=0.22, metalico=0.0, ior=1.46)
    b = mat.node_tree.nodes["Principled BSDF"]
    for entrada, valor in (("Coat Weight", 0.45), ("Coat Roughness", 0.10)):
        if entrada in b.inputs:
            b.inputs[entrada].default_value = valor
    return mat


def mat_policarbonato(tom=(0.45, 0.36, 0.16), densidade=2.4):
    """Visor de arco: policarbonato com tinta verde-ambar, levemente translucido."""
    mat = C.mat_simples("policarbonato", (0.94, 0.94, 0.93), rugosidade=0.025,
                        metalico=0.0, ior=1.585)
    b = mat.node_tree.nodes["Principled BSDF"]
    for nome, valor in (("Transmission Weight", 0.97),):
        if nome in b.inputs:
            b.inputs[nome].default_value = valor
    nt = mat.node_tree
    vol = nt.nodes.new("ShaderNodeVolumeAbsorption")
    vol.inputs["Color"].default_value = (*tom, 1.0)
    vol.inputs["Density"].default_value = densidade
    saida = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    nt.links.new(vol.outputs["Volume"], saida.inputs["Volume"])
    return mat


def mat_lente(cor=(0.86, 0.88, 0.90), escura=False):
    if escura:
        m = C.mat_simples("lente_escura", (0.05, 0.05, 0.06), rugosidade=0.04,
                          metalico=0.8)
        return m
    m = C.mat_simples("lente_incolor", cor, rugosidade=0.04, ior=1.585)
    b = m.node_tree.nodes["Principled BSDF"]
    if "Transmission Weight" in b.inputs:
        b.inputs["Transmission Weight"].default_value = 0.92
    return m


def mat_tecido(nome, cor, aspereza=0.78, brilho_fio=0.55):
    """Tecido em geral. O Sheen e o que faz pano parecer pano e nao plastico.

    O peso subiu de 0,25 para 0,55 e a aspereza do Sheen desceu de 0,50 para
    0,32. Em 0,25 o efeito existia no arquivo e nao se via na tela: o uniforme
    continuava lendo como uma peca de plastico azul, que e exatamente o
    "chapado" do retorno do cliente.

    O Sheen e o brilho de BORDA do pano — a luz que raspa a superficie e
    acende o fio levantado. Ele aparece onde a peca curva e some de frente, e
    e esse gradiente que o olho usa para saber que aquilo e tecido. Baixar a
    aspereza aperta esse brilho na borda em vez de espalhar pela peca toda.

    Nao precisa de UV nem de textura: sai no glTF como KHR_materials_sheen,
    que o three.js le direto.
    """
    mat = C.mat_simples(nome, cor, rugosidade=aspereza, metalico=0.0)
    b = mat.node_tree.nodes["Principled BSDF"]
    for entrada, valor in (("Sheen Weight", brilho_fio), ("Sheen Roughness", 0.32)):
        if entrada in b.inputs:
            b.inputs[entrada].default_value = valor
    return mat


def mat_refletivo():
    """Faixa retrorrefletiva: cinza-prata fosco que acende contra a luz."""
    mat = C.mat_simples("faixa_refletiva", (0.72, 0.74, 0.75), rugosidade=0.35,
                        metalico=0.0)
    b = mat.node_tree.nodes["Principled BSDF"]
    if "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = 0.3
    return mat


def mat_borracha(cor=(0.11, 0.12, 0.14)):
    """Borracha isolante: fosca, sem brilho de plastico."""
    return C.mat_simples("borracha_isolante", cor, rugosidade=0.72, ior=1.52)


def mat_couro(nome="couro", cor=(0.085, 0.052, 0.030), aspereza=0.55):
    """Couro: botina, luva de cobertura, cinturao.

    Ganha uma camada fina de verniz. Couro nao e fosco: tem um brilho
    superficial proprio, mais nitido que o do corpo do material, e e ele que
    separa couro de borracha na tela. Sem isso a botina e a luva de raspa
    ficavam do mesmo tom chapado em qualquer angulo.

    Como o Sheen do tecido, sai no glTF sozinho (KHR_materials_clearcoat) e
    nao custa UV nenhuma.
    """
    mat = C.mat_simples(nome, cor, rugosidade=aspereza, ior=1.45)
    b = mat.node_tree.nodes["Principled BSDF"]
    for entrada, valor in (("Coat Weight", 0.25), ("Coat Roughness", 0.38),
                           ("Clearcoat", 0.25), ("Clearcoat Roughness", 0.38)):
        if entrada in b.inputs:
            b.inputs[entrada].default_value = valor
    return mat


def mat_cadarco(cor=(0.55, 0.30, 0.03)):
    """Fita de poliamida do cinturao. Trancada, entao aspera e com fio a mostra."""
    return mat_tecido("cadarco", cor, aspereza=0.68, brilho_fio=0.35)


def mat_ferragem():
    return C.mat_simples("ferragem", (0.56, 0.57, 0.58), rugosidade=0.28,
                         metalico=1.0)


# ------------------------------------------------------------------ geometria

def calota(nome, raios, corte=0.0, segmentos=40, aneis=20, espessura=0.004):
    """Meia elipsoide aberta embaixo, com casca. Base do capacete e do bone.

    Nao sai de `perfil_revolucao`, que exige perfil fechado no eixo e devolveria
    uma cupula macica - o capacete precisa ser oco, e ve-se por dentro dele na
    arara.
    """
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segmentos, v_segments=aneis * 2,
                              radius=1.0)
    fora = [v for v in bm.verts if v.co.z < corte]
    bmesh.ops.delete(bm, geom=fora, context="VERTS")
    for v in bm.verts:
        v.co.x *= raios[0]
        v.co.y *= raios[1]
        v.co.z *= raios[2]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = C.obj_de_bmesh(bm, nome)
    if espessura:
        mod = obj.modifiers.new("casca", "SOLIDIFY")
        mod.thickness = espessura
        mod.offset = -1.0
    C.suavizar(obj, 60)
    return obj


def _fita(nome, pontos, largura=0.02, espessura=0.002, fechar=False):
    """Fita seguindo uma sequencia de pontos. Serve para jugular e talabarte."""
    pts = [Vector(p) for p in pontos]
    bm = bmesh.new()
    anteriores = None
    for i, p in enumerate(pts):
        if i == 0:
            d = pts[1] - p
        elif i == len(pts) - 1:
            d = p - pts[-2]
        else:
            d = pts[i + 1] - pts[i - 1]
        d.normalize()
        lado = d.cross(Vector((0, 0, 1)))
        if lado.length < 1e-4:
            lado = d.cross(Vector((0, 1, 0)))
        lado.normalize()
        a = bm.verts.new(p + lado * (largura / 2))
        b = bm.verts.new(p - lado * (largura / 2))
        if anteriores:
            bm.faces.new((anteriores[0], anteriores[1], b, a))
        anteriores = (a, b)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = C.obj_de_bmesh(bm, nome)
    mod = obj.modifiers.new("espessura", "SOLIDIFY")
    mod.thickness = espessura
    C.suavizar(obj, 40)
    return obj


def _loft(nome, secoes, tampar=True):
    """Une aneis de mesmo tamanho numa casca. Base da forma da botina."""
    bm = bmesh.new()
    linhas = [[bm.verts.new(p) for p in anel] for anel in secoes]
    n = len(linhas[0])
    for j in range(len(linhas) - 1):
        for i in range(n):
            k = (i + 1) % n
            try:
                bm.faces.new((linhas[j][i], linhas[j][k],
                              linhas[j + 1][k], linhas[j + 1][i]))
            except ValueError:
                pass
    if tampar:
        for extremo in (linhas[0], linhas[-1]):
            try:
                bm.faces.new(extremo)
            except ValueError:
                pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = C.obj_de_bmesh(bm, nome)
    C.suavizar(obj, 55)
    return obj


def _anel_elipse(centro, larg, alt, n=20, achatar_base=0.55, garganta=0.0):
    """Anel de secao da botina: elipse com a base achatada, que e o formato de
    um pe calcado - redondo em cima, chato embaixo.

    `garganta` cava um sulco no alto da secao. E por ele que passa o cadarco, e
    e ele que faz a peca ler como bota: sem o sulco a secao fecha redonda em
    cima e o peito do pe sai liso, que e silhueta de galocha, nao de botina
    amarrada.
    """
    cx, cy, cz = centro
    base = cz + alt * 0.5 * achatar_base * 0.5
    meia = larg * 0.30
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        x = math.cos(a) * larg / 2
        z = math.sin(a) * alt / 2
        if z < 0:
            z *= achatar_base
        elif garganta > 0.0 and abs(x) < meia:
            z -= garganta * (1.0 - (x / meia) ** 2)
        pts.append((cx + x, cy, base + z))
    return pts


def _secao_solado(cx, y, larg, z_chao, z_topo, z_frisa):
    """Secao transversal do solado: oito pontos, com a frisa como ponto mais
    largo. A frisa - o ressalto que corre em volta da sola, logo acima do
    piso - e a aresta que o olho usa para separar sola de cabedal. O solado
    anterior era uma CAIXA mais larga que a bota inteira, com quina viva
    passando por fora do couro em todo o contorno.
    """
    w = larg / 2
    return [(cx - w * 0.86, y, z_chao),
            (cx - w * 0.98, y, z_chao + 0.005),
            (cx - w, y, z_frisa),
            (cx - w * 0.90, y, z_topo),
            (cx + w * 0.90, y, z_topo),
            (cx + w, y, z_frisa),
            (cx + w * 0.98, y, z_chao + 0.005),
            (cx + w * 0.86, y, z_chao)]


def anel_tracado(sup, centro, n=20, folga=0.008, alcance=0.35, u=None, v=None):
    """Anel com o contorno real do corpo naquele plano, afastado `folga`.

    Sem `u`/`v` o plano e o horizontal, que e o certo para perna e tronco.
    Passando os dois, o anel sai no plano que eles geram - e assim que se
    tracam aneis em volta do ANTEBRACO, que na pose A nao e nem vertical nem
    horizontal, e um anel horizontal ali sai como uma fatia obliqua.

    Sempre devolve `n` pontos: onde o raio nao acha nada usa o raio medio dos
    vizinhos, senao o loft recebe aneis de tamanhos diferentes e quebra.
    """
    centro = Vector(centro)
    u = Vector(u).normalized() if u else Vector((1, 0, 0))
    v = Vector(v).normalized() if v else Vector((0, 1, 0))
    direcoes = [(u * math.cos(2 * math.pi * i / n) +
                 v * math.sin(2 * math.pi * i / n)).normalized()
                for i in range(n)]
    raios = []
    for d in direcoes:
        golpe = sup.ray_cast(centro, d, alcance)
        raios.append((golpe[0] - centro).length if golpe and golpe[0] else None)
    validos = [r for r in raios if r]
    if not validos:
        return None
    medio = sum(validos) / len(validos)
    raios = [r if r else medio for r in raios]
    for _ in range(2):
        raios = [(raios[(i - 1) % n] + 2 * raios[i] + raios[(i + 1) % n]) / 4
                 for i in range(n)]
    return [tuple(centro + direcoes[i] * (raios[i] + folga)) for i in range(n)]


def _anel_horizontal(centro, larg, fundo, n=20):
    """Anel no plano XY, para o cano da bota e qualquer manga vertical.

    Separado de `_anel_elipse` de proposito: aquele fatia no plano XZ, que e o
    certo para o pe (secoes ao longo do comprimento) e o errado para a perna -
    misturar os dois no mesmo loft empilha discos de pe e nao faz cano nenhum.
    """
    cx, cy, cz = centro
    return [(cx + math.cos(a) * larg / 2, cy + math.sin(a) * fundo / 2, cz)
            for a in [2 * math.pi * i / n for i in range(n)]]


def _aba(nome, r_int, r_ext, ang0, ang1, espessura=0.004, queda=0.020,
         segmentos=28, escala_y=1.0):
    """Setor de coroa circular: a aba do capacete e a pala do bone.

    `queda` inclina a borda externa para baixo, que e o que da o perfil de aba
    de verdade em vez de um disco plano de papelao.
    """
    bm = bmesh.new()
    linhas = []
    for j in range(2):
        r = (r_int, r_ext)[j]
        linha = []
        for i in range(segmentos + 1):
            a = ang0 + (ang1 - ang0) * i / segmentos
            z = -queda * (j ** 2)
            linha.append(bm.verts.new((r * math.cos(a), r * math.sin(a) * escala_y, z)))
        linhas.append(linha)
    for i in range(segmentos):
        bm.faces.new((linhas[0][i], linhas[0][i + 1], linhas[1][i + 1], linhas[1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = C.obj_de_bmesh(bm, nome)
    mod = obj.modifiers.new("espessura", "SOLIDIFY")
    mod.thickness = espessura
    C.suavizar(obj, 45)
    return obj


# ------------------------------------------------------------------ cabeca

def _casco_capacete(nome, rx, ry, altura, aba, crista=0.0082,
                    segmentos=34, aneis=13, espessura=0.0045):
    """Casco do capacete como UMA superficie continua: aba, friso e calota.

    A versao anterior era uma pilha: meia-elipsoide + tres calotas finas de
    nervura + um setor de coroa de aba + um aro de curva. Cada peca encostava
    na outra e nenhuma continuava a outra, entao a aba lia como um disco colado
    no capacete, as nervuras como tres arames por cima e o aro - que nem chegava
    a ser juntado, porque `join` ignora CURVE num objeto MESH - aparecia branco
    flutuando em volta da cabeca.

    Aqui o perfil e percorrido de uma ponta a outra, da borda externa da aba ate
    o topo, e so depois engrossado. Sem junta, nao ha junta para aparecer.

    - `aba` e (frente, lado, tras) em metros: a largura da aba varia com o
      azimute, que e o que da ao capacete o bico frontal.
    - `crista` e a altura dos tres vincos longitudinais do topo. Eles sao
      DESLOCAMENTO DA PROPRIA CASCA ao longo da normal, nao peca separada: e
      por isso que morrem suavemente dentro do casco em vez de terminarem no ar.
    - O expoente 2.6 do perfil deixa a calota mais CHEIA que uma esfera, com
      ombro perto da base e topo quase reto. Esfera pura da aspecto de tigela.
    """
    frente, lado_a, tras = aba

    def largura_aba(a):
        # +1 na frente (-Y, que e para onde o personagem olha), -1 atras
        f = -math.sin(a)
        if f >= 0:
            return lado_a + (frente - lado_a) * f ** 1.5
        return lado_a + (tras - lado_a) * (-f) ** 1.5

    # perfil: (fator de raio, z). Da borda da aba ate o inicio da calota.
    queda = 0.014
    bm = bmesh.new()
    linhas, cristavel = [], []

    def anel_aba(t, z):
        """t=1 na ponta da aba, t=0 no encontro com o casco."""
        linha = []
        for i in range(segmentos):
            a = 2 * math.pi * i / segmentos
            w = largura_aba(a) * t
            linha.append(bm.verts.new(((rx + w) * math.cos(a),
                                       (ry + w) * math.sin(a), z)))
        return linha

    # aba, de fora para dentro, caindo para a ponta. O primeiro anel RECUA e
    # SOBE em relacao ao segundo: e a borda enrolada da aba. Terminar a aba num
    # corte reto deixa uma lamina de 4 mm de canto vivo, que e o que fazia a
    # peca ler como disco recortado em vez de peca injetada.
    for t, z in ((0.92, -queda * 1.35), (1.00, -queda),
                 (0.62, -queda * 0.52), (0.28, -queda * 0.16)):
        linhas.append(anel_aba(t, z))
        cristavel.append(0.0)

    # friso: a aba sobe, encosta no casco e o casco recua um fio para dentro.
    # Esse degrau de 2 mm e todo o "friso" - como peca separada ele so podia
    # ficar solto, e ficava.
    for fator, z in ((1.014, 0.005), (1.014, 0.014), (0.996, 0.020)):
        linha = []
        for i in range(segmentos):
            a = 2 * math.pi * i / segmentos
            linha.append(bm.verts.new((rx * fator * math.cos(a),
                                       ry * fator * math.sin(a), 0.0 + z)))
        linhas.append(linha)
        cristavel.append(0.0)

    # calota. O ultimo anel para ANTES do polo (t < 1): em t=1 o raio do perfil
    # e zero, o anel inteiro colapsa no eixo e o leque nasce de um anel
    # degenerado - na tela isso vira um bico no alto do capacete.
    z0, h = 0.020, altura - 0.020
    for j in range(1, aneis + 1):
        t = j / (aneis + 1)
        pr = (1.0 - t ** 2.15) ** (1.0 / 2.15)
        linha = []
        for i in range(segmentos):
            a = 2 * math.pi * i / segmentos
            linha.append(bm.verts.new((rx * pr * math.cos(a),
                                       ry * pr * math.sin(a), z0 + h * t)))
        linhas.append(linha)
        # a crista nasce logo acima do friso, vale cheia no meio da calota e
        # CAI DE NOVO perto do polo. Sem essa queda final os tres vincos se
        # encontram no mesmo ponto e somam: o alto do capacete ganhava um bico.
        cristavel.append(min(1.0, max(0.0, (t - 0.18) / 0.32))
                         * min(1.0, max(0.0, (0.92 - t) / 0.22)))

    for j in range(len(linhas) - 1):
        for i in range(segmentos):
            k = (i + 1) % segmentos
            bm.faces.new((linhas[j][i], linhas[j][k],
                          linhas[j + 1][k], linhas[j + 1][i]))
    # leque no polo, em vez de n-gon: n-gon de 34 lados nao e plano e o
    # triangulador do glTF corta onde quiser, estourando o topo
    polo = bm.verts.new((0.0, 0.0, z0 + h))
    for i in range(segmentos):
        bm.faces.new((linhas[-1][i], linhas[-1][(i + 1) % segmentos], polo))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()

    # vincos longitudinais: um no eixo e um de cada lado, deslocados ao longo
    # da normal ja calculada - assim o vinco acompanha a curvatura do casco
    pico = 0.50 * rx
    largura_v = 0.021

    def vinco(x):
        g = math.exp(-((x / largura_v) ** 2))
        g += 0.50 * math.exp(-(((x - pico) / largura_v) ** 2))
        g += 0.50 * math.exp(-(((x + pico) / largura_v) ** 2))
        return g

    for linha, peso in zip(linhas, cristavel):
        if peso <= 0.0:
            continue
        for v in linha:
            v.co += v.normal * (crista * peso * vinco(v.co.x))

    obj = C.obj_de_bmesh(bm, nome)
    mod = obj.modifiers.new("casca", "SOLIDIFY")
    mod.thickness = espessura
    mod.offset = -1.0
    C.suavizar(obj, 52)

    # encaixe universal de acessorio, um de cada lado, logo acima do friso. E
    # detalhe barato (24 triangulos) e e o que mais rapido diz "capacete de
    # trabalho" em vez de "cupula laranja": casco liso de ponta a ponta nao
    # existe em campo, todo capacete tem por onde prender protetor auricular.
    # o x sai do MESMO perfil da calota naquela altura; chutar `rx` deixa a
    # peca boiando no ar, porque a essa altura o casco ja recuou
    t_lug = 0.16
    x_lug = rx * (1.0 - t_lug ** 2.15) ** (1.0 / 2.15)
    pecas = [obj]
    for sinal in (1, -1):
        lug = C.caixa(f"{nome}_encaixe{sinal}", (0.011, 0.032, 0.015),
                      (sinal * (x_lug - 0.003), 0.0, z0 + h * t_lug))
        C.chanfrar(lug, largura=0.0022, segmentos=2)
        pecas.append(lug)
    return C.juntar(pecas, nome)


def capacete(corpo, ref, classe="B", cor=(0.62, 0.27, 0.02), jugular=True,
             nome=None):
    """Capacete de seguranca assentado na cabeca do personagem.

    `classe` muda a forma de proposito, para o jogador conseguir distinguir na
    arara: o B tem aba frontal maior e jugular de tres pontos; o A de obra tem
    aba curta e nenhuma jugular. A diferenca de verdade e o ensaio dieletrico,
    que nao se ve - mas se as duas pecas forem identicas na tela a escolha vira
    sorteio, e o exercicio perde o sentido.
    """
    nome = nome or f"epi_capacete_{classe.lower()}"
    # linha da carneira, na SOBRANCELHA. Com `l-eye + 0,018` o casco descia
    # abaixo da orelha e o conjunto lia como capacete de guerra, nao como
    # capacete de obra - que assenta na testa e deixa a orelha de fora.
    base = ref["l-eye"].z + 0.034 if "l-eye" in ref else ref["head"].z + 0.072

    # O cranio e MEDIDO por raio na pele, nao lido de `cabeca_raio` /
    # `cabeca_fundo`. Aqueles saem da caixa envolvente da malha avaliada com os
    # modificadores desligados, e portanto INCLUEM a geometria de helper do
    # MakeHuman: davam 24,7 cm de frente a nuca num cranio de 19. Era dai que
    # vinha o capacete comprido demais, que lia como capacete de guerra.
    cranio = H.superficie(corpo, lambda co, z=base: co.z >= z - 0.010)
    contorno = H.secao(cranio, (0.0, ref["head"].y, base + 0.012),
                       (1, 0, 0), (0, 1, 0), n=40)
    if len(contorno) >= 8:
        xs = [p.x for p, _ in contorno]
        ys = [p.y for p, _ in contorno]
        rx = max(max(xs), -min(xs)) + 0.013
        cy = (max(ys) + min(ys)) / 2
        ry = (max(ys) - min(ys)) / 2 + 0.013
    else:
        rx = ref["cabeca_raio"] + 0.013
        ry = (ref["cabeca_fundo"] - ref["cabeca_frente"]) / 2 + 0.013
        cy = (ref["cabeca_fundo"] + ref["cabeca_frente"]) / 2
    topo = base + max(0.088, min(0.105, ref["altura"] + 0.022 - base))

    aba = ((0.052, 0.017, 0.024) if classe.upper() == "B"
           else (0.030, 0.015, 0.019))
    casco = _casco_capacete(nome, rx, ry, topo - base, aba)
    casco.location = (0, cy, base)
    C.aplicar(casco, mat_casco(cor))
    saida = [casco]

    if jugular:
        lado = rx * 0.90
        queixo = ref["jaw"].z - 0.014
        frente = ref["jaw"].y
        mat_jug = mat_tecido("jugular", (0.05, 0.05, 0.06), aspereza=0.7)
        # a jugular e PROJETADA NA PELE, uma fita por lado. Tracada por pontos
        # livres ela saia como um zigue-zague de chapas pretas soltas a um
        # centimetro da face: `_fita` orienta a secao pelo eixo Z do mundo, e
        # num trecho quase vertical essa referencia nao diz nada, entao a fita
        # torcia de um segmento para o outro. `fita_na_pele` orienta pela
        # normal do corpo, que e a direcao certa e tambem cola a correia na
        # bochecha, que e onde ela fica numa cabeca de verdade.
        pele = H.superficie(corpo, lambda co: co.z >= queixo - 0.030)
        for sinal in (1, -1):
            guia = [
                (sinal * lado * 0.96, cy + 0.006, base - 0.002),
                (sinal * lado * 0.92, cy - 0.030, base - 0.052),
                (sinal * lado * 0.70, frente * 0.55, queixo + 0.034),
                (sinal * lado * 0.34, frente * 0.90, queixo + 0.006),
                (0.0, frente * 0.98, queixo - 0.002),
            ]
            tira = fita_na_pele(corpo, pele,
                                f"{nome}_jugular_{'l' if sinal > 0 else 'r'}",
                                guia, largura=0.013, mat=mat_jug, folga=0.004,
                                espessura=0.0018, passos=22)
            if tira:
                saida.append(tira)

    for p in saida:
        p.parent = corpo
        p.matrix_parent_inverse = corpo.matrix_world.inverted()
    return saida


def tenis_base(corpo, ref, nome="base_tenis"):
    """O calcado com que ele CHEGA ao vestiario.

    Ele aparecia descalco em toda a fase 1 — montando o fisico, escolhendo o
    tom de pele e ate no fim do turno. O tipo `tenis` de `botinas` ja existia
    no catalogo de EPI e nunca tinha sido usado fora dele.

    No proprio para o jogo poder escondê-lo quando o jogador calca a botina:
    nao da para estar de tenis e de botina ao mesmo tempo.
    """
    return botinas(corpo, ref, tipo="tenis", nome=nome)


def bone(corpo, ref, cor=(0.05, 0.18, 0.32)):
    """Bone da empresa. Nao e EPI - esta na arara porque alguem vai tentar."""
    rx = ref["cabeca_raio"] + 0.006
    ry = (ref["cabeca_fundo"] - ref["cabeca_frente"]) / 2 + 0.006
    cy = (ref["cabeca_fundo"] + ref["cabeca_frente"]) / 2
    base = ref["l-eye"].z + 0.030 if "l-eye" in ref else ref["head"].z + 0.070
    copa = calota("copa", (rx, ry, ref["altura"] + 0.004 - base), espessura=0.0025)
    copa.location = (0, cy, base)
    pala = _aba("pala", rx * 0.9, rx + 0.062,
                -math.pi / 2 - math.radians(60), -math.pi / 2 + math.radians(60),
                espessura=0.0035, queda=0.026, escala_y=ry / rx)
    pala.location = (0, cy, base + 0.006)
    peca = C.juntar([copa, pala], "epi_bone")
    C.aplicar(peca, mat_tecido("brim_bone", cor, aspereza=0.8))
    peca.parent = corpo
    peca.matrix_parent_inverse = corpo.matrix_world.inverted()
    return [peca]


# ------------------------------------------------------------------ face

def visor_arco(corpo, ref, nome="epi_visor_arco"):
    """Protetor facial para arco, acoplado ao capacete."""
    rx = ref["cabeca_raio"] + 0.010
    ry = (ref["cabeca_fundo"] - ref["cabeca_frente"]) / 2 + 0.010
    cy = (ref["cabeca_fundo"] + ref["cabeca_frente"]) / 2
    topo = ref["l-eye"].z + 0.030
    baixo = ref["jaw"].z - 0.028

    bm = bmesh.new()
    linhas = []
    passos, alturas = 26, 8
    for j in range(alturas + 1):
        t = j / alturas
        z = topo + (baixo - topo) * t
        # a lamina abaula para tras embaixo, acompanhando o queixo
        recuo = 1.0 - 0.14 * (t ** 2)
        linha = []
        for i in range(passos + 1):
            a = -math.pi / 2 - math.radians(62) + math.radians(124) * i / passos
            linha.append(bm.verts.new((rx * recuo * math.cos(a),
                                       cy + ry * recuo * math.sin(a), z)))
        linhas.append(linha)
    for j in range(alturas):
        for i in range(passos):
            bm.faces.new((linhas[j][i], linhas[j][i + 1],
                          linhas[j + 1][i + 1], linhas[j + 1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    lamina = C.obj_de_bmesh(bm, nome)
    mod = lamina.modifiers.new("espessura", "SOLIDIFY")
    mod.thickness = 0.0022
    C.suavizar(lamina, 60)
    C.aplicar(lamina, mat_policarbonato())

    lamina.parent = corpo
    lamina.matrix_parent_inverse = corpo.matrix_world.inverted()
    return [lamina]


def oculos(corpo, ref, escuro=False, nome=None):
    """Oculos de seguranca. `escuro` e o de sol sem CA, que esta la de armadilha."""
    nome = nome or ("epi_oculos_escuro" if escuro else "epi_oculos_incolor")
    olho_e = ref.get("l-eye")
    olho_d = ref.get("r-eye")
    if not olho_e or not olho_d:
        return []
    meio = (olho_e + olho_d) / 2
    largura = abs(olho_e.x - olho_d.x)
    pecas = []
    for lado, centro in ((1, olho_e), (-1, olho_d)):
        lente = calota(f"lente{lado}", (largura * 0.40, 0.020, 0.021),
                       corte=-1.0, segmentos=24, aneis=8, espessura=0.0016)
        lente.rotation_euler = (math.radians(90), 0, 0)
        lente.location = (centro.x, centro.y - 0.014, centro.z)
        pecas.append(lente)
    ponte = C.caixa("ponte", (largura * 0.34, 0.006, 0.006),
                    (0, meio.y - 0.016, meio.z + 0.004))
    pecas.append(ponte)
    for lado in (1, -1):
        haste = C.caixa(f"haste{lado}", (0.008, 0.115, 0.005),
                        (lado * (largura * 0.5 + 0.030),
                         meio.y + 0.048, meio.z + 0.006))
        pecas.append(haste)
    peca = C.juntar(pecas, nome)
    C.aplicar(peca, mat_lente(escura=escuro))
    peca.parent = corpo
    peca.matrix_parent_inverse = corpo.matrix_world.inverted()
    return [peca]


# ------------------------------------------------------------------ corpo

def _camisa(corpo, rep, nome, folga=CAMADA["camisa"], espessura=0.005):
    """Camisa de manga longa recortada do tronco e dos bracos.

    `rep` sao as referencias EM REPOUSO (`H.referencias(corpo, repouso=True)`),
    e o recorte roda com `repouso=True`. Os dois andam juntos.

    O teste e uma CAIXA: altura entre a barra e a gola, e |x| ate o punho. Ela
    so descreve o que pretende no corpo em pose de descanso, com o braco
    aberto — e era por isso que o par anterior (caixa em z/x de MUNDO contra a
    malha POSADA) quebrava: no motorista sentado o antebraco descia abaixo da
    barra e saia nu, e na pose relaxada a mao entrava na caixa e virava lasca
    azul. Agora a caixa e a malha estao no mesmo espaco e a pose nao importa.
    """
    z_gola = rep["neck"].z + 0.008
    z_barra = rep["pelvis"].z + 0.012
    # a manga termina por DISTANCIA NO EIXO DO ANTEBRACO, nao por |x|: um
    # limite em x nao separa o polegar, que aponta para dentro e fica com x
    # menor que o do punho. Sobrava uma lasca azul agarrada na mao — pequena,
    # mas bem no centro da vista da cabine. E o mesmo criterio que `_mao` ja
    # usava do outro lado do corte.
    bracos = {}
    for lado in ("l", "r"):
        punho = rep[f"{lado}-hand"]
        bracos[lado] = (punho, (rep[f"{lado}-elbow"] - punho).normalized())

    def teste(_, co):
        if not (z_barra <= co.z <= z_gola):
            return False
        punho, eixo = bracos["l" if co.x > 0 else "r"]
        # 10 mm alem do punho: o punho de acabamento cobre a emenda
        return (Vector(co) - punho).dot(eixo) >= -0.010

    # a malha do corpo e grossa demais para a borda sair lisa: sem subdividir,
    # gola, punho e barra saem em serrilha de quadrado. Decimar depois devolve
    # a silhueta arredondada por um terco do custo.
    return H.recortar(corpo, teste, nome, deslocar=folga, espessura=espessura,
                      subdividir=1, reduzir=0.40, repouso=True)


def _calca(corpo, rep, nome, folga=CAMADA["calca"], espessura=0.005):
    """Calca recortada da perna. `rep` e `repouso=True`, ver `_camisa`.

    Nao usa o grupo `helper-tights`: esse helper e uma gaiola de simulacao bem
    mais larga que a perna, e recortar dela (ainda por cima com folga) devolve
    uma calca de palhaco. A perna com folga de 14 mm cai certo.

    A folga sozinha nao faz calca: deslocar a pele pela normal engorda o
    gemeo junto e o resultado le como legging. O `SMOOTH` depois do recorte
    relaxa justamente a alta frequencia da anatomia — panturrilha, rotula,
    tendao — e deixa a perna caindo reta, que e o que tecido faz e pele nao.
    """
    z_cos = rep["pelvis"].z + 0.055
    # a bainha para em cima do cano da bota, nao no tornozelo: terminando
    # embaixo sobra uma faixa de pele entre a calca e o peito do pe
    z_bainha = rep["l-ankle"].z + 0.100
    # sem limite em x a caixa pega a MAO, que em descanso fica na altura da
    # coxa — a mesma lasca que estragava a camisa
    x_perna = abs(rep["l-upper-leg"].x) + 0.130

    def teste(_, co):
        return z_bainha <= co.z <= z_cos and abs(co.x) <= x_perna

    peca = H.recortar(corpo, teste, nome, deslocar=folga, espessura=espessura,
                      subdividir=1, reduzir=0.40, repouso=True)
    if peca:
        macio = peca.modifiers.new("cair", "SMOOTH")
        macio.factor = 1.0
        macio.iterations = 12
    return peca


def _acabamento(corpo, ref, nome, pano, sup=None):
    """Gola, punho, carcela e bolso.

    Sem isso o uniforme le como collant: uma superficie lisa da cor certa nao
    parece roupa. O que faz parecer roupa e a quebra - a borda de uma gola, a
    sombra de um punho, a linha da carcela no meio do peito.
    """
    sup = sup or superficie_tronco(corpo, ref)
    saida = []
    cy = ref["spine-2"].y
    folga = CAMADA["acabamento"]

    # gola em pe
    # so o cilindro do pescoco: filtrar so por altura pega o queixo e a gola
    # sai como um babador colado no rosto
    eixo_pescoco = Vector((ref["neck"].x, ref["neck"].y, 0))
    spescoco = H.superficie(corpo, lambda co: (
        ref["neck"].z - 0.020 <= co.z <= ref["neck"].z + 0.075
        and (Vector((co.x, co.y, 0)) - eixo_pescoco).length < 0.085))
    gola = anel_na_pele(corpo, spescoco, nome + "_gola",
                        (ref["neck"].x, ref["neck"].y, ref["neck"].z + 0.024),
                        largura=0.054, mat=pano,
                        folga=CAMADA["camisa"] + 0.009, espessura=0.005,
                        n=40)
    if gola:
        saida.append(gola)

    # punho em cada braco
    for lado in ("l", "r"):
        punho = ref[f"{lado}-hand"]
        cotovelo = ref[f"{lado}-elbow"]
        eixo = (cotovelo - punho).normalized()
        centro = punho + eixo * 0.055
        sbraco = H.superficie(corpo, lambda co, p=punho, e=eixo:
                              (co.x > 0) == (p.x > 0)
                              and 0.0 <= (co - p).dot(e) <= 0.13)
        lado_v = eixo.cross(Vector((0, 0, 1))).normalized()
        cima = eixo.cross(lado_v).normalized()
        c = anel_na_pele(corpo, sbraco, f"{nome}_punho_{lado}", centro,
                         largura=0.050, mat=pano,
                         folga=CAMADA["camisa"] + 0.004, espessura=0.005,
                         n=36, u=lado_v, v=cima)
        if c:
            saida.append(c)

    # carcela no meio do peito, tracada por raios de dentro para a frente
    z0 = ref["pelvis"].z + 0.055
    z1 = ref["neck"].z - 0.010
    origens = [(0.0, cy + 0.02, z0 + (z1 - z0) * i / 28) for i in range(29)]
    linha = H.varredura(sup, origens, (0, -1, 0))
    if len(linha) >= 6:
        carcela = fita_na_pele(corpo, sup, nome + "_carcela", None,
                               largura=0.038, mat=pano, folga=folga,
                               espessura=0.004, assentado=linha)
        if carcela:
            saida.append(carcela)

    # bolsos com pala
    for lado, sinal in (("l", 1), ("r", -1)):
        z_bolso = ref["spine-1"].z + 0.052
        for j, (alt, larg, dz) in enumerate(((0.105, 0.098, 0.0),
                                             (0.030, 0.104, 0.062))):
            def teste(_, co, sinal=sinal, z=z_bolso + dz, alt=alt, larg=larg):
                return (abs(co.z - z) <= alt / 2
                        and abs(abs(co.x) - 0.072) <= larg / 2
                        and (co.x > 0) == (sinal > 0)
                        and co.y < cy - 0.030)
            b = H.recortar(corpo, teste, f"{nome}_bolso_{lado}_{j}",
                           deslocar=folga, espessura=0.004,
                           subdividir=2, reduzir=0.30)
            if b:
                C.aplicar(b, pano)
                b.parent = corpo
                b.matrix_parent_inverse = corpo.matrix_world.inverted()
                saida.append(b)

    return saida


def uniforme(corpo, ref, antichama=True, nome=None):
    """Uniforme de campo. O antichama e o certo; o de algodao e a armadilha.

    Os dois tem a mesma forma de proposito - a diferenca real e o tecido, que
    nao se ve. O que distingue na tela e a cor e a etiqueta de ATPV na manga.
    """
    nome = nome or ("epi_uniforme_fr" if antichama else "epi_camisa_algodao")
    cor = (0.055, 0.115, 0.215) if antichama else (0.16, 0.20, 0.26)
    # O PESO do Sheen nao chega ao glTF. Conferido no arquivo: com 0,22,
    # com 0,52 e com 0,55 o `sheenColorFactor` sai sempre `[1,1,1]` — o
    # exportador do Blender manda a TINTA (branca) e descarta o peso. So o
    # `sheenRoughnessFactor` viaja.
    #
    # Na pratica o three.js renderiza com sheen CHEIO, que e o que se ve na
    # tela e esta bom. O valor aqui fica por coerencia com o render do
    # Blender; quem quiser mudar o brilho NO JOGO tem de mexer em
    # `material.sheen` no three, nao aqui.
    pano = mat_tecido("tecido_" + nome, cor,
                      aspereza=0.80 if antichama else 0.86,
                      brilho_fio=0.52 if antichama else 0.58)

    # a caixa de recorte so quer dizer o que pretende no corpo em descanso
    rep = H.referencias(corpo, repouso=True)
    camisa = _camisa(corpo, rep, nome + "_camisa")
    calca = _calca(corpo, rep, nome + "_calca")
    pecas = [p for p in (camisa, calca) if p]
    for p in pecas:
        C.aplicar(p, pano)

    sup = superficie_tronco(corpo, ref)
    pecas += _acabamento(corpo, ref, nome, pano, sup)
    if antichama:
        # faixa refletiva no tronco: e o que se ve na via a noite
        pecas += _faixas_no_tronco(corpo, ref, nome, sup)

    for p in pecas:
        p.parent = corpo
        p.matrix_parent_inverse = corpo.matrix_world.inverted()
    return pecas


def superficie_tronco(corpo, ref):
    """Pele do tronco, sem bracos nem pernas. Base de tudo que circunda o corpo."""
    limite = abs(ref["l-shoulder"].x) * 0.88
    z0 = ref["pelvis"].z - 0.020
    z1 = ref["neck"].z + 0.030
    return H.superficie(corpo, lambda co: abs(co.x) <= limite and z0 <= co.z <= z1)


def superficie_perna(corpo, ref, lado):
    """Pele de uma perna, para a perneira do cinturao."""
    sinal = 1 if lado == "l" else -1
    z1 = ref[f"{lado}-upper-leg"].z - 0.020
    return H.superficie(corpo, lambda co: (co.x > 0) == (sinal > 0)
                        and ref[f"{lado}-knee"].z <= co.z <= z1)


def _faixas_no_tronco(corpo, ref, nome, sup=None, folga=None):
    """Duas faixas retrorrefletivas dando a volta no tronco.

    `folga` explicito porque a mesma faixa serve em duas alturas: por cima da
    CAMISA (o uniforme) e por cima do COLETE, que ja esta mais afastado da
    pele. Com uma constante so, a faixa do colete nascia por DENTRO dele.
    """
    folga = CAMADA["faixa"] if folga is None else folga
    sup = sup or superficie_tronco(corpo, ref)
    mat = mat_refletivo()
    saida = []
    cy = ref["spine-2"].y
    for i, z in enumerate((ref["spine-1"].z - 0.020, ref["spine-2"].z - 0.055)):
        f = anel_na_pele(corpo, sup, f"{nome}_faixa{i}", (0.0, cy, z),
                         largura=0.044, mat=mat, folga=folga,
                         espessura=0.0015)
        if f:
            saida.append(f)
    return saida


def colete(corpo, ref, nome="epi_colete"):
    """Colete de alta visibilidade. Sinalizacao, nao protecao contra arco."""
    z_gola = ref["neck"].z - 0.005
    z_barra = ref["pelvis"].z + 0.075
    x_cava = abs(ref["l-shoulder"].x) + 0.012

    def teste(_, co):
        return z_barra <= co.z <= z_gola and abs(co.x) <= x_cava

    peca = H.recortar(corpo, teste, nome, deslocar=CAMADA["colete"],
                      espessura=0.003)
    if not peca:
        return []
    C.aplicar(peca, mat_tecido("malha_colete", (0.82, 0.42, 0.02), aspereza=0.85,
                               brilho_fio=0.4))
    saida = [peca] + _faixas_no_tronco(corpo, ref, nome,
                                       folga=CAMADA["colete"] + 0.010)
    for p in saida:
        p.parent = corpo
        p.matrix_parent_inverse = corpo.matrix_world.inverted()
    return saida


def alisar_bordas(obj, voltas=8, nivelar=None, alcance=0.045):
    """Tira o serrilhado das bordas livres de uma peca recortada do corpo.

    `recortar` aprova a face quando o CENTRO dela cai na regiao, entao a borda
    que sobra e o contorno bruto dos quads do corpo: dentes de um centimetro.
    No decote da camiseta isso virava uma serra debaixo do queixo, que era o
    pior defeito do rosto de perto.

    O conserto e na propria linha da borda, e nao por cima dela: tres
    tentativas de esconder o estrago com um anel de ribana falharam porque o
    anel e um cilindro e a borda nao e.

    Suavizacao de TAUBIN — uma volta que encolhe, outra que devolve — e nao
    Laplaciano puro: o decote e um laco fechado, e o Laplaciano puro o aperta
    no pescoco mais a cada volta ate virar coleira.

    `nivelar` assenta a borda de cima numa altura so. Taubin converge e para:
    o que sobra depois dela nao e serrilhado, e a ONDA LARGA de a linha do
    corte passar em alturas diferentes em volta do corpo — e era ela que
    abria as duas falhas escuras entre o ombro e o pescoco. Esse corte e um
    plano horizontal, entao a borda dele pode ser plana tambem.
    """
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    vizinhos = {}
    for e in bm.edges:
        if len(e.link_faces) >= 2:
            continue
        va, vb = e.verts
        vizinhos.setdefault(va.index, []).append(vb.index)
        vizinhos.setdefault(vb.index, []).append(va.index)
    # so vertice com exatamente dois vizinhos de borda: numa bifurcacao nao da
    # para dizer qual e a linha, e mexer ali rasga a peca
    linha = {i: v for i, v in vizinhos.items() if len(v) == 2}
    if not linha:
        bm.free()
        return obj
    bm.verts.ensure_lookup_table()
    for volta in range(voltas * 2):
        fator = 0.55 if volta % 2 == 0 else -0.58
        novo = {}
        for i, (u, w) in linha.items():
            co = bm.verts[i].co
            meio = (bm.verts[u].co + bm.verts[w].co) / 2
            novo[i] = co + (meio - co) * fator
        for i, co in novo.items():
            bm.verts[i].co = co
    if nivelar is not None:
        for i in linha:
            v = bm.verts[i]
            if v.co.z > nivelar - alcance:
                v.co.z = nivelar

    bm.to_mesh(obj.data)
    bm.free()
    return obj

def roupa_base(corpo, ref, nome="base_roupa"):
    """Camiseta e bermuda que o personagem usa por baixo de tudo.

    Fica SEMPRE visivel. Nao e enfeite: a etapa de montar o fisico mostra o
    corpo inteiro, e um boneco nu num treinamento de empresa e um problema.
    """
    # DUAS PECAS, e nao uma cor so. Camiseta e bermuda dividiam o mesmo
    # material cinza e o conjunto lia como macacao de presidio — "essas
    # cinzas sao muito esquisitas". Camiseta num azul lavado, bermuda num
    # jeans escuro: e a roupa com que alguem chega ao trabalho.
    malha = mat_tecido("malha_base", (0.055, 0.118, 0.205), aspereza=0.86,
                       brilho_fio=0.25)
    jeans = mat_tecido("jeans_base", (0.034, 0.055, 0.112), aspereza=0.90,
                       brilho_fio=0.18)
    saida = []

    # mesma correcao da camisa: a caixa e as referencias tem de estar as duas
    # no corpo em DESCANSO, senao o recorte segue a pose e corta na diagonal
    rep = H.referencias(corpo, repouso=True)
    eixo = rep["neck"]
    z_barra = rep["pelvis"].z + 0.060
    x_manga = abs(rep["l-shoulder"].x) + 0.085

    z_gola = eixo.z - 0.004

    def camiseta(_, co):
        return z_barra <= co.z <= z_gola and abs(co.x) <= x_manga

    # 17 mm de afastamento, e nao 9. Com 9 a camiseta copiava peitoral,
    # serratil e linha alba: no vestiario ela lia como blusa de compressao
    # de academia, nao como a camiseta com que alguem chega para trabalhar.
    # Pano nao cola no musculo — pousa sobre ele e pula os vales.
    c = H.recortar(corpo, camiseta, nome + "_camiseta", deslocar=0.017,
                   espessura=0.0035, subdividir=1, reduzir=0.40, repouso=True)
    if c:
        alisar_bordas(c, nivelar=z_gola)
        C.aplicar(c, malha)
        saida.append(c)

    z_cos = rep["pelvis"].z + 0.075
    z_bainha = rep["l-knee"].z + 0.075
    # mesmo limite em X da calca: sem ele a bermuda engole a mao
    x_perna = abs(rep["l-upper-leg"].x) + 0.130

    def bermuda(_, co):
        return z_bainha <= co.z <= z_cos and abs(co.x) <= x_perna

    b = H.recortar(corpo, bermuda, nome + "_bermuda", deslocar=0.016,
                   espessura=0.0035, subdividir=1, reduzir=0.40, repouso=True)
    if b:
        alisar_bordas(b)
        C.aplicar(b, jeans)
        saida.append(b)

    for p in saida:
        p.parent = corpo
        p.matrix_parent_inverse = corpo.matrix_world.inverted()
    return saida


# ------------------------------------------------------------------ maos

def _mao(corpo, ref, lado, nome, folga, espessura, ate_cotovelo=0.0,
         reduzir=0.40):
    """Recorta a mao (e opcionalmente parte do antebraco) de um lado."""
    punho = ref[f"{lado}-hand"]
    cotovelo = ref[f"{lado}-elbow"]
    limite = punho + (cotovelo - punho).normalized() * ate_cotovelo
    eixo = (cotovelo - punho).normalized()

    def teste(_, co):
        if (co.x > 0) != (punho.x > 0):
            return False
        # projeta no eixo antebraco: negativo = lado da mao
        return (Vector(co) - limite).dot(eixo) <= 0.0

    return H.recortar(corpo, teste, nome, deslocar=folga, espessura=espessura,
                      reduzir=reduzir)


def _punho_sino(corpo, ref, lado, nome, mat, de, ate, folga0, folga1,
                n=18, aneis=4):
    """Punho em sino da luva, em volta do antebraco.

    E a peca que distingue luva isolante de MAO PINTADA, e era justamente o que
    faltava: a luva saia da propria malha do corpo, com a folga de 3 mm, e na
    tela lia como a mao do personagem em outra cor. O sino e o detalhe que
    qualquer eletricista reconhece de longe.
    """
    punho = ref[f"{lado}-hand"]
    cotovelo = ref[f"{lado}-elbow"]
    eixo = (cotovelo - punho).normalized()
    u = eixo.cross(Vector((0, 0, 1)))
    if u.length < 1e-4:
        u = eixo.cross(Vector((0, 1, 0)))
    u.normalize()
    v = eixo.cross(u).normalized()
    braco = H.superficie(corpo, lambda co, p=punho: (co.x > 0) == (p.x > 0))

    aneis_pts = []
    for j in range(aneis):
        t = j / (aneis - 1)
        centro = punho + eixo * (de + (ate - de) * t)
        # o sino abre de verdade perto da ponta, nao linear: f**2.2
        folga = folga0 + (folga1 - folga0) * (t ** 2.2)
        anel = anel_tracado(braco, tuple(centro), n=n, folga=folga,
                            alcance=0.14, u=u, v=v)
        if anel:
            aneis_pts.append(anel)
    if len(aneis_pts) < 2:
        return None
    obj = _loft(nome, aneis_pts, tampar=False)
    mod = obj.modifiers.new("espessura", "SOLIDIFY")
    mod.thickness = 0.0022
    C.aplicar(obj, mat)
    return obj


def luvas(corpo, ref, tipo="conjunto", nome=None):
    """Luvas.

    - `conjunto`: isolante de borracha com a luva de cobertura de raspa por
      cima. E a unica certa, e por isso e a unica com duas camadas visiveis.
    - `isolante`: so a borracha, sem cobertura - parcialmente certa.
    - `vencida`: a borracha com a etiqueta de ensaio fora da validade.
    - `vaqueta`: so couro, nao isola nada.
    """
    nome = nome or f"epi_luva_{tipo}"
    saida = []

    if tipo in ("conjunto", "isolante", "vencida"):
        cor = (0.022, 0.023, 0.026) if tipo != "vencida" else (0.045, 0.040, 0.030)
        borracha = mat_borracha(cor)
        for lado in ("l", "r"):
            p = _mao(corpo, ref, lado, f"{nome}_borracha_{lado}",
                     folga=0.0030, espessura=0.0022, ate_cotovelo=0.100,
                     reduzir=0.32)
            if p:
                C.aplicar(p, borracha)
                saida.append(p)
            sino = _punho_sino(corpo, ref, lado, f"{nome}_sino_{lado}",
                               borracha, de=0.072, ate=0.158,
                               folga0=0.0032, folga1=0.030)
            if sino:
                saida.append(sino)

    if tipo in ("conjunto", "vaqueta"):
        # raspa de verdade e bege-acinzentada e fosca; 0.52 vira creme no AgX
        couro = mat_couro("raspa", (0.126, 0.082, 0.042), aspereza=0.80)
        # folga acima de ~8 mm funde os dedos numa mitene
        folga = 0.0072 if tipo == "conjunto" else 0.0040
        for lado in ("l", "r"):
            p = _mao(corpo, ref, lado, f"{nome}_raspa_{lado}",
                     folga=folga, espessura=0.0028, ate_cotovelo=0.048,
                     reduzir=0.32)
            if p:
                C.aplicar(p, couro)
                saida.append(p)
            # a cobertura tem punho curto e bem mais estreito que o sino da
            # borracha: na peca `conjunto` os dois tem de aparecer separados,
            # senao o jogador nao ve que sao duas luvas
            sino = _punho_sino(corpo, ref, lado, f"{nome}_punho_{lado}",
                               couro, de=0.034, ate=0.078,
                               folga0=folga + 0.002,
                               folga1=folga + (0.016 if tipo == "conjunto"
                                               else 0.008))
            if sino:
                saida.append(sino)

    if tipo == "vencida":
        # etiqueta de ensaio no punho, vermelha: e a leitura do risco na arara
        etiqueta = mat_tecido("etiqueta_vencida", (0.52, 0.04, 0.03), aspereza=0.6)
        for lado in ("l", "r"):
            punho = ref[f"{lado}-hand"]
            cotovelo = ref[f"{lado}-elbow"]
            eixo = (cotovelo - punho).normalized()
            base = punho + eixo * 0.095

            def teste(_, co, base=base, eixo=eixo, punho=punho):
                if (co.x > 0) != (punho.x > 0):
                    return False
                d = (Vector(co) - base).dot(eixo)
                return -0.018 <= d <= 0.018

            p = H.recortar(corpo, teste, f"{nome}_etiqueta_{lado}",
                           deslocar=0.0105, espessura=0.0012)
            if p:
                C.aplicar(p, etiqueta)
                saida.append(p)

    for p in saida:
        p.parent = corpo
        p.matrix_parent_inverse = corpo.matrix_world.inverted()
    return saida


# ------------------------------------------------------------------ pes

def botinas(corpo, ref, tipo="isolante", nome=None):
    """Calcado com forma propria.

    NAO sai de recortar o pe e escurecer: o recorte mantem os dedos separados e
    ate a unha, e o resultado e um pe pintado de preto, nao uma botina. A forma
    e construida a partir das medidas do pe do personagem, entao continua
    servindo em qualquer fisico.

    - `isolante`: cano medio, solado isolante, sem biqueira metalica.
    - `biqueira`: a mesma botina com a biqueira de aco a mostra - peca condutora
      encostada no pe, vedada em trabalho energizado.
    - `tenis`: calcado pessoal, cano baixo.
    """
    nome = nome or f"epi_botina_{tipo}"
    cano = {"isolante": 0.150, "biqueira": 0.130, "tenis": 0.055}[tipo]
    cor = {"isolante": (0.055, 0.038, 0.026),
           "biqueira": (0.075, 0.052, 0.035),
           "tenis": (0.30, 0.31, 0.33)}[tipo]
    couro = (mat_couro("couro_" + tipo, cor, aspereza=0.48) if tipo != "tenis"
             else mat_tecido("tenis_malha", cor, aspereza=0.82))
    borracha_solado = C.mat_simples(
        "solado_" + tipo,
        (0.035, 0.035, 0.040) if tipo != "tenis" else (0.78, 0.78, 0.76),
        rugosidade=0.82)
    saida = []

    for lado in ("l", "r"):
        torn = ref[f"{lado}-ankle"]
        mn, mx = H.limites(corpo, lambda co, t=torn: (co.x > 0) == (t.x > 0)
                           and co.z <= t.z + 0.030)
        if mn is None:
            continue
        comprimento = mx.y - mn.y
        largura = mx.x - mn.x
        cx = (mn.x + mx.x) / 2
        z_solado = 0.022

        # O cabedal e MEDIDO no pe, fatia por fatia, e nao tirado de uma tabela
        # de proporcoes. Toda a historia de pele aparecendo (dedos por baixo do
        # bico, peito do pe no meio da garganta, calcanhar estourando o couro)
        # era a tabela nao cabendo neste pe: ela foi afinada olhando UM fisico,
        # e o jogador monta o fisico que quiser. Medindo, a bota contem o pe por
        # construcao.
        # so o PE, nao a perna: com a canela dentro da arvore a fatia do
        # tornozelo media 13 cm de altura e o cabedal subia como um tubo
        pe_sup = H.superficie(corpo, lambda co, t=torn: (co.x > 0) == (t.x > 0)
                              and co.z <= t.z + 0.022)
        teto_cabedal = torn.z + 0.026
        base_cabedal = z_solado - 0.011
        # a folga tem de ser MAIOR que a garganta mais funda, senao o sulco do
        # cadarco desce abaixo da pele e abre uma janela no peito do pe
        FOLGA_LADO, FOLGA_TOPO = 0.013, 0.017

        # t=0 e o calcanhar (+Y), t=1 a ponta (-Y, a frente do personagem).
        # A garganta so abre DEPOIS do peito do pe: cavada no tornozelo ela
        # descia abaixo da pele e abria uma janela entre o cabedal e o cano.
        #
        # So se MEDE do calcanhar ate a planta (0,09 a 0,66). Da planta para a
        # frente comecam os DEDOS, e entre eles ha vao: o leque de raios entra
        # pelo vao, mede um dedo so e devolve 1,5 cm de meia largura onde o pe
        # tem 4,5. O bico e extrapolado da ultima fatia boa, que e o que uma
        # forma de sapato faz de verdade - o bico e maior que os dedos, nao
        # colado neles.
        medidos_t = [(0.09, 0.000), (0.22, 0.000), (0.34, 0.004),
                     (0.46, 0.008), (0.58, 0.009), (0.66, 0.008)]
        # (t, fator de largura, fator de altura sobre a base) do bico e do
        # contraforte, relativos a fatia medida vizinha
        bico_t = [(0.76, 1.02, 0.92, 0.006), (0.86, 1.00, 0.80, 0.002),
                  (0.94, 0.90, 0.68, 0.000), (1.00, 0.66, 0.56, 0.000)]
        calcanhar_t = [(0.00, 0.74, 1.04, 0.000)]

        def _y_de(t):
            return mx.y - (comprimento + 0.026) * t + 0.012

        def _fatia(y):
            """Meia largura e topo do pe no plano y. None fora do pe.

            O centro do leque de raios e achado por DOIS raios verticais, nao
            chutado: com z fixo o centro caia acima dos dedos perto da ponta,
            metade dos raios saia pelo vazio e a bota media 8 mm de largura ali.
            """
            alto = pe_sup.ray_cast((cx, y, 0.40), (0, 0, -1), 0.5)
            baixo = pe_sup.ray_cast((cx, y, -0.08), (0, 0, 1), 0.5)
            if not alto or alto[0] is None or not baixo or baixo[0] is None:
                return None
            cz = (alto[0].z + baixo[0].z) / 2
            contorno = H.secao(pe_sup, (cx, y, cz), (1, 0, 0), (0, 0, 1),
                               n=26, alcance=0.22, suavizar=0)
            if len(contorno) < 8:
                return None
            return (max(abs(p.x - cx) for p, _ in contorno) + FOLGA_LADO,
                    min(max(p.z for p, _ in contorno), teto_cabedal)
                    + FOLGA_TOPO)

        medidos = [[t, m[0], m[1], g] for t, g in medidos_t
                   for m in (_fatia(_y_de(t)),) if m]
        if len(medidos) < 3:
            continue
        primeiro, ultimo = medidos[0], medidos[-1]

        def _extrapolar(ref_m, tabela):
            # a folga fica FORA da escala: multiplicando a medida ja folgada,
            # o bico de 84% saia mais largo que a planta do pe
            return [[t, FOLGA_LADO + (ref_m[1] - FOLGA_LADO) * fl,
                     base_cabedal + (ref_m[2] - base_cabedal) * fh, g]
                    for t, fl, fh, g in tabela]

        medidos = (_extrapolar(ultimo, bico_t) + medidos +
                   _extrapolar(primeiro, calcanhar_t))
        medidos.sort(key=lambda m: m[0])

        def medir(t):
            """(meia largura, topo, garganta) do cabedal em `t`."""
            for k in range(len(medidos) - 1):
                t0, l0, h0, g0 = medidos[k]
                t1, l1, h1, g1 = medidos[k + 1]
                if t0 <= t <= t1:
                    u = (t - t0) / max(1e-6, t1 - t0)
                    return (l0 + (l1 - l0) * u, h0 + (h1 - h0) * u,
                            g0 + (g1 - g0) * u)
            return None

        secoes = []
        for t, meia, topo, garganta in medidos:
            alt = (topo - base_cabedal) / 0.775
            secoes.append(_anel_elipse((cx, _y_de(t),
                                        base_cabedal + 0.1375 * alt),
                                       meia * 2, alt, garganta=garganta))
        secoes.reverse()
        corpo_bota = _loft(f"{nome}_{lado}", secoes)
        C.aplicar(corpo_bota, couro)
        saida.append(corpo_bota)

        # cano, em loft proprio, tracado no contorno real da perna. Medir o
        # "tornozelo" por caixa envolvente nao serve: naquela altura a caixa
        # pega o calcanhar e o peito do pe, entao o cano sai estreito, fora do
        # eixo, e a perna atravessa.
        sperna = H.superficie(corpo, lambda co, t=torn: (co.x > 0) == (t.x > 0)
                              and co.z >= t.z - 0.020)
        cy_perna = ref[f"{lado}-knee"].y
        aneis = []
        # o penultimo anel e o COLARINHO: um fio mais largo que os vizinhos,
        # que vira o rolo acolchoado da boca da bota. Sem ele o cano termina
        # num corte reto e o conjunto le como meia de couro.
        # o cano comeca ABAIXO do topo do cabedal, com folga grande, e vai
        # afinando: comecando no tornozelo ele nascia dentro de uma elipse
        # muito mais larga e sobrava um anel de pele entre as duas pecas
        for t, extra in ((0.0, 0.009), (0.12, 0.005), (0.34, 0.0), (0.70, 0.0),
                         (0.93, 0.006), (1.0, 0.001)):
            z = torn.z - 0.026 + (cano + 0.026) * t
            anel = anel_tracado(sperna, (cx, cy_perna, z), n=22,
                                folga=0.012 + 0.004 * t + extra)
            if anel:
                aneis.append(anel)
        if len(aneis) >= 2:
            cano_obj = _loft(f"{nome}_cano_{lado}", aneis, tampar=False)
            C.aplicar(cano_obj, couro)
            saida.append(cano_obj)

        # solado lofteado no CONTORNO DA BOTA, nao caixa. A caixa anterior era
        # mais larga que o cabedal em todo o perimetro e passava reta por baixo
        # dele: na tela a bota ficava em cima de uma prancha preta de quina
        # viva. Aqui a sola acompanha a mesma largura do couro, tem frisa, e o
        # arco levantado entre o salto e a planta faz o degrau do salto sem
        # precisar de peca separada.
        sol_secoes = []
        for t in (0.0, 0.04, 0.16, 0.26, 0.38, 0.52, 0.66, 0.82, 0.94, 1.0):
            meia, _topo, _g = medir(t)
            y = _y_de(t)
            if t < 0.18:          # salto, apoiado no chao
                z_chao = 0.0
            elif t < 0.30:
                z_chao = 0.013 * (t - 0.18) / 0.12
            elif t < 0.46:        # enfranque: a sola nao encosta no chao
                z_chao = 0.013
            elif t < 0.56:
                z_chao = 0.013 * (0.56 - t) / 0.10
            else:
                # NADA de levantar a ponta: com a sola erguida no bico os
                # dedos do personagem apareciam por baixo dela
                z_chao = 0.0
            w = meia * 2 + 0.008  # a sola sobra 4 mm do couro em volta: e a
            if t <= 0.04 or t >= 0.94:   # aba de colagem de qualquer bota
                w *= 0.95         # fecha as pontas, senao o loft tampa um bloco
            sol_secoes.append(_secao_solado(cx, y, w, z_chao,
                                            z_solado + 0.004,
                                            z_chao + 0.008))
        sol_secoes.reverse()
        solado = _loft(f"{nome}_solado_{lado}", sol_secoes)
        C.aplicar(solado, borracha_solado)
        saida.append(solado)

        if tipo != "tenis":
            # LINGUA. Sem ela a garganta e um rasgo aberto: do angulo de cima
            # via-se a canela pelo meio do cadarco, e era essa a mancha de pele
            # que sobrava no peito do pe. Ela tambem e a peca que faz a bota ser
            # lida como amarrada e nao como um sapato de enfiar.
            bm_l = bmesh.new()
            bordas = []
            for t in (0.16, 0.26, 0.36, 0.46, 0.57, 0.68):
                medida = medir(t)
                if not medida:
                    continue
                meia, topo, garganta = medida
                w = meia * 0.60
                # a lingua mora DENTRO da garganta. Posta acima do topo da
                # secao ela virava uma placa colada em cima da bota.
                z = topo - garganta + 0.0035
                bordas.append((bm_l.verts.new((cx - w, _y_de(t), z)),
                               bm_l.verts.new((cx + w, _y_de(t), z))))
            for k in range(len(bordas) - 1):
                bm_l.faces.new((bordas[k][0], bordas[k][1],
                                bordas[k + 1][1], bordas[k + 1][0]))
            if len(bordas) >= 2:
                bmesh.ops.recalc_face_normals(bm_l, faces=bm_l.faces)
                lingua = C.obj_de_bmesh(bm_l, f"{nome}_lingua_{lado}")
                m = lingua.modifiers.new("espessura", "SOLIDIFY")
                m.thickness = 0.0035
                C.suavizar(lingua, 45)
                C.aplicar(lingua, couro)
                saida.append(lingua)
            else:
                bm_l.free()

        if tipo == "biqueira":
            bico = calota(f"{nome}_bico_{lado}", (largura * 0.52, 0.055, 0.040),
                          corte=-0.25, segmentos=22, aneis=9, espessura=0.0)
            bico.location = (cx, mn.y + 0.048, z_solado + 0.012)
            C.aplicar(bico, mat_ferragem())
            saida.append(bico)

        if tipo != "tenis":
            # cadarco ATRAVESSANDO a garganta. Antes as travessas eram postas a
            # 72% da altura da secao e a secao fechava redonda em cima: as
            # barras saiam boiando acima do couro, uma delas atravessada para
            # fora. Agora a altura vem do fundo da propria garganta, que e por
            # onde o cadarco passa de verdade, e a barra fica encaixada nela.
            # SEM Sheen: num preto de cadarco o Sheen branco acende a borda
            # inteira do cilindro e as travessas saiam parecendo barras de aco
            mat_cad = C.mat_simples("cadarco_bota", (0.055, 0.050, 0.045),
                                    rugosidade=0.80)
            for j in range(5):
                t = 0.36 + 0.080 * j
                medida = medir(t)
                if not medida or medida[2] <= 0.003:
                    continue
                meia, topo, garganta = medida
                barra = C.cilindro(f"{nome}_cad_{lado}_{j}", 0.0026,
                                   meia * 1.12,
                                   (cx, _y_de(t),
                                    topo - garganta + 0.0092),
                                   segmentos=6, rot=(0, math.radians(90), 0))
                C.aplicar(barra, mat_cad)
                saida.append(barra)

    for p in saida:
        p.parent = corpo
        p.matrix_parent_inverse = corpo.matrix_world.inverted()
    return saida


# ---------------------------------------------------- fita assentada na pele

def _reamostrar(pontos, passos):
    """Distribui `passos` pontos ao longo da poligonal, por comprimento."""
    pts = [Vector(p) for p in pontos]
    acum = [0.0]
    for i in range(len(pts) - 1):
        acum.append(acum[-1] + (pts[i + 1] - pts[i]).length)
    total = acum[-1]
    if total < 1e-9:
        return pts
    saida = []
    for k in range(passos + 1):
        alvo = total * k / passos
        i = max(j for j in range(len(acum) - 1) if acum[j] <= alvo)
        seg = acum[i + 1] - acum[i]
        t = 0.0 if seg < 1e-9 else (alvo - acum[i]) / seg
        saida.append(pts[i].lerp(pts[i + 1], t))
    return saida


def fita_na_pele(corpo, sup, nome, guia, largura, mat, folga=0.010,
                 espessura=0.0035, passos=64, fechado=False, assentado=None):
    """Fita que segue a pele: projeta o caminho na superficie e constroi a
    faixa com a normal do corpo.

    Substitui recortar a tira do proprio corpo. O recorte parecia a solucao
    obvia - a peca assenta sozinha - mas onde a superficie fica tangente ao
    corte (ombro, axila) ele leva faces inteiras a mais e a tira cria abas
    largas. Projetando, a largura e exatamente a pedida em todo o percurso.
    """
    if assentado is not None:
        assentados = [(p + n * folga, n) for p, n in assentado]
        if fechado and assentados:
            assentados.append(assentados[0])
    else:
        caminho = _reamostrar(guia, passos)
        if fechado and (caminho[0] - caminho[-1]).length > 1e-6:
            caminho.append(caminho[0])
        assentados = [H.projetar(sup, p, folga) for p in caminho]
    if len(assentados) < 2:
        return None

    bm = bmesh.new()
    linhas = []
    n = len(assentados)
    # a largura da fita sai de `tang x normal`, e as normais que vem de
    # `H.secao` nao tem orientacao garantida: onde uma aponta para dentro, o
    # `lado` INVERTE e o quadrilatero se cruza. Na tela isso vira um no de
    # gravata — era o que as duas faixas refletivas do peito faziam. Manter
    # `lado` do mesmo lado do anterior custa tres linhas e resolve para toda
    # fita (gola, punho, carcela, faixa, cinto).
    anterior = None
    for i, (p, normal) in enumerate(assentados):
        if i == 0:
            tang = assentados[1][0] - p
        elif i == n - 1:
            tang = p - assentados[-2][0]
        else:
            tang = assentados[i + 1][0] - assentados[i - 1][0]
        if tang.length < 1e-9:
            tang = Vector((1, 0, 0))
        tang.normalize()
        lado = tang.cross(normal)
        if lado.length < 1e-6:
            lado = tang.cross(Vector((0, 0, 1)))
        lado.normalize()
        if anterior is not None and lado.dot(anterior) < 0:
            lado = -lado
        anterior = lado
        linhas.append((bm.verts.new(p + lado * (largura / 2)),
                       bm.verts.new(p - lado * (largura / 2))))
    for i in range(n - 1):
        a0, b0 = linhas[i]
        a1, b1 = linhas[i + 1]
        try:
            bm.faces.new((a0, a1, b1, b0))
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = C.obj_de_bmesh(bm, nome)
    mod = obj.modifiers.new("espessura", "SOLIDIFY")
    mod.thickness = espessura
    C.suavizar(obj, 50)
    C.aplicar(obj, mat)
    obj.parent = corpo
    obj.matrix_parent_inverse = corpo.matrix_world.inverted()
    return obj


def anel_na_pele(corpo, sup, nome, centro, largura, mat, folga,
                 espessura=0.0035, n=56, u=(1, 0, 0), v=(0, 1, 0)):
    """Faixa fechada em volta do corpo, tracada pela secao real."""
    contorno = H.secao(sup, centro, u, v, n=n)
    if len(contorno) < 8:
        return None
    return fita_na_pele(corpo, sup, nome, None, largura, mat, folga=folga,
                        espessura=espessura, fechado=True, assentado=contorno)


def _anel_guia(centro, raio, n=48, eixo="z", achatar=1.0):
    """Circunferencia de guia. Fica fora do corpo de proposito: a projecao
    puxa cada ponto para a pele mais proxima."""
    cx, cy, cz = centro
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        if eixo == "z":
            pts.append((cx + raio * math.cos(a), cy + raio * achatar * math.sin(a), cz))
        else:
            pts.append((cx + raio * math.cos(a), cy, cz + raio * achatar * math.sin(a)))
    return pts


# ------------------------------------------------------------------ cintura

def cinturao(corpo, ref, tipo="paraquedista", nome=None):
    """Cinturao.

    - `paraquedista`: tirantes de ombro, tirante peitoral, cinto, perneiras,
      argola dorsal e talabarte duplo com absorvedor.
    - `abdominal`: so a faixa na cintura. Concentra a queda no abdome e deixa o
      corpo virar - vedado como retencao de queda.
    """
    nome = nome or f"epi_{tipo}"
    fita = mat_cadarco()
    ferro = mat_ferragem()
    sup = superficie_tronco(corpo, ref)
    saida = []

    cy = ref["spine-2"].y
    z_cinto = ref["pelvis"].z + 0.105
    largura_cinto = 0.075 if tipo == "abdominal" else 0.052
    saida.append(anel_na_pele(corpo, sup, nome + "_cinto", (0.0, cy, z_cinto),
                              largura=largura_cinto, mat=fita,
                              folga=CAMADA["tirante"], espessura=0.006))

    if tipo == "abdominal":
        fivela = C.caixa(nome + "_fivela", (0.070, 0.016, 0.055),
                         (0.0, ref["pelvis"].y - 0.150, z_cinto))
        C.chanfrar(fivela, largura=0.004, segmentos=2)
        C.aplicar(fivela, ferro)
        saida.append(fivela)
    else:
        ombro = abs(ref["l-shoulder"].x)
        z_ombro = ref["l-shoulder"].z
        for lado, sinal in (("l", 1), ("r", -1)):
            guia = [
                (sinal * ombro * 0.34, cy - 0.40, z_cinto + 0.020),
                (sinal * ombro * 0.52, cy - 0.40, ref["spine-2"].z + 0.010),
                (sinal * ombro * 0.70, cy - 0.35, ref["spine-1"].z + 0.070),
                (sinal * ombro * 0.80, cy, z_ombro + 0.090),
                (sinal * ombro * 0.62, cy + 0.35, ref["spine-1"].z + 0.030),
                (sinal * ombro * 0.30, cy + 0.38, z_cinto + 0.020),
            ]
            saida.append(fita_na_pele(corpo, sup, f"{nome}_tirante_{lado}",
                                      guia, largura=0.044, mat=fita,
                                      folga=CAMADA["tirante"], espessura=0.004,
                                      passos=56))

        # tirante peitoral: so o arco da frente, recortado da secao inteira
        z_peito = ref["spine-1"].z + 0.038
        contorno = H.secao(sup, (0.0, cy, z_peito), (1, 0, 0), (0, 1, 0), n=56)
        frente = [pn for pn in contorno if pn[0].y < cy - 0.020]
        if len(frente) >= 6:
            frente.sort(key=lambda pn: pn[0].x)
            saida.append(fita_na_pele(corpo, sup, nome + "_peitoral", None,
                                      largura=0.034, mat=fita,
                                      folga=CAMADA["tirante"] + 0.004,
                                      espessura=0.0035, assentado=frente))

        for lado in ("l", "r"):
            sperna = superficie_perna(corpo, ref, lado)
            cxl = ref[f"{lado}-upper-leg"].x
            z_perneira = ref[f"{lado}-upper-leg"].z - 0.085
            saida.append(anel_na_pele(corpo, sperna, f"{nome}_perneira_{lado}",
                                      (cxl, ref["pelvis"].y, z_perneira),
                                      largura=0.046, mat=fita,
                                      folga=CAMADA["calca"] + 0.012,
                                      espessura=0.005))

        dorso_p, _ = H.projetar(
            sup, (0.0, cy + 0.40, ref["spine-1"].z + 0.055), 0.045)
        argola = C.anel(nome + "_argola", raio=0.032, espessura=0.006,
                        pos=tuple(dorso_p), rot=(math.radians(90), 0, 0))
        C.aplicar(argola, ferro)
        saida.append(argola)

        for lado, sinal in (("l", 1), ("r", -1)):
            fim_t = Vector((sinal * (ombro + 0.050), dorso_p.y + 0.020,
                            z_cinto - 0.110))
            corda = _fita(f"{nome}_talabarte_{lado}", [
                tuple(dorso_p),
                tuple(dorso_p + Vector((sinal * 0.060, 0.012, -0.095))),
                tuple(fim_t + Vector((0, 0, 0.150))),
                tuple(fim_t),
            ], largura=0.030, espessura=0.005)
            C.aplicar(corda, fita)
            saida.append(corda)

            gancho = C.anel(f"{nome}_gancho_{lado}", raio=0.030,
                            espessura=0.008,
                            pos=tuple(fim_t + Vector((0, 0, -0.030))),
                            rot=(math.radians(90), 0, 0))
            C.aplicar(gancho, ferro)
            saida.append(gancho)

            absorvedor = C.caixa(f"{nome}_absorvedor_{lado}",
                                 (0.050, 0.028, 0.100),
                                 tuple(dorso_p + Vector((sinal * 0.032, 0.020,
                                                         -0.052))))
            C.chanfrar(absorvedor, largura=0.004, segmentos=2)
            C.aplicar(absorvedor, mat_tecido("absorvedor", (0.42, 0.20, 0.02),
                                             aspereza=0.7))
            saida.append(absorvedor)

    saida = [p for p in saida if p]
    for p in saida:
        if not p.parent:
            p.parent = corpo
            p.matrix_parent_inverse = corpo.matrix_world.inverted()
    return saida


# ------------------------------------------------------------------ vestir

MONTAGEM = {
    "capacete_b": lambda c, r: capacete(c, r, classe="B", jugular=True),
    "capacete_a": lambda c, r: capacete(c, r, classe="A", jugular=False,
                                        cor=(0.68, 0.62, 0.05)),
    "bone": bone,
    # a chave e o id do catalogo em src/conteudo/epi.ts, e vira o nome do no
    # no .glb (`epi_<id>`). Trocar uma das duas pontas sem a outra faz a peca
    # sumir do personagem sem erro nenhum.
    "protetor_facial_arco": visor_arco,
    "oculos_incolor": lambda c, r: oculos(c, r, escuro=False),
    "oculos_escuro": lambda c, r: oculos(c, r, escuro=True),
    "vestimenta_fr": lambda c, r: uniforme(c, r, antichama=True),
    "camisa_algodao": lambda c, r: uniforme(c, r, antichama=False),
    "colete_refletivo": colete,
    "luva_isolante_cobertura": lambda c, r: luvas(c, r, "conjunto"),
    "luva_isolante_so": lambda c, r: luvas(c, r, "isolante"),
    "luva_isolante_vencida": lambda c, r: luvas(c, r, "vencida"),
    "luva_vaqueta": lambda c, r: luvas(c, r, "vaqueta"),
    "botina_isolante": lambda c, r: botinas(c, r, "isolante"),
    "botina_biqueira": lambda c, r: botinas(c, r, "biqueira"),
    "tenis": lambda c, r: botinas(c, r, "tenis"),
    "paraquedista_talabarte": lambda c, r: cinturao(c, r, "paraquedista"),
    "cinto_abdominal": lambda c, r: cinturao(c, r, "abdominal"),
}


def vestir(corpo, ref, ids):
    """Monta as pecas pedidas. Os ids sao os mesmos de src/conteudo/epi.ts."""
    saida = {}
    for i in ids:
        if i in MONTAGEM:
            saida[i] = MONTAGEM[i](corpo, ref) or []
    return saida


def detalhar_tecido(mat, trama=900.0, relevo=0.14, mancha=16.0, forca=0.20):
    """Poe TRAMA e variacao de tom no tecido, para ser ASSADO.

    O uniforme era uma cor lisa com Sheen. O Sheen resolve o brilho de borda,
    mas nao resolve a superficie: de frente, a peca continua um azul chapado,
    que e o "amador" do retorno do cliente.

    Isto entra como procedural de ESPACO DE OBJETO, que nao sobrevive ao glTF
    — tem de passar pelo forno (`exportar.assar_grupo`). Por isso so e chamado
    na hora de exportar, e so na peca que vale a pena: o uniforme e a maior
    superficie do personagem.

    - `estriar` em escala alta vira a diagonal da SARJA, que e a trama do
      brim e do tecido antichama de verdade.
    - `sujar` quebra a uniformidade da cor e da rugosidade — e a ausencia
      disso que faz pano parecer plastico pintado.

    O forno ainda embute a OCLUSAO na cor, e e ela que da vinco: a gola, o
    punho e a dobra do cotovelo ganham sombra de contato assada, sem custar
    nada em tempo real.
    """
    C.sujar(mat, escala=mancha, forca=forca, aspereza=0.18)
    C.estriar(mat, escala=trama, forca=relevo)
    return mat


def resgatar_sheen(obj, brilho_fio=0.55, aspereza=0.32):
    """Devolve o Sheen depois do forno.

    `exportar.assar_grupo` TROCA o material da peca por um PBR simples com os
    tres mapas assados — e leva junto o Sheen, que e o que faz o pano ter
    brilho de borda. Assado sem isto, o uniforme ganha trama e perde o
    caimento. Os dois efeitos sao independentes e se somam.
    """
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.node_tree:
            continue
        b = next((n for n in mat.node_tree.nodes
                  if n.type == "BSDF_PRINCIPLED"), None)
        if not b:
            continue
        for entrada, valor in (("Sheen Weight", brilho_fio),
                               ("Sheen Roughness", aspereza)):
            if entrada in b.inputs:
                b.inputs[entrada].default_value = valor
    return obj
