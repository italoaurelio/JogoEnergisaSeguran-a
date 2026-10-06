"""
Cena da ocorrencia (fase 3): poste com transformador na via, caminhonete e o
material de sinalizacao.

Reaproveita o que ja existia do cenario descartado — `poste.py` (poste, cruzeta,
isoladores, transformador, condutores) e `cenario.py` (via, quadra,
caminhonete, cone, caixa de ferramentas, escada). O cliente descartou aquele
cenario como FASE; a arte continua valendo.

O que muda: aqui a cena chega LIMPA, sem os nove riscos plantados. Quem coloca
cone, cavalete e fita e o jogador, e por isso essas pecas saem como nos
separados para o jogo posicionar.
"""
import math, bmesh, bpy
from mathutils import Vector

import comum as C
import poste as P
import cenario as CEN

R = math.radians


def materiais():
    m = CEN.materiais()
    # pelicula refletiva e BRANCA, quase sem cor. O cinza de antes (0,62 nos
    # tres canais, mas puxado para o verde) sumia contra o laranja e a faixa
    # do cavalete lia como uma listra suja.
    m["refletivo"] = C.mat_simples("oc_refletivo", (0.80, 0.81, 0.80),
                                   rugosidade=0.22)
    m["laranja"] = C.mat_simples("oc_laranja", (0.62, 0.115, 0.010),
                                 rugosidade=0.45)
    m["fita"] = C.mat_simples("oc_fita", (0.70, 0.33, 0.012), rugosidade=0.68)
    # a outra metade da fita ZEBRADA. Sem ela a peca era uma tira amarela
    # lisa — o nome prometia listra e o modelo nao entregava nenhuma.
    m["fita_escura"] = C.mat_simples("oc_fita_escura", (0.022, 0.021, 0.020),
                                     rugosidade=0.70)
    return m


def cavalete(m, nome="oc_cavalete"):
    """Cavalete de sinalizacao: a placa que se ve de longe, antes do cone.

    A versao anterior era uma prancha com quatro palitos: as pernas eram
    caixas isoladas, sem nada que as ligasse, e a placa boiava acima delas
    sem encosto. Aqui o cavalete e o que ele e de verdade — dois cavaletes em
    A ligados por uma travessa, com a placa aparafusada no topo e um
    travamento em X que impede que ele ande. E o travamento que da a leitura
    de "equipamento de obra" em vez de "banco de parquinho".

    `pos_faixa` sao faixas INCLINADAS alternando refletivo e laranja, que e o
    desenho normatizado da sinalizacao de obra.
    """
    pecas = []
    larg, alt = 0.72, 0.98

    for lado in (-1, 1):          # os dois cavaletes em A, um em cada ponta
        x = lado * larg / 2
        for dy in (-1, 1):
            perna = C.caixa(f"{nome}_perna_{lado}_{dy}", (0.050, 0.046, alt),
                            (x, dy * 0.145, alt / 2),
                            rot=(R(-8.5 * dy), 0, 0))
            C.aplicar(perna, m["laranja"])
            pecas.append(perna)
        # travessa que fecha o A: sem ela as duas pernas sao dois palitos
        tv = C.caixa(f"{nome}_tv_{lado}", (0.044, 0.40, 0.040), (x, 0, 0.30))
        C.chanfrar(tv, largura=0.005, segmentos=2)
        C.aplicar(tv, m["laranja"])
        pecas.append(tv)
        # sapata de borracha: o pe tem de ter area, senao o cavalete parece
        # equilibrado na quina
        for dy in (-1, 1):
            pe = C.caixa(f"{nome}_pe_{lado}_{dy}", (0.075, 0.090, 0.022),
                         (x, dy * 0.218, 0.011))
            C.chanfrar(pe, largura=0.006, segmentos=2)
            C.aplicar(pe, m["borracha"])
            pecas.append(pe)

    # longarina inferior ligando os dois cavaletes
    lon = C.caixa(f"{nome}_longarina", (larg, 0.038, 0.034), (0, 0, 0.255))
    C.chanfrar(lon, largura=0.005, segmentos=2)
    C.aplicar(lon, m["laranja"])
    pecas.append(lon)

    # placa: painel com moldura, nao uma tabua
    placa = C.caixa(f"{nome}_placa", (0.86, 0.028, 0.34), (0, 0, alt + 0.15))
    C.chanfrar(placa, largura=0.010, segmentos=2)
    C.aplicar(placa, m["laranja"])
    pecas.append(placa)
    for i in range(5):
        faixa = C.caixa(f"{nome}_faixa_{i}", (0.105, 0.034, 0.30),
                        (-0.34 + i * 0.17, 0, alt + 0.15), rot=(0, R(-30), 0))
        C.aplicar(faixa, m["refletivo"])
        pecas.append(faixa)

    return C.juntar(pecas, nome)


def fita_zebrada(m, nome="oc_fita_vao", comprimento=3.0):
    """Um vao de fita zebrada entre dois pontos, com barriga.

    Peca de UM vao: o jogo repete e gira para cercar a area. Modelar o
    retangulo inteiro travaria o tamanho da area, que e justamente o que o
    jogador decide.
    """
    # A LISTRA e feita de geometria, nao de textura: cada quadrilatero da
    # tira e uma faixa, e os quadrilateros alternam entre o material claro e
    # o escuro. Textura procedural nao exporta para glTF (ver a armadilha no
    # exportador) e pintar um atlas para uma tira de 2 mm seria desperdicio.
    #
    # A fileira de cima e amostrada MEIA FAIXA adiantada em relacao a de
    # baixo: isso torce cada quadrilatero num paralelogramo e e o que da a
    # inclinacao da listra zebrada de verdade.
    bm = bmesh.new()
    passos = 20
    desloc = 0.5 / passos
    linhas = []
    for j, z in enumerate((0.0, 0.075)):
        linha = []
        for i in range(passos + 1):
            t = i / passos + (desloc if j else 0.0)
            queda = -0.055 * math.sin(math.pi * min(max(t, 0.0), 1.0))
            linha.append(bm.verts.new((0, comprimento * t, z + queda)))
        linhas.append(linha)
    faces = []
    for i in range(passos):
        faces.append(bm.faces.new((linhas[0][i], linhas[0][i + 1],
                                   linhas[1][i + 1], linhas[1][i])))
    for i, f in enumerate(faces):
        f.material_index = i % 2
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = C.obj_de_bmesh(bm, nome)
    mod = obj.modifiers.new("espessura", "SOLIDIFY")
    mod.thickness = 0.002
    obj.data.materials.append(m["fita"])
    obj.data.materials.append(m["fita_escura"])
    return obj


def cenario_limpo():
    """Poste com transformador, via e quadra — sem nenhum risco plantado.

    Devolve o dicionario de materiais, e ele nasce AQUI DENTRO de proposito:
    `poste.montar()` comeca chamando `comum.limpar()`, que apaga o arquivo
    inteiro. Materiais criados antes viram referencia morta e o script quebra
    com "StructRNA of type Material has been removed" — bem longe de onde o
    erro realmente aconteceu.
    """
    P.montar()
    if "chao" in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects["chao"], do_unlink=True)
    m = materiais()
    CEN.via(m)
    CEN.quadra(m)
    return m
