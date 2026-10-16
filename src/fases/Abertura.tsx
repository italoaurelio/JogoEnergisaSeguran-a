/**
 * Abertura e onboarding.
 *
 * A abertura era um título, três linhas de resumo e um campo de nome. Quem
 * sentava no totem não sabia QUEM ele é na história, o que tinha acontecido,
 * nem como se mexe em nada — descobria clicando. O retorno do cliente foi
 * direto: "tem que explicar".
 *
 * São quatro passos, e o quarto é o que já existia:
 *
 *   1. a história — quem você é, que horas são, o que aconteceu
 *   2. o que vai acontecer — as três fases, com imagem de cada uma
 *   3. como se joga — as três mecânicas, DEMONSTRADAS em movimento
 *   4. como a nota funciona, nome e começar
 *
 * As demonstrações do passo 3 são SVG animado por CSS, e isso é decisão, não
 * economia: um .gif ou um .mp4 de cada mecânica custaria megabytes no pacote
 * do totem, embaçaria na tela cheia e precisaria ser regravado toda vez que a
 * interface mudasse de cor. O desenho é vetor, pesa zero e herda as
 * variáveis de cor do tema.
 *
 * As três FOTOS do passo 2 são quadros reais da gravação da partida
 * (`gravacao/gravar.mjs`), 640 px e 116 KB somadas — ali a foto é melhor que
 * o desenho, porque a promessa é "é assim que vai parecer".
 */
import { Suspense, useState } from 'react'
import { Environment } from '@react-three/drei'
import { PalcoPronto } from '../cena/Carregando'
import { Canvas } from '@react-three/fiber'
import Personagem from '../cena/Personagem'
import Vestiario3D, { LuzVestiario, MiraFixa } from '../cena/Vestiario3D'
import { Acabamento } from '../cena/Acabamento'
import { FISICO_INICIAL } from '../conteudo/fisico'
import { OCORRENCIA } from '../conteudo/ocorrencia'

/** O conjunto certo de EPI. A abertura mostra o resultado, não o problema. */
const EPI_VITRINE = [
  'vestimenta_fr', 'capacete_b', 'protetor_facial_arco',
  'luva_isolante_cobertura', 'botina_isolante', 'paraquedista_talabarte',
]

const FASES = [
  {
    img: './onboarding/vestiario.jpg',
    titulo: 'Vestiário',
    texto: 'Monte o seu personagem e escolha o EPI peça por peça. Leia a etiqueta antes de vestir: é ela que diz a classe e a validade do ensaio.',
  },
  {
    img: './onboarding/trajeto.jpg',
    titulo: 'Em trânsito',
    texto: 'Confira a cabine com o veículo desligado e dirija 1,3 km até a ocorrência — escola, faixa de pedestre, lombada e ciclista no caminho.',
  },
  {
    img: './onboarding/ocorrencia.jpg',
    titulo: 'Ocorrência',
    texto: 'Isole a área, separe o equipamento e faça o reparo na ordem certa. A ordem é o que mata quando se inverte.',
  },
]

export default function Abertura({
  nome, setNome, avancar,
}: {
  nome: string
  setNome: (v: string) => void
  avancar: () => void
}) {
  const [passo, setPasso] = useState(0)

  return (
    <div className="abertura">
      <div className="abertura-palco" aria-hidden>
        <Canvas
          dpr={[1, 1.5]}
          shadows
          camera={{ position: [0.46, 1.46, 4.35], fov: 32 }}
          gl={{ antialias: true }}
        >
          <Suspense fallback={null}>
            {/* Sem IBL, TODO METAL RENDERIZA PRETO: ele só tem reflexo para
                mostrar. O puxador do armário (metalness 0,85), as fivelas e a
                argola dorsal do cinturão sumiam numa massa chapada. Sem
                `background` — o cenário é fechado, o que se quer é o reflexo. */}
            <Environment files="./hdri/ceu.hdr" environmentIntensity={0.10} />
            <LuzVestiario />
            <Vestiario3D />
            <Personagem
              fisico={FISICO_INICIAL}
              vestindo={EPI_VITRINE}
              giro={-0.42}
            />
            <MiraFixa para={[0, 0.98, 0]} />
            <Acabamento raio={0.9} />
            <PalcoPronto />
          </Suspense>
        </Canvas>
      </div>

      <div className="abertura-conteudo">
        {/*
          O PULAR VAI PARA A ÚLTIMA TELA, e não para fora do onboarding.

          Ele existia só aqui na tela 0 e levava direto ao jogo — o que fazia
          quem pulasse PERDER O CAMPO DO NOME, que fica na tela 3, e a linha
          que explica como a nota funciona. Numa feira, em pé e com fila
          atrás, pular é o caminho mais usado, e era o único com um buraco.

          Agora ele salta as três telas de leitura e para no nome, a um
          clique de jogar. E está nas três, não só na primeira: dá para
          desistir da leitura no meio dela.
        */}
        {passo === 0 && <Historia avancar={() => setPasso(1)} pular={() => setPasso(3)} />}
        {passo === 1 && (
          <OQueVaiAcontecer voltar={() => setPasso(0)} avancar={() => setPasso(2)}
                            pular={() => setPasso(3)} />
        )}
        {passo === 2 && (
          <ComoSeJoga voltar={() => setPasso(1)} avancar={() => setPasso(3)}
                      pular={() => setPasso(3)} />
        )}
        {passo === 3 && (
          <ANota nome={nome} setNome={setNome} voltar={() => setPasso(2)} comecar={avancar} />
        )}

        <ol className="onb-trilha" aria-label="Progresso da explicação">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className={i === passo ? 'atual' : i < passo ? 'feita' : ''} />
          ))}
        </ol>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- 1. história */

function Historia({ avancar, pular }: { avancar: () => void; pular: () => void }) {
  return (
    <>
      <p className="sobretitulo">Treinamento de segurança do trabalho</p>
      <h1>Um dia de serviço</h1>

      <div className="onb-relato">
        <p className="onb-hora">06h40 · segunda-feira</p>
        <p>
          Você é eletricista de rede da Energisa. Chegou ao pátio, e a primeira
          ordem de serviço do dia já está na sua mão.
        </p>
        <p>
          <b>{OCORRENCIA.endereco}.</b> {OCORRENCIA.relato} É você quem vai até
          lá — do vestiário, pelo trânsito, até o poste.
        </p>
        <p className="onb-missao">
          O serviço em si é simples. O que está sendo avaliado é tudo o que vem
          antes dele.
        </p>
      </div>

      <div className="linha-botoes">
        <button className="btn btn-fraco" onClick={pular}>Já conheço, pular</button>
        <button className="btn btn-grande" onClick={avancar}>Como funciona</button>
      </div>
    </>
  )
}

/* ------------------------------------------------- 2. o que vai acontecer */

function OQueVaiAcontecer({ voltar, avancar, pular }:
  { voltar: () => void; avancar: () => void; pular: () => void }) {
  return (
    <>
      <p className="sobretitulo">O que vai acontecer</p>
      <h2 className="onb-titulo">Três fases, na ordem do dia</h2>

      <ol className="onb-fases">
        {FASES.map((f, i) => (
          <li key={f.titulo}>
            <img src={f.img} alt="" loading="lazy" />
            <div>
              <p className="onb-fase-num">Fase {i + 1}</p>
              <h3>{f.titulo}</h3>
              <p>{f.texto}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="linha-botoes">
        <button className="btn btn-fraco" onClick={voltar}>Voltar</button>
        <button className="btn btn-fraco" onClick={pular}>Pular</button>
        <button className="btn btn-grande" onClick={avancar}>Como se joga</button>
      </div>
    </>
  )
}

/* ------------------------------------------------------- 3. como se joga */

function ComoSeJoga({ voltar, avancar, pular }:
  { voltar: () => void; avancar: () => void; pular: () => void }) {
  return (
    <>
      <p className="sobretitulo">Como se joga</p>
      <h2 className="onb-titulo">São três gestos, e só</h2>

      <ul className="onb-demos">
        <li>
          <DemoEscolher />
          <div>
            <h3>Clicar</h3>
            <p>
              No vestiário, clique numa <b>parte do corpo</b>. O armário abre só
              o que vai ali. Clique na peça para ler a etiqueta, e em
              <b> Vestir</b> para pôr no personagem.
            </p>
          </div>
        </li>
        <li>
          <DemoDirigir />
          <div>
            <h3>Dirigir</h3>
            <p>
              O caminhão segue a estrada sozinho. Você só <b>segura</b> Acelerar
              ou Frear — ou as setas ↑ e ↓. O velocímetro mostra a máxima do
              trecho em que você está.
            </p>
          </div>
        </li>
        <li>
          <DemoPrevia />
          <div>
            <h3>Ver antes de valer</h3>
            <p>
              Na ocorrência, a escolha aparece <b>transparente</b> na cena antes
              de valer. Dá para trocar quantas vezes quiser. Só
              <b> Executar a manobra</b> torna aquilo real.
            </p>
          </div>
        </li>
      </ul>

      <div className="linha-botoes">
        <button className="btn btn-fraco" onClick={voltar}>Voltar</button>
        <button className="btn btn-fraco" onClick={pular}>Pular</button>
        <button className="btn btn-grande" onClick={avancar}>Como é a nota</button>
      </div>
    </>
  )
}

/* -------------------------------------------------------------- 4. a nota */

function ANota({
  nome, setNome, voltar, comecar,
}: {
  nome: string
  setNome: (v: string) => void
  voltar: () => void
  comecar: () => void
}) {
  return (
    <>
      <p className="sobretitulo">Como a nota funciona</p>
      <h2 className="onb-titulo">A conta só aparece no fim</h2>

      <ul className="onb-regras">
        <li>
          <span className="onb-bola">1</span>
          <p>
            {/*
              A REGRA ESTAVA MENTINDO, por meia frase. O texto dizia "fora do
              vestiário", mas a conferência do veículo TAMBÉM dá veredito na
              hora ("Decisão correta" / "Decisão errada", em `Cabine.tsx`).
              Sobravam duas fases que avisam e duas que não, e o jogador só
              era avisado de uma delas.

              A regra de verdade é melhor do que a prometida e cabe numa
              linha: as duas fases de PREPARAÇÃO ensinam na hora, as duas de
              CAMPO não. Quem mente para o jogador sobre as regras perde o
              jogador.
            */}
            Cada decisão vale ponto. Errar desconta. No vestiário e na
            conferência do veículo você descobre na hora; <b>na rua e no poste,
            ninguém avisa</b> — a conta aparece no fim.
          </p>
        </li>
        <li>
          <span className="onb-bola">2</span>
          <p>
            No fim sai um relatório com <b>tudo o que você fez</b>, o porquê de
            cada ponto e a norma que trata do assunto.
          </p>
        </li>
        <li>
          <span className="onb-bola">3</span>
          <p>A aprovação é em <b>70%</b>. Dá para refazer quantas vezes quiser.</p>
        </li>
      </ul>

      <label className="campo">
        <span>Seu nome (opcional)</span>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Para constar no relatório"
          maxLength={40}
        />
      </label>

      <div className="linha-botoes">
        <button className="btn btn-fraco" onClick={voltar}>Voltar</button>
        <button className="btn btn-grande" onClick={comecar}>Começar o dia</button>
      </div>
    </>
  )
}

/* ------------------------------------------------------------ as demos */
/*
  Cada demo é um SVG que REPETE o gesto de verdade, com o mesmo tempo e as
  mesmas cores da tela a que se refere. O movimento é todo em CSS (ver
  `estilo.css`, bloco ONBOARDING): o componente só desenha as peças.
*/

function DemoEscolher() {
  return (
    <svg className="demo" viewBox="0 0 150 90" aria-hidden>
      {/* corpo esquemático */}
      <g className="demo-corpo">
        <circle cx="34" cy="20" r="7" />
        <path d="M34 28 v22 M34 33 l-11 10 M34 33 l11 10 M34 50 l-7 18 M34 50 l7 18" />
      </g>
      {/* três marcas; a do meio é a que acende */}
      <circle className="demo-marca" cx="34" cy="20" r="5.5" />
      <circle className="demo-marca demo-marca-alvo" cx="34" cy="38" r="5.5" />
      <circle className="demo-marca" cx="34" cy="64" r="5.5" />
      {/* cartão da peça, que entra depois do clique */}
      <g className="demo-cartao">
        <rect x="64" y="22" width="76" height="46" rx="6" />
        <rect className="demo-linha" x="72" y="30" width="38" height="5" rx="2.5" />
        <rect className="demo-linha demo-fraca" x="72" y="40" width="58" height="4" rx="2" />
        <rect className="demo-etiqueta" x="72" y="50" width="60" height="11" rx="2" />
      </g>
      {/* cursor */}
      <g className="demo-cursor">
        <path d="M0 0 l0 11 l3 -3 l2.6 5 l2.6 -1.3 l-2.6 -4.8 l4.4 -0.3 z" />
      </g>
    </svg>
  )
}

function DemoDirigir() {
  return (
    <svg className="demo" viewBox="0 0 150 90" aria-hidden>
      {/* arco do velocímetro */}
      <path className="demo-arco" d="M14 64 A32 32 0 0 1 78 64" />
      <path className="demo-arco demo-arco-cheio" d="M14 64 A32 32 0 0 1 78 64" />
      <g className="demo-ponteiro"><line x1="46" y1="64" x2="46" y2="38" /></g>
      <circle className="demo-pino" cx="46" cy="64" r="3.5" />
      {/* placa de limite que entra no fim do ciclo */}
      <g className="demo-placa">
        <circle cx="116" cy="26" r="15" />
        <text x="116" y="31" textAnchor="middle">30</text>
      </g>
      {/* os dois pedais */}
      <g className="demo-pedais">
        <rect className="demo-frear" x="86" y="54" width="28" height="20" rx="5" />
        <rect className="demo-acelerar" x="118" y="54" width="28" height="20" rx="5" />
      </g>
    </svg>
  )
}

function DemoPrevia() {
  return (
    <svg className="demo" viewBox="0 0 150 90" aria-hidden>
      {/* pista */}
      <rect className="demo-pista" x="0" y="46" width="150" height="26" />
      <path className="demo-eixo" d="M0 59 h150" />
      {/* poste, para dar o lugar do serviço */}
      <path className="demo-poste" d="M104 46 v-32 M96 18 h16" />
      {/* o caminhão: nasce fantasma, vira sólido e anda */}
      <g className="demo-caminhao">
        <rect x="14" y="40" width="40" height="16" rx="3" />
        <rect x="46" y="32" width="16" height="24" rx="3" />
        <circle cx="24" cy="57" r="4" />
        <circle cx="54" cy="57" r="4" />
      </g>
      {/* botão de confirmar, que pulsa na hora certa */}
      <g className="demo-botao">
        <rect x="90" y="72" width="54" height="14" rx="7" />
      </g>
    </svg>
  )
}
