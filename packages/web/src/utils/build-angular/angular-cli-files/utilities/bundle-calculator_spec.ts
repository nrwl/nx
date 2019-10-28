/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { calculateBytes } from './bundle-calculator';

describe('bundle-calculator', () => {
  it('converts an integer with no postfix', () => {
    expect(calculateBytes('0')).toBe(0);
    expect(calculateBytes('5')).toBe(5);
    expect(calculateBytes('190')).toBe(190);
    expect(calculateBytes('92')).toBe(92);
  });

  it('converts a decimal with no postfix', () => {
    expect(calculateBytes('3.14')).toBe(3.14);
    expect(calculateBytes('0.25')).toBe(0.25);
    expect(calculateBytes('90.5')).toBe(90.5);
    expect(calculateBytes('25.0')).toBe(25);
  });

  it('converts an integer with kb postfix', () => {
    expect(calculateBytes('0kb')).toBe(0);
    expect(calculateBytes('5kb')).toBe(5 * 1024);
    expect(calculateBytes('190KB')).toBe(190 * 1024);
    expect(calculateBytes('92Kb')).toBe(92 * 1024);
    expect(calculateBytes('25kB')).toBe(25 * 1024);
  });

  it('converts a decimal with kb postfix', () => {
    expect(calculateBytes('3.14kb')).toBe(3.14 * 1024);
    expect(calculateBytes('0.25KB')).toBe(0.25 * 1024);
    expect(calculateBytes('90.5Kb')).toBe(90.5 * 1024);
    expect(calculateBytes('25.0kB')).toBe(25 * 1024);
  });

  it('converts an integer with mb postfix', () => {
    expect(calculateBytes('0mb')).toBe(0);
    expect(calculateBytes('5mb')).toBe(5 * 1024 * 1024);
    expect(calculateBytes('190MB')).toBe(190 * 1024 * 1024);
    expect(calculateBytes('92Mb')).toBe(92 * 1024 * 1024);
    expect(calculateBytes('25mB')).toBe(25 * 1024 * 1024);
  });

  it('converts a decimal with mb postfix', () => {
    expect(calculateBytes('3.14mb')).toBe(3.14 * 1024 * 1024);
    expect(calculateBytes('0.25MB')).toBe(0.25 * 1024 * 1024);
    expect(calculateBytes('90.5Mb')).toBe(90.5 * 1024 * 1024);
    expect(calculateBytes('25.0mB')).toBe(25 * 1024 * 1024);
  });

  it('converts an integer with gb postfix', () => {
    expect(calculateBytes('0gb')).toBe(0);
    expect(calculateBytes('5gb')).toBe(5 * 1024 * 1024 * 1024);
    expect(calculateBytes('190GB')).toBe(190 * 1024 * 1024 * 1024);
    expect(calculateBytes('92Gb')).toBe(92 * 1024 * 1024 * 1024);
    expect(calculateBytes('25gB')).toBe(25 * 1024 * 1024 * 1024);
  });

  it('converts a decimal with gb postfix', () => {
    expect(calculateBytes('3.14gb')).toBe(3.14 * 1024 * 1024 * 1024);
    expect(calculateBytes('0.25GB')).toBe(0.25 * 1024 * 1024 * 1024);
    expect(calculateBytes('90.5Gb')).toBe(90.5 * 1024 * 1024 * 1024);
    expect(calculateBytes('25.0gB')).toBe(25 * 1024 * 1024 * 1024);
  });

  it ('converts a decimal with mb and baseline', () => {
    expect(calculateBytes('3mb', '5mb', -1)).toBe(2 * 1024 * 1024);
  });

  it ('converts a percentage with baseline', () => {
    expect(calculateBytes('20%', '1mb')).toBe(1024 * 1024 * 1.2);
    expect(calculateBytes('20%', '1mb', -1)).toBe(1024 * 1024 * 0.8);
  });

  it ('supports whitespace', () => {
    expect(calculateBytes(' 5kb ')).toBe(5 * 1024);
    expect(calculateBytes('0.25 MB')).toBe(0.25 * 1024 * 1024);
    expect(calculateBytes(' 20 % ', ' 1 mb ')).toBe(1024 * 1024 * 1.2);
  });
});
