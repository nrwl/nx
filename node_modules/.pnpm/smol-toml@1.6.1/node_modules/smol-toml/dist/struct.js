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
import { parseString } from './primitive.js';
import { extractValue } from './extract.js';
import { getStringEnd, indexOfNewline, skipComment, skipVoid } from './util.js';
import { TomlError } from './error.js';
let KEY_PART_RE = /^[a-zA-Z0-9-_]+[ \t]*$/;
export function parseKey(str, ptr, end = '=') {
    let dot = ptr - 1;
    let parsed = [];
    let endPtr = str.indexOf(end, ptr);
    if (endPtr < 0) {
        throw new TomlError('incomplete key-value: cannot find end of key', {
            toml: str,
            ptr: ptr,
        });
    }
    do {
        let c = str[ptr = ++dot];
        // If it's whitespace, ignore
        if (c !== ' ' && c !== '\t') {
            // If it's a string
            if (c === '"' || c === '\'') {
                if (c === str[ptr + 1] && c === str[ptr + 2]) {
                    throw new TomlError('multiline strings are not allowed in keys', {
                        toml: str,
                        ptr: ptr,
                    });
                }
                let eos = getStringEnd(str, ptr);
                if (eos < 0) {
                    throw new TomlError('unfinished string encountered', {
                        toml: str,
                        ptr: ptr,
                    });
                }
                dot = str.indexOf('.', eos);
                let strEnd = str.slice(eos, dot < 0 || dot > endPtr ? endPtr : dot);
                let newLine = indexOfNewline(strEnd);
                if (newLine > -1) {
                    throw new TomlError('newlines are not allowed in keys', {
                        toml: str,
                        ptr: ptr + dot + newLine,
                    });
                }
                if (strEnd.trimStart()) {
                    throw new TomlError('found extra tokens after the string part', {
                        toml: str,
                        ptr: eos,
                    });
                }
                if (endPtr < eos) {
                    endPtr = str.indexOf(end, eos);
                    if (endPtr < 0) {
                        throw new TomlError('incomplete key-value: cannot find end of key', {
                            toml: str,
                            ptr: ptr,
                        });
                    }
                }
                parsed.push(parseString(str, ptr, eos));
            }
            else {
                // Normal raw key part consumption and validation
                dot = str.indexOf('.', ptr);
                let part = str.slice(ptr, dot < 0 || dot > endPtr ? endPtr : dot);
                if (!KEY_PART_RE.test(part)) {
                    throw new TomlError('only letter, numbers, dashes and underscores are allowed in keys', {
                        toml: str,
                        ptr: ptr,
                    });
                }
                parsed.push(part.trimEnd());
            }
        }
        // Until there's no more dot
    } while (dot + 1 && dot < endPtr);
    return [parsed, skipVoid(str, endPtr + 1, true, true)];
}
export function parseInlineTable(str, ptr, depth, integersAsBigInt) {
    let res = {};
    let seen = new Set();
    let c;
    ptr++;
    while ((c = str[ptr++]) !== '}' && c) {
        if (c === ',') {
            throw new TomlError('expected value, found comma', {
                toml: str,
                ptr: ptr - 1,
            });
        }
        else if (c === '#')
            ptr = skipComment(str, ptr);
        else if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') {
            let k;
            let t = res;
            let hasOwn = false;
            let [key, keyEndPtr] = parseKey(str, ptr - 1);
            for (let i = 0; i < key.length; i++) {
                if (i)
                    t = hasOwn ? t[k] : (t[k] = {});
                k = key[i];
                if ((hasOwn = Object.hasOwn(t, k)) && (typeof t[k] !== 'object' || seen.has(t[k]))) {
                    throw new TomlError('trying to redefine an already defined value', {
                        toml: str,
                        ptr: ptr,
                    });
                }
                if (!hasOwn && k === '__proto__') {
                    Object.defineProperty(t, k, { enumerable: true, configurable: true, writable: true });
                }
            }
            if (hasOwn) {
                throw new TomlError('trying to redefine an already defined value', {
                    toml: str,
                    ptr: ptr,
                });
            }
            let [value, valueEndPtr] = extractValue(str, keyEndPtr, '}', depth - 1, integersAsBigInt);
            seen.add(value);
            t[k] = value;
            ptr = valueEndPtr;
        }
    }
    if (!c) {
        throw new TomlError('unfinished table encountered', {
            toml: str,
            ptr: ptr,
        });
    }
    return [res, ptr];
}
export function parseArray(str, ptr, depth, integersAsBigInt) {
    let res = [];
    let c;
    ptr++;
    while ((c = str[ptr++]) !== ']' && c) {
        if (c === ',') {
            throw new TomlError('expected value, found comma', {
                toml: str,
                ptr: ptr - 1,
            });
        }
        else if (c === '#')
            ptr = skipComment(str, ptr);
        else if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') {
            let e = extractValue(str, ptr - 1, ']', depth - 1, integersAsBigInt);
            res.push(e[0]);
            ptr = e[1];
        }
    }
    if (!c) {
        throw new TomlError('unfinished array encountered', {
            toml: str,
            ptr: ptr,
        });
    }
    return [res, ptr];
}
