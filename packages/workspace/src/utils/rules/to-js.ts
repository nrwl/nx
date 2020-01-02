import { transpile, JsxEmit, ScriptTarget } from 'typescript';
import { forEach, Rule, when } from '@angular-devkit/schematics';
import { normalize } from '@angular-devkit/core';

export function toJS(): Rule {
  return forEach(
    when(
      path => path.endsWith('.ts') || path.endsWith('.tsx'),
      entry => {
        const original = entry.content.toString('utf-8');
        const result = transpile(original, {
          allowJs: true,
          jsx: JsxEmit.Preserve,
          target: ScriptTarget.ESNext
        });
        return {
          content: Buffer.from(result, 'utf-8'),
          path: normalize(entry.path.replace(/\.tsx?$/, '.js'))
        };
      }
    )
  );
}
