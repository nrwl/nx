import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet, RouterLink],
  selector: 'app-nested',
  template: `<h1>Nested</h1>

    <ul>
      <li><a routerLink="child-a">Child A</a></li>
      <li><a routerLink="child-b">Child B</a></li>
    </ul>

    <router-outlet></router-outlet> `,
  styles: [],
})
export class NestedComponent {}
