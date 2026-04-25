import "dotenv/config";
import app from "./app";
import "./bot";
import { logger } from "./lib/logger";

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  logger.info({ port }, "Server listening");
});
