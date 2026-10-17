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
- [ ] Rosto/corpo ainda "esquisito" — referência enviada (homem real, camisa e calça)

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
- [ ] Lanterna de freio do carro da frente (não confirmada na tela)

## Transversal
- [ ] Modelos destoantes: personagem detalhado, resto porco.
      Usar as skills de Blender para nivelar por cima.
