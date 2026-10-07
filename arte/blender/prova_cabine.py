"""
Render de conferencia da CABINE, em Cycles. Espelhado em `prova_caminhao.py`.

Nao existia, e por isso o interior nunca foi julgado: no jogo ele aparece no
terco inferior da tela, de noite e com pos-processamento, que e exatamente a
condicao em que peca solta e haste faltando passam despercebidas.

A vista `motorista` reproduz o OLHO e o campo da fase 2b — e a unica que
responde "o jogador ve o volante?".

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P prova_cabine.py
     ... -- motorista cinto      (so as vistas pedidas)
"""
import bpy, os, sys, math
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import veiculo as V

SAIDA = os.path.join(C.RAIZ, "render")


def montar(estados=("cinto_afivelado", "retro_ok", "apoio_alto",
                    "celular_guardado", "checklist_feito")):
    C.limpar()
    # O HDRI e obrigatorio: `luz_cabine` so poe sol e areas, e o proprio
    # docstring dela diz que a luz principal vem do HDRI atravessando o vidro.
    # Sem ele a prova sai com o interior inteiro na sombra e faz parecer que a
    # cabine e escura demais — mas o jogo usa `hemisphereLight` a 1,05 mais
    # direcional a 2,0, que e bem mais claro. Julgar legibilidade sem isto e
    # julgar o render, nao o jogo.
    C.hdri(forca=0.95, rotacao=math.radians(205))
    V.luz_cabine()
    V.fixo()
    grupos = V.estados()
    for nome, objs in grupos.items():
        for o in objs:
            if o:
                o.hide_render = nome not in estados
    return grupos


def mostrar(grupos, estados):
    for nome, objs in grupos.items():
        for o in objs:
            if o:
                o.hide_render = nome not in estados


def do_jogo(de, para, lente):
    """Camera escrita em coordenada do JOGO (Y para cima) -> Blender.

    As seis vistas da fase 2a moram em `src/conteudo/cabine.ts` e sao a
    pergunta: quem nao ve o item, chuta. Copiadas aqui VERBATIM, convertidas
    por (x, y, z) -> (x, -z, y), para dar para julgar enquadramento sem abrir
    o jogo.
    """
    return ((de[0], -de[2], de[1]), (para[0], -para[2], para[1]), lente)


def vistas():
    """Vistas de diagnostico, nao de jogo. `motorista` copia o OLHO e o campo
    da fase 2b e e a unica que responde "o jogador ve o volante?"."""
    olho = V.OLHO
    prop = 820 / 560
    f = (36 / prop) / 2 / math.tan(math.radians(52) / 2)
    return {
        # a cabine olha para -Y (para-brisa em y=-0,80), nao para +Y
        "motorista": (tuple(olho), (olho.x + 0.02, olho.y - 6, olho.z - 0.42), f),
        "volante": ((V.X_MOTORISTA + 0.52, V.VOLANTE.y - 0.62, V.VOLANTE.z + 0.34),
                    tuple(V.VOLANTE), 50),
        "geral": ((1.95, 1.75, 1.72), (0.0, -0.30, 0.80), 34),
    }


# As seis da fase 2a, com o estado ERRADO ligado — que e o que o jogador ve
# quando a pergunta aparece.
ITENS = {
    # Refeitas em 06/10 a partir da CAIXA ENVOLVENTE real de cada peca (ver
    # o dump em PLANO.md). As antigas foram escritas quando a cabine estava
    # vazia e nunca foram reconferidas.
    # O cinto fica OUTBOARD do banco do motorista (x 0,70-0,78 contra 0,653
    # de banco), entao toda camera inboard o esconde atras do encosto. Esta
    # fica a frente do banco e olha para tras e para fora, por cima do ombro.
    # A FITA do cinto olha para dentro da cabine, entao camera colada no
    # pilar a ve de fio e ela vira um risco. Tem de ser inboard (para pegar a
    # face) e a frente do banco em y (para o encosto nao tapar): o banco
    # ocupa y de 0,01 a 0,668, e esta camera esta em y -0,55.
    # Tem de passar POR CIMA do volante (x 0,13-0,63, z ate 1,00) e por cima
    # do encosto (z ate 1,02), senao o aro toma a tela inteira — foi o que
    # aconteceu com a camera em z 1,05.
    "cinto": (do_jogo([-0.05, 1.32, 0.30], [0.74, 0.80, -0.33], 30),
              "cinto_solto"),
    "cinto_ok": (do_jogo([-0.05, 1.32, 0.30], [0.74, 0.80, -0.33], 30),
                 "cinto_afivelado"),
    "retrovisores": (do_jogo([0.38, 1.17, -0.10], [0.90, 1.02, 0.56], 50),
                     "retro_desregulado"),
    # ALTURA se julga de LADO. De cima o vao entre o apoio e o encosto fica
    # em escorco e a pergunta "esta na altura certa?" nao tem resposta na
    # imagem. Camera na altura do proprio apoio, olhando na horizontal.
    # PERFIL, pela janela do motorista. De frente o apoio fica na frente do
    # encosto e o vao some; de dentro, o apoio do PASSAGEIRO entra na frente.
    # Pela janela e a unica linha livre — o pilar B esta em y 0,43-0,51 e
    # esta vista passa em y 0,57.
    "apoio_cabeca": (do_jogo([0.95, 1.12, -0.56], [0.38, 1.05, -0.58], 36),
                     "apoio_baixo"),
    # A prumo o fundo e o assoalho preto e a alavanca some. De perto e de
    # viés ela aparece contra o console, que e claro.
    # Quase a prumo e DE PERTO. Toda vista lateral poe um banco atras da
    # alavanca, porque ela fica entre os dois; e de longe ela some no
    # assoalho preto. Ver tambem a cor nova em `mat` de `freio_de_mao`.
    "freio_mao": (do_jogo([-0.06, 1.05, 0.26], [-0.09, 0.40, 0.02], 40), None),
    "celular": (do_jogo([0.20, 1.20, 0.02], [-0.10, 0.91, 0.46], 40),
                "celular"),
    "checklist": (do_jogo([0.10, 1.24, 0.22], [-0.40, 0.51, -0.30], 34),
                  "checklist_branco"),
}


def processar(pedidas=None):
    os.makedirs(SAIDA, exist_ok=True)
    grupos = montar()
    for nome, (pos, alvo, lente) in vistas().items():
        if pedidas and nome not in pedidas:
            continue
        C.camera(pos, alvo, lente=lente, nome=f"cam_{nome}")
        destino = os.path.join(SAIDA, f"cab_{nome}.png")
        C.render(destino, largura=820, altura=560, amostras=64, gpu=True)
        print("RENDER:", destino)

    for nome, ((pos, alvo, lente), estado) in ITENS.items():
        if pedidas and nome not in pedidas:
            continue
        base = {"cinto_afivelado", "retro_ok", "apoio_alto",
                "celular_guardado", "checklist_feito"}
        if estado:
            # troca o par: liga o errado, desliga o certo correspondente
            par = estado.rsplit("_", 1)[0]
            base = {e for e in base if not e.startswith(par.split("_")[0])}
            base.add(estado)
        mostrar(grupos, base)
        C.camera(pos, alvo, lente=lente, nome=f"cam_item_{nome}")
        destino = os.path.join(SAIDA, f"cab_item_{nome}.png")
        C.render(destino, largura=820, altura=560, amostras=64, gpu=True)
        print("RENDER:", destino)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    processar(set(argv) or None)
