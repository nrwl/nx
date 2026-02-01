export interface MarkerManagerInterface
{
    initializeFromConfig: (configJson: string) => void;

    cleanup: () => void;
}
