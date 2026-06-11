import { PackageManager } from '../../utils/package-manager';
import { PackageJson } from '../../utils/package-json';
import { NxJsonConfiguration } from '../../config/nx-json';
import { type NxKey } from '@nx/key';
export declare const packagesWeCareAbout: string[];
export declare const patternsWeIgnoreInCommunityReport: Array<string | RegExp>;
/**
 * Reports relevant version numbers for adding to an Nx issue report
 *
 * @remarks
 *
 * Must be run within an Nx workspace
 *
 */
export declare function reportHandler(): Promise<void>;
export interface ReportData {
    pm: PackageManager;
    pmVersion: string;
    nxKey: NxKey | null;
    nxKeyError: Error | null;
    powerpackPlugins: PackageJson[];
    localPlugins: string[];
    communityPlugins: PackageJson[];
    registeredPlugins: string[];
    daemon: {
        available: boolean;
        disabled: boolean;
    } | {
        error: unknown;
    };
    packageVersionsWeCareAbout: {
        package: string;
        version: string;
    }[];
    outOfSyncPackageGroup?: {
        basePackage: string;
        misalignedPackages: {
            name: string;
            version: string;
        }[];
        migrateTarget: string;
    };
    mismatchedNxVersions?: Array<{
        version: string;
        chain: string[];
    }>;
    projectGraphError?: Error | null;
    nativeTarget: string | null;
    cache: {
        max: number;
        used: number;
    } | null;
}
export declare function getReportData(): Promise<ReportData>;
interface OutOfSyncPackageGroup {
    basePackage: string;
    misalignedPackages: {
        name: string;
        version: string;
    }[];
    migrateTarget: string;
}
export declare function findMisalignedPackagesForPackage(base: PackageJson): undefined | OutOfSyncPackageGroup;
export declare function findInstalledPowerpackPlugins(): PackageJson[];
export declare function findInstalledCommunityPlugins(): PackageJson[];
export declare function findRegisteredPluginsBeingUsed(nxJson: NxJsonConfiguration): string[];
export declare function findInstalledPackagesWeCareAbout(): {
    package: string;
    version: string;
}[];
export {};
