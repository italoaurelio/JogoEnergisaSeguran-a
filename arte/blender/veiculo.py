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
# Olho do motorista. Baixou 4 cm e a vista da fase 2b inclinou 4 graus para
# baixo (ver `CameraFixa` em src/fases/Trajeto.tsx): e o par que poe o volante
# em quadro sem comer a via. Medido, nao chutado — a conta esta no bloco de
# VOLANTE logo abaixo.
OLHO = Vector((X_MOTORISTA, 0.20, 1.17))   # olho do motorista
# O volante estava FORA DE QUADRO na fase 2b, e ninguem tinha medido. Do olho
# antigo NENHUM ponto do aro ficava a menos de 40 graus abaixo da direcao do
# olhar, e a borda de baixo da tela esta a 27,5 graus (fov 52, 1,5 grau de
# inclinacao). Nao era enquadramento infeliz: num caminhao de verdade quem
# olha a via NAO VE o volante, porque o olho fica 45 cm acima do aro.
#
# Entao a correcao e dos dois lados, e so funciona junto:
#
# - aro de CAMINHAO: 470 mm (era 370, de carro de passeio) e deitado 32 graus
#   da horizontal (era 24), empurrado para a frente e para cima;
# - olho 4 cm mais baixo e vista 4 graus mais inclinada para baixo.
#
# Conta do resultado: o ponto mais alto do aro fica em z 0,985 e y -0,171,
# isto e, 37 cm a frente do olho e 18,5 cm abaixo -> 26,5 graus. Com a borda
# de baixo da tela a 30 graus, o arco de cima do volante atravessa a parte de
# baixo da tela e o horizonte fica 15% acima do centro. Mexer em um dos dois
# sozinho nao cabe: so a geometria da 28,2 graus contra 27,5 de borda.
#
# O y nao pode ir mais para a frente que -0,37: o aro passa a atravessar o
# capo do painel de instrumentos, que ocupa y de -0,70 a -0,49. Conferido no
# render, nao no olho — a primeira tentativa com -0,42 enterrou metade do
# volante dentro do capo e a prova mostrou na hora.
VOLANTE = Vector((X_MOTORISTA, -0.37, 0.86))
RAIO_VOLANTE = 0.235
# 62 GRAUS, e nao 32 (17/10).
#
# Os 32 graus foram comprados para manter o aro em quadro na fase 2b, e a
# nota inteira acima explica a conta. Essa conta MORREU: o olho da fase 2b
# andou 28 cm para a frente e 10 cm para cima depois disso, e projetando o
# aro na tela do jogo o ponto mais alto dele cai em px 1036 de 1038 — ou
# seja, o volante ja nao aparece de jeito nenhum, deitado ou em pe.
#
# Entao sobrou so o preco: 32 graus da horizontal e volante de onibus, e de
# dentro da cabine (fase 2a, que e onde o volante APARECE) ele lia como um
# prato virado para baixo. O cliente disse "o volante ta pra baixo".
#
# 62 graus e coluna de caminhonete. Conferido depois da troca: o aro nao
# toca a pala do painel (topo do aro em y -0,480 / z 1,068, pala em
# y -0,468 / z 0,987) e deixa de tapar o mostrador, que vive em y -0,523.
INCLINACAO_VOLANTE = math.radians(62)

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
    # TRANSMISSAO ZERO, de proposito. Transmissao faz o three renderizar a
    # cena opaca inteira uma segunda vez por quadro, com MSAA e mipmaps — e
    # entrega exatamente o que a transparencia simples entrega, porque o IOR
    # ja foi baixado para 1.04 para matar o Fresnel. Media-se 33 fps contra
    # 60 nas outras fases so por causa disto. A opacidade entra no jogo, em
    # `src/cena/Cabine3D.tsx`.
    mat = C.mat_simples("vidro", (0.96, 0.97, 0.98), rugosidade=0.0, ior=1.04)
    b = mat.node_tree.nodes["Principled BSDF"]
    for nome, valor in (("Transmission Weight", 0.0),
                        ("Specular IOR Level", 0.04)):
        if nome in b.inputs:
            b.inputs[nome].default_value = valor
    return mat


# Cinza medio, nao preto. O cinto e o item que mais vale ponto da fase 2a e
# a pergunta e "ele esta como precisa estar?" — com albedo 0,062 ele sumia
# contra o pilar, que tem 0,072. O proprio comentario de `cinto()` ja dizia
# que a fita tinha sido ALARGADA para nao sumir; alargar nao resolve
# contraste, cor resolve. Cinto cinza e comum em frota, entao nao custa
# realismo nenhum.
# 0,34 e nao 0,175. O comentario acima ja contava a historia de uma
# subida de 0,062 para 0,175 "porque ele sumia contra o pilar, que tem
# 0,072" — e ele continuava sumindo, porque o resto da cabine escureceu
# depois disso. Medido na tela pintando a fita de vermelho: ela esta no
# quadro o tempo todo, so nao da para ve-la. 0,34 contra pilar de 0,072 e
# quase cinco vezes de contraste, e cinto claro em frota e comum.
def mat_cinto(cor=(0.34, 0.345, 0.355)):
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
        # 1,14 m e nao 1,00: com 1,00 o forro comecava em y -0,52 e o braco do
        # retrovisor externo esta em y -0,53, entao os dois se tocavam por uma
        # quina de 5 mm — na tela o espelho parecia boiando ao lado da cabine.
        # Agora a porta vai ate -0,66 e encontra o pilar A.
        porta = C.caixa(f"cab_porta_{lado}", (0.07, 1.14, altura_porta),
                        (lado * (meia + 0.035), y0 + 0.71, altura_porta / 2))
        C.chanfrar(porta, largura=0.010, segmentos=2)
        # a porta mais clara que o painel: sem essa diferenca o interior vira
        # uma mancha cinza so e nao se distingue uma peca da outra na tela
        C.aplicar(porta, mat_plastico_painel((0.082, 0.087, 0.097)))
        pecas.append(porta)

        peitoril = C.caixa(f"cab_peitoril_{lado}", (0.085, 1.14, 0.045),
                           (lado * (meia + 0.030), y0 + 0.71,
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

    # PILAR A. Nao existia: a cabine era um palco com so as pecas que as seis
    # vistas de perto precisavam, e na vista do MOTORISTA — que e a mais longa
    # do jogo, 1.340 m — isso aparece como laje solta boiando. Travessa,
    # para-brisa e porta nao se encostavam em nada.
    #
    # Vai do canto de baixo do para-brisa ao canto de cima, encostando nos
    # dois: 54 cm para tras e 45 cm para cima, 50 graus da vertical.
    for lado in (-1, 1):
        comp = math.hypot(PARABRISA_TOPO - PARABRISA_BASE, ALTURA - PAINEL_TOPO)
        pilar_a = C.caixa(
            f"cab_pilar_a_{lado}", (0.075, 0.090, comp + 0.06),
            (lado * (meia + 0.005),
             (PARABRISA_BASE + PARABRISA_TOPO) / 2,
             (PAINEL_TOPO + ALTURA) / 2),
            rot=(-math.atan2(PARABRISA_TOPO - PARABRISA_BASE,
                             ALTURA - PAINEL_TOPO), 0, 0))
        C.chanfrar(pilar_a, largura=0.010, segmentos=2)
        C.aplicar(pilar_a, mat_plastico_painel((0.072, 0.076, 0.085)))
        pecas.append(pilar_a)

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

    # CAPO DO PAINEL: uma PALA, nao um bloco (17/10).
    #
    # O perfil antigo era um contorno fechado de y -0,700 a -0,490 e z 0,842
    # a 0,967 — isto e, 21 cm de plastico MACICO. O mostrador morava dentro
    # dele. Medido por raio a partir do olho do motorista: de z 0,85 a 0,95
    # TODO raio batia em `cab_capo`, e abaixo de 0,845 batia no volante.
    # Nao existia um unico ponto da cabine em que o motorista visse o
    # painel de instrumentos. Era literalmente um painel dentro da parede.
    #
    # Agora e uma casca de 3,5 cm: sobe do painel, faz o bico sobre o nicho
    # e volta por dentro. O nicho fica aberto, e os relogios cabem nele.
    capo = [
        (-0.700, PAINEL_TOPO + 0.010),
        (-0.610, PAINEL_TOPO + 0.080),
        (-0.468, PAINEL_TOPO + 0.062),   # bico da pala, sobre o nicho
        (-0.472, PAINEL_TOPO + 0.030),
        (-0.610, PAINEL_TOPO + 0.040),
        (-0.700, PAINEL_TOPO - 0.022),
    ]
    c = extrudar("cab_capo", capo, VOLANTE.x - 0.158, VOLANTE.x + 0.158)
    C.chanfrar(c, largura=0.012, segmentos=2)
    C.aplicar(c, plastico)
    pecas.append(c)

    pecas += desembacador()
    pecas += instrumentos()
    pecas += saidas_de_ar()
    pecas += central_do_painel()
    pecas += hastes_da_coluna()
    return pecas


# ------------------------------------------------------- dentro do capo
#
# A FAIXA QUE O MOTORISTA ENXERGA, medida por RAIO e nao calculada.
#
# A primeira tentativa foi por trigonometria e errou inteira: deu uma
# fresta de 19,8 a 24,8 graus que nao existe. O `scene.ray_cast` do olho
# para cada ponto mostrou o que estava acontecendo de verdade — abaixo de
# z 0,845 o raio bate no VOLANTE, de 0,85 a 0,95 bate no CAPO, e acima de
# 0,96 ja e para-brisa. Nenhum ponto livre: o painel de instrumentos
# inteiro estava dentro de um bloco de plastico macico.
#
# Com o capo virado pala (ver `painel`), o nicho abre em y -0,523. Os
# relogios ficam na face desse nicho, e nao no fundo dele, porque o bico
# da pala corta tudo que estiver mais fundo que ~2 cm.
#
# Quem mexer nestes numeros RODA O RAIO DE NOVO — a conta no papel ja
# mentiu uma vez aqui.
MOSTRADOR_Y = -0.523
MOSTRADOR_Z = 0.901
RAIO_RELOGIO = 0.037
TOMBO_PAINEL = math.radians(-14)   # o painel deita para tras


def _no_mostrador(x, dy, dz):
    """(x, y, z) de um ponto dado em coordenada do MOSTRADOR.

    `dy` e a profundidade (positivo = para o motorista), `dz` a altura na
    face. Aplica o tombo de 18 graus, para que agulha, aro e marcacao
    fiquem todos no mesmo plano em vez de flutuar cada um no seu.
    """
    c, sn = math.cos(TOMBO_PAINEL), math.sin(TOMBO_PAINEL)
    return (x,
            MOSTRADOR_Y + dy * c - dz * sn,
            MOSTRADOR_Z + dy * sn + dz * c)


def desembacador():
    """Grelha do desembacador, rente ao para-brisa.

    E a UNICA coisa que quebra o cocuruto do painel no campo de visao de
    quem dirige. Saida de ar e console ficam em z 0,80 e 0,70, trinta
    centimetros abaixo da borda de baixo da tela da fase 2b: existem para
    as cameras da fase 2a, e nenhum pixel deles chega ao trajeto. O
    desembacador fica na face de CIMA do painel, que e exatamente o que o
    motorista enxerga — e sem ele aquela faixa e um borrao escuro de meio
    metro.
    """
    pecas = []
    rasgo = C.mat_simples("cab_desemb_rasgo", (0.008, 0.009, 0.011),
                          rugosidade=0.72)
    aba = mat_plastico_painel((0.034, 0.036, 0.042))
    for lado, x0, x1 in ((0, -0.74, -0.08), (1, 0.06, 0.70)):
        moldura = C.caixa(f"cab_desemb_{lado}", (x1 - x0, 0.072, 0.014),
                          ((x0 + x1) / 2, -0.735, PAINEL_TOPO - 0.012))
        C.chanfrar(moldura, largura=0.005, segmentos=2)
        C.aplicar(moldura, aba)
        pecas.append(moldura)
        n = int((x1 - x0) / 0.042)
        for i in range(n):
            x = x0 + 0.021 + i * ((x1 - x0 - 0.012) / n)
            f = C.caixa(f"cab_desemb_{lado}_{i}", (0.026, 0.052, 0.010),
                        (x, -0.735, PAINEL_TOPO - 0.009))
            C.aplicar(f, rasgo)
            pecas.append(f)
    return pecas


def instrumentos():
    """Dois relogios com aro, marcacao e ponteiro, e o visor entre eles.

    Relogio de verdade, e nao uma placa escura: o aro cromado separa o
    mostrador do capo, a marcacao diz que e um instrumento e nao um buraco,
    e o PONTEIRO e o que o olho procura. Custa ~900 triangulos no unico
    lugar da cabine que o jogador olha o tempo todo.
    """
    pecas = []
    fundo = C.mat_luminoso("cab_mostrador_fundo", (0.042, 0.050, 0.066), 0.55,
                           rugosidade=0.30)
    cromo = C.mat_simples("cab_mostrador_aro", (0.52, 0.53, 0.55),
                          rugosidade=0.22, metalico=1.0)
    # marcacao e ponteiro ACENDEM: dentro da pala nao entra luz nenhuma, e
    # no render o mostrador saiu como dois buracos pretos de aro cromado.
    # Painel de instrumento de verdade e retroiluminado — nao e licenca
    # poetica, e o unico jeito de ele existir na tela.
    risco = C.mat_luminoso("cab_mostrador_risco", (0.80, 0.82, 0.86), 1.6)
    agulha = C.mat_luminoso("cab_mostrador_agulha", (0.82, 0.10, 0.055), 2.4)

    placa = C.caixa("cab_mostrador", (0.255, 0.010, 0.098),
                    _no_mostrador(VOLANTE.x, 0, 0), rot=(TOMBO_PAINEL, 0, 0))
    C.aplicar(placa, fundo)
    pecas.append(placa)

    # ponteiro de cada relogio: velocimetro parado embaixo a esquerda,
    # conta-giros na marcha lenta. Angulo medido do eixo para baixo.
    # zero de um mostrador fica embaixo a ESQUERDA, em -125 graus. O
    # caminhao esta parado: velocimetro no zero, conta-giros na marcha
    # lenta, um passo acima.
    for i, (dx, grau) in enumerate(((-0.063, -125), (0.063, -98))):
                # AS PROFUNDIDADES SAO EMPILHADAS, nao arbitrarias.
        #
        # Na primeira versao o aro era um disco MACICO de 13 mm centrado em
        # dy 0,012 — ou seja, ocupava de 5,5 a 18,5 mm — e face, marcacao e
        # ponteiro estavam todos DENTRO dele. O render mostrou dois buracos
        # pretos com borda cromada e um pontinho vermelho, e foi exatamente
        # o que o disco deixava escapar. Agora cada camada comeca onde a de
        # baixo termina: aro ate 17 mm, face 17-22, marcacao 22,5-26,5,
        # ponteiro 23,5-28,5.
        aro = C.cilindro(f"cab_relogio_aro_{i}", RAIO_RELOGIO + 0.006, 0.014,
                         _no_mostrador(VOLANTE.x + dx, 0.010, 0), segmentos=24,
                         rot=(math.radians(90) + TOMBO_PAINEL, 0, 0))
        C.aplicar(aro, cromo)
        pecas.append(aro)

        face = C.cilindro(f"cab_relogio_face_{i}", RAIO_RELOGIO, 0.005,
                          _no_mostrador(VOLANTE.x + dx, 0.0195, 0), segmentos=24,
                          rot=(math.radians(90) + TOMBO_PAINEL, 0, 0))
        C.aplicar(face, fundo)
        pecas.append(face)

        # MARCACAO E PONTEIRO POR DOIS PONTOS, nao por angulo de Euler.
        #
        # Com `C.caixa(rot=(TOMBO, a, 0))` o giro do ponteiro acontecia em
        # torno do Y DO MUNDO, depois do tombo de 14 graus do painel — ou
        # seja, fora do plano do mostrador: nos extremos do arco o ponteiro
        # descolava da face. E o X saia espelhado, porque o motorista olha
        # na direcao -Y e nessa vista o +X do mundo aparece a ESQUERDA.
        # Os dois somados punham o zero do velocimetro embaixo a direita.
        #
        # `C.barra` entre dois pontos ja calculados por `_no_mostrador`
        # nao tem nenhuma das duas armadilhas: o que entra e onde a peca
        # comeca e onde termina, nos mesmos eixos em que o mostrador vive.
        def no_relogio(ang, raio, prof=0.0245):
            # ang: 0 = para cima, cresce no sentido horario NA TELA
            return _no_mostrador(VOLANTE.x + dx - math.sin(ang) * raio,
                                 prof, math.cos(ang) * raio)

        for t in range(9):
            a = math.radians(-125 + t * 31.25)
            traco = C.barra(f"cab_relogio_traco_{i}_{t}",
                            no_relogio(a, RAIO_RELOGIO - 0.013),
                            no_relogio(a, RAIO_RELOGIO - 0.003),
                            secao=(0.0042, 0.0042))
            C.aplicar(traco, risco)
            pecas.append(traco)

        a = math.radians(grau)
        pt = C.barra(f"cab_relogio_ponteiro_{i}",
                     no_relogio(a + math.pi, RAIO_RELOGIO * 0.17, 0.026),
                     no_relogio(a, RAIO_RELOGIO * 0.84, 0.026),
                     secao=(0.0052, 0.0052))
        C.aplicar(pt, agulha)
        pecas.append(pt)

        cubo = C.cilindro(f"cab_relogio_cubo_{i}", 0.0070, 0.010,
                          _no_mostrador(VOLANTE.x + dx, 0.028, 0), segmentos=12,
                          rot=(math.radians(90) + TOMBO_PAINEL, 0, 0))
        C.aplicar(cubo, agulha)
        pecas.append(cubo)

    # visor de bordo entre os dois relogios
    visor = C.caixa("cab_mostrador_visor", (0.052, 0.006, 0.026),
                    _no_mostrador(VOLANTE.x, 0.013, -0.006),
                    rot=(TOMBO_PAINEL, 0, 0))
    C.aplicar(visor, C.mat_luminoso("cab_visor", (0.22, 0.52, 0.30), 1.4))
    pecas.append(visor)
    return pecas


def saidas_de_ar():
    """Difusor com MOLDURA, palhetas e botao, nao um retangulo preto.

    Tres palhetas horizontais dentro de uma moldura rebaixada. A palheta e
    o que faz a saida de ar parecer saida de ar: sem ela o painel tem tres
    manchas escuras do mesmo tom do resto e o olho nao le nenhuma delas.
    """
    pecas = []
    moldura_mat = mat_plastico_painel((0.030, 0.032, 0.038))
    vao = C.mat_simples("cab_ar_vao", (0.006, 0.007, 0.009), rugosidade=0.70)
    palheta_mat = C.mat_simples("cab_ar_palheta", (0.090, 0.094, 0.102),
                                rugosidade=0.45)
    for x in (VOLANTE.x + 0.30, VOLANTE.x - 0.46, -0.60):
        z = PAINEL_TOPO - 0.130
        moldura = C.caixa(f"cab_ar_moldura_{x:.2f}", (0.125, 0.034, 0.072),
                          (x, -0.490, z))
        C.chanfrar(moldura, largura=0.007, segmentos=2)
        C.aplicar(moldura, moldura_mat)
        pecas.append(moldura)

        buraco = C.caixa(f"cab_ar_vao_{x:.2f}", (0.108, 0.020, 0.056),
                         (x, -0.496, z))
        C.aplicar(buraco, vao)
        pecas.append(buraco)

        for i, dz in enumerate((-0.018, 0.0, 0.018)):
            pal = C.caixa(f"cab_ar_palheta_{x:.2f}_{i}", (0.104, 0.016, 0.0065),
                          (x, -0.502, z + dz), rot=(math.radians(-14), 0, 0))
            C.aplicar(pal, palheta_mat)
            pecas.append(pal)

        bot = C.cilindro(f"cab_ar_botao_{x:.2f}", 0.0075, 0.012,
                         (x + 0.050, -0.504, z), segmentos=10,
                         rot=(math.radians(90), 0, 0))
        C.aplicar(bot, palheta_mat)
        pecas.append(bot)
    return pecas


def central_do_painel():
    """Radio e ar-condicionado: tela, seis teclas e dois botoes giratorios.

    Era uma caixa preta de 30 x 19 cm — o maior retangulo chapado do
    painel. O conteudo nao precisa ser legivel (o jogador nunca encosta
    nele): precisa ter RITMO, que e o que distingue um console de um vao.
    """
    pecas = []
    x0, y0 = -0.16, -0.500
    z0 = PAINEL_TOPO - 0.230
    corpo = C.caixa("cab_central", (0.30, 0.026, 0.19), (x0, y0, z0))
    C.chanfrar(corpo, largura=0.006, segmentos=2)
    C.aplicar(corpo, mat_plastico_painel((0.026, 0.028, 0.033)))
    pecas.append(corpo)

    tela = C.caixa("cab_central_tela", (0.205, 0.008, 0.062),
                   (x0, y0 - 0.014, z0 + 0.052))
    C.aplicar(tela, C.mat_luminoso("cab_central_vidro", (0.075, 0.145, 0.195),
                                   0.9, rugosidade=0.12))
    pecas.append(tela)

    tecla = C.mat_simples("cab_central_tecla", (0.075, 0.078, 0.086),
                          rugosidade=0.48)
    for i in range(6):
        t = C.caixa(f"cab_central_tecla_{i}", (0.031, 0.009, 0.016),
                    (x0 - 0.115 + i * 0.046, y0 - 0.014, z0 - 0.006))
        C.chanfrar(t, largura=0.003, segmentos=1)
        C.aplicar(t, tecla)
        pecas.append(t)

    for i, dx in enumerate((-0.098, 0.098)):
        b = C.cilindro(f"cab_central_giro_{i}", 0.019, 0.018,
                       (x0 + dx, y0 - 0.018, z0 - 0.052), segmentos=14,
                       rot=(math.radians(90), 0, 0))
        C.aplicar(b, tecla)
        pecas.append(b)
    # fileira de luzes do ar-condicionado, entre os dois giratorios
    for i in range(4):
        l = C.caixa(f"cab_central_luz_{i}", (0.014, 0.006, 0.010),
                    (x0 - 0.036 + i * 0.024, y0 - 0.013, z0 - 0.052))
        C.aplicar(l, C.mat_luminoso("cab_central_luz", (0.72, 0.38, 0.10), 1.8))
        pecas.append(l)
    return pecas


def hastes_da_coluna():
    """Seta e limpador, os dois gravetos atras do volante.

    Entram porque a fase 2b COBRA a seta: o jogador ouve "ligue a seta" e
    nao havia seta nenhuma na cabine para ligar.
    """
    pecas = []
    plast = C.mat_simples("cab_haste", (0.040, 0.042, 0.048), rugosidade=0.42)
    for lado, nome in ((-1, "seta"), (1, "limpador")):
        h = C.barra(f"cab_haste_{nome}",
                    (VOLANTE.x + lado * 0.052, -0.455, VOLANTE.z + 0.012),
                    (VOLANTE.x + lado * 0.128, -0.420, VOLANTE.z - 0.018),
                    secao=(0.014, 0.014))
        C.aplicar(h, plast)
        pecas.append(h)
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

# Y DO BANCO. Era 0,26, e com ele o motorista NAO ALCANCAVA O VOLANTE.
#
# Medido no rig, com o corpo sentado: ombro em y 0,31, aro em y -0,37, e
# alcance de braco (ombro ao punho) de 0,530 m. A distancia do ombro ate o
# ponto de pegada era 0,73 m. Nem com o braco reto a mao chegava — e nem o
# ponto mais proximo do aro, o de baixo, estava a menos de 0,64 m.
#
# Era por isso que o motorista aparecia com os bracos caidos ao lado do corpo
# numa cabine, e o cliente escreveu "o personagem ta duraco". Nao era pose:
# era a cabine impedindo a pose.
#
# Com 0,08 o quadril fica a 0,46 m do aro, que e a faixa de caminhao de
# verdade (0,40 a 0,50), e o braco pega o aro a 0,49 m — cotovelo levemente
# dobrado, que e como se dirige.
Y_BANCO = 0.08
#: quanto tudo que acompanha o ocupante andou junto com o banco
DESLOC_BANCO = Y_BANCO - 0.26


def banco(nome, x, encosto=1.02, recuo=0.0):
    """Assento, encosto e apoio de cabeca. O apoio e peca separada porque a
    altura dele e um dos itens conferidos na fase 2."""
    tecido = mat_tecido_banco()
    y = Y_BANCO + recuo
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
    y = Y_BANCO + 0.30
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
    """Freio de mao. Puxado ou solto — e um dos itens da conferencia.

    NOME POR ESTADO: os dois saem no mesmo `.glb` e o jogo liga um de cada
    vez. Com o mesmo nome, o exportador junta os dois numa peca so e soltar
    o freio nao muda nada na tela — que foi exatamente o que o cliente viu.
    """
    ang = math.radians(-38 if puxado else -6)
    base = Vector((-0.09, 0.06, 0.30))
    alavanca = C.caixa("cab_freio_p" if puxado else "cab_freio_s",
                       (0.036, 0.30, 0.040), (0, 0, 0), rot=(ang, 0, 0))
    bm = bmesh.new(); bm.from_mesh(alavanca.data)
    for v in bm.verts:
        v.co += base + Vector((0, -0.13 * math.cos(ang), -0.13 * math.sin(ang)))
    bm.to_mesh(alavanca.data); bm.free(); alavanca.data.update()
    C.chanfrar(alavanca, largura=0.010, segmentos=2)
    # Mesmo problema do cinto: com albedo 0,024 a alavanca e preta sobre um
    # console preto e a pergunta nao tem resposta na imagem. Cinza de borracha
    # de coifa, que e o que cobre alavanca de freio de verdade.
    C.aplicar(alavanca, C.mat_simples("freio", (0.105, 0.108, 0.116),
                                      rugosidade=0.58))
    return [alavanca]


def cinto(afivelado=True, lado=1):
    """Cinto de tres pontos. Afivelado cruza o peito; solto fica junto ao
    pilar. E o item mais importante da conferencia — e o unico que o jogador
    vai procurar primeiro."""
    x = -X_MOTORISTA if lado < 0 else X_MOTORISTA
    meia = LARGURA / 2
    ancora_alta = Vector((lado * (meia - 0.04), 0.42, 1.18))
    # a fivela mora no banco, entao anda com ele; as duas ancoras ficam no
    # pilar, que nao se mexe — e e essa diferenca que da o desenho do cinto
    fivela = Vector((x - 0.22, 0.30 + DESLOC_BANCO, ALTURA_ASSENTO + 0.04))
    ancora_baixa = Vector((lado * (meia - 0.06), 0.30, ALTURA_ASSENTO - 0.08))

    if afivelado:
        """
        O CAMINHO SAI DO CORPO DO MOTORISTA, nao do banco vazio.

        Ele foi desenhado quando o banco estava vazio e nunca foi revisto
        depois que o motorista entrou. Com `DESLOC_BANCO` em -0,18, o ponto
        do peito caia em y = 0,00 — e o peito dele esta em y = 0,237. Ou
        seja: a faixa passava 23,7 cm DENTRO do torax, medido na cena. Na
        tela, cinto entrando no personagem.

        Os numeros abaixo sao a frente do corpo medida altura por altura, em
        faixas de 5 cm, mais 3,5 cm de folga para a faixa pousar por cima e
        nao rasante:

            z 1,10 -> 0,161    z 0,90 -> 0,237
            z 1,00 -> 0,203    z 0,60 -> 0,210
            z 0,95 -> 0,228    z 0,45 -> 0,252

        Quem mexer no banco ou no fisico do motorista tem de refazer esta
        medicao — ela vale para ESTE corpo nesta posicao.
        """
        caminho = [
            tuple(ancora_alta),
            tuple(Vector((x + 0.06, 0.200, 1.10))),                  # ombro
            tuple(Vector((x + 0.01, 0.275, 0.92))),                  # peito
            tuple(Vector((x - 0.09, 0.250, ALTURA_ASSENTO + 0.20))),  # abdome
            tuple(fivela),
            tuple(Vector((x + 0.05, 0.280, ALTURA_ASSENTO - 0.02))),  # colo
            tuple(ancora_baixa),
        ]
    else:
        '''
        O CINTO SOLTO TEM DE SER VISTO, senao ele nao existe.

        O caminho antigo ia de ancora a ancora rente ao pilar — x 0,75,
        0,74, 0,73, y 0,36-0,40 — uma fita colada na coluna, ATRAS do ombro
        do motorista. O cliente disse "o cinto de seguranca sumiu".

        A primeira tentativa trouxe a fita 13 cm para DENTRO, e piorou:
        pintando a peca de vermelho na cena para achar onde ela estava, o
        que se viu foi a fita indo parar exatamente atras do ombro dele —
        inboard demais e atras demais. O eixo que faltava era o Y.

        Agora ela pende para a FRENTE (y 0,23-0,26, contra 0,36 de antes) e
        fica no x do pilar: passa na frente da coluna e por FORA do ombro,
        que e onde alguem enxerga o proprio cinto solto.
        '''
        caminho = [
            tuple(ancora_alta),
            tuple(Vector((lado * (meia - 0.07), 0.26, 1.00))),
            tuple(Vector((lado * (meia - 0.09), 0.23, 0.80))),
            tuple(Vector((lado * (meia - 0.08), 0.26, ALTURA_ASSENTO + 0.08))),
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
    # HASTE. O espelho flutuava a 4 cm de tudo, no meio do ar, bem no alto da
    # vista do motorista — e uma das "partes voando". Sobe ate a travessa do
    # para-brisa, que e onde retrovisor interno se prende de verdade.
    alvo = Vector((-0.02, PARABRISA_TOPO - 0.03, ALTURA - 0.050))
    base = Vector((-0.02, -0.46, 1.335 + 0.040))
    meio = (base + alvo) / 2
    d = alvo - base
    haste = C.caixa("cab_retro_haste", (0.034, 0.028, d.length + 0.05),
                    tuple(meio), rot=(-math.atan2(d.y, d.z), 0, 0))
    C.aplicar(haste, moldura)
    return [interno, face, haste]


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

    # VINCOS E FRISOS DO CAPO (17/10).
    #
    # Medido na tela do jogo, nao no render: do olho da fase 2b o painel de
    # dentro nunca aparece — fica em px 970 de 1038, debaixo dos botoes. A
    # faixa de baixo da tela, que o cliente chamou de "prototipo", e o CAPO,
    # e ele era uma caixa chanfrada lisa de 1,76 x 1,60 m. Um terco da tela,
    # a coisa mais perto da camera, e sem uma linha.
    #
    # Tres pecas resolvem: as duas frestas que separam o capo dos paralamas
    # e o vinco central. Sao as linhas que o olho usa para ler chapa em vez
    # de bloco, e sao as unicas que estao na faixa visivel.
    tinta_escura = C.mat_simples("cab_capo_fresta", (0.012, 0.016, 0.026),
                                 rugosidade=0.65)
    for lado in (-1, 1):
        fresta = C.caixa(f"cab_capo_fresta_{lado}", (0.022, 1.52, 0.030),
                         (lado * 0.775, PARABRISA_BASE - 0.80,
                          PAINEL_TOPO - 0.206),
                         rot=(math.radians(7.0), 0, 0))
        C.aplicar(fresta, tinta_escura)
        pecas.append(fresta)
        # vinco: um degrau raso de 3 cm acompanhando a fresta por dentro
        vinco = C.caixa(f"cab_capo_vinco_{lado}", (0.075, 1.46, 0.024),
                        (lado * 0.690, PARABRISA_BASE - 0.80,
                         PAINEL_TOPO - 0.198),
                        rot=(math.radians(7.0), 0, 0))
        C.chanfrar(vinco, largura=0.010, segmentos=2)
        C.aplicar(vinco, C.mat_simples("pintura3", (0.030, 0.062, 0.115),
                                       rugosidade=0.22))
        pecas.append(vinco)

    # NERVURA do meio-capo, de cada lado.
    #
    # Medido projetando o capo na tela do jogo: a camera esta em x +0,38 e o
    # que cabe no quadro e a METADE DO MOTORISTA, de x +0,1 a +0,9. O lombo
    # central (x 0) cai fora da tela pela direita — bonito no render, zero
    # pixel no jogo. A nervura em x +0,45 esta no meio da faixa que aparece,
    # e e ela que faz a chapa pegar luz diferente dos dois lados em vez de
    # devolver o mesmo azul em 300 px de tela.
    for lado in (-1, 1):
        nerv = C.caixa(f"cab_capo_nervura_{lado}", (0.090, 1.40, 0.026),
                       (lado * 0.450, PARABRISA_BASE - 0.82,
                        PAINEL_TOPO - 0.200),
                       rot=(math.radians(7.0), 0, 0))
        C.chanfrar(nerv, largura=0.020, segmentos=3)
        C.aplicar(nerv, C.mat_simples("pintura5", (0.030, 0.062, 0.115),
                                      rugosidade=0.22))
        pecas.append(nerv)

    """
    A FRENTE DO CAPO, que era chapa lisa ate o horizonte.

    As frestas e a nervura quebraram o MEIO do capo. A ponta dele continuou
    vazia, e a ponta e o que faz fronteira com a via: medido projetando o
    capo na tela, a borda da frente (y -2,4) cai em px 724 e o cocuruto
    (y -0,9) em px 990, entao a faixa de y -1,1 a -2,4 e a que o jogador
    enxerga o tempo todo. Tudo aqui mora nela.

    Quatro coisas, e nenhuma e enfeite: a aba escura da frente (que e onde
    o capo encontra a grade), as duas lanternas de posicao nas quinas —
    EMISSIVAS, pela mesma licao da lanterna de freio: a 2 m da camera uma
    luz que nao estoura nao le como luz —, as tomadas de ar e o emblema no
    eixo. Juntas elas dao ao capo uma FRENTE, que e o que faltava para ele
    parar de ser uma mesa azul.
    """
    escuro = C.mat_simples("cab_capo_grade", (0.016, 0.017, 0.021),
                           rugosidade=0.80)
    y_frente = PARABRISA_BASE - 1.58
    z_frente = PAINEL_TOPO - 0.215 + math.tan(math.radians(7.0)) * (-0.78) + 0.045

    aba = C.caixa("cab_capo_aba", (1.70, 0.16, 0.055),
                  (0, y_frente, z_frente - 0.030),
                  rot=(math.radians(7.0), 0, 0))
    C.chanfrar(aba, largura=0.014, segmentos=2)
    C.aplicar(aba, escuro)
    pecas.append(aba)

    for lado in (-1, 1):
        luz = C.caixa(f"cab_capo_posicao_{lado}", (0.165, 0.13, 0.045),
                      (lado * 0.72, y_frente + 0.02, z_frente + 0.010),
                      rot=(math.radians(7.0), 0, 0))
        C.chanfrar(luz, largura=0.010, segmentos=2)
        C.aplicar(luz, C.mat_luminoso(f"cab_posicao_{lado}",
                                      (0.78, 0.40, 0.085), 1.5))
        pecas.append(luz)

        # tomada de ar: moldura rasa com tres palhetas, no meio da faixa
        y_ar = PARABRISA_BASE - 1.00
        z_ar = PAINEL_TOPO - 0.215 + math.tan(math.radians(7.0)) * (-0.20) + 0.047
        moldura = C.caixa(f"cab_capo_ar_{lado}", (0.34, 0.26, 0.030),
                          (lado * 0.44, y_ar, z_ar),
                          rot=(math.radians(7.0), 0, 0))
        C.chanfrar(moldura, largura=0.012, segmentos=2)
        C.aplicar(moldura, C.mat_simples("cab_capo_ar_moldura",
                                         (0.026, 0.028, 0.034), rugosidade=0.55))
        pecas.append(moldura)
        for i, dy in enumerate((-0.072, 0.0, 0.072)):
            pal = C.caixa(f"cab_capo_ar_pal_{lado}_{i}", (0.30, 0.040, 0.022),
                          (lado * 0.44, y_ar + dy, z_ar + 0.012),
                          rot=(math.radians(7.0 - 16), 0, 0))
            C.aplicar(pal, escuro)
            pecas.append(pal)

    emblema = C.cilindro("cab_capo_emblema", 0.075, 0.016,
                         (0, PARABRISA_BASE - 1.42,
                          PAINEL_TOPO - 0.215
                          + math.tan(math.radians(7.0)) * (-0.62) + 0.052),
                         segmentos=14, rot=(math.radians(7.0), 0, 0))
    C.aplicar(emblema, C.mat_simples("cab_capo_emblema", (0.52, 0.53, 0.55),
                                     rugosidade=0.22, metalico=1.0))
    pecas.append(emblema)

    # lombo central: a elevacao que todo capo de caminhonete tem no eixo
    lombo = C.caixa("cab_capo_lombo", (0.62, 1.44, 0.040),
                    (0, PARABRISA_BASE - 0.82, PAINEL_TOPO - 0.196),
                    rot=(math.radians(7.0), 0, 0))
    C.chanfrar(lombo, largura=0.028, segmentos=3)
    C.aplicar(lombo, C.mat_simples("pintura4", (0.030, 0.062, 0.115),
                                   rugosidade=0.22))
    pecas.append(lombo)

    paralama = []
    for lado in (-1, 1):
        p = C.caixa(f"cab_paralama_{lado}", (0.21, 1.52, 0.15),
                    (lado * 0.865, PARABRISA_BASE - 0.78, PAINEL_TOPO - 0.158),
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
    """Celular. Solto no painel e o estado errado; guardado no console e o certo.

    POUSADO NA PRATELEIRA DO PAINEL, e nao no ar.

    O y antigo (-0,455) nao tem painel NENHUM embaixo: medindo com raio para
    baixo, dali o raio atravessa o vao e so encontra o console 70 cm abaixo.
    O celular ficava boiando no meio da cabine, que foi o que o cliente viu.

    O cocuruto do painel tem uma prateleira de 10 graus entre y -0,60 e
    -0,69 (medido de 12 em 12 mm). O celular deita nela, com a MESMA
    inclinacao de 10 graus — a de 14 graus era chute e nao batia com
    superficie nenhuma.
    """
    pos = (-0.10, -0.644, 0.912) if not guardado else (0.0, -0.05, 0.315)
    rot = (math.radians(-10), 0, math.radians(8)) if not guardado else (0, 0, 0)
    tela = C.caixa("cab_celular", (0.072, 0.148, 0.009), pos, rot=rot)
    C.chanfrar(tela, largura=0.003, segmentos=2)
    C.aplicar(tela, C.mat_simples("celular", (0.010, 0.011, 0.014),
                                  rugosidade=0.15))
    return [tela]


def prancheta(preenchida=False):
    """Prancheta com o checklist, no ASSENTO do banco do passageiro.

    Estava em y=+0,30, que nao e onde se senta: ali ja e o ENCOSTO, cuja
    superficie medida esta em z=0,747. A prancheta, pousada em z=0,512,
    nascia dentro da espuma do encosto — aparecia metade dela saindo do
    estofado.

    y=+0,02 cai na almofada, cuja superficie e plana e medida em z=0,400 em
    toda a volta. E deita PLANA: a inclinacao de 6 graus so servia para
    enterrar uma ponta.
    """
    base = Vector((-0.40, 0.02, ALTURA_ASSENTO + 0.008))
    giro = (0, 0, math.radians(-12))
    tabua = C.caixa("cab_prancheta", (0.225, 0.315, 0.010), tuple(base), rot=giro)
    C.chanfrar(tabua, largura=0.004, segmentos=2)
    C.aplicar(tabua, C.mat_simples("prancheta", (0.085, 0.062, 0.038),
                                   rugosidade=0.72))
    folha = C.caixa("cab_folha", (0.200, 0.285, 0.002),
                    tuple(base + Vector((0, 0, 0.007))), rot=giro)
    C.aplicar(folha, C.mat_simples("papel", (0.72, 0.71, 0.68), rugosidade=0.90))
    pecas = [tabua, folha]
    if preenchida:
        tinta = C.mat_simples("tinta", (0.020, 0.030, 0.090), rugosidade=0.6)
        for i in range(7):
            marca = C.caixa(f"cab_marca_{i}", (0.014, 0.014, 0.0012),
                            tuple(base + Vector((-0.072, 0.108 - i * 0.033, 0.009))),
                            rot=giro)
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
    # o freio NAO entra aqui: ele tem par de estado, em `estados()`
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
        "freio_puxado": freio_de_mao(puxado=True),
        "freio_solto": freio_de_mao(puxado=False),
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
