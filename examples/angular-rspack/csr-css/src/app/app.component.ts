import { AsyncPipe } from '@angular/common';
import { Component, type OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import type { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { NxWelcomeComponent } from './nx-welcome.component';
import { ScssInlineTestComponent } from './scss-inline-test';
import pkg from '../../package.json';

declare const nxAngularRspack: string;

@Component({
  imports: [
    NxWelcomeComponent,
    RouterModule,
    ScssInlineTestComponent,
    AsyncPipe,
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'rspack-csr-css';
  greeting$!: Observable<string>;
  nxAngularRspackVersion = nxAngularRspack;

  constructor(private readonly apiService: ApiService) {}

  ngOnInit() {
    this.greeting$ = this.apiService.getGreeting('world');
    // const version = await import('../../package.json').then(
    //   (m) => m.default.version
    // );
    // console.log('version', version);

    console.log('version', pkg.version);
  }
}

if (typeof Worker !== 'undefined') {
  // Create a new
  const worker = new Worker(new URL('./app.worker', import.meta.url));
  worker.onmessage = ({ data }) => {
    console.log(`page got message: ${data}`);
  };
  worker.postMessage('hello');
} else {
  // Web Workers are not supported in this environment.
  // You should add a fallback so that your program still executes correctly.
}
