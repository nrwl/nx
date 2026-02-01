import type { types as t } from '@babel/core';

export interface BabelPluginReactiveWatchCallInfo
{
    propName: string;
    watchedProps: string[];
    callbackArg: t.Expression | t.SpreadElement | t.JSXNamespacedName | t.ArgumentPlaceholder;
}
