import { createBot, createProvider, createFlow } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { MetaProvider as Provider } from '@builderbot/provider-meta'
import {
  calendarEvent,
  massiveEvent,
  updateContact,
  ghlEvent,
  hubspotEvent,
  getTokens,
  followUp,
  shopifyConfirmationEvent,
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
   * *Calendar Endpoint
   */
  adapterProvider.server.post(
    "/v1/calendar",
    handleCtx(async (bot, req, res) => {
      try {
        return await calendarEvent(bot, req, res);
      } catch (error) {
        logger.error(`Error en calendarEvent: ${error}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Error en calendarEvent" }));
      }
    })
  );

  /**
   * *Update contact endpoint
   */
  adapterProvider.server.post(
    "/v1/updatecontact",
    handleCtx(async (bot, req, res) => {
      try {
        return await updateContact(req, res);
      } catch (error) {
        logger.error(`Error en updateContact: ${error}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Error en updateContact" }));
      }
    })
  );

  /**
   * *Go High Level endpoint
   */
  adapterProvider.server.post(
    "/v1/ghl",
    handleCtx(async (bot, req, res) => {
      try {
        return await ghlEvent(bot, req, res);
      } catch (error) {
        logger.error(`Error en Go High Level endpoint: ${error}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Error en getInstanceState" }));
      }
    })
  );

  /**
   * *Hubspot endpoint
   */
  adapterProvider.server.post(
    "/v1/hubspot",
    handleCtx(async (bot, req, res) => {
      try {
        return await hubspotEvent(bot, req, res);
      } catch (error) {
        logger.error(`Error en hubspotEvent: ${error}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Error en hubspotEvent" }));
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
   * *Follow-up endpoint
   */
  adapterProvider.server.post(
    "/v1/followup",
    handleCtx(async (bot, req, res) => {
      try {
        await followUp(bot, req, res);
      } catch (error) {
        logger.error(`Error en followUp: ${error}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Error en followUp" }));
      }
    })
  );

  /**
   * *Shopify Notification endpoint
   */
  adapterProvider.server.post(
    "/v1/shopify",
    handleCtx(async (bot, req, res) => {
      try {
        return await shopifyConfirmationEvent(bot, req, res);
      } catch (error) {
        logger.error(`Error en shopifyEvent: ${error}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Error en shopifyEvent" }));
      }
    })
  );

  /**
   * *Get tokens endpoint
   */
  adapterProvider.server.post(
    "/v1/tokens",
    handleCtx(async (bot, req, res) => {
      try {
        return await getTokens(bot, req, res);
      } catch (error) {
        logger.error(`Error en tokens: ${error}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Error en tokens" }));
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

  httpServer(+PORT)
}

main()
