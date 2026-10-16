import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'src/generated'] },
  ...tseslint.configs.recommended,
  prettier,
);
