import { describe, expect, it, vi } from 'vitest';
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
