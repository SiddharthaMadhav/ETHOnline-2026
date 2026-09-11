import { createDb } from "@hark-protocol/db";
import { config } from "./config.js";
import { createApp } from "./app.js";

const db = createDb(config.databaseUrl);
const app = createApp(db);

app.listen(config.apiPort, () => {
  console.log(`hark-api listening on http://localhost:${config.apiPort}`);
});
