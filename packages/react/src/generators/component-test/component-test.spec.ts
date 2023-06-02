import { assertMinimumCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import libraryGenerator from '../library/library';
import { componentTestGenerator } from './component-test';

jest.mock('@nx/cypress/src/utils/cypress-version');
describe(componentTestGenerator.name, () => {
  let tree: Tree;
  let mockedAssertMinimumCypressVersion: jest.Mock<
    ReturnType<typeof assertMinimumCypressVersion>
  > = assertMinimumCypressVersion as never;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });
  it('should create component test for tsx files', async () => {
    mockedAssertMinimumCypressVersion.mockReturnValue();
    await libraryGenerator(tree, {
      linter: Linter.EsLint,
      name: 'some-lib',
      skipFormat: true,
      skipTsConfig: false,
      style: 'scss',
      unitTestRunner: 'none',
      component: true,
    });

    await componentTestGenerator(tree, {
      project: 'some-lib',
      componentPath: 'lib/some-lib.tsx',
    });

    expect(tree.exists('libs/some-lib/src/lib/some-lib.cy.tsx')).toBeTruthy();
  });

  it('should create component test for js files', async () => {
    mockedAssertMinimumCypressVersion.mockReturnValue();
    await libraryGenerator(tree, {
      linter: Linter.EsLint,
      name: 'some-lib',
      skipFormat: true,
      skipTsConfig: false,
      style: 'scss',
      unitTestRunner: 'none',
      component: true,
      js: true,
    });

    await componentTestGenerator(tree, {
      project: 'some-lib',
      componentPath: 'lib/some-lib.js',
    });

    expect(tree.exists('libs/some-lib/src/lib/some-lib.cy.js')).toBeTruthy();
  });

  it('should not overwrite exising component test', async () => {
    mockedAssertMinimumCypressVersion.mockReturnValue();
    await libraryGenerator(tree, {
      linter: Linter.EsLint,
      name: 'some-lib',
      skipFormat: true,
      skipTsConfig: false,
      style: 'scss',
      unitTestRunner: 'none',
      component: true,
    });
    tree.write('libs/some-lib/src/lib/some-lib.cy.tsx', 'existing content');
    await componentTestGenerator(tree, {
      project: 'some-lib',
      componentPath: 'lib/some-lib.tsx',
    });

    expect(tree.read('libs/some-lib/src/lib/some-lib.cy.tsx', 'utf-8')).toEqual(
      'existing content'
    );
  });

  it('should not throw if path is invalid', async () => {
    mockedAssertMinimumCypressVersion.mockReturnValue();
    await libraryGenerator(tree, {
      linter: Linter.EsLint,
      name: 'some-lib',
      skipFormat: true,
      skipTsConfig: false,
      style: 'scss',
      unitTestRunner: 'none',
      component: true,
    });

    await expect(
      componentTestGenerator(tree, {
        project: 'some-lib',
        componentPath: 'lib/blah/abc-123.blah',
      })
    ).resolves.not.toThrow();
  });

  it('should handle being provided the full path to the component', async () => {
    mockedAssertMinimumCypressVersion.mockReturnValue();
    await libraryGenerator(tree, {
      linter: Linter.EsLint,
      name: 'some-lib',
      skipFormat: true,
      skipTsConfig: false,
      style: 'scss',
      unitTestRunner: 'none',
      component: true,
    });

    await componentTestGenerator(tree, {
      project: 'some-lib',
      componentPath: 'libs/some-lib/src/lib/some-lib.tsx',
    });

    expect(tree.exists('libs/some-lib/src/lib/some-lib.cy.tsx')).toBeTruthy();
  });

  describe('multiple components per file', () => {
    it('should handle props', async () => {
      mockedAssertMinimumCypressVersion.mockReturnValue();
      await libraryGenerator(tree, {
        linter: Linter.EsLint,
        name: 'some-lib',
        skipFormat: true,
        skipTsConfig: false,
        style: 'scss',
        unitTestRunner: 'none',
        component: true,
      });

      tree.write(
        'libs/some-lib/src/lib/some-lib.tsx',
        `
${tree.read('libs/some-lib/src/lib/some-lib.tsx')}

/* eslint-disable-next-line */
export interface AnotherCmpProps {
  handleClick: () => void;
  text: string;
  count: number;
  isOkay: boolean;
}

export function AnotherCmp(props: AnotherCmpProps) {
 return <button onClick='{handleClick}'>{props.text}</button>;
}
`
      );
      await componentTestGenerator(tree, {
        project: 'some-lib',
        componentPath: 'libs/some-lib/src/lib/some-lib.tsx',
      });

      expect(tree.exists('libs/some-lib/src/lib/some-lib.cy.tsx')).toBeTruthy();
      expect(
        tree.read('libs/some-lib/src/lib/some-lib.cy.tsx', 'utf-8')
      ).toMatchSnapshot();
    });
    it('should handle no props', async () => {
      mockedAssertMinimumCypressVersion.mockReturnValue();
      await libraryGenerator(tree, {
        linter: Linter.EsLint,
        name: 'some-lib',
        skipFormat: true,
        skipTsConfig: false,
        style: 'scss',
        unitTestRunner: 'none',
        component: true,
      });

      tree.write(
        'libs/some-lib/src/lib/some-lib.tsx',
        `
${tree.read('libs/some-lib/src/lib/some-lib.tsx')}

export function AnotherCmp() {
 return <button>AnotherCmp</button>;
}
`
      );
      await componentTestGenerator(tree, {
        project: 'some-lib',
        componentPath: 'libs/some-lib/src/lib/some-lib.tsx',
      });

      expect(tree.exists('libs/some-lib/src/lib/some-lib.cy.tsx')).toBeTruthy();
      expect(
        tree.read('libs/some-lib/src/lib/some-lib.cy.tsx', 'utf-8')
      ).toMatchSnapshot();
    });
    it('should handle default export', async () => {
      mockedAssertMinimumCypressVersion.mockReturnValue();
      await libraryGenerator(tree, {
        linter: Linter.EsLint,
        name: 'some-lib',
        skipFormat: true,
        skipTsConfig: false,
        style: 'scss',
        unitTestRunner: 'none',
        component: true,
      });

      tree.write(
        'libs/some-lib/src/lib/some-lib.tsx',
        `
/* eslint-disable-next-line */
export interface AnotherCmpProps {
  handleClick: () => void;
  text: string;
  count: number;
  isOkay: boolean;
}

export default function AnotherCmp(props: AnotherCmpProps) {
 return <button onClick='{handleClick}'>{props.text}</button>;
}

export function AnotherCmp2() {
 return <button>AnotherCmp</button>;
}
`
      );
      await componentTestGenerator(tree, {
        project: 'some-lib',
        componentPath: 'libs/some-lib/src/lib/some-lib.tsx',
      });

      expect(tree.exists('libs/some-lib/src/lib/some-lib.cy.tsx')).toBeTruthy();
      expect(
        tree.read('libs/some-lib/src/lib/some-lib.cy.tsx', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should handle named exports', async () => {
      mockedAssertMinimumCypressVersion.mockReturnValue();
      await libraryGenerator(tree, {
        linter: Linter.EsLint,
        name: 'some-lib',
        skipFormat: true,
        skipTsConfig: false,
        style: 'scss',
        unitTestRunner: 'none',
        component: true,
      });

      tree.write(
        'libs/some-lib/src/lib/some-lib.tsx',
        `
/* eslint-disable-next-line */
export interface AnotherCmpProps {
  handleClick: () => void;
  text: string;
  count: number;
  isOkay: boolean;
}

export function AnotherCmp(props: AnotherCmpProps) {
 return <button onClick='{handleClick}'>{props.text}</button>;
}

export function AnotherCmp2() {
 return <button>AnotherCmp2</button>;
}
`
      );
      await componentTestGenerator(tree, {
        project: 'some-lib',
        componentPath: 'libs/some-lib/src/lib/some-lib.tsx',
      });

      expect(tree.exists('libs/some-lib/src/lib/some-lib.cy.tsx')).toBeTruthy();
      expect(
        tree.read('libs/some-lib/src/lib/some-lib.cy.tsx', 'utf-8')
      ).toMatchSnapshot();
    });
  });

  describe('single component per file', () => {
    it('should handle props', async () => {
      mockedAssertMinimumCypressVersion.mockReturnValue();
      await libraryGenerator(tree, {
        linter: Linter.EsLint,
        name: 'some-lib',
        skipFormat: true,
        skipTsConfig: false,
        style: 'scss',
        unitTestRunner: 'none',
        component: true,
      });

      tree.write(
        'libs/some-lib/src/lib/some-lib.tsx',
        `
/* eslint-disable-next-line */
export interface AnotherCmpProps {
  handleClick: () => void;
  text: string;
  count: number;
  isOkay: boolean;
}

export function AnotherCmp(props: AnotherCmpProps) {
 return <button onClick='{handleClick}'>{props.text}</button>;
}
`
      );
      await componentTestGenerator(tree, {
        project: 'some-lib',
        componentPath: 'libs/some-lib/src/lib/some-lib.tsx',
      });

      expect(tree.exists('libs/some-lib/src/lib/some-lib.cy.tsx')).toBeTruthy();
      expect(
        tree.read('libs/some-lib/src/lib/some-lib.cy.tsx', 'utf-8')
      ).toMatchSnapshot();
    });
    it('should handle no props', async () => {
      // this is the default behavior of the library component generator
      mockedAssertMinimumCypressVersion.mockReturnValue();
      await libraryGenerator(tree, {
        linter: Linter.EsLint,
        name: 'some-lib',
        skipFormat: true,
        skipTsConfig: false,
        style: 'scss',
        unitTestRunner: 'none',
        component: true,
      });
      await componentTestGenerator(tree, {
        project: 'some-lib',
        componentPath: 'libs/some-lib/src/lib/some-lib.tsx',
      });

      expect(tree.exists('libs/some-lib/src/lib/some-lib.cy.tsx')).toBeTruthy();
      expect(
        tree.read('libs/some-lib/src/lib/some-lib.cy.tsx', 'utf-8')
      ).toMatchSnapshot();
    });
    it('should handle default export', async () => {
      mockedAssertMinimumCypressVersion.mockReturnValue();
      await libraryGenerator(tree, {
        linter: Linter.EsLint,
        name: 'some-lib',
        skipFormat: true,
        skipTsConfig: false,
        style: 'scss',
        unitTestRunner: 'none',
        component: true,
      });

      tree.write(
        'libs/some-lib/src/lib/some-lib.tsx',
        `
/* eslint-disable-next-line */
export interface AnotherCmpProps {
  handleClick: () => void;
  text: string;
  count: number;
  isOkay: boolean;
}

export default function AnotherCmp(props: AnotherCmpProps) {
 return <button onClick='{handleClick}'>{props.text}</button>;
}
`
      );
      await componentTestGenerator(tree, {
        project: 'some-lib',
        componentPath: 'libs/some-lib/src/lib/some-lib.tsx',
      });

      expect(tree.exists('libs/some-lib/src/lib/some-lib.cy.tsx')).toBeTruthy();
      expect(
        tree.read('libs/some-lib/src/lib/some-lib.cy.tsx', 'utf-8')
      ).toMatchSnapshot();
    });
    it('should handle named exports', async () => {
      mockedAssertMinimumCypressVersion.mockReturnValue();
      await libraryGenerator(tree, {
        linter: Linter.EsLint,
        name: 'some-lib',
        skipFormat: true,
        skipTsConfig: false,
        style: 'scss',
        unitTestRunner: 'none',
        component: true,
      });

      tree.write(
        'libs/some-lib/src/lib/some-lib.tsx',
        `
/* eslint-disable-next-line */
export interface AnotherCmpProps {
  handleClick: () => void;
  text: string;
  count: number;
  isOkay: boolean;
}

export function AnotherCmp(props: AnotherCmpProps) {
 return <button onClick='{handleClick}'>{props.text}</button>;
}
`
      );
      await componentTestGenerator(tree, {
        project: 'some-lib',
        componentPath: 'libs/some-lib/src/lib/some-lib.tsx',
      });

      expect(tree.exists('libs/some-lib/src/lib/some-lib.cy.tsx')).toBeTruthy();
      expect(
        tree.read('libs/some-lib/src/lib/some-lib.cy.tsx', 'utf-8')
      ).toMatchSnapshot();
    });
  });
});
