import type { LoaderContext } from '@rspack/core';
import { describe, expect, it } from 'vitest';
import devClientGuardLoader from './dev-client-guard.loader';

describe('devClientGuardLoader', () => {
  it.each([
    [
      '?protocol=ws%3A&port=4200',
      '/dev-server/client/index.js?protocol=ws%3A&port=4200&ngrs-window-only',
    ],
    ['', '/dev-server/client/index.js?ngrs-window-only'],
  ])(
    'runs the dev-server entry with the query %j only where a document exists',
    (resourceQuery, request) => {
      const code = devClientGuardLoader.call({
        resourcePath: '/dev-server/client/index.js',
        resourceQuery,
      } as LoaderContext);
      const run = (document: unknown) => {
        const required: string[] = [];
        new Function('require', 'document', code)(
          (request: string) => required.push(request),
          document
        );
        return required;
      };

      expect(run(undefined)).toEqual([]);
      expect(run({})).toEqual([request]);
    }
  );
});
