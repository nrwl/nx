import { createProjectGraphAsync, logger, workspaceRoot } from '@nx/devkit';
import {
  createI18nOptions as _createI18nOptions,
  createTranslationLoader,
  loadTranslations,
} from '@angular/build/private';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { AngularRspackPluginOptions } from '../../models';
import {
  createProjectRootMappings,
  findProjectForPath,
} from '../../utils/find-project-for-path';
import { relative } from 'node:path';

/**
 * The base module location used to search for locale specific data.
 */
const LOCALE_DATA_BASE_MODULE = '@angular/common/locales/global';

function findLocaleDataPath(
  locale: string,
  resolver: (locale: string) => string
): string | null {
  // Remove private use subtags
  const scrubbedLocale = locale.replace(/-x(-[a-zA-Z0-9]{1,8})+$/, '');

  try {
    return resolver(scrubbedLocale);
  } catch {
    // fallback to known existing en-US locale data as of 14.0
    return scrubbedLocale === 'en-US'
      ? findLocaleDataPath('en', resolver)
      : null;
  }
}

async function getI18nMetadata(
  projectRoot: string,
  i18nMetadata: AngularRspackPluginOptions['i18nMetadata']
) {
  if (i18nMetadata === undefined) {
    return await tryGetI18nMetadataFromProject(projectRoot);
  }
  return i18nMetadata;
}

async function tryGetI18nMetadataFromProject(projectRoot: string) {
  try {
    const graph = await createProjectGraphAsync();
    const projectRootMappings = createProjectRootMappings(graph.nodes);
    const root = projectRoot.startsWith(workspaceRoot)
      ? relative(workspaceRoot, projectRoot)
      : projectRoot;
    const projectName = findProjectForPath(root, projectRootMappings);

    if (!projectName) {
      // Could not find a project the given root
      return undefined;
    }

    const project = graph.nodes[projectName];
    // Need to cast to any as Nx is not aware of the i18n metadata that exists in angular projects
    const projectData = project.data as any;
    if (projectData.i18n && typeof projectData.i18n === 'object') {
      return projectData.i18n;
    }
  } catch {
    // Issue attempting to use the Nx project graph to determine the project to get the i18n metadata.
    return undefined;
  }
}

async function createI18nOptions(
  projectRoot: string,
  options: AngularRspackPluginOptions,
  inline?: boolean | string[],
  ssrEnabled?: boolean
) {
  const i18nMetadata = await getI18nMetadata(projectRoot, options.i18nMetadata);

  return _createI18nOptions({ i18n: i18nMetadata }, inline, logger, ssrEnabled);
}

export async function configureI18n(
  projectRoot: string,
  options: AngularRspackPluginOptions
) {
  if (global.NX_GRAPH_CREATION) {
    return {
      options,
      i18n: {
        inlineLocales: new Set<string>(),
        // en-US is the default locale added to Angular applications (https://angular.dev/guide/i18n/format-data-locale)
        sourceLocale: 'en-US',
        locales: {},
        get shouldInline() {
          return this.inlineLocales.size > 0;
        },
      },
    };
  }
  const i18n = await createI18nOptions(projectRoot, options, options.localize);

  // No additional processing needed if no inlining requested and no source locale defined.
  if (!i18n.shouldInline && !i18n.hasDefinedSourceLocale) {
    return { options, i18n };
  }
  // The trailing slash is required to signal that the path is a directory and not a file.
  const projectRequire = createRequire(projectRoot + '/');
  const localeResolver = (locale: string) =>
    projectRequire.resolve(path.join(LOCALE_DATA_BASE_MODULE, locale));

  // Load locale data and translations (if present)
  let loader;
  const usedFormats = new Set<string>();
  for (const [locale, desc] of Object.entries(i18n.locales)) {
    if (!i18n.inlineLocales.has(locale) && locale !== i18n.sourceLocale) {
      continue;
    }

    let localeDataPath = findLocaleDataPath(locale, localeResolver);
    if (!localeDataPath) {
      const [first] = locale.split('-');
      if (first) {
        localeDataPath = findLocaleDataPath(
          first.toLowerCase(),
          localeResolver
        );
        if (localeDataPath) {
          logger.warn(
            `Locale data for '${locale}' cannot be found. Using locale data for '${first}'.`
          );
        }
      }
    }
    if (!localeDataPath) {
      logger.warn(
        `Locale data for '${locale}' cannot be found. No locale data will be included for this locale.`
      );
    } else {
      desc.dataPath = localeDataPath;
    }

    if (!desc.files.length) {
      continue;
    }

    loader ??= await createTranslationLoader();

    loadTranslations(
      locale,
      desc,
      workspaceRoot,
      loader,
      {
        warn(message) {
          logger.warn(message);
        },
        error(message) {
          throw new Error(message);
        },
      },
      usedFormats,
      options.i18nDuplicateTranslation
    );
  }

  return { options, i18n };
}
