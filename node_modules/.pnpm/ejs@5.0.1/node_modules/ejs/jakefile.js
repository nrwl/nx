let fs = require('fs');
let path = require('path');
let execSync = require('child_process').execSync;
let exec = function (cmd) {
  execSync(cmd, {stdio: 'inherit'});
};

/* global jake, task, desc, publishTask */

const BUILT_EJS_FILES = [
  'ejs.js',
  'ejs.min.js',
  'lib/esm/ejs.js',
  'lib/cjs/ejs.js',
];

// Hook into some of the publish lifecycle events
jake.on('finished', function (ev) {

  switch (ev.name) {
  case 'publish':
    console.log('Updating hosted docs...');
    console.log('If this fails, run jake docPublish to re-try.');
    jake.Task.docPublish.invoke();
    break;
  default:
      // Do nothing
  }

});

desc('Builds the EJS library');
task('build', ['lint', 'clean', 'compile', 'browserify', 'minify']);

desc('Compiles ESM to CJS source files');
task('compile', function () {
  // Compile CJS version
  exec('npx tsc');
  let source = fs.readFileSync('lib/cjs/ejs.js', 'utf8').toString();
  // Browerify chokes on the 'node:' prefix in require statements
  // Added the 'node:' prefix to ESM for Deno compat
  ['fs', 'path', 'url'].forEach((mod) => {
    source = source.replace(`require("node:${mod}")`, `require("${mod}")`);
    source = source.replace(new RegExp(`node_${mod}_1`, 'g'), `${mod}_1`);
  });
  // replace `let` in code-generation strings
  source = source.replace(
    "var DECLARATION_KEYWORD = 'let';",
    "var DECLARATION_KEYWORD = 'var';"
  );
  fs.writeFileSync('lib/cjs/ejs.js', source);
  fs.writeFileSync('lib/cjs/package.json', '{"type":"commonjs"}');
});

desc('Cleans browerified/minified files and package files');
task('clean', ['clobber'], function () {
  jake.rmRf('./ejs.js');
  jake.rmRf('./ejs.min.js');
  jake.rmRf('./lib/cjs');
  console.log('Cleaned up compiled files.');
});

desc('Lints the source code');
task('lint', ['clean'], function () {
  let epath = path.join('./node_modules/.bin/eslint');
  // Handle both ESM and CJS files in project
  exec(epath+' --config ./eslint.config_esm.mjs "lib/esm/*.js"');
  exec(epath+' --config ./eslint.config_cjs.mjs "test/*.js" "bin/cli.js" "jakefile.js"');
  console.log('Linting completed.');
});

task('browserify', function () {
  const currentDir = process.cwd();
  process.chdir('./lib/cjs');
  let epath = path.join('../../node_modules/browserify/bin/cmd.js');
  exec(epath+' --standalone ejs ejs.js > ../../ejs.js');
  process.chdir(currentDir);
  console.log('Browserification completed.');
});

task('minify', function () {
  let epath = path.join('./node_modules/uglify-js/bin/uglifyjs');
  exec(epath+' ./ejs.js > ejs.min.js');
  console.log('Minification completed.');
});

desc('Generates the EJS API docs for the public API');
task('doc', function () {
  jake.rmRf('out');
  let epath = path.join('./node_modules/.bin/jsdoc');
  exec(epath+' --verbose -c jsdoc.json lib/esm/* docs/jsdoc/*');
  console.log('Documentation generated in ./out.');
});

desc('Generates the EJS API docs for the public and private API');
task('devdoc', function () {
  jake.rmRf('out');
  let epath = path.join('./node_modules/.bin/jsdoc');
  exec(epath+' --verbose -p -c jsdoc.json lib/esm/* docs/jsdoc/*');
  console.log('Documentation generated in ./out.');
});

desc('Publishes the EJS API docs');
task('docPublish', ['doc'], function () {
  fs.writeFileSync('out/CNAME', 'api.ejs.co');
  console.log('Pushing docs to gh-pages...');
  let epath = path.join('./node_modules/.bin/git-directory-deploy');
  exec(epath+' --directory out/');
  console.log('Docs published to gh-pages.');
});

desc('Runs the EJS test suite');
task('test', ['build', 'testOnly'], function () {});

task('testOnly', function () {
  exec(path.join('./node_modules/.bin/mocha --u tdd'));
});

publishTask('ejs', ['build'], function () {
  this.packageFiles.include([
    'jakefile.js',
    'README.md',
    'LICENSE',
    'package.json',
    'ejs.js',
    'ejs.min.js',
    'lib/**',
    'bin/**',
    'usage.txt'
  ]);
});

