import type { Tree } from '../../generators/tree';
import { NxCloudOnBoardingStatus } from '../models/onboarding-status';
export declare function createNxCloudOnboardingURLForWelcomeApp(tree: Tree, token?: string): Promise<NxCloudOnBoardingStatus>;
export declare function getNxCloudAppOnBoardingUrl(token: string): Promise<string>;
export declare function readNxCloudToken(tree: Tree): any;
