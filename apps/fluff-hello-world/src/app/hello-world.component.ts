import { Component, Pipe, Reactive } from '@fluffjs/fluff';

@Component({
    selector: 'hello-world',
    templateUrl: './hello-world.component.html',
    styleUrl: './hello-world.component.css'
})
export class HelloWorldComponent extends HTMLElement
{
    @Reactive() public name = 'World';
    @Reactive() public count = 0;
    @Reactive() public items: string[] = ['apple', 'banana', 'cherry'];
    @Reactive() public user = { firstName: 'John', lastName: 'Doe', address: { city: 'NYC', zip: '10001' } };
    @Reactive() public showAdvanced = false;
    @Reactive() public selectedIndex = 0;
    @Reactive() public searchQuery = '';
    @Reactive() public price = 99.99;
    @Reactive() public isEnabled = true;
    @Reactive() public nullableValue: string | null = null;

    // For edge case testing
    public defaultConfig = { color: 'blue', size: 'medium' };
    public regex = /test\.value/;
    public specialChars = 'String with "quotes" and \'apostrophes\' and `backticks`';
    public htmlContent = '<script>alert("xss")</script>';

    // XSS Testing - user-controlled inputs
    @Reactive() public userInput = '';
    @Reactive() public userHtml = '';
    @Reactive() public userUrl = '';
    @Reactive() public userStyle = '';
    @Reactive() public userEventCode = '';
    @Reactive() public userAttrValue = '';
    @Reactive() public userItems: string[] = [];

    public addUserItem(): void
    {
        if (this.userInput.trim())
        {
            this.userItems = [...this.userItems, this.userInput];
            this.userInput = '';
        }
    }

    // Computed-like getters
    public get fullName(): string
    {
        return `${this.user.firstName} ${this.user.lastName}`;
    }

    public get filteredItems(): string[]
    {
        return this.items.filter(item => item.includes(this.searchQuery));
    }

    public get itemCount(): number
    {
        return this.items.length;
    }

    // Pipes
    @Pipe('uppercase')
    public uppercase(value: string): string
    {
        return value.toUpperCase();
    }

    @Pipe('currency')
    public currency(value: number, symbol = '$'): string
    {
        return `${symbol}${value.toFixed(2)}`;
    }

    @Pipe('truncate')
    public truncate(value: string, length: number): string
    {
        return value.length > length ? value.slice(0, length) + '...' : value;
    }

    // Methods
    public increment(): void
    {
        this.count++;
    }

    public addItem(): void
    {
        this.items = [...this.items, `item${this.items.length + 1}`];
    }

    public removeItem(index: number): void
    {
        this.items = this.items.filter((_, i) => i !== index);
    }

    public toggleAdvanced(): void
    {
        this.showAdvanced = !this.showAdvanced;
    }

    public handleKeydown(event: KeyboardEvent): void
    {
        if (event.key === 'Enter') this.addItem();
    }

    public complexMethod(a: number, b: string, c?: boolean): string
    {
        return `${a}-${b}-${c ?? 'default'}`;
    }
}
