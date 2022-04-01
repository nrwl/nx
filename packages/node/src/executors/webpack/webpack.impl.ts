import 'dotenv/config'
import { ExecutorContext } from '@nrwl/devkit'

import { readCachedProjectGraph } from '@nrwl/devkit'
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils'
import { getRootTsConfigPath } from '@nrwl/workspace/src/utilities/typescript'

import { map, mergeMap, tap } from 'rxjs/operators'
import { eachValueFrom } from 'rxjs-for-await'
import { resolve } from 'path'
import { register } from 'ts-node'

import { getNodeWebpackConfig } from '../../utils/node.config'
import { BuildNodeBuilderOptions } from '../../utils/types'
import { normalizeBuildOptions } from '../../utils/normalize'
import { generatePackageJson } from '../../utils/generate-package-json'
import { runWebpack } from '../../utils/run-webpack'
import { from, of } from 'rxjs'
import { Configuration } from 'webpack'

export type NodeBuildEvent = {
  outfile: string
  success: boolean
}

export async function* webpackExecutor(
  rawOptions: BuildNodeBuilderOptions,
  context: ExecutorContext
) {
  const { sourceRoot, root } = context.workspace.projects[context.projectName]

  if (!sourceRoot) {
    throw new Error(`${context.projectName} does not have a sourceRoot.`)
  }

  if (!root) {
    throw new Error(`${context.projectName} does not have a root.`)
  }

  const options = normalizeBuildOptions(
    rawOptions,
    context.root,
    sourceRoot,
    root
  )

  if (options.webpackConfig.some((x) => x.endsWith('.ts'))) {
    registerTsNode()
  }

  const projGraph = readCachedProjectGraph()
  if (!options.buildLibsFromSource) {
    const { target, dependencies } = calculateProjectDependencies(
      projGraph,
      context.root,
      context.projectName,
      context.targetName,
      context.configurationName
    )
    options.tsConfig = createTmpTsConfig(
      options.tsConfig,
      context.root,
      target.data.root,
      dependencies
    )

    if (
      !checkDependentProjectsHaveBeenBuilt(
        context.root,
        context.projectName,
        context.targetName,
        dependencies
      )
    ) {
      return { success: false } as any
    }
  }

  if (options.generatePackageJson) {
    generatePackageJson(context.projectName, projGraph, options)
  }
  const config: Configuration | Configuration[] = await options.webpackConfig.reduce(
    async (currentConfig, plugin) => {
      return require(plugin)(await currentConfig, {
        options,
        configuration: context.configurationName,
      })
    },
    Promise.resolve(getNodeWebpackConfig(options))
  )

  return yield* eachValueFrom(
    (Array.isArray(config) ? from(config) : of(config)).pipe(
      mergeMap((conf) => {
        return runWebpack(conf).pipe(
          tap((stats) => {
            console.info(stats.toString(conf.stats))
          })
        )
      }),
      map((stats) => {
        return {
          success: !stats.hasErrors(),
          outfile: resolve(
            context.root,
            options.outputPath,
            options.outputFileName
          ),
        } as NodeBuildEvent
      })
    )
  )
}

function registerTsNode() {
  const rootTsConfig = getRootTsConfigPath()
  register({
    ...(rootTsConfig ? { project: rootTsConfig } : null),
  })
}

export default webpackExecutor
