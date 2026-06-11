import { Generator, GeneratorsJson, GeneratorsJsonEntry } from '../../config/misc-interfaces';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
export type GeneratorInformation = {
    resolvedCollectionName: string;
    normalizedGeneratorName: string;
    schema: any;
    implementationFactory: () => Generator<unknown>;
    isNgCompat: boolean;
    isNxGenerator: boolean;
    generatorConfiguration: GeneratorsJsonEntry;
};
export declare function getGeneratorInformation(collectionName: string, generatorName: string, root: string | null, projects: Record<string, ProjectConfiguration>): GeneratorInformation;
export declare function readGeneratorsJson(collectionName: string, generator: string, root: string | null, projects: Record<string, ProjectConfiguration>): {
    generatorsFilePath: string;
    generatorsJson: GeneratorsJson;
    normalizedGeneratorName: string;
    resolvedCollectionName: string;
};
