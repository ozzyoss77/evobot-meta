import { createBot, createProvider, createFlow } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { MetaProvider as Provider } from '@builderbot/provider-meta'
import {
  massiveEvent,
} from "./Controllers/controllers";
import { deleteThread } from "src/AIApi/api-llm";
import initFlow from "./Flows/init.flow";
import textFlow from "./Flows/text.flow";
import voiceFlow from "./Flows/voice.flow";
import imageFlow from "./Flows/image.flow";
import locationFlow from "./Flows/Handlers/location.flow";
import documentFlow from "./Flows/Handlers/document.flow";
import botSwitcherFlow from "./Flows/Handlers/bot.switcher";
import blockFlow from "./Flows/Handlers/block.flow";
import { idleFlow } from "./Utils/idle";
import Logger from "src/Utils/logger";
import { recuMassive } from "./Controllers/recu.controller";
import 'dotenv/config'

const logger = new Logger();

const PORT = process.env.PORT ?? 3004
const recuTokenMassive = process.env.RECU_TOKEN_MASSIVE || ''

const main = async () => {
  logger.log(
    `Starting server on port ${PORT}, Timezone: ${process.env.BOT_TIMEZONE}`
  );

  const adapterFlow = createFlow([
    initFlow,
    textFlow,
    voiceFlow,
    imageFlow,
    locationFlow,
    documentFlow,
    botSwitcherFlow,
    blockFlow,
    idleFlow
  ])
  const adapterProvider = createProvider(Provider, {
    jwtToken: process.env.BOT_JWT_TOKEN,
    numberId: process.env.BOT_NUMBER_ID,
    verifyToken: process.env.BOT_VERIFY_TOKEN,
    version: process.env.BOT_VERSION,
  })
  const adapterDB = new Database()

  const { handleCtx, httpServer } = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  })

  /**
 * *Massive Event Endpoint
 */
  adapterProvider.server.post(
    "/v1/massive",
    handleCtx(async (bot, req, res) => {
      try {
        return await massiveEvent(bot, req, res);
      } catch (error) {
        logger.error(`Error en massiveEvent: ${error}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Error en massiveEvent" }));
      }
    })
  );

  /**
   * *Delete thread endpoint
   */
  adapterProvider.server.post(
    "/v1/deleteThread",
    handleCtx(async (bot, req, res) => {
      try {
        await deleteThread(req.body.slug as string);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Thread deleted successfully" }));
      } catch (error) {
        logger.error(`Error en deleteThread: ${error}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Error en deleteThread" }));
      }
    })
  );

  /**
   * *Check Health
   */
  adapterProvider.server.get(
    "/v1/health",
    handleCtx(async (bot, req, res) => {
      try {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
      } catch (error) {
        logger.error(`Error en health: ${error}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Error en health" }));
      }
    })
  );

  adapterProvider.server.post(
    "/v1/recu-massive",
    handleCtx(async (bot, req, res) => {
      try {
        if (req.headers['Authorization'] !== recuTokenMassive) {
          res.writeHead(401, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Unauthorized" }));
        }
        return await recuMassive(bot, req, res);
      } catch (error) {
        logger.error(`Error en recu: ${error}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Error en recu" }));
      }
    })
  );

  httpServer(+PORT)
}

main()
