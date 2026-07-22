import 'nx/src/internal-testing-utils/mock-fs';
import { vol } from 'memfs';
import { parseForESLint } from 'jsonc-eslint-parser';
import {
  checkIfIdentifierIsFunction,
  validateNoDuplicateKeys,
} from './nx-plugin-checks';

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

describe('validateNoDuplicateKeys', () => {
  function collectReports(json: string): { messageId: string; key: string }[] {
    const rootNode = (parseForESLint(json).ast.body[0] as any).expression;
    const reports: any[] = [];
    const context = { report: (r: any) => reports.push(r) } as any;
    validateNoDuplicateKeys(rootNode, context);
    return reports.map((r) => ({ messageId: r.messageId, key: r.data.key }));
  }

  it('should report a duplicated entry key', () => {
    const reports = collectReports(`{
      "generators": {
        "update-1-0-0-foo": { "version": "1.0.0-beta.1" },
        "update-1-0-0-foo": { "version": "1.0.0-beta.2" }
      }
    }`);

    expect(reports).toEqual([
      { messageId: 'duplicateKey', key: 'update-1-0-0-foo' },
    ]);
  });

  it('should report a duplicated top-level section key', () => {
    const reports = collectReports(`{
      "generators": {},
      "generators": {}
    }`);

    expect(reports).toEqual([{ messageId: 'duplicateKey', key: 'generators' }]);
  });

  it('should report duplicated keys in nested objects', () => {
    const reports = collectReports(`{
      "packageJsonUpdates": {
        "1.0.0": {
          "version": "1.0.0-beta.1",
          "packages": {
            "@acme/foo": { "version": "2.0.0" },
            "@acme/foo": { "version": "3.0.0" }
          }
        }
      }
    }`);

    expect(reports).toEqual([{ messageId: 'duplicateKey', key: '@acme/foo' }]);
  });

  it('should report duplicated keys inside objects nested in arrays', () => {
    const reports = collectReports(`{
      "nx-migrations": {
        "packageGroup": [
          { "package": "@acme/foo", "version": "*", "version": "latest" }
        ]
      }
    }`);

    expect(reports).toEqual([{ messageId: 'duplicateKey', key: 'version' }]);
  });

  it('should not report the same key name in sibling objects', () => {
    const reports = collectReports(`{
      "generators": {
        "update-1-0-0-foo": { "version": "1.0.0-beta.1" },
        "update-1-0-0-bar": { "version": "1.0.0-beta.1" }
      },
      "schematics": {
        "update-1-0-0-foo": { "version": "1.0.0-beta.1" }
      }
    }`);

    expect(reports).toEqual([]);
  });

  it('should report each extra occurrence of a key', () => {
    const reports = collectReports(`{
      "executors": {
        "build": { "schema": "./a.json" },
        "build": { "schema": "./b.json" },
        "build": { "schema": "./c.json" }
      }
    }`);

    expect(reports).toEqual([
      { messageId: 'duplicateKey', key: 'build' },
      { messageId: 'duplicateKey', key: 'build' },
    ]);
  });
});
