import { Tree, writeJson } from '@nx/devkit';
import * as reactAppConfig from './test-files/react-project.config.json';
import * as reactViteConfig from './test-files/react-vite-project.config.json';
import * as webAppConfig from './test-files/web-project.config.json';
import * as angularAppConfig from './test-files/angular-project.config.json';
import * as randomAppConfig from './test-files/unknown-project.config.json';
import * as mixedAppConfig from './test-files/react-mixed-project.config.json';
import * as reactLibNBJest from './test-files/react-lib-non-buildable-jest.json';
import * as reactLibNBVitest from './test-files/react-lib-non-buildable-vitest.json';

export function mockViteReactAppGenerator(tree: Tree): Tree {
  const appName = 'my-test-react-vite-app';

  tree.write(
    `apps/${appName}/src/main.tsx`,
    `import ReactDOM from 'react-dom';\n`
  );

  tree.write(
    `apps/${appName}/tsconfig.json`,
    `{
      "compilerOptions": {
        "jsx": "react-jsx",
        "allowJs": false,
        "esModuleInterop": false,
        "allowSyntheticDefaultImports": true,
        "strict": true,
        "types": ["vite/client"]
      },
      "files": [],
      "include": [],
      "references": [
        {
          "path": "./tsconfig.app.json"
        },
        {
          "path": "./tsconfig.spec.json"
        }
      ],
      "extends": "../../tsconfig.base.json"
      }
      `
  );
  tree.write(
    `apps/${appName}/tsconfig.app.json`,
    `{
      "extends": "./tsconfig.json",
      "compilerOptions": {
        "outDir": "../../dist/out-tsc",
        "types": ["node"]
      },
      "files": [
        "../../node_modules/@nx/react/typings/cssmodule.d.ts",
        "../../node_modules/@nx/react/typings/image.d.ts"
      ],
      "exclude": [
        "src/**/*.spec.ts",
        "src/**/*.test.ts",
        "src/**/*.spec.tsx",
        "src/**/*.test.tsx",
        "src/**/*.spec.js",
        "src/**/*.test.js",
        "src/**/*.spec.jsx",
        "src/**/*.test.jsx"
      ],
      "include": ["src/**/*.js", "src/**/*.jsx", "src/**/*.ts", "src/**/*.tsx"]
    }   
      `
  );

  tree.write(
    `apps/${appName}/index.html`,
    `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Rv1</title>
        <base href="/" />
    
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="stylesheet" href="/src/styles.css" />
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="/src/main.tsx"></script>
      </body>
    </html>`
  );

  tree.write(
    `apps/${appName}/vite.config.ts`,
    `    /// <reference types="vitest" />
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import tsconfigPaths from 'vite-tsconfig-paths';
    
    export default defineConfig({
      server: {
        port: 4200,
        host: 'localhost',
      },
      plugins: [
        react(),
        tsconfigPaths({
          root: '../../',
          projects: ['tsconfig.base.json'],
        }),
      ],
    
      test: {
        globals: true,
        cache: {
          dir: '../../node_modules/.vitest',
        },
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      },
    });
    `
  );

  writeJson(tree, 'workspace.json', {
    projects: {
      'my-test-react-vite-app': {
        ...reactViteConfig,
        root: `apps/${appName}`,
        projectType: 'application',
      },
    },
  });

  writeJson(tree, `apps/${appName}/project.json`, {
    ...reactViteConfig,
    root: `apps/${appName}`,
    projectType: 'application',
  });

  return tree;
}

export function mockReactAppGenerator(tree: Tree): Tree {
  const appName = 'my-test-react-app';

  tree.write(
    `apps/${appName}/src/main.tsx`,
    `import ReactDOM from 'react-dom';\n`
  );

  tree.write(
    `apps/${appName}/tsconfig.json`,
    `{
        "extends": "../../tsconfig.base.json",
        "compilerOptions": {
          "jsx": "react-jsx",
          "allowJs": true,
          "esModuleInterop": true,
          "allowSyntheticDefaultImports": true,
          "forceConsistentCasingInFileNames": true,
          "strict": true,
          "noImplicitOverride": true,
          "noPropertyAccessFromIndexSignature": true,
          "noImplicitReturns": true,
          "noFallthroughCasesInSwitch": true
        },
        "files": [],
        "include": [],
        "references": [
          {
            "path": "./tsconfig.app.json"
          },
          {
            "path": "./tsconfig.spec.json"
          }
        ]
      }
      `
  );
  tree.write(
    `apps/${appName}/tsconfig.app.json`,
    `{
      "extends": "./tsconfig.json",
      "compilerOptions": {
        "outDir": "../../dist/out-tsc"
      },
      "files": [
        "../../node_modules/@nx/react/typings/cssmodule.d.ts",
        "../../node_modules/@nx/react/typings/image.d.ts"
      ],
      "exclude": [
        "jest.config.ts",
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/*.spec.tsx",
        "**/*.test.tsx",
        "**/*.spec.js",
        "**/*.test.js",
        "**/*.spec.jsx",
        "**/*.test.jsx"
      ],
      "include": ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"]
    }   
      `
  );

  tree.write(
    `apps/${appName}/src/index.html`,
    `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>My Test React App</title>
        <base href="/" />
    
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/x-icon" href="favicon.ico" />
      </head>
      <body>
        <div id="root"></div>
      </body>
    </html>`
  );

  writeJson(tree, 'workspace.json', {
    projects: {
      'my-test-react-app': {
        ...reactAppConfig,
        root: `apps/${appName}`,
        projectType: 'application',
      },
    },
  });

  writeJson(tree, `apps/${appName}/project.json`, {
    ...reactAppConfig,
    root: `apps/${appName}`,
    projectType: 'application',
  });

  return tree;
}
export function mockReactMixedAppGenerator(tree: Tree): Tree {
  const appName = 'my-test-mixed-react-app';

  tree.write(
    `apps/${appName}/src/main.tsx`,
    `import ReactDOM from 'react-dom';\n`
  );

  tree.write(
    `apps/${appName}/tsconfig.json`,
    `{
        "extends": "../../tsconfig.base.json",
        "compilerOptions": {
          "jsx": "react-jsx",
          "allowJs": true,
          "esModuleInterop": true,
          "allowSyntheticDefaultImports": true,
          "forceConsistentCasingInFileNames": true,
          "strict": true,
          "noImplicitOverride": true,
          "noPropertyAccessFromIndexSignature": true,
          "noImplicitReturns": true,
          "noFallthroughCasesInSwitch": true
        },
        "files": [],
        "include": [],
        "references": [
          {
            "path": "./tsconfig.app.json"
          },
          {
            "path": "./tsconfig.spec.json"
          }
        ]
      }
      `
  );
  tree.write(
    `apps/${appName}/tsconfig.app.json`,
    `{
      "extends": "./tsconfig.json",
      "compilerOptions": {
        "outDir": "../../dist/out-tsc"
      },
      "files": [
        "../../node_modules/@nx/react/typings/cssmodule.d.ts",
        "../../node_modules/@nx/react/typings/image.d.ts"
      ],
      "exclude": [
        "jest.config.ts",
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/*.spec.tsx",
        "**/*.test.tsx",
        "**/*.spec.js",
        "**/*.test.js",
        "**/*.spec.jsx",
        "**/*.test.jsx"
      ],
      "include": ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"]
    }   
      `
  );

  tree.write(
    `apps/${appName}/src/index.html`,
    `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>My Test React App</title>
        <base href="/" />
    
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/x-icon" href="favicon.ico" />
      </head>
      <body>
        <div id="root"></div>
      </body>
    </html>`
  );

  writeJson(tree, 'workspace.json', {
    projects: {
      'my-test-mixed-react-app': {
        ...mixedAppConfig,
        root: `apps/${appName}`,
        projectType: 'application',
      },
    },
  });

  writeJson(tree, `apps/${appName}/project.json`, {
    ...mixedAppConfig,
    root: `apps/${appName}`,
    projectType: 'application',
  });

  return tree;
}

export function mockWebAppGenerator(tree: Tree): Tree {
  const appName = 'my-test-web-app';

  tree.write(`apps/${appName}/src/main.ts`, `import './app/app.element.ts';`);

  tree.write(
    `apps/${appName}/tsconfig.json`,
    `{
        "extends": "../../tsconfig.base.json",
        "files": [],
        "include": [],
        "references": [
          {
            "path": "./tsconfig.app.json"
          },
          {
            "path": "./tsconfig.spec.json"
          }
        ]
      }      
        `
  );

  tree.write(
    `apps/${appName}/src/index.html`,
    `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>WebappPure</title>
        <base href="/" />
    
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/x-icon" href="favicon.ico" />
      </head>
      <body>
        <workspace-root></workspace-root>
      </body>
    </html>
    `
  );

  writeJson(
    tree,
    'workspace.json',

    {
      projects: {
        'my-test-web-app': {
          ...webAppConfig,
          root: `apps/${appName}`,
          projectType: 'application',
        },
      },
    }
  );

  writeJson(tree, `apps/${appName}/project.json`, {
    ...webAppConfig,
    root: `apps/${appName}`,
    projectType: 'application',
  });
  return tree;
}

export function mockAngularAppGenerator(tree: Tree): Tree {
  const appName = 'my-test-angular-app';

  writeJson(tree, 'workspace.json', {
    projects: {
      'my-test-angular-app': {
        ...angularAppConfig,
        root: `apps/${appName}`,
        projectType: 'application',
      },
    },
  });

  writeJson(tree, `apps/${appName}/project.json`, {
    ...angularAppConfig,
    root: `apps/${appName}`,
    projectType: 'application',
  });

  return tree;
}

export function mockUnknownAppGenerator(tree: Tree): Tree {
  const appName = 'my-test-random-app';

  writeJson(tree, 'workspace.json', {
    projects: {
      'my-test-random-app': {
        ...randomAppConfig,
        root: `apps/${appName}`,
        projectType: 'application',
      },
    },
  });

  writeJson(tree, `apps/${appName}/project.json`, {
    ...randomAppConfig,
    root: `apps/${appName}`,
    projectType: 'application',
  });

  return tree;
}

export function mockReactLibNonBuildableJestTestRunnerGenerator(
  tree: Tree
): Tree {
  const libName = 'react-lib-nonb-jest';

  tree.write(`libs/${libName}/src/index.ts`, ``);

  tree.write(
    `libs/${libName}/tsconfig.json`,
    `{
      "compilerOptions": {
        "jsx": "react-jsx",
        "allowJs": false,
        "esModuleInterop": false,
        "allowSyntheticDefaultImports": true,
        "strict": true
      },
      "files": [],
      "include": [],
      "references": [
        {
          "path": "./tsconfig.lib.json"
        },
        {
          "path": "./tsconfig.spec.json"
        }
      ],
      "extends": "../../tsconfig.base.json"
    }`
  );
  tree.write(
    `libs/${libName}/tsconfig.lib.json`,
    `{
      "extends": "./tsconfig.json",
      "compilerOptions": {
        "outDir": "../../dist/out-tsc",
        "types": ["node"]
      },
      "files": [
        "../../node_modules/@nx/react/typings/cssmodule.d.ts",
        "../../node_modules/@nx/react/typings/image.d.ts"
      ],
      "exclude": [
        "jest.config.ts",
        "src/**/*.spec.ts",
        "src/**/*.test.ts",
        "src/**/*.spec.tsx",
        "src/**/*.test.tsx",
        "src/**/*.spec.js",
        "src/**/*.test.js",
        "src/**/*.spec.jsx",
        "src/**/*.test.jsx"
      ],
      "include": ["src/**/*.js", "src/**/*.jsx", "src/**/*.ts", "src/**/*.tsx"]
    }`
  );

  writeJson(tree, 'workspace.json', {
    projects: {
      [`${libName}`]: {
        ...reactLibNBJest,
        root: `libs/${libName}`,
        projectType: 'library',
      },
    },
  });

  writeJson(tree, `libs/${libName}/project.json`, {
    ...reactLibNBJest,
    root: `libs/${libName}`,
    projectType: 'library',
  });

  return tree;
}

export function mockReactLibNonBuildableVitestRunnerGenerator(
  tree: Tree
): Tree {
  const libName = 'react-lib-nonb-vitest';

  tree.write(`libs/${libName}/src/index.ts`, ``);

  tree.write(
    `libs/${libName}/vite.config.ts`,
    `/// <reference types="vitest" />
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import viteTsConfigPaths from 'vite-tsconfig-paths';

    export default defineConfig({

      plugins: [
        react(),
        viteTsConfigPaths({
          root: '../../',
        }),
      ],

      test: {
        globals: true,
        cache: {
          dir: '../../node_modules/.vitest',
        },
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      },
    });
  `
  );

  tree.write(
    `libs/${libName}/tsconfig.json`,
    `{
      "compilerOptions": {
        "jsx": "react-jsx",
        "allowJs": false,
        "esModuleInterop": false,
        "allowSyntheticDefaultImports": true,
        "strict": true
      },
      "files": [],
      "include": [],
      "references": [
        {
          "path": "./tsconfig.lib.json"
        },
        {
          "path": "./tsconfig.spec.json"
        }
      ],
      "extends": "../../tsconfig.base.json"
    }`
  );
  tree.write(
    `libs/${libName}/tsconfig.lib.json`,
    `{
      "extends": "./tsconfig.json",
      "compilerOptions": {
        "outDir": "../../dist/out-tsc",
        "types": ["node"]
      },
      "files": [
        "../../node_modules/@nx/react/typings/cssmodule.d.ts",
        "../../node_modules/@nx/react/typings/image.d.ts"
      ],
      "exclude": [
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/*.spec.tsx",
        "**/*.test.tsx",
        "**/*.spec.js",
        "**/*.test.js",
        "**/*.spec.jsx",
        "**/*.test.jsx"
      ],
      "include": ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"]
    }`
  );

  writeJson(tree, 'workspace.json', {
    projects: {
      [`${libName}`]: {
        ...reactLibNBVitest,
        root: `libs/${libName}`,
        projectType: 'library',
      },
    },
  });

  writeJson(tree, `libs/${libName}/project.json`, {
    ...reactLibNBVitest,
    root: `libs/${libName}`,
    projectType: 'library',
  });

  return tree;
}
