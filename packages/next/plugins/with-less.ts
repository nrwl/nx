// Adapted from https://raw.githubusercontent.com/elado/next-with-less/main/src/index.js
import type { NextConfig } from 'next';
import { merge } from 'webpack-merge';
import { NextConfigFn } from '../src/utils/config';
import { WithNxOptions } from './with-nx';

type NextWebpackConfig = NonNullable<NextConfig['webpack']>;

type NextCssRuleUse =
  | string
  | { loader?: string }
  | Array<string | { loader?: string }>;

interface NextCssRule {
  oneOf?: NextCssRule[];
  options?: { __next_css_remove?: boolean };
  test?: RegExp | RegExp[];
  issuer?: RegExp | RegExp[];
  use?: NextCssRuleUse;
  [key: symbol]: unknown;
}

function getLoader(use: NextCssRuleUse | undefined): string | undefined {
  return typeof use === 'object' && !Array.isArray(use)
    ? use.loader
    : undefined;
}

function getTestSource(rule: NextCssRule): string | undefined {
  return rule.test instanceof RegExp ? rule.test.source : undefined;
}

const addLessToRegExp = (rx: RegExp) =>
  new RegExp(rx.source.replace('|sass', '|sass|less'), rx.flags);

export function withLess(
  configOrFn: NextConfigFn | WithNxOptions
): NextConfigFn {
  return async (phase: string) => {
    const baseConfig =
      typeof configOrFn === 'function' ? await configOrFn(phase) : configOrFn;
    const { lessLoaderOptions = {}, ...nextConfig } = baseConfig;

    return Object.assign({}, nextConfig, {
      webpack(
        config: Parameters<NextWebpackConfig>[0],
        opts: Parameters<NextWebpackConfig>[1]
      ) {
        // there are 2 relevant sass rules in next.js - css modules and global css
        let sassModuleRule: NextCssRule | undefined;
        // global sass rule (does not exist in server builds)
        let sassGlobalRule: NextCssRule | undefined;

        const rules: NextCssRule[] = config.module.rules;
        const cssRule = rules.find((rule) =>
          rule.oneOf?.find((r) => r?.[Symbol.for('__next_css_remove')])
        );
        if (!cssRule?.oneOf) {
          throw new Error('Could not find the Next.js CSS rule.');
        }
        const cssRuleOneOf = cssRule.oneOf;

        const addLessToRuleTest = (test: RegExp | RegExp[] | undefined) => {
          if (Array.isArray(test)) {
            return test.map((rx) => addLessToRegExp(rx));
          } else if (test) {
            return addLessToRegExp(test);
          }
          throw new Error('Expected the Next.js CSS rule to have a test.');
        };

        cssRuleOneOf.forEach((rule) => {
          if (rule.options?.__next_css_remove) return;

          const loader = getLoader(rule.use);
          if (loader === 'error-loader') {
            rule.test = addLessToRuleTest(rule.test);
          } else if (loader?.includes('file-loader')) {
            rule.issuer = addLessToRuleTest(rule.issuer);
          } else if (
            (typeof rule.use === 'string' || Array.isArray(rule.use)) &&
            rule.use.includes('ignore-loader')
          ) {
            rule.test = addLessToRuleTest(rule.test);
          } else if (getTestSource(rule) === '\\.module\\.(scss|sass)$') {
            sassModuleRule = rule;
          } else if (getTestSource(rule) === '(?<!\\.module)\\.(scss|sass)$') {
            sassGlobalRule = rule;
          }
        });

        const lessLoader = {
          loader: 'less-loader',
          options: {
            ...lessLoaderOptions,
            lessOptions: {
              javascriptEnabled: true,
              // @ts-ignore
              ...lessLoaderOptions.lessOptions,
            },
          },
        };

        if (!sassModuleRule) {
          throw new Error('Could not find the Next.js Sass module rule.');
        }
        let lessModuleRule = merge(sassModuleRule);

        const configureLessRule = (rule: NextCssRule) => {
          const testSource = getTestSource(rule);
          if (testSource === undefined || !Array.isArray(rule.use)) {
            throw new Error('Unexpected shape for the Next.js Sass rule.');
          }
          rule.test = new RegExp(testSource.replace('(scss|sass)', 'less'));
          // replace sass-loader (last entry) with less-loader
          rule.use.splice(-1, 1, lessLoader);
        };

        configureLessRule(lessModuleRule);
        cssRuleOneOf.splice(
          cssRuleOneOf.indexOf(sassModuleRule) + 1,
          0,
          lessModuleRule
        );

        if (sassGlobalRule) {
          let lessGlobalRule = merge(sassGlobalRule);
          configureLessRule(lessGlobalRule);
          cssRuleOneOf.splice(
            cssRuleOneOf.indexOf(sassGlobalRule) + 1,
            0,
            lessGlobalRule
          );
        }

        if (typeof nextConfig.webpack === 'function') {
          return nextConfig.webpack(config, opts);
        }

        return config;
      },
    });
  };
}

module.exports = withLess;
module.exports.withLess = withLess;
