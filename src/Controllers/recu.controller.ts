import chatwootService from "src/Connections/chatwoot.class";
import Logger from "src/Utils/logger";
import appwriteService from "src/Connections/appwrite";
import "dotenv/config";

const logger = new Logger();

function replaceVariables(text: string, variables: { [key: string]: string }): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] || match);
}

export async function recuMassive(bot, req, res) {
  try {
    const { phone, name, businessName, amount, mediaUrl, mediaType, mediaTranscript, template, templateLanguage, templateBody } = req.body;
    const templateBodyParsed = replaceVariables(templateBody, {
      name,
      businessName,
      amount
    });
    await bot.provider.sendTemplate(
      phone,
      template,
      templateLanguage,
      [
        {
          type: "header",
          parameters: [
            {
              type: mediaType,
              link: mediaUrl,
            }
          ]
        },
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: name
            },
            {
              type: "text",
              text: businessName
            },
            {
              type: "text",
              text: amount
            }
          ]
        }
      ]
    )
    const contactID = await chatwootService.getContactID(phone);
    if (!contactID) {
      await chatwootService.createContact(phone, name);
    }
    const conversationID = await chatwootService.getConversationID(phone);
    if (!conversationID) {
      await chatwootService.createConversation(phone, templateBodyParsed);
    }
    await chatwootService.sendNotes(phone, templateBodyParsed, "outgoing", true);
    await appwriteService.createDocument(
      'recu_clients_db',
      'recu_clients',
      {
        phone,
        name,
        businessName,
        amount,
        mediaUrl,
        mediaTranscript
      });
    logger.log(`template sended to ${phone}`);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "sended" }));
  } catch (error) {
    logger.error(`Error en recuMassive: ${error}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not sended" }));
  }
}