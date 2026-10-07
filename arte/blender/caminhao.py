"""
Caminhao com cesto aereo — o veiculo da fase 3.

MEDIDAS, da especificacao de frota da propria Energisa (classe de cesto 10 a
13 m, a de servico em poste de distribuicao): entre-eixos 3.300 a 4.400 mm,
chassi Ford Cargo 816 / VW Delivery 9.170 / Mercedes Accelo. CABINE AVANCADA
(sobre o motor), nunca capo longo.

Daqui sai o conjunto abaixo: 6,80 m de comprimento, 2,20 m de largura, 3,60 m
de entre-eixos, roda de 880 mm, balanco dianteiro 1,10 m e traseiro 2,10 m —
que e a proporcao que faz o olho ler "caminhao leve de servico".

EIXOS: X e o COMPRIMENTO e a frente fica em -X; Y e a largura; Z e a altura.
Diferente de veiculo.py, onde o veiculo aponta para -Y — conferir sempre
antes de copiar codigo de um para o outro.

OS TRES DEFEITOS DA VERSAO ANTERIOR, e o que mudou aqui:

1. "Roda com chapa de metal esquisita". Eram duas coisas somadas: o eixo ia
   de y=-1,04 a +1,04 e ATRAVESSAVA a roda, reaparecendo do outro lado como
   barra; e o aro era um cilindro liso de raio 0,285 encostado no pneu, que
   le como tampa colada. Agora o eixo termina DENTRO do cubo (`_meia_bitola`
   calcula ate onde ele pode ir) e o aro e um disco de revolucao REBAIXADO
   9 cm, com cubo e seis porcas.

2. "Vidro fora do lugar". O para-brisa tinha 0,86 m num vao de 0,78 m e as
   janelas ficavam metade para fora da casca. Agora todo vidro nasce de
   `vidro_no_vao`: o MESMO retangulo gera a faca do booleano (folgada) e o
   vidro (exato, recuado). Por construcao o vidro nao transborda.

3. "Nao faz muito sentido como veiculo". A carroceria virou o que realmente
   e um caminhao de cesto: dois armarios laterais com o ESTRADO REBAIXADO
   entre eles, a torre da lanca plantada nesse estrado logo atras da cabine,
   a lanca deitada por cima apoiada no berco traseiro e o cesto no fim dela.

ARMADILHA PAGA: `C.chanfrar` so EMPILHA o modificador, e `bpy.ops.object.join`
DESCARTA o modificador de todo objeto que nao e o ativo. No caminhao antigo,
de cada grupo so um chanfro sobrevivia e o resto das quinas chegava viva no
jogo. Aqui se usa `chanfrar`, que APLICA na hora.
"""
import math, bmesh, bpy
from mathutils import Vector, Euler

import comum as C

# ------------------------------------------------------------------ medidas
COMPRIMENTO = 6.80
LARGURA = 2.20
MEIA_L = LARGURA / 2
ENTRE_EIXOS = 3.60
EIXO_D = -2.50                 # eixo dianteiro, em X
EIXO_T = EIXO_D + ENTRE_EIXOS  # eixo traseiro, +1.10
RODA_R = 0.44                  # raio, 880 mm de diametro
RODA_L = 0.25                  # largura do pneu
CHASSI_Z = 0.90                # topo da longarina
CHASSI_Y = 0.42                # afastamento da longarina

CAB_FRENTE = -3.60
CAB_FUNDO = -1.52
CAB_TETO = 2.58
CAB_MEIA = 1.10                # meia largura da cabine, igual a carroceria

CAR_X0 = CAB_FUNDO + 0.10      # inicio da carroceria
CAR_X1 = 3.20                  # traseira
CAR_TOPO = 1.84                # topo dos armarios
CAR_PISO = 0.96                # estrado rebaixado entre os armarios
CAR_MEIO = 0.56                # ate onde o armario avanca para dentro

# A faixa verde da marca corre na MESMA altura na cabine e na carroceria. Na
# primeira versao ela ia a 1,00 na cabine e a 1,73 na carroceria: de longe
# pareciam dois veiculos diferentes emendados.
FAIXA_Z = 1.02
FAIXA_H = 0.18
REFL_Z = 1.17

BITOLA_D = 0.86                # centro da roda dianteira
BITOLA_T = 0.68                # centro da roda traseira interna
FOLGA_GEMEA = 0.04             # vao entre as duas rodas do par traseiro

# A COR DA MARCA entra por aqui, num lugar so. O verde oficial nao esta
# confirmado contra o manual de marca da Energisa — conferir antes de
# entregar. Enquanto isso, um verde de distribuidora plausivel.
VERDE_MARCA = (0.016, 0.300, 0.118)


# ------------------------------------------------------------------ ferramentas

def chanfrar(obj, largura=0.014, segmentos=2, angulo=42):
    """Chanfro APLICADO na hora, nao empilhado.

    Ver a armadilha no cabecalho: `join` descarta modificador de quem nao e o
    objeto ativo, entao chanfro que fica pendente some na montagem.
    """
    C.chanfrar(obj, largura, segmentos, angulo)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier="chanfro")
    obj.select_set(False)
    return obj


def cortar(alvo, faca, apagar_faca=True):
    """Booleano de diferenca: `alvo` menos `faca`.

    E o que abre caixa de roda e vao de vidro. Sem booleano a unica saida e
    montar o entorno com varias caixas — e e exatamente dai que vem a leitura
    de Lego que o cliente reprovou.
    """
    mod = alvo.modifiers.new(name="corte", type="BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = faca
    mod.solver = "EXACT"
    bpy.context.view_layer.objects.active = alvo
    bpy.ops.object.modifier_apply(modifier=mod.name)
    if apagar_faca:
        bpy.data.objects.remove(faca, do_unlink=True)
    return alvo


def perfil_lateral(nome, perfil_xz, y0, y1, suave=True):
    """Extruda um perfil fechado do plano XZ ao longo de Y.

    O perfil e a SILHUETA LATERAL do veiculo e a extrusao e a largura dele.
    Caixa nenhuma produz capo baixo, para-brisa inclinado e teto quebrado.
    Pontos em sentido anti-horario vistos de +Y.
    """
    bm = bmesh.new()
    a = [bm.verts.new((x, y0, z)) for x, z in perfil_xz]
    b = [bm.verts.new((x, y1, z)) for x, z in perfil_xz]
    n = len(a)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = C.obj_de_bmesh(bm, nome)
    if suave:
        C.suavizar(obj, 40)
    return obj


def arredondar(perfil, raio=0.06, passos=3):
    """Arredonda os cantos de um perfil 2D antes de extrudar.

    Chanfrar depois da extrusao arredonda as arestas da LARGURA; o que da a
    curva do teto e do capo e arredondar o PERFIL, antes.
    """
    n = len(perfil)
    saida = []
    for i in range(n):
        p = Vector(perfil[i])
        a = Vector(perfil[(i - 1) % n])
        b = Vector(perfil[(i + 1) % n])
        da, db = (a - p), (b - p)
        if da.length < 1e-6 or db.length < 1e-6:
            saida.append(tuple(p))
            continue
        r = min(raio, da.length / 2.2, db.length / 2.2)
        pa, pb = p + da.normalized() * r, p + db.normalized() * r
        for k in range(passos + 1):
            t = k / passos
            # Bezier quadratica: o canto vira arco em vez de bisel
            q = (1 - t) ** 2 * pa + 2 * (1 - t) * t * p + t ** 2 * pb
            saida.append((q.x, q.y))
    return saida


def vidro_no_vao(casco, nome, centro, plano, eixo="X", incl=0.0, dentro=1,
                 folga=0.020, recuo=0.055, esp=0.020, pocao=0.46):
    """Abre o vao na lataria e devolve o vidro que o preenche.

    O MESMO retangulo `plano` (largura x altura do vao) gera as duas pecas: a
    faca do booleano e esse retangulo FOLGADO, o vidro e o retangulo EXATO
    recuado para dentro. Por construcao o vidro e menor que o buraco — era
    disso que vinha o "vidro fora do lugar" (0,86 m de para-brisa num vao de
    0,78 m, e janela lateral com metade da espessura para fora da casca).

    `centro` fica SOBRE a pele externa; a faca avanca `pocao`/2 para dentro e
    deixa um bolso escuro atras do vidro, que e o que le como interior de
    cabine. `eixo` e a direcao da ESPESSURA, `dentro` o sentido que aponta
    para dentro da cabine.
    """
    rot = (0.0, math.radians(incl), 0.0) if incl else None
    a, b = plano
    if eixo == "X":
        t_faca = (pocao, a + 2 * folga, b + 2 * folga)
        t_vidro = (esp, a, b)
        desloc = Vector((dentro * recuo, 0.0, 0.0))
    else:
        t_faca = (a + 2 * folga, pocao, b + 2 * folga)
        t_vidro = (a, esp, b)
        desloc = Vector((0.0, dentro * recuo, 0.0))
    if rot:
        desloc.rotate(Euler(rot))
    faca = C.caixa(f"{nome}_faca", t_faca, centro, rot=rot)
    cortar(casco, faca)
    return C.caixa(nome, t_vidro, tuple(Vector(centro) + desloc), rot=rot)


def painel_recuado(casco, nome, centro, plano, eixo="Y", lado=1,
                   fundo=0.016, fresta=0.012, esp=0.014):
    """Abre um rebaixo raso e devolve o painel que o ocupa, com fresta.

    E a fresta — e a sombra que cai nela — que da ESCALA ao veiculo. Painel
    desenhado por aresta na textura nao produz sombra nenhuma e le como
    adesivo.
    """
    a, b = plano
    if eixo == "Y":
        t_faca = (a, 0.10, b)
        c_faca = (centro[0], centro[1] + lado * (0.05 - fundo), centro[2])
        t_pan = (a - 2 * fresta, esp, b - 2 * fresta)
        c_pan = (centro[0], centro[1] + lado * (esp / 2 - fundo), centro[2])
    else:
        t_faca = (0.10, a, b)
        c_faca = (centro[0] + lado * (0.05 - fundo), centro[1], centro[2])
        t_pan = (esp, a - 2 * fresta, b - 2 * fresta)
        c_pan = (centro[0] + lado * (esp / 2 - fundo), centro[1], centro[2])
    cortar(casco, C.caixa(f"{nome}_faca", t_faca, c_faca))
    return chanfrar(C.caixa(nome, t_pan, c_pan), largura=0.006, segmentos=2)


def revolucao_y(pontos, nome, centro, segmentos=20, suave=True):
    """Solido de revolucao com o eixo em Y (eixo da roda).

    `C.perfil_revolucao` gira em torno de Z; girar o OBJETO depois exigiria
    `transform_apply` por ops. Aqui gira-se a MALHA, que e mais barato e nao
    deixa rotacao pendente para o `join` atrapalhar.
    """
    obj = C.perfil_revolucao(pontos, nome, segmentos=segmentos, suave=suave)
    giro = Euler((math.radians(90), 0, 0))
    for v in obj.data.vertices:
        v.co.rotate(giro)
        v.co += Vector(centro)
    return obj


def caixa_aberta(nome, tamanho, centro, parede=0.05, destino=None):
    """Caixote sem tampa: piso e quatro paredes. Serve de cesto e de gaveta."""
    cx, cy, cz = centro
    sx, sy, sz = tamanho
    pecas = [C.caixa(f"{nome}_piso", (sx, sy, parede),
                     (cx, cy, cz - sz / 2 + parede / 2))]
    for dx, dy, a, b in ((sx / 2 - parede / 2, 0, parede, sy),
                         (-sx / 2 + parede / 2, 0, parede, sy),
                         (0, sy / 2 - parede / 2, sx - 2 * parede, parede),
                         (0, -sy / 2 + parede / 2, sx - 2 * parede, parede)):
        pecas.append(C.caixa(f"{nome}_p{dx:.2f}_{dy:.2f}", (a, b, sz - parede),
                             (cx + dx, cy + dy, cz + parede / 2)))
    if destino is not None:
        destino.extend(pecas)
    return pecas


# ------------------------------------------------------------------ materiais

def materiais():
    """Materiais do caminhao — TODOS por `mat_simples`, sem `sujar`.

    ARMADILHA, e ela e cara: `C.sujar` monta ruido PROCEDURAL na cor base e na
    rugosidade. Procedural nao exporta para glTF, e ao nao exportar LEVA A COR
    BASE JUNTO: o material chega no jogo branco e com rugosidade 1,0. Ja
    colapsou sete materiais deste caminhao num branco so.

    `sujar` so vale em peca que passa pelo FORNO (`exportar.assar_grupo`), que
    e onde o procedural vira pixel. Este caminhao NAO vai ao forno de
    proposito: assar fundiria os materiais num unico, trocando cromo metalico
    e vidro escuro por plastico — exatamente o que estamos saindo.
    """
    m = {}
    m["pintura"] = C.mat_simples("cam_pintura", (0.62, 0.63, 0.635),
                                 rugosidade=0.28)
    m["verde"] = C.mat_simples("cam_verde", VERDE_MARCA, rugosidade=0.30)
    m["vidro"] = C.mat_simples("cam_vidro", (0.028, 0.034, 0.042),
                               rugosidade=0.06, ior=1.45)
    m["borracha"] = C.mat_simples("cam_borracha", (0.022, 0.023, 0.025),
                                  rugosidade=0.88)
    m["aro"] = C.mat_simples("cam_aro", (0.44, 0.45, 0.46), rugosidade=0.30,
                             metalico=1.0)
    m["cromo"] = C.mat_simples("cam_cromo", (0.58, 0.59, 0.61), rugosidade=0.14,
                               metalico=1.0)
    m["aco"] = C.mat_simples("cam_aco", (0.135, 0.138, 0.145), rugosidade=0.48)
    m["chassi"] = C.mat_simples("cam_chassi", (0.048, 0.049, 0.053),
                                rugosidade=0.68)
    m["farol"] = C.mat_simples("cam_farol", (0.80, 0.82, 0.86),
                              rugosidade=0.045, metalico=1.0)
    m["lanterna"] = C.mat_simples("cam_lanterna", (0.52, 0.038, 0.026),
                                  rugosidade=0.16)
    m["pisca"] = C.mat_simples("cam_pisca", (0.60, 0.26, 0.018), rugosidade=0.16)
    m["refletivo"] = C.mat_simples("cam_refletivo", (0.72, 0.73, 0.74),
                                   rugosidade=0.28)
    m["giroflex"] = C.mat_simples("cam_giroflex", (0.64, 0.30, 0.018),
                                  rugosidade=0.12)
    # a lanca e ISOLADA: fibra bege, nunca metal. Trocar por cinza metalico
    # erraria o item tecnico que a fase inteira ensina.
    m["fibra"] = C.mat_simples("cam_fibra", (0.44, 0.41, 0.31), rugosidade=0.38)
    m["cesto"] = C.mat_simples("cam_cesto", (0.60, 0.59, 0.54), rugosidade=0.44)
    return m


# ------------------------------------------------------------------ roda

# meia largura do pneu, usada tambem para saber ate onde o eixo pode ir
MEIO_PNEU = RODA_L / 2

PERFIL_PNEU = [
    (0.252, -MEIO_PNEU * 0.90),
    (0.300, -MEIO_PNEU * 0.99),
    (0.356, -MEIO_PNEU * 1.00),   # flanco estufado
    (0.404, -MEIO_PNEU * 0.90),
    (0.430, -MEIO_PNEU * 0.66),   # ombro
    (0.440, -MEIO_PNEU * 0.40),
    (0.440,  MEIO_PNEU * 0.40),
    (0.430,  MEIO_PNEU * 0.66),
    (0.404,  MEIO_PNEU * 0.90),
    (0.356,  MEIO_PNEU * 1.00),
    (0.300,  MEIO_PNEU * 0.99),
    (0.252,  MEIO_PNEU * 0.90),
    (0.252, -MEIO_PNEU * 0.90),   # fecha o perfil: o pneu e um TUBO, com
]                                 # furo no meio — nao um disco macico

# aro: comeca e termina no eixo, como `perfil_revolucao` exige. A face
# externa e REBAIXADA 9 cm em relacao a aba — e esse poco, e nao um cilindro
# liso, que faz o olho ler roda de caminhao em vez de tampa de metal colada.
PERFIL_ARO = [
    (0.000,  0.030),
    (0.072,  0.034),
    (0.128,  0.018),              # bacia do rebaixo
    (0.205,  0.030),
    (0.236,  0.092),              # parede do poco sobe ate a aba
    (0.258,  0.104),              # aba externa, por dentro do talao
    (0.258, -0.104),              # aba interna
    (0.230, -0.110),
    (0.110, -0.086),
    (0.000, -0.078),
]


def roda(nome, centro, externa=True):
    """Roda de verdade: pneu tubular, aro rebaixado, cubo e porcas.

    O defeito reclamado ("chapa de metal esquisita") era o aro-cilindro liso
    somado ao eixo que furava a roda e saia do outro lado. Aqui o pneu tem
    furo no meio, o aro e um disco de revolucao com poco, e o eixo (ver
    `chassi`) termina dentro do cubo.

    `externa` liga cubo e porcas: na roda GEMEA de dentro nada disso aparece,
    e desenhar seria triangulo jogado fora.
    """
    pecas = {"borracha": [], "aro": [], "cromo": []}
    pecas["borracha"].append(
        revolucao_y(PERFIL_PNEU, f"{nome}_pneu", centro, segmentos=24))
    pecas["aro"].append(
        revolucao_y(PERFIL_ARO, f"{nome}_aro", centro, segmentos=24))
    if not externa:
        return pecas

    lado = 1 if centro[1] > 0 else -1
    face = centro[1] + lado * 0.040     # a face do cubo fica no poco do aro
    pecas["cromo"].append(C.cilindro(
        f"{nome}_cubo", 0.072, 0.052, (centro[0], face, centro[2]),
        segmentos=14, rot=(math.radians(90), 0, 0)))
    for i in range(6):
        a = i * math.pi / 3
        pecas["cromo"].append(C.cilindro(
            f"{nome}_porca_{i}", 0.019, 0.030,
            (centro[0] + math.cos(a) * 0.112, face,
             centro[2] + math.sin(a) * 0.112),
            segmentos=6, rot=(math.radians(90), 0, 0)))
    return pecas


def _meia_bitola(centro_roda):
    """Ate onde o eixo pode ir sem furar a roda.

    E a conta que faltava na versao antiga: o eixo ia a y=1,04 com a roda
    centrada em 0,94, ou seja atravessava o pneu inteiro e reaparecia do
    outro lado como uma barra solta no ar.
    """
    return abs(centro_roda) - MEIO_PNEU - 0.015


# ------------------------------------------------------------------ cabine

def cabine(m):
    """Cabine AVANCADA (sobre o motor), que e o padrao dessa classe no Brasil.

    Ford Cargo, VW Delivery e Mercedes Accelo nao tem capo longo: a frente e
    quase vertical, a grade e baixa e o para-brisa comeca logo acima dela.
    """
    pecas = {"pintura": [], "vidro": [], "cromo": [], "aco": [], "farol": [],
             "pisca": [], "verde": [], "refletivo": [], "lanterna": []}

    # Silhueta QUADRADA. A primeira tentativa usava raio 0,050 com chanfro de
    # 30 mm e saiu uma bolha com cara de van de camping: cabine avancada
    # brasileira e uma CAIXA, com teto reto, traseira vertical e so a quina
    # quebrada. O arredondamento aqui e o minimo que tira a quina viva.
    perfil = arredondar([
        (CAB_FRENTE + 0.08, 0.72),       # queixo, escondido no para-choque
        (CAB_FRENTE + 0.00, 0.96),
        (CAB_FRENTE + 0.00, 1.62),       # frente RETA de 0,96 a 1,62
        (CAB_FRENTE + 0.09, 1.74),       # base do para-brisa
        (CAB_FRENTE + 0.28, 2.48),       # para-brisa, ~14 graus
        (CAB_FRENTE + 0.44, CAB_TETO),   # quina do teto, curta
        (CAB_FUNDO - 0.02, CAB_TETO),    # teto RETO ate o fundo
        (CAB_FUNDO, 2.46),
        (CAB_FUNDO, CHASSI_Z - 0.02),
        # A SAIA DA CABINE E RETA, na altura do chassi, do fundo ate o bico.
        # Nas versoes anteriores ela mergulhava de 0,86 para 0,38 na frente:
        # um nariz caido, sem quebra nenhuma, que lia como van de camping e
        # ainda engolia a caixa de roda dianteira.
        (CAB_FRENTE + 0.26, CHASSI_Z - 0.04),
    ], raio=0.030, passos=2)

    casco = perfil_lateral("cam_cabine", perfil, -CAB_MEIA, CAB_MEIA)
    chanfrar(casco, largura=0.016, segmentos=3, angulo=48)

    # caixa de roda dianteira, aberta por booleano
    cortar(casco, C.cilindro("cam_faca_rd", RODA_R + 0.17, LARGURA + 0.4,
                             (EIXO_D, 0, RODA_R + 0.02), segmentos=30,
                             rot=(math.radians(90), 0, 0)))

    for lado in (-1, 1):
        # porta: rebaixo raso na lataria, SO na metade de baixo. O vao do
        # vidro fica acima e e aberto na propria casca, para nao precisar
        # furar o painel da porta tambem.
        pecas["pintura"].append(painel_recuado(
            casco, f"cam_porta_{lado}",
            (CAB_FRENTE + 1.30, lado * CAB_MEIA, 1.50),
            (1.02, 0.48), lado=lado))
        pecas["cromo"].append(C.caixa(
            f"cam_macaneta_{lado}", (0.17, 0.034, 0.046),
            (CAB_FRENTE + 1.66, lado * (CAB_MEIA + 0.012), 1.62)))

        # Janela da porta MAIS O OCULO dianteiro, separados por uma coluna de
        # 7 cm. Um retangulo escuro unico de quase um metro lia como vidro de
        # onibus; cabine avancada tem o oculo fixo na frente da porta.
        pecas["vidro"].append(vidro_no_vao(
            casco, f"cam_janela_{lado}",
            (CAB_FRENTE + 1.30, lado * CAB_MEIA, 2.12),
            (0.86, 0.56), eixo="Y", dentro=-lado))
        pecas["vidro"].append(vidro_no_vao(
            casco, f"cam_oculo_{lado}",
            (CAB_FRENTE + 0.65, lado * CAB_MEIA, 2.12),
            (0.30, 0.56), eixo="Y", dentro=-lado))

    # para-brisa: o vao acompanha a inclinacao da face, 15 graus
    pecas["vidro"].append(vidro_no_vao(
        casco, "cam_parabrisa", (CAB_FRENTE + 0.185, 0, 2.11),
        (1.82, 0.64), eixo="X", incl=14.4, dentro=1))

    pecas["pintura"].append(casco)

    # faixa verde da marca, na mesma altura da faixa da carroceria
    for lado in (-1, 1):
        pecas["verde"].append(C.caixa(
            f"cam_faixa_cab_{lado}", (1.52, 0.022, FAIXA_H),
            (CAB_FRENTE + 1.32, lado * (CAB_MEIA + 0.008), FAIXA_Z)))
        pecas["refletivo"].append(C.caixa(
            f"cam_refl_cab2_{lado}", (1.46, 0.020, 0.055),
            (CAB_FRENTE + 1.32, lado * (CAB_MEIA + 0.008), REFL_Z)))

    # grade e para-choque
    pecas["aco"].append(C.caixa("cam_grade", (0.08, LARGURA - 0.44, 0.26),
                                (CAB_FRENTE + 0.035, 0, 1.54)))
    for i, dz in enumerate((-0.085, 0.0, 0.085)):
        pecas["cromo"].append(C.caixa(
            f"cam_friso_{i}", (0.05, LARGURA - 0.50, 0.038),
            (CAB_FRENTE + 0.005, 0, 1.54 + dz)))

    pecas["aco"].append(chanfrar(C.caixa(
        "cam_pc_diant", (0.22, LARGURA, 0.34), (CAB_FRENTE - 0.07, 0, 0.64)),
        largura=0.035, segmentos=3))
    pecas["cromo"].append(C.caixa(
        "cam_degrau_pc", (0.20, 0.52, 0.03), (CAB_FRENTE - 0.07, 0, 0.47)))
    pecas["refletivo"].append(C.caixa(
        "cam_placa", (0.02, 0.40, 0.13), (CAB_FRENTE - 0.19, 0, 0.70)))

    for lado in (-1, 1):
        # farol REBAIXADO na lataria: chapa branca encostada na frente le
        # como adesivo. O vao em volta e que cria a sombra do aro do farol.
        pecas["farol"].append(painel_recuado(
            casco, f"cam_farol_{lado}",
            (CAB_FRENTE + 0.005, lado * 0.69, 1.16), (0.46, 0.26),
            eixo="X", lado=-1, fundo=0.050, fresta=0.030, esp=0.035))
        pecas["pisca"].append(C.caixa(
            f"cam_pisca_{lado}", (0.07, 0.17, 0.11),
            (CAB_FRENTE + 0.030, lado * 0.99, 1.16)))

        # retrovisor: o braco NASCE na lataria e vai ate o espelho; solto no
        # ar ele le como um risco flutuando
        # retrovisor: dois bracos CURTOS nascendo na lataria e uma coluna
        # ligando os dois. Braco unico e comprido virava uma bandeira cinza
        # boiando ao lado da cabine.
        for dz in (2.28, 1.84):
            pecas["aco"].append(C.cilindro(
                f"cam_retro_br_{lado}_{dz:.2f}", 0.020, 0.21,
                (CAB_FRENTE + 0.44, lado * (CAB_MEIA + 0.09), dz),
                segmentos=8, rot=(math.radians(90), 0, 0)))
        pecas["aco"].append(C.cilindro(
            f"cam_retro_pe_{lado}", 0.018, 0.48,
            (CAB_FRENTE + 0.44, lado * (CAB_MEIA + 0.17), 2.06), segmentos=8))
        pecas["aco"].append(chanfrar(C.caixa(
            f"cam_retro_{lado}", (0.050, 0.11, 0.32),
            (CAB_FRENTE + 0.44, lado * (CAB_MEIA + 0.20), 2.08)),
            largura=0.015))

        # estribo de acesso, embaixo da porta, pendurado no chassi
        pecas["aco"].append(C.caixa(
            f"cam_estribo_{lado}", (0.34, 0.17, 0.05),
            (CAB_FRENTE + 1.82, lado * (CAB_MEIA - 0.05), 0.54)))
        pecas["aco"].append(C.caixa(
            f"cam_estribo_sup_{lado}", (0.32, 0.02, 0.28),
            (CAB_FRENTE + 1.82, lado * (CAB_MEIA - 0.12), 0.68)))

    return pecas


# ------------------------------------------------------------------ carroceria

def carroceria(m):
    """Carroceria de servico: dois armarios e o ESTRADO REBAIXADO no meio.

    E essa forma em U que faz o conjunto fazer sentido: a torre da lanca se
    planta no estrado, entre os armarios, e a lanca deitada passa por cima
    deles ate o berco traseiro. Uma caixa fechada unica (a versao antiga) nao
    tem onde plantar a torre e por isso a lanca parecia colada no telhado.
    """
    pecas = {"pintura": [], "aco": [], "verde": [], "refletivo": [],
             "cromo": [], "lanterna": []}

    # estrado rebaixado, de chapa xadrez
    pecas["aco"].append(C.caixa(
        "cam_estrado", (CAR_X1 - CAR_X0, CAR_MEIO * 2, 0.07),
        ((CAR_X0 + CAR_X1) / 2, 0, CAR_PISO - 0.035)))

    gavetas = [(1.02, -1.52), (1.02, -0.36), (1.30, 1.22)]
    for lado in (-1, 1):
        armario = chanfrar(C.caixa(
            f"cam_armario_{lado}",
            (CAR_X1 - CAR_X0, MEIA_L - CAR_MEIO, CAR_TOPO - CHASSI_Z + 0.02),
            ((CAR_X0 + CAR_X1) / 2, lado * (MEIA_L + CAR_MEIO) / 2,
             (CHASSI_Z + CAR_TOPO) / 2 - 0.01)),
            largura=0.022, segmentos=3)
        # caixa de roda traseira: eixo duplo, recorte mais largo
        cortar(armario, C.cilindro(
            f"cam_faca_rt_{lado}", RODA_R + 0.13, LARGURA + 0.4,
            (EIXO_T, 0, RODA_R + 0.04), segmentos=26,
            rot=(math.radians(90), 0, 0)))

        for i, (comp, cx) in enumerate(gavetas):
            px = (CAR_X0 + CAR_X1) / 2 + cx
            # gaveta na COR DA LATARIA, nao em cinza escuro: pintada de
            # escuro ela le como JANELA, e o caminhao virava um onibus
            pecas["pintura"].append(painel_recuado(
                armario, f"cam_gaveta_{lado}_{i}",
                (px, lado * MEIA_L, CHASSI_Z + 0.62), (comp, 0.46),
                lado=lado, fresta=0.016))
            pecas["cromo"].append(C.caixa(
                f"cam_puxador_{lado}_{i}", (0.18, 0.030, 0.034),
                (px, lado * (MEIA_L + 0.012), CHASSI_Z + 0.44)))

        pecas["pintura"].append(armario)

        pecas["verde"].append(C.caixa(
            f"cam_faixa_car_{lado}", (CAR_X1 - CAR_X0 - 0.04, 0.022, FAIXA_H),
            ((CAR_X0 + CAR_X1) / 2, lado * (MEIA_L + 0.008), FAIXA_Z)))
        pecas["refletivo"].append(C.caixa(
            f"cam_refl_car_{lado}", (CAR_X1 - CAR_X0 - 0.04, 0.020, 0.055),
            ((CAR_X0 + CAR_X1) / 2, lado * (MEIA_L + 0.008), REFL_Z)))

        # para-lama sobre a roda dupla: sem ele o recorte fica mostrando que
        # o armario e so uma caixa furada
        pecas["pintura"].append(chanfrar(C.caixa(
            f"cam_paralama_{lado}", (RODA_R * 2 + 0.34, 0.08, 0.10),
            (EIXO_T, lado * (MEIA_L + 0.03), RODA_R + 0.50)), largura=0.012))

        pecas["lanterna"].append(C.caixa(
            f"cam_lant_{lado}", (0.06, 0.19, 0.30),
            (CAR_X1 + 0.09, lado * 0.76, CHASSI_Z - 0.12)))

        # corrimao do estrado, onde o eletricista se segura para subir
        pecas["cromo"].append(C.cilindro(
            f"cam_corrimao_{lado}", 0.020, 2.40,
            (-0.10, lado * (CAR_MEIO - 0.03), CAR_TOPO + 0.30),
            segmentos=8, rot=(0, math.radians(90), 0)))
        for px in (-1.24, 1.04):
            pecas["cromo"].append(C.cilindro(
                f"cam_corr_pe_{lado}_{px:.1f}", 0.018, CAR_TOPO + 0.30 - CAR_PISO,
                (px, lado * (CAR_MEIO - 0.03),
                 (CAR_PISO + CAR_TOPO + 0.30) / 2), segmentos=8))

    # parede frontal do estrado, encostando na cabine
    pecas["pintura"].append(C.caixa(
        "cam_frontal", (0.09, CAR_MEIO * 2, CAR_TOPO - CAR_PISO + 0.30),
        (CAR_X0 + 0.045, 0, (CAR_PISO + CAR_TOPO + 0.30) / 2)))

    # para-choque traseiro e degrau
    pecas["aco"].append(chanfrar(C.caixa(
        "cam_pc_tras", (0.17, LARGURA - 0.10, 0.24), (CAR_X1 + 0.14, 0, 0.56)),
        largura=0.025, segmentos=2))
    pecas["aco"].append(C.caixa(
        "cam_degrau_tras", (0.22, 0.60, 0.04), (CAR_X1 + 0.10, 0, 0.43)))
    return pecas


def chassi(m):
    """Longarinas, eixos e tanque a mostra entre as rodas.

    Caminhao tem VAO por baixo, e e esse vao que o separa de um bloco.
    Fechar com uma saia lisa foi o erro da caminhonete antiga.
    """
    pecas = {"chassi": [], "cromo": []}
    x0, x1 = CAB_FRENTE + 0.18, CAR_X1 + 0.10
    for lado in (-1, 1):
        # longarina em U: alma vertical mais as duas abas
        pecas["chassi"].append(C.caixa(
            f"cam_long_{lado}", (x1 - x0, 0.015, 0.24),
            ((x0 + x1) / 2, lado * CHASSI_Y, CHASSI_Z - 0.14)))
        for dz in (-0.255, -0.025):
            pecas["chassi"].append(C.caixa(
                f"cam_aba_{lado}_{dz:.2f}", (x1 - x0, 0.075, 0.014),
                ((x0 + x1) / 2, lado * (CHASSI_Y - 0.030), CHASSI_Z + dz)))
    for i, x in enumerate((CAB_FRENTE + 0.40, EIXO_D, -0.60, EIXO_T, CAR_X1)):
        pecas["chassi"].append(C.caixa(
            f"cam_trav_{i}", (0.09, CHASSI_Y * 2, 0.18),
            (x, 0, CHASSI_Z - 0.14)))

    # EIXOS: param DENTRO do cubo da roda. Ver `_meia_bitola` — era aqui que
    # nascia a "chapa de metal esquisita".
    for nome, x, bit, r in (("d", EIXO_D, BITOLA_D, 0.055),
                            ("t", EIXO_T, BITOLA_T, 0.085)):
        pecas["chassi"].append(C.cilindro(
            f"cam_eixo_{nome}", r, _meia_bitola(bit) * 2, (x, 0, RODA_R),
            segmentos=14, rot=(math.radians(90), 0, 0)))
        for lado in (-1, 1):
            pecas["chassi"].append(C.cilindro(
                f"cam_cubo_{nome}_{lado}", 0.145, 0.16,
                (x, lado * (_meia_bitola(bit) - 0.02), RODA_R), segmentos=14,
                rot=(math.radians(90), 0, 0)))
            # feixe de molas ligando o eixo a longarina
            pecas["chassi"].append(C.caixa(
                f"cam_mola_{nome}_{lado}", (1.05, 0.08, 0.05),
                (x, lado * CHASSI_Y, RODA_R + 0.14)))
    # diferencial do eixo traseiro
    pecas["chassi"].append(C.perfil_revolucao(
        [(0.0, -0.20), (0.17, -0.10), (0.21, 0.0), (0.17, 0.12),
         (0.0, 0.20)], "cam_diferencial", segmentos=14))
    bpy.data.objects["cam_diferencial"].location = (EIXO_T, 0, RODA_R)

    pecas["chassi"].append(C.cilindro(
        "cam_tanque", 0.25, 0.80, (-0.80, -(CHASSI_Y + 0.28), 0.62),
        segmentos=18, rot=(0, math.radians(90), 0)))
    pecas["chassi"].append(C.caixa(
        "cam_bateria", (0.52, 0.34, 0.30), (-0.80, CHASSI_Y + 0.28, 0.62)))
    pecas["cromo"].append(C.cilindro(
        "cam_escape", 0.055, 1.10, (0.40, -(CHASSI_Y + 0.10), 0.46),
        segmentos=12, rot=(0, math.radians(90), 0)))
    return pecas


# ------------------------------------------------------------------ lanca e cesto

# A lanca deitada: do pino da torre ate a ponta, subindo de leve. Ela corre
# ACIMA do topo dos armarios (1,84) com folga que se enxerga — a 1,92 da
# primeira versao ela ficava rente ao telhado e sumia na silhueta.
LANCA_X0 = CAR_X0 + 0.54
LANCA_Z0 = 2.14
LANCA_X1 = 2.42
LANCA_Z1 = 2.38
LANCA_ANG = math.atan2(LANCA_Z1 - LANCA_Z0, LANCA_X1 - LANCA_X0)

CESTO_X = LANCA_X1 + 0.46
CESTO_PISO = 1.96


def _no_eixo_lanca(t):
    """Ponto sobre o eixo da lanca, t de 0 (pino) a 1 (ponta)."""
    return (LANCA_X0 + t * (LANCA_X1 - LANCA_X0),
            0.0,
            LANCA_Z0 + t * (LANCA_Z1 - LANCA_Z0))


def lanca(m):
    """Lanca articulada telescopica ISOLADA, na posicao de transporte.

    Isolada quer dizer FIBRA, nao metal — e por isso que ela e bege; trocar
    por cinza metalico erraria o item tecnico que a fase inteira ensina.

    Deitada ela tem de APOIAR em algo e terminar DENTRO do veiculo: a versao
    antiga mandava o cesto para x = +4,4 com a carroceria acabando em +3,5 e
    ele boiava metros atras do caminhao. Aqui a cadeia e continua e visivel:
    estrado -> mesa giratoria -> torre -> pino -> tres secoes -> braco ->
    cesto, com berco no meio e cavalete sob o cesto.
    """
    pecas = {"fibra": [], "aco": [], "cesto": [], "cromo": []}
    rot = (0.0, -LANCA_ANG, 0.0)
    mesa_z = CAR_PISO + 0.10

    # base giratoria plantada NO ESTRADO, entre os armarios
    pecas["aco"].append(C.caixa(
        "cam_base_torre", (0.86, 0.92, 0.10), (LANCA_X0, 0, CAR_PISO + 0.05)))
    mesa = C.perfil_revolucao(
        [(0.0, 0.0), (0.40, 0.0), (0.40, 0.26), (0.33, 0.34), (0.0, 0.34)],
        "cam_mesa", segmentos=20)
    mesa.location = (LANCA_X0, 0, mesa_z)
    pecas["aco"].append(mesa)
    # torre: e ela que explica por que a lanca esta la em cima. Sem torre a
    # lanca parece colada no telhado do armario.
    pecas["aco"].append(chanfrar(C.caixa(
        "cam_torre", (0.46, 0.58, LANCA_Z0 - mesa_z - 0.30),
        (LANCA_X0, 0, (mesa_z + 0.34 + LANCA_Z0) / 2)),
        largura=0.020, segmentos=2))
    for lado in (-1, 1):
        pecas["cromo"].append(C.cilindro(
            f"cam_pino_{lado}", 0.055, 0.10,
            (LANCA_X0, lado * 0.30, LANCA_Z0), segmentos=12,
            rot=(math.radians(90), 0, 0)))

    # tres secoes telescopicas, cada uma mais fina: e a CONICIDADE que faz
    # ler como lanca em vez de viga
    secoes = [("aco", 0.00, 0.42, 0.34), ("fibra", 0.34, 0.76, 0.265),
              ("fibra", 0.70, 1.00, 0.200)]
    for i, (mat, t0, t1, secao) in enumerate(secoes):
        a, b = Vector(_no_eixo_lanca(t0)), Vector(_no_eixo_lanca(t1))
        comp = (b - a).length
        pecas[mat].append(chanfrar(C.caixa(
            f"cam_lanca_{i}", (comp, secao, secao), tuple((a + b) / 2), rot=rot),
            largura=0.018, segmentos=2))

    # cilindro hidraulico de elevacao: da base da torre ate a secao de aco
    pe = Vector((LANCA_X0 + 0.16, 0.0, mesa_z + 0.30))
    cab = Vector(_no_eixo_lanca(0.26))
    d = cab - pe
    pecas["cromo"].append(C.cilindro(
        "cam_hidraulico", 0.060, d.length, tuple((pe + cab) / 2),
        segmentos=12, rot=(0, -math.atan2(d.z, d.x) + math.radians(90), 0)))

    # berco de repouso no meio do vao: a lanca deitada tem de APOIAR em algo
    ap = Vector(_no_eixo_lanca(0.80))
    for lado in (-1, 1):
        pecas["aco"].append(C.caixa(
            f"cam_berco_pe_{lado}", (0.10, 0.09, ap.z - 0.16 - CAR_TOPO),
            (ap.x, lado * 0.21, (CAR_TOPO + ap.z - 0.16) / 2)))
    pecas["aco"].append(C.caixa(
        "cam_berco_sela", (0.14, 0.50, 0.09), (ap.x, 0, ap.z - 0.19)))

    # braco que liga a PONTA da lanca ao cesto. Sem ele o cesto fica uma
    # caixa boiando atras do caminhao, que foi o que aconteceu antes.
    ponta = Vector(_no_eixo_lanca(1.0))
    pecas["aco"].append(C.caixa(
        "cam_braco_cesto", (CESTO_X - 0.34 - ponta.x + 0.10, 0.17, 0.15),
        ((ponta.x + CESTO_X - 0.30) / 2, 0, ponta.z - 0.09)))
    pecas["aco"].append(C.caixa(
        "cam_braco_desce", (0.16, 0.17, ponta.z - CESTO_PISO - 0.20),
        (CESTO_X - 0.33, 0, (ponta.z + CESTO_PISO + 0.22) / 2)))

    caixa_aberta("cam_cesto", (0.70, 0.66, 0.88), (CESTO_X, 0, CESTO_PISO + 0.44),
                 parede=0.040, destino=pecas["cesto"])
    for dx, dy, a, b in ((0.35, 0, 0.05, 0.66), (-0.35, 0, 0.05, 0.66),
                         (0, 0.325, 0.70, 0.05), (0, -0.325, 0.70, 0.05)):
        pecas["cromo"].append(C.caixa(
            f"cam_cesto_borda_{dx}_{dy}", (a, b, 0.040),
            (CESTO_X + dx, dy, CESTO_PISO + 0.88)))

    # cavalete sob o cesto: quatro pes, nao um bloco branco macico — o bloco
    # lia como um armario extra grudado na traseira
    for dx in (-0.26, 0.26):
        for dy in (-0.25, 0.25):
            pecas["aco"].append(C.caixa(
                f"cam_cav_{dx}_{dy}", (0.07, 0.07, CESTO_PISO - CAR_TOPO),
                (CESTO_X + dx, dy, (CAR_TOPO + CESTO_PISO) / 2)))
    pecas["aco"].append(C.caixa(
        "cam_cav_trav", (0.64, 0.58, 0.05), (CESTO_X, 0, CESTO_PISO - 0.03)))
    return pecas


def patolas(m):
    """Patolas recolhidas. Caminhao de cesto sem patola nao existe, e a
    ausencia delas e o tipo de coisa que quem e da area nota na hora."""
    pecas = {"aco": [], "cromo": []}
    for lado in (-1, 1):
        for x in (CAR_X0 + 0.34, CAR_X1 - 0.42):
            pecas["aco"].append(chanfrar(C.caixa(
                f"cam_patola_cx_{lado}_{x:.1f}", (0.32, 0.60, 0.30),
                (x, lado * (MEIA_L - 0.30), CHASSI_Z - 0.16)), largura=0.012))
            pecas["aco"].append(C.caixa(
                f"cam_patola_pe_{lado}_{x:.1f}", (0.20, 0.17, 0.26),
                (x, lado * (MEIA_L - 0.09), 0.62)))
            pecas["cromo"].append(C.cilindro(
                f"cam_patola_sapata_{lado}_{x:.1f}", 0.13, 0.05,
                (x, lado * (MEIA_L - 0.09), 0.48), segmentos=14))
    return pecas


# ------------------------------------------------------------------ montagem

def montar(nome="oc_veiculo", separar=False):
    """Monta o caminhao inteiro e devolve UM objeto, como o exportador espera.

    Junta-se POR MATERIAL e so depois tudo: juntar de uma vez perderia a
    separacao, e e ela que deixa vidro escuro, cromo metalico e fibra fosca
    lerem diferentes um do outro. Foi exatamente isso que se perdeu quando a
    caminhonete antiga passou pelo forno — uma peca, um material, cromo
    virando plastico.
    """
    m = materiais()
    grupos = {}

    def somar(fonte):
        for chave, objs in fonte.items():
            grupos.setdefault(chave, []).extend(objs)

    for fonte in (cabine(m), carroceria(m), chassi(m), lanca(m), patolas(m)):
        somar(fonte)

    # rodas: dianteiras simples, traseiras em par
    for lado in (-1, 1):
        somar(roda(f"cam_rd_{lado}", (EIXO_D, lado * BITOLA_D, RODA_R)))
        somar(roda(f"cam_rt_{lado}", (EIXO_T, lado * BITOLA_T, RODA_R),
                   externa=False))
        somar(roda(f"cam_rtg_{lado}",
                   (EIXO_T, lado * (BITOLA_T + RODA_L + FOLGA_GEMEA), RODA_R)))

    # giroflex no teto da cabine
    grupos.setdefault("giroflex", []).append(C.cilindro(
        "cam_giroflex", 0.10, 0.09, (CAB_FRENTE + 1.10, 0, CAB_TETO + 0.08),
        segmentos=16))
    grupos.setdefault("aco", []).append(chanfrar(C.caixa(
        "cam_giro_base", (0.34, 0.26, 0.05),
        (CAB_FRENTE + 1.10, 0, CAB_TETO + 0.02)), largura=0.010))

    por_material = {
        "pintura": m["pintura"], "verde": m["verde"], "vidro": m["vidro"],
        "cromo": m["cromo"], "aco": m["aco"], "chassi": m["chassi"],
        "farol": m["farol"], "pisca": m["pisca"], "lanterna": m["lanterna"],
        "refletivo": m["refletivo"], "fibra": m["fibra"], "cesto": m["cesto"],
        "giroflex": m["giroflex"], "borracha": m["borracha"], "aro": m["aro"],
    }

    # Com `separar`, a LANCA e o CESTO saem como objetos proprios para o jogo
    # poder levantar o cesto. Tem de ser decidido AQUI, antes de juntar por
    # material: `C.juntar` apaga os nomes individuais, e depois dele nao ha
    # mais como dizer quem e lanca e quem e carroceria.
    #
    # O cesto e separado da lanca (e nao filho dela) porque ele tem de ficar
    # NIVELADO enquanto a lanca sobe. Cesto girando junto com a lanca despeja
    # o eletricista na rua, e e o tipo de erro que o cliente ve em um segundo.
    def onde(obj):
        n = obj.name
        if n.startswith("cam_cesto"):
            return "cesto"
        if n.startswith(("cam_lanca_", "cam_hidraulico", "cam_braco_")):
            return "lanca"
        return "fixo"

    caixas = {"fixo": {}, "lanca": {}, "cesto": {}}
    for chave, objs in grupos.items():
        for o in objs:
            if o and o.name in bpy.data.objects:
                caixas[onde(o)].setdefault(chave, []).append(o)

    def montar_caixa(alvo_nome, conteudo):
        partes = []
        for chave, objs in conteudo.items():
            alvo = C.juntar(objs, f"cam_g_{chave}") if len(objs) > 1 else objs[0]
            C.aplicar(alvo, por_material.get(chave, m["aco"]))
            partes.append(alvo)
        if not partes:
            return None
        inteiro = C.juntar(partes, alvo_nome) if len(partes) > 1 else partes[0]
        inteiro.name = alvo_nome
        return inteiro

    if not separar:
        tudo = {}
        for caixa in caixas.values():
            for chave, objs in caixa.items():
                tudo.setdefault(chave, []).extend(objs)
        return montar_caixa(nome, tudo)

    return {
        nome: montar_caixa(nome, caixas["fixo"]),
        f"{nome}_lanca": montar_caixa(f"{nome}_lanca", caixas["lanca"]),
        f"{nome}_cesto": montar_caixa(f"{nome}_cesto", caixas["cesto"]),
    }


# Eixo da articulacao e base do cesto, em metros do caminhao. O jogo gira a
# lanca em torno do PINO e translada o cesto pelo mesmo giro, sem girar ele.
PINO = (LANCA_X0, 0.0, LANCA_Z0)
CESTO_BASE = (CESTO_X, 0.0, CESTO_PISO)
