"""
Exporta as pecas da via em glTF, cada uma num no proprio.

O jogo instancia e recicla: o mundo corre e a cabine fica parada. Por isso
nada aqui e montado em cena — o .glb e um CATALOGO de pecas, todas na origem,
e quem posiciona e o three.js.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P exportar_via.py
"""
import bpy, os, sys, json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import via as V

SAIDA = os.path.join(C.RAIZ, "export")


def processar():
    os.makedirs(SAIDA, exist_ok=True)
    C.limpar()
    m = V.materiais()

    pecas = {
        "trecho": V.trecho(m),
        "chao": V.chao(m),
        "poste": V.poste_da_via(m),
        "cabos": V.vao_de_cabos(m),
        "placa": V.placa(m),
        "arvore": V.arvore(m),
        "arbusto": V.arbusto(m),
        # Tres casas, nao uma. O jogo clona a malha e clone de three.js
        # compartilha o material, entao a unica variacao possivel e por peca
        # separada no catalogo. `casa` continua sendo a de sempre, para nada
        # no jogo quebrar; `casa_b` e `casa_c` ficam disponiveis para o
        # sorteio em `paisagem.ts` (ver Marco['peca']).
        "casa": V.casa(m),
        "casa_b": V.casa_b(m),
        "casa_c": V.casa_c(m),
        "escola": V.escola(m),
        # a ENTRADA da escola: entra uma vez na quadra, nao ladrilha
        "escola_portao": V.escola_portao(m),
        # Quatro carros, pelo mesmo motivo das tres casas: o jogo clona a
        # malha e clone de three.js divide o material, entao variacao de
        # FORMA so existe como peca separada no catalogo.
        "carro": V.carro(m),
        "carro_b": V.carro_b(m),
        "carro_c": V.carro_c(m),
        "carro_d": V.carro_d(m),
        "moto": V.moto(m),
        "lombada": V.lombada(m),
        "faixa_pedestre": V.faixa_pedestre(m),
        "semaforo": V.semaforo(m),
        "onibus": V.onibus(m),
        "ciclista": V.ciclista(m),
        "muro_patio": V.muro_patio(m),
        "pedestre": V.pedestre(m),
        # mesma peca a 1,25 m: crianca de embarque do onibus escolar
        "crianca": V.crianca(m),
    }

    exportaveis = []
    for nome, obj in pecas.items():
        if not obj:
            print("peca vazia:", nome)
            continue
        obj.name = f"via_{nome}"
        obj.location = (0, 0, 0)
        exportaveis.append(obj)
        for slot in obj.material_slots:
            if slot.material:
                slot.material.use_backface_culling = True

    # As lentes do semaforo sao FILHAS do poste e nao entram em `pecas` — sem
    # arrastar os filhos junto, o semaforo exporta cego.
    def com_filhos(objs):
        saida = []
        pilha = list(objs)
        while pilha:
            o = pilha.pop()
            saida.append(o)
            pilha.extend(o.children)
        return saida

    selecionados = com_filhos(exportaveis)
    for o in bpy.context.scene.objects:
        o.select_set(o in selecionados)
    destino = os.path.join(SAIDA, "via.glb")
    bpy.ops.export_scene.gltf(filepath=destino, export_format="GLB",
                              use_selection=True, export_apply=True,
                              export_yup=True)

    dados = {
        "trecho": V.TRECHO,
        "faixa": V.FAIXA,
        # em coordenadas do jogo o x nao muda; so y e z trocam
        "eixo": V.EIXO,
        "bordaDireita": V.BORDA_DIR,
        "bordaEsquerda": V.BORDA_ESQ,
        "acostamento": V.ACOSTAMENTO,
        "pecas": [o.name for o in exportaveis],
    }
    with open(os.path.join(SAIDA, "via.json"), "w") as f:
        json.dump(dados, f, indent=2, ensure_ascii=False)
    print("GLB:", destino, os.path.getsize(destino) // 1024, "KB")
    print("PECAS:", ", ".join(d for d in pecas))

if __name__ == "__main__":
    processar()
