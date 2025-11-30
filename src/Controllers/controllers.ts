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
    logger.log(`📅 Controller: Processing calendar event webhook`);
    
    const { triggerEvent, payload } = req.body;
    
    if (triggerEvent === "BOOKING_CREATED") {
      const phone = payload?.responses?.phone?.value;
      const calName = payload?.responses?.name?.value;
      const phoneFormatted = phone.replace(/^\+/, "");
      
      logger.log(`📅 Calendar: Processing BOOKING_CREATED for ${calName} (${phoneFormatted})`);
      
      const rawDate = payload?.startTime;
      const linkMeeting = payload?.metadata?.videoCallUrl || "";
      const timeZone = payload?.organizer?.timeZone;
      const { date, time } = formatDateTime(rawDate, timeZone);
      const bodyText = `${process.env.CAL_CREATED_EVENT_MESSAGE}\n\nNombre: ${calName}\nFecha: ${date}\nHora: ${time} (GMT-5) Bogotá, Colombia\n\n${linkMeeting}`
      
      logger.log(`📱 WhatsApp: Sending booking confirmation message to ${phoneFormatted}`);
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
        await chatwootService.createContact(phone, calName);
      }
      const conversationID = await chatwootService.getConversationID(phone);
      if (!conversationID) {
        await chatwootService.createConversation(phone, bodyText);
      }
      await chatwootService.sendNotes(phone, bodyText, "outgoing", true);
      
      logger.log(`✅ Calendar: Booking created successfully for ${calName} (${phoneFormatted})`);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "sended" }));
      
    } else if (triggerEvent === "MEETING_STARTED") {
      const phone = payload?.responses?.phone?.value;
      const calName = payload?.responses?.name?.value;
      const phoneFormatted = phone.replace(/^\+/, "");
      
      logger.log(`📅 Calendar: Processing MEETING_STARTED for ${calName} (${phoneFormatted})`);
      
      const linkMeeting = payload?.metadata?.videoCallUrl || "";
      const bodyText = `Saludos nuevamente, solo quiero recordarte que tu reunión agendada acaba de iniciar. 😀}\n\nNombre: ${calName}\n\n${linkMeeting}`
      
      logger.log(`📱 WhatsApp: Sending meeting started notification to ${phoneFormatted}`);
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
        await chatwootService.createContact(phone, calName);
      }
      const conversationID = await chatwootService.getConversationID(phone);
      if (!conversationID) {
        await chatwootService.createConversation(phone, bodyText);
      }
      await chatwootService.sendNotes(phone, bodyText, "outgoing", true);
      
      logger.log(`✅ Calendar: Meeting started notification sent to ${calName} (${phoneFormatted})`);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "sended" }));
      
    } else if (triggerEvent === "PING") {
      logger.log(`🏓 Calendar: Received PING event - responding OK`);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok" }));
    }
    
    logger.log(`⚠️ Calendar: Unknown trigger event '${triggerEvent}' - no action taken`);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "not sended" }));
  } catch (error) {
    logger.error(`❌ Calendar Error: ${error.response?.data?.response?.message || error.message || error}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en calendarEvent" }));
  }
}

export async function massiveEvent(bot, req, res) {
  try {
    logger.log(`🚀 Controller: Processing massive event request`);
    
    const { number, url, message, event, template, languageCode } = req.body;
    
    logger.log(`📤 Massive: Sending ${event} event to ${number} using template ${template}`);
    
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
        logger.log(`🖼️ Massive: Processing image template for ${number}`);
        
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
        
        logger.log(`📥 Massive: Downloading image from ${url}`);
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
        
        logger.log(`✅ Massive: Image sent successfully to ${number}`);
        break;
      }
      case "video": {
        logger.log(`🎥 Massive: Processing video template for ${number}`);
        
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
        
        logger.log(`📥 Massive: Downloading video from ${url}`);
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
        
        logger.log(`✅ Massive: Video sent successfully to ${number}`);
        break;
      }
      case "document": {
        logger.log(`📄 Massive: Processing document template for ${number}`);
        
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
        
        logger.log(`📥 Massive: Downloading document from ${url}`);
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
        
        logger.log(`✅ Massive: Document sent successfully to ${number}`);
        break;
      }
      case "text": {
        logger.log(`💬 Massive: Processing text template for ${number}`);
        
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
        
        logger.log(`✅ Massive: Text sent successfully to ${number}`);
        break;
      }
    }
    
    logger.log(`✅ Massive: Message sent successfully to ${number}`);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "sended" }));
  } catch (error) {
    logger.error(`❌ Massive Error: ${error}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en massiveEvent" }));
  }
}

export async function updateContact(req, res) {
  const { phoneNumber, attribute, attributeValue } = req.body;
  try {
    logger.log(`👤 Controller: Updating contact ${phoneNumber} - setting ${attribute} to ${attributeValue}`);
    
    await chatwootService.setAttributes(phoneNumber, attribute, attributeValue);
    
    logger.log(`✅ Contact: Successfully updated ${phoneNumber} with ${attribute}: ${attributeValue}`);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  } catch (error) {
    logger.error(`❌ Contact Error: Failed to update ${phoneNumber} - ${error?.data || error}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Error updating contact" }));
  }
}

export async function ghlEvent(bot, req, res) {
  try {
    logger.log(`🏢 Controller: Processing GHL event webhook`);
    
    const { phone, first_name } = req.body;
    // Verificamos si el teléfono tiene un + al inicio y lo removemos, si no tiene + se mantiene igual
    const removePlusPhone = phone.startsWith('+') ? phone.substring(1) : phone;
    
    logger.log(`🏢 GHL: Processing event for ${first_name} (${removePlusPhone}) - multimedia mode: ${ghlMultimediaActivate}`);
    
    if (ghlMultimediaActivate === "image") {
      logger.log(`🖼️ GHL: Sending image multimedia to ${removePlusPhone}`);
      
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
      
      logger.log(`📥 GHL: Downloading image from ${process.env.GHL_MULTIMEDIA_URL}`);
      const response = await fetch(process.env.GHL_MULTIMEDIA_URL);
      const buffer = Buffer.from(await response.arrayBuffer());
      const blob = new Blob([buffer], { type: 'image/jpeg' });
      
      const contactID = await chatwootService.getContactID(removePlusPhone);
      if (!contactID) {
        await chatwootService.createContact(removePlusPhone, first_name);
      }
      const conversationID = await chatwootService.getConversationID(removePlusPhone);
      if (!conversationID) {
        await chatwootService.createConversation(removePlusPhone, `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`);
      }
      await chatwootService.sendMedia(conversationID, `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`, "outgoing", blob, "image", true);
      
    } else if (ghlMultimediaActivate === "video") {
      logger.log(`🎥 GHL: Sending video multimedia to ${removePlusPhone}`);
      
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
      
      logger.log(`📥 GHL: Downloading video from ${process.env.GHL_MULTIMEDIA_URL}`);
      const response = await fetch(process.env.GHL_MULTIMEDIA_URL);
      const buffer = Buffer.from(await response.arrayBuffer());
      const blob = new Blob([buffer], { type: 'video/mp4' });
      
      const contactID = await chatwootService.getContactID(removePlusPhone);
      if (!contactID) {
        await chatwootService.createContact(removePlusPhone, first_name);
      }
      const conversationID = await chatwootService.getConversationID(removePlusPhone);
      if (!conversationID) {
        await chatwootService.createConversation(removePlusPhone, `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`);
      }
      await chatwootService.sendMedia(conversationID, `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`, "outgoing", blob, "video", true);
      
    } else {
      logger.log(`💬 GHL: Sending text message to ${removePlusPhone}`);
      
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
        await chatwootService.createContact(removePlusPhone, first_name);
      }
      const conversationID = await chatwootService.getConversationID(removePlusPhone);
      if (!conversationID) {
        await chatwootService.createConversation(removePlusPhone, `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`);
      }
      await chatwootService.sendNotes(removePlusPhone, `Hola ${first_name}! ${process.env.GHL_CREATED_EVENT_MESSAGE}`, "outgoing", true);
    }
    
    logger.log(`✅ GHL: Event processed successfully for ${first_name} (${removePlusPhone})`);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  } catch (error) {
    logger.error(`❌ GHL Error: ${error}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en ghlEvent" }));
  }
}

export async function hubspotEvent(bot, req, res) {
  try {
    logger.log(`🟠 Controller: Processing HubSpot event webhook`);
    
    const { phone, firstname } = req.body;
    const removePlusPhone = phone.replace(/^(\+)?/, "");
    
    logger.log(`🟠 HubSpot: Processing event for ${firstname} (${removePlusPhone})`);
    
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
      await chatwootService.createContact(removePlusPhone, firstname);
    }
    const conversationID = await chatwootService.getConversationID(removePlusPhone);
    if (!conversationID) {
      await chatwootService.createConversation(removePlusPhone, `Hola ${firstname}! ${process.env.HUBSPOT_CREATED_EVENT_MESSAGE}`);
    }
    await chatwootService.sendNotes(removePlusPhone, `Hola ${firstname}! ${process.env.HUBSPOT_CREATED_EVENT_MESSAGE}`, "outgoing", true);
    
    logger.log(`✅ HubSpot: Event processed successfully for ${firstname} (${removePlusPhone})`);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  } catch (error) {
    logger.error(`❌ HubSpot Error: ${error}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en hubspotEvent" }));
  }
}

export async function getTokens(bot, req, res) {
  logger.log(`🔐 Controller: Processing tokens request`);
  
  const { bill_period, apikey } = req.body;
  
  if (!apikey) {
    logger.error(`❌ Tokens: Missing API key in request`);
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Need apikey" }));
  }
  
  if (apikey !== process.env.ADMIN_APIKEY) {
    logger.error(`❌ Tokens: Unauthorized API key attempt`);
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Not authorized" }));
  }
  
  if (!bill_period) {
    logger.error(`❌ Tokens: Missing bill_period parameter`);
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Need all parameters" }));
  }

  try {
    logger.log(`🔍 Tokens: Fetching tokens for bill period: ${bill_period}`);
    
    const response = await appwriteService.getTokensByWorkspace(bill_period);

    if (!response || response.length === 0) {
      logger.log(`⚠️ Tokens: No token information found for period ${bill_period}`);
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

    logger.log(`✅ Tokens: Successfully retrieved data for ${result.length} workspaces in period ${bill_period}`);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(result));
  } catch (error) {
    logger.error(`❌ Tokens Error: ${error.response?.data || error.message || error}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Error interno del servidor" }));
  }
}

export async function followUp(bot, req, res) {
  try {
    logger.log(`🔄 Controller: Processing follow-up request`);
    logger.log(`🔄 FollowUp: Updating intent with data: ${JSON.stringify(req.body)}`);
    
    await followUpService.updateIntent(req.body);
    
    logger.log(`✅ FollowUp: Intent updated successfully`);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  } catch (error) {
    logger.error(`❌ FollowUp Error: ${error}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Error en followUp" }));
  }
}

export async function shopifyConfirmationEvent(bot, req, res) {
  try {
    logger.log(`🛒 Controller: Processing Shopify webhook event`);
    
    const data = req.body;
    
    if (data?.confirmation_number) {
      logger.log(`🛒 Shopify: Processing order confirmation - Order #${data?.order_number}`);
      
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

      logger.log(`🛒 Shopify: Order confirmation for ${name} (${phone}) - Total: ${totalPrice} ${currency}`);
      logger.log(`🤖 AI: Generating order confirmation response`);

      const { textResponse } = await newAIResponse(phone, `Evento: Confirmación de orden\nNombre: ${name}\nOrden: #${orderId}\nItems: ${productsList}\nTotal: ${totalPrice} ${currency}`);
      
      logger.log(`📱 WhatsApp: Sending order confirmation to ${phone}`);
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
        await chatwootService.createContact(phone, name);
      }
      const conversationID = await chatwootService.getConversationID(phone);
      if (!conversationID) {
        await chatwootService.createConversation(phone, textResponse);
      }
      await chatwootService.sendNotes(phone, textResponse, "outgoing", true);
      
      logger.log(`✅ Shopify: Order confirmation processed successfully for ${name} (${phone})`);
    }
    
    if (data?.tracking_company) {
      logger.log(`🚚 Shopify: Processing shipping notification - Order #${data?.order_id}`);
      
      let phone = data?.destination?.phone;
      phone = phone.startsWith('1') ? phone : `1${phone}`;
      const name = data?.destination?.name;
      const orderId = data?.order_id;
      const trackingCompany = data?.tracking_company;
      const trackingNumber = data?.tracking_number;
      const trackingUrl = data?.tracking_url;

      logger.log(`🚚 Shopify: Shipping notification for ${name} (${phone}) - Tracking: ${trackingNumber}`);
      logger.log(`🤖 AI: Generating shipping notification response`);

      const { textResponse } = await newAIResponse(phone, `Evento: Envio de orden\nNombre: ${name}\nOrden: #${orderId}\nEmpresa de envio: ${trackingCompany}\nNúmero de envio: ${trackingNumber}\nURL de envio: ${trackingUrl}`);
      
      logger.log(`📱 WhatsApp: Sending shipping notification to ${phone}`);
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
        await chatwootService.createContact(phone, name);
      }
      const conversationID = await chatwootService.getConversationID(phone);
      if (!conversationID) {
        await chatwootService.createConversation(phone, textResponse);
      }
      await chatwootService.sendNotes(phone, textResponse, "outgoing", true);
      
      logger.log(`✅ Shopify: Shipping notification processed successfully for ${name} (${phone})`);
    }
    
    logger.log(`✅ Shopify: Webhook processed successfully`);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  } catch (error) {
    logger.error(`❌ Shopify Error: ${error}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Error en shopifyEvent" }));
  }
}