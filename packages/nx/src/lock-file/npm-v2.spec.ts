import { joinPathFragments } from '../utils/path';
import { parseNpmLockFile } from './npm-v2';

describe('NPM lock file utility', () => {
  it('should parse next.js generated', async () => {
    const rootLockFile = require(joinPathFragments(
      __dirname,
      '__fixtures__/nextjs/package-lock.json'
    ));
    const packageJson = require(joinPathFragments(
      __dirname,
      '__fixtures__/nextjs/package.json'
    ));
    const result = parseNpmLockFile(JSON.stringify(rootLockFile), packageJson);
    expect(result.root.children.size).toEqual(1143);
    expect(result.isValid).toBeTruthy();
  });

  it('should parse auxiliary packages', async () => {
    const rootLockFile = require(joinPathFragments(
      __dirname,
      '__fixtures__/auxiliary-packages/package-lock.json'
    ));
    const rootV2LockFile = require(joinPathFragments(
      __dirname,
      '__fixtures__/auxiliary-packages/package-lock-v2.json'
    ));
    const packageJson = require(joinPathFragments(
      __dirname,
      '__fixtures__/auxiliary-packages/package.json'
    ));

    const resultV1 = parseNpmLockFile(
      JSON.stringify(rootLockFile),
      packageJson
    );

    expect(resultV1.root.children.size).toEqual(202);
    expect(resultV1.isValid).toBeTruthy();

    expect(resultV1.nodes.get('node_modules/postgres').name).toEqual(
      'postgres'
    );
    expect(
      resultV1.nodes.get('node_modules/postgres').packageName
    ).toBeUndefined();
    expect(resultV1.nodes.get('node_modules/postgres').version).toMatch(
      '3b1a01b2da3e2fafb1a79006f838eff11a8de3cb'
    );
    expect(
      resultV1.nodes.get('node_modules/postgres').edgesIn.values().next().value
        .versionSpec
    ).toMatch('charsleysa/postgres#fix-errors-compiled');

    expect(
      resultV1.nodes.get('node_modules/eslint-plugin-disable-autofix').name
    ).toEqual('eslint-plugin-disable-autofix');
    expect(
      resultV1.nodes.get('node_modules/eslint-plugin-disable-autofix')
        .packageName
    ).toEqual('@mattlewis92/eslint-plugin-disable-autofix');
    expect(
      resultV1.nodes.get('node_modules/eslint-plugin-disable-autofix').version
    ).toEqual('3.0.0');
    expect(
      resultV1.nodes
        .get('node_modules/eslint-plugin-disable-autofix')
        .edgesIn.values()
        .next().value.versionSpec
    ).toEqual('npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0');

    const resultV2 = parseNpmLockFile(
      JSON.stringify(rootV2LockFile),
      packageJson
    );
    expect(resultV2.root.children.size).toEqual(resultV2.root.children.size);
    expect(resultV2.isValid).toBeTruthy();

    expect(resultV2.nodes.get('node_modules/postgres').name).toEqual(
      'postgres'
    );
    expect(
      resultV2.nodes.get('node_modules/postgres').packageName
    ).toBeUndefined();
    expect(resultV2.nodes.get('node_modules/postgres').version).toMatch(
      '3b1a01b2da3e2fafb1a79006f838eff11a8de3cb'
    );
    expect(
      resultV2.nodes.get('node_modules/postgres').edgesIn.values().next().value
        .versionSpec
    ).toEqual('charsleysa/postgres#fix-errors-compiled');

    expect(
      resultV2.nodes.get('node_modules/eslint-plugin-disable-autofix').name
    ).toEqual('eslint-plugin-disable-autofix');
    expect(
      resultV2.nodes.get('node_modules/eslint-plugin-disable-autofix')
        .packageName
    ).toEqual('@mattlewis92/eslint-plugin-disable-autofix');
    expect(
      resultV2.nodes.get('node_modules/eslint-plugin-disable-autofix').version
    ).toEqual('3.0.0');
    expect(
      resultV2.nodes
        .get('node_modules/eslint-plugin-disable-autofix')
        .edgesIn.values()
        .next().value.versionSpec
    ).toEqual('npm:@mattlewis92/eslint-plugin-disable-autofix@3.0.0');
  });
});
