import { resolve } from "node:path";
import { loadInventory } from "./config.js";

const solutions = loadInventory(resolve(process.env.SOLUTION_CONFIG_FILE || "./config/solutions.json"));
console.log(`Inventory valid: ${solutions.length} customer solution(s). Enforcement remains disabled.`);
