export class DomUtils
{
    public static isCustomElement(el: Element): boolean
    {
        const tagName = el.tagName.toLowerCase();
        return customElements.get(tagName) !== undefined;
    }
}
