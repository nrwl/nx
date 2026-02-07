import { Pipe, PipeTransform } from '@fluffjs/fluff';

@Pipe('uppercase')
export class UppercasePipe implements PipeTransform
{
    public transform(value: unknown): unknown
    {
        return String(value).toUpperCase();
    }
}
