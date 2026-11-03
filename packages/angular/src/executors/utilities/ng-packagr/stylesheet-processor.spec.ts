import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPostcssConfiguration } from 'ng-packagr/src/lib/styles/postcss-configuration';
import { getNgPackagrVersionInfo } from './ng-packagr-version';
import { getStylesheetProcessor } from './stylesheet-processor';

vi.mock('./ng-packagr-version', () => ({ getNgPackagrVersionInfo: vi.fn() }));
vi.mock(
  'ng-packagr/src/lib/styles/postcss-configuration',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('ng-packagr/src/lib/styles/postcss-configuration')
      >();
    return {
      ...actual,
      loadPostcssConfiguration: vi.fn(actual.loadPostcssConfiguration),
    };
  }
);
// the real bundler starts esbuild; only the options it receives matter here
vi.mock('ng-packagr/src/lib/styles/component-stylesheets', () => ({
  ComponentStylesheetBundler: class {
    constructor(readonly options: { target: string[] }) {}
  },
}));

describe('getStylesheetProcessor', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-stylesheet-processor-'));
    vi.mocked(loadPostcssConfiguration).mockClear();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function createPackage(
    name: string,
    browsers: string,
    secondaryBrowsers: string
  ) {
    const root = join(tempDir, name);
    mkdirSync(join(root, 'secondary'), { recursive: true });
    writeFileSync(join(root, '.browserslistrc'), browsers);
    writeFileSync(
      join(root, 'secondary', '.browserslistrc'),
      secondaryBrowsers
    );
    return root;
  }

  it('should resolve the style config once per package in each build on ng-packagr >= 22.2', () => {
    vi.mocked(getNgPackagrVersionInfo).mockReturnValue({
      major: 22,
      version: '22.2.0',
    });
    const root = createPackage('lib', 'chrome 120', 'firefox 120');
    const otherRoot = createPackage('other-lib', 'chrome 110', 'firefox 120');
    const StylesheetProcessor = getStylesheetProcessor();

    const primary = new StylesheetProcessor(root, root);
    const secondary = new StylesheetProcessor(root, join(root, 'secondary'));
    const otherPrimary = new StylesheetProcessor(otherRoot, otherRoot);

    expect(primary.options.target).toEqual(['chrome120']);
    expect(secondary.options.target).toEqual(['chrome120']);
    expect(otherPrimary.options.target).toEqual(['chrome110']);
    expect(loadPostcssConfiguration).toHaveBeenCalledTimes(2);

    const NextBuildStylesheetProcessor = getStylesheetProcessor();
    new NextBuildStylesheetProcessor(root, root);

    expect(loadPostcssConfiguration).toHaveBeenCalledTimes(3);
  });

  it('should resolve the style config for each entry point on ng-packagr < 22.2', () => {
    vi.mocked(getNgPackagrVersionInfo).mockReturnValue({
      major: 22,
      version: '22.1.1',
    });
    const root = createPackage('lib', 'chrome 120', 'firefox 120');
    const StylesheetProcessor = getStylesheetProcessor();

    const primary = new StylesheetProcessor(root, root);
    const secondary = new StylesheetProcessor(root, join(root, 'secondary'));

    expect(primary.options.target).toEqual(['chrome120']);
    expect(secondary.options.target).toEqual(['firefox120']);
    expect(loadPostcssConfiguration).toHaveBeenCalledTimes(2);
  });
});
