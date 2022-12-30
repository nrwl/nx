export const correctConfig = `const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const mf = require('@angular-architects/module-federation/webpack');
const path = require('path');

/**
 * We use the NX_TSCONFIG_PATH environment variable when using the @nrwl/angular:webpack-browser
 * builder as it will generate a temporary tsconfig file which contains any required remappings of
 * shared libraries.
 * A remapping will occur when a library is buildable, as webpack needs to know the location of the
 * built files for the buildable library.
 * This NX_TSCONFIG_PATH environment variable is set by the @nrwl/angular:webpack-browser and it contains
 * the location of the generated temporary tsconfig file.
 */
const tsConfigPath =
  process.env.NX_TSCONFIG_PATH ??
  path.join(__dirname, '../../tsconfig.base.json');

const workspaceRootPath = path.join(__dirname, '../../');
const sharedMappings = new mf.SharedMappings();
sharedMappings.register(
  tsConfigPath,
  [
    /* mapped paths to share */
  ],
  workspaceRootPath
);

const share = mf.share;
mf.setInferVersion(true);
module.exports = {
  output: {
    uniqueName: 'host',
    publicPath: 'auto',
  },
  optimization: {
    runtimeChunk: false,
  },
  experiments: {
    outputModule: true,
  },
  resolve: {
    alias: {
      ...sharedMappings.getAliases(),
    },
  },
  plugins: [
    new ModuleFederationPlugin({
      remotes: {},
      shared: share({
        '@angular/core': {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          includeSecondaries: true,
        },
        '@angular/common': {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          includeSecondaries: true,
        },
        '@angular/common/http': {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          includeSecondaries: true,
        },
        '@angular/router': {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          includeSecondaries: true,
        },
        rxjs: {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          includeSecondaries: true,
        },
        ...sharedMappings.getDescriptors(),
      }),
      library: {
        type: 'module',
      },
    }),
    sharedMappings.getPlugin(),
  ],
};`;

export const shareConfig = {
  correct: `const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const mf = require('@angular-architects/module-federation/webpack');
const path = require('path');

/**
 * We use the NX_TSCONFIG_PATH environment variable when using the @nrwl/angular:webpack-browser
 * builder as it will generate a temporary tsconfig file which contains any required remappings of
 * shared libraries.
 * A remapping will occur when a library is buildable, as webpack needs to know the location of the
 * built files for the buildable library.
 * This NX_TSCONFIG_PATH environment variable is set by the @nrwl/angular:webpack-browser and it contains
 * the location of the generated temporary tsconfig file.
 */
const tsConfigPath =
  process.env.NX_TSCONFIG_PATH ??
  path.join(__dirname, '../../tsconfig.base.json');

const workspaceRootPath = path.join(__dirname, '../../');
const sharedMappings = new mf.SharedMappings();
sharedMappings.register(
  tsConfigPath,
  [
    /* mapped paths to share */
  ],
  workspaceRootPath
);

const share = mf.share;
mf.setInferVersion(true);
module.exports = {
  output: {
    uniqueName: 'host',
    publicPath: 'auto',
  },
  optimization: {
    runtimeChunk: false,
  },
  experiments: {
    outputModule: true,
  },
  resolve: {
    alias: {
      ...sharedMappings.getAliases(),
    },
  },
  plugins: [
    new ModuleFederationPlugin({
      remotes: {},
      shared: share({
        '@angular/core': {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          includeSecondaries: true,
        },
        '@angular/common': {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          includeSecondaries: true,
        },
        '@angular/common/http': {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          includeSecondaries: true,
        },
        '@angular/router': {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          includeSecondaries: true,
        },
        rxjs: {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          includeSecondaries: true,
        },
        ...sharedMappings.getDescriptors(),
      }),
      library: {
        type: 'module',
      },
    }),
    sharedMappings.getPlugin(),
  ],
};`,
  incorrect: `const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const mf = require('@angular-architects/module-federation/webpack');
const path = require('path');

/**
 * We use the NX_TSCONFIG_PATH environment variable when using the @nrwl/angular:webpack-browser
 * builder as it will generate a temporary tsconfig file which contains any required remappings of
 * shared libraries.
 * A remapping will occur when a library is buildable, as webpack needs to know the location of the
 * built files for the buildable library.
 * This NX_TSCONFIG_PATH environment variable is set by the @nrwl/angular:webpack-browser and it contains
 * the location of the generated temporary tsconfig file.
 */
const tsConfigPath =
  process.env.NX_TSCONFIG_PATH ??
  path.join(__dirname, '../../tsconfig.base.json');

const workspaceRootPath = path.join(__dirname, '../../');
const sharedMappings = new mf.SharedMappings();
sharedMappings.register(
  tsConfigPath,
  [
    /* mapped paths to share */
  ],
  workspaceRootPath
);

module.exports = {
  output: {
    uniqueName: 'host',
    publicPath: 'auto',
  },
  optimization: {
    runtimeChunk: false,
  },
  experiments: {
    outputModule: true,
  },
  resolve: {
    alias: {
      ...sharedMappings.getAliases(),
    },
  },
  plugins: [
    new ModuleFederationPlugin({
      remotes: {},
      shared: {
        '@angular/core': {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          includeSecondaries: true,
        },
        '@angular/common': {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          includeSecondaries: true,
        },
        '@angular/common/http': {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          includeSecondaries: true,
        },
        '@angular/router': {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          includeSecondaries: true,
        },
        rxjs: {
          singleton: true,
          strictVersion: true,
          requiredVersion: 'auto',
          includeSecondaries: true,
        },
        ...sharedMappings.getDescriptors(),
      },
      library: {
        type: 'module',
      },
    }),
    sharedMappings.getPlugin(),
  ],
};`,
};

export const optimizationConfig = {
  correct: `const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
  const mf = require('@angular-architects/module-federation/webpack');
  const path = require('path');
  const share = mf.share;
  mf.setInferVersion(true);
  
  /**
   * We use the NX_TSCONFIG_PATH environment variable when using the @nrwl/angular:webpack-browser
   * builder as it will generate a temporary tsconfig file which contains any required remappings of
   * shared libraries.
   * A remapping will occur when a library is buildable, as webpack needs to know the location of the
   * built files for the buildable library.
   * This NX_TSCONFIG_PATH environment variable is set by the @nrwl/angular:webpack-browser and it contains
   * the location of the generated temporary tsconfig file.
   */
  const tsConfigPath =
    process.env.NX_TSCONFIG_PATH ??
    path.join(__dirname, '../../tsconfig.base.json');
  
  const workspaceRootPath = path.join(__dirname, '../../');
  const sharedMappings = new mf.SharedMappings();
  sharedMappings.register(
    tsConfigPath,
    [
      /* mapped paths to share */
    ],
    workspaceRootPath
  );
  
  module.exports = {
    output: {
      uniqueName: 'host',
      publicPath: 'auto',
    },
    optimization: {
      minimize: true,
      runtimeChunk: false,
    },
    experiments: {
      outputModule: true,
    },
    resolve: {
      alias: {
        ...sharedMappings.getAliases(),
      },
    },
    plugins: [
      new ModuleFederationPlugin({
        remotes: {},
        shared: share({
          '@angular/core': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: true,
          },
          '@angular/common': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: true,
          },
          '@angular/common/http': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: true,
          },
          '@angular/router': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: true,
          },
          rxjs: {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: true,
          },
          ...sharedMappings.getDescriptors(),
        }),
        library: {
          type: 'module',
        },
      }),
      sharedMappings.getPlugin(),
    ],
  };`,
  incorrectMissing: `const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
  const mf = require('@angular-architects/module-federation/webpack');
  const path = require('path');
  const share = mf.share;
  mf.setInferVersion(true);
  
  /**
   * We use the NX_TSCONFIG_PATH environment variable when using the @nrwl/angular:webpack-browser
   * builder as it will generate a temporary tsconfig file which contains any required remappings of
   * shared libraries.
   * A remapping will occur when a library is buildable, as webpack needs to know the location of the
   * built files for the buildable library.
   * This NX_TSCONFIG_PATH environment variable is set by the @nrwl/angular:webpack-browser and it contains
   * the location of the generated temporary tsconfig file.
   */
  const tsConfigPath =
    process.env.NX_TSCONFIG_PATH ??
    path.join(__dirname, '../../tsconfig.base.json');
  
  const workspaceRootPath = path.join(__dirname, '../../');
  const sharedMappings = new mf.SharedMappings();
  sharedMappings.register(
    tsConfigPath,
    [
      /* mapped paths to share */
    ],
    workspaceRootPath
  );
  
  module.exports = {
    output: {
      uniqueName: 'host',
      publicPath: 'auto',
    },
    optimization: {
      runtimeChunk: false,
    },
    experiments: {
      outputModule: true,
    },
    resolve: {
      alias: {
        ...sharedMappings.getAliases(),
      },
    },
    plugins: [
      new ModuleFederationPlugin({
        remotes: {},
        shared: share({
          '@angular/core': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: true,
          },
          '@angular/common': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: true,
          },
          '@angular/common/http': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: true,
          },
          '@angular/router': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: true,
          },
          rxjs: {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: true,
          },
          ...sharedMappings.getDescriptors(),
        }),
        library: {
          type: 'module',
        },
      }),
      sharedMappings.getPlugin(),
    ],
  };`,
  incorrectFalse: `const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
  const mf = require('@angular-architects/module-federation/webpack');
  const path = require('path');
  const share = mf.share;
  mf.setInferVersion(true);
  
  /**
   * We use the NX_TSCONFIG_PATH environment variable when using the @nrwl/angular:webpack-browser
   * builder as it will generate a temporary tsconfig file which contains any required remappings of
   * shared libraries.
   * A remapping will occur when a library is buildable, as webpack needs to know the location of the
   * built files for the buildable library.
   * This NX_TSCONFIG_PATH environment variable is set by the @nrwl/angular:webpack-browser and it contains
   * the location of the generated temporary tsconfig file.
   */
  const tsConfigPath =
    process.env.NX_TSCONFIG_PATH ??
    path.join(__dirname, '../../tsconfig.base.json');
  
  const workspaceRootPath = path.join(__dirname, '../../');
  const sharedMappings = new mf.SharedMappings();
  sharedMappings.register(
    tsConfigPath,
    [
      /* mapped paths to share */
    ],
    workspaceRootPath
  );
  
  module.exports = {
    output: {
      uniqueName: 'host',
      publicPath: 'auto',
    },
    optimization: {
      minimize: false,
      runtimeChunk: false,
    },
    experiments: {
      outputModule: true,
    },
    resolve: {
      alias: {
        ...sharedMappings.getAliases(),
      },
    },
    plugins: [
      new ModuleFederationPlugin({
        remotes: {},
        shared: share({
          '@angular/core': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: true,
          },
          '@angular/common': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: true,
          },
          '@angular/common/http': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: true,
          },
          '@angular/router': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: true,
          },
          rxjs: {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: true,
          },
          ...sharedMappings.getDescriptors(),
        }),
        library: {
          type: 'module',
        },
      }),
      sharedMappings.getPlugin(),
    ],
  };`,
};

export const remoteEntryModule = {
  correct: `import { NgModule } from '@angular/core';
  import { CommonModule } from '@angular/common';
  import { RouterModule } from '@angular/router';
  
  import { RemoteEntryComponent } from './entry.component';
  import { FeatLoginModule } from '@mfe-netlify/feat-login';
  
  @NgModule({
    declarations: [RemoteEntryComponent],
    imports: [
      FeatLoginModule,
      CommonModule,
      RouterModule.forChild([
        {
          path: '',
          component: RemoteEntryComponent,
        },
      ]),
    ],
    providers: [],
  })
  export class RemoteEntryModule {}`,
  noBrowserOrCommonModule: `import { NgModule } from '@angular/core';
  import { RouterModule } from '@angular/router';
  
  import { RemoteEntryComponent } from './entry.component';
  import { FeatLoginModule } from '@mfe-netlify/feat-login';
  
  @NgModule({
    declarations: [RemoteEntryComponent],
    imports: [
      FeatLoginModule,
      RouterModule.forChild([
        {
          path: '',
          component: RemoteEntryComponent,
        },
      ]),
    ],
    providers: [],
  })
  export class RemoteEntryModule {}`,
  correctWithNoBrowserOrCommonModule: `import { CommonModule } from '@angular/common';
  import { NgModule } from '@angular/core';
  import { RouterModule } from '@angular/router';
  
  import { RemoteEntryComponent } from './entry.component';
  import { FeatLoginModule } from '@mfe-netlify/feat-login';
  
  @NgModule({
    declarations: [RemoteEntryComponent],
    imports: [
      CommonModule,
      FeatLoginModule,
      RouterModule.forChild([
        {
          path: '',
          component: RemoteEntryComponent,
        },
      ]),
    ],
    providers: [],
  })
  export class RemoteEntryModule {}`,
  onlyBrowserModule: `import { NgModule } from '@angular/core';
  import { BrowserModule } from '@angular/platform-browser';
  import { RouterModule } from '@angular/router';
  
  import { RemoteEntryComponent } from './entry.component';
  import { FeatLoginModule } from '@mfe-netlify/feat-login';
  
  @NgModule({
    declarations: [RemoteEntryComponent],
    imports: [
      FeatLoginModule,
      BrowserModule,
      RouterModule.forChild([
        {
          path: '',
          component: RemoteEntryComponent,
        },
      ]),
    ],
    providers: [],
  })
  export class RemoteEntryModule {}`,
  browserModuleWithCommonImportedInFile: `import { CommonModule } from '@angular/common';
  import { NgModule } from '@angular/core';
  import { BrowserModule } from '@angular/platform-browser';
  import { RouterModule } from '@angular/router';
  
  import { RemoteEntryComponent } from './entry.component';
  import { FeatLoginModule } from '@mfe-netlify/feat-login';
  
  @NgModule({
    declarations: [RemoteEntryComponent],
    imports: [
      FeatLoginModule,
      BrowserModule,
      RouterModule.forChild([
        {
          path: '',
          component: RemoteEntryComponent,
        },
      ]),
    ],
    providers: [],
  })
  export class RemoteEntryModule {}`,
  browserModuleWithCommonImportedInArray: `import { CommonModule } from '@angular/common';
  import { NgModule } from '@angular/core';
  import { BrowserModule } from '@angular/platform-browser';
  import { RouterModule } from '@angular/router';
  
  import { RemoteEntryComponent } from './entry.component';
  import { FeatLoginModule } from '@mfe-netlify/feat-login';
  
  @NgModule({
    declarations: [RemoteEntryComponent],
    imports: [
      FeatLoginModule,
      CommonModule,
      BrowserModule,
      RouterModule.forChild([
        {
          path: '',
          component: RemoteEntryComponent,
        },
      ]),
    ],
    providers: [],
  })
  export class RemoteEntryModule {}`,
  correctBrowserModuleWithCommonImportedInArray: `import { CommonModule } from '@angular/common';
  import { NgModule } from '@angular/core';
  import { BrowserModule } from '@angular/platform-browser';
  import { RouterModule } from '@angular/router';
  
  import { RemoteEntryComponent } from './entry.component';
  import { FeatLoginModule } from '@mfe-netlify/feat-login';
  
  @NgModule({
    declarations: [RemoteEntryComponent],
    imports: [
      FeatLoginModule,
      CommonModule,

      RouterModule.forChild([
        {
          path: '',
          component: RemoteEntryComponent,
        },
      ]),
    ],
    providers: [],
  })
  export class RemoteEntryModule {}`,
  correctBrowserModuleWithCommonImportedInFile: `import { CommonModule } from '@angular/common';
  import { NgModule } from '@angular/core';
  import { BrowserModule } from '@angular/platform-browser';
  import { RouterModule } from '@angular/router';
  
  import { RemoteEntryComponent } from './entry.component';
  import { FeatLoginModule } from '@mfe-netlify/feat-login';
  
  @NgModule({
    declarations: [RemoteEntryComponent],
    imports: [
      FeatLoginModule,
      CommonModule,
      RouterModule.forChild([
        {
          path: '',
          component: RemoteEntryComponent,
        },
      ]),
    ],
    providers: [],
  })
  export class RemoteEntryModule {}`,
};
