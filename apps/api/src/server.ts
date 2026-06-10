import { createApp } from "./app.js";
import { config } from "./config.js";
import { migrate } from "./db/pool.js";

await migrate();

const app = createApp();

app.listen(config.port, () => {
  console.log(`Novasweeper API listening on http://localhost:${config.port}`);
});
