// Adapted from https://raw.githubusercontent.com/elado/next-with-less/main/src/index.js
import { merge } from 'webpack-merge';

const addLessToRegExp = (rx) =>
  new RegExp(rx.source.replace('|sass', '|sass|less'), rx.flags);

function patchNextCSSWithLess(
  nextCSSModule: any = require('next/dist/build/webpack/config/blocks/css')
) {
  nextCSSModule.regexLikeCss = addLessToRegExp(nextCSSModule.regexLikeCss);
}

patchNextCSSWithLess();

function withLess({ lessLoaderOptions = {}, ...nextConfig }) {
  return Object.assign({}, nextConfig, {
    webpack(config, opts) {
      // there are 2 relevant sass rules in next.js - css modules and global css
      let sassModuleRule;
      // global sass rule (does not exist in server builds)
      let sassGlobalRule;

      const cssRule = config.module.rules.find((rule) =>
        rule.oneOf?.find((r) => r?.options?.__next_css_remove)
      );

      const addLessToRuleTest = (test) => {
        if (Array.isArray(test)) {
          return test.map((rx) => addLessToRegExp(rx));
        } else {
          return addLessToRegExp(test);
        }
      };

      cssRule.oneOf.forEach((rule) => {
        if (rule.options?.__next_css_remove) return;

        if (rule.use?.loader === 'error-loader') {
          rule.test = addLessToRuleTest(rule.test);
        } else if (rule.use?.loader?.includes('file-loader')) {
          rule.issuer = addLessToRuleTest(rule.issuer);
        } else if (rule.use?.includes?.('ignore-loader')) {
          rule.test = addLessToRuleTest(rule.test);
        } else if (rule.test?.source === '\\.module\\.(scss|sass)$') {
          sassModuleRule = rule;
        } else if (rule.test?.source === '(?<!\\.module)\\.(scss|sass)$') {
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

      let lessModuleRule = merge(sassModuleRule);

      const configureLessRule = (rule) => {
        rule.test = new RegExp(rule.test.source.replace('(scss|sass)', 'less'));
        // replace sass-loader (last entry) with less-loader
        rule.use.splice(-1, 1, lessLoader);
      };

      configureLessRule(lessModuleRule);
      cssRule.oneOf.splice(
        cssRule.oneOf.indexOf(sassModuleRule) + 1,
        0,
        lessModuleRule
      );

      if (sassGlobalRule) {
        let lessGlobalRule = merge(sassGlobalRule);
        configureLessRule(lessGlobalRule);
        cssRule.oneOf.splice(
          cssRule.oneOf.indexOf(sassGlobalRule) + 1,
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
}

module.exports = withLess;
module.exports.patchNext = patchNextCSSWithLess;
