/**
 * Fonte unica dos tokens visuais do SGP.
 *
 * Consumido pelo aplicativo mobile (React Native) por este arquivo e espelhado em
 * variaveis CSS em ./tokens.css. Qualquer alteracao precisa ser feita nos dois.
 *
 * A web **nao** consome este pacote: o tema dela vive em
 * `apps/web/src/styles/global.css`, em OKLCH. Estes valores sao a conversao daquele
 * tema para hex, porque `StyleSheet` do React Native nao aceita `oklch()`. Enquanto os
 * dois existirem, os papeis abaixo tem que continuar batendo com o design system web
 * (docs/design/design-system-web.md).
 *
 * Os nomes dos papeis de cor seguem os da web (`background`, `field`, `card`...), e nao
 * uma traducao. Traduzir criaria armadilha: "field" e o campo de trabalho da moldura, e
 * "campo" em portugues seria lido como campo de formulario. Manter o mesmo nome deixa a
 * correspondencia entre os dois arquivos conferivel linha a linha.
 */

/** Papeis de cor do tema claro, que e o canonico na N1 (a web nao expoe alternancia). */
export const cores = {
  /** Margem externa: barra superior e espaco branco em volta da moldura. */
  background: '#FFFFFF',
  foreground: '#18141A',

  /** Campo de trabalho: a moldura cinza sobre a qual o conteudo flutua. */
  field: '#F6F4F6',

  /** Objeto elevado: linha de lista, painel, estado vazio. */
  card: '#FFFFFF',
  cardForeground: '#18141A',

  /** Sobreposicao: modal, menu, tooltip. */
  popover: '#FFFFFF',
  popoverForeground: '#18141A',

  /** Acao principal, indicador ativo e foco. Aubergine da referencia. */
  primary: '#352D39',
  primaryForeground: '#FAFAFA',

  /** Selecao discreta: hover, recorte ativo, icone auxiliar. */
  secondary: '#F4F3F5',
  secondaryForeground: '#242026',
  accent: '#F1EFF2',
  accentForeground: '#242026',

  /** Texto de apoio: data, contagem, descricao, ajuda. */
  muted: '#F4F3F5',
  mutedForeground: '#666168',

  /** Remocao e erro. Nunca acao comum. */
  destructive: '#B7191C',
  destructiveForeground: '#FAFAFA',

  border: '#DFDDE0',
  input: '#DFDDE0',
  ring: '#54475A',

  /** Papel da prova: branco nos dois temas, por isso nao inverte. */
  sheet: '#FFFFFF',
  sheetForeground: '#0D0D0D',
  sheetBorder: '#E0DDDD',
} as const;

export const espacamento = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Raios derivados do `--radius: 0.625rem` (10 px) da web.
 *
 * `md` e o raio base (campo e botao, `rounded-lg` na web), `lg` acompanha o
 * `rounded-xl` de painel e cartao.
 */
export const raio = {
  sm: 6,
  md: 10,
  lg: 12,
  pill: 999,
} as const;

/**
 * Tipografia.
 *
 * **Limitacao conhecida**: o `familia` abaixo e uma declaracao de intencao, nao uma
 * fonte carregada. A web usa Instrument Sans Variable pelo pacote
 * `@fontsource-variable/instrument-sans`, que distribui **somente `.woff2`** — formato
 * que o React Native nao carrega (ele precisa de `.ttf` ou `.otf`). Ate alguem versionar
 * o arquivo `.ttf` no repositorio e registra-lo com `expo-font`, o aplicativo cai no
 * `system-ui` de cada plataforma, e o nome aqui so vale no build web.
 *
 * Isso e uma divergencia visual real entre web e mobile, nao um detalhe: esta anotada
 * em docs/design/design-system-mobile.md para nao ser descoberta de novo.
 */
export const tipografia = {
  familia: "'Instrument Sans', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
  tamanho: {
    xs: 12,
    sm: 13,
    md: 14,
    lg: 18,
    xl: 22,
    xxl: 28,
  },
  /**
   * Peso 500 domina a hierarquia, como na web. `forte` fica para numero de questao,
   * total e gabarito — nao para titulo comum.
   */
  peso: {
    regular: '400',
    medio: '500',
    forte: '600',
  },
} as const;

export const sombra = {
  cartao: '0 1px 2px rgba(24, 20, 26, 0.06), 0 2px 8px rgba(24, 20, 26, 0.06)',
} as const;

export const tokens = { cores, espacamento, raio, tipografia, sombra } as const;

export type Tokens = typeof tokens;
