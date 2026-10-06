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

# altura da bacia acima do piso da cabine, e recuo no banco
BACIA = (0.0, 0.34, V.ALTURA_ASSENTO + 0.055)

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

    if cabelo:
        XP.limpar_pais([cabelo])
        cabelo = X.preparar(cabelo)
        cabelo.name = "mot_cabelo"
        exportaveis.append(cabelo)

    ol = XP.assar_olhos(olhos)
    if ol:
        ol.name = "mot_olhos"
        exportaveis.append(ol)

    # a armadura ja cumpriu o papel: a pose entra na malha quando `preparar`
    # converte para malha. Exportar a armadura junto so acrescenta um
    # esqueleto que o jogo nao usa.
    pele = XP.assar_pele(corpo)
    pele.name = "mot_corpo"
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
