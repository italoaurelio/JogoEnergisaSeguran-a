"""
Gera as texturas que nao existem em arte/tex, lado a lado sem emenda.

Nao ha grama CC0 em arte/tex e a beira da estrada e a maior superficie do
trajeto — era ela, chapada, que tirava a referencia de profundidade e fazia
arbusto a cento e cinquenta metros parecer flutuando.

O ruido e filtrado no dominio da FREQUENCIA, nao no espaco. Uma FFT e
periodica por construcao: o que sai dela ja fecha nas quatro bordas, sem
espelhar, sem costurar e sem o padrao em xadrez que espelhar deixa.

Tres camadas:
  - manchas largas (seco x verde), que e o que se le de longe;
  - laminas finas e ESTICADAS em Y, que e o que se le de perto;
  - um mapa de relevo tirado da propria camada de laminas.

Uso: python3 arte/gerar_texturas.py
"""
import numpy as np
from PIL import Image
import os

LADO = 1024
RAIZ = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(RAIZ, "..", "public", "tex")


def banda(semente, baixo, alto, estica_y=1.0):
    """Ruido limitado a uma banda de frequencia. Periodico porque vem de FFT."""
    rng = np.random.default_rng(semente)
    espectro = np.fft.fft2(rng.standard_normal((LADO, LADO)))

    fy = np.fft.fftfreq(LADO)[:, None] * LADO
    fx = np.fft.fftfreq(LADO)[None, :] * LADO
    # esticar em Y = comprimir a frequencia em Y: e o que faz a lamina ficar
    # comprida no sentido do crescimento em vez de uma bolinha
    raio = np.sqrt((fy / estica_y) ** 2 + fx ** 2)

    espectro[(raio < baixo) | (raio > alto)] = 0
    saida = np.real(np.fft.ifft2(espectro))
    desvio = saida.std()
    return saida / desvio if desvio > 1e-9 else saida


def transposta(a):
    """A mesma banda girada 90 graus. Serve para o fio cruzado do tecido."""
    return a.T


def normalizar(a):
    return (a - a.min()) / max(np.ptp(a), 1e-9)


def gerar():
    os.makedirs(SAIDA, exist_ok=True)

    manchas = normalizar(banda(7, 1.5, 6))
    media = normalizar(banda(11, 6, 22))
    laminas = banda(19, 28, 150, estica_y=7.0)

    verde = np.array([0.33, 0.42, 0.20])
    seco = np.array([0.56, 0.51, 0.30])
    escuro = np.array([0.16, 0.22, 0.10])

    # manchas decidem seco x verde; a camada media escurece o meio das moitas
    mistura = (manchas ** 1.5)[..., None]
    cor = verde * (1 - mistura) + seco * mistura
    cor = cor * (1 - 0.45 * (1 - media)[..., None]) + escuro * 0.45 * (1 - media)[..., None]
    # as laminas entram como variacao de brilho, nao de matiz
    cor = cor * (1 + 0.30 * np.clip(laminas, -2.2, 2.2)[..., None] / 2.2)

    cor = np.clip(cor, 0, 1) ** (1 / 2.2)   # linear -> sRGB
    Image.fromarray((cor * 255).astype(np.uint8)).save(
        os.path.join(SAIDA, "grama_diff.jpg"), quality=86)

    # relevo das laminas. np.gradient numa matriz periodica nao fecha nas
    # bordas; o deslocamento circular fecha.
    altura = np.clip(laminas, -2.5, 2.5) / 2.5
    dx = np.roll(altura, -1, axis=1) - np.roll(altura, 1, axis=1)
    dy = np.roll(altura, -1, axis=0) - np.roll(altura, 1, axis=0)
    forca = 2.4
    n = np.stack([-dx * forca, -dy * forca, np.ones_like(altura)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    # O relevo sai em 512 e com compressao mais firme de proposito: a beira
    # da via e vista quase de raspao, onde detalhe de normal nao se le, e em
    # 1024/q88 o arquivo sozinho pesava mais que a cor e o relevo do asfalto
    # somados.
    relevo = Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8))
    relevo = relevo.resize((LADO // 2, LADO // 2), Image.LANCZOS)
    relevo.save(os.path.join(SAIDA, "grama_nor.jpg"), quality=80)

    print("grama_diff.jpg e grama_nor.jpg em", os.path.normpath(SAIDA))


def salvar_relevo(altura, nome, lado=None, qualidade=84, forca=2.4):
    """Normal map a partir de um campo de altura PERIODICO.

    `np.gradient` nao fecha nas bordas; o deslocamento circular fecha, que e o
    que mantem o ladrilho sem costura visivel.
    """
    dx = np.roll(altura, -1, axis=1) - np.roll(altura, 1, axis=1)
    dy = np.roll(altura, -1, axis=0) - np.roll(altura, 1, axis=0)
    n = np.stack([-dx * forca, -dy * forca, np.ones_like(altura)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    img = Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8))
    if lado:
        img = img.resize((lado, lado), Image.LANCZOS)
    img.save(os.path.join(SAIDA, nome), quality=qualidade)
    return nome


def gerar_cabine():
    """Grao de plastico e trama de tecido para o interior da cabine.

    So RELEVO, sem cor. As cores do interior ja foram escolhidas com cuidado
    no Blender e nao ha razao para mexer nelas; o que falta na cabine e
    micro-superficie — e a ausencia dela que faz painel e banco lerem como
    plastico de brinquedo, porque o reflexo especular sai uniforme em toda a
    peca, em qualquer angulo.
    """
    os.makedirs(SAIDA, exist_ok=True)

    # grao de plastico injetado: pedriscos finos, isotropicos, de amplitude
    # baixa. Forte demais vira lixa.
    grao = np.clip(banda(31, 90, 260), -2.5, 2.5) / 2.5
    salvar_relevo(grao, "grao_nor.jpg", lado=512, forca=1.5)

    # trama: dois feixes de fios cruzados. O max() entre eles e o que da o
    # relevo de cesta — media daria um borrao sem direcao nenhuma.
    fio = banda(37, 55, 110, estica_y=9.0)
    trama = np.maximum(fio, transposta(fio))
    trama = np.clip(trama, -2.2, 2.2) / 2.2
    salvar_relevo(trama, "trama_nor.jpg", lado=512, forca=2.0)

    print("grao_nor.jpg e trama_nor.jpg em", os.path.normpath(SAIDA))


if __name__ == "__main__":
    gerar()
    gerar_cabine()
