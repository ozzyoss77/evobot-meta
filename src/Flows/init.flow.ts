import { addKeyword, EVENTS } from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { MetaProvider as Provider } from "@builderbot/provider-meta";
import { checkBlock } from "src/Utils/checkblock";
import { createMessageQueue, QueueConfig } from "src/Utils/enqueue-messages";
import { inyectDateTime } from "src/Utils/formatter";
import textFlow from "./text.flow";
import appwriteService from "src/Connections/appwrite";
import chatwootService from "src/Connections/chatwoot.class";
import Logger from "src/Utils/logger";
import followUpService from "src/Services/followup-service";
import "dotenv/config";

const botPhoneNumber = process.env.BOT_PHONENUMBER || '000';
const whatsapp_messages_db = process.env.APPWRITE_WHATSAPP_MESSAGES_DB;
const whatsapp_messages_collection = process.env.APPWRITE_WHATSAPP_MESSAGES_COLLECTION;
const whitelist = process.env.BOT_WHITELIST || "false";
const followUpActivate = process.env.BOT_FOLLOWUP_ACTIVATE || "false";
const host = process.env.BOT_HOST || "http://localhost:3000";
const logger = new Logger();
const announcementMetrics = {
  messages: process.env.BOT_ANNOUNCEMENT_METRICS_MESSAGES?.split(',').map(msg => msg.trim()) || []
};
const announcementMetricsCodes = {
  codes: process.env.BOT_ANNOUNCEMENT_METRICS_CODES?.split(',').map(msg => msg.trim()) || []
}
const announcementMetricsActivate = process.env.BOT_ANNOUNCEMENT_METRICS_ACTIVATE || 'false';

const queueConfig: QueueConfig = {
  gapSeconds: parseInt(process.env.BOT_COUNTDOWN_TIME) || 3000,
};
const enqueueMessages = createMessageQueue(queueConfig);

const initFlow = addKeyword<Provider, Database>(EVENTS.WELCOME).addAction(
  async (ctx, { gotoFlow, state, globalState, endFlow, provider }) => {
    if (ctx.to !== botPhoneNumber) {
      return endFlow();
    }

    // *Update the state with user details
    await state.update({
      name: ctx.name,
      phone: ctx.from,
      message_id: ctx.message_id,
    });
    await appwriteService.createDocument(
      whatsapp_messages_db,
      whatsapp_messages_collection,
      {
        phone: ctx.from,
        wamid: ctx.message_id,
        message: ctx.body,
      }
    );

    const isBlocked = await checkBlock(state, globalState);
    if (isBlocked) return endFlow();

    // if (announcementMetricsActivate === 'true' && announcementMetrics.messages.includes(ctx.body)) {
    //   const messageIndex = announcementMetrics.messages.indexOf(ctx.body);
    //   const correspondingCode = announcementMetricsCodes.codes[messageIndex];
    //   logger.log(`Mensaje coincidente detectado: ${ctx.body}`);
    //   logger.log(`Código correspondiente: ${correspondingCode}`);
    //   const labels = await chatwootService.getLabels(state.get("conversationID")) || [];
    //   labels.push(correspondingCode);
    //   await chatwootService.setLabels(state.get("phone"), labels);
    // }

    // *If phone is not whitelisted, end the flow
    if (whitelist === "true") {
      const isWhitelisted = await appwriteService.searchOneDocument(
        "whitelist",
        "whitelist",
        "equal",
        "phone",
        state.get("phone")
      );
      if (!isWhitelisted) return endFlow(); // Ends the flow immediately if phone is whitelisted
    }

    if (followUpActivate === 'true') {
      const followUpRecord = await followUpService.getFollowUpRecord(state.get("phone"), provider);
      if (!followUpRecord) {
        await followUpService.registerIncompleteConversation(state.get("phone"), `${host}/v1/followup`);
      }
    }

    try {
      enqueueMessages(ctx.from, ctx.body, async (messages) => {
        const time = inyectDateTime();
        if (ctx.quoted !== null) {
          const quotedMessage = await appwriteService.searchOneDocument(whatsapp_messages_db, whatsapp_messages_collection, "equal", "wamid", ctx.quoted);
          
          let messageContent = '';
          let imageBuffer = null;

          // Obtener el contenido del mensaje o caption
          if (quotedMessage?.message) {
            messageContent = quotedMessage.message;
          } else if (quotedMessage?.caption) {
            messageContent = quotedMessage.caption;
          }

          // Si hay una URL, obtener el buffer
          if (quotedMessage?.url) {
            try {
              const response = await fetch(quotedMessage.url);
              imageBuffer = Buffer.from(await response.arrayBuffer());
            } catch (error) {
              logger.error(`Error al obtener el buffer de la URL: ${error}`);
            }
          }
          await state.update({
            message: `Fecha y hora actual: ${time}\nMensaje citado: ${messageContent}\n${messages}`,
            ...(imageBuffer && { imageQuoted: imageBuffer })
          });
          
          return gotoFlow(textFlow);
        } else {
          await state.update({
            message: `Fecha y hora actual: ${time}\nMensaje: ${ctx.body}`,
          });
          return gotoFlow(textFlow);
        }
      });
    } catch (error) {
      logger.error(`Error en initFlow: ${error}`);
      return endFlow("Algo salió mal, intenta de nuevo más tarde.");
    }
  }
);

export default initFlow;
