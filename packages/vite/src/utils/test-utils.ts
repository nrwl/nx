import { Tree, writeJson } from '@nrwl/devkit';
import * as reactAppConfig from './test-files/react-project.config.json';
import * as webAppConfig from './test-files/web-project.config.json';

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

  writeJson(
    tree,
    'workspace.json',

    {
      projects: {
        'my-test-react-app': {
          ...reactAppConfig,
          root: `apps/${appName}`,
          projectType: 'application',
        },
      },
    }
  );

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
