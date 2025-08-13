import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

const version = await import('../package.json').then((m) => m.default.version);
console.log('version', version);
bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
