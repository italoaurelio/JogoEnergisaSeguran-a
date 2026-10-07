/**
 * Ícones das peças da arara, em SVG inline.
 *
 * Por que desenhados e não emoji nem arquivo: emoji entrega a aparência ao
 * sistema operacional (o capacete do Windows não é o do mac, e nenhum dos dois
 * é EPI de eletricista), e um pacote de ícones traria licença para rastrear
 * num jogo que vai virar .exe offline. São doze formas, de 2 a 4 traços cada,
 * em `currentColor` — herdam a cor do estado do botão sem CSS extra.
 *
 * A variante importa mais que o desenho: o jogador tem de distinguir capacete
 * COM jugular de capacete sem, luva com cobertura de luva sozinha. É nisso que
 * está a resposta da fase, então é isso que o traço mostra.
 */

const COMUM = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** Casco + aba. `jugular` desenha a tira de queixo de três pontos. */
function Capacete({ jugular }: { jugular?: boolean }) {
  return (
    <svg {...COMUM}>
      <path d="M5 14a7 7 0 0 1 14 0" />
      <path d="M3 14h18" />
      <path d="M12 7v7" />
      {jugular && <path d="M7 14.5 9.5 19h5L17 14.5" />}
      {jugular && <path d="M9.5 19h5" />}
    </svg>
  )
}

function Bone() {
  return (
    <svg {...COMUM}>
      <path d="M6 14a6 6 0 0 1 12 0" />
      <path d="M18 14h3.5" />
      <path d="M6 14h12" />
    </svg>
  )
}

function ProtetorFacial() {
  return (
    <svg {...COMUM}>
      <path d="M6 8a6 6 0 0 1 12 0" />
      <path d="M4.5 8h15" />
      <path d="M5.5 9c0 6 2.5 9.5 6.5 9.5S18.5 15 18.5 9" />
    </svg>
  )
}

function Oculos({ escuro }: { escuro?: boolean }) {
  return (
    <svg {...COMUM}>
      <circle cx="7" cy="13" r="3.4" fill={escuro ? 'currentColor' : 'none'} />
      <circle cx="17" cy="13" r="3.4" fill={escuro ? 'currentColor' : 'none'} />
      <path d="M10.4 13h3.2" />
      <path d="M3.6 11.5 2 10M20.4 11.5 22 10" />
    </svg>
  )
}

/** Camisa de manga longa. `faixa` é a retrorrefletiva do antichama. */
function Camisa({ faixa }: { faixa?: boolean }) {
  return (
    <svg {...COMUM}>
      <path d="M9 3.5 12 6l3-2.5 4.5 2.2-1.3 4.3-2 -0.6V20.5h-8.4V9.4l-2 .6L4.5 5.7Z" />
      {faixa && <path d="M6.8 14.6h10.4" />}
    </svg>
  )
}

function Colete() {
  return (
    <svg {...COMUM}>
      <path d="M8.5 3.5 12 7l3.5-3.5 3.2 2.1V20.5h-13.4V5.6Z" />
      <path d="M12 7v13.5" />
      <path d="M5.3 13h4.2M14.5 13h4.2" />
    </svg>
  )
}

/** Luva. `cobertura` desenha a segunda camada de raspa sobre a borracha. */
function Luva({ cobertura, etiqueta }: { cobertura?: boolean; etiqueta?: boolean }) {
  return (
    <svg {...COMUM}>
      <path d="M8 20.5V12l-1.6-2.3a1.4 1.4 0 0 1 2.2-1.7L10 9.4V4.2a1.2 1.2 0 0 1 2.4 0v4.6M12.4 8.8V4.6a1.2 1.2 0 0 1 2.4 0v4.4M14.8 9V6.2a1.2 1.2 0 0 1 2.4 0v8.2c0 3.6-1.4 6.1-3.4 6.1H8" />
      {cobertura && <path d="M6.6 16.5h11.2" />}
      {etiqueta && <rect x="4.2" y="17.6" width="3.2" height="2.4" rx="0.5" fill="currentColor" />}
    </svg>
  )
}

/** Botina. `biqueira` marca a ponteira de aço; `isolante` marca o solado. */
function Botina({ biqueira, isolante }: { biqueira?: boolean; isolante?: boolean }) {
  return (
    <svg {...COMUM}>
      <path d="M7 3.5h4.2v9.2l7.3 3.4a2 2 0 0 1 1.1 1.8v2.6H7Z" />
      <path d="M7 8.2h4.2" />
      {biqueira && <path d="M19.4 15.6a3.2 3.2 0 0 0-3.1 2.2" />}
      {isolante && <path d="M7 18.2h12.6" />}
    </svg>
  )
}

function Tenis() {
  return (
    <svg {...COMUM}>
      <path d="M3.5 11.5h4l3 3 6.8 1.6a3 3 0 0 1 2.2 2.9v1.5H3.5Z" />
      <path d="M3.5 17.8h16" />
      <path d="M8 12.6 9.6 11M10.4 14 12 12.4" />
    </svg>
  )
}

/** Cinturão paraquedista: tirantes de ombro + perneiras. */
function Paraquedista() {
  return (
    <svg {...COMUM}>
      <path d="M8 3.5 12 11l4-7.5" />
      <path d="M5.5 11.5h13" />
      <path d="M12 11v3" />
      <path d="M9 14.5 7.5 20.5M15 14.5 16.5 20.5" />
      <circle cx="12" cy="12.6" r="1.3" />
    </svg>
  )
}

/** Cinto só de cintura: a armadilha do item 5 do briefing. */
function CintoAbdominal() {
  return (
    <svg {...COMUM}>
      <path d="M3 9.5h18v5H3Z" />
      <rect x="10" y="8.2" width="4" height="7.6" rx="0.8" />
    </svg>
  )
}

function Adorno() {
  return (
    <svg {...COMUM}>
      <circle cx="7.5" cy="14" r="3.6" />
      <circle cx="16.8" cy="12.6" r="3.4" />
      <path d="M14.8 9.6 14.2 7h5.2l-.6 2.6M14.8 15.6l-.6 2.6h5.2l-.6-2.6" />
    </svg>
  )
}

/** Armário fechado: a escolha certa em "objetos pessoais" é não levar nada. */
function Armario() {
  return (
    <svg {...COMUM}>
      <rect x="5" y="3.5" width="14" height="17" rx="1.2" />
      <path d="M12 3.5v17" />
      <path d="M9.8 12h.01M14.2 12h.01" strokeWidth={2.4} />
    </svg>
  )
}

const MAPA: Record<string, React.ReactElement> = {
  capacete_b: <Capacete jugular />,
  capacete_a: <Capacete />,
  bone: <Bone />,
  protetor_facial_arco: <ProtetorFacial />,
  oculos_incolor: <Oculos />,
  oculos_escuro: <Oculos escuro />,
  vestimenta_fr: <Camisa faixa />,
  camisa_algodao: <Camisa />,
  colete_refletivo: <Colete />,
  luva_isolante_cobertura: <Luva cobertura />,
  luva_isolante_so: <Luva />,
  luva_isolante_vencida: <Luva etiqueta />,
  luva_vaqueta: <Luva cobertura />,
  botina_isolante: <Botina isolante />,
  botina_biqueira: <Botina biqueira />,
  tenis: <Tenis />,
  paraquedista_talabarte: <Paraquedista />,
  cinto_abdominal: <CintoAbdominal />,
  'aliança_relogio': <Adorno />,
  nada_no_corpo: <Armario />,
}

export function IconePeca({ id }: { id: string }) {
  return MAPA[id] ?? <Armario />
}
