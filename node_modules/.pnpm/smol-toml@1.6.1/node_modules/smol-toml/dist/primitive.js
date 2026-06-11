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
import { skipVoid } from './util.js';
import { TomlDate } from './date.js';
import { TomlError } from './error.js';
let INT_REGEX = /^((0x[0-9a-fA-F](_?[0-9a-fA-F])*)|(([+-]|0[ob])?\d(_?\d)*))$/;
let FLOAT_REGEX = /^[+-]?\d(_?\d)*(\.\d(_?\d)*)?([eE][+-]?\d(_?\d)*)?$/;
let LEADING_ZERO = /^[+-]?0[0-9_]/;
let ESCAPE_REGEX = /^[0-9a-f]{2,8}$/i;
let ESC_MAP = {
    b: '\b',
    t: '\t',
    n: '\n',
    f: '\f',
    r: '\r',
    e: '\x1b',
    '"': '"',
    '\\': '\\',
};
export function parseString(str, ptr = 0, endPtr = str.length) {
    let isLiteral = str[ptr] === '\'';
    let isMultiline = str[ptr++] === str[ptr] && str[ptr] === str[ptr + 1];
    if (isMultiline) {
        endPtr -= 2;
        if (str[ptr += 2] === '\r')
            ptr++;
        if (str[ptr] === '\n')
            ptr++;
    }
    let tmp = 0;
    let isEscape;
    let parsed = '';
    let sliceStart = ptr;
    while (ptr < endPtr - 1) {
        let c = str[ptr++];
        if (c === '\n' || (c === '\r' && str[ptr] === '\n')) {
            if (!isMultiline) {
                throw new TomlError('newlines are not allowed in strings', {
                    toml: str,
                    ptr: ptr - 1,
                });
            }
        }
        else if ((c < '\x20' && c !== '\t') || c === '\x7f') {
            throw new TomlError('control characters are not allowed in strings', {
                toml: str,
                ptr: ptr - 1,
            });
        }
        if (isEscape) {
            isEscape = false;
            if (c === 'x' || c === 'u' || c === 'U') {
                // Unicode escape
                let code = str.slice(ptr, (ptr += (c === 'x' ? 2 : c === 'u' ? 4 : 8)));
                if (!ESCAPE_REGEX.test(code)) {
                    throw new TomlError('invalid unicode escape', {
                        toml: str,
                        ptr: tmp,
                    });
                }
                try {
                    parsed += String.fromCodePoint(parseInt(code, 16));
                }
                catch {
                    throw new TomlError('invalid unicode escape', {
                        toml: str,
                        ptr: tmp,
                    });
                }
            }
            else if (isMultiline && (c === '\n' || c === ' ' || c === '\t' || c === '\r')) {
                // Multiline escape
                ptr = skipVoid(str, ptr - 1, true);
                if (str[ptr] !== '\n' && str[ptr] !== '\r') {
                    throw new TomlError('invalid escape: only line-ending whitespace may be escaped', {
                        toml: str,
                        ptr: tmp,
                    });
                }
                ptr = skipVoid(str, ptr);
            }
            else if (c in ESC_MAP) {
                // Classic escape
                parsed += ESC_MAP[c];
            }
            else {
                throw new TomlError('unrecognized escape sequence', {
                    toml: str,
                    ptr: tmp,
                });
            }
            sliceStart = ptr;
        }
        else if (!isLiteral && c === '\\') {
            tmp = ptr - 1;
            isEscape = true;
            parsed += str.slice(sliceStart, tmp);
        }
    }
    return parsed + str.slice(sliceStart, endPtr - 1);
}
export function parseValue(value, toml, ptr, integersAsBigInt) {
    // Constant values
    if (value === 'true')
        return true;
    if (value === 'false')
        return false;
    if (value === '-inf')
        return -Infinity;
    if (value === 'inf' || value === '+inf')
        return Infinity;
    if (value === 'nan' || value === '+nan' || value === '-nan')
        return NaN;
    // Avoid FP representation of -0
    if (value === '-0')
        return integersAsBigInt ? 0n : 0;
    // Numbers
    let isInt = INT_REGEX.test(value);
    if (isInt || FLOAT_REGEX.test(value)) {
        if (LEADING_ZERO.test(value)) {
            throw new TomlError('leading zeroes are not allowed', {
                toml: toml,
                ptr: ptr,
            });
        }
        value = value.replace(/_/g, '');
        let numeric = +value;
        if (isNaN(numeric)) {
            throw new TomlError('invalid number', {
                toml: toml,
                ptr: ptr,
            });
        }
        if (isInt) {
            if ((isInt = !Number.isSafeInteger(numeric)) && !integersAsBigInt) {
                throw new TomlError('integer value cannot be represented losslessly', {
                    toml: toml,
                    ptr: ptr,
                });
            }
            if (isInt || integersAsBigInt === true)
                numeric = BigInt(value);
        }
        return numeric;
    }
    const date = new TomlDate(value);
    if (!date.isValid()) {
        throw new TomlError('invalid value', {
            toml: toml,
            ptr: ptr,
        });
    }
    return date;
}
