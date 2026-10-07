"""
A via do trajeto (fase 2b), em pecas que se repetem.

No jogo quem anda e o MUNDO, nao o veiculo: a cabine fica parada na origem e
os trechos da via correm por baixo dela, sendo reciclados quando passam para
tras. Por isso tudo aqui e modular e de baixa contagem — cada peca aparece
dezenas de vezes na tela ao mesmo tempo.

Sistema: o veiculo aponta para -Y. A FAIXA EM QUE ELE ANDA e centrada em x=0,
e o eixo da via fica em x=-1,75 (mao direita, como no Brasil). Assim a cabine
nao precisa ser deslocada.
"""
import math, random, bmesh, bpy
from mathutils import Vector

import comum as C

TRECHO = 40.0            # comprimento de um trecho, em metros
FAIXA = 3.5              # largura de uma faixa
# Mao direita: o eixo da via fica a ESQUERDA de quem dirige, e olhando para
# -Y a esquerda e +X. Com o eixo em x negativo o veiculo anda na contramao.
EIXO = FAIXA / 2                 # +1.75, eixo da via
BORDA_DIR = -FAIXA / 2           # -1.75, borda do lado do motorista
BORDA_ESQ = EIXO + FAIXA         # +5.25, borda oposta
ACOSTAMENTO = 2.2


# ---------------------------------------------------------------- materiais

def materiais():
    asfalto = C.mat_simples("via_asfalto", (0.042, 0.043, 0.046), rugosidade=0.90)
    tinta = C.mat_simples("via_tinta", (0.62, 0.60, 0.55), rugosidade=0.70)
    tinta_am = C.mat_simples("via_tinta_am", (0.52, 0.36, 0.05), rugosidade=0.70)
    terra = C.mat_simples("via_terra", (0.105, 0.078, 0.052), rugosidade=0.95)
    mato = C.mat_simples("via_mato", (0.055, 0.082, 0.032), rugosidade=0.92)
    concreto = C.mat_simples("via_concreto", (0.175, 0.172, 0.162), rugosidade=0.88)
    madeira = C.mat_simples("via_madeira", (0.115, 0.082, 0.052), rugosidade=0.85)
    metal = C.mat_simples("via_metal", (0.52, 0.53, 0.54), rugosidade=0.38,
                          metalico=1.0)
    cabo = C.mat_simples("via_cabo", (0.028, 0.029, 0.031), rugosidade=0.62)
    return dict(asfalto=asfalto, tinta=tinta, tinta_am=tinta_am, terra=terra,
                mato=mato, concreto=concreto, madeira=madeira, metal=metal,
                cabo=cabo)


# ---------------------------------------------------------------- pista

def trecho(m, nome="via_trecho", comprimento=TRECHO):
    """Um trecho de pista com acostamento, eixo duplo e bordas.

    A faixa central e SEGMENTADA em tracos de 4 m com 8 m de vao: e o que da a
    sensacao de velocidade quando o trecho corre. Linha continua nao informa
    nada sobre quao rapido se anda.
    """
    y0, y1 = 0.0, -comprimento
    meio = (y0 + y1) / 2
    pecas = []

    pista = C.caixa(f"{nome}_pista",
                    (BORDA_DIR - BORDA_ESQ, comprimento, 0.12),
                    ((BORDA_DIR + BORDA_ESQ) / 2, meio, -0.06))
    C.aplicar(pista, m["asfalto"])
    pecas.append(pista)

    # O acostamento fica FORA da pista, nao dentro dela.
    #
    # A primeira versao somava metade da largura do acostamento a BORDA_DIR
    # (que e NEGATIVO) e subtraia de BORDA_ESQ — o que jogava as duas faixas
    # de terra para DENTRO do asfalto, cobrindo 4,4 m dos 7 m de pista. Com
    # terra e asfalto os dois em cor escura e chapada ninguem percebia; na
    # hora que a terra ganhou textura bege a pista apareceu enterrada nela.
    # O mesmo sinal trocado empurrava a faixa de mato para cima do asfalto.
    for lado, fora in (("dir", -1), ("esq", 1)):
        borda = BORDA_DIR if lado == "dir" else BORDA_ESQ
        x = borda + fora * ACOSTAMENTO / 2
        acost = C.caixa(f"{nome}_acost_{lado}", (ACOSTAMENTO, comprimento, 0.10),
                        (x, meio, -0.07))
        C.aplicar(acost, m["terra"])
        pecas.append(acost)

        beira = C.caixa(f"{nome}_beira_{lado}", (5.0, comprimento, 0.30),
                        (x + fora * (2.5 + ACOSTAMENTO / 2), meio, -0.18))
        C.aplicar(beira, m["mato"])
        pecas.append(beira)

    # bordas continuas: pintadas SOBRE o asfalto, encostadas na beirada
    for lado, x in (("dir", BORDA_DIR + 0.14), ("esq", BORDA_ESQ - 0.14)):
        linha = C.caixa(f"{nome}_borda_{lado}", (0.12, comprimento, 0.004),
                        (x, meio, 0.002))
        C.aplicar(linha, m["tinta"])
        pecas.append(linha)

    # eixo duplo amarelo
    for dx in (-0.09, 0.09):
        eixo = C.caixa(f"{nome}_eixo_{dx:+.2f}", (0.11, comprimento, 0.004),
                       (EIXO + dx, meio, 0.002))
        C.aplicar(eixo, m["tinta_am"])
        pecas.append(eixo)

    return C.juntar(pecas, nome)


def faixa_pedestre(m, nome="via_faixa_pedestre"):
    """Faixa de pedestre: barras paralelas ao sentido da via."""
    pecas = []
    for i in range(9):
        x = BORDA_ESQ + 0.55 + i * 0.78
        barra = C.caixa(f"{nome}_{i}", (0.44, 3.0, 0.004), (x, -1.5, 0.003))
        C.aplicar(barra, m["tinta"])
        pecas.append(barra)
    return C.juntar(pecas, nome)


def lombada(m, nome="via_lombada"):
    """Lombada com as listras. Larga o bastante para atravessar a pista toda."""
    bm = bmesh.new()
    largura = BORDA_DIR - BORDA_ESQ
    passos = 14
    linhas = []
    for j in range(2):
        x = (BORDA_ESQ, BORDA_DIR)[j]
        linha = []
        for i in range(passos + 1):
            t = i / passos
            y = -3.6 * t
            z = 0.10 * math.sin(math.pi * t)
            linha.append(bm.verts.new((x, y, z)))
        linhas.append(linha)
    for i in range(passos):
        bm.faces.new((linhas[0][i], linhas[0][i + 1],
                      linhas[1][i + 1], linhas[1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = C.obj_de_bmesh(bm, nome + "_corpo")
    C.suavizar(obj, 50)
    C.aplicar(obj, m["asfalto"])
    pecas = [obj]
    for i in range(10):
        x = BORDA_ESQ + 0.2 + i * (largura - 0.4) / 9
        listra = C.caixa(f"{nome}_listra_{i}", (0.26, 1.1, 0.004),
                         (x, -1.8, 0.104), rot=(math.radians(0), 0, 0))
        C.aplicar(listra, m["tinta"])
        pecas.append(listra)
    return C.juntar(pecas, nome)


def chao(m, nome="via_chao", raio=400.0, passo=10.0):
    """Terreno alem do acostamento. Uma peca so, colocada uma vez pelo jogo.

    Sem ela a faixa de mato acaba no vazio e se ve o ceu por baixo da via —
    o defeito mais barato de arrumar e o mais obvio na tela.

    E SUBDIVIDIDA de proposito. O jogo dobra a via no vertice (ver curva.ts):
    o desvio e uma parabola, e uma caixa de 800 m com oito vertices interpola
    essa parabola em linha reta e AFUNDA ate 85 cm no meio do caminho. As
    arvores, que seguem a parabola exata, ficavam flutuando sobre o buraco.
    Um vertice a cada dez metros resolve, e custa 700 vertices — nada.
    """
    passos = int((raio * 2) / passo)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=12, y_segments=passos, size=raio)
    obj = C.obj_de_bmesh(bm, nome)
    for v in obj.data.vertices:
        v.co.z -= 0.25
    C.aplicar(obj, m["mato"])
    return obj


# --------------------------------------------------------------- ajudantes
#
# Tres funcoes pequenas que resolvem os dois defeitos que o cliente viu na
# vegetacao: forma geometrica demais e cor chapada demais.

def _tubo(bm, pontos, segmentos=7, topo=False):
    """Loft de aneis: `pontos` = [(x, y, z, raio)], de baixo para cima.

    Tronco nao e cilindro: engrossa na base e afina no topo, e quase nenhum
    e perfeitamente reto. Um cilindro de raio unico e metade do porque a
    arvore lia como poste com um bloco em cima.
    """
    aneis = []
    for x, y, z, raio in pontos:
        anel = []
        for i in range(segmentos):
            a = 2 * math.pi * i / segmentos
            anel.append(bm.verts.new(
                (x + math.cos(a) * raio, y + math.sin(a) * raio, z)))
        aneis.append(anel)
    for k in range(len(aneis) - 1):
        A, B = aneis[k], aneis[k + 1]
        for i in range(segmentos):
            j = (i + 1) % segmentos
            bm.faces.new((A[i], A[j], B[j], B[i]))
    bm.faces.new(list(reversed(aneis[0])))
    if topo:
        bm.faces.new(aneis[-1])
    return aneis


def _bolha(bm, centro, raio, achatado=0.86, semente=0, u=7, v=5, aspero=0.30):
    """Massa de folhagem: esfera de poucos segmentos com o raio SORTEADO por
    vertice.

    A esfera lisa e o que faz a copa ler como bloco hexagonal — com poucos
    segmentos a silhueta e um poligono regular, e o olho le poligono antes de
    ler folha. Sortear o raio quebra o contorno sem custar um poligono a mais.
    """
    r = random.Random(semente)
    res = bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=raio)
    for vt in res["verts"]:
        vt.co *= 1.0 + (r.random() - 0.5) * 2 * aspero
        vt.co.z *= achatado
        vt.co += Vector(centro)
    return res["verts"]


def _pintar_por_normal(obj, mats, limiar=0.52):
    """Duas cores na mesma peca: o alto da copa pega o verde claro.

    A via nao vai ao forno e `C.sujar` nao pode ser usado (ruido procedural
    nao exporta e leva a cor base junto). Separar por normal e o jeito que
    SOBREVIVE ao glTF de a folhagem nao ser um unico verde chapado.

    O criterio mistura normal com ALTURA de proposito. So pela normal as faces
    vizinhas cruzam o limiar alternadamente e a copa vira um tabuleiro de
    xadrez — foi o que o primeiro render mostrou. A altura da coerencia
    espacial: as claras se agrupam no alto, que e onde a luz bate.
    """
    obj.data.materials.clear()
    for mat in mats:
        obj.data.materials.append(mat)
    zs = [v.co.z for v in obj.data.vertices]
    z0, z1 = min(zs), max(zs)
    faixa = max(z1 - z0, 1e-4)
    for p in obj.data.polygons:
        alto = (p.center.z - z0) / faixa
        p.material_index = 1 if 0.55 * p.normal.z + 0.45 * alto > limiar else 0
    return obj


# ---------------------------------------------------------------- beira

def poste_da_via(m, nome="via_poste", altura=9.0):
    """Poste de distribuicao simplificado para repetir na beira da via.

    NAO usa o `poste.py`: aquele e o poste do cenario de perto, com duplo T
    chanfrado, isolador de saias e transformador — 16 MB de .glb. Aqui cada
    poste aparece dezenas de vezes ao mesmo tempo e passa a 30 km/h, entao o
    que importa e a silhueta.
    """
    pecas = []
    # poste de concreto e TRONCO-CONICO: 21 cm no engaste, 11 cm no topo. O
    # cilindro de raio unico e o que mais fazia o poste ler como cano.
    bm = bmesh.new()
    _tubo(bm, [(0, 0, 0.00, 0.145), (0, 0, 0.35, 0.128),
               (0, 0, altura * 0.55, 0.090), (0, 0, altura, 0.062)],
          segmentos=10, topo=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    fuste = C.obj_de_bmesh(bm, f"{nome}_fuste")
    C.suavizar(fuste, 45)
    C.aplicar(fuste, m["concreto"])
    pecas.append(fuste)

    cruzeta = C.caixa(f"{nome}_cruzeta", (2.40, 0.12, 0.105),
                      (0, 0.12, altura - 0.35))
    C.chanfrar(cruzeta, largura=0.012, segmentos=2)
    C.aplicar(cruzeta, m["madeira"])
    pecas.append(cruzeta)

    # isolador de pino: pescoco fino, corpo gordo e saia. Tres cilindros retos
    # davam tres pastilhas iguais que a essa distancia somem.
    for dx in (-1.05, 0.0, 1.05):
        bm = bmesh.new()
        _tubo(bm, [(dx, 0.12, altura - 0.30, 0.022),
                   (dx, 0.12, altura - 0.22, 0.030),
                   (dx, 0.12, altura - 0.20, 0.072),
                   (dx, 0.12, altura - 0.14, 0.060),
                   (dx, 0.12, altura - 0.12, 0.048)], segmentos=8, topo=True)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        isol = C.obj_de_bmesh(bm, f"{nome}_isol_{dx:+.2f}")
        C.suavizar(isol, 40)
        C.aplicar(isol, C.mat_simples("via_isolador", (0.085, 0.082, 0.075),
                                      rugosidade=0.30))
        pecas.append(isol)

    # a mao-francesa trabalha em diagonal dos dois lados da cruzeta
    for lado in (-1, 1):
        mao = C.barra(f"{nome}_mao_{lado}", (lado * 0.07, 0.10, altura - 0.78),
                      (lado * 0.62, 0.12, altura - 0.42), secao=(0.055, 0.04))
        C.aplicar(mao, m["metal"])
        pecas.append(mao)
    return C.juntar(pecas, nome)


def vao_de_cabos(m, nome="via_cabos", comprimento=TRECHO, altura=9.0,
                 flecha=0.9):
    """Os condutores entre um poste e o seguinte, com barriga.

    Sao peca a parte do poste porque o vao liga DOIS postes: repetir junto do
    poste deixaria o cabo nascendo e morrendo no mesmo lugar.

    O modificador SKIN fazia o cabo e custava 30.252 triangulos — 82% do
    catalogo inteiro, num fio de 1,6 cm que passa a nove metros de altura.
    Trocado por um tubo de quatro lados feito a mao: 300 triangulos, mesma
    imagem. Era a maior gordura do arquivo, de longe.
    """
    passos = 10
    lados = 4
    raio = 0.018
    bm = bmesh.new()
    for dx in (-1.05, 0.0, 1.05):
        aneis = []
        for i in range(passos + 1):
            t = i / passos
            y = -comprimento * t
            z = altura - 0.24 + 0.065 - flecha * math.sin(math.pi * t)
            # anel no plano XZ: o cabo corre em Y, entao e essa a secao. A
            # pequena torcao do caimento nao aparece num fio tao fino.
            anel = []
            for k in range(lados):
                a = 2 * math.pi * k / lados + math.pi / 4
                anel.append(bm.verts.new(
                    (dx + math.cos(a) * raio, y, z + math.sin(a) * raio)))
            aneis.append(anel)
        for i in range(passos):
            A, B = aneis[i], aneis[i + 1]
            for k in range(lados):
                j = (k + 1) % lados
                bm.faces.new((A[k], A[j], B[j], B[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = C.obj_de_bmesh(bm, nome)
    C.suavizar(obj, 50)
    C.aplicar(obj, m["cabo"])
    return obj


def placa(m, nome="via_placa", altura=2.2):
    """Poste e chapa em branco. O desenho da placa e uma textura feita pelo
    jogo — assim mudar o limite de velocidade nao exige reexportar nada.

    A chapa era um disco branco de 1,4 cm numa haste de 3 cm: no render lia
    como um pirulito. Ganhou aro de borda (a placa de verdade tem bordo
    rebatido), costas cinza, bracadeira e base de concreto — e a haste
    engrossou para 4,4 cm, que e o que um tubo de placa tem de verdade.
    """
    pecas = []
    base = C.cilindro(f"{nome}_base", 0.17, 0.22, (0, 0, 0.09), segmentos=10)
    C.aplicar(base, m["concreto"])
    pecas.append(base)

    haste = C.cilindro(f"{nome}_haste", 0.044, altura, (0, 0, altura / 2),
                       segmentos=10)
    C.aplicar(haste, m["metal"])
    pecas.append(haste)

    zc = altura + 0.26
    # costas e aro: o aro sobra 2 cm da face e e o que da espessura de chapa
    aro = C.cilindro(f"{nome}_aro", 0.36, 0.070, (0, 0.0, zc),
                     segmentos=20, rot=(math.radians(90), 0, 0))
    C.aplicar(aro, C.mat_simples("via_placa_costas", (0.115, 0.118, 0.122),
                                 rugosidade=0.55))
    pecas.append(aro)

    # A face olha para +Y, de onde o motorista chega, e fica NA FRENTE do aro.
    # Recuada ela sumia: o aro e disco cheio, nao anel, e engolia a chapa
    # inteira — a placa saiu cinza no render em vez de branca.
    chapa = C.cilindro(f"{nome}_chapa", 0.335, 0.016, (0, 0.043, zc),
                       segmentos=20, rot=(math.radians(90), 0, 0))
    C.aplicar(chapa, C.mat_simples("placa_face", (0.80, 0.80, 0.78),
                                   rugosidade=0.45))
    pecas.append(chapa)

    bracadeira = C.caixa(f"{nome}_bracadeira", (0.10, 0.09, 0.26),
                         (0, -0.045, zc))
    C.aplicar(bracadeira, m["metal"])
    pecas.append(bracadeira)
    return C.juntar(pecas, nome)


def _mats_folha():
    """Os dois verdes da vegetacao. Reaproveita o material ja criado: criar de
    novo gera `via_copa.001` e o jogo perde a peca pelo nome."""
    saida = []
    for nome, cor in (("via_copa", (0.030, 0.052, 0.022)),
                      ("via_copa_sol", (0.072, 0.108, 0.038))):
        mat = bpy.data.materials.get(nome)
        saida.append(mat or C.mat_simples(nome, cor, rugosidade=0.93))
    return saida


def arvore(m, nome="via_arvore", altura=5.6, semente=11):
    """Arvore de beira de estrada: tronco que afina, forquilha e copa em massas.

    A versao antiga era tres icosferas lisas sobre um cilindro, e a copa nem
    encostava no tronco — ficava flutuando 40 cm acima dele. Lia como bloco
    hexagonal pendurado, e e a peca que mais aparece no trajeto.

    O que resolve, na ordem do que o olho percebe: (1) a copa ENGOLIR o topo
    do tronco, (2) silhueta irregular em vez de poligono regular, (3) dois
    verdes separados por normal em vez de um verde chapado. Tudo isso cabe em
    ~500 triangulos, que e o que uma peca instanciada dez vezes pode gastar.
    """
    r = random.Random(semente)
    pecas = []
    colo = altura * 0.46                 # onde o tronco se abre em galhos

    bm = bmesh.new()
    _tubo(bm, [(0, 0, 0.00, 0.38), (0, 0, 0.28, 0.245),
               (0.04, 0.02, colo * 0.6, 0.180),
               (0.07, 0.03, colo, 0.140)], segmentos=8, topo=True)
    # galhos: nascem do colo e MORREM DENTRO da copa. Sem eles a copa parece
    # apoiada no tronco; com eles ha um volume ligando as duas coisas.
    for ang, inc in ((0.5, 1.0), (2.6, 0.92), (4.4, 1.05)):
        dx, dy = math.cos(ang), math.sin(ang)
        _tubo(bm, [(0.07, 0.03, colo - 0.05, 0.110),
                   (0.07 + dx * 0.32, 0.03 + dy * 0.32, colo + 0.45 * inc, 0.072),
                   (0.07 + dx * 0.70, 0.03 + dy * 0.70, colo + 1.05 * inc, 0.040)],
              segmentos=5, topo=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    tronco = C.obj_de_bmesh(bm, f"{nome}_tronco")
    C.suavizar(tronco, 50)
    C.aplicar(tronco, C.mat_simples("via_casca", (0.135, 0.110, 0.082),
                                    rugosidade=0.93))
    pecas.append(tronco)

    # Copa em cinco massas de tamanhos diferentes. Massas iguais voltam a ler
    # como arranjo geometrico; o sorteio de posicao e raio e o que evita isso.
    bm = bmesh.new()
    # tudo em fracao da altura, para a arvore escalar inteira sem desmontar
    centro = altura * 0.70
    # Sete massas, nenhuma do mesmo tamanho. As duas ultimas sao baixas e
    # salientes: e o que impede a copa de fechar numa bola — contorno de bola
    # e o que sobrou de "geometrico" no segundo render.
    massas = ((0.02, 0.00, 0.00, 0.235), (-0.13, 0.06, -0.09, 0.175),
              (0.12, -0.05, -0.06, 0.185), (-0.05, -0.12, 0.10, 0.150),
              (0.07, 0.10, 0.13, 0.135), (-0.21, -0.03, -0.16, 0.105),
              (0.19, 0.09, -0.14, 0.120))
    for i, (dx, dy, dz, fr) in enumerate(massas):
        jx = (r.random() - 0.5) * 0.10 * altura
        jy = (r.random() - 0.5) * 0.10 * altura
        _bolha(bm, (dx * altura + jx, dy * altura + jy, centro + dz * altura),
               fr * altura, achatado=0.82, semente=semente * 17 + i,
               u=9, v=6, aspero=0.28)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    copa = C.obj_de_bmesh(bm, f"{nome}_copa")
    C.suavizar(copa, 70)
    _pintar_por_normal(copa, _mats_folha())
    pecas.append(copa)
    return C.juntar(pecas, nome)


def arbusto(m, nome="via_arbusto", semente=5):
    """Moita de beira: tres massas de alturas diferentes, nao um disco.

    A versao antiga era UMA icosfera achatada: de perfil lia como uma pedra
    lisa plantada no mato.
    """
    bm = bmesh.new()
    for i, (dx, dy, rz, rr) in enumerate(((0.0, 0.0, 0.46, 0.62),
                                          (-0.46, 0.18, 0.34, 0.44),
                                          (0.38, -0.22, 0.30, 0.40))):
        _bolha(bm, (dx, dy, rz), rr, achatado=0.80,
               semente=semente * 13 + i, u=8, v=5, aspero=0.34)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = C.obj_de_bmesh(bm, nome)
    C.suavizar(obj, 70)
    _pintar_por_normal(obj, _mats_folha())
    return obj


def casa(m, nome="via_casa", largura=7.5, fundo=8.0, altura=2.9):
    """Casa de beira de estrada, de frente para +Y (o lado de quem chega).

    A versao antiga era caixa + prisma + muro, e lia exatamente como isso. O
    que faz uma casa parar de ler como caixa, na ordem do que custa menos:

      1. BEIRAL. Telhado rente a parede e o que mais denuncia o bloco; 45 cm
         de abano projetam uma sombra horizontal que a caixa nunca tem.
      2. ABERTURAS. Duas janelas e uma porta com batente — sem elas nao ha
         escala, e sem escala a caixa pode ser qualquer coisa de qualquer
         tamanho.
      3. CAIXA D'AGUA e platibanda do muro, que quebram o contorno reto no
         alto e dao o jeitao de casa brasileira de beira de estrada.

    Em ~700 triangulos, que cabe folgado agora que o vao de cabos parou de
    comer o catalogo inteiro.
    """
    pecas = []
    parede = C.mat_simples("via_parede", (0.255, 0.238, 0.205), rugosidade=0.90)
    barra_cor = C.mat_simples("via_parede_barra", (0.125, 0.118, 0.105),
                              rugosidade=0.92)
    telha = C.mat_simples("via_telha", (0.165, 0.062, 0.038), rugosidade=0.88)
    vidro = C.mat_simples("via_casa_vidro", (0.022, 0.028, 0.036),
                          rugosidade=0.14)

    corpo = C.caixa(f"{nome}_corpo", (largura, fundo, altura),
                    (0, -fundo / 2, altura / 2))
    C.chanfrar(corpo, largura=0.03, segmentos=2)
    C.aplicar(corpo, parede)
    pecas.append(corpo)

    # barra pintada rente ao chao: assenta a casa no terreno em vez de a
    # parede morrer na terra
    rodape = C.caixa(f"{nome}_rodape", (largura + 0.06, fundo + 0.06, 0.55),
                     (0, -fundo / 2, 0.275))
    C.aplicar(rodape, barra_cor)
    pecas.append(rodape)

    # telhado de duas aguas COM beiral: avanca em X e em Y, e tem espessura,
    # entao a aresta de baixo vira uma testeira visivel e nao um corte seco
    aba = 0.45
    bm = bmesh.new()
    meia = largura / 2 + aba
    cume = 1.30
    y0, y1 = aba, -fundo - aba
    perfil = ((-meia, 0.0), (0.0, cume), (meia, 0.0),
              (meia, -0.16), (0.0, cume - 0.16), (-meia, -0.16))
    frentes = []
    for y in (y0, y1):
        frentes.append([bm.verts.new((x, y, z)) for x, z in perfil])
    n = len(perfil)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((frentes[0][i], frentes[0][j],
                      frentes[1][j], frentes[1][i]))
    bm.faces.new(list(reversed(frentes[0])))
    bm.faces.new(frentes[1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    telhado = C.obj_de_bmesh(bm, f"{nome}_telhado")
    for v in telhado.data.vertices:
        v.co.z += altura
    # As duas tampas do telhado sao o OITAO — parede, nao telha. Pintadas de
    # telha elas ficavam um triangulo escuro na sombra e liam como buraco no
    # alto da casa, que foi o que apareceu no primeiro render.
    telhado.data.materials.clear()
    telhado.data.materials.append(telha)
    telhado.data.materials.append(parede)
    for p in telhado.data.polygons:
        p.material_index = 1 if abs(p.normal.y) > 0.9 else 0
    pecas.append(telhado)

    # caixa d'agua sobre a laje dos fundos: 20 triangulos que tiram a
    # silhueta do triangulo perfeito
    cxa = C.cilindro(f"{nome}_caixa_dagua", 0.46, 0.62,
                     (largura * 0.22, -fundo * 0.72, altura + cume + 0.10),
                     segmentos=10)
    C.aplicar(cxa, C.mat_simples("via_caixa_dagua", (0.105, 0.115, 0.125),
                                 rugosidade=0.72))
    pecas.append(cxa)

    def abertura(sufixo, centro, tamanho, eixo="y"):
        """Vao com batente: o batente e o que da relevo. So o vidro escuro
        leria como adesivo colado na parede."""
        lv, av = tamanho
        esp = 0.09
        if eixo == "y":
            dim, dim_b, desloc = (lv, esp, av), (lv + 0.20, esp * 0.6, av + 0.20), (0, 0.03, 0)
        else:
            dim, dim_b, desloc = (esp, lv, av), (esp * 0.6, lv + 0.20, av + 0.20), (0.03, 0, 0)
        batente = C.caixa(f"{nome}_batente_{sufixo}", dim_b, centro)
        C.aplicar(batente, barra_cor)
        pecas.append(batente)
        pano = C.caixa(f"{nome}_pano_{sufixo}", dim,
                       tuple(centro[k] + desloc[k] for k in range(3)))
        C.aplicar(pano, vidro)
        pecas.append(pano)

    frente = 0.02
    abertura("jan_e", (-1.95, frente, 1.75), (1.25, 1.05))
    abertura("jan_d", (1.95, frente, 1.75), (1.25, 1.05))
    abertura("porta", (0.0, frente, 1.07), (0.95, 2.10))
    # a lateral e o que o motorista ve por mais tempo, passando
    abertura("jan_lat", (largura / 2 - 0.02, -2.6, 1.75), (1.30, 1.05),
             eixo="x")

    # muro com pilaretes e portao: muro liso e outra caixa
    muro = C.caixa(f"{nome}_muro", (largura + 1.0, 0.16, 1.35),
                   (0, 1.3, 0.675))
    C.aplicar(muro, m["concreto"])
    pecas.append(muro)
    for dx in (-1, 1):
        pil = C.caixa(f"{nome}_pilar_{dx}", (0.30, 0.30, 1.62),
                      (dx * (largura + 1.0) / 2, 1.3, 0.81))
        C.chanfrar(pil, largura=0.02, segmentos=2)
        C.aplicar(pil, m["concreto"])
        pecas.append(pil)
    portao = C.caixa(f"{nome}_portao", (2.30, 0.07, 1.40), (0, 1.3, 0.70))
    C.aplicar(portao, C.mat_simples("via_casa_portao", (0.085, 0.095, 0.105),
                                    rugosidade=0.45, metalico=0.7))
    pecas.append(portao)
    return C.juntar(pecas, nome)


def escola(m, nome="via_escola", modulo=10.0):
    """Um MODULO de 10 m de frente de escola publica, feito para LADRILHAR.

    O jogo repete a mesma peca a cada 10 m para formar a quadra inteira, entao
    tudo aqui tem exatamente `modulo` de comprimento em X e emenda no vizinho
    sem vao nem sobreposicao. E por isso que nao ha portao nem placa na peca:
    um portao a cada 10 m viraria uma fileira de portoes.

    O que distingue de casa, na ordem do que custa menos:

      1. MURO alto na divisa com faixa de cor corrida. Casa de beira de
         estrada tem muro baixo ou nenhum; escola tem muro de verdade, e e a
         linha horizontal continua dele que o motorista le de longe.
      2. PLATIBANDA no lugar de telhado de duas aguas. Predio publico tem topo
         reto; so isso ja separa a silhueta da fileira de casas.
      3. FITA DE JANELA corrida, nao janelinhas soltas. Sala de aula tem
         esquadria contínua, e a repeticao dela e o que diz "escola" antes de
         qualquer placa.

    ~420 triangulos.
    """
    pecas = []
    creme = C.mat_simples("via_escola_parede", (0.300, 0.285, 0.245),
                          rugosidade=0.90)
    faixa_cor = C.mat_simples("via_escola_faixa", (0.030, 0.105, 0.230),
                              rugosidade=0.86)
    vidro = C.mat_simples("via_casa_vidro", (0.022, 0.028, 0.036),
                          rugosidade=0.14)

    # muro na divisa, com coroamento
    muro = C.caixa(f"{nome}_muro", (modulo, 0.18, 2.35), (0, 0, 1.175))
    C.aplicar(muro, creme)
    pecas.append(muro)
    faixa = C.caixa(f"{nome}_faixa", (modulo, 0.21, 0.42), (0, 0, 1.85))
    C.aplicar(faixa, faixa_cor)
    pecas.append(faixa)
    coroa = C.caixa(f"{nome}_coroa", (modulo, 0.30, 0.10), (0, 0, 2.40))
    C.chanfrar(coroa, largura=0.02, segmentos=2)
    C.aplicar(coroa, creme)
    pecas.append(coroa)

    # bloco recuado: o patio entre muro e predio e o que da profundidade
    recuo, fundo, alt = 5.4, 9.0, 4.10
    bloco = C.caixa(f"{nome}_bloco", (modulo, fundo, alt),
                    (0, -recuo - fundo / 2, alt / 2))
    C.aplicar(bloco, creme)
    pecas.append(bloco)

    # platibanda: topo reto, com a borda avancando 12 cm
    plat = C.caixa(f"{nome}_platibanda", (modulo + 0.24, fundo + 0.24, 0.52),
                   (0, -recuo - fundo / 2, alt + 0.14))
    C.chanfrar(plat, largura=0.025, segmentos=2)
    C.aplicar(plat, creme)
    pecas.append(plat)

    # fita de janela corrida nos dois pavimentos, so na face de quem passa
    y_face = -recuo + 0.02
    for z in (1.70, 3.10):
        vao = C.caixa(f"{nome}_janela_{int(z * 10)}", (modulo - 1.1, 0.10, 0.95),
                      (0, y_face, z))
        C.aplicar(vao, vidro)
        pecas.append(vao)
        peitoril = C.caixa(f"{nome}_peitoril_{int(z * 10)}",
                           (modulo - 1.0, 0.22, 0.12), (0, y_face, z - 0.53))
        C.aplicar(peitoril, faixa_cor)
        pecas.append(peitoril)

    alvo = C.juntar(pecas, nome)
    alvo.name = nome
    return alvo


def _vidraca(nome, a, b, largura, mat, espessura=0.05):
    """Painel inclinado de `a`=(y, z) a `b`=(y, z), com espessura.

    Para-brisa e vigia de carro sao INCLINADOS. A caixa vertical que havia
    antes e o que mais fazia o carro ler como brinquedo de madeira — nenhum
    automovel tem o vidro em pe desde os anos 50.

    Tem espessura de proposito: o exportador liga backface culling em tudo, e
    um plano de uma face so sumiria de um dos lados.
    """
    dy, dz = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dy, dz)
    ny, nz = -dz / n * espessura / 2, dy / n * espessura / 2
    perfil = ((a[0] + ny, a[1] + nz), (b[0] + ny, b[1] + nz),
              (b[0] - ny, b[1] - nz), (a[0] - ny, a[1] - nz))
    bm = bmesh.new()
    lados = [[bm.verts.new((x, y, z)) for y, z in perfil]
             for x in (-largura / 2, largura / 2)]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((lados[0][i], lados[0][j], lados[1][j], lados[1][i]))
    bm.faces.new(list(reversed(lados[0])))
    bm.faces.new(lados[1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = C.obj_de_bmesh(bm, nome)
    C.aplicar(obj, mat)
    return obj


def carro(m, nome="via_carro"):
    """Veiculo a frente. E o que o motorista olha o trajeto inteiro.

    Era duas caixas empilhadas com um retangulo de vidro em pe: lia como
    caminhonete de brinquedo. O que mudou: capo e porta-malas separados do
    habitaculo (um carro tem tres volumes, nao dois), vidros inclinados,
    colunas pretas em volta das janelas, rodas maiores com calota e para-choque
    marcado. Continua sem detalhe fino de proposito — ele passa a 30 km/h.
    """
    pecas = []
    pintura = C.mat_simples("via_carro_pintura", (0.195, 0.062, 0.048),
                            rugosidade=0.22)
    vidro = C.mat_simples("via_carro_vidro", (0.018, 0.022, 0.028),
                          rugosidade=0.10)
    preto = C.mat_simples("via_carro_preto", (0.016, 0.016, 0.018),
                          rugosidade=0.50)
    pneu = C.mat_simples("via_pneu", (0.018, 0.018, 0.020), rugosidade=0.92)

    # a traseira do carro fica em +Y (de frente para quem vem atras)
    corpo = C.caixa(f"{nome}_corpo", (1.76, 4.34, 0.74), (0, 0, 0.62))
    C.chanfrar(corpo, largura=0.07, segmentos=3)
    C.aplicar(corpo, pintura)
    pecas.append(corpo)

    # habitaculo: mais estreito e mais curto que o corpo, e RECUADO — e esse
    # degrau que faz os tres volumes aparecerem na silhueta
    teto = C.caixa(f"{nome}_teto", (1.56, 1.92, 0.50), (0, -0.14, 1.23))
    C.chanfrar(teto, largura=0.12, segmentos=3)
    C.aplicar(teto, pintura)
    pecas.append(teto)

    # para-brisa (para -Y) e vigia (para +Y), ambos deitados
    pecas.append(_vidraca(f"{nome}_vigia", (0.82, 1.44), (1.18, 1.00),
                          1.48, vidro))
    pecas.append(_vidraca(f"{nome}_parabrisa", (-1.10, 1.44), (-1.56, 1.00),
                          1.44, vidro))
    for lado in (-1, 1):
        jan = C.caixa(f"{nome}_janela_{lado}", (0.05, 1.74, 0.40),
                      (lado * 0.785, -0.14, 1.26))
        C.aplicar(jan, vidro)
        pecas.append(jan)

    for dy, alt in ((2.17, 0.30), (-2.17, 0.34)):
        choque = C.caixa(f"{nome}_choque_{dy:+.1f}", (1.74, 0.14, alt),
                         (0, dy, 0.42))
        C.chanfrar(choque, largura=0.04, segmentos=2)
        C.aplicar(choque, preto)
        pecas.append(choque)

    for lado in (-1, 1):
        luz = C.caixa(f"{nome}_luz_{lado}", (0.42, 0.07, 0.17),
                      (lado * 0.60, 2.16, 0.82))
        C.aplicar(luz, C.mat_simples("via_lanterna", (0.42, 0.030, 0.022),
                                     rugosidade=0.25))
        pecas.append(luz)
        for dy in (-1.42, 1.38):
            # caixa de roda: sem ela o pneu nasce de uma lateral lisa
            arco = C.caixa(f"{nome}_arco_{lado}_{dy:+.1f}", (0.10, 0.84, 0.50),
                           (lado * 0.84, dy, 0.42))
            C.aplicar(arco, preto)
            pecas.append(arco)
            roda = C.cilindro(f"{nome}_roda_{lado}_{dy:+.1f}", 0.34, 0.22,
                              (lado * 0.80, dy, 0.34), segmentos=14,
                              rot=(0, math.radians(90), 0))
            C.aplicar(roda, pneu)
            pecas.append(roda)
            calota = C.cilindro(f"{nome}_calota_{lado}_{dy:+.1f}", 0.21, 0.04,
                                (lado * 0.90, dy, 0.34), segmentos=12,
                                rot=(0, math.radians(90), 0))
            C.aplicar(calota, m["metal"])
            pecas.append(calota)
    return C.juntar(pecas, nome)


# ------------------------------------------------- peças de decisão (rodada 2)
#
# As três peças abaixo existem porque o trajeto era uma reta com cinco
# acontecimentos e o cliente achou "longo e monotono". Cada uma e uma DECISAO
# de conducao, nao enfeite: semaforo (parar no amarelo), onibus escolar em
# embarque (reduzir) e ciclista na pista (nao ultrapassar sem folga).
#
# Lembrete de eixo: o veiculo aponta para -Y, entao quem vem dirigindo olha
# destas pecas o lado +Y. E para +Y que a lente do semaforo e a traseira do
# onibus tem de apontar.

def _mat_luz(nome, cor, forca=1.0):
    """Material que ACENDE. O jogo troca a intensidade por lampada."""
    mat = bpy.data.materials.new(nome)
    mat.use_nodes = True
    b = C._principled(mat)
    C._set(b, "Base Color", (*cor, 1.0))
    C._set(b, "Roughness", 0.32)
    # o nome da entrada mudou entre versoes do Blender; _set ignora o ausente
    C._set(b, "Emission Color", (*cor, 1.0))
    C._set(b, "Emission", (*cor, 1.0))
    C._set(b, "Emission Strength", forca)
    return mat


def semaforo(m, nome="via_semaforo"):
    """Semaforo de braco projetado sobre a faixa.

    As tres lentes NAO entram no juntar: elas ficam como objetos proprios,
    filhos do poste, porque o jogo precisa acender uma e apagar as outras
    pelo nome. Juntar aqui apagaria essa separacao.
    """
    pecas = []
    poste = C.cilindro(f"{nome}_poste", 0.075, 6.0, (0, 0, 3.0), segmentos=12)
    C.aplicar(poste, m["metal"])
    pecas.append(poste)

    base = C.cilindro(f"{nome}_base", 0.16, 0.30, (0, 0, 0.15), segmentos=12)
    C.aplicar(base, m["concreto"])
    pecas.append(base)

    # o braco atravessa a faixa do motorista: a peca e colocada na borda e a
    # cabeca tem de ficar sobre a pista, que e onde o olho procura
    braco = C.cilindro(f"{nome}_braco", 0.055, 3.3, (1.65, 0, 5.75),
                       segmentos=10, rot=(0, math.radians(90), 0))
    C.aplicar(braco, m["metal"])
    pecas.append(braco)

    escora = C.barra(f"{nome}_escora", (0.0, 0.0, 4.9), (1.5, 0.0, 5.72),
                     secao=(0.07, 0.05))
    C.aplicar(escora, m["metal"])
    pecas.append(escora)

    caixa_cor = C.mat_simples("via_semaforo_caixa", (0.020, 0.022, 0.024),
                              rugosidade=0.55)
    cabeca = C.caixa(f"{nome}_cabeca", (0.38, 0.32, 1.14), (3.05, 0, 5.08))
    C.chanfrar(cabeca, largura=0.02, segmentos=2)
    C.aplicar(cabeca, caixa_cor)
    pecas.append(cabeca)

    # As lentes entram no MESMO objeto, cada uma com material proprio. A
    # primeira versao as deixava como objetos filhos, para o jogo acende-las
    # pelo nome do no — mas o parentesco nao sobreviveu ao glTF: elas sairam
    # como irmas na raiz da cena, e a copia que o jogo instancia levava so o
    # poste. Juntas, o jogo acende pelo nome do MATERIAL, que e estavel.
    for cor_nome, cor, dz in (
        ("vermelha", (0.72, 0.045, 0.030), 0.34),
        ("amarela",  (0.78, 0.46, 0.040), 0.00),
        ("verde",    (0.055, 0.62, 0.26), -0.34),
    ):
        # a lente sobra 4 cm da caixa para nao ser comida pelo corpo
        lente = C.cilindro(f"{nome}_luz_{cor_nome}", 0.115, 0.07,
                           (3.05, 0.195, 5.08 + dz), segmentos=16,
                           rot=(math.radians(90), 0, 0))
        C.aplicar(lente, _mat_luz(f"via_semaforo_{cor_nome}", cor))
        pecas.append(lente)

        # pala curta: a de 16 cm comia a lente no angulo de quem olha de baixo
        pala = C.cilindro(f"{nome}_pala_{cor_nome}", 0.150, 0.09,
                          (3.05, 0.27, 5.08 + dz), segmentos=16, tampas=False,
                          rot=(math.radians(90), 0, 0))
        C.aplicar(pala, caixa_cor)
        pecas.append(pala)

    return C.juntar(pecas, nome)


def onibus(m, nome="via_onibus"):
    """Onibus escolar parado em embarque, encostado na direita."""
    pecas = []
    amarelo = C.mat_simples("via_onibus_pintura", (0.62, 0.42, 0.045),
                            rugosidade=0.30)
    preto = C.mat_simples("via_onibus_faixa", (0.022, 0.022, 0.024),
                          rugosidade=0.45)
    vidro = C.mat_simples("via_onibus_vidro", (0.020, 0.026, 0.034),
                          rugosidade=0.12)

    # chanfro GORDO: 8 cm numa caixa de 2,4 m some, e o onibus ficava um
    # tijolo. 24 cm arredonda o canto o bastante para ler como carroceria
    corpo = C.caixa(f"{nome}_corpo", (2.42, 8.60, 2.10), (0, 0, 1.52))
    C.chanfrar(corpo, largura=0.24, segmentos=4)
    C.aplicar(corpo, amarelo)
    pecas.append(corpo)

    # para-brisa e painel de destino: e a frente que diz que e um onibus
    frente = C.caixa(f"{nome}_parabrisa", (2.10, 0.07, 0.86), (0, -4.29, 2.02))
    C.aplicar(frente, vidro)
    pecas.append(frente)
    destino = C.caixa(f"{nome}_destino", (1.30, 0.06, 0.26), (0, -4.31, 2.62))
    C.aplicar(destino, preto)
    pecas.append(destino)
    for lado in (-1, 1):
        espelho = C.caixa(f"{nome}_espelho_{lado}", (0.10, 0.08, 0.42),
                          (lado * 1.42, -4.18, 2.30))
        C.aplicar(espelho, preto)
        pecas.append(espelho)

    # a faixa preta e o que identifica o escolar a distancia
    for dz in (2.26, 0.86):
        faixa = C.caixa(f"{nome}_faixa_{dz:.2f}", (2.46, 8.64, 0.17), (0, 0, dz))
        C.aplicar(faixa, preto)
        pecas.append(faixa)

    # janelas: uma fita de cada lado e a traseira
    for lado in (-1, 1):
        jan = C.caixa(f"{nome}_janela_{lado}", (0.06, 7.20, 0.80),
                      (lado * 1.21, -0.2, 1.92))
        C.aplicar(jan, vidro)
        pecas.append(jan)
    tras = C.caixa(f"{nome}_vidro_tras", (1.90, 0.06, 0.74), (0, 4.31, 1.95))
    C.aplicar(tras, vidro)
    pecas.append(tras)

    for lado in (-1, 1):
        luz = C.caixa(f"{nome}_luz_{lado}", (0.30, 0.06, 0.22),
                      (lado * 0.88, 4.32, 0.92))
        C.aplicar(luz, C.mat_simples("via_onibus_lanterna", (0.52, 0.035, 0.026),
                                     rugosidade=0.25))
        pecas.append(luz)
        for dy in (-2.9, 2.6):
            roda = C.cilindro(f"{nome}_roda_{lado}_{dy:+.1f}", 0.44, 0.26,
                              (lado * 1.02, dy, 0.44), segmentos=14,
                              rot=(0, math.radians(90), 0))
            C.aplicar(roda, C.mat_simples("via_pneu", (0.018, 0.018, 0.020),
                                          rugosidade=0.92))
            pecas.append(roda)

    # placa de PARE do escolar, aberta do lado do motorista que ultrapassa
    braco = C.caixa(f"{nome}_pare_braco", (0.70, 0.06, 0.06), (-1.55, -1.2, 1.35))
    C.aplicar(braco, preto)
    pecas.append(braco)
    # A placa de PARE e OITAVADA — e a forma que a identifica a distancia,
    # antes de qualquer letra. Com as faces laterais suavizadas ela saia
    # redonda no render, uma bola vermelha espetada num pau.
    for raio, esp, dx, cor in ((0.32, 0.030, -2.00, (0.72, 0.70, 0.66)),
                               (0.27, 0.034, -2.01, (0.58, 0.045, 0.035))):
        p = C.cilindro(f"{nome}_pare_{raio:.2f}", raio, esp, (dx, -1.2, 1.35),
                       segmentos=8, rot=(math.radians(90), 0, 0))
        for f in p.data.polygons:
            f.use_smooth = False
        C.aplicar(p, C.mat_simples(f"via_onibus_pare_{raio:.2f}", cor,
                                   rugosidade=0.40))
        pecas.append(p)

    return C.juntar(pecas, nome)


def ciclista(m, nome="via_ciclista"):
    """Ciclista pedalando no sentido do trajeto, junto a borda."""
    pecas = []
    quadro_cor = C.mat_simples("via_bike_quadro", (0.085, 0.24, 0.32),
                               rugosidade=0.35, metalico=0.6)
    pneu = C.mat_simples("via_pneu", (0.018, 0.018, 0.020), rugosidade=0.92)
    roupa = C.mat_simples("via_ciclista_roupa", (0.46, 0.20, 0.055),
                          rugosidade=0.78)
    pele = C.mat_simples("via_ciclista_pele", (0.30, 0.19, 0.13),
                         rugosidade=0.70)

    for dy in (-0.52, 0.52):
        roda = C.cilindro(f"{nome}_roda_{dy:+.2f}", 0.34, 0.052, (0, dy, 0.34),
                          segmentos=16, rot=(0, math.radians(90), 0))
        C.aplicar(roda, pneu)
        pecas.append(roda)
        # aro claro: o pneu preto sozinho sumia contra o asfalto, e e a roda
        # que diz que aquilo na pista e uma bicicleta e nao um pedestre
        aro = C.cilindro(f"{nome}_aro_{dy:+.2f}", 0.28, 0.030, (0, dy, 0.34),
                         segmentos=16, rot=(0, math.radians(90), 0))
        C.aplicar(aro, C.mat_simples("via_bike_aro", (0.38, 0.39, 0.40),
                                     rugosidade=0.30, metalico=0.9))
        pecas.append(aro)

    for a, b in (((0, -0.52, 0.34), (0, 0.10, 0.62)),
                 ((0, 0.52, 0.34), (0, 0.10, 0.62)),
                 ((0, 0.10, 0.62), (0, -0.40, 0.95)),
                 ((0, -0.52, 0.34), (0, -0.40, 0.95))):
        barra = C.barra(f"{nome}_quadro_{a[1]:+.2f}_{b[1]:+.2f}", a, b,
                        secao=(0.035, 0.035))
        C.aplicar(barra, quadro_cor)
        pecas.append(barra)

    guidao = C.caixa(f"{nome}_guidao", (0.46, 0.05, 0.05), (0, -0.40, 0.98))
    C.aplicar(guidao, quadro_cor)
    pecas.append(guidao)

    selim = C.caixa(f"{nome}_selim", (0.11, 0.30, 0.06), (0, 0.17, 0.95))
    C.chanfrar(selim, largura=0.03, segmentos=2)
    C.aplicar(selim, C.mat_simples("via_bike_selim", (0.025, 0.025, 0.028),
                                   rugosidade=0.45))
    pecas.append(selim)

    # refletor traseiro: e o UNICO ponto vermelho da peca e e por ele que o
    # motorista enxerga o ciclista antes de enxergar o ciclista
    refletor = C.caixa(f"{nome}_refletor", (0.09, 0.03, 0.06), (0, 0.44, 0.74))
    C.aplicar(refletor, C.mat_simples("via_bike_refletor", (0.52, 0.045, 0.030),
                                      rugosidade=0.20))
    pecas.append(refletor)

    tronco = C.caixa(f"{nome}_tronco", (0.36, 0.26, 0.58), (0, -0.02, 1.26),
                     rot=(math.radians(-18), 0, 0))
    C.chanfrar(tronco, largura=0.04, segmentos=2)
    C.aplicar(tronco, roupa)
    pecas.append(tronco)

    cabeca = C.caixa(f"{nome}_cabeca", (0.20, 0.22, 0.24), (0, -0.19, 1.63))
    C.chanfrar(cabeca, largura=0.05, segmentos=3)
    C.aplicar(cabeca, pele)
    pecas.append(cabeca)

    capacete = C.caixa(f"{nome}_capacete", (0.23, 0.25, 0.12), (0, -0.19, 1.73))
    C.chanfrar(capacete, largura=0.05, segmentos=3)
    C.aplicar(capacete, C.mat_simples("via_ciclista_capacete",
                                      (0.56, 0.52, 0.48), rugosidade=0.30))
    pecas.append(capacete)

    for lado in (-1, 1):
        perna = C.barra(f"{nome}_perna_{lado}", (lado * 0.11, 0.06, 1.00),
                        (lado * 0.11, -0.10, 0.52), secao=(0.12, 0.12))
        C.aplicar(perna, roupa)
        pecas.append(perna)
        braco = C.barra(f"{nome}_braco_{lado}", (lado * 0.15, -0.10, 1.42),
                        (lado * 0.18, -0.38, 1.00), secao=(0.09, 0.09))
        C.aplicar(braco, roupa)
        pecas.append(braco)

    return C.juntar(pecas, nome)
