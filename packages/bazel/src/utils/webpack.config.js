const fs = require('fs');
const path = require('path');
const ProgressPlugin = require('webpack/lib/ProgressPlugin');
const CircularDependencyPlugin = require('circular-dependency-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const { NoEmitOnErrorsPlugin, SourceMapDevToolPlugin, NamedModulesPlugin } = require('webpack');
const { GlobCopyWebpackPlugin, NamedLazyChunksWebpackPlugin, BaseHrefWebpackPlugin } = require('@angular/cli/plugins/webpack');
const { CommonsChunkPlugin } = require('webpack').optimize;

const nodeModules = path.join(process.cwd(), 'node_modules');
const realNodeModules = fs.realpathSync(nodeModules);

const entryPoints = ["inline", "polyfills", "styles", "vendor", "main"];
const baseHref = "";

module.exports = function(env) {
  const apps = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.angular-cli.json'), 'UTF-8')).apps;
  const appConfig = apps.filter(a => a.root.indexOf(env.package) > -1)[0];
  const binDir = env.bin_dir.startsWith('/') ? env.bin_dir : path.join(process.cwd(), env.bin_dir);
  const out = path.join(binDir, env.package, 'bundles');
  const src = path.join(binDir, appConfig.root);

  const aliasesForApps = apps.reduce((acc, curr) => {
    acc[curr.name] = path.join(binDir, path.dirname(curr.root));
    return acc;
  }, {});

  const root = path.join(binDir, '..', '..', '..');

  // victor todo: remove it when ng_module rule is fixed
  const alias = Object.assign({}, aliasesForApps, {
    'node_modules/@angular/core/index': '@angular/core/esm5/index',
    'node_modules/@angular/common/index': `@angular/common/esm5/index`,
    'node_modules/@angular/router/index': `@angular/router/esm5/index`,
    'node_modules/@angular/platform-browser/index': '@angular/platform-browser/esm5/index'
  });

  return {
    "resolve": {
      "extensions": [
        ".js"
      ],
      "modules": [
        binDir,
        `./node_modules`,
      ],
      "symlinks": true,
      alias
    },
    "resolveLoader": {
      "modules": [
        "./node_modules"
      ]
    },
    "entry": {
      "main": [
        tsToJs(path.join(src, appConfig.main))
      ],
      "polyfills": [
        tsToJs(path.join(src, appConfig.polyfills))
      ],
      "styles": appConfig.styles.map(s => path.join(src, s))
    },
    "output": {
      "path": out,
      "filename": "[name].bundle.js",
      "chunkFilename": "[id].chunk.js"
    },
    "module": {
      "exprContextCritical": false,
      "rules": [
        {
          "enforce": "pre",
          "test": /\.js$/,
          "loader": "source-map-loader",
          "exclude": [
            /(\\|\/)node_modules(\\|\/)/
          ]
        },
        {
          "test": /\.html$/,
          "loader": "raw-loader"
        },
        {
          "test": /\.(eot|svg|cur)$/,
          "loader": "file-loader?name=[name].[hash:20].[ext]"
        },
        {
          "test": /\.(jpg|png|webp|gif|otf|ttf|woff|woff2|ani)$/,
          "loader": "url-loader?name=[name].[hash:20].[ext]&limit=10000"
        }
      ]
    },
    "plugins": [
      new NoEmitOnErrorsPlugin(),
      new GlobCopyWebpackPlugin({
        "patterns": [
          "assets",
          "favicon.ico"
        ],
        "globOptions": {
          "cwd": src,
          "dot": true,
          "ignore": "**/.gitkeep"
        }
      }),
      new ProgressPlugin(),
      new CircularDependencyPlugin({
        "exclude": /(\\|\/)node_modules(\\|\/)/,
        "failOnError": false
      }),
      new NamedLazyChunksWebpackPlugin(),
      new HtmlWebpackPlugin({
        "template": path.join(src, 'index.html'),
        "filename": "./index.html",
        "hash": false,
        "inject": true,
        "compile": true,
        "favicon": false,
        "minify": false,
        "cache": true,
        "showErrors": true,
        "chunks": "all",
        "excludeChunks": [],
        "xhtml": true,
        "chunksSortMode": function sort(left, right) {
          let leftIndex = entryPoints.indexOf(left.names[0]);
          let rightindex = entryPoints.indexOf(right.names[0]);
          if (leftIndex > rightindex) {
            return 1;
          }
          else if (leftIndex < rightindex) {
            return -1;
          }
          else {
            return 0;
          }
        }
      }),
      new BaseHrefWebpackPlugin({}),
      new CommonsChunkPlugin({
        "name": [
          "inline"
        ],
        "minChunks": null
      }),
      new CommonsChunkPlugin({
        "name": [
          "vendor"
        ],
        "minChunks": (module) => {
          return module.resource
            && (module.resource.startsWith(nodeModules)
              || module.resource.startsWith(realNodeModules));
        },
        "chunks": [
          "main"
        ]
      }),
      new SourceMapDevToolPlugin({
        "filename": "[file].map[query]",
        "moduleFilenameTemplate": "[resource-path]",
        "fallbackModuleFilenameTemplate": "[resource-path]?[hash]",
        "sourceRoot": "webpack:///"
      }),
      new CommonsChunkPlugin({
        "name": [
          "main"
        ],
        "minChunks": 2,
        "async": "common"
      }),
      new NamedModulesPlugin({}),
    ],
    "node": {
      "fs": "empty",
      "global": true,
      "crypto": "empty",
      "tls": "empty",
      "net": "empty",
      "process": true,
      "module": false,
      "clearImmediate": false,
      "setImmediate": false
    },
    "devServer": {
      "historyApiFallback": true,
      "contentBase": out,
      "watchOptions": {
        "aggregateTimeout": 3000,
        "poll": 1000
      }
    },
    "stats": {
      "colors": true
    }
  };
};

function tsToJs(s) {
  return `${s.substring(0, s.length - 3)}.js`;
}
