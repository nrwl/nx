import { hasIgnoreServerInputsDirective } from './ignore-server-inputs-directive';

describe('hasIgnoreServerInputsDirective', () => {
  it.each([
    ['// @nx-ignore-server-inputs\nimport x from "y";\n', true],
    ['/**\n * @nx-ignore-server-inputs\n */\n', true],
    ['// @nx-ignore-server-inputs:\n', true],
    ['// @nx-ignore-server-inputs: false\n', false],
    ['// @nx-ignore-server-inputs\n// @nx-ignore-server-inputs: yes\n', false],
    ['import x from "y";\n// @nx-ignore-server-inputs\n', false],
    ['// @nx-depends-on: shop\n', false],
  ])('%j -> %s', (content, expected) => {
    expect(hasIgnoreServerInputsDirective(content)).toBe(expected);
  });
});
