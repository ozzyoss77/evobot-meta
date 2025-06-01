import appwriteService from "src/Connections/appwrite";

const whatsapp_messages_db = process.env.APPWRITE_WHATSAPP_MESSAGES_DB;
const whatsapp_messages_collection = process.env.APPWRITE_WHATSAPP_MESSAGES_COLLECTION;


export async function sendTextFormated(phone: string, message: string, provider: any){
    const messageSave = await provider.sendText(phone, message);
    await appwriteService.createDocument(
        whatsapp_messages_db,
        whatsapp_messages_collection,
        {
            phone: phone,
            wamid: messageSave.messages[0].id,
            message: message,
        }
    );
    return messageSave.messages[0].id;
}

export async function sendMediaFormated(phone: string, type: string, url: string, provider: any, caption = ''){
    const messageSave = await provider.sendMediaUrl(phone, type, url);
    await appwriteService.createDocument(
        whatsapp_messages_db,
        whatsapp_messages_collection,
        {
            phone: phone,
            wamid: messageSave.messages[0].id,
            message: '',
            caption
        }
    );
    return messageSave.messages[0].id;
}