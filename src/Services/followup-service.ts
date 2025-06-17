import { redisClient } from "src/Connections/redis";
import moment from "moment-timezone";
import { newAIResponse } from "src/AIApi/api-llm";
import Logger from "src/Utils/logger";
import appwriteService from "src/Connections/appwrite";
import { checkBlockFollowUp } from "src/Utils/checkblock";

const logger = new Logger();

interface FollowUpRecord {
  timestamp: string;
  phoneNumber: string;
  host: string;
  intent: number;
  interval: Record<string, number>;
}

class WhatsAppFollowUp {
  private readonly timezone: string;
  private static readonly REDIS_PREFIX = "followup:";
  private interval_first: number;
  private interval_second: number;
  private template_first: string;
  private template_second: string;
  private template_language: string;
  private template_first_body: string;
  private template_second_body: string;

  constructor() {
    this.timezone = process.env.BOT_TIMEZONE || "UTC";
    this.interval_first = parseInt(process.env.BOT_FOLLOWUP_INTERVAL_FIRST || "0");
    this.template_first = process.env.BOT_FOLLOWUP_TEMPLATE_FIRST || "";
    this.interval_second = parseInt(process.env.BOT_FOLLOWUP_INTERVAL_SECOND || "0");
    this.template_second = process.env.BOT_FOLLOWUP_TEMPLATE_SECOND || "";
    this.template_language = process.env.BOT_FOLLOWUP_TEMPLATE_LANGUAGE || "es_Mx";
    this.template_first_body = process.env.BOT_FOLLOWUP_TEMPLATE_FIRST_BODY || "";
    this.template_second_body = process.env.BOT_FOLLOWUP_TEMPLATE_SECOND_BODY || "";
  }

  private getRedisKey(phoneNumber: string): string {
    return `${WhatsAppFollowUp.REDIS_PREFIX}${phoneNumber}`;
  }

  async registerIncompleteConversation(
    phoneNumber: string,
    host: string
  ): Promise<void> {
    if (!phoneNumber) {
      logger.error("Invalid phone number provided for registration");
      return;
    }

    const key = this.getRedisKey(phoneNumber);
    const now = moment().tz(this.timezone);
    const record: FollowUpRecord = {
      timestamp: now.format(),
      phoneNumber,
      host,
      intent: 0,
      interval: {
        "first": this.interval_first,
        "second": this.interval_second,
      }
    };

    try {
      await redisClient.set(key, JSON.stringify(record));
      logger.log(`Registered incomplete conversation for ${phoneNumber}`);
    } catch (error) {
      logger.error(
        `Failed to register incomplete conversation for ${phoneNumber}: ${error}`
      );
    }
  }

  async removePhoneNumber(phoneNumber: string): Promise<boolean> {
    if (!phoneNumber) {
      logger.error("Invalid phone number provided for removal");
      return false;
    }

    const key = this.getRedisKey(phoneNumber);
    try {
      await redisClient.del(key);
      logger.log(`Removed phone number ${phoneNumber} from followup DB`);
      return true;
    } catch (error) {
      logger.error(`Failed to remove phone number ${phoneNumber}: ${error}`);
      return false;
    }
  }

  async updateIntent(data: {
    phoneNumber: string;
    intent: number;
    provider: any;
  }): Promise<void> {
    const { phoneNumber, intent, provider } = data;
    
    if (!phoneNumber) {
      logger.error("Invalid phone number provided for intent update");
      return;
    }

    const key = this.getRedisKey(phoneNumber);

    try {
      const existingValue = await redisClient.get(key);
      if (!existingValue) {
        logger.error(`No record found for ${phoneNumber}`);
        return;
      }

      const record: FollowUpRecord = JSON.parse(existingValue);

      // Si el intento está en 0, actualizar a 1 automáticamente
      if (record.intent === 0) {
        record.intent = 1;
      } else {
        record.intent = intent;
      }

      if (record.intent > 2) {
        logger.error(`Invalid intent level (${record.intent}) for ${phoneNumber}`);
        return;
      }

      await redisClient.set(key, JSON.stringify(record));
      logger.log(`Updated intent for ${phoneNumber} to ${record.intent}`);

      await this.handleIntent(phoneNumber, record.intent, provider);
    } catch (error) {
      logger.error(`Failed to update intent for ${phoneNumber}: ${error}`);
    }
  }

  private async handleIntent(
    phoneNumber: string,
    intent: number,
    provider: any
  ): Promise<void> {
    const intentMap = {
      1: "%%firstIntent%%",
      2: "%%secondIntent%%",
    };

    if (intent === 1) {
      logger.log(`Trying first intent for ${phoneNumber}`);
      await provider.sendTemplate(
        phoneNumber,
        this.template_first,
        this.template_language
      )
      const aiResponsePromise = this.sendAIResponse(phoneNumber, `${intentMap[intent]} - ${this.template_first_body}`, provider);
    } else if (intent === 2) {
      // El segundo intento es el último, eliminamos el registro
      logger.log(`Trying final (second) intent for ${phoneNumber}`);
      await provider.sendTemplate(
        phoneNumber,
        this.template_second,
        this.template_language
      )
      const aiResponsePromise = this.sendAIResponse(phoneNumber, `${intentMap[intent]} - ${this.template_second_body}`, provider);
      const removePhonePromise = this.removePhoneNumber(phoneNumber);
      
      try {
        await Promise.all([aiResponsePromise, removePhonePromise]);
        logger.log(`Completed final intent processing for ${phoneNumber}`);
      } catch (error) {
        logger.error(`Error in final intent processing for ${phoneNumber}: ${error}`);
      }
    }
  }

  private async sendAIResponse(
    phoneNumber: string,
    prompt: string,
    provider: any
  ): Promise<void> {
    if (!phoneNumber || !prompt) {
      logger.error("Invalid phone number or prompt for AI response");
      return;
    }

    try {
      const isBlocked = await checkBlockFollowUp(phoneNumber);
      if (isBlocked) {
        logger.log(`Blocked user ${phoneNumber} not sending AI response`);
        return;
      }

      const { textResponse, totalTokenCount } = await newAIResponse(
        phoneNumber,
        prompt
      );

      if (!textResponse) {
        logger.error(`Empty AI response received for ${phoneNumber}`);
        return;
      }

      await appwriteService.tokenUsageMetrics(
        "aiclon-db-metrics",
        "token-usage-metrics",
        phoneNumber,
        totalTokenCount
      );
      
      // await provider.sendText(phoneNumber, textResponse);
      logger.log(`Successfully sent AI response to ${phoneNumber}`);
    } catch (error) {
      logger.error(`Failed to send AI response to ${phoneNumber}: ${error}`);
    }
  }

  // Función para probar la inserción manual de datos en Redis
  async testInsertToRedis(
    phoneNumber: string,
    host: string = "test-host",
    intent: number = 0
  ): Promise<boolean> {
    if (!phoneNumber) {
      logger.error("Invalid phone number for test insertion");
      return false;
    }

    try {
      const key = this.getRedisKey(phoneNumber);
      const now = moment().tz(this.timezone);
      const record: FollowUpRecord = {
        timestamp: now.format(),
        phoneNumber,
        host,
        intent,
        interval: {
          "first": this.interval_first,
        }
      };

      await redisClient.set(key, JSON.stringify(record));
      
      // Verificar que se guardó correctamente
      const savedData = await redisClient.get(key);
      if (!savedData) {
        logger.error(`Failed to verify test data insertion for ${phoneNumber}`);
        return false;
      }

      const parsedData: FollowUpRecord = JSON.parse(savedData);
      logger.log(`Test data inserted successfully for ${phoneNumber}:`);
      logger.log(JSON.stringify(parsedData, null, 2));
      
      return true;
    } catch (error) {
      logger.error(`Test insertion failed for ${phoneNumber}: ${error}`);
      return false;
    }
  }

  // Función para obtener el registro actual de un número
  async getFollowUpRecord(phoneNumber: string, provider: any): Promise<FollowUpRecord | boolean> {
    if (!phoneNumber) {
      logger.error("Invalid phone number for record retrieval");
      return false;
    }

    try {
      const key = this.getRedisKey(phoneNumber);
      const data = await redisClient.get(key);
      
      if (!data) {
        logger.log(`No followup record found for ${phoneNumber}`);
        return false;
      }
      
      return JSON.parse(data) as FollowUpRecord;
    } catch (error) {
      logger.error(`Failed to retrieve record for ${phoneNumber}: ${error}`);
      return false;
    }
  }

  async leadComplete(text: string, phoneNumber: string): Promise<string> {
    if (!text || !phoneNumber) {
      logger.error("Invalid text or phone number provided for lead completion");
      return text;
    }

    const leadCompleteTag = "%%lead_complete%%";
    
    if (text.includes(leadCompleteTag)) {
      try {
        // Remover el número de la base de datos
        await this.removePhoneNumber(phoneNumber);
        logger.log(`Lead completed for ${phoneNumber}, removed from followup DB`);
        
        // Remover la etiqueta del texto
        const cleanText = text.replace(leadCompleteTag, "").trim();
        return cleanText;
      } catch (error) {
        logger.error(`Failed to process lead completion for ${phoneNumber}: ${error}`);
        return text;
      }
    }

    return text;
  }
}

const followUpService = new WhatsAppFollowUp();

export default followUpService;