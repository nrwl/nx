import { defineConfig } from 'cypress';

import { cypressBaseConfig } from './cypress.config.base';

export default defineConfig({
  e2e: {
    ...cypressBaseConfig,
    baseUrl: 'http://localhost:4204',
  },
});
