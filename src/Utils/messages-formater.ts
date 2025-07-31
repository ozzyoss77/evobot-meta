import appwriteService from "src/Connections/appwrite";
import Logger from "src/Utils/logger";

const logger = new Logger();

const whatsapp_messages_db = process.env.APPWRITE_WHATSAPP_MESSAGES_DB;
const whatsapp_messages_collection = process.env.APPWRITE_WHATSAPP_MESSAGES_COLLECTION;


export async function sendTextFormated(phone: string, message: string, provider: any) {
  const messageSave = await provider.sendText(phone, message);
  await appwriteService.createDocument(
    whatsapp_messages_db,
    whatsapp_messages_collection,
    {
      phone: phone,
      wamid: messageSave?.messages?.[0]?.id,
      message: message,
    }
  );
  if (!messageSave?.messages?.[0]?.id) {
    logger.error(`Error en sendTextFormated: ${messageSave}`);
  }
  return messageSave?.messages?.[0]?.id;
}

export async function sendMediaFormated(phone: string, type: string, url: string, provider: any, caption = '', filename = '') {
  let messageSave;
  if (type === 'document') {
    messageSave = await provider.sendMediaUrl(phone, type, url, caption, filename);
  } else {
    messageSave = await provider.sendMediaUrl(phone, type, url, caption);
  }
  await appwriteService.createDocument(
    whatsapp_messages_db,
    whatsapp_messages_collection,
    {
      phone: phone,
      wamid: messageSave?.messages?.[0]?.id,
      message: '',
      caption
    }
  );
  if (!messageSave?.messages?.[0]?.id) {
    logger.error(`Error en sendMediaFormated: ${messageSave}`);
  }
  return messageSave?.messages?.[0]?.id;
}