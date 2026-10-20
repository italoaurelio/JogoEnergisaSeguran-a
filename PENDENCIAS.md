# Pendências do cliente — rodada 17/10

Regra: só sai daqui com **data e como foi conferido**. Nada de "acho que fiz".
Enquanto estiver `[ ]`, está em aberto, mesmo que eu ache que resolvi.

## Personagem
- [x] Cabelo atravessa o capacete — 17/10: peça `cabelo_capacete` (só nuca e
      costeleta) troca o corte inteiro quando há capacete. Conferido na cabine
- [x] 3 tipos de cabelo — 17/10: curto/médio/raspado, etapa nova no vestiário
- [x] Roupa base — 17/10: camiseta azul lavado e bermuda jeans, materiais
      separados. Eram a mesma cor cinza
- [x] Descalço — 17/10: tênis entra com a roupa de base e sai quando a
      botina entra. Conferido no vestiário
- [x] Rosto/corpo "esquisito" — 17/10. Quatro causas, todas medidas no
      render de perto (`prova_rosto.py`), nenhuma era a que eu vinha tratando:
      **íris poligonal.** O material do olho media o raio na coordenada
      GERADA, que é atributo de VÉRTICE e o Cycles interpola de face em face.
      Numa esfera de 32×16 a frente do olho tem meia dúzia de quadriláteros,
      então a circunferência da íris saía com lados retos e a pupila puxada
      para um canto. Passou a medir na coordenada de OBJETO, exata por pixel.
      (Subir o bake de 256 para 1024 veio junto, mas sozinho só desenharia o
      polígono com mais nitidez.)
      **sobrancelha.** Elipsoide de 0,038 com suavidade 0,48 lia como mancha
      cinza alta na testa — olheira, não sobrancelha. Mais baixa, mais curta
      na vertical (0,0062) e com borda (0,44).
      **cabelo de touca de natação.** Não era brilho — já estava em 0,82 de
      rugosidade. Era a superfície: casca deslocada de uma calota lisa
      continua lisa. Ganhou deslocamento por ruído, só para fora (CLOUDS,
      `mid_level` 0), que a faixa de capacete não leva.
      **roupa base.** A cor saiu cinza na tela mesmo "sendo" azul: 0,082/
      0,105/0,135 tem razão R/B de 0,61 e some sob luz quente. Agora
      0,055/0,118/0,205 e jeans 0,034/0,055/0,112, e os dois afastados 17 mm
      do corpo em vez de 9 — com 9 a camiseta copiava peitoral e linha alba e
      lia como blusa de compressão.
      Conferido no vestiário do jogo, não só no render. **Fica em aberto para
      a próxima rodada:** a silhueta ainda é de roupa de academia, não de
      roupa de trabalho — a camiseta precisaria de barra solta e a bermuda de
      perna reta, e isso é modelagem nova, não parâmetro

## Cabine
- [x] Mão no volante — 17/10: a IK levava o PUNHO ao eixo do aro. Agora o
      alvo recua 5,5 cm pela normal do aro (inclinado 32°)
- [x] Cinto no corpo — 17/10: medido, passava 23,7 cm dentro do tórax.
      Caminho refeito sobre o perfil medido do corpo; sobra 0 no peito
- [x] Fundo da garagem — 17/10: nervura, tesoura, demarcação, painel de
      ferramentas, paletes, pneus, carrinho, escada, extintor, cones
- [x] Modelar a cabine direito — 17/10, em duas frentes porque o problema
      eram duas coisas:
      **(a) painel de instrumentos.** Medido com `scene.ray_cast` do olho do
      motorista: NENHUM ponto do mostrador era visível — o capô do painel era
      um contorno fechado de 21 cm, plástico maciço, e os relógios moravam
      dentro dele. Virou pala de 3,5 cm sobre um nicho aberto. Dentro:
      dois relógios com aro cromado, 9 traços, ponteiro e cubo, visor de bordo
      entre eles; marcação e ponteiro ACENDEM (`C.mat_luminoso`, novo), porque
      dentro da pala não entra luz nenhuma. Mais: difusores com moldura,
      palhetas e botão (eram retângulos pretos), console com tela, 6 teclas,
      2 giratórios e luzes do ar, hastes de seta e limpador, e a grelha do
      desembaçador. Conferido em `cab_motorista.png` e `cab_item_celular.png`
      **(b) o que o jogador REALMENTE vê dirigindo.** Projetado na tela do
      jogo: o painel inteiro cai em px 970 de 1038, debaixo dos botões. O
      terço de baixo da tela — o que o cliente chamou de protótipo — é o
      CAPÔ, e ele era uma caixa lisa. Ganhou as duas frestas do para-lama,
      vinco, nervura em x ±0,45 (medido: é a faixa que cabe no quadro, o
      lombo central cai fora pela direita) e para-lama 1,7 cm mais alto.
      Conferido na tela, não no render

## Rua / cenário
- [x] Teto vazado — 17/10: era o OITÃO que faltava. O telhado é uma casca em
      Λ de 16 cm, não um sólido; entre o topo da parede e a água sobrava um
      vão triangular ABERTO. Render de rua novo em `prova_via.py -- casas`
- [x] Escola — 17/10: módulo de entrada com portão (antes não havia porta
      nenhuma) e janela 9 cm para fora, acima do muro
- [x] Rua vazia — 17/10: segunda fileira de casas 13 m atrás (aparece pelos
      vãos da primeira), carro estacionado no meio-fio com os 4 modelos,
      arbusto em TODO módulo e dos dois lados (era `else if`, só entrava em 1
      de 3). Auto-teste `npm run paisagem` reajustado: pegou 2 pools curtos
- [x] Cruzamento — 17/10: peça `cruzamento` (dois braços de asfalto, linha de
      retenção, eixo tracejado, meio-fio nas 4 esquinas) + `TransitoCruzado`,
      que anda ao CONTRÁRIO do sinal do jogador. Conferido na tela: van parada
      na transversal com o semáforo dele verde
- [x] Placa da lombada — 17/10: A-18 30 m antes
- [x] Fio voando — 17/10: o vão ocupa os 40 m à frente do próprio metro, e o
      último desenhado ia 40 m além do último POSTE desenhado. Medido depois:
      cabo termina em 305,9 e poste em 306

## Gente e veículos da rua
- [x] Joelho — 17/10: coxa e canela separadas. Medido: 51° no pico e zero
      na metade do ciclo em que não dobra
- [x] Remodelar pedestres — 17/10: mão no fim do braço (acabava num toco no
      pulso), sapato em cabedal+sola (era uma caixa só), pescoço encurtado
      (sobravam 10 cm de tubo entre tronco e mandíbula, lia como tartaruga).
      Ciclista: coxa/canela/braço/antebraço eram `C.barra` — paralelepípedo de
      13,5 cm de lado — viraram `_membro`, loft com o anel perpendicular ao
      osso, e ganhou mão no guidão. Conferido no render `via_gente_frente.png`
      e medido no jogo: `via_pedestre_braco_d` tem 0,447 m (era 0,405: a mão
      entrou), canela continua filha da coxa depois do `optimize`
- [x] Moto — 17/10: perna do piloto com joelho, aro e cubo de roda, garfo,
      paralama, lanterna, escapamento, retrovisores
- [x] Moto dentro de carro — 17/10: o corredor era ideia de via de várias
      faixas; aqui a contramão tem UMA. Medido: moto ia a x 2,65 e carro
      começa em 2,40. Moto entrou na mesma fila e usa a perseguição.
      Conferido rodando: 11 veículos, ZERO sobreposições em x e z
- [x] Ônibus — 17/10: a fita de janela era UM vidro corrido de 7,2 m.
      Ganhou montantes (é o ritmo deles que lê como ônibus), porta de
      embarque com degrau — faltava, e ele está parado EM EMBARQUE —, e
      para-choques. Render `prova_via.py -- decisao`

## Jogo
- [x] Ícone de missão — 17/10: cilindro no poste do serviço, só na chegada
- [x] Lanterna de freio do carro da frente — 17/10, CONFIRMADA na tela.
      Três defeitos empilhados, e nenhum aparecia por exit code:
      (1) o material que o `useMemo` devolvia não era o das malhas
      desenhadas — medido no mesmo quadro: o memo em 0,9 e o
      `via_carro_corpo_3` da cena em 0. Agora o clone é feito a partir do
      grupo que renderiza, no primeiro quadro em que ele tem filho;
      (2) emissivo 0,9 fica abaixo de 1 e não entra no bloom — a 70 m a
      lanterna tem dois pixels, e dois pixels só existem se estourarem.
      Virou HDR (8,0; 0,45; 0,22), como o pisca do ônibus já era;
      (3) o carro vivia a 95 m, grudado no teto do `Math.min`. Teto em 70.
      Conferido com `?freioaceso=1` (novo, igual ao `?setaacesa=1`): as duas
      lanternas acesas na traseira, visíveis na captura

## Transversal
- [x] Modelos destoantes — 17/10. Fechou junto com os outros. O que entrou
      por este item e não por outro: o **cabo do poste** saía na tela como
      linha PONTILHADA — com 1,8 cm de raio ele fica sub-pixel a partir de
      uns 40 m e o antisserrilhado o come em pedaços. Agora 4 cm, escolhido
      pela leitura na tela e não pelo catálogo do condutor. Conferido na rua
      residencial: os vãos próximos saem contínuos, os de 200 m ainda
      pontilham (e aí está certo que pontilhem)

---

# Rodada 17/10 (segunda leva) — anotado antes de começar

Mesma regra: só sai daqui com data e com o que foi olhado.

## Cabine (o cliente já pediu 3 vezes)
- [x] Volante virado para baixo — 17/10: 32° da horizontal é volante de
      ônibus. Os 32° tinham sido comprados para manter o aro em quadro na
      fase 2b, e essa conta MORREU quando o olho da 2b andou 28 cm para a
      frente: projetado na tela, o topo do aro cai em px 1036 de 1038.
      Sobrou só o preço. 62°, que é coluna de caminhonete
- [x] Não estava segurando o volante — 17/10. `fechar_mao`, que curva os
      20 ossos de dedo do rig, EXISTE há rodadas e o `exportar_motorista.py`
      nunca a chamou. Quem chama é `prova_sentado.py` — então as duas vezes
      em que conferi "no render" eu estava conferindo a prova, não o jogo.
      É o mesmo erro que o docstring de `prova_rosto.montar` descreve para a
      sobrancelha. Conferido agora na tela da fase 2a, não no render
- [x] Cinto sumiu — 17/10. Achado pintando a peça de VERMELHO na cena:
      ela estava em quadro o tempo todo, atrás do ombro do motorista e cinza
      0,175 contra um pilar 0,072. Dois acertos: a fita pende para a FRENTE
      (y 0,23 contra 0,36) e passa por fora do ombro, e o albedo foi para
      0,34. Conferido na tela
- [x] Descalço na cabine — 17/10: o motorista tinha roupa de baixo e
      nenhum calçado. `base_tenis` já existia no catálogo e não entrava no
      exportador do motorista. Medido no jogo: `mot_base_tenis` visível

## Gente e tráfego
- [x] Pedestres deslizando e teleportando — 17/10. Medido: vaivém de 1,2 m
      com ω 0,42 dá 0,25 m/s de pico — um passo de 72 cm a cada 3 s, que é
      câmera lenta. E a virada era `giro + π` entre dois quadros, cinco
      pessoas dando meia-volta instantânea a cada 7 s: era esse o teleporte.
      Agora andam 4,4 m ao longo do meio-fio a 1,10 m/s e a meia-volta é uma
      curva contínua que cai onde eles estão parando.
      **Não foi feita no Blender, e é de propósito:** `X.preparar()` roda
      convert(MESH) e aplica a armadura, então nada com osso chega ao .glb —
      a animação teria de ir como trilha de nó, e `gltf-transform optimize`
      achata hierarquia. Em contrapartida a fase do passo é calculada a
      partir da distância ANDADA, o que uma trilha assada não consegue
      fazer: é isso que garante que o pé não desliza em nenhuma velocidade
- [x] Só o jogador parava na faixa — 17/10: o contrafluxo corria à
      velocidade cheia e levava `p[i] = linha` ao cruzar — não freava,
      congelava, todos no mesmo ponto, e um segundo laço os desempilhava de
      7,5 em 7,5 m. Teleporte para desfazer teleporte. Agora a linha entra
      na perseguição como veículo parado, igual à do ciclista
- [x] Carro da garagem deslizando — 17/10: posição e ângulo eram duas
      retas independentes, 7 m de deslocamento LATERAL com o carro apontado
      para outro lado. Agora são duas fases (sai de ré, para, arranca) e em
      cada uma a posição vem da direção apontada

## Rua / cenário
- [x] Espaço vazio na estrada — 17/10: terceira linha de árvores a 34 m do
      eixo, fechando o fundo atrás da segunda fileira de casas
- [x] Cruzamento vazio no meio — 17/10: quatro bocas de lobo, dois poços de
      visita e dois remendos de asfalto. Cruzamento é o pedaço de rua mais
      remendado que existe
- [x] Poste no meio do cruzamento — 17/10: a paisagem põe poste a cada 40 m
      sem saber que existe cruzamento. Filtro de ±11 m do eixo, que também
      tira casa, muro e arbusto da esquina
- [x] Vazio atrás das casas — 17/10: mesma linha de árvores de fundo
- [x] Fios pairando no ar — 17/10. Medido na cena: `via_cabos` NÃO é
      centrado na origem (o comentário dizia que era) — corre 40 m para +Z a
      partir dela. Um vão atravessava o de serviço e morria no ar em z 1; o
      outro ia a z 78,9 com o último poste em 39. Postes em -59/-19/19/59 e
      cada vão começa e termina em poste. Medido de novo depois: ok

## Chegada ao local
- [x] 20 s parando lentamente — 17/10: `max(1,5; restante/4)` nunca chega a
      zero, ele entrava nos últimos metros a 5,4 km/h e ficava assim até o
      esmaecer. Agora é desaceleração constante de 1,4 m/s² (7,6 s) e ele
      ENCOSTA NO MEIO-FIO nos últimos 30 m. O marcador de serviço aparece na
      aproximação, a 110 m — existia só dentro da fase 3, onde já se chegou
- [x] Tela de chegada — 17/10: fios terminando em poste (eram dois vãos
      soltos), fundo fechado atrás das casas de cá (telhado + mata em z −18
      e −24) e o marcador de serviço agora já vem da estrada. A frenagem
      leva 6 s e o caminhão encosta no meio-fio. Conferido na tela

## Em andamento (código pronto, falta exportar e conferir na tela)
- [x] Roupa base vira camisa e calça — 17/10: exportada e conferida no
      render de perfil (`sentado_perfil.png`) e no vestiário. Com folga de
      10/13 mm saía macacão de mergulho; com 22/26 mais SMOOTH, cinto na
      cintura e calça cinza-chumbo, lê como duas peças
- [x] Os 3 cortes — 17/10. Exportados e medidos no jogo: profundidade
      20,4 / 21,5 / 25,7 cm e linha do cabelo 1,564 / 1,583 / 1,572, ou seja
      2 cm de diferença de testa entre raspado e curto. E achei o que
      importava mais: a COR do cabelo nunca era aplicada (comparação por
      igualdade contra `cabelo.003`), então a etapa de cor não fazia nada.
      Com ela ligada, cada corte ganhou claridade própria — raspado 0,053,
      curto 0,025, médio 0,014

---

# Rodada 17/10 (terceira leva)

Os dois que eu mesmo declarei como não resolvidos.

- [x] Frente do capô — 17/10: a faixa que cabe no quadro é y −1,1 a −2,4
      (medido projetando o capô na tela: px 910 a 724). Entrou tudo nela —
      aba escura da frente, duas lanternas de posição nas quinas (emissivas,
      pela lição da lanterna de freio), duas tomadas de ar com palheta e o
      emblema no eixo. Conferido na tela
- [x] Acostamento da chegada — 17/10. A causa: a rua da ocorrência tinha
      meio-fio e calçada de UM LADO só. Do lado da câmera o asfalto acabava
      em y −10,1 e virava terra batida até o horizonte — a câmera do
      briefing fica em y −12, ou seja, em pé no barro. Entrou o segundo
      meio-fio e a segunda calçada, mais poço de visita, boca de lobo nos
      dois meios-fios e remendos de asfalto. Conferido na tela
- [x] Camisa justa — 17/10. Folga uniforme não resolvia: só engorda a
      mesma anatomia. `cair_do_corpo` (nova) afasta CRESCENDO para baixo —
      zero no peito, 3 cm na barra —, que é o que uma camisa faz de verdade.
      Mesma coisa na calça (2,2 cm na canela). Duas armadilhas: sem limite
      em X a manga virou quimono, porque na pose de descanso o antebraço cai
      para dentro da faixa do caimento; e faltava gola, sem a qual o decote
      em barco lê como moletom. Prova nova `prova_roupa.py` — não havia
      nenhuma do corpo inteiro vestido, e era por isso que isso passava

---

# Rodada 20/10 — tablet Android

O jogo passou a rodar no navegador de um tablet. Fase 1 lisa, fase 2
engasgando (~20 fps pelo olho do cliente), fase 3 travada a ponto de não dar
para jogar. Medido no navegador, com `?leve=1`, contando as chamadas de
desenho por quadro direto no contexto WebGL:

| fase | desenhos/quadro (antes) | depois |
|---|---|---|
| 2 trajeto, andando | 994 na tela + 2.059 no mapa de sombra | 996 |
| 3 ocorrência, no local | 209 num alvo HDR + 1 cópia para a tela + 27 de sombra | 209 na tela + 27 |

- [x] Modo leve por toque (`pointer: coarse`) — 20/10: sai o
      `EffectComposer` inteiro (o AgX passa a ser conta do material, não
      passe), saem oclusão, bloom, SMAA e MSAA, o dpr cai para 0,8 e os mapas
      de sombra para 1024. Conferido no navegador: as cinco fases desenham,
      sem erro de console, e o alvo intermediário sumiu da contagem
- [x] Sombra do trajeto no tablet — 20/10: desligada em modo leve. Dois
      terços do quadro da fase iam para um mapa que NÃO APARECE (ver abaixo).
      Conferido andando: 3.053 → 996 desenhos por quadro, e a imagem não muda
      um pixel

- [ ] **Nenhuma peça do trajeto projeta sombra na estrada.** Vem de 16/10 e
      continua aberto. Já descartados, medindo: campos das malhas, o
      enquadramento da câmera de sombra, a posição do sol, o remendo da dobra
      e a compilação dos programas. Com `shadow-bias={0}` não aparece acne
      nenhuma, sinal de que o fragmento não amostra o mapa. O vestiário, no
      mesmo projeto, projeta normalmente
- [ ] **Fase 3 ainda travada no tablet** — falta o número do aparelho. É
      pouco desenho (236/quadro) para estar tão lenta, então o gargalo deve
      ser por pixel e não por objeto. Como separar, no próprio tablet:
      `?fps=1` liga o contador e `?dpr=0.5` corta os pixels pela metade. Se
      o dpr derruba o custo, é pixel; se não muda nada, é objeto/CPU
- [ ] **O trajeto desenha o mundo inteiro todo quadro** (996 desenhos, 1.340
      m de estrada para 290 m de névoa visível). `frustumCulled = false` está
      ligado de propósito em todas as malhas da via, porque a dobra move a
      geometria no shader e o corte por caixa envolvente a descartaria em
      curva. O corte certo é por distância em Z, à mão, com margem — não
      feito ainda

- [x] **Tirar a conferência da cabine e o trajeto** — 20/10, a pedido. O jogo
      ficou vestiário → ocorrência → relatório, em QUALQUER máquina (não só no
      tablet). As duas fases continuam inteiras no repositório, só não são
      montadas: `fases/Cabine.tsx` e `fases/Trajeto.tsx` não têm mais quem as
      chame, e religá-las é devolver as duas etapas em `App.tsx`.
      Foi junto o que mentiria na tela: o cartão "Em trânsito" e a
      demonstração de dirigir na abertura ("duas fases", "dois gestos"), o
      rótulo da ocorrência (Fase 3 → Fase 2) e o relatório de exemplo.
      Conferido jogando: vestiário → "Sair para o serviço" cai direto em
      "FASE 2 · OCORRÊNCIA", e o relatório fecha com duas linhas de fase
      (18/72 e 22/164) em vez de quatro
