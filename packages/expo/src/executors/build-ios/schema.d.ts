// options from https://docs.expo.dev/workflow/expo-cli/#expo-buildios
export interface ExpoBuildIOSOptions {
  clearCredentials?: boolean;
  clearDistCert?: boolean;
  clearPushKey?: boolean;
  clearnPushCert?: boolean;
  clearProvisioningProfile?: boolean;
  revokeCredentials?: boolean;
  appleId?: string;
  type: 'archive' | 'simulator';
  releaseChannel?: string;
  noPublish?: boolean;
  noWait?: boolean;
  teamId?: string;
  dishP12Path?: string;
  pushId?: string;
  pushP8Path?: string;
  provisioningProfile?: string;
  publicUrl?: string;
  skipCredentialsCheck?: booolean;
  skipWorkflowCheck?: boolean;
  sync: boolean; // default is true
}
