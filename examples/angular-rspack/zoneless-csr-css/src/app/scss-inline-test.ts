import { Component } from '@angular/core';

@Component({
  selector: 'app-scss-inline-test',
  template: `
    <div class="content">
      <h1>SCSS Inline Test</h1>
      <p>This is a test of SCSS Inline</p>
    </div>
  `,
  styles: [
    `
      .content {
        display: flex;
        min-height: 100vh;
        line-height: 1.1;
        text-align: center;
        flex-direction: column;
        justify-content: center;
      }

      .content h1 {
        font-size: 3.6rem;
        font-weight: 700;
        color: red;
      }

      .content p {
        font-size: 1.2rem;
        font-weight: 400;
        opacity: 0.5;
      }
    `,
  ],
})
export class ScssInlineTestComponent {}
