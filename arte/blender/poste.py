"""Poste de distribuicao padrao brasileiro: DT 11/300, cruzeta, isoladores de pino
15 kV, mao-francesa, transformador 45 kVA com buchas e condutores de media tensao.

Medidas em metros, aproximadas ao padrao de distribuicao.
Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P poste.py
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Euler

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
# `cortar` (booleano de diferenca) e `chanfrar` que APLICA na hora ja existem
# em caminhao.py e foram validados no remodelamento dele. Importar e mais
# barato que uma terceira copia das mesmas dez linhas — caminhao.py nao tem
# efeito de modulo, so constantes e funcoes.
import caminhao as CAM

R = math.radians

# ------------------------------------------------------------------ medidas
ALTURA_LIVRE = 9.30          # 11 m com 1,70 m de engastamento
TOPO_FACE = 0.19             # face do duplo T no topo
BASE_FACE = 0.36             # face do duplo T no nivel do solo
LARGURA = 0.11               # espessura constante
ALMA = 0.055                 # espessura da alma

Z_CRUZETA = 8.95
CRUZETA = (2.40, 0.112, 0.090)   # comprimento, espessura, altura (padrao 2400 mm)
Y_CRUZETA = 0.10
Z_TRAFO = 6.10
ALT_TANQUE = 0.86
RAIO_TANQUE = 0.33
X_TRAFO = 0.60

Z_TOPO_CRUZETA = Z_CRUZETA + CRUZETA[2] / 2
Z_FIO = Z_TOPO_CRUZETA + 0.115 + 0.112      # garganta do isolador
VAO = 38.0                                   # vao ate o poste vizinho

# furacao passante do DT: furo de 18 mm a cada 150 mm na alma, da altura do
# transformador para cima. E a marca registrada do poste de concreto brasileiro
# e o modelo nao tinha nenhum — era por isso que lia como uma viga lisa.
FURO_RAIO = 0.018
FURO_PASSO = 0.150
FURO_Z0 = 2.95
FURO_N = 42

Z_CHAVES = 7.70              # cruzeta das chaves fusivel, acima do trafo

#: Articulacao do porta-fusivel que o jogo abre, em coordenada de MUNDO do
#: Blender. Preenchido por `montar()`; o exportador le daqui e grava no json.
PINO_TUBO = None

# As tres fases: (x, y, z do fio). As laterais nos isoladores da cruzeta, a
# central no pino de topo — ver a nota em `montar()`.
Z_FIO_TOPO = ALTURA_LIVRE + 0.035 + 0.115 + 0.112
FASES = (
    (-0.95, Y_CRUZETA, Z_FIO),
    (0.00, 0.00, Z_FIO_TOPO),
    (0.95, Y_CRUZETA, Z_FIO),
)


# ------------------------------------------------------------------ pecas
def poste():
    """Secao duplo T com conicidade: perfil em I do topo ate a base."""
    def perfil(face):
        w, d, tf, tw = LARGURA / 2, face / 2, 0.035, ALMA / 2
        return [
            (-w, d), (w, d), (w, d - tf), (tw, d - tf),
            (tw, -d + tf), (w, -d + tf), (w, -d), (-w, -d),
            (-w, -d + tf), (-tw, -d + tf), (-tw, d - tf), (-w, d - tf),
        ]

    bm = bmesh.new()
    niveis = 6
    anteriores = None
    for i in range(niveis + 1):
        t = i / niveis
        z = t * ALTURA_LIVRE
        face = BASE_FACE + (TOPO_FACE - BASE_FACE) * t
        atuais = [bm.verts.new((x, y, z)) for x, y in perfil(face)]
        if anteriores:
            n = len(atuais)
            for j in range(n):
                bm.faces.new((anteriores[j], anteriores[(j + 1) % n],
                              atuais[(j + 1) % n], atuais[j]))
        else:
            bm.faces.new(atuais)   # tampa inferior
        anteriores = atuais
    bm.faces.new(list(reversed(anteriores)))  # tampa superior
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = C.obj_de_bmesh(bm, "poste")

    # FURACAO: um cilindro deitado + ARRAY no eixo Z + UM booleano. Furar com
    # 25 chamadas de boolean separadas daria a mesma imagem e levaria minutos;
    # o array resolve na mesma passada e e o que o modificador existe para
    # fazer. Booleano ANTES do chanfro: o inverso produz quina podre na borda
    # do furo.
    faca = C.cilindro("poste_faca", FURO_RAIO, 0.60, (0, 0, FURO_Z0),
                      segmentos=10, rot=(0, R(90), 0))
    arr = faca.modifiers.new("fileira", "ARRAY")
    arr.use_relative_offset = False
    arr.use_constant_offset = True
    arr.constant_offset_displace = (0, 0, FURO_PASSO)
    arr.count = FURO_N
    bpy.context.view_layer.objects.active = faca
    bpy.ops.object.modifier_apply(modifier="fileira")
    CAM.cortar(obj, faca)

    C.chanfrar(obj, largura=0.009, segmentos=2, angulo=50)
    return obj


def cabeca_poste():
    """Chapeu chanfrado do topo: concreto moldado nunca termina em quina viva."""
    face = TOPO_FACE
    topo = C.caixa("poste_cabeca", (LARGURA + 0.012, face + 0.012, 0.055),
                   (0, 0, ALTURA_LIVRE - 0.020))
    C.chanfrar(topo, largura=0.016, segmentos=2, angulo=35)
    return topo


def degraus():
    """Degraus de escalada: barras de aco alternadas dos dois lados.

    Nenhum poste de distribuicao e uma coluna lisa. Sao os degraus que dao
    ESCALA ao poste — sem eles o olho nao tem com o que medir a altura e a
    peca le como um pilar generico de render.
    """
    pecas = []
    z = 3.10
    lado = 1
    i = 0
    while z < 8.40:
        haste = C.cilindro(f"degrau{i}", 0.014, 0.34, (0, 0, 0), segmentos=6,
                           rot=(0, R(90), 0))
        for v in haste.data.vertices:
            v.co.x += lado * 0.145
            v.co.z += z
        ponta = C.cilindro(f"degrau{i}_p", 0.022, 0.018,
                           (lado * 0.300, 0, z), segmentos=6, rot=(0, R(90), 0))
        pecas += [haste, ponta]
        lado *= -1
        z += 0.42
        i += 1
    return C.juntar(pecas, "degrau_conj")


def placa_poste():
    """Placa de identificacao numerada, na altura do olho."""
    p = C.caixa("placa_id", (0.090, 0.004, 0.150), (0, 0.166, 1.62))
    C.chanfrar(p, largura=0.004, segmentos=1)
    return p


def isolador_pino():
    """Isolador de pino 15 kV: porcelana marrom, duas saias e garganta no topo."""
    perfil = [
        (0.000, 0.000), (0.068, 0.000), (0.072, 0.014), (0.066, 0.022),
        (0.044, 0.030), (0.046, 0.040), (0.058, 0.046), (0.054, 0.056),
        (0.038, 0.062), (0.040, 0.082), (0.050, 0.090), (0.049, 0.100),
        (0.038, 0.104), (0.038, 0.112), (0.049, 0.118), (0.046, 0.128),
        (0.030, 0.134), (0.012, 0.136), (0.000, 0.136),
    ]
    return C.perfil_revolucao(perfil, "isolador", segmentos=20)


def _curva_em_malha(obj):
    """Curva -> malha, com a transformacao do objeto APLICADA.

    Duas razoes: `bpy.ops.object.join` recusa misturar CURVE com MESH, e aqui
    o conjunto e girado vertice a vertice depois — se a rotacao do OBJETO
    ficasse pendente, a argola nasceria no lugar errado.
    """
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)
    return obj


def chave_fusivel(nome, pos, mats, inclinacao=20.0, separar_tubo=False):
    """Chave fusivel 15 kV / 100 A — a peca que FALTAVA na cena.

    E a chave que o eletricista abre para desenergizar o trecho: o jogador
    olha direto para ela na sequencia da NR-10 e ela simplesmente nao existia
    no modelo. Sao quatro partes: o corpo de porcelana com saias, os dois
    contatos de bronze (superior e inferior), o porta-fusivel (o tubo que
    bascula para baixo quando queima) e a argola de manobra onde entra a vara.

    O conjunto e construido com o eixo em Z e so DEPOIS a malha e girada em
    torno de Y — girar `obj.rotation_euler` deixaria a rotacao pendente e
    `juntar` a descartaria junto com os modificadores.

    `separar_tubo` devolve o porta-fusivel como OBJETO PROPRIO em vez de
    junta-lo na porcelana. Serve para uma chave so: a do meio, que e a do
    ramal com defeito. No jogo o eletricista abre essa chave com a vara, e
    abrir e o porta-fusivel BASCULAR para baixo — sem no proprio nao ha o que
    girar, e a acao central da fase 3 vira um texto na lateral da tela.
    Devolve tambem o ponto de articulacao (o contato inferior) em coordenada
    de mundo, porque calcular essa trigonometria de novo no jogo e repetir
    uma conta que ja foi feita aqui.
    """
    pecas = []
    X_TUBO = 0.150          # avanco dos contatos: onde o porta-fusivel mora
    Z_SUP, Z_INF = 0.470, 0.045

    # Corpo de porcelana: COLUNA FINA com saias CHATAS. A primeira versao
    # usava um perfil gordo e ondulado e saia no render como pino de boliche
    # marrom. A saia real e um disco fino que se projeta da coluna — e a
    # sombra entre discos que le como isolador.
    perfil = [(0.000, 0.000), (0.052, 0.000), (0.052, 0.022), (0.030, 0.030)]
    z = 0.030
    for _ in range(4):
        perfil += [(0.030, z + 0.020), (0.068, z + 0.038),
                   (0.068, z + 0.050), (0.030, z + 0.062)]
        z += 0.095
    perfil += [(0.030, z + 0.010), (0.048, z + 0.018), (0.048, Z_SUP + 0.030),
               (0.000, Z_SUP + 0.030)]
    corpo = C.perfil_revolucao(perfil, f"chave_porc_{nome}", segmentos=16)
    pecas.append(corpo)

    # Contatos de bronze: pecas FUNDIDAS, nao pregos. Cada um e um bloco
    # chanfrado saindo do corpo mais a orelha que abraca a ponta do tubo.
    for i, (zc, h) in enumerate(((Z_SUP, 0.046), (Z_INF, 0.040))):
        braco = C.caixa(f"chave_aco_{nome}_b{i}", (X_TUBO + 0.010, 0.058, h),
                        ((X_TUBO + 0.010) / 2 + 0.018, 0, zc))
        C.chanfrar(braco, largura=0.008, segmentos=2)
        pecas.append(braco)
        orelha = C.caixa(f"chave_aco_{nome}_o{i}", (0.034, 0.072, h + 0.030),
                         (X_TUBO, 0, zc + (0.014 if i else -0.014)))
        C.chanfrar(orelha, largura=0.006, segmentos=2)
        pecas.append(orelha)

    # Porta-fusivel: tubo ENTRE os dois contatos. Na versao anterior ele
    # ficava solto ao lado do corpo e lia como uma vareta esquecida ali.
    meio = (Z_SUP + Z_INF) / 2
    comp = (Z_SUP - Z_INF) + 0.055
    tubo = C.cilindro(f"chave_tubo_{nome}", 0.024, comp,
                      (X_TUBO, 0, meio), segmentos=10)
    pecas.append(tubo)
    cab = C.cilindro(f"chave_tubo_{nome}_cab", 0.032, 0.040,
                     (X_TUBO, 0, Z_SUP + 0.016), segmentos=10)
    C.chanfrar(cab, largura=0.006, segmentos=2)
    pecas.append(cab)
    # argola de manobra: e onde entra o gancho da vara de manobra
    arg = C.anel(f"chave_aco_{nome}_arg", raio=0.034, espessura=0.006,
                 pos=(X_TUBO, 0, Z_INF - 0.060), rot=(R(90), 0, 0))
    arg.data.bevel_resolution = 1
    arg.data.resolution_u = 3
    pecas.append(_curva_em_malha(arg))

    # NAO juntar tudo: porcelana e bronze sao materiais (e grupos de bake)
    # diferentes. Juntar aqui pintaria os contatos de marrom de porcelana.
    # separar ANTES de juntar: `join` apaga os objetos absorvidos e uma
    # segunda leitura de `pecas` cai em "StructRNA has been removed"
    lista_tubo = [o for o in pecas if "_tubo_" in o.name] if separar_tubo else []
    lista_porc = [o for o in pecas
                  if (("_porc_" in o.name or "_tubo_" in o.name)
                      and o not in lista_tubo)]
    lista_aco = [o for o in pecas if "_aco_" in o.name]
    # O porta-fusivel e FENOLICO, quase preto — nao porcelana marrom. Sem isto
    # o tubo some dentro do corpo e a chave perde a leitura de "tem uma peca
    # que bascula". O material vai no slot ANTES do join: `join` preserva os
    # slots, e o forno junta tudo numa textura so depois.
    for o in lista_porc + lista_tubo:
        C.aplicar(o, mats["fenolico"] if "_tubo_" in o.name else mats["porcelana"])
    porc = C.juntar(lista_porc, f"chave_porc_{nome}")
    aco = C.juntar(lista_aco, f"chave_aco_{nome}")
    tubo_obj = C.juntar(lista_tubo, f"chave_tubo_{nome}") if lista_tubo else None
    giro = Euler((0, R(inclinacao), 0))
    for obj in (porc, aco, tubo_obj):
        if obj is None:
            continue
        for v in obj.data.vertices:
            v.co.rotate(giro)
            v.co += Vector(pos)

    # devolve tambem os dois terminais em coordenada de mundo: e deles que
    # saem os rabichos, e calcular isso na mao em montar() seria repetir a
    # mesma trigonometria com chance de errar o sinal
    def terminal(z_local):
        p = Vector((X_TUBO, 0.0, z_local))
        p.rotate(giro)
        return tuple(p + Vector(pos))

    # articulacao do porta-fusivel: o contato INFERIOR. Chave fusivel abre
    # basculando para baixo, presa embaixo — nao caindo inteira.
    return (porc, aco, terminal(Z_SUP + 0.030), terminal(Z_INF - 0.010),
            tubo_obj, terminal(Z_INF))


def suporte_chaves():
    """Mao-de-amigo que leva as tres chaves: cantoneira em U saindo do poste."""
    pecas = []
    y = 0.0
    viga = C.caixa("chave_aco_viga", (0.075, 1.05, 0.075), (0.30, y, Z_CHAVES))
    C.chanfrar(viga, largura=0.007, segmentos=2)
    pecas.append(viga)
    # braco que liga a viga ao corpo do poste: sem ele a viga fica boiando
    braco = C.caixa("chave_aco_braco", (0.33, 0.075, 0.070),
                    (0.185, y, Z_CHAVES))
    C.chanfrar(braco, largura=0.006, segmentos=2)
    pecas.append(braco)
    for s in (-1, 1):
        pecas.append(C.barra(f"chave_aco_tir{s}", (0.055, 0, Z_CHAVES - 0.48),
                             (0.30, s * 0.44, Z_CHAVES - 0.040),
                             secao=(0.045, 0.006)))
    return C.juntar(pecas, "chave_aco_sup")


def pino_isolador():
    perfil = [
        (0.000, 0.000), (0.026, 0.000), (0.026, 0.020), (0.019, 0.026),
        (0.019, 0.090), (0.016, 0.096), (0.016, 0.120), (0.000, 0.120),
    ]
    return C.perfil_revolucao(perfil, "pino", segmentos=14)


def bucha(altura=0.30, raio=0.055, saias=5):
    """Bucha de porcelana do transformador: cone com aneis de saia."""
    perfil = [(0.000, 0.000), (raio * 1.45, 0.000), (raio * 1.45, 0.020),
              (raio * 1.20, 0.028)]
    z = 0.034
    passo = (altura - 0.10) / saias
    for i in range(saias):
        r = raio * (1.0 - 0.07 * i)
        perfil += [(r * 0.68, z), (r * 1.22, z + passo * 0.26),
                   (r * 1.12, z + passo * 0.42), (r * 0.66, z + passo * 0.64)]
        z += passo
    perfil += [(raio * 0.48, z), (raio * 0.48, altura - 0.050),
               (raio * 0.26, altura - 0.034), (raio * 0.26, altura),
               (0.000, altura)]
    return C.perfil_revolucao(perfil, "bucha", segmentos=16)


def casco_corrugado(nome, raio, altura, abas=24, amostras=6, prof=0.055):
    """Tanque com a parede CORRUGADA na propria malha, numa peca so.

    A versao anterior era um cilindro liso com 30 caixas chanfradas plantadas
    em volta — 6.284 triangulos para um resultado que o cliente leu como
    "aquecedor de agua com grelha colada". Duas coisas estavam erradas:

    1) As aletas eram chapas SOLTAS, com folga visivel contra o tanque e
       cobrindo so 66% da altura. A corrugacao de um tanque real e a propria
       chapa da parede prensada — nao tem junta nenhuma para a luz entrar.
    2) Chapa chata com quina viva nao tem como pegar luz: toda a volta do
       tanque devolvia o mesmo cinza. E a curva do vale para a crista que
       produz o degrade que o olho le como metal.

    Aqui a parede e um loft de seis aneis em que o RAIO oscila com o angulo.
    `amostras` por aba controla o quanto o vinco e arredondado; abaixo de 4 a
    aba vira um pico de um vertice so e volta a parecer chapa.
    """
    # a transicao do aro liso para a corrugacao tem de ser CURTA. Com 55 mm
    # de mistura a aba nascia afilando e o tanque parecia uma vela derretida;
    # na chapa real a corrugacao comeca no cordao de solda, de uma vez.
    niveis = [(0.000, 0.0), (0.062, 0.0), (0.078, 1.0),
              (altura - 0.078, 1.0), (altura - 0.062, 0.0), (altura, 0.0)]
    n = abas * amostras
    bm = bmesh.new()
    aneis = []
    for z, peso in niveis:
        atual = []
        for i in range(n):
            a = i * 2 * math.pi / n
            s = math.cos(abas * a)
            # expoente > 1 ESTREITA a aba. Com 0,55 o vinco ficava largo e
            # o tanque lia como vela derretida em vez de chapa prensada.
            onda = (s ** 2.2) if s > 0 else 0.0
            r = raio + prof * peso * onda
            atual.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
        aneis.append(atual)
    for k in range(len(aneis) - 1):
        a, b = aneis[k], aneis[k + 1]
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(aneis[0])))
    bm.faces.new(aneis[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = C.obj_de_bmesh(bm, nome)
    C.suavizar(obj, 21)
    return obj


def transformador():
    """Tanque 45 kVA: parede corrugada, tampa flangeada, alcas e acessorios."""
    pecas = []
    pecas.append(casco_corrugado("transformador", RAIO_TANQUE, ALT_TANQUE))

    # flange aparafusada: o aro mais as cabecas dos parafusos. Sem as cabecas
    # a tampa vira uma tampa de balde — sao elas que dizem "isto abre".
    flange = C.cilindro("transformador_fl", RAIO_TANQUE * 1.075, 0.034,
                        (0, 0, ALT_TANQUE + 0.004), segmentos=32)
    C.chanfrar(flange, largura=0.006, segmentos=2)
    pecas.append(flange)
    for i in range(14):
        a = i * 2 * math.pi / 14
        pecas.append(C.cilindro(
            f"transformador_pf{i}", 0.013, 0.014,
            (math.cos(a) * RAIO_TANQUE * 1.045, math.sin(a) * RAIO_TANQUE * 1.045,
             ALT_TANQUE + 0.027), segmentos=6))

    # tampa levemente abaulada: agua de chuva nao pode empocar nela
    tampa = C.perfil_revolucao(
        [(0.000, 0.034), (RAIO_TANQUE * 0.62, 0.030), (RAIO_TANQUE * 0.99, 0.012),
         (RAIO_TANQUE * 0.99, 0.000), (0.000, 0.000)],
        "transformador_tp", segmentos=32)
    for v in tampa.data.vertices:
        v.co.z += ALT_TANQUE + 0.020
    pecas.append(tampa)

    # acessorios: valvula de alivio na tampa, registro de dreno embaixo e
    # placa de identificacao. Sao eles que separam "cilindro cinza" de
    # "equipamento": cada um tem funcao e o olho reconhece a funcao.
    pecas.append(C.cilindro("transformador_al", 0.034, 0.075,
                            (-RAIO_TANQUE * 0.55, RAIO_TANQUE * 0.42,
                             ALT_TANQUE + 0.100), segmentos=10))
    dreno = C.cilindro("transformador_dr", 0.028, 0.090,
                       (RAIO_TANQUE + 0.055, 0, 0.145), segmentos=10,
                       rot=(0, R(90), 0))
    pecas.append(dreno)
    placa = C.caixa("transformador_pl", (0.012, 0.150, 0.110),
                    (RAIO_TANQUE + 0.004, -0.14, ALT_TANQUE * 0.70))
    C.chanfrar(placa, largura=0.004, segmentos=1)
    pecas.append(placa)

    # olhais de icamento, na flange
    for s in (-1, 1):
        olhal = C.caixa(f"transformador_ol{s}", (0.05, 0.10, 0.034),
                        (0.0, s * RAIO_TANQUE * 0.74, ALT_TANQUE + 0.040))
        C.chanfrar(olhal, largura=0.008, segmentos=3)
        pecas.append(olhal)

    return C.juntar(pecas, "transformador")


def suporte_trafo(x_trafo, z_base):
    """Os dois suportes que PRENDEM o trafo no poste.

    Antes eram duas caixas chatas atras do tanque que nao encostavam em nada:
    o transformador aparecia pendurado no ar. Aqui cada suporte e um U que sai
    do tanque, abraca o poste pelos dois lados e e aparafusado — e a peca que
    responde "o que segura isso".
    """
    pecas = []
    for k, dz in enumerate((0.20, 0.70)):
        z = z_base + ALT_TANQUE * dz
        # bracos que vao do tanque ate alem do poste
        for s in (-1, 1):
            b = C.caixa(f"trafo_sup{k}{s}", (x_trafo + 0.32, 0.070, 0.055),
                        ((x_trafo - 0.30) / 2 + 0.16, s * 0.105, z))
            C.chanfrar(b, largura=0.006, segmentos=2)
            pecas.append(b)
        # travessa que fecha o U atras do poste
        tr = C.caixa(f"trafo_tv{k}", (0.055, 0.300, 0.055), (-0.145, 0, z))
        C.chanfrar(tr, largura=0.006, segmentos=2)
        pecas.append(tr)
        for s in (-1, 1):
            pecas.append(C.parafuso(f"trafo_pf{k}{s}", (-0.145, s * 0.105, z),
                                    eixo="Z", raio=0.009, comprimento=0.085))
    return C.juntar(pecas, "trafo_suportes")


def cabo(pontos, raio=0.011, nome="cabo"):
    """Condutor a partir de uma lista de pontos ja calculada."""
    curva = bpy.data.curves.new(nome, "CURVE")
    curva.dimensions = "3D"
    curva.bevel_depth = raio
    # ARMADILHA DE ORCAMENTO: bevel_resolution=4 da um tubo de 12 lados. Num
    # cabo de 22 mm visto a 6 m isso e invisivel e custava 9.792 triangulos —
    # mais que o poste inteiro. Com 1 (tubo de 6 lados) a imagem e a mesma.
    curva.bevel_resolution = 1
    curva.resolution_u = 4
    spline = curva.splines.new("BEZIER")
    spline.bezier_points.add(len(pontos) - 1)
    for bp, p in zip(spline.bezier_points, pontos):
        bp.co = Vector(p)
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(nome, curva)
    bpy.context.collection.objects.link(obj)
    return obj


def vao_condutor(x, z, sentido, flecha=1.15, nome="mt", y0=None):
    """Meio vao: sai do isolador (ponto alto) e afunda ate o meio do vao."""
    if y0 is None:
        y0 = Y_CRUZETA
    pontos = []
    for i in range(7):
        t = i / 6
        y = y0 + sentido * (VAO / 2) * t
        pontos.append((x, y, z - flecha * (t ** 1.6)))
    return cabo(pontos, raio=0.011, nome=nome)


def jumper(p0, p1, queda=0.16, nome="jumper"):
    """Rabicho ligando o condutor a bucha de alta tensao."""
    a, b = Vector(p0), Vector(p1)
    pontos = []
    for i in range(6):
        t = i / 5
        p = a.lerp(b, t)
        p.z -= queda * math.sin(math.pi * t)
        pontos.append(p)
    return cabo(pontos, raio=0.008, nome=nome)


# ------------------------------------------------------------------ cena
def montar():
    C.limpar()
    C.hdri(forca=0.55, rotacao=math.radians(320))
    C.sol(energia=8.0, angulo=(math.radians(45), 0, math.radians(320)), tamanho=0.009)

    # TROCA DE TEXTURA — e aqui que morava metade do "tudo muito chapado".
    #
    # `concrete_wall_008_diff.jpg` tem desvio padrao de 1,5 em 255: nao e uma
    # textura, e uma amostra de cinza. O poste e o objeto que o jogador olha
    # a sequencia inteira e estava pintado com um arquivo sem informacao
    # nenhuma — nenhum ajuste de escala, normal ou rugosidade ia salvar isso.
    # `dirty_concrete` tem desvio 13,1 (9x) e mancha de escorrimento, que e
    # exatamente o que um poste de rua tem.
    m_concreto = C.mat_textura("concreto", "dirty_concrete",
                               escala=(3.0, 3.0, 1.5), rugosidade_extra=0.16,
                               cor_mistura=(0.66, 0.66, 0.65), forca_normal=1.8,
                               saturacao=0.45, brilho=0.88)
    m_madeira = C.mat_textura("madeira", "weathered_planks",
                              escala=(0.9, 2.4, 2.4), forca_normal=0.9,
                              cor_mistura=(0.78, 0.70, 0.60), saturacao=0.6)
    m_aco = C.sujar(C.mat_simples("aco", (0.30, 0.31, 0.33), rugosidade=0.48,
                                  metalico=1.0), escala=9, forca=0.3)
    m_ferrugem = C.mat_textura("ferrugem", "rusty_metal_02", escala=3.0,
                               cor_mistura=(0.42, 0.42, 0.44), saturacao=0.55)
    # aco galvanizado: cinza-azulado fosco. E o acabamento real da ferragem de
    # rede; usar o mapa de ferrugem em tudo deixava o poste inteiro alaranjado.
    m_galva = C.sujar(C.mat_simples("galva", (0.235, 0.245, 0.255),
                                    rugosidade=0.58, metalico=1.0),
                      escala=7, forca=0.22, aspereza=0.20)
    # porta-fusivel: tubo fenolico, quase preto
    m_fenolico = C.sujar(C.mat_simples("fenolico", (0.038, 0.024, 0.016),
                                       rugosidade=0.52), escala=22, forca=0.18)
    m_porcelana = C.sujar(C.mat_simples("porcelana", (0.115, 0.050, 0.022),
                                        rugosidade=0.16), escala=38, forca=0.30,
                          aspereza=0.22)
    # cinza ANSI 70 do tanque. O valor anterior (0,30) rendia BRANCO sob o
    # HDRI e o cliente leu o transformador como aquecedor de agua plastico.
    m_tanque = C.sujar(C.mat_simples("tanque", (0.105, 0.111, 0.107),
                                     rugosidade=0.52, metalico=0.0),
                       escala=3.2, forca=0.35, aspereza=0.26)
    m_cabo = C.estriar(C.mat_simples("cabo", (0.085, 0.088, 0.095),
                                     rugosidade=0.66, metalico=0.8),
                       escala=300, forca=0.45)
    m_asfalto = C.mat_textura("chao", "dirt_floor", escala=0.9,
                              cor_mistura=(0.52, 0.48, 0.42), saturacao=0.7,
                              brilho=0.8, rugosidade_extra=0.1)

    C.aplicar(poste(), m_concreto)
    C.aplicar(cabeca_poste(), m_concreto)
    C.aplicar(degraus(), m_aco)
    C.aplicar(placa_poste(), m_aco)

    # ---- chaves fusivel: a peca que o jogador abre na sequencia da NR-10
    # a mao-de-amigo das chaves e cantoneira GALVANIZADA, nao ferro enferrujado
    C.aplicar(suporte_chaves(), m_galva)
    terminais = []
    mats_chave = {"porcelana": m_porcelana, "fenolico": m_fenolico}
    tubo_movel, pino_tubo = None, None
    for i, dy in enumerate((-0.40, 0.0, 0.40)):
        porc, aco, t_sup, t_inf, tubo, pino = chave_fusivel(
            f"c{i}", (0.30, dy, Z_CHAVES + 0.042), mats_chave,
            separar_tubo=(i == 1))
        C.aplicar(aco, m_aco)
        terminais.append((t_sup, t_inf))
        if tubo is not None:
            tubo_movel, pino_tubo = tubo, pino
            global PINO_TUBO
            PINO_TUBO = pino

    # ---- cruzeta principal, isoladores e ferragem
    cz = C.caixa("cruzeta", CRUZETA, (0, Y_CRUZETA, Z_CRUZETA))
    C.chanfrar(cz, largura=0.007, segmentos=2)
    C.aplicar(cz, m_madeira)

    # AS TRES FASES. A do meio NAO fica no centro da cruzeta: ali ela cai
    # exatamente atras do poste, some da imagem e, pior, e montagem que nao
    # existe — o poste esta no caminho do condutor. A fase central vai no
    # PINO DE TOPO, acima da cabeca do poste, que e o arranjo real de uma
    # cruzeta com tres fases. No render anterior so se viam dois isoladores.
    for i, (x, y, z_fio) in enumerate(FASES):
        p = pino_isolador()
        p.location = (x, y, z_fio - 0.227)
        C.aplicar(p, m_aco)
        iso = isolador_pino()
        iso.location = (x, y, z_fio - 0.112)
        C.aplicar(iso, m_porcelana)
        for dz in (-0.008, 0.010):
            a = C.anel(f"amarra{i}{dz}", raio=0.046, espessura=0.0035,
                       pos=(x, y, z_fio + dz),
                       rot=(math.radians(6), 0, 0))
            # 960 triangulos por amarra de 3,5 mm era a mesma armadilha do
            # SKIN no cabo da via: detalhe que ninguem ve, orcamento que todo
            # mundo paga. Com 1/3 a silhueta e identica.
            a.data.bevel_resolution = 1
            a.data.resolution_u = 3
            C.aplicar(a, m_aco)

    # mao-francesa: do corpo do poste ate a ponta da cruzeta
    for lado in (-1, 1):
        C.aplicar(C.barra(f"mao{lado}",
                          (lado * 0.055, Y_CRUZETA, Z_CRUZETA - 0.62),
                          (lado * 0.62, Y_CRUZETA, Z_CRUZETA - 0.055),
                          secao=(0.05, 0.006)), m_ferrugem)
        C.aplicar(C.barra(f"mao_aba{lado}",
                          (lado * 0.055, Y_CRUZETA + 0.026, Z_CRUZETA - 0.62),
                          (lado * 0.62, Y_CRUZETA + 0.026, Z_CRUZETA - 0.055),
                          secao=(0.006, 0.05)), m_ferrugem)
    for lado in (-1, 1):
        C.aplicar(C.parafuso(f"pf{lado}", (lado * 0.62, Y_CRUZETA, Z_CRUZETA),
                             eixo="Z", comprimento=0.16), m_aco)
    C.aplicar(C.parafuso("pf_centro", (0, Y_CRUZETA, Z_CRUZETA), eixo="Y",
                         comprimento=0.34), m_aco)

    # ---- transformador pendurado nos suportes de aco
    #
    # Saiu a "plataforma" de duas pranchas de madeira: transformador de
    # distribuicao nao fica APOIADO em prancha, fica PENDURADO em dois
    # suportes aparafusados no poste. As pranchas ainda apareciam no render
    # como dois tocos saindo do nada por baixo do tanque.
    C.aplicar(suporte_trafo(X_TRAFO, Z_TRAFO + 0.055), m_galva)

    tr = transformador()
    tr.location = (X_TRAFO, 0.0, Z_TRAFO + 0.055)
    C.aplicar(tr, m_tanque)

    z_tampa = Z_TRAFO + 0.055 + ALT_TANQUE + 0.05
    buchas_at = []
    for dy in (-0.19, 0.0, 0.19):                  # alta tensao
        b = bucha(altura=0.34, raio=0.052, saias=5)
        b.location = (X_TRAFO - 0.15, dy, z_tampa)
        C.aplicar(b, m_porcelana)
        buchas_at.append((X_TRAFO - 0.15, dy, z_tampa + 0.34))
    for i in range(4):                              # baixa tensao
        b = bucha(altura=0.16, raio=0.033, saias=2)
        b.location = (X_TRAFO + 0.17, -0.21 + i * 0.14, z_tampa)
        C.aplicar(b, m_porcelana)

    # ---- condutores de media tensao e rabichos
    for i, (x, y, z_fio) in enumerate(FASES):
        for sentido in (-1, 1):
            C.aplicar(vao_condutor(x, z_fio, sentido, y0=y,
                                   nome=f"mt{i}{sentido}"), m_cabo)

    # O rabicho NAO vai mais direto do condutor para a bucha: ele passa pela
    # chave fusivel, que e o que a chave existe para fazer. Ligar por cima
    # dela deixaria a chave como enfeite — e um eletricista da Energisa
    # enxerga isso na primeira olhada.
    for i, (x, y, z_fio) in enumerate(FASES):
        t_sup, t_inf = terminais[i]
        C.aplicar(jumper((x, y, z_fio), t_sup,
                         queda=0.22, nome=f"jumper_alta{i}"), m_cabo)
        C.aplicar(jumper(t_inf, buchas_at[i], queda=0.10,
                         nome=f"jumper_trafo{i}"), m_cabo)

    # ---- cabo de aterramento descendo pelo poste
    C.aplicar(cabo([(-0.062, -0.02, Z_TRAFO), (-0.062, -0.02, Z_TRAFO * 0.6),
                    (-0.062, -0.02, 1.2), (-0.062, -0.02, 0.0)],
                   raio=0.007, nome="terra"), m_aco)

    chao = C.caixa("chao", (120, 120, 0.2), (0, 0, -0.1))
    C.aplicar(chao, m_asfalto)


def renderizar():
    montar()
    C.camera((6.6, -6.0, 5.2), (0.0, 0.0, 5.8), lente=40, nome="cam_geral")
    C.render("poste_geral", largura=1000, altura=1500, amostras=180, exposicao=-0.2)

    C.camera((2.3, -2.6, 7.35), (0.30, 0.0, 7.05), lente=55, nome="cam_detalhe")
    C.render("poste_detalhe", largura=1400, altura=1050, amostras=200, exposicao=-0.2)

    C.camera((2.0, -2.4, 9.6), (0.0, 0.05, 9.15), lente=62, nome="cam_topo")
    C.render("poste_topo", largura=1400, altura=1050, amostras=200, exposicao=-0.2)


if __name__ == "__main__":
    renderizar()
