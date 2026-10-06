"""
Exporta a cabine em glTF, com cada estado conferido num no separado.

Mesmo padrao do personagem: o `.glb` traz a cabine fixa mais os PARES de
estado (cinto solto / afivelado, retrovisor desregulado / regulado, ...), e o
jogo liga um de cada par. Mandar corrigir na fase 2 troca o no, e o jogador ve
a correcao acontecer.

Aqui NAO se assa textura: os materiais da cabine sao Principled direto, sem
procedural, e atravessam o exportador inteiros. Quem ilumina e o three.js.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P exportar_cabine.py
"""
import bpy, os, sys, json, math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import veiculo as V
import exportar as X

SAIDA = os.path.join(C.RAIZ, "export")


def para_jogo(v):
    """Blender (x, y, z) -> glTF com Y para cima: (x, z, -y)."""
    return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]


def juntar(nome, objs):
    objs = [o for o in objs if o and o.name in bpy.data.objects]
    if not objs:
        return None
    membros = [X.preparar(o) for o in objs]
    alvo = C.juntar(membros, nome) if len(membros) > 1 else membros[0]
    alvo.name = nome
    return alvo


def processar():
    os.makedirs(SAIDA, exist_ok=True)
    C.limpar()

    fixo = V.fixo()
    grupos = V.estados()

    exportaveis = []
    catalogo = {}
    for nome, objs in grupos.items():
        alvo = juntar(f"est_{nome}", objs)
        if alvo:
            exportaveis.append(alvo)
            catalogo[nome] = alvo.name
        else:
            print("estado vazio:", nome)

    base = juntar("cabine", fixo)
    if base:
        exportaveis.append(base)

    # face unica em tudo menos o vidro, pelo mesmo motivo do personagem
    for o in exportaveis:
        for slot in o.material_slots:
            if slot.material and slot.material.name != "vidro":
                slot.material.use_backface_culling = True

    for o in bpy.context.scene.objects:
        o.select_set(o in exportaveis)
    destino = os.path.join(SAIDA, "cabine.glb")
    bpy.ops.export_scene.gltf(filepath=destino, export_format="GLB",
                              use_selection=True, export_apply=True,
                              export_yup=True)

    dados = {
        "olho": para_jogo(V.OLHO),
        "volante": para_jogo(V.VOLANTE),
        "largura": V.LARGURA,
        "altura": V.ALTURA,
        "painelTopo": V.PAINEL_TOPO,
        "estados": catalogo,
    }
    with open(os.path.join(SAIDA, "cabine.json"), "w") as f:
        json.dump(dados, f, indent=2, ensure_ascii=False)

    print("GLB:", destino, os.path.getsize(destino) // 1024, "KB")
    print("ESTADOS:", ", ".join(sorted(catalogo)))


if __name__ == "__main__":
    processar()
