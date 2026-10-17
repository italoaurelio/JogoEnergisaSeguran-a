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
    """Faixa de pedestre: barras paralelas ao sentido da via.

    DOIS defeitos consertados em 07/10, os dois achados dirigindo a fase:

    1. **Ela estava pintada fora da pista.** As barras comecavam em
       `BORDA_ESQ + 0,55` = 5,80 e iam ate 12,04 — e a pista acaba em
       BORDA_ESQ = 5,25. A faixa inteira ficava na grama, ao lado da estrada.
       Agora ela atravessa os 7 m de asfalto, de borda a borda.
    2. **3 mm de altura e invisivel.** Tinta a 0,003 do asfalto, vista de
       raspao a 50 m, briga por profundidade com a propria pista e pisca ou
       some. 12 mm resolve e continua sendo espessura de tinta na escala do
       jogo.
    """
    pecas = []
    # 9 barras de 44 cm com passo de 78 cm cobrem 6,68 m dos 7,0 da pista
    largo = BORDA_ESQ - BORDA_DIR
    passo = (largo - 0.44) / 8
    for i in range(9):
        x = BORDA_DIR + 0.22 + i * passo
        barra = C.caixa(f"{nome}_{i}", (0.44, 3.0, 0.012), (x, -1.5, 0.009))
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

    """
    A PLACA A-18, que faltava.

    "Quebra-mola sem placa? isso nem pode no Brasil" — e nao pode mesmo: o
    CTB exige sinalizacao de advertencia antes do dispositivo, e sem ela a
    lombada nao e legal nem justa. Num jogo que cobra conducao defensiva,
    uma lombada que aparece sem aviso ensina a decorar o trajeto em vez de
    ler a via.

    Losango amarelo em pe no acostamento direito, 30 m ANTES (y positivo e
    de onde o motorista vem), na altura em que placa de advertencia fica.
    """
    amarelo = C.mat_simples("via_placa_adv", (0.52, 0.34, 0.020),
                            rugosidade=0.55)
    poste_p = C.cilindro(f"{nome}_placa_poste", 0.035, 2.0,
                         (BORDA_DIR + 0.75, 30.0, 1.0), segmentos=8)
    C.aplicar(poste_p, m["metal"])
    pecas.append(poste_p)
    # losango: uma caixa girada 45 graus no proprio plano
    losango = C.caixa(f"{nome}_placa_face", (0.52, 0.05, 0.52),
                      (BORDA_DIR + 0.75, 29.97, 2.05),
                      rot=(0, math.radians(45), 0))
    C.chanfrar(losango, largura=0.015, segmentos=2)
    C.aplicar(losango, amarelo)
    pecas.append(losango)
    # o relevo preto do desenho: duas barras, que a 40 m leem como lombada
    for dz in (-0.07, 0.07):
        marca = C.caixa(f"{nome}_placa_marca_{dz:+.2f}", (0.26, 0.02, 0.05),
                        (BORDA_DIR + 0.75, 29.93, 2.05 + dz))
        C.aplicar(marca, C.mat_simples("via_placa_tinta", (0.020, 0.020, 0.022),
                                       rugosidade=0.6))
        pecas.append(marca)
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


def _membro(bm, no, raios, segmentos=8, fechar=True):
    """Membro INCLINADO: aneis perpendiculares ao proprio eixo.

    `no` = [(x, y, z), ...] e a linha do centro (ombro, cotovelo, pulso);
    `raios` = o raio em cada no. Entre dois nos o anel usa a bissetriz das
    duas direcoes, que e o que faz a dobra do cotovelo sair cheia em vez de
    estrangulada.

    `_loft` e `_tubo` cortam o membro em fatias HORIZONTAIS. Serve para
    tronco e perna em pe, nao serve para a coxa de quem pedala: ela e quase
    deitada, e a fatia horizontal nela vira uma elipse de meio metro — foi
    assim que o ciclista acabou com coxas de caixote. Aqui o anel acompanha
    o osso.
    """
    eixo = [Vector(a) for a in no]
    dirs = [(eixo[i + 1] - eixo[i]).normalized() for i in range(len(eixo) - 1)]
    aneis = []
    for i, c in enumerate(eixo):
        if i == 0:
            n = dirs[0]
        elif i == len(eixo) - 1:
            n = dirs[-1]
        else:
            n = (dirs[i - 1] + dirs[i]).normalized()
        # dois vetores quaisquer perpendiculares ao eixo
        u = n.cross(Vector((0, 0, 1)))
        if u.length < 1e-4:
            u = n.cross(Vector((1, 0, 0)))
        u.normalize()
        v = n.cross(u)
        r = raios[i]
        aneis.append([bm.verts.new(c + u * (math.cos(a) * r)
                                   + v * (math.sin(a) * r))
                      for a in (2 * math.pi * j / segmentos
                                for j in range(segmentos))])
    for k in range(len(aneis) - 1):
        A, B = aneis[k], aneis[k + 1]
        for i in range(segmentos):
            j = (i + 1) % segmentos
            bm.faces.new((A[i], A[j], B[j], B[i]))
    if fechar:
        bm.faces.new(list(reversed(aneis[0])))
        bm.faces.new(aneis[-1])
    return aneis


def _loft(bm, secoes, segmentos=8, fechar=True, giro=0.0):
    """Loft de aneis ELIPTICOS: `secoes` = [(x, y, z, rx, ry)], de baixo p/ cima.

    `_tubo` so faz secao circular, e e isso que faz tronco e membro lerem como
    cano — ou, quando feitos de caixa, como tabua. Gente e muito mais larga de
    ombro a ombro do que de peito a costas, e e essa razao que o olho usa para
    reconhecer um corpo antes de qualquer detalhe. A elipse custa exatamente o
    mesmo numero de poligonos que o circulo.

    As secoes sao HORIZONTAIS mesmo quando o membro e inclinado: a 20 m de
    distancia o cisalhamento nao aparece, e um loft orientado ao longo da
    tangente custaria matriz de rotacao por anel sem mudar um pixel.
    """
    aneis = []
    for x, y, z, rx, ry in secoes:
        anel = []
        for i in range(segmentos):
            a = 2 * math.pi * i / segmentos + giro
            anel.append(bm.verts.new(
                (x + math.cos(a) * rx, y + math.sin(a) * ry, z)))
        aneis.append(anel)
    for k in range(len(aneis) - 1):
        A, B = aneis[k], aneis[k + 1]
        for i in range(segmentos):
            j = (i + 1) % segmentos
            bm.faces.new((A[i], A[j], B[j], B[i]))
    if fechar:
        bm.faces.new(list(reversed(aneis[0])))
        bm.faces.new(aneis[-1])
    return aneis


def _roda_vazada(nome, r_ext, r_int, espessura, centro, mat, segmentos=16):
    """Aro VAZADO no plano YZ, eixo em X — roda de veiculo que corre em -Y.

    `C.cilindro` faz disco CHEIO. Era por isso que a roda da bicicleta saia no
    render uma bolacha preta: o aro claro estava modelado a 0,28 de raio,
    DENTRO de um pneu macico de 0,34, e nunca apareceu um pixel dele. Roda de
    bicicleta so le como roda quando se enxerga o chao atraves dela — e e a
    roda que diferencia o ciclista de um pedestre na pista.
    """
    bm = bmesh.new()
    cx, cy, cz = centro
    e = espessura / 2
    voltas = []
    for r, dx in ((r_ext, -e), (r_ext, e), (r_int, e), (r_int, -e)):
        voltas.append([bm.verts.new(
            (cx + dx, cy + math.cos(2 * math.pi * i / segmentos) * r,
             cz + math.sin(2 * math.pi * i / segmentos) * r))
            for i in range(segmentos)])
    for k in range(4):
        A, B = voltas[k], voltas[(k + 1) % 4]
        for i in range(segmentos):
            j = (i + 1) % segmentos
            bm.faces.new((A[i], A[j], B[j], B[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = C.obj_de_bmesh(bm, nome)
    C.suavizar(obj, 40)
    C.aplicar(obj, mat)
    return obj


def _fechar_bm(bm, nome, mat, pecas, suave=70):
    """recalc_face_normals + objeto + material + entra na lista. Tres linhas
    que se repetiam em toda peca nova; e a recalculada que nao pode faltar,
    porque o exportador liga backface culling em tudo e normal invertida vira
    buraco."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = C.obj_de_bmesh(bm, nome)
    if suave:
        C.suavizar(obj, suave)
    C.aplicar(obj, mat)
    pecas.append(obj)
    return obj


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
    passos = 12
    lados = 4
    # 4 cm de RAIO num condutor que na vida real tem 0,8. Nao e descuido:
    # com 1,8 cm o cabo ficava SUB-PIXEL a partir de uns 40 m e saia na tela
    # como LINHA PONTILHADA — um tracejado de pontos no ceu, que e o que
    # mais destoava do resto do cenario na captura da rua residencial. Fio
    # fino de verdade e fio que o antisserrilhado come. A espessura aqui e
    # escolhida pela leitura na tela, nao pelo catalogo do condutor.
    raio = 0.040
    # NO PLANO DOS ISOLADORES, e nao ao lado deles.
    #
    # Os isoladores de pino ficam em y = 0,12 (a cruzeta esta deslocada da
    # linha do poste), e o cabo corria em y = 0: media 12 cm passando ao
    # LADO do isolador, sem encostar. Visto da cabine o fio passava reto
    # pela cruzeta, que e o "nem estao conectados" do cliente.
    #
    # O z tambem sobe de altura-0,175 para altura-0,145: ali e o colarinho
    # do isolador, que e onde um condutor de verdade amarra.
    y_isolador = 0.12
    bm = bmesh.new()
    for dx in (-1.05, 0.0, 1.05):
        aneis = []
        for i in range(passos + 1):
            t = i / passos
            y = y_isolador - comprimento * t
            z = altura - 0.145 - flecha * math.sin(math.pi * t)
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
    # CASCA (07/10). Era (0.135, 0.110, 0.082) — que sob o sol e o AgX saia um
    # bege ROSADO, uniforme da raiz ao colo: no render o tronco lia como um
    # poste de concreto pintado, nao como madeira. Casca de verdade e escura e
    # dessaturada, e nunca de um tom so: o lado que pega sol descasca claro e
    # o resto fica quase preto. Duas cores separadas por orientacao custam
    # zero triangulo e sao o que a via pode fazer (ruido procedural nao
    # exporta — ver `_pintar_por_normal`).
    escura = bpy.data.materials.get("via_casca") or C.mat_simples(
        "via_casca", (0.038, 0.031, 0.025), rugosidade=0.95)
    clara = bpy.data.materials.get("via_casca_sol") or C.mat_simples(
        "via_casca_sol", (0.088, 0.072, 0.052), rugosidade=0.92)
    tronco.data.materials.clear()
    tronco.data.materials.append(escura)
    tronco.data.materials.append(clara)
    for p in tronco.data.polygons:
        # faces viradas para o mesmo quadrante do sol da prova (-X, +Y)
        p.material_index = 1 if (-0.62 * p.normal.x + 0.78 * p.normal.y
                                 + 0.3 * p.normal.z) > 0.32 else 0
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
    """Moita de beira: massas de alturas diferentes, nao um disco.

    A versao antiga era UMA icosfera achatada: de perfil lia como uma pedra
    lisa plantada no mato. A de tres massas, medida no render de 07/10, ainda
    lia como pedra — porque as tres eram BAIXAS (1,1 m no total) e larguinhas,
    e o olho le massa larga-e-baixa como pedra independentemente da cor.

    Duas mudancas: a moita ficou VERTICAL (1,75 m de alto, 1,5 de largura, que
    e proporcao de arbusto de calcada e nao de pedra) e ganhou dois ramos
    secos saindo do topo — e a ponta irregular saindo do volume que separa
    vegetacao de mineral na silhueta.
    """
    pecas = []
    bm = bmesh.new()
    for i, (dx, dy, rz, rr) in enumerate(((0.00, 0.00, 0.62, 0.56),
                                          (-0.34, 0.16, 0.95, 0.44),
                                          (0.30, -0.18, 1.12, 0.40),
                                          (0.08, 0.26, 0.52, 0.38),
                                          (-0.14, -0.22, 1.38, 0.30),
                                          (0.36, 0.12, 0.72, 0.33))):
        _bolha(bm, (dx, dy, rz), rr, achatado=0.86,
               semente=semente * 13 + i, u=8, v=5, aspero=0.34)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = C.obj_de_bmesh(bm, nome + "_massa")
    C.suavizar(obj, 70)
    _pintar_por_normal(obj, _mats_folha())
    pecas.append(obj)

    bm = bmesh.new()
    _tubo(bm, [(0, 0, 0.00, 0.075), (0.02, 0.01, 0.42, 0.048),
               (0.05, 0.02, 0.80, 0.030)], segmentos=5, topo=True)
    for ang in (1.1, 4.0):
        dx, dy = math.cos(ang), math.sin(ang)
        _tubo(bm, [(0.05, 0.02, 0.72, 0.030),
                   (0.05 + dx * 0.22, 0.02 + dy * 0.22, 1.24, 0.020),
                   (0.05 + dx * 0.40, 0.02 + dy * 0.40, 1.62, 0.012)],
              segmentos=4, topo=True)
    _fechar_bm(bm, nome + "_ramo",
               bpy.data.materials.get("via_casca")
               or C.mat_simples("via_casca", (0.038, 0.031, 0.025),
                                rugosidade=0.95), pecas, suave=50)
    alvo = C.juntar(pecas, nome)
    alvo.name = nome
    return alvo


# Tres casas, nao uma.
#
# A casa aparece ate 40 vezes na tela ao mesmo tempo (ver POOL em
# paisagem.ts) e o jogo CLONA a mesma malha: clone de three.js compartilha o
# material, entao nao ha como variar cor por copia do lado do jogo. A unica
# variacao que sobrevive e a que vem de PECAS DIFERENTES no catalogo.
#
# Cada linha troca o que o olho percebe primeiro, nesta ordem: cor de parede,
# tipo de cobertura (duas aguas x laje com platibanda), cor de telha e tipo de
# fecho na frente (muro cheio x grade). Nao e cor aleatoria: sao tres casas de
# beira de estrada que existem de verdade, lado a lado, em qualquer rodovia do
# interior.
# TELHA NAO E PRETA.
#
# Medido no jogo: `via_telha_b` saia em #595856 e `via_telha_c` em #464445 —
# albedo 0,10 e 0,062. A essa distancia um telhado com albedo 0,06 nao le
# como telhado, le como BURACO no alto da casa, e foi isso que o cliente
# chamou duas vezes de "casa sem teto".
#
# Telha de fibrocimento envelhecida fica entre 0,16 e 0,24 de albedo; telha
# ceramica velha, entre 0,12 e 0,20. Os tres sobem para essa faixa.
CASAS = (
    dict(parede=(0.255, 0.238, 0.205), barra=(0.125, 0.118, 0.105),
         telha=(0.205, 0.082, 0.052), teto="duas_aguas", cxa=True,
         fecho="muro", altura=2.90),
    dict(parede=(0.145, 0.185, 0.200), barra=(0.072, 0.092, 0.100),
         telha=(0.188, 0.182, 0.168), teto="platibanda", cxa=True,
         fecho="grade", altura=3.15),
    dict(parede=(0.310, 0.225, 0.190), barra=(0.165, 0.112, 0.090),
         telha=(0.158, 0.150, 0.142), teto="duas_aguas", cxa=False,
         fecho="muro", altura=2.70),
)


def casa(m, nome="via_casa", largura=7.5, fundo=8.0, altura=None, variante=0):
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

    07/10, duas coisas novas:

      4. `variante` escolhe uma das tres linhas de `CASAS`. Sao peças
         separadas no catalogo (`via_casa`, `via_casa_b`, `via_casa_c`) porque
         o jogo clona a malha e o clone divide o material — variar cor por
         copia do lado do three.js nao da.
      5. FUNDOS. Metade das casas da fase e colocada com `giro: Math.PI`, ou
         seja o motorista ve as COSTAS delas, e as costas eram uma parede cega
         de 7,5 x 2,9 m. Agora tem porta de servico, janelinha de banheiro e
         tanque — e e o fundo que fica em cena pelo lado esquerdo inteiro.

    ~900 triangulos por variante.
    """
    cfg = CASAS[variante % len(CASAS)]
    altura = altura if altura is not None else cfg["altura"]
    sufm = ("", "_b", "_c")[variante % 3]
    pecas = []
    parede = C.mat_simples(f"via_parede{sufm}", cfg["parede"], rugosidade=0.90)
    barra_cor = C.mat_simples(f"via_parede_barra{sufm}", cfg["barra"],
                              rugosidade=0.92)
    telha = C.mat_simples(f"via_telha{sufm}", cfg["telha"], rugosidade=0.88)
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
    meia = largura / 2 + aba
    cume = 1.30 if cfg["teto"] == "duas_aguas" else 0.52
    if cfg["teto"] == "duas_aguas":
        perfil = ((-meia, 0.0), (0.0, cume), (meia, 0.0),
                  (meia, -0.16), (0.0, cume - 0.16), (-meia, -0.16))
    else:
        # LAJE COM PLATIBANDA: o topo e reto e a parede sobe 52 cm acima dele,
        # escondendo a cobertura. E a outra metade das casas de beira de
        # estrada no Brasil, e a silhueta reta e o contraste mais forte que
        # existe contra a fileira de triangulos da variante de duas aguas.
        perfil = ((-meia, 0.0), (-meia, cume), (meia, cume), (meia, 0.0),
                  (meia - 0.16, 0.0), (meia - 0.16, cume - 0.14),
                  (-meia + 0.16, cume - 0.14), (-meia + 0.16, 0.0))
    bm = bmesh.new()
    y0, y1 = aba, -fundo - aba
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
    # O exportador liga `use_backface_culling` em TODO material. Face com
    # normal para dentro vira buraco: era o "teto meio transparente" — via-se
    # o ceu atraves da agua do telhado. Recalcular antes de virar objeto.
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

    if cfg["teto"] == "duas_aguas":
        """
        O OITAO — a parede triangular que fecha a ponta do telhado.

        Ela NUNCA existiu. O telhado e uma casca em Λ de 16 cm de espessura,
        nao um solido: entre o topo da parede (reta) e a agua do telhado
        (inclinada) sobra um vao triangular, e esse vao estava ABERTO dos dois
        lados. Da rua via-se por baixo do beiral e saia pelo outro lado —
        "a casa e um retangulo, e o telhado e um triangulo, a parte triangular
        da parede que devia chegar no telhado ta faltando".

        E por isso que o render de conferencia nunca mostrou: nas vistas de
        frente e de tres quartos o proprio telhado tapa o buraco. So aparece
        de quem passa rente, que e exatamente o ponto de vista do jogo.

        O contorno acompanha a face de BAIXO do telhado, nao a de cima, senao
        o oitao atravessaria a telha. E desce 20 cm abaixo do topo da parede,
        para a junta ficar dentro do volume e nao virar costura.
        """
        L = largura / 2
        # altura da face inferior do telhado na vertical da parede
        z_beira = (cume - 0.16) - (L / meia) * cume
        contorno = ((-L, -0.20), (-L, z_beira), (0.0, cume - 0.14),
                    (L, z_beira), (L, -0.20))
        espessura_oitao = 0.14
        for face_y, dentro in ((0.0, -espessura_oitao),
                               (-fundo, espessura_oitao)):
            bm = bmesh.new()
            lados = []
            for y in (face_y, face_y + dentro):
                lados.append([bm.verts.new((x, y, z + altura))
                              for x, z in contorno])
            n = len(contorno)
            for i in range(n):
                j = (i + 1) % n
                bm.faces.new((lados[0][i], lados[0][j],
                              lados[1][j], lados[1][i]))
            bm.faces.new(lados[0])
            bm.faces.new(list(reversed(lados[1])))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            oitao = C.obj_de_bmesh(bm, f"{nome}_oitao_{'f' if face_y == 0 else 't'}")
            C.aplicar(oitao, parede)
            pecas.append(oitao)
    if cfg["teto"] == "platibanda":
        # a laje que a platibanda esconde do lado; vista de cima ela aparece
        laje = C.caixa(f"{nome}_laje", (largura + 0.4, fundo + 0.4, 0.12),
                       (0, -fundo / 2, altura + 0.18))
        C.aplicar(laje, C.mat_simples("via_casa_laje", (0.118, 0.115, 0.108),
                                      rugosidade=0.92))
        pecas.append(laje)

    # caixa d'agua sobre a laje dos fundos: 20 triangulos que tiram a
    # silhueta do triangulo perfeito
    if cfg["cxa"]:
        zc = altura + cume + (0.10 if cfg["teto"] == "duas_aguas" else -0.14)
        px, py = largura * 0.22, -fundo * 0.72
        # base de alvenaria, nao um pedestal fino: com o pe de 5,5 cm a caixa
        # d'agua saia no render um abajur em cima do telhado
        pe = C.caixa(f"{nome}_cxa_base", (0.70, 0.70, 0.66), (px, py, zc - 0.60))
        C.aplicar(pe, parede)
        pecas.append(pe)
        tq = C.cilindro(f"{nome}_caixa_dagua", 0.46, 0.62, (px, py, zc),
                        segmentos=10)
        C.aplicar(tq, C.mat_simples("via_caixa_dagua", (0.105, 0.115, 0.125),
                                    rugosidade=0.72))
        pecas.append(tq)
        tampa = C.cilindro(f"{nome}_cxa_tampa", 0.24, 0.07, (px, py, zc + 0.33),
                           segmentos=8)
        C.aplicar(tampa, C.mat_simples("via_caixa_dagua_tampa",
                                       (0.055, 0.060, 0.068), rugosidade=0.70))
        pecas.append(tampa)

    # FUNDOS. Metade das casas entra em cena girada 180 graus e o que o
    # motorista ve e esta face; era uma parede cega.
    # y cresce para a FRENTE: o fundo da casa esta em y = -fundo, e o quintal
    # fica ainda mais negativo que isso.
    fy = -fundo
    quintal = C.caixa(f"{nome}_tanque", (0.90, 0.55, 0.85),
                      (-largura * 0.28, fy - 0.30, 0.42))
    C.chanfrar(quintal, largura=0.03, segmentos=2)
    C.aplicar(quintal, C.mat_simples("via_casa_tanque", (0.330, 0.325, 0.305),
                                     rugosidade=0.80))
    pecas.append(quintal)
    # telheiro da area de servico: 1,7 m de abano em caimento, sobre dois
    # pilares. Sao os dois pilares finos que quebram a parede cega do fundo.
    telheiro = C.caixa(f"{nome}_telheiro", (largura * 0.62, 1.80, 0.10),
                       (-largura * 0.14, fy - 0.88, 2.20),
                       rot=(math.radians(-7), 0, 0))
    C.aplicar(telheiro, telha)
    pecas.append(telheiro)
    for dx in (-largura * 0.42, largura * 0.12):
        pil = C.caixa(f"{nome}_telheiro_pil_{dx:+.1f}", (0.11, 0.11, 2.12),
                      (dx, fy - 1.68, 1.06))
        C.aplicar(pil, parede)
        pecas.append(pil)

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
    # fundos: porta de servico e janelinha de banheiro (as casas giradas 180
    # graus mostram esta face, e so esta)
    abertura("porta_fundo", (largura * 0.12, fy - 0.02, 1.05), (0.88, 2.02))
    abertura("jan_fundo", (-largura * 0.30, fy - 0.02, 1.86), (0.70, 0.62))

    portao_cor = C.mat_simples("via_casa_portao", (0.085, 0.095, 0.105),
                               rugosidade=0.45, metalico=0.7)
    if cfg["fecho"] == "muro":
        # muro com pilaretes e portao: muro liso e outra caixa
        muro = C.caixa(f"{nome}_muro", (largura + 1.0, 0.16, 1.35),
                       (0, 1.3, 0.675))
        C.aplicar(muro, m["concreto"])
        pecas.append(muro)
        portao = C.caixa(f"{nome}_portao", (2.30, 0.07, 1.40), (0, 1.3, 0.70))
        C.aplicar(portao, portao_cor)
        pecas.append(portao)
    else:
        # GRADE sobre mureta: deixa ver o terreno atras, e e o vazado que
        # distingue esta casa da vizinha a 40 m — muro cheio e muro cheio,
        # nao importa a cor.
        mureta = C.caixa(f"{nome}_mureta", (largura + 1.0, 0.18, 0.52),
                         (0, 1.3, 0.26))
        C.aplicar(mureta, m["concreto"])
        pecas.append(mureta)
        n_barras = 22
        for i in range(n_barras):
            x = -(largura + 0.7) / 2 + (largura + 0.7) * i / (n_barras - 1)
            b = C.caixa(f"{nome}_grade_{i}", (0.045, 0.045, 1.00),
                        (x, 1.3, 1.02))
            C.aplicar(b, portao_cor)
            pecas.append(b)
        trav = C.caixa(f"{nome}_grade_trav", (largura + 0.8, 0.06, 0.07),
                       (0, 1.3, 1.49))
        C.aplicar(trav, portao_cor)
        pecas.append(trav)
    for dx in (-1, 1):
        pil = C.caixa(f"{nome}_pilar_{dx}", (0.30, 0.30, 1.62),
                      (dx * (largura + 1.0) / 2, 1.3, 0.81))
        C.chanfrar(pil, largura=0.02, segmentos=2)
        C.aplicar(pil, m["concreto"])
        pecas.append(pil)
    return C.juntar(pecas, nome)


def casa_b(m, nome="via_casa_b"):
    """Casa de laje com platibanda e grade. Ver `CASAS`."""
    return casa(m, nome=nome, variante=1)


def casa_c(m, nome="via_casa_c"):
    """Casa baixa de telha escura, sem caixa d'agua. Ver `CASAS`."""
    return casa(m, nome=nome, variante=2, largura=6.8, fundo=7.2)


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

    """
    JANELA PARA FORA, e a de baixo acima do muro.

    Duas coisas erradas, e a segunda e pior:

     - a fita ficava com o centro em `-recuo + 0,02`, ou seja praticamente
       NO plano da parede: 7 cm de vidro saindo de uma parede de 9 m. Da rua
       lia como desenho na parede, nao como esquadria. Agora ela avanca 9 cm
       e ganha moldura, que e o que faz a sombra.
     - a fita de baixo estava em z 1,70 e o MURO tem 2,35 m. Ela nunca foi
       vista por ninguem: o motorista via parede cega de muro ate 2,35 e
       parede cega de predio de 2,35 a 3,10. "Vai ver parede o dia todo?"
    """
    y_face = -recuo + 0.09
    for z in (2.72, 3.86):
        vao = C.caixa(f"{nome}_janela_{int(z * 10)}", (modulo - 1.1, 0.12, 0.92),
                      (0, y_face, z))
        C.aplicar(vao, vidro)
        pecas.append(vao)
        # moldura em volta: sem ela o vidro e uma mancha escura flutuando
        moldura = C.caixa(f"{nome}_moldura_{int(z * 10)}",
                          (modulo - 0.88, 0.07, 1.10), (0, y_face - 0.04, z))
        C.aplicar(moldura, creme)
        pecas.append(moldura)
        peitoril = C.caixa(f"{nome}_peitoril_{int(z * 10)}",
                           (modulo - 0.8, 0.26, 0.12), (0, y_face, z - 0.60))
        C.aplicar(peitoril, faixa_cor)
        pecas.append(peitoril)

    alvo = C.juntar(pecas, nome)
    alvo.name = nome
    return alvo


def escola_portao(m, nome="via_escola_portao", modulo=10.0):
    """O MODULO DA ENTRADA: portao, guarita e a placa da escola.

    A escola inteira era o mesmo modulo de 10 m repetido — "sem porta, e
    todos do mesmo tamanho?". Ele esta certo: ninguem constroi uma escola
    sem entrada, e a entrada e justamente o lugar por onde a crianca sai
    para a faixa que o jogador tem de respeitar. Sem ela, o trecho escolar
    nao tem por que existir.

    Entra UMA VEZ na quadra, no meio — nao ladrilha.
    """
    pecas = []
    creme = C.mat_simples("via_escola_parede", (0.300, 0.285, 0.245),
                          rugosidade=0.90)
    faixa_cor = C.mat_simples("via_escola_faixa", (0.030, 0.105, 0.230),
                              rugosidade=0.86)
    grade = C.mat_simples("via_escola_grade", (0.045, 0.048, 0.052),
                          rugosidade=0.45, metalico=0.85)

    # pilares do portao
    for lado in (-1, 1):
        pil = C.caixa(f"{nome}_pilar_{lado}", (0.45, 0.45, 2.95),
                      (lado * 2.3, 0, 1.475))
        C.chanfrar(pil, largura=0.02, segmentos=2)
        C.aplicar(pil, creme)
        pecas.append(pil)
    # muro nos dois lados do portao, ate fechar o modulo
    for lado in (-1, 1):
        resto = (modulo / 2 - 2.52)
        mu = C.caixa(f"{nome}_muro_{lado}", (resto, 0.18, 2.35),
                     (lado * (2.52 + resto / 2), 0, 1.175))
        C.aplicar(mu, creme)
        pecas.append(mu)
        fa = C.caixa(f"{nome}_faixa_{lado}", (resto, 0.21, 0.42),
                     (lado * (2.52 + resto / 2), 0, 1.85))
        C.aplicar(fa, faixa_cor)
        pecas.append(fa)

    # grade do portao: barras verticais, que e o que se ve de uma escola
    for i in range(13):
        x = -2.05 + i * 0.342
        b = C.caixa(f"{nome}_barra_{i}", (0.055, 0.055, 2.30), (x, 0, 1.15))
        C.aplicar(b, grade)
        pecas.append(b)
    for z in (0.22, 2.22):
        trav = C.caixa(f"{nome}_trav_{int(z * 10)}", (4.30, 0.07, 0.10),
                       (0, 0, z))
        C.aplicar(trav, grade)
        pecas.append(trav)

    # placa sobre o portao
    placa = C.caixa(f"{nome}_placa", (3.40, 0.10, 0.62), (0, -0.10, 3.20))
    C.chanfrar(placa, largura=0.02, segmentos=2)
    C.aplicar(placa, faixa_cor)
    pecas.append(placa)

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


# QUATRO SILHUETAS, e nao quatro cores do mesmo carro.
#
# Cor ja variava (dez pinturas), e nao bastou: "os carros sao todos iguais"
# veio depois disso. Cor some a 60 m e contra o sol; SILHUETA nao. O que
# separa um carro de outro na retina, nessa ordem: comprimento, altura do
# teto e onde a cabine cai no corpo.
#
# Os quatro: sedan (tres volumes), hatch (curto, traseira cortada), picape
# (cabine a frente e cacamba aberta) e van (caixa alta). O `tipo=0` repete
# NUMERO POR NUMERO o carro que ja existia — assim um defeito que aparecer
# depois disto nao fica em duvida entre "mudou a forma" e "quebrou a peca".
CARROS = (
    dict(id="sedan", comp=4.34, larg=1.76, alt=0.74, z=0.62,
         teto=(1.56, 1.92, 0.50), ty=-0.14, tz=1.23,
         eixos=(-1.42, 1.38), cacamba=None),
    dict(id="hatch", comp=3.78, larg=1.68, alt=0.78, z=0.62,
         teto=(1.50, 1.98, 0.58), ty=-0.26, tz=1.28,
         eixos=(-1.20, 1.18), cacamba=None),
    dict(id="picape", comp=5.00, larg=1.86, alt=0.88, z=0.72,
         teto=(1.66, 1.46, 0.62), ty=-0.92, tz=1.50,
         eixos=(-1.62, 1.58), cacamba=(1.34, 0.46)),
    # A van nao e um sedan com uma caixinha em cima: o corpo dela JA e a
    # cabine. Com o teto curto e alto a primeira tentativa saiu com cara de
    # furgao com escotilha. Corpo mais baixo e estufa longa — que e o que faz
    # uma Kombi ser uma Kombi na silhueta.
    dict(id="van", comp=4.52, larg=1.84, alt=1.30, z=0.95,
         teto=(1.74, 2.60, 0.52), ty=-0.30, tz=1.86,
         eixos=(-1.42, 1.44), cacamba=None),
)


def carro(m, nome="via_carro", tipo=0):
    """Veiculo a frente. E o que o motorista olha o trajeto inteiro.

    Era duas caixas empilhadas com um retangulo de vidro em pe: lia como
    caminhonete de brinquedo. O que mudou: capo e porta-malas separados do
    habitaculo (um carro tem tres volumes, nao dois), vidros inclinados,
    colunas pretas em volta das janelas, rodas maiores com calota e para-choque
    marcado. Continua sem detalhe fino de proposito — ele passa a 30 km/h.

    `tipo` escolhe uma das quatro linhas de `CARROS`.
    """
    cfg = CARROS[tipo % len(CARROS)]
    pecas = []
    pintura = C.mat_simples("via_carro_pintura", (0.195, 0.062, 0.048),
                            rugosidade=0.22)
    vidro = C.mat_simples("via_carro_vidro", (0.018, 0.022, 0.028),
                          rugosidade=0.10)
    preto = C.mat_simples("via_carro_preto", (0.016, 0.016, 0.018),
                          rugosidade=0.50)
    pneu = C.mat_simples("via_pneu", (0.018, 0.018, 0.020), rugosidade=0.92)

    comp, larg, alt, z0 = cfg["comp"], cfg["larg"], cfg["alt"], cfg["z"]
    meia = comp / 2

    # a traseira do carro fica em +Y (de frente para quem vem atras)
    corpo = C.caixa(f"{nome}_corpo", (larg, comp, alt), (0, 0, z0))
    C.chanfrar(corpo, largura=0.07, segmentos=3)
    C.aplicar(corpo, pintura)
    pecas.append(corpo)

    # habitaculo: mais estreito e mais curto que o corpo, e RECUADO — e esse
    # degrau que faz os tres volumes aparecerem na silhueta
    tl, tc, ta = cfg["teto"]
    tz = cfg["tz"]
    teto = C.caixa(f"{nome}_teto", (tl, tc, ta), (0, cfg["ty"], tz))
    C.chanfrar(teto, largura=0.12, segmentos=3)
    C.aplicar(teto, pintura)
    pecas.append(teto)

    # para-brisa (para -Y) e vigia (para +Y), ambos deitados. Os dois saem da
    # CAIXA DO TETO, entao acompanham sozinhos cada silhueta.
    topo = tz + ta / 2 - 0.02
    base = tz - ta / 2 - 0.23
    tras, frente = cfg["ty"] + tc / 2, cfg["ty"] - tc / 2
    pecas.append(_vidraca(f"{nome}_vigia", (tras - 0.10, topo),
                          (tras + 0.36, base), tl - 0.12, vidro))
    pecas.append(_vidraca(f"{nome}_parabrisa", (frente + 0.14, topo),
                          (frente - 0.46, base), tl - 0.12, vidro))
    for lado in (-1, 1):
        jan = C.caixa(f"{nome}_janela_{lado}", (0.05, tc - 0.18, ta - 0.10),
                      (lado * (tl / 2 + 0.005), cfg["ty"], tz + 0.03))
        C.aplicar(jan, vidro)
        pecas.append(jan)

    for dy, alt_ch in ((meia + 0.0, 0.30), (-meia - 0.0, 0.34)):
        choque = C.caixa(f"{nome}_choque_{dy:+.1f}", (larg - 0.02, 0.14, alt_ch),
                         (0, dy, z0 - 0.20))
        C.chanfrar(choque, largura=0.04, segmentos=2)
        C.aplicar(choque, preto)
        pecas.append(choque)

    # CACAMBA da picape: dois costados e uma tampa, abertos em cima. E o que
    # separa picape de sedan quando os dois tem o mesmo comprimento.
    if cfg["cacamba"]:
        fundo_y, altura_c = cfg["cacamba"]
        for lado in (-1, 1):
            costado = C.caixa(f"{nome}_cacamba_{lado}",
                              (0.10, 2.10, altura_c),
                              (lado * (larg / 2 - 0.05), fundo_y,
                               z0 + alt / 2 + altura_c / 2))
            C.chanfrar(costado, largura=0.03, segmentos=2)
            C.aplicar(costado, pintura)
            pecas.append(costado)
        tampa = C.caixa(f"{nome}_cacamba_tampa", (larg - 0.06, 0.10, altura_c),
                        (0, fundo_y + 1.05, z0 + alt / 2 + altura_c / 2))
        C.chanfrar(tampa, largura=0.03, segmentos=2)
        C.aplicar(tampa, pintura)
        pecas.append(tampa)

    for lado in (-1, 1):
        luz = C.caixa(f"{nome}_luz_{lado}", (0.42, 0.07, 0.17),
                      (lado * 0.60, meia - 0.01, z0 + 0.20))
        C.aplicar(luz, C.mat_simples("via_lanterna", (0.42, 0.030, 0.022),
                                     rugosidade=0.25))
        pecas.append(luz)
        for dy in cfg["eixos"]:
            # caixa de roda: sem ela o pneu nasce de uma lateral lisa
            arco = C.caixa(f"{nome}_arco_{lado}_{dy:+.1f}", (0.10, 0.84, 0.50),
                           (lado * (larg / 2 - 0.04), dy, 0.42))
            C.aplicar(arco, preto)
            pecas.append(arco)
            roda = C.cilindro(f"{nome}_roda_{lado}_{dy:+.1f}", 0.34, 0.22,
                              (lado * (larg / 2 - 0.08), dy, 0.34), segmentos=14,
                              rot=(0, math.radians(90), 0))
            C.aplicar(roda, pneu)
            pecas.append(roda)
            calota = C.cilindro(f"{nome}_calota_{lado}_{dy:+.1f}", 0.21, 0.04,
                                (lado * (larg / 2 + 0.02), dy, 0.34), segmentos=12,
                                rot=(0, math.radians(90), 0))
            C.aplicar(calota, m["metal"])
            pecas.append(calota)
    return C.juntar(pecas, nome)


def carro_b(m, nome="via_carro_b"):
    return carro(m, nome=nome, tipo=1)


def carro_c(m, nome="via_carro_c"):
    return carro(m, nome=nome, tipo=2)


def carro_d(m, nome="via_carro_d"):
    return carro(m, nome=nome, tipo=3)


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

def moto(m, nome="via_moto"):
    """Moto com piloto, de frente para -Y, como o carro.

    O que importa numa peca que passa a 60 km/h e cruza em um segundo e meio:
    a SILHUETA. De frente, moto nao e a moto — e o piloto. Por isso o corpo
    dele e a peca maior aqui, e o farol unico no meio e o que diz "moto" antes
    de qualquer detalhe de motor.

    O piloto vai de capacete e colete refletivo: a moto do contrafluxo passa
    perto do para-brisa, e numa fase que avalia conducao vale o cenario
    mostrar o certo. ~380 triangulos.
    """
    pecas = []
    pintura = C.mat_simples("via_moto_pintura", (0.045, 0.085, 0.165),
                            rugosidade=0.25)
    preto = C.mat_simples("via_carro_preto", (0.016, 0.016, 0.018),
                          rugosidade=0.50)
    pneu = C.mat_simples("via_pneu", (0.018, 0.018, 0.020), rugosidade=0.92)
    colete = C.mat_simples("via_moto_colete", (0.62, 0.30, 0.02),
                           rugosidade=0.80)
    pele = C.mat_simples("via_moto_pele", (0.235, 0.165, 0.120),
                         rugosidade=0.72)

    # rodas: cilindro deitado no eixo X, que e o eixo do raio da roda
    metal_m = C.mat_simples("via_moto_metal", (0.42, 0.43, 0.45),
                            rugosidade=0.32, metalico=0.9)
    for y, r in ((-0.62, 0.30), (0.60, 0.30)):
        lado_n = 'd' if y < 0 else 't'
        roda = C.cilindro(f"{nome}_roda_{lado_n}", r, 0.11,
                          (0, y, r), segmentos=18,
                          rot=(0, math.pi / 2, 0))
        C.aplicar(roda, pneu)
        pecas.append(roda)
        # ARO e CUBO: sem eles a roda e um disco preto, e disco preto a 30 m
        # nao gira nem parece roda. O aro e o unico ponto claro do conjunto
        # embaixo, e e ele que marca o movimento.
        aro = C.cilindro(f"{nome}_aro_{lado_n}", r * 0.62, 0.125,
                         (0, y, r), segmentos=16, rot=(0, math.pi / 2, 0))
        C.aplicar(aro, metal_m)
        pecas.append(aro)
        cubo = C.cilindro(f"{nome}_cubo_{lado_n}", 0.055, 0.17,
                          (0, y, r), segmentos=10, rot=(0, math.pi / 2, 0))
        C.aplicar(cubo, preto)
        pecas.append(cubo)

    # quadro e tanque: uma cunha entre as rodas, estreita
    quadro = C.caixa(f"{nome}_quadro", (0.22, 1.10, 0.26), (0, 0.02, 0.62))
    C.chanfrar(quadro, largura=0.045, segmentos=2)
    C.aplicar(quadro, pintura)
    pecas.append(quadro)
    motor = C.caixa(f"{nome}_motor", (0.26, 0.42, 0.28), (0, 0.02, 0.40))
    C.chanfrar(motor, largura=0.035, segmentos=2)
    C.aplicar(motor, preto)
    pecas.append(motor)

    # carenagem dianteira com o FAROL: e o unico ponto claro no meio da
    # silhueta, e e por ele que se reconhece a moto de longe
    frente = C.caixa(f"{nome}_frente", (0.26, 0.20, 0.34), (0, -0.52, 0.86))
    C.chanfrar(frente, largura=0.05, segmentos=2)
    C.aplicar(frente, pintura)
    pecas.append(frente)
    farol = C.cilindro(f"{nome}_farol", 0.09, 0.05, (0, -0.63, 0.86),
                       segmentos=14, rot=(math.pi / 2, 0, 0))
    C.aplicar(farol, _mat_luz("via_moto_farol", (1.0, 0.94, 0.80), forca=3.0))
    pecas.append(farol)

    # guidao
    guidao = C.cilindro(f"{nome}_guidao", 0.022, 0.62, (0, -0.44, 1.06),
                        segmentos=10, rot=(0, math.pi / 2, 0))
    C.aplicar(guidao, preto)
    pecas.append(guidao)

    # RETROVISORES: dois pontos claros acima do guidao. Sao o que separa a
    # silhueta de uma moto da de uma bicicleta a 40 m.
    for lado in (-1, 1):
        haste = C.cilindro(f"{nome}_retro_haste_{lado}", 0.010, 0.16,
                           (lado * 0.30, -0.45, 1.14), segmentos=6)
        C.aplicar(haste, preto)
        pecas.append(haste)
        esp = C.caixa(f"{nome}_retro_{lado}", (0.10, 0.03, 0.07),
                      (lado * 0.32, -0.45, 1.22))
        C.chanfrar(esp, largura=0.012, segmentos=2)
        C.aplicar(esp, metal_m)
        pecas.append(esp)

    # GARFO dianteiro: a moto nascia com a roda da frente solta no ar
    for lado in (-1, 1):
        garfo = C.cilindro(f"{nome}_garfo_{lado}", 0.022, 0.72,
                           (lado * 0.085, -0.56, 0.62), segmentos=8,
                           rot=(math.radians(14), 0, 0))
        C.aplicar(garfo, metal_m)
        pecas.append(garfo)

    # paralama traseiro e lanterna
    paralama = C.caixa(f"{nome}_paralama", (0.20, 0.42, 0.07), (0, 0.66, 0.84))
    C.chanfrar(paralama, largura=0.03, segmentos=2)
    C.aplicar(paralama, pintura)
    pecas.append(paralama)
    lant = C.caixa(f"{nome}_lanterna", (0.12, 0.05, 0.07), (0, 0.86, 0.86))
    C.aplicar(lant, _mat_luz("via_moto_lanterna", (0.75, 0.06, 0.04), forca=1.4))
    pecas.append(lant)

    # escapamento: o cilindro baixo do lado direito
    escape = C.cilindro(f"{nome}_escape", 0.045, 0.72, (0.17, 0.30, 0.40),
                        segmentos=10, rot=(math.radians(96), 0, 0))
    C.aplicar(escape, metal_m)
    pecas.append(escape)

    # PILOTO. De frente, ele e a peca que se ve — por isso leva mais
    # poligono que a moto inteira.
    # mesmo tratamento do pedestre e do ciclista (07/10): o tronco era uma
    # caixa de 46 x 30 cm e, de frente, a moto E o piloto — a peca mais vista
    # da moto era a mais chapada dela.
    bm = bmesh.new()
    _loft(bm, [(0, 0.190, 0.93, 0.150, 0.105),   # quadril, no banco
               (0, 0.150, 1.06, 0.156, 0.108),
               (0, 0.100, 1.19, 0.170, 0.112),   # peito
               (0, 0.045, 1.34, 0.206, 0.115),   # ombro
               (0, 0.020, 1.43, 0.162, 0.096)], segmentos=10)
    for lado in (-1, 1):
        _loft(bm, [(lado * 0.195, 0.040, 1.345, 0.062, 0.062),
                   (lado * 0.205, -0.080, 1.300, 0.056, 0.056),
                   (lado * 0.210, -0.170, 1.255, 0.050, 0.050)], segmentos=8)
    _fechar_bm(bm, f"{nome}_tronco", colete, pecas)
    for lado in (-1, 1):
        # antebraco esticado ate o guidao, em pele: e a diagonal dos dois
        # bracos que diz, de frente, que ha alguem pilotando
        bm = bmesh.new()
        _loft(bm, [(lado * 0.208, -0.160, 1.258, 0.048, 0.048),
                   (lado * 0.215, -0.320, 1.165, 0.042, 0.042),
                   (lado * 0.220, -0.430, 1.075, 0.036, 0.036)], segmentos=8)
        _fechar_bm(bm, f"{nome}_antebraco_{lado}", pele, pecas)
        """
        A PERNA DO PILOTO DOBRA NO JOELHO.

        Era uma caixa de 16 x 40 x 18 cm pendurada no quadril: de perfil, uma
        tabua. Quem pilota fica com a coxa quase horizontal e a canela quase
        vertical, e e esse ZIGUE-ZAGUE que diz "montado" — sem ele o piloto
        parece sentado numa cadeira que por acaso tem rodas.

        Coxa e canela se sobrepoem no joelho, como na perna do pedestre: o
        volume fecha a junta e nao sobra costura.
        """
        bm = bmesh.new()
        _loft(bm, [(lado * 0.165, 0.185, 0.885, 0.085, 0.080),   # quadril
                   (lado * 0.185, 0.020, 0.830, 0.072, 0.070),
                   (lado * 0.200, -0.150, 0.790, 0.062, 0.060)], segmentos=8)
        _fechar_bm(bm, f"{nome}_coxa_{lado}", preto, pecas)
        bm = bmesh.new()
        _loft(bm, [(lado * 0.200, -0.120, 0.810, 0.060, 0.058),  # joelho
                   (lado * 0.205, -0.090, 0.600, 0.054, 0.052),
                   (lado * 0.205, -0.060, 0.400, 0.048, 0.046)], segmentos=8)
        _fechar_bm(bm, f"{nome}_canela_{lado}", preto, pecas)
        pe = C.caixa(f"{nome}_pe_{lado}", (0.10, 0.24, 0.07),
                     (lado * 0.205, -0.090, 0.355))
        C.chanfrar(pe, largura=0.02, segmentos=2)
        C.aplicar(pe, preto)
        pecas.append(pe)
        # pedaleira: a barrinha em que o pe pousa
        ped = C.cilindro(f"{nome}_pedaleira_{lado}", 0.018, 0.12,
                         (lado * 0.145, -0.090, 0.330), segmentos=8,
                         rot=(0, math.pi / 2, 0))
        C.aplicar(ped, metal_m)
        pecas.append(ped)

    pescoco = C.cilindro(f"{nome}_pescoco", 0.065, 0.10, (0, 0.03, 1.50),
                         segmentos=10)
    C.aplicar(pescoco, pele)
    pecas.append(pescoco)
    capacete = _bolha_obj(f"{nome}_capacete", (0, 0.02, 1.62), 0.145)
    C.aplicar(capacete, C.mat_simples("via_moto_capacete", (0.52, 0.52, 0.54),
                                      rugosidade=0.18))
    pecas.append(capacete)
    viseira = C.caixa(f"{nome}_viseira", (0.20, 0.07, 0.10), (0, -0.10, 1.63))
    C.aplicar(viseira, C.mat_simples("via_moto_viseira", (0.015, 0.018, 0.024),
                                     rugosidade=0.12))
    pecas.append(viseira)

    alvo = C.juntar(pecas, nome)
    alvo.name = nome
    return alvo


def _bolha_obj(nome, centro, raio):
    """Esfera achatada avulsa — o `_bolha` do arquivo escreve num bmesh."""
    import bpy as _bpy
    _bpy.ops.mesh.primitive_uv_sphere_add(radius=raio, segments=14,
                                          ring_count=8, location=centro)
    o = _bpy.context.active_object
    o.name = nome
    o.scale = (1.0, 1.12, 1.05)
    C.suavizar(o, 40)
    return o


def muro_patio(m, nome="via_muro_patio", modulo=10.0):
    """Modulo de 10 m do muro do PATIO da empresa, feito para ladrilhar.

    O trecho de saida do patio era so uma placa de 20 km/h num descampado: o
    jogador obedecia sem entender, e sem entender nao traduz para o trabalho
    dele. Um patio de concessionaria tem cara: muro de placa pre-moldada com
    pilar a cada modulo, faixa de cor da empresa em cima, e refletivo na
    altura do farol porque caminhao manobra ali de madrugada.

    E placa PRE-MOLDADA, nao alvenaria: a junta vertical a cada 10 m e a
    marca do sistema, e e ela que faz o muro ler como industrial em vez de
    muro de casa comprido.

    SEGUNDA RODADA (07/10) — a primeira versao foi feita em meia hora e saiu
    uma chapa cinza com uma tarja verde por cima. Cinco defeitos, achados no
    render e nao no codigo:

      1. **A placa flutuava.** Centro em 1,18 com 2,05 de altura punha a base
         em +0,155: havia 15 cm de luz entre o muro e o chao, por onde se via
         a grama do outro lado. Agora ha baldrame assentado no terreno.
      2. **Buraco de 15 cm na emenda.** A placa ia ate 4,85 e o pilar so ate
         5,00, enquanto a placa do modulo seguinte so comecava em 5,15. A cada
         10 m de muro havia uma fresta. A placa agora cobre o modulo INTEIRO e
         o pilar monta em cima da junta.
      3. **Zero sombra propria.** Uma caixa de face lisa iluminada de frente e
         exatamente o "chapado" do retorno do cliente. As placas pre-moldadas
         de verdade sao PRANCHAS horizontais encaixadas entre pilares em H: as
         juntas rebaixadas desenham linhas de sombra a cada 50 cm, de graca.
      4. **Sem nada no alto.** Patio de concessionaria tem concertina ou arame
         farpado sobre maos-francesas inclinadas — e a silhueta recortada no
         ceu que diz "area restrita" antes de qualquer outra coisa. Era o que
         mais faltava na saida do patio.
      5. **Concreto de uma cor so.** O rodape de um muro de patio e sempre
         mais escuro: respingo de roda, barro e limo. Material proprio na
         faixa de baixo resolve sem ruido procedural (que a via nao pode usar,
         ver `_pintar_por_normal`).

    ~900 triangulos, contra 260. Cabe: o muro aparece 30 vezes, mas so nos
    120 m do patio.
    """
    pecas = []
    concreto = C.mat_simples("via_patio_concreto", (0.235, 0.230, 0.216),
                             rugosidade=0.92)
    # o pilar e pre-moldado em forma de aco: sai mais liso e mais claro que a
    # prancha, e essa diferenca de tom e metade do que separa um do outro
    concreto_pil = C.mat_simples("via_patio_pilar", (0.285, 0.280, 0.265),
                                 rugosidade=0.80)
    sujo = C.mat_simples("via_patio_rodape", (0.115, 0.112, 0.098),
                         rugosidade=0.95)
    verde = C.mat_simples("via_patio_faixa", (0.020, 0.235, 0.105),
                          rugosidade=0.80)
    refl = C.mat_simples("via_patio_refl", (0.56, 0.52, 0.36), rugosidade=0.40)
    arame = C.mat_simples("via_patio_arame", (0.195, 0.200, 0.205),
                          rugosidade=0.55, metalico=1.0)

    # baldrame: assenta o muro no terreno e e a faixa suja de respingo
    base = C.caixa(f"{nome}_baldrame", (modulo, 0.30, 0.34), (0, 0, 0.15))
    C.chanfrar(base, largura=0.02, segmentos=2)
    C.aplicar(base, sujo)
    pecas.append(base)

    # miolo que fecha o vao atras das pranchas: sem ele as juntas rebaixadas
    # viram frestas vazadas e se ve o patio pelo buraco
    miolo = C.caixa(f"{nome}_miolo", (modulo, 0.10, 1.92), (0, 0, 1.26))
    C.aplicar(miolo, sujo)
    pecas.append(miolo)

    # PRANCHAS: 4 de 46 cm com junta rebaixada de 4 cm entre elas.
    # Tons alternados de proposito: prancha pre-moldada sai de forma e de lote
    # diferentes e NUNCA fica da mesma cor que a de cima. Era o resto do
    # "chapado" depois que as juntas apareceram — 30 m de cinza unico.
    concreto_b = C.mat_simples("via_patio_concreto_b", (0.198, 0.196, 0.188),
                               rugosidade=0.94)
    z = 0.32
    for i in range(4):
        pr = C.caixa(f"{nome}_prancha_{i}", (modulo, 0.17, 0.46),
                     (0, 0, z + 0.23))
        C.chanfrar(pr, largura=0.012, segmentos=2)
        C.aplicar(pr, (sujo, concreto_b, concreto, concreto_b)[i])
        pecas.append(pr)
        z += 0.50

    # faixa da empresa na prancha de cima, NA FRENTE dela (sobressai 1 cm, o
    # que lhe da uma sombra propria em vez de ser adesivo)
    faixa = C.caixa(f"{nome}_faixa", (modulo, 0.19, 0.30), (0, 0, 2.03))
    C.aplicar(faixa, verde)
    pecas.append(faixa)

    # coroamento com pingadeira: 6 cm de abano de cada lado, e a linha de
    # sombra horizontal continua que o olho le de longe
    coroa = C.caixa(f"{nome}_coroa", (modulo, 0.32, 0.10), (0, 0, 2.27))
    C.chanfrar(coroa, largura=0.018, segmentos=2)
    C.aplicar(coroa, concreto_pil)
    pecas.append(coroa)

    # PILAR em H montado sobre a junta: a aba de cada lado e o que encaixa a
    # prancha, e e ela que faz o perfil ler como H e nao como poste
    xp = modulo / 2
    alma = C.caixa(f"{nome}_pilar", (0.22, 0.26, 2.40), (xp, 0, 1.20))
    C.chanfrar(alma, largura=0.018, segmentos=2)
    C.aplicar(alma, concreto_pil)
    pecas.append(alma)
    for dy in (-0.145, 0.145):
        aba = C.caixa(f"{nome}_aba_{dy:+.2f}", (0.13, 0.07, 2.30),
                      (xp, dy, 1.17))
        C.aplicar(aba, concreto_pil)
        pecas.append(aba)

    # MAO-FRANCESA + 3 fios: a silhueta recortada no ceu. A mao inclina 45
    # para dentro do patio (+Y), como manda o uso.
    for sx in (-modulo / 2, modulo / 2):
        mao = C.barra(f"{nome}_mao_{sx:+.0f}", (sx, 0.02, 2.32),
                      (sx, 0.42, 2.74), secao=(0.055, 0.045))
        C.aplicar(mao, arame)
        pecas.append(mao)
    for t in (0.30, 0.62, 0.95):
        fio = C.caixa(f"{nome}_fio_{t:.2f}", (modulo, 0.016, 0.016),
                      (0, 0.02 + 0.40 * t, 2.32 + 0.42 * t))
        C.aplicar(fio, arame)
        pecas.append(fio)

    # OLHO DE GATO na altura do farol de quem manobra, pregado na junta entre
    # pranchas (que e onde se prega na vida real). Chapa escura por tras e
    # lente pequena na frente: o retangulo claro solto de antes lia como um
    # papel colado no muro.
    for dx in (-modulo / 4, modulo / 4):
        chapa = C.caixa(f"{nome}_refl_chapa_{dx:.1f}", (0.30, 0.185, 0.13),
                        (dx, 0, 0.82))
        C.aplicar(chapa, C.mat_simples("via_patio_refl_chapa",
                                       (0.022, 0.024, 0.026), rugosidade=0.60))
        pecas.append(chapa)
        olho = C.caixa(f"{nome}_refl_{dx:.1f}", (0.21, 0.195, 0.065),
                       (dx, 0, 0.82))
        C.aplicar(olho, refl)
        pecas.append(olho)

    alvo = C.juntar(pecas, nome)
    alvo.name = nome
    return alvo


# Altura do quadril do pedestre de 1,72 m. E o pivo da passada: a perna
# gira aqui, e o jogo le essa altura da propria caixa da peca, entao a
# crianca de 1,25 m funciona sem numero a mais.
OMBRO_Z = 1.23      # altura do ombro, pivo do braco
JOELHO_Z = 0.52     # altura do joelho, pivo da canela
QUADRIL_Z = 0.90


def pedestre(m, nome="via_pedestre", altura=1.72, roupa=(0.30, 0.10, 0.09)):
    """Pessoa andando, de perfil, atravessando a pista (anda no eixo X).

    A fase manda "pare e deixe atravessar" desde sempre, e nao havia NINGUEM
    na faixa: o jogador parava por causa de um texto, nao do que via. E o
    mesmo defeito do cinto que nao aparecia — a decisao sem a imagem.

    De perfil e a 30 m, pessoa e: cabeca, ombro, e o V das pernas em passada.
    O V e o que diz que ela esta ANDANDO, e andando e o que diz que ela vai
    atravessar — gente parada na calcada nao obriga ninguem a frear. Por isso
    as pernas sao a parte com mais cuidado aqui.

    `altura` escala tudo: a mesma peca serve de crianca com 1,25.

    SEGUNDA RODADA (07/10). A versao de caixas chanfradas (648 faces) saia no
    render como RECORTE DE PAPELAO: tronco de 20 cm de espessura visto de
    frente vira uma tabua, cabeca de caixa vira um dado, e os bracos, da
    mesma cor da camisa e colados no tronco, sumiam. Quatro trocas:

      1. **Tronco em secao eliptica**, de quadril a ombro, com a cintura mais
         estreita que os dois. Gente tem 44 cm de ombro por 24 cm de peito —
         e essa razao, e nao o detalhe, que o olho usa para reconhecer um
         corpo. Caixa chanfrada tem razao 1:1 em toda a altura.
      2. **Cabeca de verdade**, em aneis: nuca, maca do rosto, cranio e topo.
         Custa 100 triangulos e e o que mais muda a leitura, porque a cabeca
         e a primeira coisa que o olho procura numa silhueta humana.
      3. **Braco com COTOVELO** e antebraco de pele. Sem a dobra o braco e um
         pau pendurado; e a mudanca de cor no cotovelo que separa o braco do
         tronco quando os dois sao da cor da camisa.
      4. **Ombro saliente**: o tronco termina mais largo do que a cabeca e o
         pescoco nasce recuado. E o degrau ombro-pescoco-cabeca que diz
         "pessoa" a 40 m, que e a distancia em que o jogador decide frear.

    ~980 triangulos contra 648 faces de caixa. Vale: na faixa de pedestre e
    nas quatro pessoas do patio esta peca e o conteudo da decisao.
    """
    pecas = []
    k = altura / 1.72
    pano = C.mat_simples(f"via_ped_roupa_{nome[-3:]}", roupa, rugosidade=0.80)
    calca = C.mat_simples("via_ped_calca", (0.055, 0.065, 0.095), rugosidade=0.85)
    pele = C.mat_simples("via_ped_pele", (0.265, 0.185, 0.135), rugosidade=0.72)
    cabelo = C.mat_simples("via_ped_cabelo", (0.035, 0.026, 0.020),
                           rugosidade=0.78)
    sapato = C.mat_simples("via_ped_sapato", (0.030, 0.028, 0.030), rugosidade=0.60)

    def cx(n, tam, pos, mat, ch=0.03, rot=None):
        # sem `k` aqui: a peca inteira e escalada no fim desta funcao
        o = C.caixa(f"{nome}_{n}", tam, pos, rot=rot)
        if ch:
            C.chanfrar(o, largura=ch, segmentos=2)
        C.aplicar(o, mat)
        pecas.append(o)
        return o

    # A pessoa ANDA no eixo X (atravessa a pista); X e a direcao da passada e
    # Y e a largura de ombro a ombro. Por isso rx < ry no tronco.
    bm = bmesh.new()
    _loft(bm, [(0.00, 0, 0.84, 0.098, 0.128),   # quadril
               (0.00, 0, 0.96, 0.094, 0.124),
               (0.00, 0, 1.08, 0.086, 0.110),   # cintura
               (0.01, 0, 1.26, 0.100, 0.158),   # peito
               (0.01, 0, 1.40, 0.102, 0.196),   # ombro
               (0.00, 0, 1.47, 0.082, 0.148),   # trapezio
               (0.00, 0, 1.515, 0.064, 0.082)], segmentos=10)
    # mangas curtas: o volume que separa o braco do tronco na silhueta
    for lado in (-1, 1):
        _loft(bm, [(0.005, lado * 0.185, 1.41, 0.062, 0.062),
                   (0.005, lado * 0.198, 1.30, 0.056, 0.056),
                   (0.005, lado * 0.200, 1.22, 0.050, 0.050)], segmentos=8)
    _fechar_bm(bm, f"{nome}_tronco", pano, pecas)

    bm = bmesh.new()
    cx_q = _loft(bm, [(0, 0, 0.78, 0.100, 0.122),
                      (0, 0, 0.90, 0.104, 0.130),
                      (0, 0, 0.99, 0.096, 0.124)], segmentos=10)
    del cx_q
    _fechar_bm(bm, f"{nome}_quadril", calca, pecas)

    # pescoco + cabeca na mesma malha: a emenda some e sobra o degrau que
    # importa, que e o do ombro
    bm = bmesh.new()
    _loft(bm, [(0.00, 0, 1.46, 0.054, 0.060),
               (0.00, 0, 1.512, 0.050, 0.054),  # pescoco
               (0.008, 0, 1.548, 0.072, 0.074),  # mandibula
               (0.012, 0, 1.604, 0.090, 0.084),  # maca do rosto
               (0.008, 0, 1.668, 0.088, 0.082),  # cranio
               (0.000, 0, 1.725, 0.062, 0.060),
               (0.000, 0, 1.752, 0.022, 0.022)], segmentos=10)
    _fechar_bm(bm, f"{nome}_cabeca", pele, pecas)

    # calota de cabelo: so a parte de tras e o alto, que e o que se ve
    bm = bmesh.new()
    _loft(bm, [(-0.012, 0, 1.600, 0.086, 0.086),
               (-0.010, 0, 1.672, 0.094, 0.088),
               (-0.004, 0, 1.728, 0.066, 0.064),
               (0.000, 0, 1.757, 0.024, 0.024)], segmentos=10)
    _fechar_bm(bm, f"{nome}_cabelo", cabelo, pecas)

    # PERNAS SOLTAS, EM PE, PARA O JOGO ANIMAR (3a rodada, 07/10).
    #
    # Ate aqui a passada era ASSADA na malha: uma perna a frente, outra atras,
    # congeladas. Lia como caminhada numa foto e como DESLIZE em movimento —
    # a pessoa atravessava a pista inteira na mesma pose, e foi o que o
    # usuario apontou.
    #
    # Nao da para esfolar (skinning): `X.preparar()` roda
    # convert(target="MESH"), que aplica a armadura e congela a pose, entao
    # nada com osso chega ao .glb. Mas nao PRECISA de osso: perna inteira
    # girando no quadril e o ciclo de caminhada mais antigo que existe, e o
    # jogo ja faz exatamente isso com a lanca do cesto aereo (Ocorrencia3D).
    #
    # Entao: pernas NEUTRAS (x=0, em pe), cada uma num objeto proprio com a
    # ORIGEM NO QUADRIL — assim o no do glTF ja nasce com a translacao certa
    # e o three.js so precisa girar, sem conta de pivo.
    #
    # Perna rigida nao afunda no chao: girando no quadril, o pe fica MAIS
    # ALTO nos extremos da passada e mais baixo na vertical. Posto o pe no
    # chao na vertical, ele nunca atravessa. Joelho custaria dois lofts por
    # perna e nao se le a 30 m, que e a distancia em que o jogador decide.
    pernas = []
    canelas = []
    bracos = []
    for lado in (-1, 1):
        dy = lado * 0.072
        """
        A PERNA TEM JOELHO.

        Era uma peca so, girando no quadril: perna rigida, do quadril ao
        sapato, varrendo um arco. "Nunca vi alguem andar com a perna reta,
        nao parecem pessoas, parecem massinha" — e e exatamente isso. O que
        o olho reconhece como caminhada humana nao e a perna indo e voltando,
        e o JOELHO dobrando na volta: a perna de tras recolhe o pe para poder
        passar sem raspar o chao.

        Duas pecas, entao: coxa com origem no quadril e canela com origem no
        joelho. O sapato vai na canela, porque e nela que ele anda.

        AS DUAS SE SOBREPOEM 6 cm no joelho, de proposito. Peca encostando
        em peca por fora deixa costura a vista, e com a junta dobrando 45
        graus deixaria um VAO. Com a coxa descendo ate 0,46 e a canela
        comecando em 0,58, a dobra acontece dentro do volume e nao abre.
        """
        coxa_sol = []
        bm = bmesh.new()
        _loft(bm, [(0.00, dy, 0.90, 0.088, 0.086),
                   (0.00, dy, 0.72, 0.078, 0.076),
                   (0.00, dy, 0.52, 0.062, 0.062),   # joelho
                   (0.00, dy, 0.46, 0.060, 0.060)], segmentos=8)
        _fechar_bm(bm, f"{nome}_coxa_malha_{lado}", calca, coxa_sol)
        pernas.append((C.juntar(coxa_sol, f"{nome}_coxa_{'e' if lado < 0 else 'd'}"),
                       dy))

        canela_sol = []
        bm = bmesh.new()
        _loft(bm, [(0.00, dy, 0.58, 0.061, 0.061),
                   (0.00, dy, 0.30, 0.056, 0.054),
                   (0.00, dy, 0.09, 0.048, 0.046)], segmentos=8)
        _fechar_bm(bm, f"{nome}_canela_malha_{lado}", calca, canela_sol)
        # SAPATO em duas pecas: cabedal e SOLA. A sola um pouco mais larga e
        # mais clara e o que faz o pe pousar no chao — uma caixa so, da cor
        # do cadarco, fica um tijolo preto na ponta da perna.
        o = C.caixa(f"{nome}_pe_{lado}", (0.235, 0.098, 0.062),
                    (0.040, dy, 0.052))
        C.chanfrar(o, largura=0.024, segmentos=2)
        C.aplicar(o, sapato)
        canela_sol.append(o)
        sola = C.caixa(f"{nome}_sola_{lado}", (0.240, 0.101, 0.019),
                       (0.041, dy, 0.016))
        C.chanfrar(sola, largura=0.007, segmentos=2)
        C.aplicar(sola, C.mat_simples("via_ped_sola", (0.105, 0.100, 0.098),
                                      rugosidade=0.85))
        canela_sol.append(sola)
        canelas.append((C.juntar(canela_sol, f"{nome}_canela_{'e' if lado < 0 else 'd'}"),
                        dy))

        # BRACO QUE BALANCA, pelo mesmo caminho da perna.
        #
        # Antes ele era assado no corpo, parado e caido, com a justificativa
        # de que "e o V das pernas que diz andando". A perna sozinha diz que
        # ANDA; o que ela nao diz e que o corpo esta VIVO — e braco colado no
        # tronco enquanto a perna abre 24 graus e exatamente o que o cliente
        # chamou de "pedestre duro".
        #
        # Mesma receita da perna: peca propria, origem no OMBRO, sem osso. O
        # three.js so gira.
        soltas_b = []
        bm = bmesh.new()
        _loft(bm, [(0.00, lado * 0.200, 1.23, 0.049, 0.049),
                   (0.00, lado * 0.206, 1.07, 0.042, 0.042),
                   (0.00, lado * 0.210, 0.94, 0.036, 0.036),
                   (0.00, lado * 0.210, 0.87, 0.040, 0.034)],
              segmentos=8)
        _fechar_bm(bm, f"{nome}_braco_malha_{lado}", pele, soltas_b)
        # MAO. O braco acabava num toco arredondado no pulso. A mao nao
        # precisa de dedo a 30 m, precisa EXISTIR: e a mancha de pele no fim
        # do braco que diz onde o braco acaba, e sem ela a silhueta termina
        # no nada. Sobreposta 2 cm no antebraco, para nao deixar costura.
        mao = C.caixa(f"{nome}_mao_{lado}", (0.034, 0.070, 0.098),
                      (0.0, lado * 0.208, 0.832))
        C.chanfrar(mao, largura=0.015, segmentos=3)
        C.aplicar(mao, pele)
        soltas_b.append(mao)
        bracos.append((C.juntar(soltas_b, f"{nome}_braco_{'e' if lado < 0 else 'd'}"),
                       lado * 0.200))

    # a escala vem no fim: escalar vertice a vertice evita `obj.scale`, que o
    # exportador aplicaria no no e o jogo herdaria ao instanciar
    for o in pecas:
        for v in o.data.vertices:
            v.co *= k

    alvo = C.juntar(pecas, nome)
    alvo.name = nome

    # Origem de cada perna no quadril, e filha do corpo: o exportador arrasta
    # os filhos (`com_filhos`) e o no do glTF sai com translation = quadril.
    for perna, dy in pernas:
        perna.name = perna.name  # ja nomeada em C.juntar
        quadril = Vector((0.0, dy * k, QUADRIL_Z * k))
        for v in perna.data.vertices:
            v.co = v.co * k - quadril
        perna.location = quadril
        perna.parent = alvo
        perna.matrix_parent_inverse.identity()
    for canela, dy in canelas:
        joelho = Vector((0.0, dy * k, JOELHO_Z * k))
        for v in canela.data.vertices:
            v.co = v.co * k - joelho
        canela.location = joelho
        canela.parent = alvo
        canela.matrix_parent_inverse.identity()
    for braco, dy in bracos:
        ombro = Vector((0.0, dy * k, OMBRO_Z * k))
        for v in braco.data.vertices:
            v.co = v.co * k - ombro
        braco.location = ombro
        braco.parent = alvo
        braco.matrix_parent_inverse.identity()
    return alvo


def crianca(m, nome="via_crianca"):
    """A mesma peca a 1,25 m. Existe como funcao para a prova poder pedi-la
    pelo nome, como pede todas as outras."""
    return pedestre(m, nome=nome, altura=1.25, roupa=(0.12, 0.17, 0.34))


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


def cruzamento(m, nome="via_cruzamento", braco=46.0):
    """A VIA TRANSVERSAL do cruzamento.

    "O cruzamento nao tem cruzamento, nunca vi semaforo numa linha reta,
    cade o asfalto vindo do outro lado." Ele esta certo: havia um poste de
    semaforo plantado na beira de uma reta, e mais nada. Semaforo sem via
    que cruza nao e cruzamento, e um poste.

    A peca nasce CENTRADA no cruzamento (x local 0) e e posta no eixo da
    pista. Dois bracos de asfalto saem para os lados; o miolo fica de fora,
    porque ali quem manda e a propria pista — asfalto por cima de asfalto na
    mesma altura briga por profundidade e pisca.

    Leva junto o que faz um cruzamento ser lido como cruzamento antes de
    qualquer placa: a linha de retencao na aproximacao, o eixo tracejado da
    transversal, as quatro esquinas de meio-fio e o recuo de calcada.
    """
    pecas = []
    meia_cruz = 3.6          # meia largura da transversal
    x_esq, x_dir = BORDA_DIR, BORDA_ESQ   # onde a pista principal comeca/acaba

    # os dois bracos de asfalto, parando na borda da pista
    for lado, (xa, xb) in (("e", (-braco, x_esq)), ("d", (x_dir, braco))):
        comp = xb - xa
        faixa_as = C.caixa(f"{nome}_asfalto_{lado}", (comp, meia_cruz * 2, 0.12),
                           ((xa + xb) / 2, 0, -0.06))
        C.aplicar(faixa_as, m["asfalto"])
        pecas.append(faixa_as)
        # eixo tracejado da transversal
        n = int(comp / 12)
        for i in range(n):
            x = xa + 4 + i * 12
            if x_esq - 1 < x < x_dir + 1:
                continue
            t = C.caixa(f"{nome}_eixo_{lado}_{i}", (4.0, 0.12, 0.004),
                        (x, 0, 0.004))
            C.aplicar(t, m["tinta"])
            pecas.append(t)

    """
    LINHA DE RETENCAO: a barra branca onde se para no vermelho.

    So na faixa de quem dirige (de BORDA_DIR ao eixo). Atravessar a pista
    inteira seria pintar a linha da contramao junto, que e erro de via — e
    a linha e justamente o que a fase cobra no amarelo.
    """
    ret = C.caixa(f"{nome}_retencao", (abs(EIXO - BORDA_DIR), 0.40, 0.004),
                  ((BORDA_DIR + EIXO) / 2, meia_cruz + 0.9, 0.004))
    C.aplicar(ret, m["tinta"])
    pecas.append(ret)

    # quatro esquinas: meio-fio em L, que e o que desenha a quina do
    # cruzamento quando se olha de cima do capo
    for sx, nx in ((-1, "e"), (1, "d")):
        for sy, ny in ((-1, "s"), (1, "n")):
            bx = x_esq - 0.12 if sx < 0 else x_dir + 0.12
            ao_longo = C.caixa(f"{nome}_meiofio_{nx}{ny}_a", (0.24, 7.0, 0.16),
                               (bx, sy * (meia_cruz + 3.5), 0.02))
            C.aplicar(ao_longo, m["concreto"])
            pecas.append(ao_longo)
            atravessa = C.caixa(f"{nome}_meiofio_{nx}{ny}_b", (9.0, 0.24, 0.16),
                                (bx + sx * 4.5, sy * (meia_cruz + 0.12), 0.02))
            C.aplicar(atravessa, m["concreto"])
            pecas.append(atravessa)

    return C.juntar(pecas, nome)


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
    """Onibus escolar parado em embarque, encostado na direita.

    O "paralelepipedo" do repasse tinha uma causa concreta: a carroceria
    comecava em z 0,47 e as rodas (raio 0,44, centro em 0,44) ficavam
    ENTERRADAS dentro dela — sobrava menos de meia roda, escondida pelo
    chanfro. Onibus sem roda visivel e uma caixa pousada no chao, e era
    exatamente o que se via.

    Agora o piso fica em 0,95 e a roda tem 0,52 de raio: a roda aparece
    inteira embaixo da saia, que e o que da a leitura de veiculo. A altura
    total foi de 2,57 para 3,05 m, que e altura de onibus de verdade.
    """
    pecas = []
    amarelo = C.mat_simples("via_onibus_pintura", (0.62, 0.42, 0.045),
                            rugosidade=0.30)
    preto = C.mat_simples("via_onibus_faixa", (0.022, 0.022, 0.024),
                          rugosidade=0.45)
    vidro = C.mat_simples("via_onibus_vidro", (0.020, 0.026, 0.034),
                          rugosidade=0.12)

    # chanfro GORDO: 8 cm numa caixa de 2,4 m some, e o onibus ficava um
    # tijolo. 24 cm arredonda o canto o bastante para ler como carroceria
    corpo = C.caixa(f"{nome}_corpo", (2.42, 8.60, 2.10), (0, 0, 2.00))
    C.chanfrar(corpo, largura=0.24, segmentos=4)
    C.aplicar(corpo, amarelo)
    pecas.append(corpo)

    # TETO ABAULADO (07/10). O teto era o topo chato da caixa: de tres
    # quartos, que e como o onibus aparece na fase, o que se via era um
    # planalto amarelo de 2,4 x 8,6 m — a cara de tijolo que o repasse
    # apontou. Onibus nao tem teto plano: tem arco transversal de uns 15 cm
    # de flecha, e e esse arco que faz a luz correr de uma agua para a outra
    # em vez de bater chapada numa face so.
    #
    # Feito como perfil fechado extrudado em Y, no mesmo molde do telhado da
    # casa: 9 pontos no arco, 2 no fundo, tampado nas duas pontas.
    meia, y0, y1 = 1.255, 4.33, -4.33
    perfil = [(-meia + 2 * meia * i / 8,
               3.04 + 0.19 * math.sin(math.pi * i / 8)) for i in range(9)]
    perfil += [(meia, 2.78), (-meia, 2.78)]
    bm = bmesh.new()
    frentes = [[bm.verts.new((x, y, z)) for x, z in perfil] for y in (y0, y1)]
    n = len(perfil)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((frentes[0][i], frentes[0][j],
                      frentes[1][j], frentes[1][i]))
    bm.faces.new(list(reversed(frentes[0])))
    bm.faces.new(frentes[1])
    teto = _fechar_bm(bm, f"{nome}_teto", amarelo, pecas, suave=24)
    del teto
    # friso de chuva na emenda teto/lateral: a linha escura horizontal que
    # percorre o onibus inteiro e o que separa as duas superficies
    for lado in (-1, 1):
        friso = C.caixa(f"{nome}_friso_{lado}", (0.07, 8.68, 0.08),
                        (lado * 1.245, 0, 3.02))
        C.aplicar(friso, preto)
        pecas.append(friso)
    # escotilhas: dois volumes claros no alto que quebram os 8,6 m de teto
    for dy in (-2.2, 1.9):
        esc = C.caixa(f"{nome}_escotilha_{dy:+.1f}", (0.62, 0.58, 0.10),
                      (0, dy, 3.24))
        C.chanfrar(esc, largura=0.025, segmentos=2)
        C.aplicar(esc, C.mat_simples("via_onibus_escotilha",
                                     (0.42, 0.44, 0.46), rugosidade=0.45))
        pecas.append(esc)

    # para-brisa e painel de destino: e a frente que diz que e um onibus
    frente = C.caixa(f"{nome}_parabrisa", (2.10, 0.07, 0.86), (0, -4.29, 2.50))
    C.aplicar(frente, vidro)
    pecas.append(frente)
    # sobe para a TESTA do teto abaulado: no lugar antigo (z 3,10, y -4,31)
    # ele ficava dentro do volume novo do teto e sumia por completo
    destino = C.caixa(f"{nome}_destino", (1.30, 0.06, 0.26), (0, -4.355, 3.02))
    C.aplicar(destino, preto)
    pecas.append(destino)
    for lado in (-1, 1):
        espelho = C.caixa(f"{nome}_espelho_{lado}", (0.10, 0.08, 0.42),
                          (lado * 1.42, -4.18, 2.78))
        C.aplicar(espelho, preto)
        pecas.append(espelho)

    # a faixa preta e o que identifica o escolar a distancia
    for dz in (2.74, 1.34):
        faixa = C.caixa(f"{nome}_faixa_{dz:.2f}", (2.46, 8.64, 0.17), (0, 0, dz))
        C.aplicar(faixa, preto)
        pecas.append(faixa)

    # janelas: uma fita de cada lado e a traseira
    for lado in (-1, 1):
        jan = C.caixa(f"{nome}_janela_{lado}", (0.06, 7.20, 0.80),
                      (lado * 1.21, -0.2, 2.40))
        C.aplicar(jan, vidro)
        pecas.append(jan)
    tras = C.caixa(f"{nome}_vidro_tras", (1.90, 0.06, 0.74), (0, 4.31, 2.43))
    C.aplicar(tras, vidro)
    pecas.append(tras)

    for lado in (-1, 1):
        luz = C.caixa(f"{nome}_luz_{lado}", (0.30, 0.06, 0.22),
                      (lado * 0.88, 4.32, 1.40))
        C.aplicar(luz, C.mat_simples("via_onibus_lanterna", (0.52, 0.035, 0.026),
                                     rugosidade=0.25))
        pecas.append(luz)
        for dy in (-2.9, 2.6):
            roda = C.cilindro(f"{nome}_roda_{lado}_{dy:+.1f}", 0.52, 0.28,
                              (lado * 1.06, dy, 0.52), segmentos=16,
                              rot=(0, math.radians(90), 0))
            C.aplicar(roda, C.mat_simples("via_pneu", (0.018, 0.018, 0.020),
                                          rugosidade=0.92))
            pecas.append(roda)
            # CAIXA DE RODA. A roda saia direto de uma saia reta, e roda sem
            # arco e o que mais faz um veiculo ler como caixa com cilindros
            # colados — o mesmo defeito que o carro ja tinha resolvido e o
            # onibus nao. O arco e um trapezio simples: so precisa existir a
            # sombra em volta do pneu.
            arco = C.caixa(f"{nome}_arco_{lado}_{dy:+.1f}", (0.09, 1.34, 0.80),
                           (lado * 1.19, dy, 0.80))
            C.chanfrar(arco, largura=0.07, segmentos=3)
            C.aplicar(arco, preto)
            pecas.append(arco)

    """
    MONTANTES, PORTA E PARA-CHOQUES.

    A fita de janela era UM vidro corrido de 7,2 m de cada lado. Vidro
    corrido nao existe em onibus, e e justamente o ritmo dos montantes que
    faz o olho ler "onibus" em vez de "caixa amarela com uma tarja escura" —
    o mesmo motivo pelo qual a escola ganhou esquadria em vez de mancha.

    E faltava a PORTA, que e a peca mais caracteristica de um escolar: ele
    esta parado EM EMBARQUE na fase, com criancas entrando, e a porta por
    onde elas entram nao existia.
    """
    # montantes entre as janelas, nos dois lados
    for lado in (-1, 1):
        for i in range(7):
            y = -3.6 + i * 1.05
            mont = C.caixa(f"{nome}_montante_{lado}_{i}", (0.10, 0.09, 0.84),
                           (lado * 1.225, y, 2.40))
            C.aplicar(mont, amarelo)
            pecas.append(mont)

    # PORTA de embarque, no lado da calcada (direita de quem dirige = -X,
    # porque o onibus aponta para -Y como o resto da via)
    porta_y = -2.95
    moldura = C.caixa(f"{nome}_porta", (0.11, 1.00, 1.70),
                      (-1.235, porta_y, 1.92))
    C.aplicar(moldura, preto)
    pecas.append(moldura)
    for i, dy in enumerate((-0.23, 0.23)):
        folha = C.caixa(f"{nome}_porta_vidro_{i}", (0.07, 0.40, 1.44),
                        (-1.26, porta_y + dy, 1.98))
        C.aplicar(folha, vidro)
        pecas.append(folha)
    # degrau: o pisante que aparece com a porta aberta, e o que explica a
    # altura do piso
    degrau = C.caixa(f"{nome}_degrau", (0.34, 0.92, 0.09),
                     (-1.26, porta_y, 1.02))
    C.aplicar(degrau, preto)
    pecas.append(degrau)

    # PARA-CHOQUES: a barra que fecha a silhueta embaixo, na frente e atras.
    # Sem ela a carroceria morre no ar e as rodas ficam penduradas.
    for dy, comp in ((-4.36, 0.16), (4.36, 0.16)):
        pc = C.caixa(f"{nome}_choque_{dy:+.1f}", (2.50, comp, 0.30),
                     (0, dy, 1.06))
        C.chanfrar(pc, largura=0.05, segmentos=2)
        C.aplicar(pc, preto)
        pecas.append(pc)

    # placa de PARE do escolar, aberta do lado do motorista que ultrapassa
    braco = C.caixa(f"{nome}_pare_braco", (0.70, 0.06, 0.06), (-1.55, -1.2, 1.83))
    C.aplicar(braco, preto)
    pecas.append(braco)
    # A placa de PARE e OITAVADA — e a forma que a identifica a distancia,
    # antes de qualquer letra. Com as faces laterais suavizadas ela saia
    # redonda no render, uma bola vermelha espetada num pau.
    for raio, esp, dx, cor in ((0.32, 0.030, -2.00, (0.72, 0.70, 0.66)),
                               (0.27, 0.034, -2.01, (0.58, 0.045, 0.035))):
        p = C.cilindro(f"{nome}_pare_{raio:.2f}", raio, esp, (dx, -1.2, 1.83),
                       segmentos=8, rot=(math.radians(90), 0, 0))
        for f in p.data.polygons:
            f.use_smooth = False
        C.aplicar(p, C.mat_simples(f"via_onibus_pare_{raio:.2f}", cor,
                                   rugosidade=0.40))
        pecas.append(p)

    # PORTA dianteira, do lado da calcada. Depois da roda, e o que mais diz
    # "onibus" numa silhueta: a fita de janela e continua, e a porta e o unico
    # rasgo vertical nela.
    # A PORTA FICA NO LADO DO MEIO-FIO, e estava no outro.
    #
    # O para-brisa esta em y -4.29, entao o onibus aponta para +z no jogo,
    # mesma direcao do caminhao. Com a porta em x +1.23 e o onibus parado em
    # x -1.0, ela caia em x +0.23 — e o asfalto vai de -1.75 a +5.25. A porta
    # do onibus ESCOLAR abria para o meio da pista, do lado do transito.
    # Passou batido porque as criancas sumiam uma a uma em vez de andar ate
    # ela: ninguem nunca viu alguem usar aquela porta.
    porta = C.caixa(f"{nome}_porta", (0.07, 0.86, 1.52),
                    (-1.23, -3.20, 1.85))
    C.aplicar(porta, vidro)
    pecas.append(porta)
    batente = C.caixa(f"{nome}_porta_batente", (0.05, 0.96, 1.62),
                      (-1.225, -3.20, 1.85))
    C.aplicar(batente, preto)
    pecas.append(batente)

    # saia entre as rodas: fecha o vao e impede que o onibus pareca flutuar
    saia = C.caixa(f"{nome}_saia", (2.26, 5.40, 0.30), (0, -0.15, 1.05))
    C.aplicar(saia, preto)
    pecas.append(saia)

    # PARA-CHOQUES nas duas pontas: a frente e a traseira acabavam numa quina
    # viva de 2,4 m, que e quina de caixa e nao de veiculo. O para-choque
    # avanca 10 cm e tem chanfro gordo — e a linha horizontal escura que diz
    # onde o onibus acaba.
    for dy, dz in ((-4.38, 1.28), (4.38, 1.32)):
        pc = C.caixa(f"{nome}_choque_{dy:+.1f}", (2.44, 0.22, 0.40),
                     (0, dy, dz))
        C.chanfrar(pc, largura=0.08, segmentos=3)
        C.aplicar(pc, preto)
        pecas.append(pc)

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

    aco = C.mat_simples("via_bike_aro", (0.44, 0.45, 0.46), rugosidade=0.28,
                        metalico=1.0)
    for dy in (-0.52, 0.52):
        pecas.append(_roda_vazada(f"{nome}_pneu_{dy:+.2f}", 0.340, 0.300,
                                  0.045, (0, dy, 0.34), pneu))
        # aro claro: o pneu preto sozinho sumia contra o asfalto, e e a roda
        # que diz que aquilo na pista e uma bicicleta e nao um pedestre
        pecas.append(_roda_vazada(f"{nome}_aro_{dy:+.2f}", 0.302, 0.268,
                                  0.028, (0, dy, 0.34), aco))
        cubo = C.cilindro(f"{nome}_cubo_{dy:+.2f}", 0.035, 0.09, (0, dy, 0.34),
                          segmentos=8, rot=(0, math.radians(90), 0))
        C.aplicar(cubo, aco)
        pecas.append(cubo)
        # 6 raios: finos de proposito. A 25 m eles nao se contam um a um, mas
        # a malha clara que formam e o que impede o miolo da roda de ficar um
        # buraco vazio quando ha ceu atras.
        for i in range(6):
            a = math.pi * i / 6
            raio = C.caixa(f"{nome}_raio_{dy:+.2f}_{i}", (0.010, 0.010, 0.56),
                           (0, dy, 0.34), rot=(a, 0, 0))
            C.aplicar(raio, aco)
            pecas.append(raio)

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

    # TRONCO (07/10): era um bloco reto de 36 cm — o maior volume da peca, e o
    # mais chapado. Ciclista pedalando esta DEITADO sobre a bicicleta: o
    # quadril fica atras e baixo, o ombro a frente e alto, e e essa diagonal
    # que diz "pedalando" em vez de "sentado num banquinho". Em aneis
    # elipticos a diagonal sai de graca, e o estreitamento na cintura separa o
    # tronco do quadril sem precisar de uma peca a mais.
    bm = bmesh.new()
    _loft(bm, [(0, 0.175, 0.93, 0.138, 0.098),   # quadril, atras e baixo
               (0, 0.105, 1.045, 0.142, 0.100),
               (0, 0.020, 1.155, 0.152, 0.102),  # cintura
               (0, -0.075, 1.265, 0.178, 0.104),
               (0, -0.145, 1.355, 0.186, 0.098),  # ombro, a frente e alto
               (0, -0.180, 1.405, 0.148, 0.082)], segmentos=10)
    _fechar_bm(bm, f"{nome}_tronco", roupa, pecas)

    # cabeca inclinada para a frente, como quem olha a pista 10 m adiante
    bm = bmesh.new()
    _loft(bm, [(0, -0.175, 1.385, 0.052, 0.056),  # pescoco
               (0, -0.195, 1.445, 0.072, 0.078),  # mandibula
               (0, -0.200, 1.495, 0.088, 0.092),  # maca do rosto
               (0, -0.196, 1.550, 0.086, 0.090),
               (0, -0.190, 1.590, 0.064, 0.066)], segmentos=10)
    _fechar_bm(bm, f"{nome}_cabeca", pele, pecas)

    # CAPACETE de verdade: casco abaulado com aba sobre os olhos. O bloco
    # chanfrado de antes saia no render como um tijolo claro na cabeca.
    bm = bmesh.new()
    _loft(bm, [(0, -0.199, 1.527, 0.098, 0.104),
               (0, -0.196, 1.570, 0.102, 0.108),
               (0, -0.192, 1.612, 0.084, 0.090),
               (0, -0.190, 1.642, 0.040, 0.044)], segmentos=10)
    capacete = _fechar_bm(
        bm, f"{nome}_capacete",
        C.mat_simples("via_ciclista_capacete", (0.56, 0.52, 0.48),
                      rugosidade=0.30), pecas)
    aba = C.caixa(f"{nome}_capacete_aba", (0.17, 0.11, 0.022),
                  (0, -0.278, 1.536), rot=(math.radians(-12), 0, 0))
    C.aplicar(aba, capacete.data.materials[0])
    pecas.append(aba)

    for lado in (-1, 1):
        # DUAS secoes, nao uma: perna reta do quadril ao pedal e o que fazia
        # o ciclista parecer uma boneca de pau em cima da bicicleta. Coxa
        # para a frente e canela para tras e a forma de quem pedala — e e o
        # joelho dobrado que da a leitura, nao o detalhe.
        # o quadril agora fica em y=+0,175: a coxa nasce de la, e nao de +0,08
        # COXA E CANELA COMO MEMBRO, NAO COMO BARRA (17/10).
        #
        # `C.barra` e um paralelepipedo de secao constante: a coxa saia com
        # 13,5 cm de LADO, quadrada, do quadril ao joelho, e a canela igual.
        # No render o ciclista tinha pernas de caixote — foi o "parecem
        # massinha" do cliente. Aqui a perna afina do quadril (11 cm) para o
        # joelho (7,5 cm) e de novo para o tornozelo (5 cm), com o anel
        # perpendicular ao osso: na coxa, que e quase deitada, e a unica
        # forma de a secao nao virar uma elipse de meio metro.
        bm = bmesh.new()
        _membro(bm, [(lado * 0.100, 0.165, 0.915),
                     (lado * 0.118, -0.030, 0.815),
                     (lado * 0.125, -0.210, 0.712)],
                [0.110, 0.092, 0.076], segmentos=8)
        _fechar_bm(bm, f"{nome}_coxa_{lado}", roupa, pecas)

        bm = bmesh.new()
        _membro(bm, [(lado * 0.124, -0.205, 0.725),
                     (lado * 0.120, -0.120, 0.515),
                     (lado * 0.115, -0.045, 0.315)],
                [0.072, 0.058, 0.046], segmentos=8)
        _fechar_bm(bm, f"{nome}_perna_{lado}", pele, pecas)

        tenis = C.mat_simples("via_bike_tenis", (0.045, 0.045, 0.050),
                              rugosidade=0.60)
        pe = C.caixa(f"{nome}_pe_{lado}", (0.098, 0.215, 0.062),
                     (lado * 0.115, -0.028, 0.268))
        C.chanfrar(pe, largura=0.018, segmentos=2)
        C.aplicar(pe, tenis)
        pecas.append(pe)

        # BRACO: ombro -> cotovelo -> pulso, afinando, e uma MAO no guidao.
        # Sem a mao o antebraco terminava num toco quadrado ATRAVESSANDO o
        # guidao — o mesmo defeito que o cliente apontou na cabine.
        bm = bmesh.new()
        _membro(bm, [(lado * 0.150, -0.120, 1.340),
                     (lado * 0.178, -0.225, 1.215),
                     (lado * 0.188, -0.302, 1.108)],
                [0.078, 0.058, 0.048], segmentos=8)
        _fechar_bm(bm, f"{nome}_braco_{lado}", roupa, pecas)

        bm = bmesh.new()
        _membro(bm, [(lado * 0.187, -0.298, 1.114),
                     (lado * 0.196, -0.355, 1.055),
                     (lado * 0.202, -0.402, 1.002)],
                [0.050, 0.042, 0.034], segmentos=8)
        _fechar_bm(bm, f"{nome}_antebraco_{lado}", pele, pecas)

        mao = C.caixa(f"{nome}_mao_{lado}", (0.052, 0.082, 0.070),
                      (lado * 0.205, -0.420, 0.986),
                      rot=(math.radians(-38), 0, 0))
        C.chanfrar(mao, largura=0.016, segmentos=3)
        C.aplicar(mao, pele)
        pecas.append(mao)

    return C.juntar(pecas, nome)
