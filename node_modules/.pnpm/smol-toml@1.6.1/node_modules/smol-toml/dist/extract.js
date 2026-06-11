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
import { parseString, parseValue } from './primitive.js';
import { parseArray, parseInlineTable } from './struct.js';
import { skipVoid, skipUntil, skipComment, getStringEnd } from './util.js';
import { TomlError } from './error.js';
function sliceAndTrimEndOf(str, startPtr, endPtr) {
    let value = str.slice(startPtr, endPtr);
    let commentIdx = value.indexOf('#');
    if (commentIdx > -1) {
        // The call to skipComment allows to "validate" the comment
        // (absence of control characters)
        skipComment(str, commentIdx);
        value = value.slice(0, commentIdx);
    }
    return [value.trimEnd(), commentIdx];
}
export function extractValue(str, ptr, end, depth, integersAsBigInt) {
    if (depth === 0) {
        throw new TomlError('document contains excessively nested structures. aborting.', {
            toml: str,
            ptr: ptr
        });
    }
    let c = str[ptr];
    if (c === '[' || c === '{') {
        let [value, endPtr] = c === '['
            ? parseArray(str, ptr, depth, integersAsBigInt)
            : parseInlineTable(str, ptr, depth, integersAsBigInt);
        if (end) {
            endPtr = skipVoid(str, endPtr);
            if (str[endPtr] === ',')
                endPtr++;
            else if (str[endPtr] !== end) {
                throw new TomlError('expected comma or end of structure', {
                    toml: str,
                    ptr: endPtr,
                });
            }
        }
        return [value, endPtr];
    }
    let endPtr;
    if (c === '"' || c === "'") {
        endPtr = getStringEnd(str, ptr);
        let parsed = parseString(str, ptr, endPtr);
        if (end) {
            endPtr = skipVoid(str, endPtr);
            if (str[endPtr] && str[endPtr] !== ',' && str[endPtr] !== end && str[endPtr] !== '\n' && str[endPtr] !== '\r') {
                throw new TomlError('unexpected character encountered', {
                    toml: str,
                    ptr: endPtr,
                });
            }
            endPtr += (+(str[endPtr] === ','));
        }
        return [parsed, endPtr];
    }
    endPtr = skipUntil(str, ptr, ',', end);
    let slice = sliceAndTrimEndOf(str, ptr, endPtr - (+(str[endPtr - 1] === ',')));
    if (!slice[0]) {
        throw new TomlError('incomplete key-value declaration: no value specified', {
            toml: str,
            ptr: ptr
        });
    }
    if (end && slice[1] > -1) {
        endPtr = skipVoid(str, ptr + slice[1]);
        endPtr += +(str[endPtr] === ',');
    }
    return [
        parseValue(slice[0], str, ptr, integersAsBigInt),
        endPtr,
    ];
}
