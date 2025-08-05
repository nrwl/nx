import { beforeEach, describe, expect } from 'vitest';
import { createCompilerHost, createProgram, SourceFile } from 'typescript';
import {
  augmentHostWithResources,
  augmentProgramWithVersioning,
} from './augments.ts';

describe('augmentHostWithResources', () => {
  const transform = (code: string) => code.replace('scss', 'css');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add have working readResource method on augmented host', async () => {
    const host = createCompilerHost({});

    expect(() => augmentHostWithResources(host, transform, {})).not.toThrow();

    await expect(
      host.readResource('./mocks/fixtures/integration/minimal/src/mock.main.ts')
    ).resolves.toMatchInlineSnapshot(`
      "export const random = 42;
      "
    `);
  });

  it('should add have working transformResource method on augmented host', async () => {
    const host = createCompilerHost({});

    expect(() =>
      augmentHostWithResources(host, transform, {
        inlineStylesExtension: 'scss',
      })
    ).not.toThrow();

    await expect(
      host.transformResource(
        './mocks/fixtures/integration/minimal/src/styles.scss',
        {
          type: 'style',
          containingFile: './any/path/app.component.ts',
        }
      )
    ).resolves.toMatchInlineSnapshot(`
      {
        "content": "./mocks/fixtures/integration/minimal/src/styles.css",
      }
    `);
  });
});

describe('augmentProgramWithVersioning', () => {
  it('should add version property to all files', () => {
    const program = createProgram({
      rootNames: ['./mocks/fixtures/integration/minimal/src/mock.main.ts'],
      options: {},
    });

    expect(() => augmentProgramWithVersioning(program)).not.toThrow();

    const files = program.getSourceFiles();
    const main: SourceFile = files.find((file) =>
      file.fileName.includes('mock.main.ts')
    ) as SourceFile;
    expect(main).toBeDefined();
    expect(main.fileName).toBe(
      'mocks/fixtures/integration/minimal/src/mock.main.ts'
    );
    expect(main.version).toBe(
      '4336b1a02d94276a38768bc7c04e6e97380eb931f91695a3a0fe5ad5fb3907b4'
    );
  });
});
