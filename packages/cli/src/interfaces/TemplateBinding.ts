export interface TemplateBinding
{
    id: string;
    type: 'text' | 'property' | 'event' | 'class' | 'style';
    expression: string;
    target?: string;
    eventName?: string;
    className?: string;
    styleProp?: string;
}
