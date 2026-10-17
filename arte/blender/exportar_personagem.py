"""
Assa o personagem e exporta em glTF com cada peca de EPI num no separado.

O jogo liga e desliga a visibilidade de cada no conforme o jogador veste - por
isso nada de juntar tudo numa malha so.

O que precisa de bake e so a PELE e o OLHO: a pele v2 do MPFB e uma arvore de
grupos de nos e o olho e uma rampa em coordenada gerada, e nenhum dos dois
existe em glTF. O EPI usa Principled direto, que atravessa o exportador
inteiro.

A pele e assada com tom NEUTRO de proposito. O mapa guarda poro, veia e
sombra; a cor da pele que o jogador escolhe entra em tempo de execucao
multiplicando o mapa pela cor do material, que e como o three.js combina os
dois. Assar o tom escolhido exigiria um mapa por tom.

Uso: /Applications/Blender.app/Contents/MacOS/Blender -b -P exportar_personagem.py
"""
import bpy, os, sys, json, math
import numpy as np

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import comum as C
import humano as H
import epi as E
import exportar as X

SAIDA = os.path.join(C.RAIZ, "export")
TEX_SAIDA = os.path.join(SAIDA, "tex")

# Tom neutro do bake. Fica no MEIO da faixa real de pele (albedo ~0.35 no tom
# mais claro, ~0.06 no mais escuro), e nao num cinza claro: assado em 0.72 o
# mapa saia cor de giz e o jogo tinha de multiplicar por 0.3 para parecer
# gente, o que comia todo o contraste do poro e da veia.
# Mudar este valor obriga a refazer a tabela TONS em src/conteudo/fisico.ts.
TOM_NEUTRO = (0.30, 0.215, 0.165)

FISICO_PADRAO = dict(genero=0.95, idade=0.58, musculo=0.62, peso=0.52,
                     altura=0.55)


def limpar_pais(objs):
    """Tira o vinculo com o corpo mantendo a posicao no mundo.

    O bake e o join reclamam de objeto com pai; e como o corpo esta na
    identidade, soltar nao move nada.
    """
    for o in objs:
        if o.parent:
            mundo = o.matrix_world.copy()
            o.parent = None
            o.matrix_world = mundo


def montar():
    """Corpo + olhos + cabelo + todas as pecas de EPI do catalogo."""
    C.limpar()
    C.hdri(forca=0.25, rotacao=math.radians(200))
    H.luz_vestiario()

    corpo = H.criar_corpo(H.macro(**FISICO_PADRAO), tom=TOM_NEUTRO)
    corpo.name = "corpo"

    # RIG E POSE, nesta ordem e antes de tudo.
    #
    # Este exportador nunca pos rig nenhum: o personagem do vestiario saia na
    # pose de descanso do MPFB, com os bracos abertos a quase 45 graus. Aquilo
    # e pose de MODELAGEM, feita para a malha deformar bem — nao para alguem
    # olhar. Era de onde vinha o "duraco, reto" do retorno do cliente, e
    # nenhuma animacao de respiracao no jogo conserta um manequim.
    #
    # Olhos, cabelo e sobrancelha vem DEPOIS da pose, como no motorista: eles
    # sao objetos filhos por transformacao, nao por armadura, entao criados
    # antes ficariam parados enquanto a cabeca se mexe.
    arm = H.adicionar_rig(corpo)
    H.pose_descanso(arm)

    olhos = H.criar_olhos(corpo)
    cabelo = H.cabelo(corpo)
    H.sobrancelhas(corpo, olhos)

    ref = H.referencias(corpo)
    pecas = E.vestir(corpo, ref, list(E.MONTAGEM))
    pecas["base_roupa"] = E.roupa_base(corpo, ref)
    # o tenis com que ele chega: no proprio, para o jogo esconder quando
    # o jogador calca a botina
    pecas["base_tenis"] = E.tenis_base(corpo, ref)
    return corpo, arm, olhos, cabelo, ref, pecas


def so_no_bake(alvo):
    """Esconde do render tudo menos `alvo`, e devolve como restaurar.

    O bake de oclusao enxerga a cena inteira. Com as 19 pecas de EPI montadas
    em volta do corpo — inclusive as que o jogador nunca vai vestir — a pele
    sai assada como se estivesse debaixo de tudo aquilo, e o personagem chega
    no jogo quase preto. Cada peca tem de ser assada sozinha.
    """
    antes = {}
    for o in bpy.context.scene.objects:
        antes[o.name] = o.hide_render
        o.hide_render = o is not alvo
    return antes


def restaurar(antes):
    for nome, valor in antes.items():
        o = bpy.data.objects.get(nome)
        if o:
            o.hide_render = valor


def assar_pele(corpo):
    alvo = X.preparar(corpo)
    alvo.name = "corpo"
    antes = so_no_bake(alvo)
    try:
        # piso de oclusao alto: a pele ja recebe sombra calculada no jogo, e
        # somar as duas fecha o rosto no preto
        X.assar_grupo(alvo, "pele", 2048, piso_ao=0.62)
    finally:
        restaurar(antes)
    return alvo


def assar_olhos(olhos):
    """UM OLHO DE CADA VEZ, e depois junta. A ordem inversa apaga a iris.

    `mat_olho` desenha pupila, iris, limbo e esclera pela DISTANCIA AO CENTRO
    em coordenada `Generated` — que o Blender normaliza pela caixa do OBJETO.
    Numa esfera sozinha isso da exatamente o que se quer: o centro da caixa e
    o centro do olho, e os aneis caem no lugar.

    Assando os dois JA JUNTOS, a caixa passa a ser a dos dois olhos: 9 cm em X
    contra 1,5 cm em Z. O eixo X e esticado quase sete vezes, cada esfera fica
    inteira na faixa |x-0,5| ~ 0,4, e 0,4 e muito maior que o raio da esclera
    (0,155). Resultado: as duas esferas saem com a cor da esclera por inteiro.

    Era por isso que o personagem tinha dois ovos brancos no rosto — e nao
    dava erro nenhum, nem no bake nem no export. O retorno do cliente foi
    "parece que nao tem olho".
    """
    if not olhos:
        return None
    limpar_pais(olhos)
    membros = []
    for i, o in enumerate(olhos):
        m = X.preparar(o)
        antes = so_no_bake(m)
        try:
            # 256 e nao 512: o olho tem 7 mm de raio e aparece de perto so na
            # tela de tom de pele. Dois mapas de 256 custam menos que um de 512.
            X.assar_grupo(m, f"olho_{i}", 256, piso_ao=0.85)
        finally:
            restaurar(antes)
        membros.append(m)
    alvo = C.juntar(membros, "olhos") if len(membros) > 1 else membros[0]
    alvo.name = "olhos"
    return alvo


def juntar_peca(ident, objs):
    """Uma peca do catalogo vira UM objeto, nomeado com o id do conteudo."""
    objs = [o for o in objs if o and o.name in bpy.data.objects]
    if not objs:
        return None
    limpar_pais(objs)
    membros = [X.preparar(o) for o in objs]
    alvo = C.juntar(membros, f"epi_{ident}") if len(membros) > 1 else membros[0]
    alvo.name = f"epi_{ident}"
    return alvo


def assar_uniforme(alvo):
    """Assa SO o uniforme, e sem juntar com nada.

    E a maior superficie do personagem e a queixa do cliente ("chapado").
    Assar as 18 pecas do EPI seria um conjunto de texturas por peca — dezenas
    de arquivos — e `assar_grupo` opera numa peca so, entao o uniforme sai
    assado sem encostar no resto.

    **A separacao das pecas continua intacta**, que e o que faz o vestiario
    ligar e desligar cada uma: aqui nao ha `join`.
    """
    for slot in alvo.material_slots:
        if slot.material and "uniforme_fr" in slot.material.name:
            E.detalhar_tecido(slot.material)
    X.assar_grupo(alvo, "uniforme", 1024, piso_ao=0.55)
    E.resgatar_sheen(alvo)


def ajustar_visor(obj):
    """O visor sai transparente por alpha: absorcao de volume nao existe em
    glTF, e transmissao ainda e irregular entre navegadores."""
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.node_tree:
            continue
        mat.blend_method = "BLEND"
        b = next((n for n in mat.node_tree.nodes
                  if n.type == "BSDF_PRINCIPLED"), None)
        if not b:
            continue
        if "Transmission Weight" in b.inputs:
            b.inputs["Transmission Weight"].default_value = 0.0
        b.inputs["Base Color"].default_value = (0.30, 0.26, 0.16, 1.0)
        b.inputs["Alpha"].default_value = 0.34
        b.inputs["Roughness"].default_value = 0.08


def processar():
    os.makedirs(TEX_SAIDA, exist_ok=True)
    corpo, arm, olhos, cabelo, ref, pecas = montar()

    cena = bpy.context.scene
    cena.render.engine = "CYCLES"
    cena.cycles.device = "CPU"          # bake na GPU Metal e instavel

    exportaveis = []

    # as pecas primeiro: `preparar` do corpo aplica modificadores e o recorte
    # ja aconteceu, entao a ordem nao muda o resultado - mas o corpo perde o
    # vinculo dos filhos quando vira malha, e isso quebraria o join depois
    catalogo = {}
    for ident, objs in pecas.items():
        alvo = juntar_peca(ident, objs)
        if not alvo:
            print("peca vazia:", ident)
            continue
        if ident == "protetor_facial_arco":
            ajustar_visor(alvo)
        if ident == "vestimenta_fr":
            assar_uniforme(alvo)
        exportaveis.append(alvo)
        catalogo[ident] = alvo.name

    # QUATRO pecas de cabelo, e nao uma: tres cortes mais a faixa que fica
    # sob o capacete. O jogo mostra uma de cada vez, como ja faz com o EPI.
    if cabelo:
        limpar_pais(cabelo)
        for p in cabelo:
            nome = p.name
            pronto = X.preparar(p)
            pronto.name = nome
            exportaveis.append(pronto)

    ol = assar_olhos(olhos)
    if ol:
        exportaveis.append(ol)

    pele = assar_pele(corpo)
    # MESMA ARMADILHA DO MOTORISTA: o corpo e FILHO do rig, e `convert` nao
    # traz a matriz do pai para a malha. Aqui o rig esta na origem, entao
    # apagar nao desloca nada hoje — mas basta alguem mexer o rig um dia para
    # o corpo sair do lugar sem aviso, que foi exatamente o que aconteceu na
    # cabine. Soltar mantendo a matriz custa uma linha.
    limpar_pais([pele])
    exportaveis.append(pele)
    if arm and arm.name in bpy.data.objects:
        bpy.data.objects.remove(arm, do_unlink=True)

    # face unica em tudo que nao e transparente. Com face dupla, a casca
    # engrossada da roupa deixa ver as faces de dentro onde ela se cruza, e
    # aparecem manchas claras no peito e na coxa que nao existem no render do
    # Blender (la o backface culling do material nao muda o Cycles).
    for o in exportaveis:
        for slot in o.material_slots:
            if slot.material and slot.material.name != "policarbonato":
                slot.material.use_backface_culling = True

    for o in bpy.context.scene.objects:
        o.select_set(o in exportaveis)
    destino = os.path.join(SAIDA, "personagem.glb")
    bpy.ops.export_scene.gltf(filepath=destino, export_format="GLB",
                              use_selection=True, export_apply=True,
                              export_yup=True)

    # glTF exporta com Y para cima: (x, y, z) do Blender vira (x, z, -y)
    def para_jogo(v):
        return [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]

    dados = {
        "fisico": FISICO_PADRAO,
        "tomNeutro": list(TOM_NEUTRO),
        "altura": round(ref["altura"], 4),
        "pecas": catalogo,
        "marcos": {k: para_jogo(v) for k, v in ref.items()
                   if hasattr(v, "x")},
    }
    with open(os.path.join(SAIDA, "personagem.json"), "w") as f:
        json.dump(dados, f, indent=2, ensure_ascii=False)

    print("GLB:", destino, os.path.getsize(destino) // 1024, "KB")
    print("PECAS:", len(catalogo), "de", len(E.MONTAGEM) + 1)
    faltando = sorted((set(E.MONTAGEM) | {"base_roupa"}) - set(catalogo))
    if faltando:
        print("FALTANDO:", ", ".join(faltando))


if __name__ == "__main__":
    processar()
