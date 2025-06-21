import Logger from "src/Utils/logger";
import chatwootService from "src/Connections/chatwoot.class";
import appwriteService from "src/Connections/appwrite";
import { removeWhatsAppSuffix } from "./formatter";
import { MediaTag, Config } from '../interfaces/types';
import { LobbyService } from "src/Services/lobby-service";
import SheetDBClass from "src/Connections/sheetsDb";
import { CalService } from "src/Services/cal-services";
import { ShopifyService } from "src/Services/shopify-service";
import followUpService from "src/Services/followup-service";
import "dotenv/config";

const host = process.env.BOT_HOST || "http://localhost:3000";
const logger = new Logger();
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
  private logger: Logger;
  private lobbyService: LobbyService;
  private followUpService: any;

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
    this.logger = new Logger();
    this.lobbyService = new LobbyService();
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
            // await provider.sendText(
            //   process.env.BOT_ADMIN_PHONE_NUMBER,
            //   `La conversación con el nombre ${state.get(
            //     "name"
            //   )} y el teléfono ${formattedPhoneNumber} ha sido marcada con la etiqueta ${label}`
            // );
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

  async removePriority(text: string, state: Map<string, any>, provider: any): Promise<string> {
    try {
      const formattedPhoneNumber = removeWhatsAppSuffix(state.get("phone"));
      for (const priority of this.config.priorityName) {
        const priorityRegex = new RegExp(`%%${priority}%%`, "g");
        if (priorityRegex.test(text)) {
          await chatwootService.togglePriority(state.get("phone"), priority);
          if (this.config.notifications === 'true') {
            // await provider.sendText(
            //   process.env.BOT_ADMIN_PHONE_NUMBER,
            //   `La conversación con el nombre ${state.get(
            //     "name"
            //   )} y el teléfono ${formattedPhoneNumber} ha sido marcada con la prioridad ${priority}`
            // );
            logger.log(`La conversación con el nombre ${state.get(
              "name"
            )} y el teléfono ${formattedPhoneNumber} ha sido marcada con la prioridad ${priority}`);
          }
          return text.replace(priorityRegex, "");
        }
      }
      return text;
    } catch (error) {
      logger.error(`Error en removePriority: ${error?.message}`);
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

  async removeSheetCommand(text: string, state: Map<string, any>): Promise<string> {
    const sheetDB = new SheetDBClass(process.env.SHEETDB_API_KEY || '',process.env.SHEETDB_ID || '');
    try {
      const commandRegex = /&&\s*([\s\S]*?)&&/g;
      const matches = Array.from(text.matchAll(commandRegex));
  
      for (const match of matches) {
        const commandBlock = match[1].trim();
        // Split only at the first colon to separate command from JSON data
        const firstColonIndex = commandBlock.indexOf(':');
        if (firstColonIndex === -1) {
          this.logger.error('Command format incorrect, missing colon separator');
          continue;
        }
        
        const command = commandBlock.substring(0, firstColonIndex).trim();
        let jsonStr = commandBlock.substring(firstColonIndex + 1).trim();
        
        this.logger.log(`Command block: ${commandBlock}`);
        this.logger.log(`Command: ${command}`);
        this.logger.log(`JSON string: ${jsonStr}`);
  
        if (!command) {
          this.logger.error('Command not found or empty');
          continue;
        }
  
        try {
          // Convert to valid JSON by handling property names without quotes
          // This approach preserves existing quotes around values
          const propertyNameRegex = /({|,)\s*([a-zA-Z0-9_]+)\s*:/g;
          jsonStr = jsonStr.replace(propertyNameRegex, '$1 "$2":');

          if (!jsonStr.endsWith('}')) {
            jsonStr += '}';
          }
          
          this.logger.log(`Formatted JSON: ${jsonStr}`);
          const params: any = JSON.parse(jsonStr);
          this.logger.log(`Sheet Command detected: ${command}`);
          this.logger.log(`Parameters: ${JSON.stringify(params, null, 2)}`);
  
          switch (command.toLowerCase()) {
            // *send column name and value to sheetDB
            case 'update': {
              this.logger.log('Processing update command...');
              const response = await sheetDB.update(params.filter, params.data);
              this.logger.log(`Successfully updated record: ${response}`);
              break;
            }
            // *send object to sheetDB
            case 'create': {
              this.logger.log('Processing create command...');
              const response = await sheetDB.create(params);
              this.logger.log(`Successfully created record: ${response}`);
              break;
            }
            // *send column name and value to sheetDB
            case 'search': {
              this.logger.log('Processing search command...');
              const response = await sheetDB.query(params.filter);
              this.logger.log(`Successfully searched records: ${response}`);
              break;
            }
            default: {
              this.logger.log(`Unknown command: ${command}`);
            }
          }
        } catch (parseError) {
          this.logger.error(`Error parsing command parameters: ${parseError.message}`);
          this.logger.error(`Attempted to parse: ${jsonStr}`);
        }
      }
  
      // Remove all commands from text
      text = text.replace(/&&\s*[\s\S]*?&&/g, '');
      return text;
    } catch (error) {
      this.logger.error(`Error en removeSheetCommand: ${error?.message}`);
      return text;
    }
  }

  async processText(text: string, state: Map<string, any>, provider: any): Promise<string> {
    try {
      // *Followup Integration
      if (this.config.followUpActivate === "true") {
        text = await followUpService.leadComplete(text, state.get("phone"));
      }

      // *Sheet Regex Integration	
      if (this.config.sheetRegexActivate === "true") {
        text = await this.removeSheetCommand(text, state);
      }

      // *Remove chatwoot tags
      text = await this.removeLabels(text, state, provider);
      text = await this.removeAgents(text, state);
      text = await this.removePriority(text, state, provider);

      // *Remove media tags
      text = await this.removeImageTags(text, state, provider);
      text = await this.removeVideoTags(text, state, provider);
      text = await this.removeDocumentTags(text, state, provider);

      // *Remove urls and notify
      text = await this.removeUrlsAndNotify(text, state, provider);

      // *Lobby Integration
      if (this.config.lobbyActivate === "true") {
        const response = await this.lobbyService.processTag(text, state);
        text = response.text;
        text = await this.removeLabels(text, state, provider);
        text = await this.removeAgents(text, state);
        text = await this.removePriority(text, state, provider);
        text = await this.removeImageTags(text, state, provider);
        text = await this.removeVideoTags(text, state, provider);
        text = await this.removeDocumentTags(text, state, provider);
        text = await this.removeUrlsAndNotify(text, state, provider);
      }

      // *Shopify Integration
      if (this.config.shopifyActivate === "true") {
        const shopifyService = new ShopifyService();
        const response = await shopifyService.processTag(text, state);
        text = response.text;
        text = await this.removeLabels(text, state, provider);
        text = await this.removeAgents(text, state);
        text = await this.removePriority(text, state, provider);
        text = await this.removeImageTags(text, state, provider);
        text = await this.removeVideoTags(text, state, provider);
        text = await this.removeDocumentTags(text, state, provider);
        text = await this.removeUrlsAndNotify(text, state, provider);
      }

       // *Cal Appointment Integration
       if (this.config.calAppointmentActivated === "true") {
        const calService = new CalService();
        const textResponse = await calService.processCommand(text, state);
        text = await this.removeLabels(text, state, provider);
        text = await this.removeAgents(text, state);
        text = await this.removePriority(text, state, provider);
        text = await this.removeImageTags(text, state, provider);
        text = await this.removeVideoTags(text, state, provider);
        text = await this.removeDocumentTags(text, state, provider);
        text = await this.removeUrlsAndNotify(text, state, provider);
        text = textResponse;
      }

      // Mejora en el manejo del lead_complete
      if (
        this.config.followUpActivate === "true" &&
        text.includes("%%lead_complete%%")
      ) {
        try {
          await this.followUpService.removePhoneNumber(state.get("phone"));
          text = text.replace("%%lead_complete%%", "");
          this.logger.log(
            `Lead complete for ${state.get("phone")}. Removed from followup database.`
          );
        } catch (followupError) {
          this.logger.error(`Error removing phone number from followup: ${followupError?.message}`);
        }
      }

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
