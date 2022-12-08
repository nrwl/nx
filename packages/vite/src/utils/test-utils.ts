import { Tree, writeJson } from '@nrwl/devkit';
import * as reactAppConfig from './test-files/react-project.config.json';
import * as reactViteConfig from './test-files/react-vite-project.config.json';
import * as webAppConfig from './test-files/web-project.config.json';

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
        "../../node_modules/@nrwl/react/typings/cssmodule.d.ts",
        "../../node_modules/@nrwl/react/typings/image.d.ts"
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
    `/// <reference types="vitest" />
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
        "../../node_modules/@nrwl/react/typings/cssmodule.d.ts",
        "../../node_modules/@nrwl/react/typings/image.d.ts"
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
