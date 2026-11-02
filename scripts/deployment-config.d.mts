export function validAppsScriptUrl(value: unknown): boolean;
export function deploymentConfig(publicEnv: Record<string, string>, deploymentEnv?: NodeJS.ProcessEnv): {
  apiUrl: string; environment: string; lookupMode: string;
};
