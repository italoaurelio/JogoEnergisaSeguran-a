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
- [x] **2. `epi.py` consertado** — causa raiz era o teste de recorte rodar
      na malha POSADA; agora roda em repouso. Detalhe abaixo.
- [x] **3. Cabine: volante em quadro, pilar A, hastes.** Detalhe abaixo.
- [x] **4. Cinto e veículo em quadro; as seis câmeras da fase 2a refeitas.**
- [x] **5. O 3D reagindo à escolha** — caminhão chegando, escada encostada, boneco
      vestindo. **O cesto subindo NÃO foi feito**, ver abaixo.
- [x] **5b. Cesto do caminhão subindo** — lança e cesto em nós próprios.
- [x] **6. Menu com personagem, vestiário em etapas com ícone, veredito e boneco respirando.**
- [x] **7. Trajeto povoado por zonas**, com escola nova e auto-teste de densidade.

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


## Item 2 — epi.py (feito)

**Causa raiz, uma so, com quatro sintomas.** `_camisa`, `_calca` e
`roupa_base` recortam por uma CAIXA em z/x de mundo, e `H.recortar` avalia a
malha com a ARMADURA LIGADA. A caixa so descreve o que pretende enquanto o
corpo esta na pose em que ela foi escrita. Fora dela:

- no personagem em pose relaxada a MAO entrava na caixa e virava lasca azul
  grudada nos dedos (`arte/render/epi_luva.png` de 06/10, antes);
- no motorista SENTADO o antebraco descia abaixo da barra e saia NU — o
  defeito ja documentado que nunca tinha sido fechado.

**A correcao e um par, e os dois tem de andar juntos:**

- `H.recortar(..., repouso=True)` roda o TESTE na malha em pose de descanso e
  constroi a peca a partir da malha POSADA. Mesma topologia, entao a face
  aprovada em repouso e a mesma face no corpo posado.
- `H.referencias(corpo, repouso=True)` devolve os pontos anatomicos com a
  armadura desligada. Sem isto a caixa estaria em repouso e os limites em
  pose — pior que antes.

Feito na funcao COMPARTILHADA, nao em cada chamador: os tres recortes de
regiao tinham o mesmo defeito e passaram a estar certos de uma vez.

**A manga termina por distancia no EIXO DO ANTEBRACO, nao por `|x|`.** Um
limite em x nao separa o polegar, que aponta para dentro e tem x menor que o
do punho — sobrava uma lasca de tecido agarrada na mao, bem no centro da
vista da cabine. E o mesmo criterio que `_mao` ja usava do outro lado do
corte.

**`subdividir` tinha sido zerado em camisa, calca e roupa de baixo.** O
proprio docstring de `recortar` avisa que sem ele a borda sai em serrilha de
quadrado, porque a malha do corpo e grossa demais. Restaurado com
`subdividir=1, reduzir=0.40` — decimar depois do subsurf devolve a silhueta
por um terco do custo.

**Folga nao faz calca; `SMOOTH` faz.** Deslocar a pele pela normal engorda o
gemeo junto e o resultado le como legging — era a "perna inchada como barril".
Um `SMOOTH` (fator 1,0 / 12 iteracoes) depois do recorte relaxa a alta
frequencia da anatomia (panturrilha, rotula, tendao) e a perna cai reta, que
e o que tecido faz e pele nao.

**O "no de gravata" das faixas refletivas nao era torcao de fita — era ORDEM
DE CAMADA.** Carcela e bolso ficam a 0,030 de folga mas tem 4 mm de espessura
e ainda incham com o subsurf: a superficie de cima deles chega a ~0,036, que
era exatamente a altura da faixa. A carcela atravessava a faixa bem no meio
do peito. Faixa subiu para 0,042 e tirante para 0,062. O cabecalho de `CAMADA`
ja dizia que o que importa e a ordem, nao cada numero; o que faltava era
contar a ESPESSURA junto com a folga.

**Uma constante de camada nao serve para dois trajes.** `_faixas_no_tronco`
agora recebe `folga`: por cima da CAMISA e 0,042, por cima do COLETE e a folga
do colete mais 10 mm. Com a constante unica a faixa do colete nascia por
DENTRO dele.

**A gola estava por dentro da camisa** (0,014 contra 0,019) e abria um vao
preto no pescoco. Passou a ser a camada da camisa mais 9 mm.

**Como conferir:** `prova_epi.py` ganhou tres vistas de UNIFORME (peito, ombro
e perna). Nao havia nenhuma, e era por isso que tres das quatro queixas
sobreviveram a uma rodada inteira — a prova renderizava capacete, luva, botina
e cinturao, e o uniforme nem era vestido. Para o motorista sentado nao existe
prova no repositorio; foi usada uma de uso unico que monta
`exportar_motorista.montar()` e olha o braco.

**O que NAO foi resolvido e nao e defeito de forma:** a luva de cobertura e
recortada da propria mao e, na cor de raspa, le como "a mao do personagem em
outra cor" — o proprio arquivo ja documentava isso. Nao e a "luva enorme" da
queixa (essa some com o corte certo), e sim legibilidade. Fica para a rodada
de arte.


## Item 3 — interior da cabine (feito)

**O diagnostico so apareceu porque passou a existir `prova_cabine.py`.** Nao
havia prova nenhuma do interior — e ele ocupa o terco inferior da tela durante
os 1.340 m do trajeto, de noite e com pos-processamento, que e exatamente a
condicao em que peca solta passa despercebida. A vista `motorista` da prova
copia o OLHO e o campo da fase 2b, e e a unica que responde "o jogador ve o
volante?".

### O volante estava fora de quadro, e nao era enquadramento infeliz

Medido: do olho antigo, **nenhum ponto do aro ficava a menos de 40 graus
abaixo da direcao do olhar**, e a borda de baixo da tela esta a 27,5 graus
(fov 52, 1,5 grau de inclinacao). Num caminhao de verdade e assim mesmo —
quem olha a via nao ve o volante, porque o olho fica 45 cm acima do aro.

Por isso a correcao e dos dois lados, e **so funciona junto**:

- aro de caminhao: 470 mm (era 370, de carro de passeio), deitado 32 graus da
  horizontal, empurrado para a frente;
- olho 4 cm mais baixo (1,17) e vista 4 graus mais inclinada para baixo.

Resultado medido: o ponto mais alto do aro fica 37 cm a frente do olho e
18,5 cm abaixo, isto e **26,5 graus**, contra 30 graus de borda de tela. O
arco de cima do volante atravessa a parte de baixo da tela e o horizonte fica
15% acima do centro. So a geometria daria 28,2 contra 27,5 — nao cabia.

**O primeiro valor de y (-0,42) enterrou metade do volante dentro do capo do
painel.** A prova mostrou na hora; a olho nao se via, porque no jogo aquela
regiao e preta. O capo recuou 6 cm e o volante parou em -0,37.

### As "partes voando" tinham uma causa estrutural

A cabine era um palco com **so as pecas que as seis vistas de perto
precisavam**. Faltava o que amarra tudo, e na vista do motorista — a mais
longa do jogo — isso aparece como laje boiando:

- **Nao existia PILAR A.** Travessa do para-brisa, porta e vidro nao se
  encostavam em nada. Entrou o par, do canto de baixo ao canto de cima do
  para-brisa (54 cm para tras, 45 cm para cima, 50 graus da vertical).
- **O retrovisor interno flutuava a 4 cm de tudo**, no meio do ar e bem no
  alto da tela. Ganhou haste ate a travessa.
- **O braco do retrovisor externo encostava na porta por uma quina de 5 mm**
  (braco em y -0,53, forro da porta comecando em -0,52). O forro passou de
  1,00 m para 1,14 m e agora vai ate -0,66, encontrando o pilar A.

### O que NAO foi feito, e por que

A cabine nao tem painel externo nenhum — vista de fora e um teto sobre
postes. Esta certo e e barato: o jogo so a mostra por dentro, e o caminhao
visto de fora e o `caminhao.py` da ocorrencia. A vista `geral` da prova
existe para diagnostico, nao e vista de jogo.

**Nao foi conferido no jogo rodando**: o painel do navegador estava oculto e
screenshot nao compoe quadro nesse estado. A conferencia foi por render em
Cycles, que e o metodo que o repasse prescreve para modelagem — mas falta
abrir a fase 2b com a via por tras do para-brisa.


## Item 4 — perguntas que agora têm resposta na imagem (feito)

**O cinto nunca esteve "sumido": a câmera dele olhava para o outro lado.**
Ela mirava x -0,72, que é o lado do PASSAGEIRO, e o cinto está em x 0,70-0,78,
do lado do motorista. A pergunta "o cinto está como precisa estar?" aparecia
com a porta e o banco do passageiro em quadro, e nada mais. Registrado numa
rodada anterior como uma das "duas boas"; não era.

**As seis foram refeitas a partir da CAIXA ENVOLVENTE real de cada peça**, não
do olho. Antes de mirar, um script despejou a caixa de cada estado do `.glb` —
é isso que torna o enquadramento uma conta e não um palpite. Resultado:

| vista | o que estava errado |
|---|---|
| cinto | olhava o lado do passageiro; a peça nem aparecia |
| retrovisores | enquadrava o espelho cortado, escuro, sem contexto |
| apoio de cabeça | de frente, e ALTURA só se julga de perfil |
| freio de mão | a prumo e de longe: a alavanca sumia no assoalho preto |
| celular | já estava boa |
| checklist | já estava boa |

**Três armadilhas de enquadramento que valem para qualquer vista futura:**

1. **A fita do cinto olha para DENTRO da cabine.** Câmera colada no pilar a vê
   de fio e ela vira um risco de um pixel. Tem de ser inboard — e, por isso,
   tem de passar por cima do volante (z até 1,00) e do encosto (z até 1,02),
   senão o aro toma a tela inteira.
2. **Altura se julga de PERFIL.** De frente, o apoio fica na frente do encosto
   e o vão desaparece. De dentro da cabine o apoio do PASSAGEIRO entra na
   frente; pela janela do motorista é a única linha livre.
3. **Toda vista lateral do freio de mão põe um banco atrás dele**, porque a
   alavanca fica entre os dois. Quase a prumo e de perto é a única que isola.

**Duas peças estavam pretas sobre preto, e cor resolve o que enquadramento
não resolve.** O cinto tinha albedo 0,062 contra um pilar de 0,072, e a
alavanca do freio 0,024 sobre um console preto. O comentário de `cinto()` já
registrava que a fita tinha sido ALARGADA para não sumir — alargar não resolve
contraste. Cinto foi para 0,175 e alavanca para 0,105, os dois cinzas comuns
em frota.

**A minha própria prova estava mentindo.** `prova_cabine.py` chamava
`luz_cabine()` mas não o HDRI, e o docstring de `luz_cabine` diz que a luz
principal vem do HDRI atravessando o vidro. Sem ele o interior saía todo na
sombra — e o jogo usa `hemisphereLight` a 1,05 mais direcional a 2,0, bem mais
claro. Julguei duas câmeras como escuras demais antes de perceber.

**Ocorrência: a pergunta "onde parar" vinha sem veículo em quadro.** O
caminhão só entrava na cena DEPOIS da escolha. Agora, enquanto a pergunta
está aberta, ele aparece parado na pista bem antes da área, no sentido do
fluxo — é o que dá ao jogador a escala e o sentido do trânsito. E "caminhonete"
virou "caminhão" em todo texto: o modelo é o `caminhao.py` com cesto aéreo,
aprovado pelo cliente.

**Não conferido no jogo rodando** (painel do navegador oculto a sessão
inteira): as seis vistas foram julgadas por render em Cycles com a câmera
copiada verbatim de `cabine.ts`, e a chegada da ocorrência só por código e
`tsc`. Falta abrir a fase 2a e a 3a.


## Item 5 — o 3D reagindo à escolha (feito, menos o cesto)

Este é o item que separa "o 3D é papel de parede" de "o 3D é a consequência
da escolha". Três das quatro partes entraram.

**O caminhão chega e estaciona, e a reconciliação do React faz isso de
graça.** Enquanto a pergunta "onde parar" está aberta, a peça `oc_veiculo`
existe na posição de espera; escolhida a posição, a MESMA chave de React
recebe um alvo novo, então é o MESMO componente — e um `lerp` no `useFrame`
vira a manobra. Não foi preciso nenhuma máquina de animação.

Medido no jogo: x -19,5 -> -13,96 -> -11,20 -> -9,88 -> -9,18 -> -8,83 ->
-8,67 -> -8,59. Desacelera no fim, que é o que estacionar parece.

A velocidade da peça alimenta `som.motor`: o caminhão que manobra se ouve, e
para de se ouvir quando encosta. O motor é desligado na saída da fase, senão
fica roncando no relatório.

**As peças pequenas não andam, caem.** Nascem 60 cm acima e assentam. Cone
que aparece pronto no chão não parece colocado por ninguém.

**A escada estava EM PÉ, equilibrada no nada.** É uma peça de 4,63 m centrada
no próprio meio, e estava em `y 2,3` com giro 0: perfeitamente vertical,
encostada em coisa nenhuma. Agora o pé fica em (0,855, 0, -1,149) e o topo em
(0,15, 4,45, -0,21), a 25 cm do eixo do poste — e o vetor pé-topo faz **14,7°
com a vertical**, que é o ângulo de ~75° com o chão que a NR-18 pede para
escada de encosto. Conferido por conta (a matriz de Euler XYZ do three),
porque o painel do navegador estava oculto.

**Vestir virou um gesto.** A peça que acaba de entrar assenta de 4 cm acima
em 0,22 s, com ease-out. Antes a roupa trocava entre dois quadros e a escolha
virava só um texto mudando na lista ao lado. Medido: 0,0239 -> 0,0159 ->
0,0065 -> 0,0011 -> 0.

### O que NÃO foi feito: o cesto subindo

Precisa da lança como NÓ SEPARADO no `.glb`, e hoje `caminhao.montar()`
junta o caminhão inteiro num objeto só — de propósito, para preservar a
separação por material (foi juntar tudo que transformou cromo em plástico na
caminhonete antiga). Separar a lança exige mexer em `montar`, no
`exportar_ocorrencia.py`, reexportar os 33 MB e reposicionar a lança pelo
nome no jogo, porque **parentesco não sobrevive ao glTF**.

Fica como item próprio. Vale notar que o efeito completo também pede alguém
DENTRO do cesto, que não existe — e que o cesto aéreo reabre a pergunta de
conteúdo já anotada: com ele, a escada deixa de ser obviamente a ferramenta
certa no item do ferramental.


## Item 5b adiado de propósito (não esquecido)

Separar a lança exige refatorar `caminhao.montar()`, que junta **por material
antes de juntar tudo** — os nomes individuais já não existem quando o objeto
final se forma, então não dá para separar por nome no exportador. Some-se a
isso: origem no pino (senão a rotação não é a da lança), cesto em nó próprio
para ficar NIVELADO enquanto a lança sobe, reposicionamento pelo NOME no jogo
(parentesco não sobrevive ao glTF) e um ciclo de reexport de 33 MB por
tentativa.

E o efeito completo pede alguém DENTRO do cesto, que não existe.

Troquei a ordem com o item 6, que é o que o usuário descreveu em mais
detalhe, e avisei em vez de pular calado.

## Item 6 — menu e vestiário (feito)

**O vestiário virou uma sequência de sete etapas**, uma por parte do corpo,
com trilha de progresso no topo. As abas antigas deixavam pular de parte em
parte e o sétimo rótulo estourava a largura do painel.

**Cada peça tem ícone**, em SVG desenhado à mão (`src/icones.tsx`, doze
formas). Nada de emoji: emoji entrega a aparência ao sistema operacional, e o
capacete do Windows não é o do mac, nem nenhum dos dois é EPI de eletricista.
Nada de pacote de ícones: licença para rastrear num jogo que vira `.exe`
offline. **A variante é o que o traço mostra** — capacete COM jugular contra
sem, luva com cobertura contra luva sozinha, luva com etiqueta de ensaio
vencida: é nisso que está a resposta da fase.

**O veredito aparece ao travar a escolha, e só no vestiário.** Trajeto e
ocorrência seguem em silêncio até o relatório, como combinado. A escolha
TRAVA junto com o veredito — explicação que ainda deixa trocar de resposta é
gabarito, não ensino. As peças recusadas ficam na tela com opacidade baixa,
em vez de sumir: continuar vendo o que não se escolheu é metade do
aprendizado.

**O boneco respira.** Não há animação de esqueleto, então é no grupo inteiro:
6 mm de sobe-e-desce e 0,35% de escala, a 14 ciclos por minuto. Medido no
jogo: 6,1 mm pico a pico. Dois períodos incomensuráveis (13 s e 7 s) somam um
balanço lento de peso — sem ele a respiração vira metrônomo e o olho acha o
compasso em dois ciclos.

**A abertura deixou de ser um formulário.** Era um cartão escuro com um campo
de nome; agora é o personagem de EPI completo em 3D, respirando, com o título
e as três fases ao lado. A primeira coisa que se vê passou a ser um
eletricista equipado, que é o assunto inteiro da fase 1.

### O que ficou sem conferir, e por quê

O painel do navegador ficou OCULTO a sessão inteira. Descobri uma limitação
que vale anotar: **com o painel oculto E o viewport emulado, o R3F não roda** —
o canvas fica no tamanho padrão de 300x150 e a cena nunca monta. Sem emulação
ele roda normalmente (foi assim que a respiração foi medida).

Então: o fluxo em etapas, os ícones, o veredito, o travamento e a respiração
foram conferidos por medição no jogo. **O palco 3D da abertura em tela larga
não foi visto.** A faixa estreita (438 px) foi conferida: sem rolagem
horizontal, sem vazamento, botão de 394x60 visível, e o palco corretamente
escondido abaixo de 880 px.


## Item 7 — povoar o trajeto (feito)

**A causa da "reta longa e monótona" era densidade, e ela estava medível o
tempo todo.** A paisagem antiga sorteava UMA peça a cada 18 m entre quatro
opções: na prática cada categoria caía a cada 70-100 m e, com 320 m de
alcance, isso é uma casa, duas árvores e descampado verde até o horizonte.

**Agora o trajeto atravessa ZONAS, não ruído uniforme:** pátio (mato e cerca
viva), bairro (frontaria dos dois lados), entorno de escola (muro corrido de
um lado, casas do outro) e bairro de novo chegando. **A fronteira entre elas
é o que dá sensação de percurso** — num descampado uniforme ninguém sente que
andou, por mais árvore que se jogue.

**Entrou a escola** (`via.py`, ~420 triângulos), um MÓDULO de 10 m feito para
ladrilhar: o jogo repete a mesma peça para formar a quadra. Por isso ela não
tem portão nem placa — um portão a cada 10 m viraria uma fileira de portões.
O que separa de casa, na ordem do que custa menos: muro alto com faixa de cor
corrida (é a linha horizontal contínua que se lê de longe), platibanda no
lugar de telhado de duas águas, e fita de janela corrida em vez de janelinhas
soltas. Conferida em render com três módulos lado a lado e uma casa ao lado,
para ver emenda e silhueta.

**Tráfego no sentido oposto: o que governa é o VÃO, não a contagem.** Com 95 m
de vão e 320 m de alcance passavam três carros no campo inteiro. Vão para
52 m e pool para 11.

### O teto de cópias era o defeito escondido

`Fileira` tem um pool fixo de clones — 10 por peça. Adensar sem mexer nele faz
a fileira **sumir a partir da décima cópia**: a frontaria vira buraco justo
onde devia ser contínua.

Por isso a paisagem saiu de `Via.tsx` para **`src/cena/paisagem.ts`, função
pura** (sem three, sem React, sem GLB) com o `POOL` ao lado dela — os dois
números são a mesma decisão vista de dois lados, e em arquivos diferentes
saem de sincronia na primeira mudança de densidade.

`npm run paisagem` roda o auto-teste: varre o trajeto de 20 em 20 m, mede o
PICO de cada peça na tela e compara com o pool.

**Ele achou o erro na primeira execução**, com números que eu tinha chutado:

```
FALHA arbusto: pico 29, pool 20
FALHA arvore:  pico 32, pool 26
FALHA casa:    pico 73, pool 34
FALHA escola:  pico 30, pool 14
```

Casa com pico 73 também mostrou que a primeira densidade era cara demais para
o mini-PC do totem — frontaria a cada 10 m com casa de 7,5 m é quase encostada.
Passou para 20 m por lado, e na zona da escola a frontaria ficou só de um lado,
porque muro e casas no mesmo trecho somavam objeto demais. Depois do acerto:

```
ok poste 9/12 · cabos 9/12 · arbusto 31/34 · arvore 28/31 · casa 37/40 · escola 30/33
```

**Não conferido na tela**: o painel do navegador seguiu oculto e o trajeto não
chega a montar nesse estado (a cena 3D precisa de quadros para existir). A
densidade foi medida pela função pura e a escola por render em Cycles; falta
ver o conjunto em movimento.


## Item 5b — o cesto subindo (feito)

**A separação tinha de ser decidida ANTES de juntar por material.** `montar()`
junta por material e depois junta tudo; passado o primeiro `C.juntar` os nomes
individuais não existem mais, e aí não há como dizer quem é lança e quem é
carroceria. Entrou `montar(nome, separar=True)`, que classifica por prefixo de
nome enquanto os nomes ainda existem e devolve três objetos.

**O cesto é irmão da lança, não filho.** Ele tem de ficar NIVELADO enquanto a
lança sobe. Cesto que acompanha o ângulo da lança despeja o eletricista na
rua — é o tipo de erro que o cliente vê em um segundo. E parentesco não
sobrevive ao glTF de qualquer jeito, então a montagem é feita no jogo: um
grupo no pino segura a lança (deslocada de −pino, para girar em torno dele) e
o cesto recebe a posição já girada, com rotação zero.

Os dois pontos de articulação saem do exportador para
`public/modelos/ocorrencia.json` (`pino` e `cestoBase`), em coordenada de
jogo, para não virarem número mágico no `.tsx`.

**O ângulo é conta, não gosto.** A câmera do reparo mira y = 6,4 m, que é a
altura da chave fusível. Com os 42° da primeira tentativa o piso do cesto
parava em 4,52 m e o eletricista ficava OLHANDO PARA CIMA para o serviço que
faz com as mãos. 62° põe o piso em 5,38 m e o peito de quem está dentro nos
6,4 m. O braço tem 3,76 m e o pino está a 2,14 m: 5,9 m é o teto físico desta
lança.

Conferido por render em Cycles nas duas posições, com a mesma matemática que
o jogo usa (girar em torno do pino, transladar o cesto pelo mesmo giro).

**O que falta para o efeito ficar completo:** não há ninguém DENTRO do cesto.
E o cesto aéreo reabre a pergunta de conteúdo já anotada — com ele, a escada
deixa de ser obviamente a ferramenta certa no item do ferramental da fase 3.
As duas coisas são decisão de conteúdo, não de arte.


## Partida completa (06/10) — o defeito que só aparece jogando

Pedido: jogar de ponta a ponta e consertar o que aparecesse. **A partida achou
um defeito que nenhuma das sete rodadas anteriores tinha visto, e ele é o
maior da lista.**

### A tela entregava o gabarito

Os catálogos são escritos com a resposta certa em PRIMEIRO lugar — é assim que
se lê um catálogo, o item correto encabeça e os distratores vêm depois. E a
tela listava na ordem do arquivo.

Medido na partida: certo em primeiro em **6 das 7 etapas do vestiário**, nas
**3 decisões de chegada** e nos **9 passos do reparo**. A fase 3 inteira saiu
**164 de 164, 100%, aprovado**, clicando o primeiro botão nove vezes seguidas
sem ler nada.

É o pior tipo de defeito deste projeto: a fase do reparo é a que mais vale
ponto justamente porque a ordem do procedimento é o que mata quando
invertida — e era a mais fácil de passar.

**Correção:** `src/conteudo/ordem.ts`, embaralhamento determinístico por hash
do `id`. Determinístico porque dois colaboradores têm de fazer a mesma prova,
senão a nota não é comparável — a mesma regra do cenário do trajeto. Quem
desenha a tela usa `pecasDaVaga` / `opcoesNaTela` / `passosNaTela`; quem
corrige continua usando os catálogos, porque pontuação não depende de ordem
de exibição.

**`npm run gabarito`** simula o jogador que sempre clica o primeiro botão e
exige que ele REPROVE. De 100% para **26%**. Se um dia alguém voltar a listar
direto do catálogo, o teste falha.

### O que a partida confirmou que está bom

Vestiário (7 etapas, veredito e norma a cada uma), cabine (6 itens com
correção visível), chegada, ferramental (13 itens, seleção múltipla), reparo
(9 passos) e relatório com placar por fase — a cadeia fecha e pontua.

### O que não deu para jogar

**O trajeto.** Com o painel do navegador oculto o rAF é estrangulado e a fase
anda **1 metro a cada 22 segundos** — 1.340 m levariam horas. A fase monta e
o piloto responde, mas dirigir ponta a ponta exige o painel visível.


## O que ficou de fora da fila, e o usuário cobrou

A fila de 7 itens era um RESUMO do pedido, escrito nos primeiros 20 minutos,
e perdeu coisa. O usuário conferiu e achou:

- **"motos"** sumiu entre a mensagem dele e o item 7.
- **"uma ui mais bonita"** eu escrevi dentro do item 7 ("UI de direção
  decente"), fiz só a paisagem e **marquei o item como feito**. `git diff`
  confirma: zero linhas de `.trajeto-*` tocadas.
- **criação de personagem** continua 3 alturas e 5 tons; "mais animada" foi
  atendido só pela respiração.

Lição que vale mais que os itens: **marcar feito o que está pela metade é pior
do que não começar**, porque fecha a fila e o loop para.

## Item A — UI do trajeto (feito)

O HUD tinha mais peça do que parecia (alerta, semáforo, chamada já
estilizados). O que estava pobre era o **estado de repouso**, que é 90% do
tempo de tela: barra fina, frase corrida e um número grande num retângulo.

- **Velocímetro de arco** no lugar da caixa. O arco dá o que o número sozinho
  não dá: POSIÇÃO. E o traço do limite anda junto com o trecho, então a
  comparação que o jogador faz o tempo todo (estou acima?) virou geometria em
  vez de aritmética. Acima do limite o arco inteiro vira vermelho — cor chega
  na visão periférica, número não.
  Conferido no jogo: 5 km/h → 4,69 de 75 unidades de arco; traço do limite em
  `rotate(-67,5)` para limite 20 (−135 + 270·20/80).
- **Aviso com hierarquia.** Era "Avenida · 60 km/h · ..." num tamanho só, com
  o limite — o dado mais consultado — perdido no meio. Agora o LUGAR fica em
  destaque e o limite mora no velocímetro.
- **Barra de progresso com as fronteiras de trecho.** Sem elas a barra só diz
  "falta muito"; com elas o jogador vê que está acabando a avenida, que é o
  que ele usa para decidir se acelera ou já reduz.
- **Pedais** com ícone, alvo maior e estado de pressionado.


## Item B — motos (feito)

Pedidas na mensagem original ("outros carros, motos") e perdidas quando o
pedido virou fila. Entra `moto` em `via.py`, 674 faces.

**De frente, moto não é a moto — é o PILOTO.** A peça cruza a tela em um
segundo e meio, então o corpo dele é a maior peça do modelo e o farol único no
meio é o que diz "moto" antes de qualquer detalhe de motor. Piloto de capacete
com viseira e colete refletivo: numa fase que avalia condução, vale o cenário
mostrar o certo.

**Duas correções no tráfego, e a segunda é a que resolve.** As duas filas
andavam na mesma velocidade: o deslocamento inicial sobrevivia até a primeira
reciclagem e depois moto e carro apareciam **a 1 m um do outro** — medido no
jogo, não suposto. Dar 18% a mais de velocidade à moto desfaz o emparelhamento
— mas velocidade diferente na MESMA faixa significa que uma hora ela
ultrapassa, e aí as duas se atravessam.

Por isso a moto anda no **corredor**: x 2,45 em vez de 3,5, encostada na faixa
central. É onde moto anda no Brasil, e é o que a faz ler como moto e não como
carro pequeno.

**Não foi feito:** moto no MESMO sentido, ultrapassando o jogador. Exige lógica
de ultrapassagem (aproximar, desviar, voltar) e, se valer nota, teria de andar
com o metro e não com o relógio. Fica anotado, não escondido.


## Item C — criação de personagem (feito, com um limite medido)

**Porte (magro/médio/forte) é impossível, e agora está medido e não suposto.**
Varrendo `morphTargetInfluences` no modelo publicado: **zero malhas com morph
target**. Porte exigiria o morph no corpo E em cada uma das 19 peças de roupa,
porque elas são recortadas da superfície dele — sem isso a roupa não acompanha
e atravessa a pele. O comentário em `fisico.ts` já suspeitava; agora tem
número.

**O que o modelo permite variar em tempo real é escala e cor de material.**
Então a escolha cresceu dentro disso:

- altura: 3 → **5** (1,60 a 1,90)
- tom de pele: 5 → **8**
- **cor de cabelo**, que é eixo novo: o cabelo é nó próprio com material
  próprio, e sai de graça. O corte continua um só (raspado, que é o que cabe
  embaixo do capacete); trocar o CORTE exigiria uma malha por opção.

**A montagem virou três passos com a câmera indo até o que se escolhe:** corpo
inteiro para a altura, rosto para o tom, cabeça para o cabelo. Não é enfeite —
a diferença entre um tom e o seguinte é de poucos por cento, e a dois metros
de distância o jogador não via o que acabou de escolher.

Conferido no jogo: 3 passos com 5/8/5 opções, e a escolha chega ao material
(`pele_export` em 0,40/0,36/0,32 no tom 8; `cabelo` no grisalho).

**O enquadramento das câmeras foi conferido por conta, não por imagem**: pés
em y −0,9, cabeça em ~0,85, então o alvo 0,76 é o rosto e, a 1,36 m com fov
34, a cabeça ocupa ~28% da altura do quadro. Ver na tela ainda depende do
painel do navegador.


## Item D — ônibus e ciclista (feito)

**O "paralelepípedo" do ônibus tinha uma causa concreta, e não era a forma: a
carroceria enterrava as próprias rodas.** O corpo começava em z 0,47 e as
rodas (raio 0,44, centro 0,44) ficavam dentro dele — sobrava menos de meia
roda, ainda escondida pelo chanfro. **Ônibus sem roda visível é uma caixa
pousada no chão**, e era exatamente o que o render mostrava.

Piso subiu para 0,95 e a roda para raio 0,52: a roda aparece inteira embaixo
da saia. Altura total de 2,57 para **3,05 m**, que é altura de ônibus de
verdade. Entraram também a porta dianteira — depois da roda, é o que mais diz
"ônibus" numa silhueta, porque é o único rasgo vertical na fita de janela — e
a saia entre as rodas, que fecha o vão.

**O ciclista tinha a perna RETA do quadril ao pedal**, numa barra só. É isso
que o fazia parecer boneco de pau em cima da bicicleta. Agora são duas seções
com joelho dobrado — coxa para a frente, canela para trás — mais o pé no
pedal. É o joelho dobrado que dá a leitura de quem pedala, não o detalhe. A
altura sentada baixou 13 cm, que é o que corresponde a um selim de 0,95.

Custo: ônibus 306 → 332 faces, ciclista 820 → 940. Sobra orçamento de
triângulos de sobra.

**O que continua fraco e não escondo:** o tronco do ciclista ainda é um bloco
reto de 36 cm de largura, e o teto do ônibus é totalmente plano. As duas
peças passam a 30 km/h na beira da pista, então a silhueta importa mais que a
superfície — mas se o cliente reclamar de alguma, é dessas duas.

---

# Rodada de 09/10/2026 — vestiário, prévia e o corpo fora do lugar

Origem: o usuário pediu três coisas, nesta ordem de irritação — a escada que
não encosta no poste, o vestiário ("tá uma merda, troca essa cor, faz uma do
zero melhor, com as informações, uma coisa que ensina de verdade") e a
ocorrência ("na hora que eu selecionar uma coisa ele coloca na tela meio
transparente; se eu clicar em concluir ele faz mesmo todas as ações").
Apresentação no mesmo dia.

## Item 1 — a escada (feito)

A escada ficava **equilibrada no vazio** ao lado do poste. Já tinha sido
"corrigida" uma vez, com um tombo e um giro escolhidos a olho, e continuava
a 11 cm da peça.

Encostar é conta. Medido com o jogo rodando, varrendo o `matrixWorld` das
malhas:

| peça | medida |
|---|---|
| poste, seção duplo T | x ±0,055 (constante), z ±0,139 na altura do topo da escada |
| escada | eixo longo em Y, 4,63 m de sapata a topo, ±0,040 em X, ±0,267 em Z |

A face de X estava descartada e isso **não se via sem medir**: os degraus de
escalada do poste saem justamente em ±X, até 0,311, e um deles está a 4,36 m
— a escada passaria por dentro. Sobra a face de Z, que é lisa.

A ordem de Euler do three.js é XYZ, então `tombo` em Z vale ANTES de `giro`
em Y: a escada tomba no próprio plano (como escada tomba) e o giro aponta o
tombo. Com giro −90° o topo vai para +Z.

Resultado: pé em (0, 0, −1,10), topo em (0, 4,47, +0,137) — 15° fora da
vertical, que é o encosto de ~75° da NR-18.

**E a escada só existe se o jogador a tiver separado.** Ela estava em `APOIO`,
fixa: quem não levava escada nenhuma via uma encostada no poste assim mesmo,
o que desmente a própria pergunta do ferramental. Agora aparece em prévia
enquanto ele separa o material e vira peça quando sobe para o serviço — e
quem leva a de alumínio vê uma de alumínio (mesma malha, material trocado;
modelar uma segunda escada só para a resposta errada não se paga).

## Item 2 — o vestiário refeito (feito)

O que estava lá era um **questionário de sete telas com um boneco ao lado**.
Três defeitos, e só um era de cor:

1. **Cobrava memória, não leitura.** Os botões diziam "Capacete classe A" e
   "Capacete classe B". Quem não sabe de cor qual é a classe elétrica chuta
   entre dois nomes — e sair chutando não ensina nada.
2. **Não tinha escolha espacial.** Sete telas em fila, sem poder voltar.
3. **Entregava o veredito peça por peça**, o que faz da fase um gabarito
   interativo.

O que entrou:

- **Tela única.** As sete vagas são MARCAS CLICÁVEIS NO CORPO (`Html` do drei
  projetado pelo three, não sprite: o alvo tem de ter tamanho de dedo num
  totem, e sprite encolhe quando a câmera recua). Posições medidas no modelo:
  capacete 1,65 · visor 1,59 · peito 1,25 · cintura 0,88 · punhos 0,85 a
  ±0,57 · botina 0,11. A mão esquerda é a vaga das luvas e a direita a dos
  adornos — separar as duas faz "tirar o relógio" virar decisão com lugar no
  corpo.
- **A bancada de inspeção**, que é o miolo novo. Clicar numa peça não veste:
  abre a ETIQUETA — número de CA, classe de ensaio, data do ensaio elétrico e
  estado visual — e o cabeçalho diz que dia é hoje. A luva vencida agora é
  achável LENDO. `ensaioMeses` é relativo a hoje, não data fixa: um gabarito
  com "11/2025" escrito à mão vira mentira sozinho em alguns meses.
- **Nenhuma cor de julgamento na etiqueta.** Pintar de vermelho a linha do
  ensaio vencido devolveria a fase ao gabarito de onde ela saiu.
- **A conferência de EPI no fim**: o conjunto fecha, o encarregado desce o
  corpo item a item a 650 ms por parte. É avaliação, não gabarito — e é a
  conferência que se faz de verdade antes de sair para a rua.
- **O vestiário virou um lugar** (`src/cena/Vestiario3D.tsx`): piso de cimento,
  fila de armários de metal verde, banco de ripa, parede de bloco, luminária
  acesa. ~90 caixas e cilindros, nenhum arquivo novo. A luz passou a ter três
  TEMPERATURAS (chave quente, preenchimento frio, rebatimento verde dos
  armários) — era por isso que tudo caía no mesmo cinza, não por causa do
  valor das variáveis de CSS.
- A paleta da interface é redefinida em `.vest`, não duplicada: tudo que já
  usava `var(--painel)` seguiu junto.

**Defeito antigo que apareceu no caminho:** a animação de assentar peça zerava
`position.y` ao terminar. Isso só está certo para peça com origem em zero — e
`epi_capacete_b` tem origem na cabeça. **O capacete certo, o único item de
ponto cheio da vaga, caía no chão entre os pés no instante em que era
vestido, e ficava lá.** Toda peça com origem própria tinha o mesmo destino.

## Item 3 — a prévia na ocorrência (feito)

Escolher agora **desenha a consequência em transparente** antes de valer: o
caminhão onde pararia, os cones onde cairiam, a fita onde cercaria. Só
"Executar a manobra" torna aquilo real, e aí a peça anda até o lugar com o
som do motor, como antes.

Detalhe que não é opcional: os materiais TÊM de ser clonados. `clone(true)`
copia a árvore mas compartilha o material, então baixar a opacidade apagaria
metade do caminhão de verdade junto. Os clones são descartados quando a
prévia sai de cena, senão ficam na GPU.

**A câmera da pergunta de distância estava mentindo.** Ela já tinha sido
corrigida uma vez, de teleobjetiva para grande angular alta, e continuava
errada pelo mesmo motivo de fundo: a resposta certa espalha cavalete e cones
de x=−27 a x=−14, e tudo isso ficava ATRÁS do ponto de vista. Quem escolhia
"recuado" via dois cones no canto e nenhum cavalete — **o acerto dava a mesma
imagem que o erro**, que é o pior que pode acontecer com uma pergunta sobre
distância. Agora o olho está na pista, a 2,6 m do chão e 35 m antes do poste,
no sentido do trânsito: é a vista de quem dirige e vai encontrar a equipe.
Com "colado", esse mesmo olho não vê nada até estar em cima do serviço.

## Item 4 — o corpo do motorista estava fora do lugar (feito)

Achado ao conferir a fase 2 de ponta a ponta: **a primeira pergunta da
conferência do veículo abria com a tela cheia de pele.**

Diagnóstico, medindo os nós no jogo:

```
mot_cabelo        position (0.38, −0.51, −0.35)
mot_vestimenta_fr position (0.38, −0.51, −0.35)
mot_corpo         position (0.38,  0,     0   )   ← sem o recuo do banco
```

O corpo nu estava **51 cm acima e 35 cm à frente da própria roupa**: de pé
dentro da cabine, atravessando painel e volante, com as câmeras da
conferência abrindo por dentro dele.

Causa raiz, uma linha em `exportar_motorista.py`: `assentar` senta o
motorista movendo a ARMADURA, não o corpo (mover os dois aplicaria o
deslocamento duas vezes). O corpo é FILHO do rig, então a posição no banco
mora na matriz do pai, e `convert` não a traz para a malha. Três linhas
abaixo, `remove(arm)` apagava a armadura — e o filho voltava para a origem.
As peças de roupa nunca tiveram o problema porque passam por `limpar_pais`,
que solta mantendo a matriz de mundo; o corpo era o único que ia direto para
o `preparar`. Corrigido com `XP.limpar_pais([pele])` antes do `remove`.

**Isto reclassifica dois itens antigos do plano.** O "braço do motorista está
nu" e as "partes voando" da rodada 12 não eram recorte de roupa: eram o corpo
fora do lugar, saindo por dentro da roupa que estava no lugar certo. A
armadilha aqui é de método — os dois foram diagnosticados OLHANDO a tela, e
olhando os dois parecem defeito de roupa. Só medir a posição dos nós separou
uma coisa da outra.

## Limpeza

`src/Cena.tsx`, `src/dados.ts` e `cenario.glb` saíram: eram a fase de "achar
o risco na foto" que o cliente descartou, e nada os importava. 459 linhas e
1,5 MB a menos no pacote do totem, que foi de ~12 MB para 10 MB. Estava
marcado como adiado por falta de git — o git chegou.

A abertura também passou a acontecer no vestiário: era a única tela que ainda
dizia "boneco em estúdio", e é a que abre a apresentação.

## O que esta rodada NÃO fez

1. **Prévia no ferramental.** As ferramentas do kit (vara de manobra,
   detector, aterramento, elo) não têm malha; a escada é a única peça do
   ferramental que existe em 3D e essa já ganhou prévia. Pôr um desenho
   genérico no lugar das outras seria pior que não ter.
2. **Reexportar a cabine com o motorista no lugar certo.** As seis vistas da
   conferência foram compostas com o banco vazio e depois ajustadas contra um
   motorista que estava deslocado. Com o corpo no lugar, as seis precisam de
   uma varredura nova.
3. **Revisão do Cristiano**, que segue pendente desde o começo: a lista de EPI
   que a Energisa distribui de fato, o kit por atividade e os números de CA
   das etiquetas — que escrevi plausíveis, não reais.
4. **Medir no mini-PC do totem.** Continua sem hardware.
