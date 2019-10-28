/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Budget } from '../../browser/schema';

export interface Compilation {
  assets: { [name: string]: { size: () => number } };
  chunks: { name: string, files: string[], isOnlyInitial: () => boolean }[];
  warnings: string[];
  errors: string[];
}

export interface Size {
  size: number;
  label?: string;
}

export function calculateSizes(budget: Budget, compilation: Compilation): Size[] {
  const calculatorMap = {
    all: AllCalculator,
    allScript: AllScriptCalculator,
    any: AnyCalculator,
    anyScript: AnyScriptCalculator,
    anyComponentStyle: AnyComponentStyleCalculator,
    bundle: BundleCalculator,
    initial: InitialCalculator,
  };

  const ctor = calculatorMap[budget.type];
  const calculator = new ctor(budget, compilation);

  return calculator.calculate();
}

export abstract class Calculator {
  constructor (protected budget: Budget, protected compilation: Compilation) {}

  abstract calculate(): Size[];
}

/**
 * A named bundle.
 */
class BundleCalculator extends Calculator {
  calculate() {
    const size: number = this.compilation.chunks
      .filter(chunk => chunk.name === this.budget.name)
      .reduce((files, chunk) => [...files, ...chunk.files], [])
      .filter((file: string) => !file.endsWith('.map'))
      .map((file: string) => this.compilation.assets[file].size())
      .reduce((total: number, size: number) => total + size, 0);

    return [{size, label: this.budget.name}];
  }
}

/**
 * The sum of all initial chunks (marked as initial by webpack).
 */
class InitialCalculator extends Calculator {
  calculate() {
    const initialChunks = this.compilation.chunks.filter(chunk => chunk.isOnlyInitial());
    const size: number = initialChunks
      .reduce((files, chunk) => [...files, ...chunk.files], [])
      .filter((file: string) => !file.endsWith('.map'))
      .map((file: string) => this.compilation.assets[file].size())
      .reduce((total: number, size: number) => total + size, 0);

    return [{size, label: 'initial'}];
  }
}

/**
 * The sum of all the scripts portions.
 */
class AllScriptCalculator extends Calculator {
  calculate() {
    const size: number = Object.keys(this.compilation.assets)
      .filter(key => key.endsWith('.js'))
      .map(key => this.compilation.assets[key])
      .map(asset => asset.size())
      .reduce((total: number, size: number) => total + size, 0);

    return [{size, label: 'total scripts'}];
  }
}

/**
 * All scripts and assets added together.
 */
class AllCalculator extends Calculator {
  calculate() {
    const size: number = Object.keys(this.compilation.assets)
      .filter(key => !key.endsWith('.map'))
      .map(key => this.compilation.assets[key].size())
      .reduce((total: number, size: number) => total + size, 0);

    return [{size, label: 'total'}];
  }
}

/**
 * Any components styles
 */
class AnyComponentStyleCalculator extends Calculator {
  calculate() {
    return Object.keys(this.compilation.assets)
      .filter(key => key.endsWith('.css'))
      .map(key => ({
        size: this.compilation.assets[key].size(),
        label: key,
      }));
  }
}

/**
 * Any script, individually.
 */
class AnyScriptCalculator extends Calculator {
  calculate() {
    return Object.keys(this.compilation.assets)
      .filter(key => key.endsWith('.js'))
      .map(key => {
        const asset = this.compilation.assets[key];

        return {
          size: asset.size(),
          label: key,
        };
      });
  }
}

/**
 * Any script or asset (images, css, etc).
 */
class AnyCalculator extends Calculator {
  calculate() {
    return Object.keys(this.compilation.assets)
      .filter(key => !key.endsWith('.map'))
      .map(key => {
        const asset = this.compilation.assets[key];

        return {
          size: asset.size(),
          label: key,
        };
      });
  }
}

/**
 * Calculate the bytes given a string value.
 */
export function calculateBytes(
  input: string,
  baseline?: string,
  factor: 1 | -1 = 1,
): number {
  const matches = input.match(/^\s*(\d+(?:\.\d+)?)\s*(%|(?:[mM]|[kK]|[gG])?[bB])?\s*$/);
  if (!matches) {
    return NaN;
  }

  const baselineBytes = baseline && calculateBytes(baseline) || 0;

  let value = Number(matches[1]);
  switch (matches[2] && matches[2].toLowerCase()) {
    case '%':
      value = baselineBytes * value / 100;
      break;
    case 'kb':
      value *= 1024;
      break;
    case 'mb':
      value *= 1024 * 1024;
      break;
    case 'gb':
      value *= 1024 * 1024 * 1024;
      break;
  }

  if (baselineBytes === 0) {
    return value;
  }

  return baselineBytes + value * factor;
}
