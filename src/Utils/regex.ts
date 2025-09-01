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
      this.logger.log(`🎯 MediaService: Processing ${mediaType} tags for ${state.get("phone")}`);
      this.logger.log(`📋 MediaService: Available tags for ${mediaType}: [${tags.join(', ')}]`);
      
      const handler = this.mediaHandlers[mediaType];
      let processedTags = 0;
      
      for (const tag of tags) {
        const tagRegex = new RegExp(`%%${tag}%%`, "g");
        const matches = text.match(tagRegex);

        if (matches?.length) {
          this.logger.log(`✅ MediaService: Found ${matches.length} instances of tag %%${tag}%% in text`);
          
          const mediaInfo = await appwriteService.searchFiles(
            handler.bucketName,
            tag
          );

          if (mediaInfo !== false) {
            this.logger.log(`📁 MediaService: Media found in bucket '${handler.bucketName}' for tag '${tag}'`);
            this.logger.log(`🔗 MediaService: Media URL: ${mediaInfo.url}`);
            
            matches.forEach(async () => {
              const mappedMediaType = this.mediaTypeMap[mediaType];
              
              try {
                if (mappedMediaType === 'document') {
                  this.logger.log(`📄 MediaService: Sending document to ${state.get("phone")} - File: ${mediaInfo.name}`);
                  await provider.sendMediaUrl(state.get("phone"), mappedMediaType, mediaInfo.url, '', mediaInfo.name);
                } else {
                  this.logger.log(`📎 MediaService: Sending ${mappedMediaType} to ${state.get("phone")}`);
                  await provider.sendMediaUrl(state.get("phone"), mappedMediaType, mediaInfo.url, '');
                }
                
                const conversationID = await chatwootService.getConversationID(state.get("phone"));
                this.logger.log(`💬 MediaService: Sending to Chatwoot conversation ID: ${conversationID}`);
                
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
                    this.logger.error(`❌ MediaService: Unknown media type for blob creation: ${mappedMediaType}`);
                    return;
                }
                
                await chatwootService.sendMedia(
                  conversationID,
                  '',
                  'outgoing',
                  blob,
                  mappedMediaType as "image" | "video" | "document" | "audio",
                  true
                );
                
                this.logger.log(`✅ MediaService: Successfully sent ${mappedMediaType} to WhatsApp and Chatwoot for ${state.get("phone")}`);
                processedTags++;
              } catch (sendError) {
                this.logger.error(`❌ MediaService: Failed to send ${mappedMediaType} for tag ${tag}: ${sendError?.message}`);
              }
            });
          } else {
            this.logger.error(`❌ MediaService: No media found in bucket '${handler.bucketName}' for tag '${tag}'`);
          }
        } else {
          this.logger.log(`🔍 MediaService: Tag %%${tag}%% not found in text for ${mediaType}`);
        }
        text = text.replace(tagRegex, "");
      }
      
      this.logger.log(`📊 MediaService: Processed ${processedTags} ${mediaType} tags for ${state.get("phone")}`);
      return text;
    } catch (error) {
      this.logger.error(`❌ MediaService: Error processing ${mediaType} tags for ${state.get("phone")}: ${error?.message}`);
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
    try {
      const phone = state.get("phone");
      const name = state.get("name") || "Usuario sin nombre";
      
      if (this.config.blockUserAutomatic === "true") {
        this.logger.log(`🚫 RegexService: Initiating automatic block for user ${phone} (${name})`);
        await chatwootService.setAttributes(phone, "bot", "Off");
        this.logger.log(`✅ RegexService: User ${phone} (${name}) has been blocked automatically - Bot attribute set to 'Off'`);
      } else {
        this.logger.log(`⚠️ RegexService: Blocking tag detected for user ${phone} (${name}), but automatic blocking is disabled in config`);
      }
    } catch (error) {
      this.logger.error(`❌ RegexService: Error in handleBlockUser for ${state.get("phone")}: ${error?.message}`);
    }
  }

  async removeLabels(text: string, state: Map<string, any>, provider: any): Promise<string> {
    try {
      const phone = state.get("phone");
      const name = state.get("name") || "Usuario sin nombre";
      const formattedPhoneNumber = removeWhatsAppSuffix(phone);
      
      this.logger.log(`🏷️ RegexService: Processing labels for ${phone} (${name})`);
      this.logger.log(`📋 RegexService: Available labels: [${this.config.labelsName.join(', ')}]`);
      
      let labelsProcessed = 0;
      
      for (const label of this.config.labelsName) {
        const labelRegex = new RegExp(`%%${label}%%`, "g");
        if (labelRegex.test(text)) {
          this.logger.log(`✅ RegexService: Found label tag %%${label}%% for ${phone}`);
          
          // Manejo especial para el label "asesor"
          if (label === "asesor" && this.config.blockUserAutomatic === "true") {
            this.logger.log(`⚠️ RegexService: 'asesor' label detected - triggering block process for ${phone}`);
            await this.handleBlockUser(state);
          }
          
          const labels = await chatwootService.getLabels(phone);
          const originalLabelsCount = labels.length;
          
          labels.push(label);
          await chatwootService.setLabels(phone, labels);
          
          this.logger.log(`🏷️ RegexService: Label '${label}' added to conversation. Total labels: ${originalLabelsCount} → ${labels.length}`);
          
          if (this.config.notifications === 'true') {
            this.logger.log(`📢 RegexService: NOTIFICATION - Conversation ${name} (${formattedPhoneNumber}) tagged with label '${label}'`);
          }
          
          text = text.replace(labelRegex, "");
          labelsProcessed++;
        }
      }
      
      if (labelsProcessed === 0) {
        this.logger.log(`🔍 RegexService: No label tags found in text for ${phone}`);
      } else {
        this.logger.log(`📊 RegexService: Processed ${labelsProcessed} label(s) for ${phone}`);
      }
      
      return text;
    } catch (error) {
      this.logger.error(`❌ RegexService: Error in removeLabels for ${state.get("phone")}: ${error?.message}`);
      return text;
    }
  }

  async removeAgents(text: string, state: Map<string, any>): Promise<string> {
    try {
      const phone = state.get("phone");
      const name = state.get("name") || "Usuario sin nombre";
      
      this.logger.log(`👤 RegexService: Processing agent assignments for ${phone} (${name})`);
      
      // Buscar números de hasta 3 dígitos entre %%
      const agentNumberRegex = /%%(\d{1,3})%%/g;
      const numberMatches = text.matchAll(agentNumberRegex);
      let agentsAssigned = 0;

      for (const match of numberMatches) {
        const agentId = match[1]; // Obtener el número capturado
        
        this.logger.log(`👤 RegexService: Found agent assignment tag %%${agentId}%% for ${phone}`);
        this.logger.log(`🔄 RegexService: Assigning agent ${agentId} to conversation ${phone}`);
        
        await chatwootService.setAgent(phone, agentId);
        await chatwootService.setAttributes(phone, "bot", "Off");
        
        this.logger.log(`✅ RegexService: Agent ${agentId} assigned successfully to ${phone} - Bot turned off`);
        
        text = text.replace(match[0], "");
        agentsAssigned++;
      }
      
      if (agentsAssigned === 0) {
        this.logger.log(`🔍 RegexService: No agent assignment tags found for ${phone}`);
      } else {
        this.logger.log(`📊 RegexService: Assigned ${agentsAssigned} agent(s) to ${phone}`);
      }

      return text;
    } catch (error) {
      this.logger.error(`❌ RegexService: Error in removeAgents for ${state.get("phone")}: ${error?.message}`);
      return text;
    }
  }

  async removePriority(text: string, state: Map<string, any>, provider: any): Promise<string> {
    try {
      const phone = state.get("phone");
      const name = state.get("name") || "Usuario sin nombre";
      const formattedPhoneNumber = removeWhatsAppSuffix(phone);
      
      this.logger.log(`⭐ RegexService: Processing priorities for ${phone} (${name})`);
      this.logger.log(`📋 RegexService: Available priorities: [${this.config.priorityName.join(', ')}]`);
      
      let prioritiesProcessed = 0;
      
      for (const priority of this.config.priorityName) {
        const priorityRegex = new RegExp(`%%${priority}%%`, "g");
        if (priorityRegex.test(text)) {
          this.logger.log(`✅ RegexService: Found priority tag %%${priority}%% for ${phone}`);
          this.logger.log(`⭐ RegexService: Setting priority '${priority}' for conversation ${phone}`);
          
          await chatwootService.togglePriority(phone, priority);
          
          this.logger.log(`✅ RegexService: Priority '${priority}' set successfully for ${phone}`);
          
          if (this.config.notifications === 'true') {
            this.logger.log(`📢 RegexService: NOTIFICATION - Conversation ${name} (${formattedPhoneNumber}) marked with priority '${priority}'`);
          }
          
          text = text.replace(priorityRegex, "");
          prioritiesProcessed++;
        }
      }
      
      if (prioritiesProcessed === 0) {
        this.logger.log(`🔍 RegexService: No priority tags found in text for ${phone}`);
      } else {
        this.logger.log(`📊 RegexService: Processed ${prioritiesProcessed} priority tag(s) for ${phone}`);
      }
      
      return text;
    } catch (error) {
      this.logger.error(`❌ RegexService: Error in removePriority for ${state.get("phone")}: ${error?.message}`);
      return text;
    }
  }

  async removeImageTags(text: string, state: Map<string, any>, provider: any): Promise<string> {
    this.logger.log(`🖼️ RegexService: Processing image tags for ${state.get("phone")}`);
    return this.mediaService.processMediaTags(text, this.config.imagesTags, 'images', state, provider);
  }

  async removeVideoTags(text: string, state: Map<string, any>, provider: any): Promise<string> {
    this.logger.log(`🎥 RegexService: Processing video tags for ${state.get("phone")}`);
    return this.mediaService.processMediaTags(text, this.config.videosTags, 'videos', state, provider);
  }

  async removeDocumentTags(text: string, state: Map<string, any>, provider: any): Promise<string> {
    this.logger.log(`📄 RegexService: Processing document tags for ${state.get("phone")}`);
    return this.mediaService.processMediaTags(text, this.config.documentsTags, 'documents', state, provider);
  }

  async removeSheetCommand(text: string, state: Map<string, any>): Promise<string> {
    const sheetDB = new SheetDBClass(process.env.SHEETDB_API_KEY || '',process.env.SHEETDB_ID || '');
    try {
      const phone = state.get("phone");
      const name = state.get("name") || "Usuario sin nombre";
      
      this.logger.log(`📊 RegexService: Processing SheetDB commands for ${phone} (${name})`);
      
      const commandRegex = /&&\s*([\s\S]*?)&&/g;
      const matches = Array.from(text.matchAll(commandRegex));
      
      if (matches.length === 0) {
        this.logger.log(`🔍 RegexService: No SheetDB commands found for ${phone}`);
        return text;
      }
      
      this.logger.log(`📋 RegexService: Found ${matches.length} SheetDB command(s) for ${phone}`);
  
      for (const match of matches) {
        const commandBlock = match[1].trim();
        this.logger.log(`🔧 RegexService: Processing command block: ${commandBlock}`);
        
        // Split only at the first colon to separate command from JSON data
        const firstColonIndex = commandBlock.indexOf(':');
        if (firstColonIndex === -1) {
          this.logger.error(`❌ RegexService: Command format incorrect for ${phone} - missing colon separator`);
          continue;
        }
        
        const command = commandBlock.substring(0, firstColonIndex).trim();
        let jsonStr = commandBlock.substring(firstColonIndex + 1).trim();
        
        this.logger.log(`🎯 RegexService: Command: '${command}' for ${phone}`);
        this.logger.log(`📝 RegexService: JSON string: '${jsonStr}' for ${phone}`);
  
        if (!command) {
          this.logger.error(`❌ RegexService: Command not found or empty for ${phone}`);
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
          
          this.logger.log(`✨ RegexService: Formatted JSON: ${jsonStr}`);
          const params: any = JSON.parse(jsonStr);
          this.logger.log(`🎯 RegexService: Sheet Command detected: ${command} for ${phone}`);
          this.logger.log(`📋 RegexService: Parameters: ${JSON.stringify(params, null, 2)}`);
  
          switch (command.toLowerCase()) {
            // send column name and value to sheetDB
            case 'update': {
              this.logger.log(`🔄 RegexService: Processing UPDATE command for ${phone}...`);
              const response = await sheetDB.update(params.filter, params.data);
              this.logger.log(`✅ RegexService: UPDATE successful for ${phone}: ${response}`);
              break;
            }
            // send object to sheetDB
            case 'create': {
              this.logger.log(`➕ RegexService: Processing CREATE command for ${phone}...`);
              const response = await sheetDB.create(params);
              this.logger.log(`✅ RegexService: CREATE successful for ${phone}: ${response}`);
              break;
            }
            // send column name and value to sheetDB
            case 'search': {
              this.logger.log(`🔍 RegexService: Processing SEARCH command for ${phone}...`);
              const response = await sheetDB.query(params.filter);
              this.logger.log(`✅ RegexService: SEARCH successful for ${phone}: ${response}`);
              break;
            }
            default: {
              this.logger.error(`❌ RegexService: Unknown SheetDB command '${command}' for ${phone}`);
            }
          }
        } catch (parseError) {
          this.logger.error(`❌ RegexService: Error parsing command parameters for ${phone}: ${parseError.message}`);
          this.logger.error(`❌ RegexService: Attempted to parse: ${jsonStr}`);
        }
      }
  
      // Remove all commands from text
      const originalLength = text.length;
      text = text.replace(/&&\s*[\s\S]*?&&/g, '');
      const newLength = text.length;
      
      this.logger.log(`🧹 RegexService: Removed ${matches.length} SheetDB command(s) from text for ${phone} (${originalLength} → ${newLength} chars)`);
      
      return text;
    } catch (error) {
      this.logger.error(`❌ RegexService: Error in removeSheetCommand for ${state.get("phone")}: ${error?.message}`);
      return text;
    }
  }

  private async finalTextValidation(text: string, state: Map<string, any>): Promise<string> {
    try {
      const phone = state.get("phone");
      let cleanedText = text;
      const foundPatterns = [];
      const originalLength = text.length;

      this.logger.log(`🧹 RegexService: Starting final text validation for ${phone} (${originalLength} chars)`);

      // Eliminar cualquier patrón %%...%% residual
      const percentPatternRegex = /%%[^%]*%%/g;
      const percentMatches = cleanedText.match(percentPatternRegex);
      if (percentMatches) {
        foundPatterns.push(...percentMatches);
        cleanedText = cleanedText.replace(percentPatternRegex, '');
        this.logger.log(`🔧 RegexService: Removed ${percentMatches.length} percent pattern(s) for ${phone}: [${percentMatches.join(', ')}]`);
      }

      // Eliminar cualquier patrón &&...&& residual  
      const ampersandPatternRegex = /&&[^&]*&&/g;
      const ampersandMatches = cleanedText.match(ampersandPatternRegex);
      if (ampersandMatches) {
        foundPatterns.push(...ampersandMatches);
        cleanedText = cleanedText.replace(ampersandPatternRegex, '');
        this.logger.log(`🔧 RegexService: Removed ${ampersandMatches.length} ampersand pattern(s) for ${phone}: [${ampersandMatches.join(', ')}]`);
      }

      // Eliminar patrones de comandos con llaves {}
      const bracePatternRegex = /\{\{[^}]*\}\}/g;
      const braceMatches = cleanedText.match(bracePatternRegex);
      if (braceMatches) {
        foundPatterns.push(...braceMatches);
        cleanedText = cleanedText.replace(bracePatternRegex, '');
        this.logger.log(`🔧 RegexService: Removed ${braceMatches.length} brace pattern(s) for ${phone}: [${braceMatches.join(', ')}]`);
      }

      // Eliminar patrones de comandos con corchetes []
      const bracketPatternRegex = /\[\[[^\]]*\]\]/g;
      const bracketMatches = cleanedText.match(bracketPatternRegex);
      if (bracketMatches) {
        foundPatterns.push(...bracketMatches);
        cleanedText = cleanedText.replace(bracketPatternRegex, '');
        this.logger.log(`🔧 RegexService: Removed ${bracketMatches.length} bracket pattern(s) for ${phone}: [${bracketMatches.join(', ')}]`);
      }

      // Eliminar patrones de comandos con símbolos especiales
      const specialPatternRegex = /\$\$[^$]*\$\$/g;
      const specialMatches = cleanedText.match(specialPatternRegex);
      if (specialMatches) {
        foundPatterns.push(...specialMatches);
        cleanedText = cleanedText.replace(specialPatternRegex, '');
        this.logger.log(`🔧 RegexService: Removed ${specialMatches.length} special pattern(s) for ${phone}: [${specialMatches.join(', ')}]`);
      }

      // Eliminar cualquier patrón que empiece con # seguido de caracteres alfanuméricos
      const hashPatternRegex = /#[a-zA-Z0-9_]+/g;
      const hashMatches = cleanedText.match(hashPatternRegex);
      if (hashMatches) {
        foundPatterns.push(...hashMatches);
        cleanedText = cleanedText.replace(hashPatternRegex, '');
        this.logger.log(`🔧 RegexService: Removed ${hashMatches.length} hash pattern(s) for ${phone}: [${hashMatches.join(', ')}]`);
      }

      // Reducir múltiples saltos de línea consecutivos a solo uno
      const multipleLineBreaksRegex = /\n{2,}/g;
      const lineBreakMatches = cleanedText.match(multipleLineBreaksRegex);
      if (lineBreakMatches) {
        cleanedText = cleanedText.replace(multipleLineBreaksRegex, '\n\n');
        this.logger.log(`📝 RegexService: Reduced ${lineBreakMatches.length} multiple line break sequence(s) for ${phone}`);
      }

      const finalLength = cleanedText.length;
      
      // Log final summary
      if (foundPatterns.length > 0) {
        this.logger.log(`🗑️ RegexService: Cleaned ${foundPatterns.length} residual pattern(s) for ${phone}: [${foundPatterns.join(', ')}]`);
      }
      
      this.logger.log(`✅ RegexService: Final text validation complete for ${phone}: ${originalLength} → ${finalLength} chars`);

      return cleanedText;
    } catch (error) {
      this.logger.error(`❌ RegexService: Error in finalTextValidation for ${state.get("phone")}: ${error?.message}`);
      return text;
    }
  }

  async processText(text: string, state: Map<string, any>, provider: any): Promise<string> {
    try {
      const phone = state.get("phone");
      const name = state.get("name") || "Usuario sin nombre";
      const originalTextLength = text.length;
      
      this.logger.log(`🚀 RegexService: Starting text processing for ${phone} (${name})`);
      this.logger.log(`📝 RegexService: Original text length: ${originalTextLength} chars`);
      this.logger.log(`📋 RegexService: Active integrations - FollowUp: ${this.config.followUpActivate}, Sheet: ${this.config.sheetRegexActivate}, Lobby: ${this.config.lobbyActivate}, Shopify: ${this.config.shopifyActivate}, Cal: ${this.config.calAppointmentActivated}`);

      // Followup Integration
      if (this.config.followUpActivate === "true") {
        this.logger.log(`🎯 RegexService: Processing FollowUp integration for ${phone}`);
        text = await followUpService.leadComplete(text, phone);
        this.logger.log(`✅ RegexService: FollowUp integration completed for ${phone}`);
      }

      // Sheet Regex Integration	
      if (this.config.sheetRegexActivate === "true") {
        this.logger.log(`📊 RegexService: Processing SheetDB integration for ${phone}`);
        text = await this.removeSheetCommand(text, state);
        this.logger.log(`✅ RegexService: SheetDB integration completed for ${phone}`);
      }

      // Lobby Integration
      if (this.config.lobbyActivate === "true") {
        this.logger.log(`🏢 RegexService: Processing Lobby integration for ${phone}`);
        const response = await this.lobbyService.processTag(text, state);
        text = response.text;
        this.logger.log(`✅ RegexService: Lobby integration completed for ${phone}`);
      }

      // Shopify Integration
      if (this.config.shopifyActivate === "true") {
        this.logger.log(`🛒 RegexService: Processing Shopify integration for ${phone}`);
        const shopifyService = new ShopifyService();
        const response = await shopifyService.processTag(text, state);
        text = response.text;
        this.logger.log(`✅ RegexService: Shopify integration completed for ${phone}`);
      }

      // Cal Appointment Integration
       if (this.config.calAppointmentActivated === "true") {
        this.logger.log(`📅 RegexService: Processing Cal.com integration for ${phone}`);
        const calService = new CalService();
        const textResponse = await calService.processCommand(text, state);
        text = textResponse;
        this.logger.log(`✅ RegexService: Cal.com integration completed for ${phone}`);
      }

      this.logger.log(`🔧 RegexService: Starting Chatwoot tags processing for ${phone}`);
      
      // Remove chatwoot tags
      text = await this.removeLabels(text, state, provider);
      text = await this.removeAgents(text, state);
      text = await this.removePriority(text, state, provider);

      this.logger.log(`🎨 RegexService: Starting media tags processing for ${phone}`);
      
      // Remove media tags
      text = await this.removeImageTags(text, state, provider);
      text = await this.removeVideoTags(text, state, provider);
      text = await this.removeDocumentTags(text, state, provider);

      // Mejora en el manejo del lead_complete
      if (
        this.config.followUpActivate === "true" &&
        text.includes("%%lead_complete%%")
      ) {
        try {
          this.logger.log(`🎯 RegexService: Processing lead_complete tag for ${phone}`);
          await this.followUpService.removePhoneNumber(phone);
          text = text.replace("%%lead_complete%%", "");
          this.logger.log(`✅ RegexService: Lead completed for ${phone} - Removed from followup database`);
        } catch (followupError) {
          this.logger.error(`❌ RegexService: Error removing ${phone} from followup: ${followupError?.message}`);
        }
      }

      this.logger.log(`🧹 RegexService: Starting final text validation for ${phone}`);
      
      // Ultima validacion de texto
      text = await this.finalTextValidation(text, state);

      const finalTextLength = text.length;
      this.logger.log(`🎉 RegexService: Text processing completed for ${phone} - ${originalTextLength} → ${finalTextLength} chars`);
      
      // Return Text
      return text;
    } catch (error) {
      this.logger.error(`❌ RegexService: Error in processText for ${state.get("phone")}: ${error instanceof Error ? error.message : String(error)}`);
      return text;
    }
  }
}

export default RegexService;
