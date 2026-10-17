"""Pecas do cenario "manutencao em poste na via publica".

Nomes com prefixo `risco_` sao os alvos clicaveis do jogo; o resto e cenario.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P cenario.py
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import poste as P

R = math.radians


# ------------------------------------------------------------------ materiais
def verniz(mat, peso=1.0, aspereza=0.18):
    """Camada de verniz sobre a pintura.

    E o que separa carro pintado de caixa colorida: a pintura tem um reflexo
    especular PROPRIO, mais nitido que o da cor por baixo, e e esse segundo
    reflexo que o olho usa para ler a curvatura da lataria. Sem ele o capo e
    a porta ficam do mesmo tom chapado em qualquer angulo.
    """
    b = C._principled(mat)
    C._set(b, "Coat Weight", peso)
    C._set(b, "Coat Roughness", aspereza)
    # nomes antigos do Blender, ignorados quando nao existem
    C._set(b, "Clearcoat", peso)
    C._set(b, "Clearcoat Roughness", aspereza)
    return mat


def materiais():
    m = {}
    m["pintura"] = verniz(
        C.sujar(C.mat_simples("pintura_branca", (0.58, 0.59, 0.60),
                              rugosidade=0.30), escala=2.5, forca=0.12,
                aspereza=0.10))
    # O farol nao e cromo: cromo so espelha o que esta em volta e, numa cena
    # de dia sem nada na frente, vira uma caixa cinza. Lente clara com verniz
    # por cima le como vidro de farol.
    m["lente"] = verniz(C.mat_simples("farol_lente", (0.78, 0.79, 0.82),
                                      rugosidade=0.08), peso=1.0, aspereza=0.03)
    m["lanterna"] = verniz(C.mat_simples("lanterna", (0.52, 0.045, 0.030),
                                         rugosidade=0.16), peso=1.0, aspereza=0.05)
    m["vidro"] = C.mat_simples("vidro", (0.030, 0.034, 0.040), rugosidade=0.06)
    m["borracha"] = C.sujar(C.mat_simples("borracha", (0.018, 0.019, 0.021),
                                          rugosidade=0.88), escala=28, forca=0.25)
    m["cromo"] = C.mat_simples("cromo", (0.58, 0.59, 0.61), rugosidade=0.22,
                               metalico=1.0)
    m["aco"] = C.sujar(C.mat_simples("aco_pintado", (0.16, 0.165, 0.17),
                                     rugosidade=0.48), escala=8, forca=0.25)
    m["fibra"] = C.sujar(C.mat_simples("fibra", (0.44, 0.33, 0.045),
                                       rugosidade=0.42), escala=6, forca=0.18)
    m["laranja"] = C.sujar(C.mat_simples("laranja", (0.66, 0.14, 0.022),
                                         rugosidade=0.44), escala=10, forca=0.22)
    m["capacete"] = C.sujar(C.mat_simples("capacete", (0.72, 0.56, 0.028),
                                          rugosidade=0.26), escala=12, forca=0.15)
    m["luva"] = C.sujar(C.mat_simples("luva", (0.44, 0.12, 0.035),
                                      rugosidade=0.70), escala=20, forca=0.22)
    m["cabo_fer"] = C.sujar(C.mat_simples("cabo_ferramenta", (0.42, 0.075, 0.035),
                                          rugosidade=0.52), escala=16, forca=0.2)
    m["papel"] = C.mat_simples("papel", (0.76, 0.75, 0.72), rugosidade=0.76)
    # pelicula refletiva do cone e do cavalete. Nasce AQUI porque o cone e
    # peca do cenario; `ocorrencia.materiais()` so a reafina.
    m["refletivo"] = C.mat_simples("refletivo", (0.80, 0.81, 0.80),
                                   rugosidade=0.22)
    m["madeira_c"] = C.mat_textura("madeira_cx", "plywood", escala=2.2,
                                   saturacao=0.65)
    m["asfalto"] = C.mat_textura("asfalto_rua", "asphalt_04", escala=1.4,
                                 cor_mistura=(0.26, 0.26, 0.28), saturacao=0.2)
    # Era `concrete_wall_008`, que tem desvio padrao de 1,5 em 255 — um
    # arquivo de cinza chapado, nao uma textura (ver a nota no material do
    # poste). A calcada da ocorrencia aparece no chao da cena inteira e
    # sofria exatamente do defeito que o cliente apontou.
    m["calcada"] = C.mat_textura("calcada", "dirty_concrete", escala=2.0,
                                 cor_mistura=(0.54, 0.54, 0.53), saturacao=0.35,
                                 brilho=0.95)
    m["terra"] = C.mat_textura("terra", "dirt_floor", escala=1.8,
                               cor_mistura=(0.34, 0.33, 0.26), saturacao=0.85,
                               brilho=0.7)
    for nome, cor in (("parede_a", (0.52, 0.47, 0.40)),
                      ("parede_b", (0.38, 0.42, 0.44)),
                      ("parede_c", (0.55, 0.50, 0.38)),
                      ("parede_d", (0.44, 0.40, 0.39))):
        m[nome] = C.sujar(C.mat_simples(nome, cor, rugosidade=0.76),
                          escala=3.0, forca=0.22)
    m["telha"] = C.sujar(C.mat_simples("telha", (0.28, 0.14, 0.085),
                                       rugosidade=0.82), escala=9, forca=0.25)
    return m


# ------------------------------------------------------------------ veiculo
def roda(nome, pos, raio=0.37, largura=0.26):
    pneu = C.cilindro(nome, raio, largura, (0, 0, 0), segmentos=32,
                      rot=(R(90), 0, 0))
    C.chanfrar(pneu, largura=0.055, segmentos=3, angulo=30)
    aro = C.cilindro(nome + "_aro", raio * 0.56, largura * 1.03, (0, 0, 0),
                     segmentos=24, rot=(R(90), 0, 0))
    C.chanfrar(aro, largura=0.010, segmentos=2)
    obj = C.juntar([pneu, aro], nome)
    obj.location = pos
    return obj


def caminhonete(m):
    """Picape cabine dupla: capo baixo na frente, cabine alta, cacamba atras."""
    corpo, vidros, pretos, cromados = [], [], [], []
    lentes, lanternas = [], []
    L = 1.84                       # largura
    Z0, Z1 = 0.44, 1.00            # faixa do corpo inferior

    corpo.append(C.chanfrar(
        C.caixa("cm_corpo", (5.30, L, Z1 - Z0), (0, 0, (Z0 + Z1) / 2)),
        largura=0.05, segmentos=3, angulo=50))

    # capo, mais baixo que a cabine
    corpo.append(C.chanfrar(
        C.caixa("cm_capo", (1.70, L * 0.99, 0.20), (-1.70, 0, Z1 + 0.09)),
        largura=0.055, segmentos=3, angulo=50))

    # cabine dupla
    corpo.append(C.chanfrar(
        C.caixa("cm_cabine", (1.92, L * 0.98, 0.76), (0.08, 0, Z1 + 0.38)),
        largura=0.10, segmentos=4, angulo=50))

    # paredes da cacamba e tampa traseira
    for dy in (-1, 1):
        corpo.append(C.chanfrar(
            C.caixa(f"cm_lat{dy}", (1.66, 0.10, 0.44),
                    (1.80, dy * (L / 2 - 0.05), Z1 + 0.22)),
            largura=0.02, segmentos=2))
    corpo.append(C.chanfrar(
        C.caixa("cm_tampa", (0.09, L, 0.44), (2.60, 0, Z1 + 0.22)),
        largura=0.02, segmentos=2))

    # vidros: para-brisa inclinado, laterais e traseiro
    vidros.append(C.caixa("cm_parabrisa", (0.06, L * 0.88, 0.66),
                          (-0.78, 0, Z1 + 0.42), rot=(0, R(-26), 0)))
    for dy in (-1, 1):
        for dx in (-0.30, 0.52):
            vidros.append(C.caixa(f"cm_vid{dy}{dx}", (0.66, 0.05, 0.40),
                                  (dx, dy * (L / 2 - 0.025), Z1 + 0.46)))
    vidros.append(C.caixa("cm_vidtras", (0.05, L * 0.84, 0.40),
                          (1.00, 0, Z1 + 0.46), rot=(0, R(9), 0)))

    # gaiola sobre a cacamba
    for dy in (-1, 1):
        for dx in (1.10, 2.48):
            cromados.append(C.cilindro(f"cm_tubo{dy}{dx}", 0.032, 0.66,
                                       (dx, dy * (L / 2 - 0.12), Z1 + 0.75),
                                       segmentos=12))
        cromados.append(C.cilindro(f"cm_long{dy}", 0.032, 1.42,
                                   (1.79, dy * (L / 2 - 0.12), Z1 + 1.07),
                                   segmentos=12, rot=(0, R(90), 0)))
    for dx in (1.10, 2.48):
        cromados.append(C.cilindro(f"cm_trav{dx}", 0.032, L - 0.24,
                                   (dx, 0, Z1 + 1.07), segmentos=12,
                                   rot=(R(90), 0, 0)))

    # para-choques, grade, farois, retrovisores, caixas de roda
    for dx, nome in ((-2.72, "diant"), (2.70, "tras")):
        pretos.append(C.chanfrar(
            C.caixa(f"cm_pc_{nome}", (0.14, L * 0.99, 0.24), (dx, 0, Z0 + 0.14)),
            largura=0.03, segmentos=2))
    # grade com friso: tres lameres horizontais em vez de uma chapa lisa. E
    # pouca geometria e e o que da sombra propria na frente do veiculo.
    pretos.append(C.caixa("cm_grade", (0.06, L * 0.78, 0.22), (-2.60, 0, Z1 - 0.14)))
    for i, dz in enumerate((-0.07, 0.0, 0.07)):
        cromados.append(C.caixa(f"cm_friso{i}", (0.045, L * 0.74, 0.030),
                                (-2.645, 0, Z1 - 0.14 + dz)))
    for dy in (-1, 1):
        # moldura escura e lente clara por dentro
        pretos.append(C.chanfrar(
            C.caixa(f"cm_farol_moldura{dy}", (0.10, 0.44, 0.20),
                    (-2.59, dy * 0.58, Z1 - 0.14)), largura=0.03, segmentos=2))
        lentes.append(C.chanfrar(
            C.caixa(f"cm_farol{dy}", (0.07, 0.38, 0.15),
                    (-2.625, dy * 0.58, Z1 - 0.14)), largura=0.02, segmentos=2))
        # lanterna traseira: nao havia nenhuma, e a traseira e justamente o
        # angulo de que o jogador ve o veiculo estacionado na ocorrencia
        lanternas.append(C.chanfrar(
            C.caixa(f"cm_lanterna{dy}", (0.06, 0.16, 0.34),
                    (2.745, dy * (L / 2 - 0.14), Z1 + 0.06)),
            largura=0.02, segmentos=2))
        pretos.append(C.chanfrar(
            C.caixa(f"cm_retro{dy}", (0.08, 0.20, 0.13),
                    (-0.66, dy * (L / 2 + 0.09), Z1 + 0.56)),
            largura=0.02, segmentos=2))
        for dx in (-1.55, 1.62):
            pretos.append(C.chanfrar(
                C.caixa(f"cm_para{dy}{dx}", (1.02, 0.07, 0.30),
                        (dx, dy * (L / 2 + 0.015), Z0 + 0.06)),
                largura=0.03, segmentos=2))

    rodas = [roda(f"cm_roda{i}", (dx, dy * (L / 2 - 0.04), 0.37))
             for i, (dx, dy) in enumerate([(-1.55, -1), (-1.55, 1),
                                           (1.62, -1), (1.62, 1)])]

    partes = [
        (C.juntar(corpo, "cm_pintura"), m["pintura"]),
        (C.juntar(vidros, "cm_vidros"), m["vidro"]),
        (C.juntar(pretos, "cm_pretos"), m["aco"]),
        (C.juntar(cromados, "cm_cromados"), m["cromo"]),
        (C.juntar(rodas, "cm_rodas"), m["borracha"]),
        (C.juntar(lentes, "cm_lentes"), m["lente"]),
        (C.juntar(lanternas, "cm_lanternas"), m["lanterna"]),
    ]
    for obj, mat in partes:
        C.aplicar(obj, mat)
    return C.juntar([o for o, _ in partes], "cenario_veiculo")


def carga_solta(m):
    """Risco 7: material solto na cacamba, sem amarracao."""
    pecas = []
    cx = C.chanfrar(C.caixa("cg_cx", (0.72, 0.46, 0.36), (1.52, -0.40, 1.42),
                            rot=(0, 0, R(14))), largura=0.012, segmentos=2)
    C.aplicar(cx, m["madeira_c"])
    pecas.append(cx)

    rolo = C.cilindro("cg_rolo", 0.17, 0.84, (2.10, 0.36, 1.41), segmentos=20,
                      rot=(R(90), 0, R(18)))
    C.aplicar(rolo, m["aco"])
    pecas.append(rolo)

    for i, (dx, dy, rz) in enumerate([(1.70, 0.34, 8), (2.16, -0.22, -22)]):
        b = C.chanfrar(C.caixa(f"cg_barra{i}", (1.44, 0.085, 0.085),
                               (dx, dy, 1.30), rot=(0, 0, R(rz))),
                       largura=0.008, segmentos=2)
        C.aplicar(b, m["aco"])
        pecas.append(b)
    return C.juntar(pecas, "risco_carga")


# ------------------------------------------------------------------ EPI
def capacete(m):
    """Capacete de aba frontal, classe B."""
    perfil = [
        (0.000, 0.000), (0.130, 0.004), (0.134, 0.024), (0.128, 0.036),
        (0.120, 0.050), (0.113, 0.072), (0.100, 0.098), (0.078, 0.122),
        (0.044, 0.138), (0.000, 0.142),
    ]
    casco = C.perfil_revolucao(perfil, "cp_casco", segmentos=36)
    aba = C.chanfrar(C.cilindro("cp_aba", 0.168, 0.014, (0.042, 0, 0.014),
                                segmentos=36), largura=0.005, segmentos=2)
    crista = C.chanfrar(C.caixa("cp_crista", (0.24, 0.028, 0.022), (0, 0, 0.128)),
                        largura=0.006, segmentos=2)
    obj = C.juntar([casco, aba, crista], "risco_capacete")
    C.aplicar(obj, m["capacete"])
    return obj


def luva(m):
    """Luva isolante de borracha, punho longo, caida no chao."""
    pecas = []
    pecas.append(C.chanfrar(C.caixa("lv_palma", (0.125, 0.048, 0.150),
                                    (0, 0, 0.030)),
                            largura=0.030, segmentos=4, angulo=65))
    pecas.append(C.chanfrar(C.cilindro("lv_punho", 0.062, 0.170, (0, 0, -0.140),
                                       segmentos=20), largura=0.010, segmentos=2))
    for i in range(3):
        pecas.append(C.chanfrar(
            C.cilindro(f"lv_d{i}", 0.020, 0.072, (-0.036 + i * 0.036, 0, 0.132),
                       segmentos=10), largura=0.008, segmentos=2))
    pecas.append(C.chanfrar(
        C.cilindro("lv_pol", 0.022, 0.080, (0.076, 0, 0.044), segmentos=10,
                   rot=(0, R(58), 0)), largura=0.008, segmentos=2))
    obj = C.juntar(pecas, "risco_luva")
    C.aplicar(obj, m["luva"])
    return obj


# ------------------------------------------------------------------ ferramentas
def cone(m, nome):
    """Cone de sinalizacao com as DUAS FAIXAS REFLETIVAS.

    Cone laranja liso nao existe em obra: o que se enxerga de noite, e o que
    o olho usa para reconhecer a peca de longe, sao os colarinhos brancos.
    Sem eles a peca lia como um chapeu de festa cor de laranja.

    Os colarinhos sao aneis de revolucao com raio um fio MAIOR que o corpo no
    mesmo Z — encostados na superficie nao apareceriam (z-fighting) e
    afastados demais virariam saia.
    """
    perfil = [
        (0.000, 0.000), (0.180, 0.000), (0.180, 0.024), (0.152, 0.032),
        (0.092, 0.155), (0.063, 0.335), (0.046, 0.485), (0.039, 0.545),
        (0.030, 0.556), (0.000, 0.560),
    ]
    corpo = C.perfil_revolucao(perfil, nome, segmentos=28)
    C.aplicar(corpo, m["laranja"])
    pecas = [corpo]
    # (z inferior, z superior) de cada colarinho, e o raio do corpo naquele Z
    for i, (z0, z1, r0, r1) in enumerate(((0.200, 0.345, 0.085, 0.062),
                                          (0.400, 0.480, 0.054, 0.046))):
        fx = C.perfil_revolucao(
            [(0.0, z0), (r0 + 0.004, z0), (r1 + 0.004, z1), (0.0, z1)],
            f"{nome}_fx{i}", segmentos=28)
        C.aplicar(fx, m["refletivo"])
        pecas.append(fx)
    return C.juntar(pecas, nome)


def escada(m):
    """Escada extensivel de fibra: montantes em U, degraus e sapatas.

    O montante era uma barra macica e o degrau um cilindro liso — escada de
    desenho animado. Montante de escada de fibra e um PERFIL EM U (duas abas
    e a alma), e e a sombra dentro do U que da profundidade a peca. O degrau
    e chato e estriado, nao redondo: redondo escorrega.
    """
    pecas, comp, larg = [], 4.60, 0.44
    for dy in (-1, 1):
        y = dy * larg / 2
        # Alma do U: a chapa EXTERNA do montante. A profundidade do perfil
        # fica em X (perpendicular ao plano da escada) e a espessura em Y —
        # na primeira versao estes dois eixos estavam trocados e o perfil
        # saia em H, que de longe le exatamente como a barra macica que ele
        # deveria substituir.
        pecas.append(C.chanfrar(
            C.caixa(f"es_m{dy}", (0.080, 0.010, comp), (0, y, 0)),
            largura=0.004, segmentos=2))
        # as duas abas, dobradas para DENTRO (na direcao do outro montante)
        for dx in (-1, 1):
            pecas.append(C.chanfrar(
                C.caixa(f"es_a{dy}{dx}", (0.014, 0.038, comp),
                        (dx * 0.033, y - dy * 0.019, 0)),
                largura=0.004, segmentos=2))
    n = 15
    for i in range(n):
        z = -comp / 2 + 0.24 + i * ((comp - 0.48) / (n - 1))
        pecas.append(C.chanfrar(
            C.caixa(f"es_d{i}", (0.042, larg - 0.04, 0.022), (0, 0, z)),
            largura=0.005, segmentos=2))
    # sapatas de borracha: escada sem pe nao encosta no chao, flutua
    for dy in (-1, 1):
        pecas.append(C.chanfrar(
            C.caixa(f"es_pe{dy}", (0.070, 0.095, 0.045),
                    (0, dy * larg / 2, -comp / 2 - 0.012)),
            largura=0.008, segmentos=2))
    obj = C.juntar(pecas, "risco_escada")
    C.aplicar(obj, m["fibra"])
    return obj


def ferramenta_improvisada(m):
    """Risco 6: chave de grifo usada como alavanca."""
    cabo = C.cilindro("fi_cabo", 0.019, 0.46, (0, 0, 0), segmentos=14,
                      rot=(0, R(72), 0))
    C.aplicar(cabo, m["cromo"])
    cabeca = C.chanfrar(C.caixa("fi_cabeca", (0.11, 0.042, 0.085),
                                (0.215, 0, 0.072)), largura=0.008, segmentos=2)
    C.aplicar(cabeca, m["cromo"])
    mord = C.caixa("fi_mord", (0.060, 0.034, 0.034), (0.258, 0, 0.130))
    C.aplicar(mord, m["cromo"])
    return C.juntar([cabo, cabeca, mord], "risco_ferramenta")


def ferramenta_solta(nome, comp, m, tipo="chave"):
    """Ferramenta de mao: haste de aco e cabo emborrachado."""
    haste = C.cilindro(f"{nome}_h", 0.013, comp, (0, 0, 0), segmentos=12,
                       rot=(0, R(90), 0))
    C.aplicar(haste, m["cromo"])
    pecas = [haste]
    cabo = C.chanfrar(C.cilindro(f"{nome}_c", 0.021, comp * 0.42,
                                 (-comp * 0.30, 0, 0), segmentos=14,
                                 rot=(0, R(90), 0)), largura=0.006, segmentos=2)
    C.aplicar(cabo, m["cabo_fer"])
    pecas.append(cabo)
    if tipo == "chave":
        ponta = C.chanfrar(C.caixa(f"{nome}_p", (0.07, 0.050, 0.022),
                                   (comp * 0.46, 0, 0)), largura=0.006,
                           segmentos=2)
        C.aplicar(ponta, m["cromo"])
        pecas.append(ponta)
    return C.juntar(pecas, nome)


def ferramental_espalhado(m):
    """Risco 8: ferramental jogado no chao."""
    pecas = []
    disposicao = [(0.00, 0.00, 0, 0.26), (0.36, -0.20, 40, 0.30),
                  (-0.30, 0.26, -65, 0.22), (0.55, 0.32, 15, 0.28),
                  (-0.48, -0.14, 100, 0.24)]
    for i, (dx, dy, rz, comp) in enumerate(disposicao):
        f = ferramenta_solta(f"fe_{i}", comp, m,
                             tipo="chave" if i % 2 == 0 else "fenda")
        f.location = (dx, dy, 0.016)
        f.rotation_euler = (0, 0, R(rz))
        pecas.append(f)
    balde = C.chanfrar(C.cilindro("fe_balde", 0.145, 0.28, (-0.66, 0.44, 0.14),
                                  segmentos=20), largura=0.010, segmentos=2)
    C.aplicar(balde, m["aco"])
    pecas.append(balde)
    return C.juntar(pecas, "risco_ferramental")


def caixa_ferramentas(m):
    """Caixa de ferramentas de chapa, com alca, fechos e nervura.

    Era duas caixas chanfradas e nada mais: um paralelepipedo cinza com uma
    aba. Sem alca e sem fecho o olho nao tem como saber que aquilo abre, e a
    peca lia como um tijolo. Alca e fechos custam 300 triangulos e resolvem.
    """
    pecas = []
    corpo = C.chanfrar(C.caixa("cf_corpo", (0.54, 0.28, 0.25), (0, 0, 0.125)),
                       largura=0.012, segmentos=2)
    pecas.append(corpo)
    tampa = C.chanfrar(C.caixa("cf_tampa", (0.54, 0.27, 0.035),
                               (0, -0.175, 0.345), rot=(R(-48), 0, 0)),
                       largura=0.008, segmentos=2)
    pecas.append(tampa)

    # nervura de reforco estampada na frente e atras
    for dy in (-1, 1):
        nerv = C.chanfrar(C.caixa(f"cf_nerv{dy}", (0.46, 0.012, 0.030),
                                  (0, dy * 0.140, 0.140)),
                          largura=0.005, segmentos=2)
        pecas.append(nerv)

    # alca: dois suportes mais a barra
    for dx in (-1, 1):
        pecas.append(C.chanfrar(
            C.caixa(f"cf_sup{dx}", (0.030, 0.048, 0.085),
                    (dx * 0.115, 0.035, 0.282)), largura=0.005, segmentos=2))
    pecas.append(C.cilindro("cf_alca", 0.014, 0.26, (0, 0.035, 0.318),
                            segmentos=8, rot=(0, R(90), 0)))

    # fechos nas duas pontas
    for dx in (-1, 1):
        pecas.append(C.chanfrar(
            C.caixa(f"cf_fecho{dx}", (0.055, 0.016, 0.070),
                    (dx * 0.215, -0.146, 0.215)), largura=0.004, segmentos=2))

    obj = C.juntar(pecas, "cenario_caixa")
    C.aplicar(obj, m["aco"])
    return obj


def prancheta(m):
    """Risco 2: APR em branco na prancheta."""
    base = C.chanfrar(C.caixa("pr_base", (0.240, 0.014, 0.335), (0, 0, 0)),
                      largura=0.006, segmentos=2)
    C.aplicar(base, m["aco"])
    folha = C.caixa("pr_folha", (0.218, 0.004, 0.302), (0, 0.010, -0.012))
    C.aplicar(folha, m["papel"])
    presilha = C.chanfrar(C.caixa("pr_pres", (0.092, 0.022, 0.046),
                                  (0, 0.014, 0.154)), largura=0.005, segmentos=2)
    C.aplicar(presilha, m["cromo"])
    return C.juntar([base, folha, presilha], "risco_apr")


# ------------------------------------------------------------------ via e quadra
def via(m):
    """A rua da ocorrencia: asfalto, os DOIS meios-fios e as duas calcadas.

    Tinha meio-fio e calcada de um lado so — o lado do poste. Do outro, o
    asfalto simplesmente acabava em y -10,1 e virava terra batida ate o
    horizonte. E justamente o lado de CA: a camera do briefing fica em
    y -12, ou seja, em pe no barro, olhando por cima de uma rua que termina
    sem acabamento. Era o "acostamento vazio" da tela de chegada.

    Rua tem dois meios-fios. O de ca fica em y -10,18 (o asfalto vai de
    -10,1 a -1,1) e a calcada atras dele, que e onde a camera pousa.
    """
    C.aplicar(C.caixa("via_asfalto", (80, 9.0, 0.16), (0, -5.6, -0.08)),
              m["asfalto"])
    for nome, y in (("", -1.02), ("_ca", -10.18)):
        C.aplicar(C.chanfrar(C.caixa(f"via_meiofio{nome}", (80, 0.18, 0.34),
                                     (0, y, 0.02)), largura=0.02, segmentos=2),
                  m["calcada"])
    C.aplicar(C.caixa("via_calcada", (80, 2.5, 0.20), (0, 0.30, 0.0)),
              m["calcada"])
    C.aplicar(C.caixa("via_calcada_ca", (80, 2.8, 0.20), (0, -11.60, 0.0)),
              m["calcada"])
    C.aplicar(C.caixa("via_terra", (140, 90, 0.14), (0, 20, -0.09)), m["terra"])

    """
    E O CHAO DA RUA NAO E LISO.

    Mesmo com as duas calcadas, o asfalto era um retangulo de 80 x 9 m sem
    uma marca — e ele ocupa a faixa de baixo da tela do briefing inteira.
    Poco de visita, boca de lobo e remendo sao o que toda rua tem e sao
    rasteiros (2 a 5 cm), entao cabem dentro do corredor de visada que esta
    documentado em `Ocorrencia3D` sem tapar nada.
    """
    tampa = C.mat_simples("via_tampa", (0.055, 0.052, 0.050),
                          rugosidade=0.72, metalico=0.35)
    remendo = C.mat_simples("via_remendo", (0.028, 0.028, 0.030),
                            rugosidade=0.95)
    vao = C.mat_simples("via_boca", (0.014, 0.014, 0.015), rugosidade=0.88)

    for i, (x, y) in enumerate(((-9.5, -3.1), (6.2, -7.8), (21.0, -4.4))):
        poco = C.cilindro(f"via_poco_{i}", 0.34, 0.030, (x, y, -0.002),
                          segmentos=14)
        C.aplicar(poco, tampa)
        aro = C.cilindro(f"via_poco_aro_{i}", 0.42, 0.022, (x, y, -0.008),
                         segmentos=14)
        C.aplicar(aro, remendo)

    # bocas de lobo encostadas nos dois meios-fios, onde a agua corre
    for i, (x, y) in enumerate(((-14.0, -1.45), (4.5, -9.82),
                                (19.5, -1.45), (-3.0, -9.82))):
        b = C.caixa(f"via_boca_{i}", (0.86, 0.30, 0.06), (x, y, -0.018))
        C.aplicar(b, vao)

    for i, (x, y, cx, cy) in enumerate(((-2.0, -5.4, 7.0, 1.1),
                                        (13.5, -8.2, 2.4, 3.0),
                                        (-21.0, -2.6, 3.6, 1.4))):
        r = C.caixa(f"via_remendo_{i}", (cx, cy, 0.024), (x, y, -0.006))
        C.aplicar(r, remendo)


def quadra(m):
    """Fila de casas atras da calcada: o cenario precisa de fundo de rua."""
    pecas = []
    casas = [(-14.0, 7.2, 3.4, "parede_a"), (-6.4, 6.0, 3.0, "parede_b"),
             (0.4, 7.8, 3.8, "parede_c"), (8.0, 6.6, 3.2, "parede_d"),
             (15.0, 7.0, 3.5, "parede_b")]
    x = 0
    for i, (x, larg, alt, cor) in enumerate(casas):
        y = 5.6
        parede = C.caixa(f"qd_casa{i}", (larg, 6.5, alt), (x, y + 3.2, alt / 2))
        C.aplicar(parede, m[cor])
        pecas.append(parede)
        laje = C.chanfrar(C.caixa(f"qd_laje{i}", (larg + 0.4, 6.9, 0.22),
                                  (x, y + 3.2, alt + 0.10)), largura=0.03,
                          segmentos=2)
        C.aplicar(laje, m["telha"])
        pecas.append(laje)
        muro = C.caixa(f"qd_muro{i}", (larg, 0.18, 1.9), (x, y - 0.2, 0.95))
        C.aplicar(muro, m["calcada"])
        pecas.append(muro)
        portao = C.chanfrar(C.caixa(f"qd_portao{i}", (1.5, 0.06, 1.75),
                                    (x + larg * 0.28, y - 0.26, 0.90)),
                            largura=0.02, segmentos=2)
        C.aplicar(portao, m["aco"])
        pecas.append(portao)
        for j in (-1, 1):
            jan = C.caixa(f"qd_jan{i}{j}", (larg * 0.22, 0.10, 1.05),
                          (x + j * larg * 0.26, y + 0.04, 2.45))
            C.aplicar(jan, m["vidro"])
            pecas.append(jan)
    return C.juntar(pecas, "cenario_quadra")


# ------------------------------------------------------------------ montagem
def montar():
    P.montar()
    if "chao" in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects["chao"], do_unlink=True)

    # risco 3: isolador solto/danificado — vira alvo clicavel proprio
    for nome in ("isolador.002", "isolador.001", "isolador"):
        if nome in bpy.data.objects:
            iso = bpy.data.objects[nome]
            iso.name = "risco_isolador"
            iso.rotation_euler = (R(15), 0, R(-6))
            iso.location = (iso.location.x + 0.02, iso.location.y,
                            iso.location.z - 0.012)
            break

    m = materiais()
    via(m)
    quadra(m)

    v = caminhonete(m)
    v.location = (3.4, -2.70, 0)
    v.rotation_euler = (0, 0, R(-3))

    cg = carga_solta(m)
    cg.location = (3.4, -2.70, 0)
    cg.rotation_euler = (0, 0, R(-3))

    es = escada(m)                       # risco 6: angulo aberto, pe na pista
    es.location = (-0.28, -1.08, 2.13)
    es.rotation_euler = (R(-28), 0, R(3))

    cp = capacete(m)                     # risco 4: capacete fora da cabeca
    cp.location = (-1.42, -0.34, 0.115)
    cp.rotation_euler = (R(102), 0, R(35))

    lv = luva(m)                         # risco 5: luva isolante no chao
    lv.location = (-0.95, 0.44, 0.125)
    lv.rotation_euler = (R(88), 0, R(-40))

    fi = ferramenta_improvisada(m)       # risco 6
    # perto da caixa de ferramentas: onde estava antes, a escada tapava a peca
    # na visao da calcada e o jogador nao tinha como clicar nela
    fi.location = (-0.95, -1.35, 0.115)
    fi.rotation_euler = (0, 0, R(-52))

    fe = ferramental_espalhado(m)        # risco 8
    fe.location = (-2.15, 0.22, 0.10)

    cx = caixa_ferramentas(m)
    cx.location = (-1.80, -0.58, 0.10)
    cx.rotation_euler = (0, 0, R(-14))

    pr = prancheta(m)                    # risco 2: APR em branco
    pr.location = (-1.62, -0.80, 0.26)
    pr.rotation_euler = (R(-68), 0, R(-14))

    # os cones ficam NA PISTA, a frente da area de trabalho — antes estavam
    # debaixo da caminhonete, onde o jogador nao conseguia nem ver nem clicar
    c1 = cone(m, "cenario_cone")
    c1.location = (-3.3, -3.30, 0.10)
    c2 = cone(m, "risco_cone")           # risco 1: sinalizacao derrubada
    c2.location = (-1.1, -3.75, 0.30)
    c2.rotation_euler = (R(88), 0, R(20))


def conferir():
    montar()
    C.camera((-7.2, -9.6, 2.10), (0.8, -1.6, 2.30), lente=30, nome="cam_cena")
    C.render("cenario_geral", largura=1500, altura=900, amostras=150,
             exposicao=-0.2)
    C.camera((-2.6, -4.4, 1.60), (-0.9, -0.2, 0.50), lente=40, nome="cam_chao")
    C.render("cenario_chao", largura=1400, altura=950, amostras=150,
             exposicao=-0.2)


if __name__ == "__main__":
    conferir()
