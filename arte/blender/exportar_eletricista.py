"""Exporta o eletricista da fase 3, com uma POSE POR NO.

Por que varias poses num .glb so, e nao um esqueleto:

O corpo do MPFB tem 195 mil triangulos e o pipeline deste projeto assa a pose
na malha — nao ha esqueleto no que chega ao jogo. Exportar com pesos exigiria
rigar tambem as 19 pecas de EPI, que sao RECORTADAS da superficie do corpo e
nao tem grupo de vertice nenhum. E meio dia de trabalho com risco de quebrar
o EPI inteiro.

A alternativa e o padrao que o projeto ja usa para o EPI: varios nos, um
visivel de cada vez. O eletricista aparece a ~7 m da camera, com 120 px de
altura. Trocar entre quatro poses assadas, com transicao de alguns quadros,
le exatamente como animacao nesse tamanho — e custa um decimo do esforco.

O preco e o orcamento de triangulos: quatro copias do corpo cru dariam 780
mil. Por isso cada pose e DECIMADA a ~4%, o que a 120 px de altura nao se
distingue do original (conferido por render, ver `prova_eletricista.py`).

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P exportar_eletricista.py
"""
import bpy, os, sys, json, math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import humano as H
import epi as E
import exportar as X
import exportar_personagem as XP

SAIDA = os.path.join(C.RAIZ, "export")

#: O que ele veste. Conjunto CERTO: na fase 3 ele ja saiu do vestiario, e
#: mostrar o eletricista de bone no poste ensinaria o contrario do que a
#: fase 1 acabou de cobrar.
VESTE = ["vestimenta_fr", "capacete_b", "luva_isolante_cobertura",
         "botina_isolante", "paraquedista_talabarte"]

#: Quanto sobra de cada pose depois do decimate.
#:
#: 0,07 e nao 0,04: com 4% a bota da perna levantada da pose `subindo` virava
#: um toco — o decimate come primeiro as curvas pequenas, e o pe levantado e
#: justamente a silhueta que diz "esta subindo". Com 7% cada pose fica em
#: ~5,6 mil faces e as quatro somam 22 mil, que e menos da metade do que a
#: ocorrencia ja gasta.
FATIA = 0.07

POSES = {
    "parado": H.pose_descanso,
    "trabalhando": H.pose_trabalhando,
    "choque": H.pose_choque,
    "subindo": H.pose_subindo,
    "radio": H.pose_radio,
}


def uma_pose(nome, posar):
    """Monta o corpo do zero, posa, veste e devolve UMA malha decimada.

    Corpo NOVO a cada vez de proposito: a roupa e recortada da superficie do
    corpo JA DEFORMADA, entao cada pose precisa do proprio recorte. Reusar o
    corpo entre poses daria uma roupa posada na primeira e um corpo posado na
    ultima — exatamente o defeito que ja custou uma rodada neste projeto.

    O que NAO da para fazer e limpar a cena entre as poses: `C.limpar()` e
    `read_factory_settings`, e leva junto tudo o que ja foi montado —
    inclusive malha marcada com `use_fake_user`. As quatro poses convivem na
    mesma cena, todas na origem, e so uma fica visivel por vez no jogo.
    """
    corpo = H.criar_corpo(H.macro(**XP.FISICO_PADRAO), tom=XP.TOM_NEUTRO)
    corpo.name = f"el_{nome}"
    arm = H.adicionar_rig(corpo)
    posar(arm)

    pecas = E.vestir(corpo, H.referencias(corpo), VESTE)
    partes = [o for lista in pecas.values() for o in (lista or [])]

    # o corpo vira malha ANTES do join: `convert` aplica a armadura, e com a
    # armadura ainda viva o join arrastaria o modificador para o resultado
    XP.limpar_pais(partes)
    corpo_malha = X.preparar(corpo)
    corpo_malha.name = f"el_{nome}"
    prontas = [X.preparar(o) for o in partes]
    if arm and arm.name in bpy.data.objects:
        bpy.data.objects.remove(arm, do_unlink=True)

    alvo = C.juntar([corpo_malha] + prontas, f"el_{nome}")
    antes = len(alvo.data.polygons)
    mod = alvo.modifiers.new("enxugar", "DECIMATE")
    mod.ratio = FATIA
    bpy.context.view_layer.objects.active = alvo
    bpy.ops.object.modifier_apply(modifier="enxugar")
    print(f"  {nome}: {antes} -> {len(alvo.data.polygons)} faces")
    return alvo


def processar():
    os.makedirs(SAIDA, exist_ok=True)
    C.limpar()
    C.hdri(forca=0.25, rotacao=math.radians(200))
    H.luz_vestiario()

    exportaveis = []
    for nome, posar in POSES.items():
        print("--- pose", nome)
        alvo = uma_pose(nome, posar)
        for slot in alvo.material_slots:
            if slot.material:
                slot.material.use_backface_culling = True
        exportaveis.append(alvo)

    for o in bpy.context.scene.objects:
        o.select_set(o in exportaveis)
    destino = os.path.join(SAIDA, "eletricista.glb")
    bpy.ops.export_scene.gltf(filepath=destino, export_format="GLB",
                              use_selection=True, export_apply=True,
                              export_yup=True)
    with open(os.path.join(SAIDA, "eletricista.json"), "w") as f:
        json.dump({"poses": list(POSES), "veste": VESTE, "fatia": FATIA},
                  f, indent=2, ensure_ascii=False)
    print("GLB:", destino, os.path.getsize(destino) // 1024, "KB")
    print("POSES:", ", ".join(o.name for o in exportaveis))


if __name__ == "__main__":
    processar()
