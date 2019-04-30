import * as fs from 'fs';
import * as ts from 'typescript';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { getSourceNodes } from '@nrwl/workspace/src/utils/ast-utils';

export default {
  description: 'Add makeSureNoAppIsSelected(); to karma conf',
  run: async () => {
    const contents = fs.readFileSync('karma.conf.js').toString();
    const sourceFile = ts.createSourceFile(
      'karma.conf.js',
      contents,
      ts.ScriptTarget.Latest
    );
    const nodes = getSourceNodes(sourceFile);
    const isPresent = nodes
      .filter(ts.isCallExpression)
      .filter((callExpr: ts.CallExpression) =>
        ts.isIdentifier(callExpr.expression)
      )
      .some((callExpr: ts.CallExpression) => {
        const identifier = callExpr.expression as ts.Identifier;
        return identifier.escapedText === 'makeSureNoAppIsSelected';
      });

    if (isPresent) {
      return;
    }

    const snippet = stripIndents`
      const { makeSureNoAppIsSelected } = require('@nrwl/schematics/src/utils/cli-config-utils');
      // Nx only supports running unit tests for all apps and libs.
      makeSureNoAppIsSelected();
    `;

    const karmaComment = stripIndents`
      // Karma configuration file, see link for more information
      // https://karma-runner.github.io/1.0/config/configuration-file.html
    `;

    let res: string;
    if (contents.includes(karmaComment)) {
      res = contents.replace(karmaComment, karmaComment + '\n\n' + snippet);
    } else {
      res = snippet + '\n\n' + contents;
    }

    fs.writeFileSync('karma.conf.js', res);
  }
};
