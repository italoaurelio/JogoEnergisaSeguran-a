# Repasse — rodada gráfica do jogo de segurança

Documento de passagem de bastão. Escrito para alguém **sem nenhum contexto**
da conversa em que este trabalho foi feito (04–05/10/2026).

O pedido do cliente, a Energisa, foi: *"amador, tudo muito chapado, bugado,
não tem cara de projeto final"* e, sobre o caminhão, *"faça um modelo
detalhado, real, que não pareça um lego"*.

---

## 1. A COISA MAIS IMPORTANTE: como destravar a modelagem

A diferença entre o que estava ruim e o que ficou bom **não foi esforço, foi
método**. Três coisas, nesta ordem:

### 1.1. Carregar as skills de modelagem ANTES de tocar no código

```
Skill(skill="blender-modeling")   # hard surface, pilha de modificadores, bmesh
Skill(skill="blender-materials")  # PBR
Skill(skill="blender-export")     # glTF
```

Elas já estão instaladas. **Não precisa instalar nada.**

Tudo que estava ruim no projeto tinha a mesma causa: foi empilhado com
`C.caixa` e `C.cilindro` na mão, sem modificador nenhum. As peças que ficaram
boas usam **perfil extrudado, revolução, booleano, Array e Bevel aplicado** —
que é exatamente o conteúdo da skill.

### 1.2. Contexto limpo por peça

Uma conversa longa fica pior em modelagem, não melhor. O caminhão só ficou bom
quando foi para um agente com contexto limpo, com briefing escrito. O padrão
que funcionou: **um agente por grupo de peças**, em sequência (nunca em
paralelo — todos mexem nos mesmos exportadores e em `comum.py`).

### 1.3. Verificar OLHANDO, com render em Cycles

Screenshot do jogo **não serve** para julgar modelagem: a câmera da fase é
distante, a cena é noturna e o pós-processamento mascara defeito.

Existem quatro provas prontas, todas no mesmo molde:
`prova_caminhao.py`, `prova_via.py`, `prova_ocorrencia.py`, `prova_epi.py`.

```bash
cd arte/blender && /Applications/Blender.app/Contents/MacOS/Blender -b -P prova_caminhao.py
```

Depois **abrir o PNG e olhar**. Ciclo: modela → renderiza → olha → corrige.
Os bons resultados levaram de 6 a 12 ciclos. Render em 820×560 (arquivo maior
trava quem for abrir).

**Cuidado conhecido:** se a prova criar um chão próprio, conferir a altura
contra as peças. Uma prova enterrou o acostamento e quase levou a "consertar"
uma peça que estava certa.

---

## 2. Armadilhas que já custaram caro

Todas descobertas medindo, não supondo. Nenhuma dá erro — falham em silêncio.

| # | Armadilha | Consequência |
|---|---|---|
| 1 | **`C.sujar` em peça que NÃO vai ao forno** | Monta ruído procedural; procedural não exporta para glTF e **leva a cor base junto**. O material chega branco com rugosidade 1,0. Colapsou 7 materiais do caminhão num branco só. **Era por isso que a caminhonete antiga era branca chapada.** |
| 2 | **`chanfrar` só empilhava o Bevel** | `juntar` usa `bpy.ops.object.join()`, que **descarta o modificador de todo objeto que não é o ativo**. De cada grupo sobrevivia UM chanfro. Eram 89 chanfros no pipeline; a maioria nunca chegou na tela. **JÁ CORRIGIDO** — `chanfrar` agora aplica na hora, e por isso custa polígono. |
| 3 | **`assar_grupo` TROCA o material da peça** | Leva junto qualquer extensão (Sheen do tecido, clearcoat da pintura) e funde todos os materiais num só — cromo vira plástico. Ou se restaura depois (ver `resgatar_sheen` em `epi.py`), ou não se assa a peça. **O caminhão não vai ao forno por isso.** |
| 4 | **Modificador caro em peça fina** | SKIN num fio de 1,6 cm custou **30.252 triângulos, 82% do catálogo da via**. Buchas a 32 segmentos custaram 13.104. Três vezes o orçamento estava invertido: a peça importante era a mais barata e o detalhe invisível o mais caro. |
| 5 | **Peso do Sheen não chega ao glTF** | Testado com 0,22 / 0,52 / 0,55: `sheenColorFactor` sai sempre `[1,1,1]`. Só `sheenRoughnessFactor` viaja. Para mudar brilho no jogo, mexer em `material.sheen` no three.js. |
| 6 | **Parentesco de objeto não sobrevive ao glTF** | As lentes do semáforo, feitas como filhas do poste, saíram como irmãs na raiz e a cópia instanciada ficou cega. Solução: juntar na mesma malha e endereçar pelo nome do **material**. |
| 7 | **Convenção de eixos muda por arquivo** | `via.py` e `veiculo.py` apontam para **-Y**. `cenario.py` e `caminhao.py` usam **X como comprimento**. Já houve erro por copiar código entre eles. **Conferir sempre.** |
| 8 | **Textura que não é textura** | `arte/tex/concrete_wall_008_diff.jpg` tem desvio padrão **2,96** em 0–255 (faixa 93–147). É uma amostra de cinza. Pintava o poste e a calçada. Trocado por `dirty_concrete` (desvio 15,03). **Medir a textura antes de culpar a modelagem.** |

---

## 3. O que foi feito

### Pronto, verificado e publicado

- **Caminhão com cesto aéreo** (`caminhao.py`, 854 linhas) — substitui a
  caminhonete de caixas. Medidas da especificação de frota da Energisa
  (classe 10–13 m): 6,80 m, entre-eixos 3,60 m, cabine avançada. 15 materiais
  separados, 12.900 triângulos. **Aprovado pelo cliente.**
- **Chanfro aplicado no projeto inteiro** — os 89 chanfros agora existem na
  tela. Todos os modelos reexportados.
- **Via / trajeto** (`via.py`) — árvores, casas, carro, poste, placa, ônibus,
  ciclista. **36.176 → 8.984 triângulos**, melhor e mais leve.
- **Ocorrência** (`poste.py`, `ocorrencia.py`, `cenario.py`) — poste com
  furação passante, degraus de escalada e **três chaves fusíveis, que não
  existiam no modelo** (a fase inteira ensina a trocar o elo fusível e a chave
  não estava lá). Transformador com parede corrugada de verdade. Fita zebrada
  que agora tem zebra. **54.140 → 47.932 triângulos.**

### Orçamento de triângulos, hoje

| modelo | triângulos |
|---|---|
| via | 8.984 |
| cabine | 9.928 |
| ocorrência (inclui o caminhão) | 47.932 |
| personagem | 195.536 |
| motorista | 138.520 |

---

## 4. ⚠️ O ESTADO QUEBRADO QUE VOCÊ ESTÁ HERDANDO

**`arte/blender/epi.py` está quebrado.** Uma remodelagem do EPI foi
interrompida no meio.

- O arquivo **exporta sem erro** (19 de 19 peças) — por isso o defeito é
  traiçoeiro.
- O resultado na tela está **pior** que o anterior: borda serrilhada no peito
  e no ombro do uniforme, degrau em escada na coxa, perna abaixo do joelho
  inchada, luva enorme. Ver `arte/render/epi_conjunto.png`.
- **Os `.glb` publicados ainda são os BONS.** O jogo está inteiro.
- **NÃO rode `./publicar-arte.sh personagem` nem `... motorista`** até
  consertar, ou você derruba a arte boa.
- **NÃO HÁ BACKUP.** O projeto não está em git e a versão anterior do arquivo
  não existe mais. O conserto é para frente.

Há um aviso gravado no topo do próprio `epi.py`.

Suspeita do que quebrou: os recortes de `_camisa` / `_calca`, que selecionam
face do corpo por CAIXA de coordenada em `H.recortar`.

---

## 5. O que falta

### Arte
1. **Consertar `epi.py`** (acima). É o item bloqueante.
2. **Interior da cabine** (`veiculo.py`) — nunca foi remodelado. Ocupa o terço
   inferior da tela durante os 1.340 m do trajeto; é o que mais tempo fica em
   cena no jogo inteiro.
3. **Cruzeta** (`oc_madeira`, 108 triângulos) — peça de herói, única da
   ocorrência não remodelada: tábua chanfrada sem furo nem parafuso.
4. Ônibus (paralelepípedo no comprimento) e ciclista (peça mais cara e mais
   fraca do catálogo da via). Sobram ~51.000 triângulos de orçamento na via.
5. **Manga que some em corpo posado** — causa raiz documentada no docstring de
   `_camisa`: o recorte é uma caixa em coordenada de mundo e `recortar` avalia
   a malha com a armadura LIGADA, então no motorista sentado o antebraço sai
   da caixa e nenhuma manga é gerada. Corrigir com critério independente de
   pose (grupos de vértice ou coordenada de repouso).

### Decisões que dependem do usuário
6. **Versionar o projeto em git.** É a trava de tudo. Esta rodada perdeu a
   versão boa do `epi.py` exatamente por isso. Também libera apagar 459 linhas
   de código morto (`src/Cena.tsx` + `src/dados.ts`) e 2,1 MB de
   `cenario.glb`, levando o pacote de 12 MB para ~10 MB.
7. **Verde da marca não confirmado.** `VERDE_MARCA` em `caminhao.py` está
   chutado. Pegar o hex do manual de marca da Energisa.
8. **A nota mudou de equilíbrio**: 364 → 440 pontos, e o trajeto saiu de 19%
   para 33% da prova (dez condutas, eram cinco). O corte de 70% foi combinado
   contra a distribuição antiga.
9. **Com cesto aéreo, a escada deixa de ser obviamente a ferramenta certa** no
   item do ferramental da fase 3. Mexe em conteúdo, não em arte.

### Nunca medido
10. **Desempenho no mini-PC do totem.** Tudo foi medido no painel do navegador
    do app, que estrangula a taxa de quadros a ponto de uma leitura ter
    mentido 30 ms. Se não couber, o primeiro corte é a oclusão ambiente — que
    foi o maior ganho gráfico da rodada.

---

## 6. Receita rápida

```bash
# render de conferência (é assim que se julga modelagem)
cd arte/blender && /Applications/Blender.app/Contents/MacOS/Blender -b -P prova_caminhao.py

# exportar + publicar  (NÃO rode para personagem/motorista até consertar o EPI)
cd arte/blender && /Applications/Blender.app/Contents/MacOS/Blender -b -P exportar_ocorrencia.py
cd ../.. && ./publicar-arte.sh ocorrencia

# conferir o .glb: tamanho do JSON em buf.readUInt32LE(12), conteúdo do byte 20
```

Atalho de desenvolvimento no jogo: `?fase=trajeto&m=600` entra direto na fase,
naquele metro. Só vale em `npm run dev`.
