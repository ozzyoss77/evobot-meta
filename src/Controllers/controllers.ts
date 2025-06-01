import axios from "axios";
import chatwootService from "src/Connections/chatwoot.class";
import { formatDateTime } from "src/Utils/formatter";
import Logger from "src/Utils/logger";
import appwriteService from "src/Connections/appwrite";
import followUpService from "src/Services/followup-service";
import { newAIResponse } from "src/AIApi/api-llm";
import "dotenv/config";

const whatsapp_messages_db = process.env.APPWRITE_WHATSAPP_MESSAGES_DB;
const whatsapp_messages_collection = process.env.APPWRITE_WHATSAPP_MESSAGES_COLLECTION;

const logger = new Logger();
const ghlMultimediaActivate = process.env.GHL_MULTIMEDIA_ACTIVATE || "text";

export async function calendarEvent(bot, req, res) {
  try {
    const { triggerEvent, payload } = req.body;
    if (triggerEvent === "BOOKING_CREATED") {
      const phone = payload?.responses?.phone?.value;
      const calName = payload?.responses?.name?.value;
      const phoneFormatted = phone.replace(/^\+/, "");
      const rawDate = payload?.startTime;
      const linkMeeting = payload?.metadata?.videoCallUrl || "";
      const timeZone = payload?.organizer?.timeZone;
      const { date, time } = formatDateTime(rawDate, timeZone);
      const bodyText = `${process.env.CAL_CREATED_EVENT_MESSAGE}\n\nNombre: ${calName}\nFecha: ${date}\nHora: ${time} (GMT-5) Bogotá, Colombia\n\n${linkMeeting}`
      const messageSave = await bot.provider.sendText(
        phoneFormatted,
        bodyText
      );
      await appwriteService.createDocument(
        whatsapp_messages_db,
        whatsapp_messages_collection,
        {
          phone: phone,
          wamid: messageSave.messages[0].id,
          message: bodyText
        }
      );
      const contactID = await chatwootService.getContactID(phone);
      if (!contactID) {
        await chatwootService.createContact(phone, bodyText);
      }
      const conversationID = await chatwootService.getConversationID(phone);
      if (!conversationID) {
        await chatwootService.createConversation(phone, bodyText);
      }
      await chatwootService.sendNotes(phone, bodyText, "outgoing", true);
      logger.log(`Calendar event created: ${calName}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "sended" }));
    } else if (triggerEvent === "MEETING_STARTED") {
      const phone = payload?.responses?.phone?.value;
      const calName = payload?.responses?.name?.value;
      const phoneFormatted = phone.replace(/^\+/, "");
      const linkMeeting = payload?.metadata?.videoCallUrl || "";
      const bodyText = `Saludos nuevamente, solo quiero recordarte que tu reunión agendada acaba de iniciar. 😀}\n\nNombre: ${calName}\n\n${linkMeeting}`
      const messageSave = await bot.provider.sendText(
        phoneFormatted,
        bodyText
      );
      await appwriteService.createDocument(
        whatsapp_messages_db,
        whatsapp_messages_collection,
        {
          phone: phone,
          wamid: messageSave.messages[0].id,
          message: bodyText
        }
      );
      const contactID = await chatwootService.getContactID(phone);
      if (!contactID) {
        await chatwootService.createContact(phone, bodyText);
      }
      const conversationID = await chatwootService.getConversationID(phone);
      if (!conversationID) {
        await chatwootService.createConversation(phone, bodyText);
      }
      await chatwootService.sendNotes(phone, bodyText, "outgoing", true);
      logger.log(`Calendar event started: ${calName}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "sended" }));
    } else if (triggerEvent === "PING") {
      logger.log(`Calendar event ping`);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok" }));
    }
    logger.log(`Calendar event not sended`);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "not sended" }));
  } catch (error) {
    logger.error(
      `Error en calendarEvent: ${error.response.data.response.message}`
    );
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en calendarEvent" }));
  }
}

export async function massiveEvent(bot, req, res) {
  try {
    const { number, url, message, event } = req.body;
    switch (event) {
      case "image": {
        const messageSave = await bot.provider.sendMediaUrl(number, "image", url, message);
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
          await chatwootService.createContact(number, message);
        }
        const conversationID = await chatwootService.getConversationID(number);
        if (!conversationID) {
          await chatwootService.createConversation(number, message);
        }
        await chatwootService.sendMedia(conversationID, message, "outgoing", blob, "image", true);
        break;
      }
      case "video": {
        const messageSave = await bot.provider.sendMediaUrl(number, "video", url, message);
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
          await chatwootService.createContact(number, message);
        }
        const conversationID = await chatwootService.getConversationID(number);
        if (!conversationID) {
          await chatwootService.createConversation(number, message);
        }
        await chatwootService.sendMedia(conversationID, message, "outgoing", blob, "video", true);
        break;
      }
      case "document": {
        const messageSave = await bot.provider.sendMediaUrl(number, "document", url, message);
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
          await chatwootService.createContact(number, message);
        }
        const conversationID = await chatwootService.getConversationID(number);
        if (!conversationID) {
          await chatwootService.createConversation(number, message);
        }
        await chatwootService.sendMedia(conversationID, message, "outgoing", blob, "document", true);
        break;
      }
      default: {
        const messageSave = await bot.provider.sendText(number, message);
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
          await chatwootService.createContact(number, message);
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
      `Error en massiveEvent: ${error.response.data.response.message}`
    );
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en massiveEvent" }));
  }
}

export async function updateContact(req, res) {
  const { phoneNumber, attribute, attributeValue } = req.body;
  try {
    await chatwootService.setAttributes(phoneNumber, attribute, attributeValue);
    logger.log(
      `Contact ${phoneNumber} updated with ${attribute}: ${attributeValue}`
    );
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  } catch (error) {
    logger.error(`Error en updateContact: ${error?.data}`);
    return false;
  }
}

export async function ghlEvent(bot, req, res) {
  try {
    const { phone, first_name } = req.body;
    // Verificamos si el teléfono tiene un + al inicio y lo removemos, si no tiene + se mantiene igual
    const removePlusPhone = phone.startsWith('+') ? phone.substring(1) : phone;
    if (ghlMultimediaActivate === "image") {
      const messageSave = await bot.provider.sendMediaUrl(removePlusPhone, "image", process.env.GHL_MULTIMEDIA_URL, `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`);
      await appwriteService.createDocument(
        whatsapp_messages_db,
        whatsapp_messages_collection,
        {
          phone: removePlusPhone,
          wamid: messageSave.messages[0].id,
          message: `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`
        }
      );
      const response = await fetch(process.env.GHL_MULTIMEDIA_URL);
      const buffer = Buffer.from(await response.arrayBuffer());
      const blob = new Blob([buffer], { type: 'image/jpeg' });
      const contactID = await chatwootService.getContactID(removePlusPhone);
      if (!contactID) {
        await chatwootService.createContact(removePlusPhone, `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`);
      }
      const conversationID = await chatwootService.getConversationID(removePlusPhone);
      if (!conversationID) {
        await chatwootService.createConversation(removePlusPhone, `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`);
      }
      await chatwootService.sendMedia(conversationID, `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`, "outgoing", blob, "image", true);
    } else if (ghlMultimediaActivate === "video") {
      const messageSave = await bot.provider.sendMediaUrl(removePlusPhone, "video", process.env.GHL_MULTIMEDIA_URL, `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`);
      await appwriteService.createDocument(
        whatsapp_messages_db,
        whatsapp_messages_collection,
        {
          phone: removePlusPhone,
          wamid: messageSave.messages[0].id,
          message: `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`
        }
      );
      const response = await fetch(process.env.GHL_MULTIMEDIA_URL);
      const buffer = Buffer.from(await response.arrayBuffer());
      const blob = new Blob([buffer], { type: 'video/mp4' });
      const contactID = await chatwootService.getContactID(removePlusPhone);
      if (!contactID) {
        await chatwootService.createContact(removePlusPhone, `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`);
      }
      const conversationID = await chatwootService.getConversationID(removePlusPhone);
      if (!conversationID) {
        await chatwootService.createConversation(removePlusPhone, `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`);
      }
      await chatwootService.sendMedia(conversationID, `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`, "outgoing", blob, "video", true);
    } else {
      const messageSave = await bot.provider.sendText(removePlusPhone, `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`);
      await appwriteService.createDocument(
        whatsapp_messages_db,
        whatsapp_messages_collection,
        {
          phone: removePlusPhone,
          wamid: messageSave.messages[0].id,
          message: `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`
        }
      );
      const contactID = await chatwootService.getContactID(removePlusPhone);
      if (!contactID) {
        await chatwootService.createContact(removePlusPhone, `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`);
      }
      const conversationID = await chatwootService.getConversationID(removePlusPhone);
      if (!conversationID) {
        await chatwootService.createConversation(removePlusPhone, `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`);
      }
      await chatwootService.sendNotes(removePlusPhone, `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`, "outgoing", true);
    }
    logger.log(`Ghl event sent to ${removePlusPhone}`);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  } catch (error) {
    logger.error(`Error en ghlEvent: ${error}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en ghlEvent" }));
  }
}

export async function hubspotEvent(bot, req, res) {
  try {
    const { phone, firstname } = req.body;
    const removePlusPhone = phone.replace(/^(\+)?/, "");
    const messageSave = await bot.provider.sendText(removePlusPhone, `Hola ${firstname}! ${process.env.HUBSPOT_CREATED_EVENT_MESSAGE}`);
    await appwriteService.createDocument(
      whatsapp_messages_db,
      whatsapp_messages_collection,
      {
        phone: removePlusPhone,
        wamid: messageSave.messages[0].id,
        message: `Hola ${firstname}! ${process.env.HUBSPOT_CREATED_EVENT_MESSAGE}`
      }
    );
    const contactID = await chatwootService.getContactID(removePlusPhone);
    if (!contactID) {
      await chatwootService.createContact(removePlusPhone, `Hola ${firstname}! ${process.env.HUBSPOT_CREATED_EVENT_MESSAGE}`);
    }
    const conversationID = await chatwootService.getConversationID(removePlusPhone);
    if (!conversationID) {
      await chatwootService.createConversation(removePlusPhone, `Hola ${firstname}! ${process.env.HUBSPOT_CREATED_EVENT_MESSAGE}`);
    }
    await chatwootService.sendNotes(removePlusPhone, `Hola ${firstname}! ${process.env.HUBSPOT_CREATED_EVENT_MESSAGE}`, "outgoing", true);
    logger.log(`Hubspot event sent to ${removePlusPhone}`);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  } catch (error) {
    logger.error(`Error en hubspotEvent: ${error}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en hubspotEvent" }));
  }
}

export async function getTokens(bot, req, res) {
  const { bill_period, apikey } = req.body;
  if (!apikey) {
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Need apikey" }));
  }
  if (apikey !== process.env.ADMIN_APIKEY) {
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Not authorized" }));
  }
  if (!bill_period) {
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Need all parameters" }));
  }

  try {
    const response = await appwriteService.getTokensByWorkspace(bill_period);

    if (!response || response.length === 0) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({ message: "No se encontró información de tokens en Pocketbase" })
      );
    }

    // Sumar tokens por workspace y construir el objeto con la estructura deseada
    const tokensByWorkspace = response.reduce((acc, record) => {
      const { workspace, tokens } = record;
      if (!acc[workspace]) {
        acc[workspace] = { workspace, total_tokens: 0, bill_period };
      }
      acc[workspace].total_tokens += tokens;
      return acc;
    }, {});

    // Convertir a un array de resultados
    const result = Object.values(tokensByWorkspace);

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(result));
  } catch (error) {
    logger.error(`Error en getTokensByWorkspace: ${error.response?.data || error.message}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Error interno del servidor" }));
  }
}

export async function followUp(bot, req, res) {
  try {
    await followUpService.updateIntent(req.body);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  } catch (error) {
    logger.error(`Error en followUp: ${error}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Error en followUp" }));
  }
}

export async function shopifyConfirmationEvent(bot, req, res) {
  try {
    const data = req.body;
    if (data?.confirmation_number) {
      let phone = data?.shipping_address?.phone;
      phone = phone.replace(/[()]/g, '').replace(/^\+/, '');
      const name = data?.shipping_address?.name;
      const orderId = data?.order_number;
      const orderItems = data?.line_items
      const totalPrice = data?.current_total_price_set?.shop_money?.amount;
      const currency = data?.current_total_price_set?.shop_money?.currency_code;

      // process order items
      const productNames = orderItems?.map(item => item.name) || [];
      const productsList = productNames.join(', ');

      const { textResponse } = await newAIResponse(phone, `Evento: Confirmación de orden\nNombre: ${name}\nOrden: #${orderId}\nItems: ${productsList}\nTotal: ${totalPrice} ${currency}`);
      const messageSave = await bot.provider.sendText(phone, textResponse);
      await appwriteService.createDocument(
        whatsapp_messages_db,
        whatsapp_messages_collection,
        {
          phone: phone,
          wamid: messageSave.messages[0].id,
          message: textResponse
        }
      );
      const contactID = await chatwootService.getContactID(phone);
      if (!contactID) {
        await chatwootService.createContact(phone, textResponse);
      }
      const conversationID = await chatwootService.getConversationID(phone);
      if (!conversationID) {
        await chatwootService.createConversation(phone, textResponse);
      }
      await chatwootService.sendNotes(phone, textResponse, "outgoing", true);
    }
    if (data?.tracking_company) {
      let phone = data?.destination?.phone;
      phone = phone.startsWith('1') ? phone : `1${phone}`;
      const name = data?.destination?.name;
      const orderId = data?.order_id;
      const trackingCompany = data?.tracking_company;
      const trackingNumber = data?.tracking_number;
      const trackingUrl = data?.tracking_url;

      const { textResponse } = await newAIResponse(phone, `Evento: Envio de orden\nNombre: ${name}\nOrden: #${orderId}\nEmpresa de envio: ${trackingCompany}\nNúmero de envio: ${trackingNumber}\nURL de envio: ${trackingUrl}`);
      const messageSave = await bot.provider.sendText(phone, textResponse);
      await appwriteService.createDocument(
        whatsapp_messages_db,
        whatsapp_messages_collection,
        {
          phone: phone,
          wamid: messageSave.messages[0].id,
          message: textResponse
        }
      );
      const contactID = await chatwootService.getContactID(phone);
      if (!contactID) {
        await chatwootService.createContact(phone, textResponse);
      }
      const conversationID = await chatwootService.getConversationID(phone);
      if (!conversationID) {
        await chatwootService.createConversation(phone, textResponse);
      }
      await chatwootService.sendNotes(phone, textResponse, "outgoing", true);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  } catch (error) {
    logger.error(`Error en shopifyEvent: ${error}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Error en shopifyEvent" }));
  }
}