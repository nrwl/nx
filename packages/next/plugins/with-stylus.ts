// Adapted from https://raw.githubusercontent.com/elado/next-with-less/main/src/index.js
import { merge } from 'webpack-merge';

const addStylusToRegExp = (rx) =>
  new RegExp(rx.source.replace('|sass', '|sass|styl'), rx.flags);

function patchNextCSSWithStylus(
  nextCSSModule = require('next/dist/build/webpack/config/blocks/css') as any
) {
  nextCSSModule.regexLikeCss = addStylusToRegExp(nextCSSModule.regexLikeCss);
}

patchNextCSSWithStylus();

function withStylus({ stylusLoaderOptions = {}, ...nextConfig }: any) {
  return Object.assign({}, nextConfig, {
    webpack(config, opts) {
      // there are 2 relevant sass rules in next.js - css modules and global css
      let sassModuleRule;
      // global sass rule (does not exist in server builds)
      let sassGlobalRule;

      const cssRule = config.module.rules.find((rule) =>
        rule.oneOf?.find((r) => r?.[Symbol.for('__next_css_remove')])
      );

      const addStylusRuleToTest = (test) => {
        if (Array.isArray(test)) {
          return test.map((rx) => addStylusToRegExp(rx));
        } else {
          return addStylusToRegExp(test);
        }
      };

      cssRule.oneOf.forEach((rule) => {
        if (rule.options?.__next_css_remove) return;

        if (rule.use?.loader === 'error-loader') {
          rule.test = addStylusRuleToTest(rule.test);
        } else if (rule.use?.loader?.includes('file-loader')) {
          rule.issuer = addStylusRuleToTest(rule.issuer);
        } else if (rule.use?.includes?.('ignore-loader')) {
          rule.test = addStylusRuleToTest(rule.test);
        } else if (rule.test?.source === '\\.module\\.(scss|sass)$') {
          sassModuleRule = rule;
        } else if (rule.test?.source === '(?<!\\.module)\\.(scss|sass)$') {
          sassGlobalRule = rule;
        }
      });

      const stylusLoader = {
        loader: 'stylus-loader',
        options: {
          ...stylusLoaderOptions,
          stylusOptions: {
            javascriptEnabled: true,
            ...stylusLoaderOptions.stylusOptions,
          },
        },
      };

      let stylusModuleRule = merge({}, sassModuleRule);

      const configureStylusRule = (rule) => {
        rule.test = new RegExp(rule.test.source.replace('(scss|sass)', 'styl'));
        // replace sass-loader (last entry) with stylus-loader
        rule.use.splice(-1, 1, stylusLoader);
      };

      configureStylusRule(stylusModuleRule);
      cssRule.oneOf.splice(
        cssRule.oneOf.indexOf(sassModuleRule) + 1,
        0,
        stylusModuleRule
      );

      if (sassGlobalRule) {
        let stylusGlobalRule = merge({}, sassGlobalRule);
        configureStylusRule(stylusGlobalRule);
        cssRule.oneOf.splice(
          cssRule.oneOf.indexOf(sassGlobalRule) + 1,
          0,
          stylusGlobalRule
        );
      }

      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, opts);
      }

      return config;
    },
  });
}

module.exports = withStylus;
module.exports.patchNext = patchNextCSSWithStylus;
