import { describe, expect, it, vi } from 'vitest';
import * as ts from 'typescript';

vi.mock('typescript', async (importOriginal) => {
  const actual = await importOriginal<typeof import('typescript')>();
  return { ...actual, createSourceFile: vi.fn(actual.createSourceFile) };
});

import {
  getStyleUrls,
  getTemplateUrls,
  StyleUrlsResolver,
  TemplateUrlsResolver,
} from './component-resolvers';

describe('getStyleUrls', () => {
  it('should include values form styleUrl', () => {
    const styleUrl = 'button.component.scss';
    const code = `
      @Component({
        styleUrl: '${styleUrl}',
      })
      export class ButtonComponent {}
      `;
    expect(getStyleUrls(code)).toStrictEqual([styleUrl]);
  });

  it('should include values form styleUrls', () => {
    const styleUrls = ['color.scss', 'button.component.scss'];
    const code = `
      @Component({
        styleUrls: [${styleUrls.map((v) => `'${v}'`).join(', ')}],
      })
      export class ButtonComponent {}
      `;
    expect(getStyleUrls(code)).toStrictEqual(styleUrls);
  });

  it('should include values form styleUrl and styleUrls', () => {
    const styleUrl = 'theme.scss';
    const styleUrls = ['color.scss', 'button.component.scss'];
    const code = `
      @Component({
        styleUrl: '${styleUrl}',
        styleUrls: [${styleUrls.map((v) => `'${v}'`).join(', ')}],
      })
      export class ButtonComponent {}
      `;
    expect(getStyleUrls(code)).toStrictEqual([...styleUrls, styleUrl]);
  });

  it('should return empty array if no styles are present in the component', () => {
    const code = `
      @Component({})
      export class ButtonComponent {}
      `;
    expect(getStyleUrls(code)).toStrictEqual([]);
  });

  // Angular's own resolver only reads array literals, so nothing else is
  // treated as a list of style URLs.
  it.each([
    ['an identifier', 'SHARED_STYLES'],
    ['a conditional', `isDark ? ['dark.scss'] : ['light.scss']`],
    ['a call expression', 'getSharedStyles()'],
    ['a property access', 'CONFIG.styles'],
    ['a const assertion', `['color.scss'] as const`],
    ['a satisfies expression', `['color.scss'] satisfies string[]`],
    ['a string literal', `'color.scss'`],
    ['a method call on an array', `[...SHARED_STYLES].concat('color.scss')`],
  ])(
    'should return empty array when styleUrls is %s',
    (_description, initializer) => {
      const code = `
      @Component({
        styleUrls: ${initializer},
      })
      export class ButtonComponent {}
      `;
      expect(() => getStyleUrls(code)).not.toThrow();
      expect(getStyleUrls(code)).toStrictEqual([]);
    }
  );

  it.each([
    ['single-quoted', `'styleUrls'`],
    ['double-quoted', `"styleUrls"`],
  ])('should include values from a %s styleUrls key', (_description, key) => {
    const code = `
      @Component({
        ${key}: ['color.scss'],
      })
      export class ButtonComponent {}
      `;
    expect(getStyleUrls(code)).toStrictEqual(['color.scss']);
  });

  it('should include values from a quoted styleUrl key', () => {
    const code = `
      @Component({
        'styleUrl': 'theme.scss',
      })
      export class ButtonComponent {}
      `;
    expect(getStyleUrls(code)).toStrictEqual(['theme.scss']);
  });

  it('should ignore a computed styleUrls key', () => {
    const code = `
      @Component({
        ['styleUrls']: ['color.scss'],
      })
      export class ButtonComponent {}
      `;
    expect(getStyleUrls(code)).toStrictEqual([]);
  });

  it.each([
    ['a non-literal element', `[SHARED, 'color.scss']`],
    ['an empty element', `['', 'color.scss']`],
    ['a spread element', `[...SHARED, 'color.scss']`],
    ['a substituted template literal', '[`./${theme}.scss`, `color.scss`]'],
  ])('should skip %s in styleUrls', (_description, initializer) => {
    const code = `
      @Component({
        styleUrls: ${initializer},
      })
      export class ButtonComponent {}
      `;
    expect(getStyleUrls(code)).toStrictEqual(['color.scss']);
  });

  it.each([
    ['an identifier', 'SHARED_STYLE'],
    ['an empty string', `''`],
    ['a substituted template literal', '`./${theme}.scss`'],
  ])('should ignore styleUrl when it is %s', (_description, initializer) => {
    const code = `
      @Component({
        styleUrl: ${initializer},
      })
      export class ButtonComponent {}
      `;
    expect(getStyleUrls(code)).toStrictEqual([]);
  });

  it('should keep quotes that are part of the file name', () => {
    const code = `
      @Component({
        styleUrl: "d'accord.scss",
      })
      export class ButtonComponent {}
      `;
    expect(getStyleUrls(code)).toStrictEqual([`d'accord.scss`]);
  });

  it('should return a new array on every call', () => {
    const code = `
      @Component({
        styleUrls: ['color.scss'],
      })
      export class ButtonComponent {}
      `;
    getStyleUrls(code).push('mutated.scss');

    expect(getStyleUrls(code)).toStrictEqual(['color.scss']);
  });
});

describe('StyleUrlsResolver', () => {
  it('should return parse code and return styleUrlsPaths', () => {
    const resolver = new StyleUrlsResolver();
    // @ts-expect-error: Accessing private property for testing
    const spyGet = vi.spyOn(resolver.styleUrlsCache, 'get');
    // @ts-expect-error: Accessing private property for testing
    const spySet = vi.spyOn(resolver.styleUrlsCache, 'set');
    const code = `
      @Component({
        styleUrl: 'theme.scss',
        styleUrls: ['color.scss', 'button.component.scss'],
      })
      export class ButtonComponent {}
      `;
    const id = 'button.component.ts';

    expect(resolver.resolve(code, id)).toStrictEqual([
      expect.stringMatching(/^(color.scss)\|.*\1$/),
      expect.stringMatching(/^(button.component.scss)\|.*\1$/),
      expect.stringMatching(/^(theme.scss)\|.*\1$/),
    ]);
    expect(spyGet).toHaveBeenCalledTimes(1);
    expect(spySet).toHaveBeenCalledTimes(1);
  });

  it('should return styleUrlsPaths from cache if the code is the same', () => {
    const resolver = new StyleUrlsResolver();
    // @ts-expect-error: Accessing private property for testing
    const spyGet = vi.spyOn(resolver.styleUrlsCache, 'get');
    // @ts-expect-error: Accessing private property for testing
    const spySet = vi.spyOn(resolver.styleUrlsCache, 'set');
    const code = `
      @Component({
        styleUrl: 'theme.scss',
        styleUrls: ['color.scss', 'button.component.scss'],
      })
      export class ButtonComponent {}
      `;
    const id = 'button.component.ts';

    expect(() => resolver.resolve(code, id)).not.toThrow();
    expect(() => resolver.resolve(code, id)).not.toThrow();
    expect(spyGet).toHaveBeenCalledTimes(2);
    expect(spySet).toHaveBeenCalledTimes(1);
  });
});

describe('getTemplateUrls', () => {
  it('should include values form templateUrl', () => {
    const templateUrl = 'button.component.html';
    const code = `
      @Component({
        templateUrl: '${templateUrl}',
      })
      export class ButtonComponent {}
      `;
    expect(getTemplateUrls(code)).toStrictEqual([templateUrl]);
  });

  it('should return empty array if no template is present in the component', () => {
    const code = `
      @Component({})
      export class ButtonComponent {}
      `;
    expect(getTemplateUrls(code)).toStrictEqual([]);
  });

  it.each([
    ['an identifier', 'TEMPLATE'],
    ['an empty string', `''`],
    ['a substituted template literal', '`./${name}.html`'],
    ['a call expression', 'getTemplate()'],
  ])('should ignore templateUrl when it is %s', (_description, initializer) => {
    const code = `
      @Component({
        templateUrl: ${initializer},
      })
      export class ButtonComponent {}
      `;
    expect(getTemplateUrls(code)).toStrictEqual([]);
  });

  it('should read a templateUrl written as a template literal', () => {
    const code = `
      @Component({
        templateUrl: \`button.component.html\`,
      })
      export class ButtonComponent {}
      `;
    expect(getTemplateUrls(code)).toStrictEqual(['button.component.html']);
  });

  it('should include values from a quoted templateUrl key', () => {
    const code = `
      @Component({
        'templateUrl': 'button.component.html',
      })
      export class ButtonComponent {}
      `;
    expect(getTemplateUrls(code)).toStrictEqual(['button.component.html']);
  });
});

describe('shared parse', () => {
  it('should parse the code once when both resolvers read it', () => {
    // unique source so the memo cannot already hold it from an earlier test
    const code = `
      @Component({
        templateUrl: 'shared-parse.component.html',
        styleUrls: ['shared-parse.component.scss'],
      })
      export class SharedParseComponent {}
      `;
    vi.mocked(ts.createSourceFile).mockClear();

    getStyleUrls(code);
    getTemplateUrls(code);

    expect(ts.createSourceFile).toHaveBeenCalledTimes(1);
  });

  it('should give each resolver its own result for the same code', () => {
    const code = `
      @Component({
        templateUrl: 'button.component.html',
        styleUrls: ['color.scss'],
      })
      export class ButtonComponent {}
      `;

    expect(getStyleUrls(code)).toStrictEqual(['color.scss']);
    expect(getTemplateUrls(code)).toStrictEqual(['button.component.html']);
  });

  it('should return a new array from getTemplateUrls on every call', () => {
    const code = `
      @Component({
        templateUrl: 'button.component.html',
      })
      export class ButtonComponent {}
      `;
    getTemplateUrls(code).push('mutated.html');

    expect(getTemplateUrls(code)).toStrictEqual(['button.component.html']);
  });
});

describe('TemplateUrlsResolver', () => {
  it('should return parse code and return templateUrlPaths', () => {
    const resolver = new TemplateUrlsResolver();
    // @ts-expect-error: Accessing private property for testing
    const spyGet = vi.spyOn(resolver.templateUrlsCache, 'get');
    // @ts-expect-error: Accessing private property for testing
    const spySet = vi.spyOn(resolver.templateUrlsCache, 'set');

    const code = `
      @Component({
        templateUrl: 'button.component.html',
      })
      export class ButtonComponent {}
      `;
    const id = 'button.component.ts';
    expect(resolver.resolve(code, id)).toStrictEqual([
      expect.stringContaining('button.component.html'),
    ]);
    expect(spyGet).toHaveBeenCalledTimes(1);
    expect(spySet).toHaveBeenCalledTimes(1);
  });

  it('should return templateUrlPaths from cache if the code is the same', () => {
    const resolver = new TemplateUrlsResolver();
    // @ts-expect-error: Accessing private property for testing
    const spyGet = vi.spyOn(resolver.templateUrlsCache, 'get');
    // @ts-expect-error: Accessing private property for testing
    const spySet = vi.spyOn(resolver.templateUrlsCache, 'set');

    const code = `
      @Component({
        templateUrl: 'button.component.html',
      })
      export class ButtonComponent {}
      `;
    const id = '1';
    expect(resolver.resolve(code, id)).toStrictEqual([
      expect.stringContaining('button.component.html'),
    ]);
    expect(resolver.resolve(code, id)).toStrictEqual([
      expect.stringContaining('button.component.html'),
    ]);
    expect(spyGet).toHaveBeenCalledTimes(2);
    expect(spySet).toHaveBeenCalledTimes(1);
  });
});
