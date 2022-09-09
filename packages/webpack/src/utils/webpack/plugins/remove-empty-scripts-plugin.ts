// Removes empty script bundles (e.g. styles.js)
// FROM: https://github.com/webdiscus/webpack-remove-empty-scripts/blame/1ff513bd6146a6b2d01fdc7f7da15c5b14fed14b/index.js

const NAME = 'webpack-remove-empty-scripts';

const defaultOptions = {
  verbose: false,
  extensions: ['css', 'scss', 'sass', 'less', 'styl'],
  scriptExtensions: ['js', 'mjs'],
  ignore: [],
};

// Save unique id in dependency object as marker of 'analysed module'
// to avoid the infinite recursion by collect of resources.
let dependencyId = 1;

export class RemoveEmptyScriptsPlugin {
  constructor(private options: any = {}) {
    this.apply = this.apply.bind(this);
    Object.assign(this.options, defaultOptions, this.options);

    // Deprecation of option `silent`.
    if (options && options.hasOwnProperty('silent')) {
      this.options.verbose = !options.silent;
      console.warn(
        '[DEPRECATION] the `silent` option is deprecated and will be removed on Juni 30, 2021. Use option `verbose: true` to show in console each removed empty file. Defaults, `verbose: false`.'
      );
    }

    // if by assigned option the `ignore` was not array, then set as array
    if (!Array.isArray(this.options.ignore)) {
      this.options.ignore = [this.options.ignore];
    }
  }

  apply(compiler) {
    const customIgnore = this.options.ignore;

    const extensionsWithoutDots = this.options.extensions.map((e) =>
      e[0] === '.' ? e.substring(1) : e
    );

    const patternOneOfExtensions = extensionsWithoutDots
      .map((ext) => escapeRegExp(ext))
      .join('|');

    const reStylesResource = new RegExp(
      `[.](${patternOneOfExtensions})([?].*)?$`
    );

    compiler.hooks.compilation.tap(NAME, (compilation) => {
      const resourcesCache = [];

      compilation.hooks.chunkAsset.tap(NAME, (chunk, file) => {
        const isNotScript = defaultOptions.scriptExtensions.every(
          (ext) => file.lastIndexOf('.' + ext) < 0
        );
        if (isNotScript) return;

        const chunkGraph = compilation.chunkGraph;
        let entryResources = [];

        for (const module of chunkGraph.getChunkEntryModulesIterable(chunk)) {
          if (!compilation.modules.has(module)) {
            throw new Error(
              'checkConstraints: entry module in chunk but not in compilation ' +
                ` ${chunk.debugId} ${module.debugId}`
            );
          }

          const moduleResources = collectEntryResources(
            compilation,
            module,
            resourcesCache
          );
          entryResources = entryResources.concat(moduleResources);
        }

        const resources =
          customIgnore.length > 0
            ? entryResources.filter((res) =>
                customIgnore.every((ignore) => !res.match(ignore))
              )
            : entryResources;

        const isStyleOnly =
          resources.length &&
          resources.every((resource) => reStylesResource.test(resource));

        if (isStyleOnly) {
          if (this.options.verbose) {
            console.log('[remove-empty-scripts] remove empty js file: ' + file);
          }

          chunk.files.delete(file);
          compilation.deleteAsset(file);
        }
      });
    });
  }
}

function collectEntryResources(compilation, module, cache) {
  const moduleGraph = compilation.moduleGraph,
    index = moduleGraph.getPreOrderIndex(module),
    propNameDependencyId = '__dependencyWebpackRemoveEmptyScriptsUniqueId',
    resources = [];

  // the index can be null
  if (index == null) {
    return resources;
  }

  // index of module is unique per compilation
  // module.id can be null, not used here
  if (cache[index] !== undefined) {
    return cache[index];
  }

  if (typeof module.resource === 'string') {
    const resources = [module.resource];
    cache[index] = resources;

    return resources;
  }

  if (module.dependencies) {
    module.dependencies.forEach((dependency) => {
      let module = moduleGraph.getModule(dependency),
        originModule = moduleGraph.getParentModule(dependency),
        nextModule = module || originModule,
        useNextModule = false;

      if (!dependency.hasOwnProperty(propNameDependencyId)) {
        dependency[propNameDependencyId] = dependencyId++;
        useNextModule = true;
      }

      // debug info
      //console.log('::: module ::: ', useNextModule ? '' : '-----', dependency[propNameDependencyId]);

      if (nextModule && useNextModule) {
        const dependencyResources = collectEntryResources(
          compilation,
          nextModule,
          cache
        );

        for (
          let i = 0, length = dependencyResources.length;
          i !== length;
          i++
        ) {
          const file = dependencyResources[i];
          if (resources.indexOf(file) < 0) {
            resources.push(file);
          }
        }
      }
    });
  }

  if (resources.length > 0) {
    cache[index] = resources;
  }

  return resources;
}

const reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
const reHasRegExpChar = RegExp(reRegExpChar.source);

function escapeRegExp(string) {
  string = String(string);

  return string && reHasRegExpChar.test(string)
    ? string.replace(reRegExpChar, '\\$&')
    : string;
}
