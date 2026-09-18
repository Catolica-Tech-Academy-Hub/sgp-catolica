/**
 * Primitivos de interface do aplicativo.
 *
 * Equivalem ao `apps/web/src/components/ui` (shadcn-vue) e existem pelo mesmo motivo:
 * nenhuma tela deve montar botao, cartao ou campo a mao. Aqui eles sao escritos em
 * `StyleSheet` sobre `@sgp/design-tokens` — nao ha shadcn para React Native, e a decisao
 * de adotar NativeWind/Tailwind no mobile nao foi tomada.
 */
export { Badge, type VarianteDoBadge } from './Badge';
export { Botao, type VarianteDoBotao } from './Botao';
export { Campo } from './Campo';
export { Cartao } from './Cartao';
export { Rotulo } from './Rotulo';
export { Tela } from './Tela';
