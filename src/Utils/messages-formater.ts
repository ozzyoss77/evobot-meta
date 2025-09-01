import appwriteService from "src/Connections/appwrite";
import Logger from "src/Utils/logger";
import "dotenv/config";

const logger = new Logger();

const whatsapp_messages_db = process.env.APPWRITE_WHATSAPP_MESSAGES_DB;
const whatsapp_messages_collection = process.env.APPWRITE_WHATSAPP_MESSAGES_COLLECTION;


export async function sendTextFormated(phone: string, message: string, provider: any) {
  try {
    logger.log(`📤 MessageFormatter: Sending text message to ${phone}`);
    logger.log(`💬 MessageFormatter: Message content preview: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
    
    // Usar el splitter para dividir mensajes largos
    const messageParts = splitMessage(message);
    const messageIds: string[] = [];
    
    for (let i = 0; i < messageParts.length; i++) {
      const part = messageParts[i];
      
      logger.log(`📤 MessageFormatter: Sending part ${i + 1}/${messageParts.length} to ${phone}`);
      
      const messageSave = await provider.sendText(phone, part);
      
      if (!messageSave?.messages?.[0]?.id) {
        logger.error(`❌ MessageFormatter: Failed to send text part ${i + 1} to ${phone} - No message ID returned: ${JSON.stringify(messageSave)}`);
        continue;
      }
      
      logger.log(`📱 WhatsApp: Text message part ${i + 1} sent successfully to ${phone} - WAMID: ${messageSave.messages[0].id}`);
      
      await appwriteService.createDocument(
        whatsapp_messages_db,
        whatsapp_messages_collection,
        {
          phone: phone,
          wamid: messageSave.messages[0].id,
          message: part,
        }
      );
      
      messageIds.push(messageSave.messages[0].id);
      
      // Delay entre partes del mensaje (excepto en la última)
      if (i < messageParts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    logger.log(`✅ MessageFormatter: All text message parts (${messageParts.length}) and database records saved for ${phone}`);
    return messageIds.length > 0 ? messageIds[0] : null; // Retorna el ID del primer mensaje para compatibilidad
  } catch (error) {
    logger.error(`❌ MessageFormatter Error: Failed to send text to ${phone} - ${error}`);
    return null;
  }
}

export async function sendMediaFormated(phone: string, type: string, url: string, provider: any, caption = '', filename = '') {
  try {
    logger.log(`📤 MessageFormatter: Sending ${type} media to ${phone}`);
    logger.log(`🔗 MessageFormatter: Media URL: ${url}`);
    
    if (caption) {
      logger.log(`💬 MessageFormatter: Caption: ${caption.substring(0, 100)}${caption.length > 100 ? '...' : ''}`);
    }
    
    if (filename && type === 'document') {
      logger.log(`📄 MessageFormatter: Document filename: ${filename}`);
    }
    
    // Si el caption es muy largo, dividirlo y enviar el primer media con el primer caption
    const captionParts = caption ? splitMessage(caption) : [''];
    const firstCaption = captionParts[0] || '';
    
    let messageSave;
    if (type === 'document') {
      logger.log(`📄 MessageFormatter: Sending document with filename to ${phone}`);
      messageSave = await provider.sendMediaUrl(phone, type, url, firstCaption, filename);
    } else {
      logger.log(`📎 MessageFormatter: Sending ${type} media to ${phone}`);
      messageSave = await provider.sendMediaUrl(phone, type, url, firstCaption);
    }
    
    if (!messageSave?.messages?.[0]?.id) {
      logger.error(`❌ MessageFormatter: Failed to send ${type} media to ${phone} - No message ID returned: ${JSON.stringify(messageSave)}`);
      return null;
    }
    
    logger.log(`📱 WhatsApp: ${type} media sent successfully to ${phone} - WAMID: ${messageSave.messages[0].id}`);
    
    await appwriteService.createDocument(
      whatsapp_messages_db,
      whatsapp_messages_collection,
      {
        phone: phone,
        wamid: messageSave.messages[0].id,
        message: '',
        caption: firstCaption
      }
    );
    
    const mainMessageId = messageSave.messages[0].id;
    
    // Si hay más partes del caption, enviarlas como mensajes de texto separados
    if (captionParts.length > 1) {
      logger.log(`📤 MessageFormatter: Sending remaining caption parts (${captionParts.length - 1}) to ${phone}`);
      
      for (let i = 1; i < captionParts.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay entre mensajes
        
        const captionPart = captionParts[i];
        logger.log(`📤 MessageFormatter: Sending caption part ${i + 1}/${captionParts.length} to ${phone}`);
        
        const textMessageSave = await provider.sendText(phone, captionPart);
        
        if (textMessageSave?.messages?.[0]?.id) {
          await appwriteService.createDocument(
            whatsapp_messages_db,
            whatsapp_messages_collection,
            {
              phone: phone,
              wamid: textMessageSave.messages[0].id,
              message: captionPart,
            }
          );
          logger.log(`📱 WhatsApp: Caption part ${i + 1} sent successfully to ${phone} - WAMID: ${textMessageSave.messages[0].id}`);
        }
      }
    }
    
    logger.log(`✅ MessageFormatter: ${type} media and all caption parts saved for ${phone}`);
    return mainMessageId;
  } catch (error) {
    logger.error(`❌ MessageFormatter Error: Failed to send ${type} media to ${phone} - ${error}`);
    return null;
  }
}

// =============================================================================
// MESSAGE SPLITTER FUNCTIONALITY
// =============================================================================

/**
 * Utility to split long messages into smaller chunks for WhatsApp
 */

const MAX_MESSAGE_LENGTH = 500; // Límite de caracteres por mensaje

interface MessagePart {
  type: 'text' | 'image' | 'url';
  content: string;
}

/**
 * Extrae URLs y divide el texto en partes
 */
function extractUrlsAndText(text: string): MessagePart[] {
  const urlRegex = /https?:\/\/\S+/gi;
  const parts: MessagePart[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    // Agregar texto antes de la URL si existe
    if (match.index > lastIndex) {
      const textBefore = text.substring(lastIndex, match.index).trim();
      if (textBefore) {
        parts.push({ type: 'text', content: textBefore });
      }
    }

    // Determinar si es imagen o URL normal
    const url = match[0];
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff?)(\?|#|$)/i.test(url);
    
    parts.push({ 
      type: isImage ? 'image' : 'url', 
      content: url 
    });

    lastIndex = urlRegex.lastIndex;
  }

  // Agregar texto restante
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex).trim();
    if (remainingText) {
      parts.push({ type: 'text', content: remainingText });
    }
  }

  // Si no hay URLs, devolver todo como texto
  if (parts.length === 0) {
    parts.push({ type: 'text', content: text });
  }

  return parts;
}

/**
 * Divide un mensaje largo en múltiples mensajes más pequeños
 * @param message - El mensaje a dividir
 * @param maxLength - Longitud máxima por mensaje (por defecto 2000)
 * @returns Array de mensajes divididos
 */
export function splitMessage(message: string, maxLength: number = MAX_MESSAGE_LENGTH): string[] {
  if (message.length <= maxLength) {
    return [message];
  }

  const messages: string[] = [];
  let currentMessage = '';
  
  // Dividir por párrafos primero (doble salto de línea)
  const paragraphs = message.split('\n\n');
  
  for (const paragraph of paragraphs) {
    // Si el párrafo completo cabe en el mensaje actual
    if ((currentMessage + '\n\n' + paragraph).length <= maxLength) {
      if (currentMessage) {
        currentMessage += '\n\n' + paragraph;
      } else {
        currentMessage = paragraph;
      }
    } else {
      // Guardar el mensaje actual si tiene contenido
      if (currentMessage) {
        messages.push(currentMessage);
        currentMessage = '';
      }
      
      // Si el párrafo es muy largo, dividirlo por líneas
      if (paragraph.length > maxLength) {
        const lines = paragraph.split('\n');
        
        for (const line of lines) {
          if ((currentMessage + '\n' + line).length <= maxLength) {
            if (currentMessage) {
              currentMessage += '\n' + line;
            } else {
              currentMessage = line;
            }
          } else {
            // Guardar mensaje actual
            if (currentMessage) {
              messages.push(currentMessage);
              currentMessage = '';
            }
            
            // Si la línea sigue siendo muy larga, dividir por palabras
            if (line.length > maxLength) {
              const words = line.split(' ');
              
              for (const word of words) {
                if ((currentMessage + ' ' + word).length <= maxLength) {
                  if (currentMessage) {
                    currentMessage += ' ' + word;
                  } else {
                    currentMessage = word;
                  }
                } else {
                  if (currentMessage) {
                    messages.push(currentMessage);
                    currentMessage = word;
                  } else {
                    // Si incluso una palabra es muy larga, cortarla
                    if (word.length > maxLength) {
                      let start = 0;
                      while (start < word.length) {
                        messages.push(word.substring(start, start + maxLength));
                        start += maxLength;
                      }
                    } else {
                      currentMessage = word;
                    }
                  }
                }
              }
            } else {
              currentMessage = line;
            }
          }
        }
      } else {
        currentMessage = paragraph;
      }
    }
  }
  
  // Agregar el último mensaje si tiene contenido
  if (currentMessage) {
    messages.push(currentMessage);
  }
  
  return messages.filter(msg => msg.trim().length > 0);
}

/**
 * Envía un mensaje dividiéndolo en partes si es necesario, manejando URLs e imágenes
 * @param sendTextFunction - Función sendText a usar
 * @param sendImageFunction - Función sendImage a usar
 * @param phone - Número de teléfono
 * @param delay - Delay entre mensajes
 * @param linkPreview - Mostrar vista previa de enlaces
 * @param message - Mensaje a enviar
 * @param partDelay - Delay adicional entre partes del mensaje (por defecto 1000ms)
 * @param separateUrl - Si enviar URLs por separado (por defecto false)
 * @param logger - Logger opcional para debug
 */
export async function sendLongMessage(
  sendTextFunction: (phone: string, delay: number, linkPreview: boolean, message: string) => Promise<any>,
  sendImageFunction: (phone: string, delay: number, caption: string, url: string) => Promise<any>,
  phone: string,
  delay: number,
  linkPreview: boolean,
  message: string,
  partDelay: number = 1000,
  separateUrl: boolean = false,
  logger?: { log: (msg: string) => void; error: (msg: string) => void }
): Promise<any[]> {
  const results: any[] = [];
  
  // Extraer URLs y texto
  const parts = extractUrlsAndText(message);
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLastPart = i === parts.length - 1;
    
    try {
      if (part.type === 'image') {
        // Enviar imagen
        const result = await sendImageFunction(phone, delay, "", part.content);
        results.push(result);
        logger?.log(`Imagen enviada a ${phone}: ${part.content}`);
        
      } else if (part.type === 'url' && separateUrl) {
        // Enviar URL por separado solo si separateUrl es true
        const result = await sendTextFunction(phone, delay, linkPreview, part.content);
        results.push(result);
        logger?.log(`URL enviada a ${phone}: ${part.content}`);
        
      } else if (part.type === 'text') {
        // Dividir texto largo si es necesario
        const textParts = splitMessage(part.content);
        
        for (let j = 0; j < textParts.length; j++) {
          const textPart = textParts[j];
          const result = await sendTextFunction(phone, delay, linkPreview, textPart);
          results.push(result);
          
          // Delay entre partes de texto (excepto la última parte del último texto)
          if (j < textParts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, partDelay));
          }
        }
        
      } else if (part.type === 'url' && !separateUrl) {
        // Si separateUrl es false, incluir la URL en el texto
        const textParts = splitMessage(part.content);
        
        for (let j = 0; j < textParts.length; j++) {
          const textPart = textParts[j];
          const result = await sendTextFunction(phone, delay, linkPreview, textPart);
          results.push(result);
          
          if (j < textParts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, partDelay));
          }
        }
      }
      
      // Delay entre diferentes tipos de contenido (excepto en la última parte)
      if (!isLastPart) {
        await new Promise(resolve => setTimeout(resolve, partDelay));
      }
      
    } catch (error) {
      logger?.error(`Error enviando parte ${i}: ${error?.message}`);
    }
  }
  
  return results;
}

/**
 * Función legacy compatible con el método removeUrlsAndNotify original
 * Procesa URLs y las envía por separado, devolviendo el texto limpio
 * @param text - Texto original con URLs
 * @param sendTextFunction - Función para enviar texto
 * @param sendImageFunction - Función para enviar imágenes  
 * @param phone - Número de teléfono
 * @param separateUrl - Si enviar URLs por separado
 * @param logger - Logger opcional
 */
export async function processUrlsAndCleanText(
  text: string,
  sendTextFunction: (phone: string, delay: number, linkPreview: boolean, message: string) => Promise<any>,
  sendImageFunction: (phone: string, delay: number, caption: string, url: string) => Promise<any>,
  phone: string,
  separateUrl: boolean = false,
  logger?: { log: (msg: string) => void; error: (msg: string) => void }
): Promise<string> {
  try {
    const urlRegex = /https?:\/\/\S+/gi;
    const urls = text.match(urlRegex);
    
    if (urls) {
      for (const url of urls) {
        const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff?)(\?|#|$)/i.test(url);

        if (isImage) {
          // Siempre enviar imágenes independientemente de separateUrl
          await sendImageFunction(phone, 3000, "", url);
          logger?.log(`Imagen enviada a ${phone}: ${url}`);
        } else if (separateUrl) {
          // Solo enviar URLs normales si separateUrl es true
          await sendTextFunction(phone, 1000, true, url);
          logger?.log(`URL enviada a ${phone}: ${url}`);
        }
      }
      
      // Solo eliminar las URLs procesadas del texto
      if (separateUrl) {
        text = text.replace(urlRegex, "");
      } else {
        // Si separateUrl es false, solo eliminar las URLs de imágenes
        const imageUrls = urls.filter(url => 
          /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff?)(\?|#|$)/i.test(url)
        );
        for (const imageUrl of imageUrls) {
          text = text.replace(imageUrl, "");
        }
      }
    }
    
    return text.trim();
  } catch (error) {
    logger?.error(`Error en processUrlsAndCleanText: ${error?.message}`);
    return text;
  }
}