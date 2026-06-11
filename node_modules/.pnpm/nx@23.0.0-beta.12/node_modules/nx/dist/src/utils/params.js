"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaError = void 0;
exports.convertToCamelCase = convertToCamelCase;
exports.coerceTypesInOptions = coerceTypesInOptions;
exports.convertAliases = convertAliases;
exports.validateOptsAgainstSchema = validateOptsAgainstSchema;
exports.validateObject = validateObject;
exports.setDefaults = setDefaults;
exports.applyVerbosity = applyVerbosity;
exports.combineOptionsForExecutor = combineOptionsForExecutor;
exports.combineOptionsForGenerator = combineOptionsForGenerator;
exports.warnDeprecations = warnDeprecations;
exports.convertSmartDefaultsIntoNamedParams = convertSmartDefaultsIntoNamedParams;
exports.getPromptsForSchema = getPromptsForSchema;
const logger_1 = require("./logger");
const handle_import_1 = require("./handle-import");
function camelCase(input) {
    if (input.indexOf('-') > 1) {
        return input
            .toLowerCase()
            .replace(/-(.)/g, (match, group1) => group1.toUpperCase());
    }
    else {
        return input;
    }
}
function convertToCamelCase(parsed, schema) {
    return Object.keys(parsed).reduce((m, c) => {
        if (schema.properties[camelCase(c)]) {
            return { ...m, [camelCase(c)]: parsed[c] };
        }
        else {
            return { ...m, [c]: parsed[c] };
        }
    }, {});
}
/**
 * Coerces (and replaces) options identified as 'boolean' or 'number' in the Schema
 *
 * @param opts The options to check
 * @param schema The schema definition with types to check against
 *
 */
function coerceTypesInOptions(opts, schema) {
    Object.keys(opts).forEach((k) => {
        const prop = findSchemaForProperty(k, schema);
        opts[k] = coerceType(prop?.description, opts[k]);
    });
    return opts;
}
function coerceType(prop, value) {
    if (!prop)
        return value;
    if (typeof value !== 'string' && value !== undefined)
        return value;
    if (prop.oneOf) {
        for (let i = 0; i < prop.oneOf.length; ++i) {
            const coerced = coerceType(prop.oneOf[i], value);
            if (coerced !== value) {
                return coerced;
            }
        }
        return value;
    }
    else if (Array.isArray(prop.type)) {
        for (let i = 0; i < prop.type.length; ++i) {
            const coerced = coerceType({ type: prop.type[i] }, value);
            if (coerced !== value) {
                return coerced;
            }
        }
        return value;
    }
    else if (normalizedPrimitiveType(prop.type) == 'boolean' &&
        isConvertibleToBoolean(value)) {
        return value === true || value == 'true';
    }
    else if (normalizedPrimitiveType(prop.type) == 'number' &&
        isConvertibleToNumber(value)) {
        return Number(value);
    }
    else if (prop.type == 'array') {
        const itemSchema = Array.isArray(prop.items) ? undefined : prop.items;
        return value.split(',').map((v) => coerceType(itemSchema, v));
    }
    else {
        return value;
    }
}
/**
 * Converts any options passed in with short aliases to their full names if found
 * Unmatched options are added to opts['--']
 *
 * @param opts The options passed in by the user
 * @param schema The schema definition to check against
 */
function convertAliases(opts, schema, excludeUnmatched) {
    return Object.keys(opts).reduce((acc, k) => {
        const prop = findSchemaForProperty(k, schema);
        if (prop) {
            acc[prop.name] = opts[k];
        }
        else if (excludeUnmatched) {
            if (!acc['--']) {
                acc['--'] = [];
            }
            acc['--'].push({
                name: k,
                possible: [],
            });
        }
        else {
            acc[k] = opts[k];
        }
        return acc;
    }, {});
}
class SchemaError {
    constructor(message) {
        this.message = message;
    }
}
exports.SchemaError = SchemaError;
function validateOptsAgainstSchema(opts, schema) {
    validateObject(opts, schema, schema.definitions || {});
}
function validateObject(opts, schema, definitions) {
    if (schema.anyOf) {
        const errors = [];
        for (const s of schema.anyOf) {
            try {
                validateObject(opts, s, definitions);
            }
            catch (e) {
                errors.push(e);
            }
        }
        if (errors.length === schema.anyOf.length) {
            throw new Error(`Options did not match schema. Please fix any of the following errors:\n${errors
                .map((e) => ' - ' + e.message)
                .join('\n')}`);
        }
    }
    if (schema.oneOf) {
        const matches = [];
        const errors = [];
        for (const propertyDescription of schema.oneOf) {
            try {
                validateObject(opts, propertyDescription, definitions);
                matches.push(propertyDescription);
            }
            catch (error) {
                errors.push(error);
            }
        }
        // If the options matched none of the oneOf property descriptions
        if (matches.length === 0) {
            throw new Error(`Options did not match schema: ${JSON.stringify(opts, null, 2)}.\nPlease fix 1 of the following errors:\n${errors
                .map((e) => ' - ' + e.message)
                .join('\n')}`);
        }
        // If the options matched none of the oneOf property descriptions
        if (matches.length > 1) {
            throw new Error(`Options did not match schema: ${JSON.stringify(opts, null, 2)}.\nShould only match one of \n${matches
                .map((m) => ' - ' + JSON.stringify(m))
                .join('\n')}`);
        }
    }
    (schema.required ?? []).forEach((p) => {
        if (opts[p] === undefined) {
            throw new SchemaError(`Required property '${p}' is missing`);
        }
    });
    if (schema.additionalProperties !== undefined &&
        schema.additionalProperties !== true) {
        Object.keys(opts).find((p) => {
            if (Object.keys(schema.properties ?? {}).indexOf(p) === -1 &&
                (!schema.patternProperties ||
                    !Object.keys(schema.patternProperties).some((pattern) => new RegExp(pattern).test(p)))) {
                if (p === '_') {
                    throw new SchemaError(`Schema does not support positional arguments. Argument '${opts[p]}' found`);
                }
                else if (schema.additionalProperties === false) {
                    throw new SchemaError(`'${p}' is not found in schema`);
                }
                else if (typeof schema.additionalProperties === 'object') {
                    validateProperty(p, opts[p], schema.additionalProperties, definitions);
                }
            }
        });
    }
    Object.keys(opts).forEach((p) => {
        validateProperty(p, opts[p], (schema.properties ?? {})[p], definitions);
        if (schema.patternProperties) {
            Object.keys(schema.patternProperties).forEach((pattern) => {
                if (new RegExp(pattern).test(p)) {
                    validateProperty(p, opts[p], schema.patternProperties[pattern], definitions);
                }
            });
        }
    });
}
function validateProperty(propName, value, schema, definitions) {
    if (!schema)
        return;
    if (schema.$ref) {
        schema = resolveDefinition(schema.$ref, definitions);
    }
    if (schema.oneOf) {
        if (!Array.isArray(schema.oneOf))
            throw new Error(`Invalid schema file. oneOf must be an array.`);
        const passes = schema.oneOf.filter((r) => {
            try {
                const rule = { type: schema.type, ...r };
                validateProperty(propName, value, rule, definitions);
                return true;
            }
            catch (e) {
                return false;
            }
        }).length === 1;
        if (!passes)
            throwInvalidSchema(propName, schema);
        return;
    }
    if (schema.anyOf) {
        if (!Array.isArray(schema.anyOf))
            throw new Error(`Invalid schema file. anyOf must be an array.`);
        let passes = false;
        schema.anyOf.forEach((r) => {
            try {
                const rule = { type: schema.type, ...r };
                validateProperty(propName, value, rule, definitions);
                passes = true;
            }
            catch (e) { }
        });
        if (!passes)
            throwInvalidSchema(propName, schema);
        return;
    }
    if (schema.allOf) {
        if (!Array.isArray(schema.allOf))
            throw new Error(`Invalid schema file. allOf must be an array.`);
        if (!schema.allOf.every((r) => {
            try {
                const rule = { type: schema.type, ...r };
                validateProperty(propName, value, rule, definitions);
                return true;
            }
            catch (e) {
                return false;
            }
        })) {
            throwInvalidSchema(propName, schema);
        }
        return;
    }
    const isPrimitive = typeof value !== 'object';
    if (isPrimitive) {
        if (schema.const !== undefined && value !== schema.const) {
            throw new SchemaError(`Property '${propName}' does not match the schema. '${value}' should be '${schema.const}'.`);
        }
        if (Array.isArray(schema.type)) {
            const passes = schema.type.some((t) => {
                try {
                    const rule = { type: t };
                    validateProperty(propName, value, rule, definitions);
                    return true;
                }
                catch (e) {
                    return false;
                }
            });
            if (!passes) {
                throw new SchemaError(`Property '${propName}' does not match the schema. '${value}' should be a '${schema.type}'.`);
            }
        }
        else if (schema.type &&
            typeof value !== normalizedPrimitiveType(schema.type)) {
            throw new SchemaError(`Property '${propName}' does not match the schema. '${value}' should be a '${schema.type}'.`);
        }
        if (schema.enum && !schema.enum.includes(value)) {
            throw new SchemaError(`Property '${propName}' does not match the schema. '${value}' should be one of ${schema.enum.join(',')}.`);
        }
        if (schema.type === 'number') {
            if (typeof schema.multipleOf === 'number' &&
                value % schema.multipleOf !== 0) {
                throw new SchemaError(`Property '${propName}' does not match the schema. ${value} should be a multiple of ${schema.multipleOf}.`);
            }
            if (typeof schema.minimum === 'number' && value < schema.minimum) {
                throw new SchemaError(`Property '${propName}' does not match the schema. ${value} should be at least ${schema.minimum}`);
            }
            if (typeof schema.exclusiveMinimum === 'number' &&
                value <= schema.exclusiveMinimum) {
                throw new SchemaError(`Property '${propName}' does not match the schema. ${value} should be greater than ${schema.exclusiveMinimum}`);
            }
            if (typeof schema.maximum === 'number' && value > schema.maximum) {
                throw new SchemaError(`Property '${propName}' does not match the schema. ${value} should be at most ${schema.maximum}`);
            }
            if (typeof schema.exclusiveMaximum === 'number' &&
                value >= schema.exclusiveMaximum) {
                throw new SchemaError(`Property '${propName}' does not match the schema. ${value} should be less than ${schema.exclusiveMaximum}`);
            }
        }
        if (schema.type === 'string') {
            if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
                throw new SchemaError(`Property '${propName}' does not match the schema. '${value}' should match the pattern '${schema.pattern}'.`);
            }
            if (typeof schema.minLength === 'number' &&
                value.length < schema.minLength) {
                throw new SchemaError(`Property '${propName}' does not match the schema. '${value}' (${value.length} character(s)) should have at least ${schema.minLength} character(s).`);
            }
            if (typeof schema.maxLength === 'number' &&
                value.length > schema.maxLength) {
                throw new SchemaError(`Property '${propName}' does not match the schema. '${value}' (${value.length} character(s)) should have at most ${schema.maxLength} character(s).`);
            }
        }
    }
    else if (Array.isArray(value)) {
        if (schema.type !== 'array')
            throwInvalidSchema(propName, schema);
        if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
            throwInvalidSchema(propName, schema);
        }
        if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
            throwInvalidSchema(propName, schema);
        }
        if (Array.isArray(schema.items)) {
            // Tuple validation: each item is validated against the corresponding positional schema
            value.forEach((valueInArray, index) => {
                if (index < schema.items.length) {
                    validateProperty(propName, valueInArray, schema.items[index], definitions);
                }
                else if (schema.additionalItems === false) {
                    throwInvalidSchema(propName, schema);
                }
                else if (schema.additionalItems &&
                    typeof schema.additionalItems === 'object') {
                    validateProperty(propName, valueInArray, schema.additionalItems, definitions);
                }
                // If additionalItems is not specified or true, additional items are allowed
            });
        }
        else {
            value.forEach((valueInArray) => validateProperty(propName, valueInArray, schema.items || {}, definitions));
        }
    }
    else if (value === null) {
        // Special handling for null since typeof null === 'object' in JavaScript
        // null is valid if schema.type is 'null' or if it's an array containing 'null'
        if (Array.isArray(schema.type)) {
            if (!schema.type.includes('null')) {
                throwInvalidSchema(propName, schema);
            }
        }
        else if (schema.type !== 'null') {
            throwInvalidSchema(propName, schema);
        }
    }
    else {
        if (schema.type !== 'object')
            throwInvalidSchema(propName, schema);
        validateObject(value, schema, definitions);
    }
}
/**
 * Unfortunately, due to use supporting Angular Devkit, we have to do the following
 * conversions.
 */
function normalizedPrimitiveType(type) {
    if (type === 'integer')
        return 'number';
    return type;
}
function throwInvalidSchema(propName, schema) {
    throw new SchemaError(`Property '${propName}' does not match the schema.\n${JSON.stringify(schema, null, 2)}'`);
}
function setDefaults(opts, schema) {
    setDefaultsInObject(opts, schema.properties || {}, schema.definitions || {});
    return opts;
}
function setDefaultsInObject(opts, properties, definitions) {
    Object.keys(properties).forEach((p) => {
        setPropertyDefault(opts, p, properties[p], definitions);
    });
}
function setPropertyDefault(opts, propName, schema, definitions) {
    let defaultValueToSet;
    if (schema.$ref) {
        schema = resolveDefinition(schema.$ref, definitions);
    }
    if (schema.type === 'array') {
        const items = schema.items || {};
        if (opts[propName] &&
            Array.isArray(opts[propName]) &&
            items.type === 'object') {
            opts[propName].forEach((valueInArray) => setDefaultsInObject(valueInArray, items.properties || {}, definitions));
        }
        else if (!opts[propName] && schema.default) {
            defaultValueToSet = schema.default;
        }
    }
    else {
        if (opts[propName] === undefined && schema.default !== undefined) {
            defaultValueToSet = schema.default;
        }
        if (schema.type === 'object') {
            const wasUndefined = opts[propName] === undefined;
            if (!wasUndefined) {
                setDefaultsInObject(opts[propName], schema.properties || {}, definitions);
            }
        }
    }
    if (defaultValueToSet !== undefined) {
        try {
            validateProperty(propName, defaultValueToSet, schema, definitions);
            opts[propName] = defaultValueToSet;
        }
        catch (e) {
            // If the default value is invalid, we don't set it...
            // this should honestly never be needed... but some notable
            // 3rd party schema's are invalid.
        }
    }
}
function resolveDefinition(ref, definitions) {
    if (!ref.startsWith('#/definitions/')) {
        throw new Error(`$ref should start with "#/definitions/"`);
    }
    const definition = ref.split('#/definitions/')[1];
    if (!definitions[definition]) {
        throw new Error(`Cannot resolve ${ref}`);
    }
    return definitions[definition];
}
function applyVerbosity(options, schema, isVerbose) {
    if ((schema.additionalProperties === true || 'verbose' in schema.properties) &&
        isVerbose) {
        options['verbose'] = true;
    }
}
function combineOptionsForExecutor(commandLineOpts, config, target, schema, defaultProjectName, relativeCwd, isVerbose = false) {
    const r = convertAliases(coerceTypesInOptions(convertToCamelCase(commandLineOpts, schema), schema), schema, false);
    let combined = target.options || {};
    if (config && target.configurations && target.configurations[config]) {
        Object.assign(combined, target.configurations[config]);
    }
    combined = convertAliases(combined, schema, false);
    Object.assign(combined, r);
    convertSmartDefaultsIntoNamedParams(combined, schema, defaultProjectName, relativeCwd);
    warnDeprecations(combined, schema);
    setDefaults(combined, schema);
    validateOptsAgainstSchema(combined, schema);
    applyVerbosity(combined, schema, isVerbose);
    return combined;
}
async function combineOptionsForGenerator(commandLineOpts, collectionName, generatorName, projectsConfigurations, nxJsonConfiguration, schema, isInteractive, defaultProjectName, relativeCwd, isVerbose = false) {
    const generatorDefaults = projectsConfigurations
        ? getGeneratorDefaults(defaultProjectName, projectsConfigurations, nxJsonConfiguration, collectionName, generatorName)
        : {};
    let combined = convertAliases(coerceTypesInOptions({ ...generatorDefaults, ...commandLineOpts }, schema), schema, false);
    warnDeprecations(combined, schema);
    convertSmartDefaultsIntoNamedParams(combined, schema, defaultProjectName, relativeCwd);
    if (isInteractive && isTTY()) {
        combined = await promptForValues(combined, schema, projectsConfigurations);
    }
    setDefaults(combined, schema);
    validateOptsAgainstSchema(combined, schema);
    applyVerbosity(combined, schema, isVerbose);
    return combined;
}
function warnDeprecations(opts, schema) {
    Object.keys(opts).forEach((option) => {
        const deprecated = schema.properties[option]?.['x-deprecated'];
        if (deprecated) {
            logger_1.logger.warn(`Option "${option}" is deprecated${typeof deprecated == 'string' ? ': ' + deprecated : '.'}`);
        }
    });
}
function convertSmartDefaultsIntoNamedParams(opts, schema, defaultProjectName, relativeCwd) {
    const argv = opts['_'] || [];
    const usedPositionalArgs = {};
    Object.entries(schema.properties).forEach(([k, v]) => {
        if (opts[k] === undefined &&
            v.$default !== undefined &&
            v.$default.$source === 'argv' &&
            argv[v.$default.index]) {
            usedPositionalArgs[v.$default.index] = true;
            opts[k] = coerceType(v, argv[v.$default.index]);
        }
        else if (v.$default !== undefined && v.$default.$source === 'unparsed') {
            opts[k] = opts['__overrides_unparsed__'] || [];
        }
        else if (opts[k] === undefined &&
            v.$default !== undefined &&
            v.$default.$source === 'projectName' &&
            defaultProjectName) {
            opts[k] = defaultProjectName;
        }
        else if (opts[k] === undefined &&
            v.format === 'path' &&
            v.visible === false &&
            relativeCwd) {
            opts[k] = relativeCwd.replace(/\\/g, '/');
        }
        else if (opts[k] === undefined &&
            v.$default !== undefined &&
            v.$default.$source === 'workingDirectory' &&
            relativeCwd) {
            opts[k] = relativeCwd.replace(/\\/g, '/');
        }
    });
    const leftOverPositionalArgs = [];
    for (let i = 0; i < argv.length; ++i) {
        if (!usedPositionalArgs[i]) {
            leftOverPositionalArgs.push(argv[i]);
        }
    }
    if (leftOverPositionalArgs.length === 0) {
        delete opts['_'];
    }
    else {
        opts['_'] = leftOverPositionalArgs;
    }
    delete opts['__overrides_unparsed__'];
}
function getGeneratorDefaults(projectName, projectsConfigurations, nxJsonConfiguration, collectionName, generatorName) {
    let defaults = {};
    if (nxJsonConfiguration?.generators) {
        if (nxJsonConfiguration.generators[collectionName]?.[generatorName]) {
            defaults = {
                ...defaults,
                ...nxJsonConfiguration.generators[collectionName][generatorName],
            };
        }
        if (nxJsonConfiguration.generators[`${collectionName}:${generatorName}`]) {
            defaults = {
                ...defaults,
                ...nxJsonConfiguration.generators[`${collectionName}:${generatorName}`],
            };
        }
    }
    if (projectName &&
        projectsConfigurations?.projects[projectName]?.generators) {
        const g = projectsConfigurations.projects[projectName].generators;
        if (g[collectionName] && g[collectionName][generatorName]) {
            defaults = { ...defaults, ...g[collectionName][generatorName] };
        }
        if (g[`${collectionName}:${generatorName}`]) {
            defaults = {
                ...defaults,
                ...g[`${collectionName}:${generatorName}`],
            };
        }
    }
    return defaults;
}
function getPromptsForSchema(opts, schema, projectsConfigurations) {
    const prompts = [];
    Object.entries(schema.properties).forEach(([k, v]) => {
        if (v['x-prompt'] && opts[k] === undefined) {
            const question = {
                name: k,
            };
            if (v.default) {
                question.initial = v.default;
            }
            // Normalize x-prompt
            if (typeof v['x-prompt'] === 'string') {
                const message = v['x-prompt'];
                if (v.type === 'boolean') {
                    v['x-prompt'] = {
                        type: 'confirm',
                        message,
                    };
                }
                else if (v.type === 'array' &&
                    !Array.isArray(v.items) &&
                    v.items?.enum) {
                    v['x-prompt'] = {
                        type: 'multiselect',
                        items: v.items.enum,
                        message,
                    };
                }
                else {
                    v['x-prompt'] = {
                        type: 'input',
                        message,
                    };
                }
            }
            question.message = v['x-prompt'].message;
            question.validate = (s) => {
                try {
                    validateProperty(k, s, v, schema.definitions || {});
                    return true;
                }
                catch (e) {
                    return e.message;
                }
            };
            // Limit the number of choices displayed so that the prompt fits on the screen
            const limitForChoicesDisplayed = process.stdout.rows - question.message.split('\n').length;
            if (v.type === 'string' && v.enum && Array.isArray(v.enum)) {
                question.type = 'autocomplete';
                question.choices = [...v.enum];
                question.limit = limitForChoicesDisplayed;
            }
            else if (v.type === 'string' &&
                (v.$default?.$source === 'projectName' ||
                    k === 'project' ||
                    k === 'projectName' ||
                    v['x-dropdown'] === 'projects') &&
                projectsConfigurations) {
                question.type = 'autocomplete';
                question.choices = Object.keys(projectsConfigurations.projects);
                question.limit = limitForChoicesDisplayed;
            }
            else if (v.type === 'number' || v['x-prompt'].type == 'number') {
                question.type = 'numeral';
            }
            else if (v['x-prompt'].type == 'confirmation' ||
                v['x-prompt'].type == 'confirm') {
                question.type = 'confirm';
            }
            else if (v['x-prompt'].items) {
                question.type =
                    v['x-prompt'].multiselect || v.type === 'array'
                        ? 'multiselect'
                        : 'autocomplete';
                question.choices =
                    v['x-prompt'].items &&
                        v['x-prompt'].items.map((item) => {
                            if (typeof item == 'string') {
                                return item;
                            }
                            else {
                                return {
                                    message: item.label,
                                    name: item.value,
                                };
                            }
                        });
                question.limit = limitForChoicesDisplayed;
            }
            else if (v.type === 'boolean') {
                question.type = 'confirm';
            }
            else {
                question.type = 'input';
            }
            prompts.push(question);
        }
    });
    return prompts;
}
async function promptForValues(opts, schema, projectsConfigurations) {
    return await (await (0, handle_import_1.handleImport)('enquirer'))
        .prompt(getPromptsForSchema(opts, schema, projectsConfigurations))
        .then((values) => ({ ...opts, ...values }))
        .catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
function findSchemaForProperty(propName, schema) {
    if (propName in schema.properties) {
        return {
            name: propName,
            description: schema.properties[propName],
        };
    }
    const found = Object.entries(schema.properties).find(([_, d]) => d.alias === propName ||
        (Array.isArray(d.aliases) && d.aliases.includes(propName)));
    if (found) {
        const [name, description] = found;
        return { name, description };
    }
    return null;
}
function isTTY() {
    return !!process.stdout.isTTY && process.env['CI'] !== 'true';
}
/**
 * Verifies whether the given value can be converted to a boolean
 * @param value
 */
function isConvertibleToBoolean(value) {
    if ('boolean' === typeof value) {
        return true;
    }
    if ('string' === typeof value && /true|false/.test(value)) {
        return true;
    }
    return false;
}
/**
 * Verifies whether the given value can be converted to a number
 * @param value
 */
function isConvertibleToNumber(value) {
    // exclude booleans explicitly
    if ('boolean' === typeof value) {
        return false;
    }
    return !isNaN(+value);
}
