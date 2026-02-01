export interface Scope
{
    variables: Set<string>;
    parent?: Scope;
}
