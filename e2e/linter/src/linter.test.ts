import * as path from 'path';
import {
  checkFilesExist,
  newProject,
  readFile,
  readJson,
  removeFile,
  runCLI,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';
import * as ts from 'typescript';

describe('Linter', () => {
  describe('linting errors', () => {
    const myapp = uniq('myapp');

    beforeAll(() => {
      newProject();
      runCLI(`generate @nrwl/react:app ${myapp}`);
      updateFile(`apps/${myapp}/src/main.ts`, `console.log("should fail");`);
    });

    describe('console error on', () => {
      beforeAll(() => {
        const eslintrc = readJson('.eslintrc.json');
        eslintrc.overrides.forEach((override) => {
          if (override.files.includes('*.ts')) {
            override.rules['no-console'] = 'error';
          }
        });
        updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));
      });

      it('linting should error when rules are not followed', () => {
        const out = runCLI(`lint ${myapp}`, { silenceError: true });
        expect(out).toContain('Unexpected console statement');
      }, 1000000);

      it('linting should not error when rules are not followed and the force flag is specified', () => {
        expect(() => runCLI(`lint ${myapp} --force`)).not.toThrow();
      }, 1000000);
    });

    describe('console error off', () => {
      beforeAll(() => {
        const eslintrc = readJson('.eslintrc.json');
        eslintrc.overrides.forEach((override) => {
          if (override.files.includes('*.ts')) {
            override.rules['no-console'] = undefined;
          }
        });
        updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));
      });

      it('linting should not error when all rules are followed', () => {
        const out = runCLI(`lint ${myapp}`, { silenceError: true });
        expect(out).toContain('All files pass linting');
      }, 1000000);
    });
  });

  describe('linting with --cache', () => {
    function readCacheFile(cacheFile = '.eslintcache') {
      const cacheInfo = readFile(cacheFile);
      return process.platform === 'win32'
        ? cacheInfo.replace(/\\\\/g, '\\')
        : cacheInfo;
    }
    const myapp = uniq('myapp');

    beforeAll(() => {
      newProject();
      runCLI(`generate @nrwl/react:app ${myapp}`);
    });

    it('should generate a default cache file', () => {
      expect(() => checkFilesExist(`.eslintcache`)).toThrow();
      runCLI(`lint ${myapp} --cache`, { silenceError: true });
      expect(() => checkFilesExist(`.eslintcache`)).not.toThrow();
      const cacheInfo = readCacheFile();
      expect(cacheInfo).toContain(
        path.normalize(`${myapp}/src/app/app.spec.tsx`)
      );
    }, 1000000);

    it('should let you specify a cache file location', () => {
      expect(() => checkFilesExist(`my-cache`)).toThrow();
      runCLI(`lint ${myapp} --cache --cache-location="my-cache"`, {
        silenceError: true,
      });
      expect(() => checkFilesExist(`my-cache`)).not.toThrow();
      const cacheInfo = readCacheFile('my-cache');
      expect(cacheInfo).toContain(
        path.normalize(`${myapp}/src/app/app.spec.tsx`)
      );
    }, 1000000);
  });

  it('linting should generate an output file with a specific format', () => {
    newProject();
    const myapp = uniq('myapp');
    runCLI(`generate @nrwl/react:app ${myapp}`);

    const eslintrc = readJson('.eslintrc.json');
    eslintrc.overrides.forEach((override) => {
      if (override.files.includes('*.ts')) {
        override.rules['no-console'] = 'error';
      }
    });
    updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));
    updateFile(`apps/${myapp}/src/main.ts`, `console.log("should fail");`);

    const outputFile = 'a/b/c/lint-output.json';
    expect(() => {
      checkFilesExist(outputFile);
    }).toThrow();
    const stdout = runCLI(
      `lint ${myapp} --output-file="${outputFile}" --format=json`,
      {
        silenceError: true,
      }
    );
    expect(stdout).not.toContain('Unexpected console statement');
    expect(() => checkFilesExist(outputFile)).not.toThrow();
    const outputContents = JSON.parse(readFile(outputFile));
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

  describe('workspace lint rules', () => {
    it('should supporting creating, testing and using workspace lint rules', () => {
      newProject();
      const myapp = uniq('myapp');
      runCLI(`generate @nrwl/react:app ${myapp}`);

      // Generate a new rule (should also scaffold the required workspace project and tests)
      const newRuleName = 'e2e-test-rule-name';
      runCLI(`generate @nrwl/linter:workspace-rule ${newRuleName}`);

      // Ensure that the unit tests for the new rule are runnable
      const unitTestsOutput = runCLI(`test eslint-rules`);
      expect(unitTestsOutput).toContain('Running target "test" succeeded');

      // Update the rule for the e2e test so that we can assert that it produces the expected lint failure when used
      const knownLintErrorMessage = 'e2e test known error message';
      const newRulePath = `tools/eslint-rules/rules/${newRuleName}.ts`;
      const newRuleGeneratedContents = readFile(newRulePath);
      const updatedRuleContents = updateGeneratedRuleImplementation(
        newRulePath,
        newRuleGeneratedContents,
        knownLintErrorMessage
      );
      updateFile(newRulePath, updatedRuleContents);

      const newRuleNameForUsage = `@nrwl/nx/workspace/${newRuleName}`;

      // Add the new workspace rule to the lint config and run linting
      const eslintrc = readJson('.eslintrc.json');
      eslintrc.overrides.forEach((override) => {
        if (override.files.includes('*.ts')) {
          override.rules[newRuleNameForUsage] = 'error';
        }
      });
      updateFile('.eslintrc.json', JSON.stringify(eslintrc, null, 2));

      const lintOutput = runCLI(`lint ${myapp}`, { silenceError: true });
      expect(lintOutput).toContain(newRuleNameForUsage);
      expect(lintOutput).toContain(knownLintErrorMessage);
    }, 1000000);
  });
});

/**
 * Update the generated rule implementation to produce a known lint error from all files.
 *
 * It is important that we do this surgically via AST transformations, otherwise we will
 * drift further and further away from the original generated code and therefore make our
 * e2e test less accurate and less valuable.
 */
function updateGeneratedRuleImplementation(
  newRulePath: string,
  newRuleGeneratedContents: string,
  knownLintErrorMessage: string
): string {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const newRuleSourceFile = ts.createSourceFile(
    newRulePath,
    newRuleGeneratedContents,
    ts.ScriptTarget.Latest,
    true
  );

  const messageId = 'e2eMessageId';

  const transformer =
    <T extends ts.Node>(context: ts.TransformationContext) =>
    (rootNode: T) => {
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
         * i.e.
         *
         * create(context) {
         *    return  {
         *      Program(node) {
         *        context.report({
         *          messageId: 'e2eMessageId',
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
            node.decorators,
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
                    [],
                    undefined,
                    'Program',
                    undefined,
                    [],
                    [
                      ts.factory.createParameterDeclaration(
                        [],
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
                                ts.factory.createStringLiteral(messageId)
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
      return ts.visitNode(rootNode, visit);
    };

  const result: ts.TransformationResult<ts.SourceFile> =
    ts.transform<ts.SourceFile>(newRuleSourceFile, [transformer]);
  const updatedSourceFile: ts.SourceFile = result.transformed[0];

  return printer.printFile(updatedSourceFile);
}
