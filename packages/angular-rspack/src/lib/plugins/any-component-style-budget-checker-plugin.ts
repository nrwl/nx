/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  BudgetAsset,
  BudgetEntry,
  BudgetType,
  ThresholdSeverity,
  checkBudgets,
} from '@angular/build/private';
import * as path from 'node:path';
import { Compilation, type Compiler, RspackPluginInstance } from '@rspack/core';
import { addError, addWarning } from '../utils/rspack-diagnostics';
import { assertNever } from '../utils/misc-helpers';

const PLUGIN_NAME = 'AnyComponentStyleBudgetChecker';

/**
 * Check budget sizes for component styles by emitting a warning or error if a
 * budget is exceeded by a particular component's styles.
 */
export class AnyComponentStyleBudgetChecker implements RspackPluginInstance {
  private readonly budgets: BudgetEntry[];

  constructor(budgets: BudgetEntry[]) {
    this.budgets = budgets.filter(
      (budget) => budget.type === BudgetType.AnyComponentStyle
    );
  }

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: Compilation.PROCESS_ASSETS_STAGE_ANALYSE,
        },
        () => {
          // No budgets.
          if (this.budgets.length === 0) {
            return;
          }

          // In AOT compilations component styles get processed in child compilations.
          if (!compilation.compiler.parentCompilation) {
            return;
          }

          const cssExtensions = ['.css', '.scss', '.less', '.sass'];

          const componentStyles: BudgetAsset[] = Object.keys(compilation.assets)
            .filter((name) => cssExtensions.includes(path.extname(name)))
            .map((name) => ({
              name,
              size: compilation.assets[name].size(),
              componentStyle: true,
            }));

          for (const { severity, message } of checkBudgets(
            this.budgets,
            { chunks: [], assets: componentStyles },
            true
          )) {
            switch (severity) {
              case ThresholdSeverity.Warning:
                addWarning(compilation, message);
                break;
              case ThresholdSeverity.Error:
                addError(compilation, message);
                break;
              default:
                assertNever(severity);
            }
          }
        }
      );
    });
  }
}
