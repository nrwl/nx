/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Compiler, compilation } from 'webpack';
import { Budget, Type } from '../../browser/schema';
import {
  Size,
  calculateBytes,
  calculateSizes,
} from '../utilities/bundle-calculator';
import { formatSize } from '../utilities/stats';

interface Thresholds {
  maximumWarning?: number;
  maximumError?: number;
  minimumWarning?: number;
  minimumError?: number;
  warningLow?: number;
  warningHigh?: number;
  errorLow?: number;
  errorHigh?: number;
}

export interface BundleBudgetPluginOptions {
  budgets: Budget[];
}

export class BundleBudgetPlugin {
  constructor(private options: BundleBudgetPluginOptions) {}

  apply(compiler: Compiler): void {
    const { budgets } = this.options;

    if (!budgets || budgets.length === 0) {
      return;
    }

    compiler.hooks.compilation.tap(
      'BundleBudgetPlugin',
      (compilation: compilation.Compilation) => {
        compilation.hooks.afterOptimizeChunkAssets.tap(
          'BundleBudgetPlugin',
          () => {
            // In AOT compilations component styles get processed in child compilations.
            // tslint:disable-next-line: no-any
            const parentCompilation = (compilation.compiler as any)
              .parentCompilation;
            if (!parentCompilation) {
              return;
            }

            const filteredBudgets = budgets.filter(
              (budget) => budget.type === Type.AnyComponentStyle
            );
            this.runChecks(filteredBudgets, compilation);
          }
        );
      }
    );

    compiler.hooks.afterEmit.tap(
      'BundleBudgetPlugin',
      (compilation: compilation.Compilation) => {
        const filteredBudgets = budgets.filter(
          (budget) => budget.type !== Type.AnyComponentStyle
        );
        this.runChecks(filteredBudgets, compilation);
      }
    );
  }

  private checkMinimum(
    threshold: number | undefined,
    size: Size,
    messages: string[]
  ) {
    if (threshold) {
      if (threshold > size.size) {
        const sizeDifference = formatSize(threshold - size.size);
        messages.push(
          `budgets, minimum exceeded for ${size.label}. ` +
            `Budget ${formatSize(
              threshold
            )} was not reached by ${sizeDifference}.`
        );
      }
    }
  }

  private checkMaximum(
    threshold: number | undefined,
    size: Size,
    messages: string[]
  ) {
    if (threshold) {
      if (threshold < size.size) {
        const sizeDifference = formatSize(size.size - threshold);
        messages.push(
          `budgets, maximum exceeded for ${size.label}. ` +
            `Budget ${formatSize(threshold)} was exceeded by ${sizeDifference}.`
        );
      }
    }
  }

  private calculate(budget: Budget): Thresholds {
    const thresholds: Thresholds = {};
    if (budget.maximumWarning) {
      thresholds.maximumWarning = calculateBytes(
        budget.maximumWarning,
        budget.baseline,
        1
      );
    }

    if (budget.maximumError) {
      thresholds.maximumError = calculateBytes(
        budget.maximumError,
        budget.baseline,
        1
      );
    }

    if (budget.minimumWarning) {
      thresholds.minimumWarning = calculateBytes(
        budget.minimumWarning,
        budget.baseline,
        -1
      );
    }

    if (budget.minimumError) {
      thresholds.minimumError = calculateBytes(
        budget.minimumError,
        budget.baseline,
        -1
      );
    }

    if (budget.warning) {
      thresholds.warningLow = calculateBytes(
        budget.warning,
        budget.baseline,
        -1
      );
    }

    if (budget.warning) {
      thresholds.warningHigh = calculateBytes(
        budget.warning,
        budget.baseline,
        1
      );
    }

    if (budget.error) {
      thresholds.errorLow = calculateBytes(budget.error, budget.baseline, -1);
    }

    if (budget.error) {
      thresholds.errorHigh = calculateBytes(budget.error, budget.baseline, 1);
    }

    return thresholds;
  }

  private runChecks(budgets: Budget[], compilation: compilation.Compilation) {
    budgets
      .map((budget) => ({
        budget,
        thresholds: this.calculate(budget),
        sizes: calculateSizes(budget, compilation),
      }))
      .forEach((budgetCheck) => {
        budgetCheck.sizes.forEach((size) => {
          this.checkMaximum(
            budgetCheck.thresholds.maximumWarning,
            size,
            compilation.warnings
          );
          this.checkMaximum(
            budgetCheck.thresholds.maximumError,
            size,
            compilation.errors
          );
          this.checkMinimum(
            budgetCheck.thresholds.minimumWarning,
            size,
            compilation.warnings
          );
          this.checkMinimum(
            budgetCheck.thresholds.minimumError,
            size,
            compilation.errors
          );
          this.checkMinimum(
            budgetCheck.thresholds.warningLow,
            size,
            compilation.warnings
          );
          this.checkMaximum(
            budgetCheck.thresholds.warningHigh,
            size,
            compilation.warnings
          );
          this.checkMinimum(
            budgetCheck.thresholds.errorLow,
            size,
            compilation.errors
          );
          this.checkMaximum(
            budgetCheck.thresholds.errorHigh,
            size,
            compilation.errors
          );
        });
      });
  }
}
