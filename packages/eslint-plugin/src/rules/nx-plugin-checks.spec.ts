import 'nx/src/internal-testing-utils/mock-fs';
import { vol } from 'memfs';
import { checkIfIdentifierIsFunction } from './nx-plugin-checks';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  workspaceRoot: '/root',
}));

jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

describe('checkIfIdentifierIsFunction', () => {
  beforeEach(() => {
    vol.reset();
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should detect export function', () => {
    const filePath = '/root/src/generator.ts';
    vol.fromJSON({
      [filePath]: `
        export function myGenerator() {
          console.log('generator');
        }
      `,
    });

    const result = checkIfIdentifierIsFunction(filePath, 'myGenerator');
    expect(result).toBe(true);
  });

  it('should detect async export function', () => {
    const filePath = '/root/src/generator.ts';
    vol.fromJSON({
      [filePath]: `
        export async function myGenerator() {
          await Promise.resolve();
        }
      `,
    });

    const result = checkIfIdentifierIsFunction(filePath, 'myGenerator');
    expect(result).toBe(true);
  });

  it('should detect variable export (arrow function)', () => {
    const filePath = '/root/src/generator.ts';
    vol.fromJSON({
      [filePath]: `
        export const myGenerator = () => {
          console.log('generator');
        };
      `,
    });

    const result = checkIfIdentifierIsFunction(filePath, 'myGenerator');
    expect(result).toBe(true);
  });

  it('should detect variable export (function expression)', () => {
    const filePath = '/root/src/generator.ts';
    vol.fromJSON({
      [filePath]: `
        export const myGenerator = function() {
          console.log('generator');
        };
      `,
    });

    const result = checkIfIdentifierIsFunction(filePath, 'myGenerator');
    expect(result).toBe(true);
  });

  it('should detect export default function', () => {
    const filePath = '/root/src/generator.ts';
    vol.fromJSON({
      [filePath]: `
        export default function myGenerator() {
          console.log('generator');
        }
      `,
    });

    const result = checkIfIdentifierIsFunction(filePath, 'myGenerator');
    expect(result).toBe(true);
  });

  it('should return false for non-function export', () => {
    const filePath = '/root/src/generator.ts';
    vol.fromJSON({
      [filePath]: `
        export const myGenerator = 'not a function';
      `,
    });

    const result = checkIfIdentifierIsFunction(filePath, 'myGenerator');
    expect(result).toBe(false);
  });

  it('should return false for non-existent identifier', () => {
    const filePath = '/root/src/generator.ts';
    vol.fromJSON({
      [filePath]: `
        export function otherFunction() {
          console.log('other');
        }
      `,
    });

    const result = checkIfIdentifierIsFunction(filePath, 'myGenerator');
    expect(result).toBe(false);
  });
});
