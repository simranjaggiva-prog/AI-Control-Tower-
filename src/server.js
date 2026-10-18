import { loadConfig, loadInventory } from "./config.js";
import { createDependencyCheck } from "./dependencies.js";
import { createApp } from "./app.js";

const config = loadConfig();
loadInventory(config.inventoryPath);
const app = createApp(config, { checkDependencies: createDependencyCheck(config) });
app.listen(config.port, config.host, () => {
  console.log(`Customer foundation listening on ${config.host}:${config.port}. Runtime enforcement is NOT available.`);
});
