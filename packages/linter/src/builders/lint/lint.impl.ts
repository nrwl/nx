import {
  BuilderContext,
  createBuilder,
  BuilderOutput
} from '@angular-devkit/architect';
import { Observable, from } from 'rxjs';
import { concatMap, tap } from 'rxjs/operators';

function run(options: any, context: BuilderContext): Observable<BuilderOutput> {
  if (options.linter === 'tslint') {
    delete options.linter;
    options.tslintConfig = options.config;
    delete options.config;
    context.logger;
    return from(
      context.scheduleBuilder('@angular-devkit/build-angular:tslint', options, {
        logger: patchedLogger(context)
      })
    ).pipe(concatMap(r => r.output));
  } else {
    throw new Error(`ESLint support hasn't been implemented yet.`);
  }
}

// remove once https://github.com/angular/angular-cli/issues/15053 is fixed
function patchedLogger(context: any): any {
  const s = context.logger._subject.next;
  context.logger._subject.next = (v: any) => {
    v.message = v.message.replace('<???>', context.target.project);
    return s.apply(context.logger._subject, [v]);
  };
  return context.logger;
}

export default createBuilder<any>(run);
