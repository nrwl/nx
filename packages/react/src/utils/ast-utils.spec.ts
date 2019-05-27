import * as utils from './ast-utils';
import * as ts from 'typescript';

describe('react ast-utils', () => {
  describe('findDefaultExport', () => {
    it('should find exported variable', () => {
      const text = `
        const main = () => {}; 
        export default main;
      `;
      const source = ts.createSourceFile(
        'test.ts',
        text,
        ts.ScriptTarget.Latest,
        true
      );

      const result = utils.findDefaultExport(source) as any;

      expect(result).toBeDefined();
      expect(result.name.text).toEqual('main');
    });

    it('should find exported function', () => {
      const text = `
        function main() {} 
        export default main;
      `;
      const source = ts.createSourceFile(
        'test.ts',
        text,
        ts.ScriptTarget.Latest,
        true
      );

      const result = utils.findDefaultExport(source) as any;

      expect(result).toBeDefined();
      expect(result.name.text).toEqual('main');
    });

    it('should find default export function', () => {
      const text = `
        export default function main() {};
      `;
      const source = ts.createSourceFile(
        'test.ts',
        text,
        ts.ScriptTarget.Latest,
        true
      );

      const result = utils.findDefaultExport(source) as any;

      expect(result).toBeDefined();
      expect(result.name.text).toEqual('main');
    });
  });
});
