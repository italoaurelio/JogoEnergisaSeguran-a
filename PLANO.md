# Treinamento de segurança — escopo completo

Documento de trabalho. O jogo deixa de ser um cenário único de vistoria e passa a
ser uma **jornada de três fases** com pontuação cumulativa e nota de corte.

Decisões travadas com o cliente em 28/09/2026:

| Tema | Decisão |
|---|---|
| Personagem | Humano realista, corpo paramétrico gerado no Blender (MPFB/MakeHuman) |
| Trânsito | Dirigir de verdade, o mais facilitado possível — o controle é a velocidade |
| Pontuação | Nota cumulativa única no fim, com corte. Sem reprovação instantânea |
| Cenário antigo | "Olho no Risco" é descartado como fase; o poste é reaproveitado como arte |

---

## As três fases

### Fase 1 — Vestiário

Duas etapas na mesma tela, com o personagem de corpo inteiro num espelho.

**1a. Montagem física.** Gênero, porte (magro/médio/forte), altura, tom de pele,
cabelo e barba. Não é enfeite: é o que faz o colaborador se reconhecer no boneco
que vai levar o choque três minutos depois.

**1b. Escolha do EPI.** Uma arara com muito mais peças do que o necessário. O
jogador veste o personagem e confirma. Cada vaga (cabeça, face, mãos, corpo,
pés, cintura) tem a peça certa e distratores plausíveis — luva de vaqueta no
lugar da isolante, óculos escuro comum, capacete de obra sem jugular, tênis.

Cobre os itens **4** (não usar EPI) e **5** (usar errado) do briefing. O item 5
aparece como armadilha fina: acertar a luva isolante mas esquecer a luva de
cobertura, ou pegar a isolante com ensaio vencido.

### Fase 2 — Em trânsito

**2a. Veículo desligado.** Dentro da cabine, o jogador confere o que precisa
estar certo antes de dar a partida: cinto, retrovisores, apoio de cabeça, freio
de mão, extintor, triângulo, checklist, e a carga amarrada na caçamba. Mecânica
de clique já existe e é reaproveitada.

**2b. Trajeto.** O veículo segue o traçado sozinho — não há volante. O jogador
controla **acelerador e freio**. A via apresenta situações: placa de velocidade,
escola, lombada, pedestre, curva, veículo à frente. A pontuação mede velocidade
compatível, distância de seguimento e parada onde é obrigatório.

Cobre o item **1** (condução) e o item **7** (transporte de carga).

### Fase 3 — Ocorrência

**3a. Chegada e sinalização.** Posicionar o veículo e isolar a área antes de
qualquer coisa — item **1**.

**3b. Separar o equipamento.** A falha do dia é conhecida. Da caixa de
ferramentas o jogador separa o que vai usar. Distratores: ferramenta errada para
a função, ferramenta danificada, ferramenta sem isolação. Itens **3**, **6**,
**8**.

**3c. O reparo.** Sequência na ordem certa: desenergizar, testar ausência de
tensão, aterrar temporariamente, executar, retirar o aterramento, reenergizar.
Errar a ordem custa caro na nota — é a sequência que mata quando invertida.

---

## Pontuação

Cumulativa nas três fases, com peso maior para o que mata. Nota e corte no fim,
sem interromper o jogador no meio. O relatório final lista cada decisão tomada,
o que era o certo e a norma correspondente — é o material que o instrutor leva
para a conversa depois.

---

## Pipeline de arte

O que já estava montado continua: modelagem por script no Blender, render de
conferência em Cycles, bake em UV, export glTF. O que muda é a entrada do
humano.

**MPFB 2.0.17** instalado como extensão do Blender 5.2.1 e dirigido por script,
sem interface. Provado em `arte/render/prova_humano.png`: três físicos distintos
(1,86 m / 1,75 m / 1,62 m) gerados headless em um passe.

- `HumanService.create_human(macro_detail_dict=…)` — as alavancas físicas
  (gênero, idade, músculo, peso, proporção, altura, etnia).
- Rigs de fábrica incluem **`game_engine`** e **`mixamo`** — o rig Mixamo abre a
  porta para animação pronta (sentar na cabine, subir, alcançar) sem animar à mão.
- O EPI é modelado por nós, como todo o resto. É superfície dura, que é
  justamente o que sai bem por script.

**Personalização em tempo de execução.** Para o EPI acompanhar o corpo sem
explodir o número de arquivos:

- **porte** — 3 morph targets no glTF, presentes no corpo *e* em cada peça de
  roupa (a peça é vestida no corpo base e re-ajustada por morph no Blender).
- **altura** — escala em tempo de execução, de graça.
- **tom de pele, cabelo, barba** — material e troca de malha.
- **gênero** — dois personagens-base.

## Estado

**Fase 1 — vestiário: jogável.** Monta o físico (altura e tom de pele),
escolhe o EPI numa arara de 19 peças em 7 vagas do corpo, veste o personagem na
hora e fecha com relatório pontuado. As 18 peças do catálogo estão modeladas e
exportadas; o `.glb` tem 746 KB comprimido.

Falta na fase 1: **porte** (magro/médio/forte). Exige morph target no corpo e
em cada peça de roupa, senão a roupa não acompanha. O caminho é gerar o mesmo
recorte de faces em cada físico — a topologia fica idêntica e os alvos de morph
saem de graça.

**Fase 2a — conferência do veículo: jogável.** Cabine modelada em primeira
pessoa (painel, volante, bancos, cinto, retrovisores, console, pedais, capô
visto pelo para-brisa). A câmera vai até cada um dos 6 itens e o jogador
decide se está certo ou precisa corrigir; mandar corrigir TROCA o nó no
modelo e ele vê a correção acontecer. O `.glb` tem 78 KB.

Falta na fase 2a: o acabamento da cabine (tudo ainda é cor chapada, sem
textura nem oclusão assada) e **integrar o motorista sentado** — hoje o cinto
afivelado cruza um banco vazio. A pose já existe e funciona
(`humano.adicionar_rig`, `pose_sentado`, `assentar`); falta assar a pele do
corpo sentado, recortar o uniforme dele e exportar como nó próprio.

**Fase 2b — trajeto: jogável.** O veículo segue o traçado e o jogador controla
acelerador e freio, por botão ou pelas setas. Sete trechos com limites
diferentes, placa, zona escolar, faixa de pedestre com parada obrigatória,
lombada e veículo à frente. A pontuação mede excesso, andar abaixo do fluxo,
lombada em velocidade, parada na faixa e distância de seguimento — cada uma
com o artigo do CTB. O catálogo da via (pista, poste, cabos, árvore, casa,
placa, carro, lombada, faixa) tem 59 KB e o mundo é reciclado: a cabine fica
parada e os trechos correm por baixo dela.

Falta na fase 2b: o pedestre na faixa (hoje o alerta aparece mas não há
ninguém na tela), textura no asfalto e no mato, e uma transição de chegada.

**Fase 3 — ocorrência: jogável.** Três etapas na mesma cena, reaproveitando o
poste com transformador e a caminhonete do cenário descartado:

- **Chegada**: três decisões (onde parar o veículo, a que distância recuar a
  sinalização, como delimitar a área). A peça escolhida aparece na cena — os
  cones recuando pela via, a fita cercando a projeção do poste.
- **Equipamento**: separar o kit para ESTA falha numa caixa com doze peças,
  metade delas armadilha — escada de alumínio, alicate sem ensaio, vara
  trincada, elo de valor maior, multímetro de baixa tensão.
- **O reparo**: as nove medidas da NR-10 na ordem, escolhendo o próximo passo.
  Vale mais que o resto da fase somado, porque é a parte que mata quando
  invertida.

Falta na fase 3: as ferramentas aparecerem na lona conforme são separadas
(hoje a seleção é só no painel), e acabamento da cena.

## Pontuação total

**440 pontos** (eram 364): 72 no vestiário, 58 na conferência, **146 no
trajeto** (eram 70) e 164 na ocorrência. Corte em 70% = 308 pontos.

**Decisão a confirmar com o cliente.** O trajeto saiu de 19% para 33% da nota,
porque passou a avaliar dez condutas em vez de cinco; a ocorrência caiu de
45% para 38% sem perder nenhum ponto. O peso de cada falta individual não
mudou — foi a quantidade de coisas avaliadas que cresceu, que é como uma nota
cumulativa deve se comportar. Mas o corte de 70% foi combinado contra a
distribuição antiga, e quem aprovou o corte precisa saber que a direção pesa
mais agora. Se o cliente quiser o equilíbrio anterior, o caminho é reduzir os
pesos das cinco faltas novas (semáforo 18, ônibus 16, ciclista 14, celular 14,
garagem 14), não mexer no corte.

## Retorno do cliente (28/09, depois de ver o vídeo da partida)

**Aprovado:** a jogabilidade. "Melhor do que eu mesmo imaginei."

**Reprovado: o gráfico.** "Amador, tudo muito chapado, bugado, não tem cara de
projeto final." Pediu explicitamente: *não* é para virar GTA — é para ser
"simples e bem feito". Mais cuidado com o personagem, as roupas e o carro.

**Reprovado: o trajeto.** "Longo e monótono." Pediu decisões ao longo do
caminho, curvas, cenários, árvores, outros carros e semáforo.

---

## Rodada 2 — feito em 04/10/2026

### Gráfico

1. **Oclusão ambiente ligada nas quatro fases.** O bloqueio era uma importação
   errada, não o pré-bundler: `@react-three/postprocessing` **já exporta
   `N8AO`** (o pacote `n8ao` entra como dependência dela). Importar de `n8ao`
   direto é que não resolvia. `Acabamento.tsx` agora recebe um `raio` por
   fase, porque a cabine é um ambiente de meio metro e a via é de dezenas:
   vestiário 0,35 · cabine 0,45 · trajeto 2,0 · ocorrência 2,2.

   A "cena preta" que estava registrada como sintoma do compositor **nunca
   existiu**: era a aba esgotando contexto WebGL depois de muitas recargas.
   Conferir sempre em aba nova.

2. **Textura no asfalto e no acostamento.** As peças não têm UV (saem de
   caixas do Blender), então a UV é gerada da posição, em metros — ver
   `src/cena/texturas.ts`. Anisotropia é obrigatória: a pista é vista de
   raspão e sem ela o asfalto a 20 m vira um borrão que pisca.

   O mato recebeu só o mapa de relevo, porque **não há textura de grama em
   `arte/tex`**. Está marcado com `ponytail:` no código. Baixar grama CC0 é
   o próximo item barato.

### Três defeitos visuais achados (o "bugado" do cliente)

1. **Faixa clara atravessando a ocorrência** — a câmera de sombra enquadrava
   28 m × 22 m e a cena tem o dobro. Fora da câmera de sombra nada recebe
   sombra. Mesmo defeito no trajeto, onde o alcance de 120 m deixava um risco
   reto no asfalto. Os dois agora cobrem o que a câmera vê.

2. **Arbusto e árvore flutuando** — o chão era uma caixa de 800 m com oito
   vértices. A dobra da via é uma parábola, e uma caixa interpola a parábola
   em linha reta: o terreno afundava 85 cm no meio enquanto as árvores
   seguiam a curva exata. Agora é uma grade com um vértice a cada 10 m.

3. **O acostamento de terra estava DENTRO da pista.** Dois sinais trocados em
   `via.py` somavam metade da largura do acostamento a `BORDA_DIR`, que é
   negativo — as duas faixas de terra cobriam 4,4 m dos 7 m de asfalto. Com
   terra e asfalto os dois em cor chapada escura ninguém via; só apareceu
   quando a terra ganhou textura bege.

### Trajeto

1. **Curvas e relevo.** O mundo continua reto em JS; quem dobra é o vértice,
   no shader — `src/cena/curva.ts`. Uma parábola em z, com uma uniform só,
   e a pista, o cenário, as placas e o carro da frente dobram juntos porque
   leem a mesma uniform. Erro de corda num trecho de 40 m: 7 cm.

   A subida tem teto a 200 m. Sem o teto o disco de chão de 400 m continua
   subindo e vira um muro acima do horizonte.

2. **2.060 m → 1.300 m**, com mais acontecendo em cada metro.

3. **Quatro decisões novas**, além das cinco que já existiam:
   - **Semáforo** com zona de dilema: o amarelo abre a uma distância fixa do
     cruzamento (58 m), não num relógio solto, para todo jogador encarar a
     mesma decisão e a nota ser comparável. CTB art. 208.
   - **Ônibus escolar em embarque** — reduzir a 20 km/h. CTB art. 220, XI.
   - **Ciclista na pista** — não há 1,5 m de folga, então espera-se.
     CTB art. 201.
   - **O celular toca** — a única que é só de interface. CTB art. 252, V.

4. **Arte nova em `via.py`**: `semaforo` (braço projetado sobre a faixa, três
   lentes emissivas), `onibus` (com a placa de PARE) e `ciclista`. O `.glb`
   foi de 59 KB para 91 KB.

   Armadilha: a primeira versão deixou as lentes como objetos FILHOS do
   poste, para o jogo acendê-las pelo nome do nó. **O parentesco não
   sobreviveu ao glTF** — saíram como irmãs na raiz da cena, e a cópia que o
   jogo instancia levava só o poste. Agora estão juntas na mesma malha e o
   jogo acende pelo nome do MATERIAL, que é estável.

   A lente acesa vai a `emissiveIntensity` 16, não 5: a 40 m ela tem três
   pixels, e é o bloom que transforma três pixels num ponto de luz que se lê
   de longe. Abaixo do limiar do bloom a lâmpada acesa é igual à apagada.

### Um defeito de jogabilidade, achado ao conferir

**Quem parava na faixa era punido por isso.** A falta "muito abaixo do fluxo"
usava o aviso na tela para saber se havia parada obrigatória por perto — e o
aviso some no instante em que o pedestre acaba de atravessar. O motorista que
parou direitinho e ainda estava parado começava a acumular falta ali mesmo,
no cruzamento. O jogo punia exatamente a conduta que está ensinando.

Agora a proximidade é medida pela distância ao ponto de parada, não pelo
aviso, e vale para a faixa e para o semáforo.

### Interface

- **Crachá do semáforo** no alto à direita, com a cor da lâmpada e a distância
  ao cruzamento — quem está olhando a pista lê a cor pelo canto do olho.
- **Chamada no celular** encostada à esquerda, acima do velocímetro. No meio
  da tela ela tapava a pista justamente enquanto o veículo anda, e a decisão
  do exercício é não desviar a atenção da via.

### Atalho de desenvolvimento

`?fase=trajeto&m=600` começa o trajeto naquele metro. Tudo que ficou para trás
entra como já resolvido — sem isso a fase terminava acusando "não parou na
faixa" de uma faixa que o jogador nunca viu.

---

## Rodada 3 — interface (mesma sessão)

### O relatório estava dizendo o contrário do que aconteceu

Debaixo de "o que você acertou", o relatório listava **"Não parou na faixa de
pedestre"** e **"Atendeu o celular dirigindo"**. Os títulos vinham do catálogo
de faltas, que nomeia a INFRAÇÃO — e quando o jogador não a cometeu, o título
continuava lá, negando o acerto. No documento que o instrutor leva para a
conversa depois.

Cada falta do trajeto ganhou um campo `acerto` com a frase afirmativa
("Parou na faixa de pedestre", "Deixou o celular tocar").

### Placar por fase

A nota era um número só para a sessão inteira. Agora cada fase tem a própria
linha com barra e pontuação, e dá para ver de relance que a conversa é sobre o
procedimento de reparo (22/164) e não sobre direção (84/132).

O denominador **não é estimado**: cada fase já entregava o próprio máximo no
`aoConcluir` e ele era somado e esquecido. Agora é guardado por fase. Um
placar aproximado seria o mesmo defeito do item anterior — número bonito e
errado.

### Partida de exemplo para conferir o relatório

`?fase=relatorio` abre com uma partida de exemplo (`src/conteudo/amostra.ts`).
Era a única tela do jogo que não dava para abrir e olhar: só existia depois de
oito a quinze minutos de partida. As faltas do trajeto vêm do catálogo de
verdade, pela mesma `montarRegistros` que a fase usa.

### Colisão de CSS

Havia **dois `.selo`** no `estilo.css`: o alfinete redondo numerado da
vistoria descartada e a pastilha de veredito do relatório. A pastilha herdava
`width: 30px; height: 30px` do alfinete e só não quebrava porque `em` é inline
e ignora largura — bastava alguém trocar para `display: inline-block` e o
texto seria cortado dentro de um círculo. A pastilha virou `.selo-veredito`.

### Código morto encontrado, NÃO apagado

`src/Cena.tsx` (309 linhas) e `src/dados.ts` (150 linhas) são a vistoria dos
nove riscos no poste, descartada como fase em 28/09. Nada importa os dois, e
são os únicos consumidores de `public/modelos/cenario.glb` (1,5 MB) e
`riscos.json`.

**Não foram apagados de propósito:** o projeto não está em git, então deleção
aqui não tem volta. Apagar os quatro arquivos tira 459 linhas e 1,5 MB do
pacote — decidir depois de versionar. O `cenario.py` do Blender CONTINUA em
uso (a ocorrência importa dele a caminhonete, o cone, a caixa e a escada).

## Rodada 4 — a cabine (mesma sessão)

**Grão de superfície, só relevo.** A cabine saiu do Blender com 31 materiais e
zero textura: o reflexo especular era uniforme em toda a peça, em qualquer
ângulo, e é isso que faz painel e banco lerem como plástico de brinquedo. As
cores do interior já estavam escolhidas com cuidado, então nenhum mapa de cor
entrou — só normal: grão de plástico injetado no painel, console, grelha e
volante; trama de tecido no banco, forro e tapete. Os dois saem de
`arte/gerar_texturas.py`, pelo mesmo caminho da grama.

**UV por eixo dominante.** A UV plana que serve para a pista estica em listras
em qualquer face vertical, e o interior da cabine é feito de caixas em todas
as orientações. Cada vértice agora escolhe o plano de projeção pela própria
normal. Onde dois planos se encontram há uma descontinuidade — invisível num
grão isotrópico, que é só para o que a função serve. Textura com desenho
(tijolo, madeira com veio) continua exigindo desdobrar UV no Blender.

**Mais um defeito visual: moiré diagonal na folha da prancheta.** Parecia
z-fighting entre a folha e a tábua, mas há 0,8 mm de folga ali. Era **sombra
acneada**: a direcional da cabine tinha `castShadow` e mais nada, então usava
o mapa padrão de 512 px num tronco padrão de 5 m para um interior de 2 m.
Mapa de 2048, tronco apertado em volta da cabine, viés e `normalBias`.

Esse é o quarto defeito da mesma família — câmera de sombra mal dimensionada.
Vale conferir qualquer `castShadow` novo com esse olho.

## Rodada 5 — tráfego no sentido oposto (mesma sessão)

O cliente pediu "outros carros" e "tráfego no sentido oposto" olhando uma reta
vazia. Entrou um `Contrafluxo` em `Via.tsx`: cinco veículos reciclados na
faixa contrária, vindo de frente a 50 km/h, reaproveitando a peça `via_carro`
girada meia-volta.

É só cenário — não entra na pontuação, não invade a faixa do jogador e não
exige decisão. Por isso a posição anda com o RELÓGIO e não com o metro do
trajeto: a regra de cenário determinístico existe para a prova ser comparável
entre colaboradores, e aqui não há o que comparar.

Eles nascem a partir de onde o jogador começa, não do metro zero — senão o
atalho `?m=` largaria a fase numa estrada vazia até alcançá-los.

### Premissas que eu tinha errado, conferidas no arquivo

- **A ocorrência já estava assada** (via, quadra, poste, transformador, com UV
  e normal). O que falta lá são só as peças soltas: cone, cavalete e fita.
- **O uniforme já tem sheen e os cascos já têm verniz** — `KHR_materials_sheen`
  e `KHR_materials_clearcoat` estão no `.glb` do personagem e do motorista.
  `mat_tecido` em `epi.py` sempre pôs Sheen, e ele sobrevive ao glTF.

  O que falta mesmo no EPI é **costura, vinco e variação de tom**, e isso
  exige desdobrar UV em malha orgânica e assar. É o próximo chunk pesado, e
  o `exportar.py` já tem o caminho (é o que produz `pele_export`).

## Rodada 6 — saída de garagem (mesma sessão)

Era o último item explícito do pedido do cliente que faltava no trajeto. Um
veículo recolhido na garagem começa a manobra quando o jogador está a 70 m e
está na pista aos 25 m. Reduzir e segurar por 1,4 s libera: ele completa a
saída e vai embora — mesma regra do pedestre na faixa, quem fez o certo não
fica preso. Passar por cima da manobra acima de 18 km/h é falta
(CTB art. 34 e 38, peso 14).

**Este vale nota, então a posição anda com o METRO do jogador, nunca com o
relógio** — ao contrário do contrafluxo, que é só cenário. Dois colaboradores
têm de encontrar a mesma cena no mesmo ponto ou a prova não é comparável.

O trecho residencial foi de 180 para 220 m para dar **40 m de folga entre uma
decisão e a seguinte**: empilhadas, o jogador não chega a decidir nada — reage
ao que estiver mais perto e descobre o resto no relatório. O trajeto ficou com
1.340 m.

O alerta de tela é um só para pedestre e garagem: dois avisos simultâneos
competem e o jogador não lê nenhum, e os dois nunca coincidem por causa da
folga acima.

Conferido nos dois caminhos: a 90 km/h o relatório acusa `garagem`, `lombada`,
`excesso` e `seguimento`; parando, o carro completa a manobra e some da frente.

## Rodada 7 — a fase jogada de ponta a ponta (mesma sessão)

O trajeto nunca tinha sido jogado inteiro numa sessão só: cada peça era
conferida no lugar dela pelo atalho `?m=`. A partida completa achou **dois
defeitos que nenhuma conferência por partes acharia**, os dois punindo
exatamente quem faz a coisa certa.

### 1. Quem parava no vermelho ficava preso para sempre

O cronômetro do amarelo rodava solto, fora do `if` que decide o estado do
sinal: ele reescrevia `sinal = vermelho` todo quadro, DEPOIS da liberação.
Parar no vermelho — que é a conduta correta — travava o jogo no cruzamento.
Conferido: 30 segundos parado e o crachá seguia vermelho.

Agora tudo do semáforo mora dentro de `if (!passouNoSinal.current)`.

### 2. Reduzir para o ônibus escolar rendia falta de lentidão

A isenção de "muito abaixo do fluxo" tinha sido escrita só para a faixa e o
semáforo. Faltavam os quatro eventos que pedem redução SEM parada: ônibus
escolar em embarque, ciclista, lombada e saída de garagem. Reduzir a 14 km/h
pelo ônibus, num trecho de 30, é menos que metade do limite — e virava falta.
O jogo cobrava a redução num item e punia a mesma redução no outro.

A lista agora sai dos próprios eventos (`REDUTORES`), não de nomes escritos à
mão — foi escrevendo à mão que ela nasceu incompleta duas vezes.

### Como a partida foi dirigida

Um piloto de teste injetado na página (não faz parte do jogo): lê
`window.__trajeto`, mira a velocidade certa de cada zona e clica "Deixar
tocar" quando o celular aparece. Dirigir à mão pelo painel do navegador, que
estrangula a taxa de quadros, levaria muito mais tempo e erraria o momento de
cada decisão.

**Resultado de um motorista cuidadoso:** nove das dez condutas limpas. A
décima — distância de seguimento, 4,65 s — foi falta de verdade: o piloto
colou no veículo da frente em vez de casar a velocidade. A mecânica está
certa; o piloto é que é burro.

## Rodada 8 — ocorrência jogada de ponta a ponta

Mesma receita da rodada 7, agora na fase 3: piloto injetado na página clicando
o caminho correto — as três decisões de chegada, as sete ferramentas que o
serviço pede e os nove passos da NR-10 na ordem.

**Resultado: 164 de 164, aprovado, nenhum defeito encontrado.** A fase está
sólida. A sinalização escolhida na chegada aparece mesmo na cena (cones
recuados, fita cercando a projeção do poste, escada no poste).

Foi o contrário do trajeto, que tinha dois defeitos travando quem acertava —
e é por isso que vale jogar cada fase inteira em vez de supor.

### Vestiário e conferência, na mesma rodada

Os dois também foram jogados inteiros. **Nenhum defeito.** O vestiário veste
as sete vagas (o EPI aparece no boneco na hora), a conferência percorre os
seis itens e `Dar a partida` cai no trajeto com o EPI escolhido vestido no
motorista.

**A cadeia inteira está verificada agora:** vestiário → conferência → trajeto
→ ocorrência → relatório.

Uma observação de automação para a próxima vez: o vestiário separa o EPI em
ABAS por vaga do corpo, e um piloto que só olha os botões visíveis trava na
primeira aba. Tem de trocar de aba antes de procurar a peça.

## Rodada 9 — custo de quadro

Esta sessão acrescentou muita coisa que custa GPU — oclusão, bloom e
antisserrilhado nas quatro fases, três mapas de sombra de 4096, texturas com
anisotropia, seis veículos a mais e `frustumCulled = false` em tudo da via —
e nada disso tinha sido medido. O alvo é um mini-PC de totem.

Duas coisas apareceram:

1. **O jogo renderizava a 2048×1536.** O R3F usa o `devicePixelRatio` cheio
   por padrão; num monitor HiDPI são 3,1 megapixels, com oclusão, bloom e
   SMAA passando por cada um. As quatro fases ganharam `dpr={[1, 1.5]}`.
   No totem (dpr 1) não muda nada; em qualquer tela boa de conferência corta
   44% dos pixels por quadro.

2. **49 programas de shader onde três bastam.** A chave de cache que eu tinha
   posto usava o NOME do material, então cada um compilava o seu. Agora
   descreve os RECURSOS (tem mapa de cor? tem normal?), que é o que de fato
   muda o shader: 49 → 24 programas.

**Medido:** mediana igual (17 ms, 59 fps) e **p95 de 51 ms para 35,5 ms** — é
o pior caso que vira tremida ao dirigir, e ele melhorou ~30%.

**Ressalva honesta:** a medição é no painel do navegador do app, que
estrangula a taxa de quadros e dá número instável; a primeira leitura depois
da mudança deu 30 ms de mediana e era só shader ainda compilando. **Nada disso
foi medido no hardware do totem**, que é onde a conta importa. Medir lá antes
de decidir se a oclusão cabe.

## Rodada 10 — o pacote que vai para o totem

O jogo vira `.exe`. Esta sessão acrescentou uma pasta de assets nova
(`public/tex`) e nada tinha sido conferido no build de produção, onde o
atalho `?fase=` não existe e os caminhos são relativos.

**Conferido jogando o build de verdade** (`vite preview`, porta 5274): as oito
texturas respondem 200, o vestiário veste, a conferência fecha e o trajeto
renderiza com o asfalto texturizado. Produção íntegra.

### 2,9 MB de Draco que nunca eram pedidos

O pacote tinha 14 MB. Dentro dele:

- **A pasta `public/draco/` inteira na raiz** — decodificador, wasm, wrapper e
  encoder. Os seis consumidores do jogo apontam todos para `./draco/gltf/`,
  nunca para `./draco/`. Era uma cópia completa que ninguém abria.
- **`gltf/draco_encoder.js`** (954 KB) — o encoder só serve para COMPRIMIR
  malha. O jogo só descomprime. Quem comprime é o `publicar-arte.sh`, pelo
  `@gltf-transform/cli`, que traz o próprio Draco.

**Movidos, não apagados**, para `arte/draco-fora-do-jogo/` com um LEIA.md
explicando como desfazer — o projeto não está em git. O pacote caiu de 14 MB
para 11 MB (-21%), e o personagem continua carregando, que é o teste real:
se faltasse decodificador, nenhum modelo abriria.

### Ainda sobra peso morto

`dist/modelos/cenario.glb` tem **2,1 MB** e é o cenário da vistoria
descartada — só o `src/Cena.tsx` morto o consome. Sai junto quando os quatro
arquivos daquela fase forem apagados, depois de versionar.

## Rodada 11 — o EPI, pelo material e não pela textura

Antes de mexer, conferi o básico: **as sete peças escolhidas aparecem mesmo no
boneco**, inclusive o protetor facial, que eu tinha posto em dúvida num
screenshot anterior. Nenhum defeito ali.

O que resta é o "chapado": o uniforme é um azul liso só. Costura e vinco
exigiriam desdobrar UV em malha orgânica e assar — e a malha do EPI tem de
continuar em peças separadas, porque o vestiário liga e desliga cada uma. É o
chunk mais pesado e mais arriscado da lista, e não cabia aqui.

O caminho barato é **física de material**, que não custa UV nenhuma:

- **Tecido:** `Sheen Roughness` de 0,50 para 0,32. O Sheen é o brilho de BORDA
  do pano — a luz que raspa e acende o fio levantado. Apertar a aspereza
  concentra esse brilho na curva em vez de espalhar pela peça; é esse
  gradiente que o olho usa para saber que aquilo é tecido. Braços e pernas
  deixaram de ser chapados.
- **Couro** (botina, luva de cobertura, cinturão): ganhou verniz fino
  (Coat 0,25 / rugosidade 0,38). Couro não é fosco — tem brilho superficial
  próprio, e é ele que separa couro de borracha na tela.

Os dois saem no glTF sozinhos (`KHR_materials_sheen`, `KHR_materials_clearcoat`)
e o three.js lê direto.

**Ressalva de precisão (confirmada na rodada 15):** o PESO do Sheen **não
chega ao glTF**. Testado com 0,22, 0,52 e 0,55 — o `sheenColorFactor` sai
sempre `[1,1,1]`: o exportador manda a TINTA (branca) e descarta o peso. Só
o `sheenRoughnessFactor` viaja. Na prática o three.js renderiza com sheen
cheio, que é o que está na tela e está bom; quem quiser mudar o brilho NO
JOGO tem de mexer em `material.sheen` no three, não no Blender.

**E é melhora, não transformação.** O uniforme continua de uma cor só, sem
costura e sem vinco. Quem olhar esperando o pedido do cliente atendido por
inteiro vai achar pouco — o item 3 dele continua aberto.

## Rodada 12 — varredura das vistas da cabine

Das seis vistas da conferência eu só tinha olhado uma. Varrendo as outras:

### A pergunta sem a imagem

A vista dos **retrovisores** tinha a câmera em x=-0,45 olhando o espelho em
x=-0,92 — **os dois do lado do passageiro**. O motorista senta em x=+0,38.
Ou seja, a pergunta "os retrovisores estão regulados para quem vai dirigir?"
aparecia com a câmera no banco errado, apertada contra a porta, e o espelho
saía cortado na borda com vidro branco ocupando a tela.

Numa fase cujo exercício inteiro é olhar e julgar, isso é a pergunta sem a
imagem — o jogador responde no chute ou pelo texto, nunca pelo que vê.

Reenquadrada para o espelho do próprio motorista, do lado dele.

### O que a correção expôs: o braço do motorista está nu

Com a câmera no lugar certo, o antebraço e a mão do motorista entram em
quadro — **sem manga**. O uniforme está ligado (`mot_vestimenta_fr` ativo); o
que acontece é que a peça foi modelada na pose T e o motorista está sentado e
posado, então o braço atravessa a manga.

É defeito de ARTE, não de código, e não sai barato: exige repassar a pose pela
malha da roupa, não só pela do corpo. A câmera foi recuada para a porta e
levantada, o que mantém o espelho grande e tira o braço do foco — **mas o
defeito continua lá**, e aparece de qualquer ângulo que olhe o braço do
motorista. Fica anotado.

### Causa raiz: as câmeras foram compostas com o banco VAZIO

Olhando as outras vistas, o padrão apareceu. O plano antigo registrava que
faltava "integrar o motorista sentado — hoje o cinto afivelado cruza um banco
vazio". Ele foi integrado depois, e **nenhuma das seis câmeras foi
recomposta**. Todas foram enquadradas contra uma cabine sem ninguém dentro.

Resultado, item a item:

- **Retrovisores** — câmera e alvo os dois do lado do passageiro, numa
  pergunta sobre o espelho do motorista. Corrigido.
- **Apoio de cabeça** — mirava x=-0,38, o encosto do PASSAGEIRO. Agora é um
  três quartos do banco do passageiro olhando o apoio do motorista: aparecem
  o capacete e o apoio lado a lado, que é exatamente a comparação do item
  (o topo na altura do alto da cabeça, não da nuca). Corrigido.
- **Freio de estacionamento** — do lado do passageiro, o corpo do motorista
  virava o fundo do quadro e o que se via era um corpo, não um freio.
  A alavanca fica ENTRE os bancos, então qualquer vista lateral põe um corpo
  ou um banco atrás; do olho do motorista a coxa dele tapa. Resolvido
  olhando quase a prumo, com o assoalho de fundo. Corrigido.
- **Checklist do veículo** — mirava x=+0,40, o banco do MOTORISTA, e enchia o
  quadro com o torso dele. A prancheta está no banco do passageiro, do outro
  lado da cabine. Reapontada, com a câmera à esquerda do motorista para ele
  ficar atrás dela. Corrigido.

**Varredura completa — quatro das seis estavam quebradas.** As duas boas são
a do cinto (item 1) e a do celular no painel (item 5).

Regra que fica: **câmera de item se confere com a cena COMPLETA**, não com a
peça isolada — e se reconfere toda vez que entra gente ou objeto novo na cena.

### A mesma varredura na ocorrência: 1 de 6

Aplicada a mesma régua às seis vistas da fase 3 (briefing, três da chegada,
ferramental e reparo). **Uma estava quebrada:**

- **Distância da sinalização** — a câmera enfiava o olhar pela via afora
  (alvo em x=-22) com teleobjetiva de 40 mm: apareciam a caminhonete e
  asfalto vazio, e o POSTE ficava fora da tela. A pergunta é "a que distância
  da ÁREA posicionar os cones", e a área não estava na imagem — não dava para
  julgar distância de coisa nenhuma. Reenquadrada alta e aberta, com o poste,
  a caminhonete e o trecho de via entre eles os três em quadro.

As outras cinco estão boas: o briefing mostra a cena, a posição do veículo e a
delimitação mostram o poste, o ferramental mostra a lona com a área já
cercada, e o reparo enquadra poste, transformador e escada.

**Placar das duas varreduras: 5 de 12 vistas do jogo estavam enquadradas de
forma que a pergunta não podia ser respondida pela imagem.** Nenhuma delas
apareceria em teste de lógica ou revisão de código.

## Rodada 13 — regressão completa no build de produção

A sessão mexeu em shader, texturas, dez itens de conteúdo, cinco câmeras, duas
regras de pontuação, o `dpr` e a pasta do Draco. Fechamento: **a partida
inteira, do começo ao relatório, no `vite preview` — o artefato que vira
`.exe`**, onde o atalho `?fase=` não existe.

**418 de 440 pontos, 95%, aprovado.** As quatro fases encadeiam e o placar por
fase fecha com dado real:

| fase | nota |
|---|---|
| Vestiário | 72/72 |
| Conferência do veículo | 50/58 |
| Trajeto | 132/146 |
| Ocorrência | 164/164 |

Os dois descontos foram do piloto de teste, não do jogo: ele colou no veículo
da frente (distância de seguimento) e mandou "corrigir" o freio de mão, que já
estava puxado.

Esse segundo caso rendeu a melhor resposta do jogo na sessão inteira:
*"Não havia o que corrigir aqui. Com o veículo parado e a equipe trabalhando
em volta, o freio puxado é o que impede o deslocamento involuntário. Está
certo — e reconhecer o que já está certo faz parte da conferência."*

O exercício não é "mandar corrigir tudo", e a fase ensina isso sem precisar
reprovar ninguém.

## Rodada 14 — o uniforme assado (item 3 do cliente, FECHADO)

Era o item que eu vinha adiando como "meio dia e risco de quebrar a troca de
peças". O risco não se confirmou, porque a premissa estava errada:
**`assar_grupo` opera numa peça só e NÃO junta malha**. Dava para assar o
uniforme sozinho sem encostar nas outras 18 peças.

O que entrou no forno:

- **`sujar`** — variação de tom e de rugosidade. É a ausência disso que faz
  superfície pintada parecer plástico de render (o comentário já estava em
  `comum.py`; faltava aplicar ao tecido).
- **`estriar` em escala 900** — vira a diagonal da SARJA, que é a trama do
  brim e do tecido antichama de verdade.
- **A oclusão que o forno já embute na cor** — e foi ela que deu o vinco de
  graça: gola, punho, costura de ombro, contorno de bolso e costura lateral
  aparecem porque a geometria da peça já tinha esses relevos e nunca tinham
  sido sombreados.

Os dois primeiros são procedurais de espaço de objeto e **não sobrevivem ao
glTF** — por isso só existem assados.

### A armadilha: o forno come o Sheen

`assar_grupo` TROCA o material da peça por um PBR simples com os três mapas —
e leva junto o Sheen que eu tinha calibrado na rodada 11. Assado sem cuidado,
o uniforme ganharia trama e perderia o caimento. `resgatar_sheen` devolve
depois do forno; os dois efeitos são independentes e se somam.

### Resultado

Costura, vinco e variação de tom no uniforme — **o item 3 do pedido do cliente,
que estava aberto desde 28/09**. Mesmo tratamento no motorista, que aparece de
perto na conferência e no trajeto inteiro.

Peso: personagem 747 KB → 1,0 MB, motorista 568 KB → 863 KB. O pacote foi de
11 MB para 12 MB.

Conferido: as **19 peças continuam separadas** no `.glb` (é o que faz o
vestiário ligar e desligar cada uma), o uniforme tem mapa de cor, normal E
sheen, e o trajeto renderiza sem regressão.

## Rodada 15 — a manga que some: causa raiz achada

O braço nu do motorista (rodada 12) tinha uma explicação minha que estava
**errada**: eu disse "a peça foi modelada na pose T e o motorista está posado".
Não é isso — em `exportar_motorista.py` a pose é aplicada ANTES de a roupa ser
construída, e `assentar` só move a armadura, não assa a pose na malha.

O defeito é de GEOMETRIA DO RECORTE. `_camisa` recorta por uma CAIXA em
coordenada de mundo:

```
z_barra <= co.z <= z_gola   e   |co.x| <= x_punho
```

Na pose T isso cobre o braço inteiro, porque o braço fica na horizontal na
altura do ombro. Mas **`recortar` avalia a malha com a armadura LIGADA**, ou
seja o teste roda na geometria já posada — e no motorista sentado o antebraço
desce abaixo de `z_barra` e sai da caixa. Nenhuma manga é gerada ali.

**Não corrigido de propósito.** O recorte serve o personagem da pose T, que
funciona; trocá-lo arrisca os dois caminhos, sem git. O caminho da correção
está escrito no docstring de `_camisa`: trocar a caixa por critério
independente de pose — grupos de vértice (`H.recortar_grupo` já faz isso para
um grupo) ou avaliar o teste em coordenada de REPOUSO.

O diagnóstico era a parte difícil e está registrado onde o defeito mora.

## Rodada 16 — as peças soltas da ocorrência

Último buraco de textura do jogo. Cone, cavalete, fita, caixa de ferramentas e
escada ficavam fora do forno "porque o jogador as posiciona" — mas posicionar
em tempo de execução não impede assar, já que `assar_grupo` não junta malha.

Mesma receita do uniforme: `sujar` antes do forno (cone e fita de verdade são
riscados e sujos, nunca um laranja uniforme de catálogo) e a auto-oclusão que
o forno embute — o degrau da escada, a perna cruzada do cavalete, o anel da
base do cone.

**A caminhonete ficou de fora de propósito.** Ela tinha acabado de ganhar
verniz na rodada 2, e `assar_grupo` troca o material da peça: levaria o verniz
junto, exatamente como quase aconteceu com o Sheen do uniforme. Conferido no
`.glb` depois: `KHR_materials_clearcoat` continua lá.

Peso: ocorrência 770 KB → 835 KB; pacote em 12 MB.

### Mapa de textura do jogo, agora

| peça | estado |
|---|---|
| Via do trajeto (asfalto, terra, grama) | textura em tempo real, UV gerada da posição |
| Cabine (31 materiais) | grão de plástico e trama de tecido, UV por eixo dominante |
| Ocorrência — via, quadra, poste, transformador | assadas desde antes |
| Ocorrência — cone, cavalete, fita, caixa, escada | **assadas nesta rodada** |
| Uniforme (personagem e motorista) | **assado na rodada 14** |
| Caminhonete | verniz, sem textura — assar custaria o verniz |
| Resto do EPI (capacete, luva, botina) | cor lisa com sheen/verniz |

## O que ficou para a próxima rodada

Tudo o que sobrou está numa destas três caixas — nenhum é "faltou tempo".

### Decisões suas, não minhas

1. **Versionar o projeto em git.** É a trava de tudo: deixei de apagar 459
   linhas de código morto (`src/Cena.tsx` + `src/dados.ts`) e 2,1 MB de
   `cenario.glb` porque sem git deleção não tem volta. Com git, o pacote cai
   de 12 MB para ~10 MB numa tarde.
2. **A nota mudou de equilíbrio:** 364 → 440 pontos, e o trajeto saiu de 19%
   para 33% da prova (dez condutas, eram cinco). O corte de 70% foi combinado
   com o cliente contra a distribuição ANTIGA. Se ele quiser o equilíbrio de
   antes, mexer nos pesos das cinco faltas novas — não no corte.
3. **Conteúdo técnico do Cristiano**, que já estava pendente: a lista de EPI
   que a Energisa distribui de fato, o kit por atividade e o procedimento de
   reparo.

### Precisa de hardware que eu não tenho

4. **Medir no mini-PC do totem.** Tudo o que medi foi no painel do navegador
   deste app, que estrangula a taxa de quadros — a primeira leitura depois de
   uma mudança chegou a mentir 30 ms de mediana. O `dpr` limitado e os
   programas de shader reduzidos ajudam, mas **ninguém sabe se a oclusão
   ambiente cabe no orçamento do totem**. É a conta que falta.

### Adiados com motivo escrito, não esquecidos

5. **A manga que some no motorista sentado.** Causa raiz achada e registrada
   no docstring de `_camisa` (`epi.py`): o recorte é uma caixa em coordenada
   de mundo, e `recortar` avalia a malha com a armadura ligada. Não corrigido
   porque o mesmo recorte serve o personagem da pose T, que funciona — e sem
   git, mexer arrisca os dois.
6. **Textura na caminhonete.** `assar_grupo` troca o material da peça, e
   levaria o verniz que ela ganhou nesta sessão. Ou se restaura o verniz
   depois do forno (como `resgatar_sheen` faz com o tecido), ou se deixa.
7. **Resto do EPI** (capacete, luva, botina) em cor lisa com sheen e verniz.
   O uniforme — que é a maior superfície e era a queixa — já foi assado.

## Riscos abertos

1. ~~**Peso dos arquivos.**~~ Resolvido: `publicar-arte.sh` comprime com Draco
   e WebP. O personagem saiu de 10,5 MB para 746 KB; o cenário, de 47 MB para
   1,5 MB. As texturas da via somam 1,8 MB em `public/tex` (reduzidas de
   2048 para 1024 px com `sips`).
2. **Conteúdo técnico.** A lista exata de EPI que a Energisa usa, o kit de
   ferramentas por atividade e o procedimento de reparo precisam vir do
   Cristiano. Escrevo com base em NR-6, NR-10, NR-12 e NR-35 e marco para
   revisão — mas quem é da área percebe qualquer desvio.
3. **O rosto.** Resolvido no Blender e conferido no navegador. Continua sendo
   o ponto a reconferir a cada mudança de bake.
4. **O projeto não está em git.** Com a rodada 2 mexendo em shader, arte e
   conteúdo ao mesmo tempo, versionar virou urgente.

---

# Rodada de jogabilidade e gráfico (06/10/2026)

Origem: o usuário jogou e resumiu em "não é legal de jogar, não é educativo,
não é bonito". O diagnóstico, feito jogando as quatro fases:

1. **O 3D é papel de parede.** A cena nunca reage à escolha — o jogo é um
   formulário com render atrás. É a causa de "não é legal de jogar".
2. **Três perguntas não dão para responder pela imagem**: o cinto da cabine
   (não existe cinto em quadro), "onde parar a caminhonete" na ocorrência
   (não há veículo em quadro) e o volante do trajeto (fora de quadro). Quem
   não vê, chuta — é a causa de "não é educativo".
3. **Zero áudio no projeto inteiro.**

Decisões do usuário nesta rodada:

- **O vestiário ensina, o resto avalia.** Fase 1 mostra a descrição sempre e
  dá o veredito logo depois de travar a escolha, com a NR. Trajeto e
  ocorrência seguem em silêncio até o relatório, como o cliente aprovou em
  28/09. Motivo: não se reprova alguém em EPI antes de ensinar EPI.
- **O projeto foi versionado em git** (commit `9626174`), que era o portão de
  tudo — ver `REPASSE-GRAFICO.md` §4.

## Fila

- [x] **1. Som** — `src/som.ts`, Web Audio sintetizado, sem arquivo e sem
      biblioteca. Clique global, confirmar, veredito, buzina, chave fusível,
      telefone, motor atrelado à velocidade, bafo de ambiente e botão de mudo.
- [ ] 2. Consertar `arte/blender/epi.py` (quebrado, sem backup)
- [ ] 3. Interior da cabine refeito a partir do `caminhao.py` aprovado
- [ ] 4. Cinto que existe em quadro; veículo visível na pergunta "onde parar"
- [ ] 5. O 3D reagindo à escolha (carro chegando, cesto subindo, escada no poste)
- [ ] 6. Menu com identidade e vestiário em etapas com ícone e veredito
- [ ] 7. Povoar o trajeto (casas, escola, semáforo de longe, tráfego)

## Item 1 — som (feito)

**Por que sintetizar e não tocar arquivo:** são seis efeitos curtos e um motor
que precisa acompanhar a velocidade continuamente. Em `.mp3` o motor exigiria
loop com mudança de altura, que `<audio>` não faz, mais sete downloads com
licença para rastrear. Em oscilador cabe num arquivo de 230 linhas e a
velocidade vira um parâmetro.

**Um ouvinte só, na captura, dá som a todo botão do jogo** — inclusive os que
ainda não existem (`ligarCliqueGlobal`). A alternativa era `onClick` em ~40
botões.

**A buzina é do carro que sai da garagem**, disparada pelo METRO e uma vez só.
Não existe buzina atrelada ao comportamento do jogador de propósito: buzinar
em quem parou no vermelho é punir quem fez a coisa certa, que é a armadilha
que já apareceu duas vezes nesta fase.

**Como conferir som sem ouvir:** `window.__som.nivel()` (só em dev) devolve o
RMS do que está saindo do ganho mestre. Medido nesta rodada: ambiente sozinho
0,0025 · motor a 18 km/h 0,0373 · a 58 km/h 0,0611 · desligado 0,0034 ·
buzina 0,121 · mudo 0. Sem essa medida, "tem som" é suposição.

**O som nasce MUDO** (ajustado logo depois, a pedido). Som que começa sozinho
incomoda em sala de treinamento e em totem — quem quiser liga no botão do
canto e a escolha fica guardada no `localStorage`.

**Armadilha reconfirmada:** tela preta no trajeto depois de várias recargas na
mesma aba é o contexto WebGL esgotando, não o código. Aconteceu três vezes
nesta sessão e custou duas rodadas de diagnóstico errado. Abrir aba NOVA antes
de culpar a mudança.
