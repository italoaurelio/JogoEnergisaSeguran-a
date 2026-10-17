"""
Exporta o motorista SENTADO ao volante, para a fase 2.

Sem ele, o cinto afivelado cruza um banco vazio — e o cinto e o item mais
importante da conferencia.

Ele veste o que o jogador escolheu no vestiario nas duas vagas que se veem
sentado (corpo e cabeca), cada variante num no proprio. Mostrar EPI completo
em quem escolheu bone ensinaria o contrario do que a fase toda quer ensinar.

O corpo e montado CENTRADO em x=0 e so no fim vai para o lugar do motorista.
Os recortes de roupa filtram por `abs(co.x)` a partir das referencias do
corpo; com o corpo ja deslocado, esses filtros cortam torto.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P exportar_motorista.py
"""
import bpy, os, sys, json, math
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import humano as H
import epi as E
import veiculo as V
import exportar as X
import exportar_personagem as XP

SAIDA = os.path.join(C.RAIZ, "export")
TEX_SAIDA = os.path.join(SAIDA, "tex")

# Onde a BACIA do motorista fica, em coordenada da cabine.
#
# Era y 0,34 e acompanhava o banco antigo. Com o banco trazido para a frente
# (`V.Y_BANCO`), o quadril vem junto: 0,16 deixa o motorista sentado no meio
# do assento, encostado no encosto, e com o aro a 0,46 m — distancia de
# caminhao de verdade. Com o valor antigo ele nao alcancava o volante.
BACIA = (0.0, 0.16, V.ALTURA_ASSENTO + 0.055)

#: pegada "9 e 3" no aro, onde as duas maos vao parar
def _pegada(sinal):
    """Onde o PUNHO tem de parar para a mao segurar o aro.

    A IK leva o punho ao alvo, e o alvo era o eixo do aro: a mao inteira
    nascia centrada no tubo e os dedos saiam do outro lado. Na tela, mao
    atravessando o volante em vez de segura-lo — a foto que o cliente mandou.

    Quem segura um aro poe o punho DO LADO DE CA dele e um pouco para
    dentro do raio; sao os dedos que passam por cima. O volante e inclinado
    32 graus, entao "do lado de ca" nao e +Y: e a normal do plano do aro,
    que vale (0, sen 32, -cos 32) no sentido do motorista.
    """
    from mathutils import Vector as _V
    recuo = 0.055
    n = _V((0.0, math.sin(V.INCLINACAO_VOLANTE), -math.cos(V.INCLINACAO_VOLANTE)))
    aro = _V((sinal * (V.RAIO_VOLANTE - 0.015), V.VOLANTE.y, V.VOLANTE.z))
    return aro + n * recuo

# as duas vagas que se veem de dentro da cabine
VARIANTES_CORPO = ["vestimenta_fr", "camisa_algodao", "colete_refletivo"]
VARIANTES_CABECA = ["capacete_b", "capacete_a", "bone"]


def montar():
    C.limpar()
    C.hdri(forca=0.25, rotacao=math.radians(200))
    H.luz_vestiario()

    corpo = H.criar_corpo(H.macro(**XP.FISICO_PADRAO), tom=XP.TOM_NEUTRO)
    corpo.name = "mot_corpo"
    arm = H.adicionar_rig(corpo)
    H.pose_sentado(arm)
    H.assentar(corpo, arm, BACIA)
    # AS MAOS VAO AO VOLANTE, e so aqui — depois de `assentar`, porque o alvo
    # esta em coordenada de mundo. O corpo e montado centrado em x=0 e so vai
    # para o lugar do motorista no fim, entao o aro tambem entra em x=0.
    H.maos_no_alvo(arm, _pegada(1), _pegada(-1))

    olhos = H.criar_olhos(corpo)
    cabelo = H.cabelo(corpo)
    H.sobrancelhas(corpo, olhos)

    ref = H.referencias(corpo)
    grupos = {"base_roupa": E.roupa_base(corpo, ref)}
    for ident in VARIANTES_CORPO + VARIANTES_CABECA:
        grupos[ident] = E.MONTAGEM[ident](corpo, ref) or []
    return corpo, arm, olhos, cabelo, grupos


def processar():
    os.makedirs(TEX_SAIDA, exist_ok=True)
    corpo, arm, olhos, cabelo, grupos = montar()

    cena = bpy.context.scene
    cena.render.engine = "CYCLES"
    cena.cycles.device = "CPU"

    exportaveis = []
    catalogo = {}

    for ident, objs in grupos.items():
        alvo = XP.juntar_peca(ident, objs)
        if not alvo:
            print("variante vazia:", ident)
            continue
        alvo.name = f"mot_{ident}"
        # mesmo forno do personagem: o motorista aparece de perto na
        # conferência e no trajeto inteiro, e o uniforme dele tem de ter a
        # mesma costura e o mesmo tom do boneco que o jogador montou
        if ident == "vestimenta_fr":
            XP.assar_uniforme(alvo)
        exportaveis.append(alvo)
        catalogo[ident] = alvo.name

    # O MOTORISTA USA CAPACETE SEMPRE, entao dele so interessa a FAIXA —
    # nuca e costeleta. Era o corte inteiro, e o volume do alto atravessava o
    # casco: e o cabelo saindo por cima do capacete na foto do cliente.
    faixa = next((p for p in (cabelo or []) if p.name == "cabelo_capacete"), None)
    for p in (cabelo or []):
        if p is not faixa and p.name in bpy.data.objects:
            bpy.data.objects.remove(p, do_unlink=True)
    if faixa:
        XP.limpar_pais([faixa])
        faixa = X.preparar(faixa)
        faixa.name = "mot_cabelo"
        exportaveis.append(faixa)

    ol = XP.assar_olhos(olhos)
    if ol:
        ol.name = "mot_olhos"
        exportaveis.append(ol)

    # a armadura ja cumpriu o papel: a pose entra na malha quando `preparar`
    # converte para malha. Exportar a armadura junto so acrescenta um
    # esqueleto que o jogo nao usa.
    pele = XP.assar_pele(corpo)
    pele.name = "mot_corpo"
    # SOLTAR DO RIG ANTES DE APAGAR O RIG.
    #
    # `assentar` senta o motorista movendo a ARMADURA, nao o corpo (mover os
    # dois aplicaria o deslocamento duas vezes). O corpo e FILHO do rig, entao
    # a posicao no banco mora na matriz do pai, e `convert` nao a traz para a
    # malha. Quando o `remove(arm)` tres linhas abaixo apagava a armadura, o
    # corpo perdia o pai e voltava para a origem: 51 cm acima e 35 cm a frente
    # da propria roupa.
    #
    # O sintoma no jogo nao parecia um erro de exportacao. O corpo nu ficava
    # de PE dentro da cabine, atravessando painel e volante, e as cameras da
    # conferencia abriam dentro dele — tela de pele na primeira pergunta da
    # fase 2. Tambem era disto que vinham o "braco nu" e as "partes voando"
    # anotadas no plano: nao eram recorte de roupa, era o corpo fora do lugar.
    #
    # As pecas de roupa nunca tiveram o problema porque passam por
    # `limpar_pais`, que solta mantendo a matriz de mundo. O corpo era o unico
    # que ia direto para o `preparar`.
    XP.limpar_pais([pele])
    exportaveis.append(pele)
    if arm and arm.name in bpy.data.objects:
        bpy.data.objects.remove(arm, do_unlink=True)

    for o in exportaveis:
        for slot in o.material_slots:
            if slot.material and slot.material.name != "policarbonato":
                slot.material.use_backface_culling = True
        # do lugar do motorista: montado no centro para os recortes nao
        # sairem tortos, so agora vai para o banco
        o.location = o.location + Vector((V.X_MOTORISTA, 0, 0))

    for o in bpy.context.scene.objects:
        o.select_set(o in exportaveis)
    destino = os.path.join(SAIDA, "motorista.glb")
    bpy.ops.export_scene.gltf(filepath=destino, export_format="GLB",
                              use_selection=True, export_apply=True,
                              export_yup=True)

    with open(os.path.join(SAIDA, "motorista.json"), "w") as f:
        json.dump({"bacia": list(BACIA), "variantes": catalogo},
                  f, indent=2, ensure_ascii=False)
    print("GLB:", destino, os.path.getsize(destino) // 1024, "KB")
    print("VARIANTES:", ", ".join(sorted(catalogo)))


if __name__ == "__main__":
    processar()
