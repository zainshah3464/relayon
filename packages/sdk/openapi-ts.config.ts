import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './openapi.json',
  output: {
    path: './src/generated',
    postProcess: ['prettier'],
  },
  plugins: [
    '@hey-api/typescript',
    '@hey-api/sdk',
  ],
});