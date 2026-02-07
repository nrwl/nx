import { Component, Reactive, ViewChild } from '@fluffjs/fluff';

@Component({
    selector: 'viewchild-test',
    template: `
        <input #myInput type="text" value="initial" />
        <button id="viewchild-btn" (click)="updateInput()">Update</button>
        <div id="viewchild-result">{{ inputValue }}</div>
    `
})
export class ViewChildTestComponent extends HTMLElement
{
    @ViewChild('myInput') public myInputEl!: HTMLInputElement;

    @Reactive() public inputValue = '';

    public updateInput(): void
    {
        if (this.myInputEl)
        {
            this.inputValue = this.myInputEl.value;
        }
    }
}
