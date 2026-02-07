import { Component } from '@fluffjs/fluff';
import './uppercase.pipe.js';

@Component({
    selector: 'pipe-test',
    template: `<div id="pipe-result">{{ message | uppercase }}</div>`
})
export class PipeTestComponent extends HTMLElement
{
    message = 'hello world';
}
