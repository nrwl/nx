import * as path from 'path';
import {
  checkFilesExist,
  readFile,
  readJson,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import {
  setupLinterIntegratedTest,
  cleanupLinterIntegratedTest,
  LinterIntegratedTestContext,
} from './linter-setup';

describe('Linter', () => {
  let originalEslintUseFlatConfigVal: string | undefined;
  beforeAll(() => {
    // Opt into legacy .eslintrc config format for these tests
    originalEslintUseFlatConfigVal = process.env.ESLINT_USE_FLAT_CONFIG;
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';
  });
  afterAll(() => {
    process.env.ESLINT_USE_FLAT_CONFIG = originalEslintUseFlatConfigVal;
  });

  describe('Integrated', () => {
    let context: LinterIntegratedTestContext;

    beforeAll(() => {
      context = setupLinterIntegratedTest();
    });
    afterAll(() => cleanupLinterIntegratedTest());

    describe('linting errors', () => {
      let defaultEslintrc;

      beforeAll(() => {
        const { myapp } = context;
        updateFile(`apps/${myapp}/src/main.ts`, `console.log("should fail");`);
        defaultEslintrc = readJson('.eslintrc.json');
      });
      afterEach(() => {
        updateFile('.eslintrc.json', JSON.stringify(defaultEslintrc, null, 2));
      });

      it('should check for linting errors', () => {
        const { myapp } = context;
        // create faulty file
        updateFile(`apps/${myapp}/src/main.ts`, `console.log("should fail");`);
        const eslintrc = readJson('.eslintrc.json');

        // set the eslint rules to error
        eslintrc.overrides.forEach((override) => {
          if (override.files.includes('*.ts')) {
            override.rules['no-console'] = 'error';
          }
        });
        updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));

        let out = runCLI(`lint ${myapp}`, {
          silenceError: true,
          env: { CI: 'false' },
        });
        expect(out).toContain('Unexpected console statement');

        eslintrc.overrides.forEach((override) => {
          if (override.files.includes('*.ts')) {
            override.rules['no-console'] = undefined;
          }
        });
        updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));

        // 3. linting should not error when all rules are followed
        out = runCLI(`lint ${myapp}`, {
          silenceError: true,
          env: { CI: 'false' },
        });
        expect(out).toContain('Successfully ran target lint');
      }, 1000000);

      it('should cache eslint with --cache', () => {
        const { myapp } = context;
        function readCacheFile(cacheFile) {
          const cacheInfo = readFile(cacheFile);
          return process.platform === 'win32'
            ? cacheInfo.replace(/\\\\/g, '\\')
            : cacheInfo;
        }

        // should generate a default cache file
        let cachePath = path.join('apps', myapp, '.eslintcache');
        expect(() => checkFilesExist(cachePath)).toThrow();
        runCLI(`lint ${myapp} --cache`, {
          silenceError: true,
          env: { CI: 'false' },
        });
        expect(() => checkFilesExist(cachePath)).not.toThrow();
        expect(readCacheFile(cachePath)).toContain(
          path.normalize(`${myapp}/src/app/app.spec.tsx`)
        );

        // should let you specify a cache file location
        cachePath = path.join('apps', myapp, 'my-cache');
        expect(() => checkFilesExist(cachePath)).toThrow();
        runCLI(`lint ${myapp} --cache --cache-location="my-cache"`, {
          silenceError: true,
          env: { CI: 'false' },
        });
        expect(() => checkFilesExist(cachePath)).not.toThrow();
        expect(readCacheFile(cachePath)).toContain(
          path.normalize(`${myapp}/src/app/app.spec.tsx`)
        );
      });

      it('linting should generate an output file with a specific format', () => {
        const { myapp } = context;
        const eslintrc = readJson('.eslintrc.json');
        eslintrc.overrides.forEach((override) => {
          if (override.files.includes('*.ts')) {
            override.rules['no-console'] = 'error';
          }
        });
        updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));

        const outputFile = 'a/b/c/lint-output.json';
        const outputFilePath = path.join('apps', myapp, outputFile);
        expect(() => {
          checkFilesExist(outputFilePath);
        }).toThrow();
        const stdout = runCLI(
          `lint ${myapp} --output-file="${outputFile}" --format=json`,
          {
            silenceError: true,
            env: { CI: 'false' },
          }
        );
        expect(stdout).not.toContain('Unexpected console statement');
        expect(() => checkFilesExist(outputFilePath)).not.toThrow();
        const outputContents = JSON.parse(readFile(outputFilePath));
        const outputForApp: any = Object.values(outputContents).filter(
          (result: any) =>
            result.filePath.includes(path.normalize(`${myapp}/src/main.ts`))
        )[0];
        expect(outputForApp.errorCount).toBe(1);
        expect(outputForApp.messages[0].ruleId).toBe('no-console');
        expect(outputForApp.messages[0].message).toBe(
          'Unexpected console statement.'
        );
      }, 1000000);

      it('should support creating, testing and using workspace lint rules', () => {
        const { myapp, mylib, projScope } = context;
        const messageId = 'e2eMessageId';
        const libMethodName = 'getMessageId';

        // add custom function
        updateFile(
          `libs/${mylib}/src/lib/${mylib}.ts`,
          `export const ${libMethodName} = (): '${messageId}' => '${messageId}';`
        );

        // Generate a new rule (should also scaffold the required workspace project and tests)
        const newRuleName = 'e2e-test-rule-name';
        runCLI(`generate @nx/eslint:workspace-rule ${newRuleName}`);

        // TODO(@AgentEnder): This reset gets rid of a lockfile changed error... we should fix this in another way
        runCLI(`reset`, {
          env: { CI: 'false' },
        });

        // Ensure that the unit tests for the new rule are runnable
        expect(() =>
          runCLI(`test eslint-rules`, {
            env: { CI: 'false' },
          })
        ).not.toThrow();

        // Update the rule for the e2e test so that we can assert that it produces the expected lint failure when used
        const knownLintErrorMessage = 'e2e test known error message';
        const newRulePath = `tools/eslint-rules/rules/${newRuleName}.ts`;
        const newRuleGeneratedContents = readFile(newRulePath);
        const updatedRuleContents = updateGeneratedRuleImplementation(
          newRulePath,
          newRuleGeneratedContents,
          knownLintErrorMessage,
          messageId,
          libMethodName,
          `@${projScope}/${mylib}`
        );
        updateFile(newRulePath, updatedRuleContents);

        const newRuleNameForUsage = `@nx/workspace-${newRuleName}`;

        // Add the new workspace rule to the lint config and run linting
        const eslintrc = readJson('.eslintrc.json');
        eslintrc.overrides.forEach((override) => {
          if (override.files.includes('*.ts')) {
            override.rules[newRuleNameForUsage] = 'error';
          }
        });
        updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));

        const lintOutput = runCLI(`lint ${myapp} --verbose`, {
          silenceError: true,
          env: { CI: 'false' },
        });
        expect(lintOutput).toContain(newRuleNameForUsage);
        expect(lintOutput).toContain(knownLintErrorMessage);
      }, 1000000);
    });
  });
});

/**
 * Update the generated rule implementation to produce a known lint error from all files.
 *
 * It is important that we do this surgically via AST transformations, otherwise we will
 * drift further and further away from the original generated code and therefore make our
 * e2e test less accurate and less valuable.
 */
import * as ts from 'typescript';

function updateGeneratedRuleImplementation(
  newRulePath: string,
  newRuleGeneratedContents: string,
  knownLintErrorMessage: string,
  messageId,
  libMethodName: string,
  libPath: string
): string {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const newRuleSourceFile = ts.createSourceFile(
    newRulePath,
    newRuleGeneratedContents,
    ts.ScriptTarget.Latest,
    true
  );

  const transformer = <T extends ts.SourceFile>(
    context: ts.TransformationContext
  ) =>
    ((rootNode: T) => {
      function visit(node: ts.Node): ts.Node {
        /**
         * Add an ESLint messageId which will show the knownLintErrorMessage
         *
         * i.e.
         *
         * messages: {
         *   e2eMessageId: knownLintErrorMessage
         * }
         */
        if (
          ts.isPropertyAssignment(node) &&
          ts.isIdentifier(node.name) &&
          node.name.escapedText === 'messages'
        ) {
          return ts.factory.updatePropertyAssignment(
            node,
            node.name,
            ts.factory.createObjectLiteralExpression([
              ts.factory.createPropertyAssignment(
                messageId,
                ts.factory.createStringLiteral(knownLintErrorMessage)
              ),
            ])
          );
        }

        /**
         * Update the rule implementation to report the knownLintErrorMessage on every Program node
         *
         * During the debugging of the switch from ts-node to swc-node we found out
         * that regular rules would work even without explicit path mapping registration,
         * but rules that import runtime functionality from within the workspace
         * would break the rule registration.
         *
         * Instead of having a static literal messageId we retreieved it via imported getMessageId method.
         *
         * i.e.
         *
         * create(context) {
         *    return  {
         *      Program(node) {
         *        context.report({
         *          messageId: getMessageId(),
         *          node,
         *        });
         *      }
         *    }
         *  }
         */
        if (
          ts.isMethodDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.name.escapedText === 'create'
        ) {
          return ts.factory.updateMethodDeclaration(
            node,
            node.modifiers,
            node.asteriskToken,
            node.name,
            node.questionToken,
            node.typeParameters,
            node.parameters,
            node.type,
            ts.factory.createBlock([
              ts.factory.createReturnStatement(
                ts.factory.createObjectLiteralExpression([
                  ts.factory.createMethodDeclaration(
                    [],
                    undefined,
                    'Program',
                    undefined,
                    [],
                    [
                      ts.factory.createParameterDeclaration(
                        [],
                        undefined,
                        'node',
                        undefined,
                        undefined,
                        undefined
                      ),
                    ],
                    undefined,
                    ts.factory.createBlock([
                      ts.factory.createExpressionStatement(
                        ts.factory.createCallExpression(
                          ts.factory.createPropertyAccessExpression(
                            ts.factory.createIdentifier('context'),
                            'report'
                          ),
                          [],
                          [
                            ts.factory.createObjectLiteralExpression([
                              ts.factory.createPropertyAssignment(
                                'messageId',
                                ts.factory.createCallExpression(
                                  ts.factory.createIdentifier(libMethodName),
                                  [],
                                  []
                                )
                              ),
                              ts.factory.createShorthandPropertyAssignment(
                                'node'
                              ),
                            ]),
                          ]
                        )
                      ),
                    ])
                  ),
                ])
              ),
            ])
          );
        }

        return ts.visitEachChild(node, visit, context);
      }

      /**
       * Add lib import as a first line of the rule file.
       * Needed for the access of getMessageId in the context report above.
       *
       * i.e.
       *
       * import { getMessageId } from "@myproj/mylib";
       *
       */
      const importAdded = ts.factory.updateSourceFile(rootNode, [
        ts.factory.createImportDeclaration(
          undefined,
          ts.factory.createImportClause(
            false,
            undefined,
            ts.factory.createNamedImports([
              ts.factory.createImportSpecifier(
                false,
                undefined,
                ts.factory.createIdentifier(libMethodName)
              ),
            ])
          ),
          ts.factory.createStringLiteral(libPath)
        ),
        ...rootNode.statements,
      ]);
      return ts.visitNode(importAdded, visit);
    }) as ts.Transformer<T>;

  const result: ts.TransformationResult<ts.SourceFile> =
    ts.transform<ts.SourceFile>(newRuleSourceFile, [transformer]);
  const updatedSourceFile: ts.SourceFile = result.transformed[0];

  return printer.printFile(updatedSourceFile);
}
