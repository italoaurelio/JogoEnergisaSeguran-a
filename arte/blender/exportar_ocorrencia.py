"""
Exporta a cena da ocorrencia em glTF: o cenario fixo e, em nos separados, cada
peca que o jogador posiciona (caminhonete, cone, cavalete, fita).

O cenario fixo passa pelo bake (poste e via usam projecao BOX e ruido
procedural, que nao existem em glTF — ver exportar.py). As pecas soltas usam
material simples e vao direto.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P exportar_ocorrencia.py
"""
import bpy, os, sys, json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import cenario as CEN
import caminhao as CAM
import ocorrencia as OC
import exportar as X

SAIDA = os.path.join(C.RAIZ, "export")
TEX_SAIDA = os.path.join(SAIDA, "tex")

# grupos do cenario fixo: (nome, resolucao, prefixos)
GRUPOS = [
    ("oc_poste",         2048, ("poste",)),
    ("oc_madeira",       1024, ("cruzeta", "suporte")),
    ("oc_porcelana",     1024, ("isolador", "bucha", "chave_porc")),
    ("oc_metal",          512, ("pino", "pf", "amarra", "terra_", "mao",
                                "degrau", "placa_id", "chave_aco", "trafo_")),
    ("oc_transformador", 2048, ("transformador",)),
    ("oc_condutor",      1024, ("mt", "jumper")),
    ("oc_via",           2048, ("via_",)),
    ("oc_quadra",        2048, ("cenario_quadra",)),
]


def juntar(nome, objs):
    objs = [o for o in objs if o and o.name in bpy.data.objects]
    if not objs:
        return None
    membros = [X.preparar(o) for o in objs]
    alvo = C.juntar(membros, nome) if len(membros) > 1 else membros[0]
    alvo.name = nome
    return alvo


def resgatar_verniz(obj, peso=0.9, aspereza=0.22):
    """Devolve o verniz (clearcoat) depois do forno.

    `assar_grupo` TROCA o material da peca por um PBR simples com os tres
    mapas assados — e leva junto o verniz, que da o brilho especular da
    pintura. Assado sem isto, a caminhonete vira uma caixa chapada em
    qualquer angulo.
    """
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.node_tree:
            continue
        b = next((n for n in mat.node_tree.nodes
                  if n.type == "BSDF_PRINCIPLED"), None)
        if not b:
            continue
        for entrada, valor in (("Coat Weight", peso),
                               ("Coat Roughness", aspereza),
                               ("Clearcoat", peso),
                               ("Clearcoat Roughness", aspereza)):
            if entrada in b.inputs:
                b.inputs[entrada].default_value = valor


def processar():
    os.makedirs(TEX_SAIDA, exist_ok=True)
    # nada de limpar aqui: quem limpa e o poste.montar() la dentro, e os
    # materiais precisam nascer depois dele
    m = OC.cenario_limpo()

    cena = bpy.context.scene
    cena.render.engine = "CYCLES"
    cena.cycles.device = "CPU"

    exportaveis = []

    # 1) o cenario fixo, assado por grupo de material
    for nome, res, prefixos in GRUPOS:
        membros = [o for o in bpy.context.scene.objects
                   if o.type in {"MESH", "CURVE"} and o not in exportaveis
                   and o.name.startswith(prefixos)]
        if not membros:
            print("grupo vazio:", nome)
            continue
        membros = [X.preparar(o) for o in membros]
        alvo = C.juntar(membros, nome) if len(membros) > 1 else membros[0]
        alvo.name = nome
        X.assar_grupo(alvo, nome, res, piso_ao=0.45)
        exportaveis.append(alvo)

    # 2) as pecas que o jogador posiciona, com material direto
    # A lanca e o cesto saem em nos PROPRIOS para o jogo poder levantar o
    # cesto: a lanca gira em torno do pino e o cesto translada pelo mesmo
    # giro, sem girar — senao ele despeja quem esta dentro.
    caminhao = CAM.montar("oc_veiculo", separar=True)
    soltas = {
        **caminhao,
        "oc_cone": CEN.cone(m, "oc_cone_base"),
        "oc_cavalete": OC.cavalete(m),
        "oc_fita": OC.fita_zebrada(m),
        "oc_caixa": CEN.caixa_ferramentas(m),
        "oc_escada": CEN.escada(m),
    }
    # Quais das soltas passam pelo forno.
    #
    # A CAMINHONETE ganha verniz DEPOIS do assar_grupo: `resgatar_verniz`
    # restaura o KHR_materials_clearcoat que o forno troca. As cinco pequenas
    # nao tem nada a perder e tem auto-oclusao que vale a pena: o degrau da
    # escada, a perna cruzada do cavalete, o anel da base do cone.
    #
    # O `sujar` antes do forno e o que tira a cor chapada: cone e fita de
    # verdade sao riscados e sujos, nunca um laranja uniforme de catalogo.
    ASSAR = {
        "oc_cone": (512, 10.0, 0.30),
        "oc_cavalete": (512, 8.0, 0.28),
        "oc_fita": (512, 14.0, 0.22),
        "oc_caixa": (512, 9.0, 0.30),
        "oc_escada": (768, 7.0, 0.24),
    }

    catalogo = []
    for nome, obj in soltas.items():
        if not obj:
            print("peca vazia:", nome)
            continue
        obj.name = nome
        obj.location = (0, 0, 0)
        obj.rotation_euler = (0, 0, 0)
        if nome in ASSAR:
            res, escala, forca = ASSAR[nome]
            for slot in obj.material_slots:
                if slot.material:
                    C.sujar(slot.material, escala=escala, forca=forca,
                            aspereza=0.22)
            X.assar_grupo(obj, nome, res, piso_ao=0.50)
        exportaveis.append(obj)
        catalogo.append(nome)
        for slot in obj.material_slots:
            if slot.material:
                slot.material.use_backface_culling = True

    for o in bpy.context.scene.objects:
        o.select_set(o in exportaveis)
    destino = os.path.join(SAIDA, "ocorrencia.glb")
    bpy.ops.export_scene.gltf(filepath=destino, export_format="GLB",
                              use_selection=True, export_apply=True,
                              export_yup=True)

    with open(os.path.join(SAIDA, "ocorrencia.json"), "w") as f:
        json.dump({
            "fixo": [n for n, _, _ in GRUPOS],
            "soltas": catalogo,
            # Blender (x, y, z) -> glTF com Y para cima: (x, z, -y). O jogo
            # gira a lanca em torno do PINO e leva o cesto pelo mesmo giro.
            "pino": [round(CAM.PINO[0], 4), round(CAM.PINO[2], 4),
                     round(-CAM.PINO[1], 4)],
            "cestoBase": [round(CAM.CESTO_BASE[0], 4), round(CAM.CESTO_BASE[2], 4),
                          round(-CAM.CESTO_BASE[1], 4)],
        }, f, indent=2, ensure_ascii=False)
    print("GLB:", destino, os.path.getsize(destino) // 1024, "KB")
    print("SOLTAS:", ", ".join(catalogo))


if __name__ == "__main__":
    processar()
