/*!
 * Copyright (c) Squirrel Chat et al., All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
import type { TomlDate } from './date.js';
export type TomlPrimitive = string | number | bigint | boolean | TomlDate;
export type TomlTable = {
    [key: string]: TomlValue;
};
export type TomlValue = TomlPrimitive | TomlValue[] | TomlTable;
export type TomlTableWithoutBigInt = {
    [key: string]: TomlValueWithoutBigInt;
};
export type TomlValueWithoutBigInt = Exclude<TomlPrimitive, bigint> | TomlValueWithoutBigInt[] | TomlTableWithoutBigInt;
export declare function indexOfNewline(str: string, start?: number, end?: number): number;
export declare function skipComment(str: string, ptr: number): number;
export declare function skipVoid(str: string, ptr: number, banNewLines?: boolean, banComments?: boolean): number;
export declare function skipUntil(str: string, ptr: number, sep: string, end?: string, banNewLines?: boolean): number;
export declare function getStringEnd(str: string, seek: number): number;
