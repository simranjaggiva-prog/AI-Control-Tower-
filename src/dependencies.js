import { AppConfigurationClient } from "@azure/app-configuration";
import { CosmosClient } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";

export function createDependencyCheck(config) {
  if (!config.cloud) return async () => ({ mode: "local-preview", dependencies: "not-configured" });
  const credential = new DefaultAzureCredential();
  const appConfig = new AppConfigurationClient(config.azure.appConfig, credential,
    { retryOptions: { maxRetries: 0 } });
  const database = new CosmosClient({
    endpoint: config.azure.cosmos, aadCredentials: credential,
    connectionPolicy: { requestTimeout: 10000, retryOptions: { maxRetryAttemptCount: 0 } }
  }).database("command-db");
  const audit = new BlobServiceClient(config.azure.blob, credential,
    { retryOptions: { maxTries: 1, tryTimeoutInMs: 10000 } }).getContainerClient("audit-evidence");
  return async () => {
    await Promise.all([
      appConfig.listConfigurationSettings({ keyFilter: "foundation/*", abortSignal: AbortSignal.timeout(10000) }).byPage().next(),
      ...["configuration", "commands", "acknowledgements"].map((id) => database.container(id).read()),
      audit.getProperties({ abortSignal: AbortSignal.timeout(10000) })
    ]);
    return { mode: "azure", dependencies: "reachable-read-only" };
  };
}
