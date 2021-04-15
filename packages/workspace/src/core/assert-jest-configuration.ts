import { ProjectGraph } from '@nrwl/devkit';
import * as stripJsonComments from 'strip-json-comments';
import * as ts from 'typescript';
import { output } from '../utilities/output';

// TODO: determine best way through circular depenedencies
// The following utility functions are copied/pasted from @nrwl/jest package
// I cannot import them without creating a circular dep between workspace and jest

function getJsonObject(object: string) {
  const value = stripJsonComments(object);
  // react babel-jest has __dirname in the config.
  // Put a temp variable in the anon function so that it doesnt fail.
  // Migration script has a catch handler to give instructions on how to update the jest config if this fails.
  return Function(`
  "use strict";
  let __dirname = '';
  return (${value});
 `)();
}

function jestConfigObjectAst(fileContent: string): ts.ObjectLiteralExpression {
  const sourceFile = ts.createSourceFile(
    'jest.config.js',
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  const moduleExportsStatement = sourceFile.statements.find(
    (statement) =>
      ts.isExpressionStatement(statement) &&
      ts.isBinaryExpression(statement.expression) &&
      statement.expression.left.getText() === 'module.exports' &&
      statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
  );

  const moduleExports = (moduleExportsStatement as ts.ExpressionStatement)
    .expression as ts.BinaryExpression;

  if (!moduleExports) {
    throw new Error(
      `
       The provided jest config file does not have the expected 'module.exports' expression. 
       See https://jestjs.io/docs/en/configuration for more details.`
    );
  }

  if (!ts.isObjectLiteralExpression(moduleExports.right)) {
    throw new Error(
      `The 'module.exports' expression is not an object literal.`
    );
  }

  return moduleExports.right as ts.ObjectLiteralExpression;
}

function minus(a: string[], b: string[]): string[] {
  const res = [];
  a.forEach((aa) => {
    if (!b.find((bb) => bb === aa)) {
      res.push(aa);
    }
  });
  return res;
}

// END IMPORT WORKAROUND

export function assertJestConfigValidity(
  graph: ProjectGraph,
  jestConfigContents: string
) {
  const jestConfig = getJsonObject(
    jestConfigObjectAst(jestConfigContents).getText()
  );
  const projectsPerJestConfig = jestConfig.projects;

  const expectedContentsPerGraph: string[] = Object.values(graph.nodes)
    .filter(
      ({ data }) =>
        data.targets.test && data.targets.test.executor === '@nrwl/jest:jest'
    )
    .map(({ data }) => `<rootDir>/${data.root}`);

  if (!projectsPerJestConfig) {
    output.error({
      title: 'Configuration Error',
      bodyLines: [
        'No `projects` property found in `jest.config.json`.',
        'The following array was expected from the project property:',
        JSON.stringify(expectedContentsPerGraph),
      ],
    });
    process.exit(1);
    return; // return to stop when running tests
  }

  const projectsThatExistInJestConfigButNotInWorkspace = minus(
    projectsPerJestConfig,
    expectedContentsPerGraph
  );
  if (projectsThatExistInJestConfigButNotInWorkspace.length) {
    output.error({
      title: 'Configuration Error',
      bodyLines: [
        'The following projects from your `jest.config.js` file do not appear to exist in your workspace:',
        ...projectsThatExistInJestConfigButNotInWorkspace.map(
          (x, i) =>
            `  ${x}${
              i === projectsThatExistInJestConfigButNotInWorkspace.length - 1
                ? ''
                : ','
            }`
        ),
      ],
    });
    process.exit(1);
    return; // return to stop when running tests
  }

  const projectsThatExistInWorkspaceButNotJestConfig = minus(
    expectedContentsPerGraph,
    projectsPerJestConfig
  );
  if (projectsThatExistInWorkspaceButNotJestConfig.length) {
    output.error({
      title: 'Configuration Error',
      bodyLines: [
        'You appear to be missing the following from the `projects` property of your root `jest.config.js`:',
        ...projectsThatExistInWorkspaceButNotJestConfig.map(
          (x, i) =>
            `  ${x}${
              i === projectsThatExistInWorkspaceButNotJestConfig.length - 1
                ? ''
                : ','
            }`
        ),
      ],
    });
    process.exit(1);
    return; // return to stop when running tests
  }

  output.success({
    title: 'Checking Root Jest Config',
    bodyLines: ['`jest.config.js` appears to be configured correctly.'],
  });
}
