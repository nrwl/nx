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
let BARE_KEY = /^[a-z0-9-_]+$/i;
function extendedTypeOf(obj) {
    let type = typeof obj;
    if (type === 'object') {
        if (Array.isArray(obj))
            return 'array';
        if (obj instanceof Date)
            return 'date';
    }
    return type;
}
function isArrayOfTables(obj) {
    for (let i = 0; i < obj.length; i++) {
        if (extendedTypeOf(obj[i]) !== 'object')
            return false;
    }
    return obj.length != 0;
}
function formatString(s) {
    return JSON.stringify(s).replace(/\x7f/g, '\\u007f');
}
function stringifyValue(val, type, depth, numberAsFloat) {
    if (depth === 0) {
        throw new Error('Could not stringify the object: maximum object depth exceeded');
    }
    if (type === 'number') {
        if (isNaN(val))
            return 'nan';
        if (val === Infinity)
            return 'inf';
        if (val === -Infinity)
            return '-inf';
        if (numberAsFloat && Number.isInteger(val))
            return val.toFixed(1);
        return val.toString();
    }
    if (type === 'bigint' || type === 'boolean') {
        return val.toString();
    }
    if (type === 'string') {
        return formatString(val);
    }
    if (type === 'date') {
        if (isNaN(val.getTime())) {
            throw new TypeError('cannot serialize invalid date');
        }
        return val.toISOString();
    }
    if (type === 'object') {
        return stringifyInlineTable(val, depth, numberAsFloat);
    }
    if (type === 'array') {
        return stringifyArray(val, depth, numberAsFloat);
    }
}
function stringifyInlineTable(obj, depth, numberAsFloat) {
    let keys = Object.keys(obj);
    if (keys.length === 0)
        return '{}';
    let res = '{ ';
    for (let i = 0; i < keys.length; i++) {
        let k = keys[i];
        if (i)
            res += ', ';
        res += BARE_KEY.test(k) ? k : formatString(k);
        res += ' = ';
        res += stringifyValue(obj[k], extendedTypeOf(obj[k]), depth - 1, numberAsFloat);
    }
    return res + ' }';
}
function stringifyArray(array, depth, numberAsFloat) {
    if (array.length === 0)
        return '[]';
    let res = '[ ';
    for (let i = 0; i < array.length; i++) {
        if (i)
            res += ', ';
        if (array[i] === null || array[i] === void 0) {
            throw new TypeError('arrays cannot contain null or undefined values');
        }
        res += stringifyValue(array[i], extendedTypeOf(array[i]), depth - 1, numberAsFloat);
    }
    return res + ' ]';
}
function stringifyArrayTable(array, key, depth, numberAsFloat) {
    if (depth === 0) {
        throw new Error('Could not stringify the object: maximum object depth exceeded');
    }
    let res = '';
    for (let i = 0; i < array.length; i++) {
        res += `${res && '\n'}[[${key}]]\n`;
        res += stringifyTable(0, array[i], key, depth, numberAsFloat);
    }
    return res;
}
function stringifyTable(tableKey, obj, prefix, depth, numberAsFloat) {
    if (depth === 0) {
        throw new Error('Could not stringify the object: maximum object depth exceeded');
    }
    let preamble = '';
    let tables = '';
    let keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
        let k = keys[i];
        if (obj[k] !== null && obj[k] !== void 0) {
            let type = extendedTypeOf(obj[k]);
            if (type === 'symbol' || type === 'function') {
                throw new TypeError(`cannot serialize values of type '${type}'`);
            }
            let key = BARE_KEY.test(k) ? k : formatString(k);
            if (type === 'array' && isArrayOfTables(obj[k])) {
                tables += (tables && '\n') + stringifyArrayTable(obj[k], prefix ? `${prefix}.${key}` : key, depth - 1, numberAsFloat);
            }
            else if (type === 'object') {
                let tblKey = prefix ? `${prefix}.${key}` : key;
                tables += (tables && '\n') + stringifyTable(tblKey, obj[k], tblKey, depth - 1, numberAsFloat);
            }
            else {
                preamble += key;
                preamble += ' = ';
                preamble += stringifyValue(obj[k], type, depth, numberAsFloat);
                preamble += '\n';
            }
        }
    }
    if (tableKey && (preamble || !tables)) // Create table only if necessary
        preamble = preamble ? `[${tableKey}]\n${preamble}` : `[${tableKey}]`;
    return preamble && tables
        ? `${preamble}\n${tables}`
        : preamble || tables;
}
export function stringify(obj, { maxDepth = 1000, numbersAsFloat = false } = {}) {
    if (extendedTypeOf(obj) !== 'object') {
        throw new TypeError('stringify can only be called with an object');
    }
    let str = stringifyTable(0, obj, '', maxDepth, numbersAsFloat);
    if (str[str.length - 1] !== '\n')
        return str + '\n';
    return str;
}
