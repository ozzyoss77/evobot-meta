import chatwootService from "src/Connections/chatwoot.class";
import Logger from "src/Utils/logger";
import appwriteService from "src/Connections/appwrite";
import { newAIResponse } from "src/AIApi/api-llm";
import "dotenv/config";

const whatsapp_messages_db = process.env.APPWRITE_WHATSAPP_MESSAGES_DB;
const whatsapp_messages_collection = process.env.APPWRITE_WHATSAPP_MESSAGES_COLLECTION;

const logger = new Logger();


export async function massiveEvent(bot, req, res) {
  try {
    const { number, url, message, event, template, languageCode } = req.body;
    const components = [
      {
        type: "header",
        parameters: [
          {
            type: event,
            [event]: {
              link: url,
            }
          }
        ]
      }
    ]
    switch (event) {
      case "image": {
        const messageSave = await bot.provider.sendTemplate(
          number,
          template,
          languageCode,
          components
        );
        await appwriteService.createDocument(
          whatsapp_messages_db,
          whatsapp_messages_collection,
          {
            phone: number,
            wamid: messageSave.messages[0].id,
            message: message
          }
        );
        const response = await fetch(url);
        const buffer = Buffer.from(await response.arrayBuffer());
        const blob = new Blob([buffer], { type: 'image/jpeg' });
        const contactID = await chatwootService.getContactID(number);
        if (!contactID) {
          await chatwootService.createContact(number, number);
        }
        const conversationID = await chatwootService.getConversationID(number);
        if (!conversationID) {
          await chatwootService.createConversation(number, message);
        }
        await chatwootService.sendMedia(conversationID, message, "outgoing", blob, "image", true);
        break;
      }
      case "video": {
        const messageSave = await bot.provider.sendTemplate(
          number,
          template,
          languageCode,
          components
        );
        await appwriteService.createDocument(
          whatsapp_messages_db,
          whatsapp_messages_collection,
          {
            phone: number,
            wamid: messageSave.messages[0].id,
            message: message
          }
        );
        const response = await fetch(url);
        const buffer = Buffer.from(await response.arrayBuffer());
        const blob = new Blob([buffer], { type: 'video/mp4' });
        const contactID = await chatwootService.getContactID(number);
        if (!contactID) {
          await chatwootService.createContact(number, number);
        }
        const conversationID = await chatwootService.getConversationID(number);
        if (!conversationID) {
          await chatwootService.createConversation(number, message);
        }
        await chatwootService.sendMedia(conversationID, message, "outgoing", blob, "video", true);
        break;
      }
      case "document": {
        const messageSave = await bot.provider.sendTemplate(
          number,
          template,
          languageCode,
          components
        );
        await appwriteService.createDocument(
          whatsapp_messages_db,
          whatsapp_messages_collection,
          {
            phone: number,
            wamid: messageSave.messages[0].id,
            message: message
          }
        );
        const response = await fetch(url);
        const buffer = Buffer.from(await response.arrayBuffer());
        const blob = new Blob([buffer], { type: 'application/pdf' });
        const contactID = await chatwootService.getContactID(number);
        if (!contactID) {
          await chatwootService.createContact(number, number);
        }
        const conversationID = await chatwootService.getConversationID(number);
        if (!conversationID) {
          await chatwootService.createConversation(number, message);
        }
        await chatwootService.sendMedia(conversationID, message, "outgoing", blob, "document", true);
        break;
      }
      case "text": {
        const messageSave = await bot.provider.sendTemplate(
          number,
          template,
          languageCode,
        );
        await appwriteService.createDocument(
          whatsapp_messages_db,
          whatsapp_messages_collection,
          {
            phone: number,
            wamid: messageSave.messages[0].id,
            message: message
          }
        );
        const contactID = await chatwootService.getContactID(number);
        if (!contactID) {
          await chatwootService.createContact(number, number);
        }
        const conversationID = await chatwootService.getConversationID(number);
        if (!conversationID) {
          await chatwootService.createConversation(number, message);
        }
        await chatwootService.sendNotes(number, message, "outgoing", true);
        break;
      }
    }
    logger.log(`Message sent to ${number}`);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "sended" }));
  } catch (error) {
    logger.error(
      `Error en massiveEvent: ${error}`
    );
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en massiveEvent" }));
  }
}

