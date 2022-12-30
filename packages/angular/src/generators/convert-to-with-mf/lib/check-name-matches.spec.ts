import { tsquery } from '@phenomnomnominal/tsquery';
import { checkOutputNameMatchesProjectName } from './check-name-matches';
describe('checkOutputNameMatchesProjectName', () => {
  it('should return true if the uniqueName matches the project name', () => {
    // ARRANGE
    const sourceText = `module.exports = {
        output: {
            uniqueName: 'proj'
        }
    }`;

    const ast = tsquery.ast(sourceText);

    // ACT
    const result = checkOutputNameMatchesProjectName(ast, 'proj');

    // ASSERT
    expect(result).toBeTruthy();
  });

  it('should return false if the uniqueName does not match the project name', () => {
    // ARRANGE
    const sourceText = `module.exports = {
        output: {
            uniqueName: 'app1'
        }
    }`;

    const ast = tsquery.ast(sourceText);

    // ACT
    const result = checkOutputNameMatchesProjectName(ast, 'proj');

    // ASSERT
    expect(result).toBeFalsy();
  });
});
