import { readFileSync } from 'fs';
import { join } from 'path';
import * as ts from 'typescript';

describe('devkit goldens', () => {
  const goldenPaths = ['index.ts', 'testing.ts'].map((x) => ({
    base: x,
    full: join(__dirname, x),
  }));

  const configFile = ts.parseJsonConfigFileContent(
    ts.readConfigFile(join(__dirname, 'tsconfig.lib.json'), (s) =>
      readFileSync(s, 'utf-8')
    ),
    ts.sys,
    __dirname
  );

  const program = ts.createProgram({
    rootNames: goldenPaths.map((x) => x.full),
    options: configFile.options,
  });

  const typechecker = program.getTypeChecker();

  describe.each(goldenPaths)(
    '$base should not contain breaking changes > ',
    (golden) => {
      const sourceFile = program.getSourceFile(golden.full);
      const sourceFileSymbol = typechecker.getSymbolAtLocation(sourceFile);
      const exports = typechecker.getExportsOfModule(sourceFileSymbol);

      it.each(exports)(`$escapedName should not have changed`, (exp) => {
        const representation = exp
          .getDeclarations()
          .map((x) => serializeSymbol(typechecker, exp, x));
        expect(representation).toMatchSnapshot(
          `Previous type of ${exp.escapedName}`
        );
      });
    }
  );
});

function serializeSymbol(
  typechecker: ts.TypeChecker,
  symbol: ts.Symbol,
  node?: ts.Node
) {
  const t = node
    ? typechecker.getTypeOfSymbolAtLocation(symbol, node)
    : typechecker.getDeclaredTypeOfSymbol(symbol);

  // we want to resolve any alias's
  try {
    const aliased = typechecker.getAliasedSymbol(symbol);
    return serializeSymbol(typechecker, aliased);
  } catch {}

  const str = typechecker.typeToString(t);

  if (str === 'any') {
    try {
      return symbol
        .getDeclarations()
        .map((d) =>
          typechecker.typeToString(
            typechecker.getTypeOfSymbolAtLocation(symbol, d)
          )
        )
        .join('|');
    } catch {}
    return str;
  }

  try {
    const properties = typechecker.getAugmentedPropertiesOfType(t);
    return `${str} > (${properties
      .map((s) => `${s.escapedName}: ${serializeSymbol(typechecker, s)}`)
      .join(', ')}))`;
  } catch {}

  return str;
}
