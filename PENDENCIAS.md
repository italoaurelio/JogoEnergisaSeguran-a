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
- [ ] Modelar a cabine direito

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
- [ ] Remodelar pedestres
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
