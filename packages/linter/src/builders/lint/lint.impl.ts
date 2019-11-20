import {
  BuilderContext,
  BuilderOutput,
  createBuilder
} from '@angular-devkit/architect';
import { from, Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';

function run(options: any, context: BuilderContext): Observable<BuilderOutput> {
  if (options.linter === 'eslint') {
    delete options.linter;
    options.eslintConfig = options.config;
    delete options.config;
    // Use whatever the default formatter is
    delete options.format;
    return from(
      context.scheduleBuilder('@angular-eslint/builder:lint', options, {
        logger: patchedLogger(context)
      })
    ).pipe(concatMap(r => r.output));
  }

  if (options.linter === 'tslint') {
    throw new Error(
      `'tslint' option is no longer supported. Update your angular.json to use "@angular-eslint/builder:lint" builder directly.`
    );
  }

  throw new Error(
    `"${options.linter}" is not a supported linter option: use either eslint or tslint`
  );
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
