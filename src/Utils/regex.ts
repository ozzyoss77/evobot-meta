import Logger from "src/Utils/logger";
import chatwootService from "src/Connections/chatwoot.class";
import appwriteService from "src/Connections/appwrite";
import recuApiClient from "src/Connections/recu.api";
import { removeWhatsAppSuffix } from "./formatter";
import { MediaTag, Config } from '../interfaces/types';
import "dotenv/config";

const logger = new Logger();
const host = process.env.CHATWOOT_HOST;
const inboxID = process.env.CHATWOOT_INBOX_ID;
const accountId = process.env.CHATWOOT_ACCOUNT_ID;

class MediaService {
  private logger = new Logger();
  private mediaHandlers: Record<string, MediaTag>;
  private mediaTypeMap: Record<string, string> = {
    'images': 'image',
    'videos': 'video',
    'documents': 'document'
  };

  constructor(provider: any) {
    this.mediaHandlers = {
      images: {
        bucketName: 'aiclon-images',
        sendFunction: provider.sendMediaUrl
      },
      videos: {
        bucketName: 'aiclon-videos',
        sendFunction: provider.sendMediaUrl
      },
      documents: {
        bucketName: 'aiclon-documents',
        sendFunction: provider.sendMediaUrl
      }
    };
  }

  async processMediaTags(
    text: string,
    tags: string[],
    mediaType: 'images' | 'videos' | 'documents',
    state: Map<string, any>,
    provider: any
  ): Promise<string> {
    try {
      const handler = this.mediaHandlers[mediaType];
      for (const tag of tags) {
        const tagRegex = new RegExp(`%%${tag}%%`, "g");
        const matches = text.match(tagRegex);

        if (matches?.length) {
          const mediaInfo = await appwriteService.searchFiles(
            handler.bucketName,
            tag
          );

          if (mediaInfo !== false) {
            matches.forEach(async () => {
              const mappedMediaType = this.mediaTypeMap[mediaType];
              if (mappedMediaType === 'document') {
                await provider.sendMediaUrl(state.get("phone"), mappedMediaType, mediaInfo.url, '', mediaInfo.name);
              } else {
                await provider.sendMediaUrl(state.get("phone"), mappedMediaType, mediaInfo.url, '');
              }
              const conversationID = await chatwootService.getConversationID(state.get("phone"));
              const response = await fetch(mediaInfo.url);
              const buffer = Buffer.from(await response.arrayBuffer());
              let blob;
              switch (mappedMediaType) {
                case "image":
                  blob = new Blob([buffer], { type: 'image/jpeg' });
                  break;
                case "video":
                  blob = new Blob([buffer], { type: 'video/mp4' });
                  break;
                case "document":
                  blob = new Blob([buffer], { type: 'application/pdf' });
                  break;
                case "audio":
                  blob = new Blob([buffer], { type: 'audio/mp3' });
                  break;
                default:
                  this.logger.error(`Error creating blob for ${mappedMediaType}`);
                  return;
              }
              await chatwootService.sendMedia(
                conversationID,
                '',
                'outgoing',
                blob,
                mappedMediaType as "image" | "video" | "document" | "audio",
                true
              )
            });
          }
        }
        text = text.replace(tagRegex, "");
      }
      return text;
    } catch (error) {
      this.logger.error(`Error processing ${mediaType} tags: ${error?.message}`);
      return text;
    }
  }
}

class RegexService {
  private config: Config;
  private mediaService: MediaService;

  constructor(provider: any) {
    this.config = {
      labelsName: process.env.BOT_LABELS_NAME.split(","),
      priorityName: process.env.BOT_PRIORITY_NAME.split(","),
      imagesTags: process.env.BOT_IMAGES_TAGS.split(","),
      videosTags: process.env.BOT_VIDEOS_TAGS.split(","),
      documentsTags: process.env.BOT_DOCUMENTS_TAGS.split(","),
      notifications: process.env.BOT_NOTIFICATIONS,
      blockUserAutomatic: process.env.BOT_BLOCK_USER_AUTOMATIC,
      followUpActivate: process.env.BOT_FOLLOWUP_ACTIVATE,
      separateUrl: process.env.BOT_SEPARATE_URL || "false",
      lobbyActivate: process.env.LOBBY_PMS_ACTIVATE || "false",
      sheetRegexActivate: process.env.ENABLE_SHEET_DB_REGEX || "false",
      calAppointmentActivated: process.env.CAL_APPOINTMENT_ACTIVATED || "false",
      shopifyActivate: process.env.SHOPIFY_ACTIVATED || "false",
    };

    this.mediaService = new MediaService(provider);
  }

  async handleBlockUser(state: Map<string, any>): Promise<void> {
    if (this.config.blockUserAutomatic === "true") {
      await chatwootService.setAttributes(state.get("phone"), "bot", "Off");
      logger.log(`User ${state.get("phone")} has been blocked automatically.`);
    } else {
      logger.log(
        `Blocking tag detected for user ${state.get(
          "phone"
        )}, but automatic blocking is disabled.`
      );
    }
  }

  async removeLabels(text: string, state: Map<string, any>, provider: any): Promise<string> {
    try {
      const formattedPhoneNumber = removeWhatsAppSuffix(state.get("phone"));
      for (const label of this.config.labelsName) {
        const labelRegex = new RegExp(`%%${label}%%`, "g");
        if (labelRegex.test(text)) {
          if (label === "asesor" && this.config.blockUserAutomatic === "true") {
            await this.handleBlockUser(state);
          }
          const labels = await chatwootService.getLabels(state.get("phone"));
          labels.push(label);
          await chatwootService.setLabels(state.get("phone"), labels);
          if (this.config.notifications === 'true') {
            logger.log(`La conversación con el nombre ${state.get(
              "name"
            )} y el teléfono ${formattedPhoneNumber} ha sido marcada con la etiqueta ${label}`);
          }
          return text.replace(labelRegex, "");
        }
      }
      return text;
    } catch (error) {
      logger.error(`Error en removeLabels: ${error?.message}`);
      return text;
    }
  }

  async removeAgents(text: string, state: Map<string, any>): Promise<string> {
    try {
      // *Buscar números de hasta 3 dígitos entre %%
      const agentNumberRegex = /%%(\d{1,3})%%/g;
      const numberMatches = text.matchAll(agentNumberRegex);

      for (const match of numberMatches) {
        const agentId = match[1]; // *Obtener el número capturado
        await chatwootService.setAgent(state.get("phone"), agentId);
        await chatwootService.setAttributes(state.get("phone"), "bot", "Off");
        text = text.replace(match[0], "");
      }

      return text;
    } catch (error) {
      logger.error(`Error en removeAgents: ${error?.message}`);
      return text;
    }
  }

  async removePriority(text: string, state: Map<string, any>): Promise<string> {
    try {
      const formattedPhoneNumber = removeWhatsAppSuffix(state.get("phone"));
      for (const priority of this.config.priorityName) {
        const priorityRegex = new RegExp(`%%${priority}%%`, "g");
        if (priorityRegex.test(text)) {
          await chatwootService.togglePriority(state.get("phone"), priority);
          if (this.config.notifications === 'true') {
            logger.log(`La conversación con el nombre ${state.get(
              "name"
            )} y el teléfono ${formattedPhoneNumber} ha sido marcada con la prioridad ${priority}`);
          }
          return text.replace(priorityRegex, "Servicio Técnico");
        }
      }
      return text;
    } catch (error) {
      logger.error(`Error en removePriority: ${error?.message}`);
      return text;
    }
  }

  async removeRecuTags(text: string, state: Map<string, any>): Promise<string> {
    try {
      let result = text;
      
      // Función auxiliar para procesar el JSON
      const processJsonData = async (jsonContent: string, originalMatch: string) => {
        try {
          const jsonData = JSON.parse(jsonContent);
          
          // Verificar que tenga el parámetro "etiqueta"
          if (jsonData.etiqueta) {
            logger.log(`Procesando etiqueta JSON: ${jsonData.etiqueta}`);
            
            // Obtener conversationID para construir las URLs
            const conversationID = await chatwootService.getConversationID(state.get("phone"));
            
            // Agregar campos adicionales a datos_etiqueta
            const datosEtiqueta = {
              ...jsonData.datos_etiqueta,
              url_chat: `${host}/app/accounts/${accountId}/inbox/${inboxID}/conversations/${conversationID}`,
              history_chat: `${host}/app/accounts/${accountId}/conversations/${conversationID}/messages?after=0`,
              contacto_whatsapp: state.get("phone")
            };
            
            // Enviar a registerLead con los datos actualizados
            const response = await recuApiClient.registerLead(jsonData.etiqueta, datosEtiqueta) as any;
            console.log(response);

            if (response && response.status === 'success') {
              logger.log(`Etiqueta ${jsonData.etiqueta} registrada exitosamente`);
            } else {
              logger.error(`Error al registrar etiqueta ${jsonData.etiqueta}: ${response.message}`);
            }
          }
          
          // Eliminar el bloque JSON completo del texto
          result = result.replace(originalMatch, "");
          
        } catch (parseError) {
          logger.error(`Error al parsear JSON en removeRecuTags: ${parseError?.message}`);
        }
      };

      // 1. Buscar JSON con backticks de markdown
      const jsonBlockWithBackticksRegex = /```\s*json\s*(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*"etiqueta"\s*:\s*"[^"]*"[^{}]*(?:\{[^{}]*\}[^{}]*)*\})\s*```/g;
      const backticksMatches = result.matchAll(jsonBlockWithBackticksRegex);
      
      for (const match of backticksMatches) {
        const jsonContent = match[1]; // El JSON sin los backticks
        await processJsonData(jsonContent, match[0]);
      }

      // 2. Buscar JSON sin backticks que contenga "etiqueta"
      const jsonWithoutBackticksRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*"etiqueta"\s*:\s*"[^"]*"[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
      const directMatches = result.matchAll(jsonWithoutBackticksRegex);
      
      for (const match of directMatches) {
        const jsonContent = match[0]; // El JSON completo
        await processJsonData(jsonContent, match[0]);
      }
      
      return result;
    } catch (error) {
      logger.error(`Error en removeRecuTags: ${error?.message}`);
      return text;
    }
  }

  async removeImageTags(text: string, state: Map<string, any>, provider: any): Promise<string> {
    return this.mediaService.processMediaTags(text, this.config.imagesTags, 'images', state, provider);
  }

  async removeVideoTags(text: string, state: Map<string, any>, provider: any): Promise<string> {
    return this.mediaService.processMediaTags(text, this.config.videosTags, 'videos', state, provider);
  }

  async removeDocumentTags(text: string, state: Map<string, any>, provider: any): Promise<string> {
    return this.mediaService.processMediaTags(text, this.config.documentsTags, 'documents', state, provider);
  }

  async removeUrlsAndNotify(
    text: string,
    state: Map<string, any>,    
    provider: any
  ): Promise<string> {
    try {
      if (this.config.separateUrl === "false") {
        return text;
      }
      const urlRegex = /https?:\/\/[^\s]+/g;
      const urls = text.match(urlRegex);
      if (urls) {
        for (const url of urls) {
          // Verificar si la URL es una imagen
          const isImage = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
          
          if (isImage) {
            await provider.sendMediaUrl(state.get("phone"), 'image', url);
            const response = await fetch(url);
            const buffer = Buffer.from(await response.arrayBuffer());
            const blob = new Blob([buffer], { type: 'image/jpeg' });
            const conversationID = await chatwootService.getConversationID(state.get("phone"));
            await chatwootService.sendMedia(
              conversationID,
              '',
              'outgoing',
              blob,
              'image',
              true
            )
            logger.log(`Imagen enviada a ${state.get("phone")}`);
          } else {
            await provider.sendText(state.get("phone"), url);
            await chatwootService.sendNotes(state.get("phone"), url, "outgoing", true);
            logger.log(`URL enviada a ${state.get("phone")}`);
          }
        }
        text = text.replace(urlRegex, "");
      }
      return text;
    } catch (error) {
      logger.error(`Error en removeUrlsAndNotify: ${error?.message}`);
      return text;
    }
  }

  private async finalTextValidation(text: string, state: Map<string, any>): Promise<string> {
    try {
      let cleanedText = text;
      const foundPatterns = [];

      // Eliminar cualquier patrón %%...%% residual
      const percentPatternRegex = /%%[^%]*%%/g;
      const percentMatches = cleanedText.match(percentPatternRegex);
      if (percentMatches) {
        foundPatterns.push(...percentMatches);
        cleanedText = cleanedText.replace(percentPatternRegex, '');
      }

      // Eliminar cualquier patrón &&...&& residual  
      const ampersandPatternRegex = /&&[^&]*&&/g;
      const ampersandMatches = cleanedText.match(ampersandPatternRegex);
      if (ampersandMatches) {
        foundPatterns.push(...ampersandMatches);
        cleanedText = cleanedText.replace(ampersandPatternRegex, '');
      }

      // Eliminar patrones de comandos con llaves {}
      const bracePatternRegex = /\{\{[^}]*\}\}/g;
      const braceMatches = cleanedText.match(bracePatternRegex);
      if (braceMatches) {
        foundPatterns.push(...braceMatches);
        cleanedText = cleanedText.replace(bracePatternRegex, '');
      }

      // Eliminar patrones de comandos con corchetes []
      const bracketPatternRegex = /\[\[[^\]]*\]\]/g;
      const bracketMatches = cleanedText.match(bracketPatternRegex);
      if (bracketMatches) {
        foundPatterns.push(...bracketMatches);
        cleanedText = cleanedText.replace(bracketPatternRegex, '');
      }

      // Eliminar patrones de comandos con símbolos especiales
      const specialPatternRegex = /\$\$[^$]*\$\$/g;
      const specialMatches = cleanedText.match(specialPatternRegex);
      if (specialMatches) {
        foundPatterns.push(...specialMatches);
        cleanedText = cleanedText.replace(specialPatternRegex, '');
      }

      // Eliminar cualquier patrón que empiece con @ seguido de caracteres alfanuméricos
      const atPatternRegex = /@[a-zA-Z0-9_]+/g;
      const atMatches = cleanedText.match(atPatternRegex);
      if (atMatches) {
        foundPatterns.push(...atMatches);
        cleanedText = cleanedText.replace(atPatternRegex, '');
      }

      // Eliminar cualquier patrón que empiece con # seguido de caracteres alfanuméricos
      const hashPatternRegex = /#[a-zA-Z0-9_]+/g;
      const hashMatches = cleanedText.match(hashPatternRegex);
      if (hashMatches) {
        foundPatterns.push(...hashMatches);
        cleanedText = cleanedText.replace(hashPatternRegex, '');
      }

      // Log si se encontraron patrones residuales
      if (foundPatterns.length > 0) {
        logger.log(`Patrones residuales eliminados para ${state.get("phone")}: ${foundPatterns.join(', ')}`);
      }

      return cleanedText;
    } catch (error) {
      logger.error(`Error en finalTextValidation: ${error?.message}`);
      return text;
    }
  }


  async processText(text: string, state: Map<string, any>, provider: any): Promise<string> {
    try {

      // *Remove chatwoot tags
      text = await this.removeLabels(text, state, provider);
      text = await this.removeAgents(text, state);
      text = await this.removePriority(text, state);

      // *Remove media tags
      text = await this.removeImageTags(text, state, provider);
      text = await this.removeVideoTags(text, state, provider);
      text = await this.removeDocumentTags(text, state, provider);

      // *Remove urls and notify
      text = await this.removeUrlsAndNotify(text, state, provider);

      // *Remove recu tags
      text = await this.removeRecuTags(text, state);

      // *Final text validation
      text = await this.finalTextValidation(text, state);

      // *Return Text
      return text;
    } catch (error) {
      logger.error(
        `Error in processText: ${error instanceof Error ? error.message : String(error)
        }`
      );
      return text;
    }
  }
}

export default RegexService;
