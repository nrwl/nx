import * as parse5 from 'parse5';
import {
    addThisPrefix,
    addThisPrefixSafe,
    expressionUsesVariable,
    extractRootIdentifier,
    parseInterpolations,
    parsePipedExpression,
    renameVariable,
    transformForExpression,
    transformForExpressionKeepIterator,
    transformPipedExpression
} from './ExpressionTransformer.js';
import type { ControlFlow, TemplateBinding } from './types.js';

type Parse5Node = parse5.DefaultTreeAdapterMap['node'];
type Parse5Element = parse5.DefaultTreeAdapterMap['element'];

export class CodeGenerator
{
    private reactiveProperties = new Set<string>();
    private templateRefs: string[] = [];

    public setReactiveProperties(props: Set<string>): void
    {
        this.reactiveProperties = props;
    }

    public setTemplateRefs(refs: string[]): void
    {
        this.templateRefs = refs;
    }

    public generateRenderMethod(html: string, styles?: string): string
    {
        let content = '';
        if (styles)
        {
            content += `<style>${styles}</style>`;
        }
        content += html;
        content = this.escapeForTemplateLiteral(content);
        return `this.__getShadowRoot().innerHTML = \`${content}\`;`;
    }

    public generateBindingsSetup(bindings: TemplateBinding[], controlFlows: ControlFlow[]): string
    {
        const lines: string[] = [];

        for (const binding of bindings)
        {
            lines.push(this.generateBindingCode(binding));
        }

        lines.push('const __renderById = {};');
        lines.push(`const __triggerNested = (container) => {
            const walker = document.createTreeWalker(container, NodeFilter.SHOW_COMMENT);
            while (walker.nextNode()) {
                const id = walker.currentNode.textContent;
                if (__renderById[id]) __renderById[id]();
            }
        };`);

        for (const cf of controlFlows)
        {
            lines.push(this.generateControlFlowCode(cf));
        }

        return lines.join('\n        ');
    }

    private getPropertyRef(propName: string): string
    {
        if (this.reactiveProperties.has(propName))
        {
            return `__${propName}`;
        }
        return propName;
    }

    private extractBaseProp(expr: string): string
    {
        const result = extractRootIdentifier(expr);
        if (result === null)
        {
            throw new Error(`Failed to extract base property from expression: "${expr}"`);
        }
        return result;
    }

    private escapeForTemplateLiteral(content: string): string
    {
        return content.replace(/`/g, '\\`')
            .replace(/\$/g, '\\$');
    }

    private escapeForTemplateLiteralPreservingExpressions(content: string): string
    {
        let result = content.replace(/`/g, '\\`');
        result = result.replace(/\$(?!\{)/g, '\\$');
        return result;
    }

    private dotsToDashes(str: string): string
    {
        return str.replace(/\./g, '-');
    }

    private removeIndexSuffix(str: string): string
    {
        return str.replace(/-\d+$/, '');
    }

    private generateBindingCode(binding: TemplateBinding): string
    {
        const { id, type, expression, target, eventName, className, styleProp } = binding;

        switch (type)
        {
            case 'text':
                return this.generateTextBinding(id, expression);
            case 'property':
                return target ? this.generatePropertyBinding(id, target, expression) : '';
            case 'event':
                return eventName ? this.generateEventBinding(id, eventName, expression) : '';
            case 'class':
                return className ? this.generateClassBinding(id, className, expression) : '';
            case 'style':
                return styleProp ? this.generateStyleBinding(id, styleProp, expression) : '';
            default:
                return '';
        }
    }

    private generateTextBinding(id: string, expression: string): string
    {
        const { expression: baseExpr, pipes } = parsePipedExpression(expression);
        const hasPipes = pipes.length > 0;

        const baseProp = this.extractBaseProp(baseExpr);
        const propRef = this.getPropertyRef(baseProp);
        const restPath = baseExpr.split('.')
            .slice(1);

        const safeAccess = restPath.length > 0 ? `Array.isArray(val) ? val.${restPath.join('.')} : (val && typeof val === 'object' ? val.${restPath.join('.')} : val)` : 'val';

        const reactivePropsArray = Array.from(this.reactiveProperties);
        const subscribeToAll = reactivePropsArray.map(p => `if (this.__${p}?.onChange) this.__bindPropertyChange(this.__${p}, __update);`)
            .join('\n                ');

        if (hasPipes)
        {
            const transformedExpr = transformPipedExpression(expression);
            return `{
                const __update = () => {
                    const result = ${transformedExpr};
                    this.__setText("${id}", String(result ?? ''));
                };
                ${subscribeToAll}
                __update();
            }`;
        }

        return `{
            const prop = this.${propRef};
            if (prop && prop.onChange) {
                const __getText = (val) => {
                    if (val == null) return '';
                    ${restPath.length > 0 ? `return String(${safeAccess} ?? '');` : 'return String(val ?? \'\');'}
                };
                this.__bindPropertyChange(prop, (val) => {
                    this.__setText("${id}", __getText(val));
                });
            } else {
                const __update = () => {
                    const raw = this.${propRef};
                    const val = (raw && typeof raw === 'object' && raw.getValue) ? raw.getValue() : raw;
                    ${restPath.length > 0 ? `const result = val != null ? val.${restPath.join('.')} : undefined;` : 'const result = val;'}
                    this.__setText("${id}", String(result ?? ''));
                };
                ${subscribeToAll}
                __update();
            }
        }`;
    }

    private generatePropertyBinding(id: string, target: string, expression: string): string
    {
        const baseProp = this.extractBaseProp(expression);
        const propRef = this.getPropertyRef(baseProp);
        const targetCamel = this.kebabToCamel(target);
        const restPath = expression.split('.')
            .slice(1);
        const valueExpr = restPath.length > 0 ? `val?.${restPath.join('.')}` : 'val';

        return `{
            const prop = this.${propRef};
            if (prop && prop.onChange) {
                this.__bindPropertyChange(prop, (val) => {
                    this.__bindToChild("${id}", "${targetCamel}", ${valueExpr});
                });
            } else {
                const val = (this.${propRef} && typeof this.${propRef} === 'object' && this.${propRef}.getValue) ? this.${propRef}.getValue() : this.${propRef};
                this.__bindToChild("${id}", "${targetCamel}", ${restPath.length > 0 ? `val?.${restPath.join('.')}` : 'val'});
            }
        }`;
    }

    private generateEventBinding(id: string, eventName: string, expression: string): string
    {
        const [baseEvent, ...modifiers] = eventName.split('.');
        const handlerCode = renameVariable(expression, '$event', '__ev');
        const eventCamel = this.kebabToCamel(baseEvent);

        const refLookups = this.generateRefLookups(expression);

        if (modifiers.length > 0)
        {
            const conditions = modifiers.map(m =>
            {
                if (m === 'enter') return '__ev.key === "Enter"';
                if (m === 'escape') return '__ev.key === "Escape"';
                if (m === 'space') return '__ev.key === " "';
                return 'true';
            })
                .join(' && ');

            return `this.__bindEvent("${id}", "${baseEvent}", (__ev) => { ${refLookups}if (${conditions}) { this.${handlerCode}; } });`;
        }

        return `this.__bindOutput("${id}", "${eventCamel}", (__ev: any) => { ${refLookups}this.${handlerCode}; });`;
    }

    private generateRefLookups(expression: string): string
    {
        const usedRefs = this.templateRefs.filter(ref => new RegExp(`\\b${ref}\\b`).test(expression));
        if (usedRefs.length === 0) return '';

        return usedRefs.map(ref => `const ${ref} = this.__getShadowRoot().querySelector('[data-ref="${ref}"]');`)
            .join(' ') + ' ';
    }

    private generateClassBinding(id: string, className: string, expression: string): string
    {
        const baseProp = this.extractBaseProp(expression);
        const propRef = this.getPropertyRef(baseProp);
        const restPath = expression.split('.')
            .slice(1);
        const safeExpr = restPath.length > 0 ? `this.${baseProp}?.${restPath.join('.')}` : `this.${baseProp}`;

        return `{
            const prop = this.${propRef};
            const el = this.__getElement("${id}");
            if (prop && prop.onChange) {
                this.__bindPropertyChange(prop, (val) => {
                    const finalVal = ${restPath.length > 0 ? `val?.${restPath.join('.')}` : 'val'};
                    if (finalVal) { this.__addClass("${id}", "${className}"); }
                    else { this.__removeClass("${id}", "${className}"); }
                });
            } else if (el) {
                if (${safeExpr}) { el.classList.add("${className}"); }
                else { el.classList.remove("${className}"); }
            }
        }`;
    }

    private generateStyleBinding(id: string, styleProp: string, expression: string): string
    {
        const reactivePropsArray = Array.from(this.reactiveProperties);
        const subscribeToAll = reactivePropsArray.map(p => `if (this.__${p}?.onChange) this.__bindPropertyChange(this.__${p}, __update);`)
            .join('\n                ');

        const transformedExpr = addThisPrefix(expression);
        const stylePropCamel = this.kebabToCamel(styleProp);

        return `{
            const el = this.__getElement("${id}");
            const __update = () => {
                if (el) {
                    (el as HTMLElement).style.${stylePropCamel} = ${transformedExpr};
                }
            };
            ${subscribeToAll}
            __update();
        }`;
    }

    private generateControlFlowCode(cf: ControlFlow): string
    {
        if (cf.type === 'if')
        {
            return this.generateIfCode(cf);
        }
        else if (cf.type === 'for')
        {
            return this.generateForCode(cf);
        }
        else if (cf.type === 'switch')
        {
            return this.generateSwitchCode(cf);
        }
        return '';
    }

    private processContentBindings(content: string, prefix: string, skipEscape = false): {
        processed: string; events: string[];
    }
    {
        const events = new Set<string>();
        let bindIdx = 0;

        const fragment = parse5.parseFragment(content);
        this.walkAndTransformBindings(fragment.childNodes, prefix, events, () => bindIdx++);

        let processed = parse5.serialize(fragment);
        if (!skipEscape)
        {
            processed = this.escapeForTemplateLiteral(processed);
        }
        return { processed, events: [...events] };
    }

    private walkAndTransformBindings(nodes: Parse5Node[], prefix: string, events: Set<string>, getBindIdx: () => number): void
    {
        for (const node of nodes)
        {
            if (this.isParse5Element(node))
            {
                const attrsToRemove: string[] = [];
                const attrsToAdd: { name: string; value: string }[] = [];

                const subscribeMap = new Map<string, string>();
                for (const attr of node.attrs)
                {
                    if (attr.name === '[subscribe]')
                    {
                        const parts = attr.value.split(':');
                        if (parts.length === 2)
                        {
                            subscribeMap.set(parts[0].trim(), parts[1].trim());
                        }
                    }
                }

                for (const attr of node.attrs)
                {
                    if (attr.name === '[subscribe]')
                    {
                        attrsToRemove.push(attr.name);
                        continue;
                    }

                    if (attr.name.startsWith('#'))
                    {
                        const refName = attr.name.slice(1);
                        attrsToRemove.push(attr.name);
                        attrsToAdd.push({ name: 'data-ref', value: refName });
                        continue;
                    }

                    if (attr.name.startsWith('(') && attr.name.endsWith(')'))
                    {
                        let event = '';
                        let handler = '';

                        if (attr.value.startsWith('['))
                        {
                            try
                            {
                                const parsed: unknown = JSON.parse(attr.value);
                                if (Array.isArray(parsed) && typeof parsed[0] === 'string' && typeof parsed[1] === 'string')
                                {
                                    [event, handler] = parsed;
                                }
                            }
                            catch
                            {
                                event = attr.name.slice(1, -1);
                                handler = attr.value;
                            }
                        }
                        else
                        {
                            event = attr.name.slice(1, -1);
                            handler = attr.value;
                        }

                        const safeEvent = this.dotsToDashes(event);
                        events.add(safeEvent);
                        attrsToRemove.push(attr.name);
                        attrsToAdd.push({
                            name: `data-${prefix}-event-${safeEvent}`,
                            value: JSON.stringify([event, handler])
                        });
                    }
                    else if (attr.name.startsWith('[') && attr.name.endsWith(']'))
                    {
                        let prop = '';
                        let expr = '';

                        if (attr.value.startsWith('['))
                        {
                            try
                            {
                                const parsed: unknown = JSON.parse(attr.value);
                                if (Array.isArray(parsed) && typeof parsed[0] === 'string' && typeof parsed[1] === 'string')
                                {
                                    [prop, expr] = parsed;
                                }
                            }
                            catch
                            {
                                prop = attr.name.slice(1, -1);
                                expr = attr.value;
                            }
                        }
                        else
                        {
                            prop = attr.name.slice(1, -1);
                            expr = attr.value;
                        }

                        const dangerousProps = ['innerHTML', 'outerHTML', 'href', 'src'];
                        const isUnsafe = prop.endsWith('.unsafe');
                        const baseProp = isUnsafe ? prop.slice(0, -7) : prop;

                        if (dangerousProps.includes(baseProp) && !isUnsafe)
                        {
                            throw new Error(`XSS Protection: [${prop}] binding is blocked. ` + `Use [${prop}.unsafe] if you understand the security implications ` + 'and have sanitized user input.');
                        }

                        const safeProp = this.dotsToDashes(baseProp);
                        attrsToRemove.push(attr.name);
                        const subscribeTo = subscribeMap.get(prop) ?? subscribeMap.get(baseProp);
                        const bindingData = subscribeTo ? [baseProp, expr, subscribeTo] : [baseProp, expr];
                        attrsToAdd.push({
                            name: `data-${prefix}-bind-${safeProp}-${getBindIdx()}`,
                            value: JSON.stringify(bindingData)
                        });
                    }
                }

                node.attrs = node.attrs.filter(a => !attrsToRemove.includes(a.name));
                for (const newAttr of attrsToAdd)
                {
                    node.attrs.push(newAttr);
                }

                if (node.childNodes)
                {
                    this.walkAndTransformBindings(node.childNodes, prefix, events, getBindIdx);
                }
            }
        }
    }

    private isParse5Element(node: Parse5Node): node is Parse5Element
    {
        return 'tagName' in node;
    }

    private processAndGenerateBindings(content: string, prefix: string): {
        processed: string; bindingSetup: string;
    }
    {
        const result = this.processContentBindings(content, prefix, true);
        const withInterpolations = this.transformInterpolationsInContent(result.processed);
        const escaped = this.escapeForTemplateLiteralPreservingExpressions(withInterpolations);
        const bindingSetup = this.generateBindingSetupCode(prefix, result.events, withInterpolations);
        return { processed: escaped, bindingSetup };
    }

    private transformInterpolationsInContent(content: string, iteratorVar?: string): string
    {
        const interpolations = parseInterpolations(content);
        if (interpolations.length === 0) return content;

        let newContent = '';
        let lastEnd = 0;
        for (const { start, end, expr } of interpolations)
        {
            newContent += content.slice(lastEnd, start);
            const { expression: baseExpr, pipes } = parsePipedExpression(expr);

            if (pipes.length > 0)
            {
                let result = iteratorVar && expressionUsesVariable(baseExpr, iteratorVar) ? baseExpr : `this.${baseExpr}`;
                for (const pipe of pipes)
                {
                    const argsStr = pipe.args.length > 0 ? ', ' + pipe.args.join(', ') : '';
                    result = `this.__pipe('${pipe.name}', ${result}${argsStr})`;
                }
                newContent += `\${${result} ?? ''}`;
            }
            else
            {
                const usesIterator = iteratorVar && expressionUsesVariable(expr, iteratorVar);
                if (usesIterator)
                {
                    newContent += `\${${expr}}`;
                }
                else
                {
                    newContent += `\${this.${expr} ?? ''}`;
                }
            }
            lastEnd = end;
        }
        newContent += content.slice(lastEnd);
        return newContent;
    }

    private generateBindingSetupCode(prefix: string, events: string[], content: string): string
    {
        const lines: string[] = [];

        for (const event of events)
        {
            lines.push(`this.__wireEvents(container, 'data-${prefix}-event-${event}');`);
        }

        const textBindings = this.extractTextBindings(content);
        for (const { id, expr } of textBindings)
        {
            const subscriptions = Array.from(this.reactiveProperties)
                .map(p => `if (this.__${p}?.onChange) this.__bindPropertyChange(this.__${p}, __update);`)
                .join('\n                    ');

            lines.push(`{
                const el = container.querySelector('[data-lid="${id}"]');
                if (el) {
                    const __update = () => { 
                        const __val = ${expr};
                        el.textContent = __val != null ? String(__val) : '';
                    };
                    ${subscriptions}
                    __update();
                }
            }`);
        }

        const propBindings = this.extractPropertyBindings(content, prefix);
        for (const { prop, expr, fullAttr } of propBindings)
        {
            const transformedExpr = addThisPrefix(expr);
            const baseProp = this.extractBaseProp(expr);
            const propRef = this.reactiveProperties.has(baseProp) ? `__${baseProp}` : baseProp;

            if (prop.startsWith('class.'))
            {
                const className = prop.slice(6);
                lines.push(`{
                    const __updateClass = () => {
                        container.querySelectorAll('[data-${prefix}-bind-${fullAttr}]').forEach(el => {
                            if (${transformedExpr}) el.classList.add('${className}');
                            else el.classList.remove('${className}');
                        });
                    };
                    if (this.${propRef}?.onChange) this.__bindPropertyChange(this.${propRef}, __updateClass);
                    __updateClass();
                }`);
            }
            else
            {
                const propCamel = this.kebabToCamel(prop);
                lines.push(`{
                    const __updateProp = () => {
                        container.querySelectorAll('[data-${prefix}-bind-${fullAttr}]').forEach(el => {
                            this.__setChildPropertyDeferred(el, '${propCamel}', ${transformedExpr});
                        });
                    };
                    if (this.${propRef}?.onChange) this.__bindPropertyChange(this.${propRef}, __updateProp);
                    __updateProp();
                }`);
            }
        }

        return lines.join('\n                        ');
    }

    private extractPropertyBindings(content: string, prefix: string): {
        prop: string;
        expr: string;
        fullAttr: string;
        subscribeTo?: string
    }[]
    {
        const bindings: { prop: string; expr: string; fullAttr: string; subscribeTo?: string }[] = [];
        const fragment = parse5.parseFragment(content);
        const attrPrefix = `data-${prefix}-bind-`;
        this.walkAndExtractPropertyBindings(fragment.childNodes, attrPrefix, bindings);
        return bindings;
    }

    private generateUnifiedRender(id: string, baseProp: string, contentEvalCode: string, bindingSetupCode: string): string
    {
        const propRef = this.getPropertyRef(baseProp);

        return `{
            const __findMarkers = () => {
                const walker = document.createTreeWalker(this.__getShadowRoot(), NodeFilter.SHOW_COMMENT);
                let start = null, end = null;
                while (walker.nextNode()) {
                    const text = walker.currentNode.textContent;
                    if (text === '${id}') start = walker.currentNode;
                    else if (text === '/${id}') end = walker.currentNode;
                }
                return { start, end };
            };
            const prop = this.${propRef};
            
            const __render = () => {
                const { start: marker, end: endMarker } = __findMarkers();
                if (!marker) return;
                
                if (endMarker) {
                    while (marker.nextSibling && marker.nextSibling !== endMarker) {
                        marker.nextSibling.remove();
                    }
                }
                
                ${contentEvalCode}
                
                const __tmp = document.createElement('div');
                __tmp.innerHTML = __content;
                const __frag = document.createDocumentFragment();
                const __newNodes = [];
                while (__tmp.firstChild) {
                    __newNodes.push(__tmp.firstChild);
                    __frag.appendChild(__tmp.firstChild);
                }
                marker.parentNode.insertBefore(__frag, endMarker || marker.nextSibling);
                const container = marker.parentNode;
                
                ${bindingSetupCode}
                
                __newNodes.forEach(n => {
                    if (n.nodeType === 1) __triggerNested(n);
                    else if (n.nodeType === 8 && __renderById[n.textContent]) __renderById[n.textContent]();
                });
            };
            
            __renderById['${id}'] = __render;
            if (prop && prop.onChange) {
                this.__bindPropertyChange(prop, __render);
            }
            __render();
        }`;
    }

    private generateIfCode(cf: ControlFlow): string
    {
        const { id, condition, ifContent, elseContent } = cf;
        if (!condition) return '';
        const baseProp = this.extractBaseProp(condition);
        const transformedCondition = addThisPrefixSafe(condition);

        const ifBranch = this.processAndGenerateBindings(ifContent ?? '', `${id}-if`);
        const elseBranch = this.processAndGenerateBindings(elseContent ?? '', `${id}-else`);

        const contentEvalCode = `const rawCond = ${transformedCondition};
                const cond = (rawCond && typeof rawCond === 'object' && rawCond.getValue) ? rawCond.getValue() : rawCond;
                const __content = cond ? \`${ifBranch.processed}\` : \`${elseBranch.processed}\`;
                const __bindingFn = cond 
                    ? () => { ${ifBranch.bindingSetup} }
                    : () => { ${elseBranch.bindingSetup} };`;

        const bindingSetupCode = '__bindingFn();';

        return this.generateUnifiedRender(id, baseProp, contentEvalCode, bindingSetupCode);
    }

    private generateForCode(cf: ControlFlow): string
    {
        const { id, iterator, iterable, content } = cf;
        if (!iterator || !iterable) return '';
        const baseProp = this.extractBaseProp(iterable);
        const isOptionContent = (content ?? '').trim()
            .startsWith('<option');
        const markerId = isOptionContent ? `for-${id}` : id;

        const prefix = `${id}-for`;
        const processed = this.processContentBindings(content ?? '', prefix, true);

        let forContent = processed.processed;
        const interpolations = parseInterpolations(forContent);
        if (interpolations.length > 0)
        {
            let newContent = '';
            let lastEnd = 0;
            for (const { start, end, expr } of interpolations)
            {
                newContent += forContent.slice(lastEnd, start);
                if (expr.includes(iterator))
                {
                    newContent += `\${${expr}}`;
                }
                else
                {
                    newContent += `\${this.${expr}}`;
                }
                lastEnd = end;
            }
            newContent += forContent.slice(lastEnd);
            forContent = newContent;
        }

        const bindingSetup = this.generateForBindingSetup(prefix, processed.events, forContent, iterator);

        const escapedForContent = this.escapeForTemplateLiteralPreservingExpressions(forContent);

        const contentEvalCode = `const __items = this.${iterable};
                if (!Array.isArray(__items)) return;
                const __content = __items.map((${iterator}, __idx) => \`${escapedForContent}\`).join('');`;

        return this.generateUnifiedRender(markerId, baseProp, contentEvalCode, bindingSetup);
    }

    private generateForBindingSetup(prefix: string, _events: string[], content: string, iterator: string): string
    {
        const lines: string[] = [];

        const eventBindings = this.extractEventBindings(content, prefix);
        for (const { event, handler, safeEvent } of eventBindings)
        {
            lines.push(`container.querySelectorAll('[data-${prefix}-event-${safeEvent}]').forEach((el, __idx) => {
                const __item = __items[__idx];
                this.__bindOutputOnElement(el, '${event}', ($event) => {
                    const fn = new Function('${iterator}', '$event', 'return this.${handler}').bind(this);
                    fn(__item, $event);
                });
            });`);
        }

        const propBindings = this.extractPropertyBindings(content, prefix);
        for (const { prop, expr, fullAttr, subscribeTo } of propBindings)
        {
            const propCamel = this.kebabToCamel(prop);
            const evalExpr = expr === iterator ? '__items[__idx]' : transformForExpression(expr, iterator, '__items[__idx]');

            const baseProp = this.extractBaseProp(expr);
            const exprUsesIterator = expressionUsesVariable(expr, iterator);

            if (subscribeTo)
            {
                const exprWithThis = transformForExpressionKeepIterator(expr, iterator);
                const subscribeProps = subscribeTo.split(',')
                    .map(p => p.trim());
                const subscriptions = subscribeProps
                    .map(p => `if (this.__${p}?.onChange) this.__bindPropertyChange(this.__${p}, __updateProp);`)
                    .join('\n                        ');

                lines.push(`{
                        const __updateProp = () => {
                            const __currentItems = prop?.getValue ? prop.getValue() : __items;
                            if (!Array.isArray(__currentItems)) return;
                            container.querySelectorAll('[data-${prefix}-bind-${fullAttr}]').forEach((el, __idx) => {
                                if (__idx < __currentItems.length) {
                                    const ${iterator} = __currentItems[__idx];
                                    this.__setChildPropertyDeferred(el, '${propCamel}', ${exprWithThis});
                                }
                            });
                        };
                        ${subscriptions}
                        __updateProp();
                    }`);
            }
            else if (baseProp !== iterator && this.reactiveProperties.has(baseProp))
            {
                const propRef = `__${baseProp}`;
                if (exprUsesIterator)
                {
                    const exprWithThis = transformForExpressionKeepIterator(expr, iterator);
                    lines.push(`{
                        const __updateProp = () => {
                            const __currentItems = prop?.getValue ? prop.getValue() : __items;
                            if (!Array.isArray(__currentItems)) return;
                            container.querySelectorAll('[data-${prefix}-bind-${fullAttr}]').forEach((el, __idx) => {
                                if (__idx < __currentItems.length) {
                                    const ${iterator} = __currentItems[__idx];
                                    this.__setChildPropertyDeferred(el, '${propCamel}', ${exprWithThis});
                                }
                            });
                        };
                        if (this.${propRef}?.onChange) this.__bindPropertyChange(this.${propRef}, __updateProp);
                        __updateProp();
                    }`);
                }
                else
                {
                    lines.push(`{
                        const __updateProp = () => {
                            container.querySelectorAll('[data-${prefix}-bind-${fullAttr}]').forEach((el) => {
                                this.__setChildPropertyDeferred(el, '${propCamel}', ${evalExpr});
                            });
                        };
                        if (this.${propRef}?.onChange) this.__bindPropertyChange(this.${propRef}, __updateProp);
                        __updateProp();
                    }`);
                }
            }
            else
            {
                lines.push(`container.querySelectorAll('[data-${prefix}-bind-${fullAttr}]').forEach((el, __idx) => {
                    this.__setChildPropertyDeferred(el, '${propCamel}', ${evalExpr});
                });`);
            }
        }

        return lines.join('\n                ');
    }

    private extractEventBindings(content: string, prefix: string): {
        event: string;
        handler: string;
        safeEvent: string
    }[]
    {
        const bindings: { event: string; handler: string; safeEvent: string }[] = [];
        const fragment = parse5.parseFragment(content);
        const attrPrefix = `data-${prefix}-event-`;
        this.walkAndExtractEventBindings(fragment.childNodes, attrPrefix, bindings);
        return bindings;
    }

    private walkAndExtractEventBindings(nodes: Parse5Node[], attrPrefix: string, bindings: {
        event: string;
        handler: string;
        safeEvent: string
    }[]): void
    {
        for (const node of nodes)
        {
            if (this.isParse5Element(node))
            {
                for (const attr of node.attrs)
                {
                    if (attr.name.startsWith(attrPrefix))
                    {
                        const safeEvent = attr.name.slice(attrPrefix.length);
                        let event = '';
                        let handler = '';

                        if (attr.value.startsWith('['))
                        {
                            try
                            {
                                const unescaped = attr.value.replace(/\\\$/g, '$');
                                const parsed: unknown = JSON.parse(unescaped);
                                if (Array.isArray(parsed) && typeof parsed[0] === 'string' && typeof parsed[1] === 'string')
                                {
                                    [event, handler] = parsed;
                                }
                            }
                            catch(e)
                            {
                                console.error('Failed to parse event binding JSON:', attr.value, e);
                                event = this.kebabToCamel(safeEvent);
                                handler = attr.value;
                            }
                        }
                        else
                        {
                            event = this.kebabToCamel(safeEvent);
                            handler = attr.value;
                        }

                        bindings.push({ event, handler, safeEvent });
                    }
                }
                if (node.childNodes)
                {
                    this.walkAndExtractEventBindings(node.childNodes, attrPrefix, bindings);
                }
            }
        }
    }

    private generateSwitchCode(cf: ControlFlow): string
    {
        const { id, expression, cases } = cf;
        if (!expression) return '';
        const baseProp = this.extractBaseProp(expression);
        const transformedExpr = addThisPrefixSafe(expression);

        const processedCases = (cases ?? []).map((c, idx) =>
        {
            const { processed, bindingSetup } = this.processAndGenerateBindings(c.content, `${id}-case-${idx}`);
            return {
                value: c.value, fallthrough: c.fallthrough, content: processed, bindingSetup
            };
        });

        const caseContents = processedCases.map(c => `\`${c.content}\``)
            .join(', ');
        const caseConditions = processedCases.map((c, idx) =>
        {
            if (c.value === null) return `{ idx: ${idx}, match: true }`;
            return `{ idx: ${idx}, match: __switchVal === (${addThisPrefixSafe(c.value)}) }`;
        })
            .join(', ');
        const caseBindings = processedCases.map(c => `(container) => { ${c.bindingSetup} }`)
            .join(', ');
        const fallthrough = processedCases.map(c => c.fallthrough.toString())
            .join(', ');

        const contentEvalCode = `const __switchVal = ${transformedExpr};
                const __cases = [${caseContents}];
                const __conditions = [${caseConditions}];
                const __bindings = [${caseBindings}];
                const __fallthrough = [${fallthrough}];
                
                let __content = '';
                let __bindingFns = [];
                let __matched = false;
                for (let i = 0; i < __conditions.length; i++) {
                    if (__matched || __conditions[i].match) {
                        __matched = true;
                        __content += __cases[i];
                        __bindingFns.push(__bindings[i]);
                        if (!__fallthrough[i]) break;
                    }
                }`;

        const bindingSetupCode = '__bindingFns.forEach(fn => fn(container));';

        return this.generateUnifiedRender(id, baseProp, contentEvalCode, bindingSetupCode);
    }

    private kebabToCamel(str: string): string
    {
        return str.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    }

    private extractTextBindings(content: string): { id: string; expr: string }[]
    {
        const bindings: { id: string; expr: string }[] = [];
        const fragment = parse5.parseFragment(content);
        this.walkAndExtractTextBindings(fragment.childNodes, bindings);
        return bindings;
    }

    private walkAndExtractTextBindings(nodes: Parse5Node[], bindings: { id: string; expr: string }[]): void
    {
        for (const node of nodes)
        {
            if (this.isParse5Element(node))
            {
                if (node.tagName === 'span')
                {
                    const textBindAttr = node.attrs.find(a => a.name === 'data-text-bind');
                    const lidAttr = node.attrs.find(a => a.name === 'data-lid');
                    if (textBindAttr && lidAttr)
                    {
                        bindings.push({ expr: textBindAttr.value, id: lidAttr.value });
                    }
                }
                if (node.childNodes)
                {
                    this.walkAndExtractTextBindings(node.childNodes, bindings);
                }
            }
        }
    }

    private walkAndExtractPropertyBindings(nodes: Parse5Node[], attrPrefix: string, bindings: {
        prop: string;
        expr: string;
        fullAttr: string;
        subscribeTo?: string
    }[]): void
    {
        for (const node of nodes)
        {
            if (this.isParse5Element(node))
            {
                for (const attr of node.attrs)
                {
                    if (attr.name.startsWith(attrPrefix))
                    {
                        const fullAttr = attr.name.slice(attrPrefix.length);
                        let prop = '';
                        let expr = '';
                        let subscribeTo: string | undefined = undefined;

                        if (attr.value.startsWith('['))
                        {
                            try
                            {
                                const parsed: unknown = JSON.parse(attr.value);
                                if (Array.isArray(parsed) && typeof parsed[0] === 'string' && typeof parsed[1] === 'string')
                                {
                                    [prop, expr] = parsed;
                                    if (typeof parsed[2] === 'string')
                                    {
                                        [, , subscribeTo] = parsed;
                                    }
                                }
                            }
                            catch
                            {
                                prop = this.removeIndexSuffix(fullAttr);
                                expr = attr.value;
                            }
                        }
                        else
                        {
                            prop = this.removeIndexSuffix(fullAttr);
                            expr = attr.value;
                        }

                        bindings.push({ prop, expr, fullAttr, subscribeTo });
                    }
                }
                if (node.childNodes)
                {
                    this.walkAndExtractPropertyBindings(node.childNodes, attrPrefix, bindings);
                }
            }
        }
    }
}
