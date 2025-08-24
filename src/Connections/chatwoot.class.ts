import Logger from "src/Utils/logger";
import crypto from "crypto"
import "dotenv/config";

const logger = new Logger();

function generateRandomHexName(length = 12): string {
  const numBytes = Math.ceil(length / 2)
  const randomBytes = crypto.randomBytes(numBytes)
  return randomBytes.toString("hex").slice(0, length)
}

class ChatwootService {
  private host: string | undefined;
  private apiVersion: string | undefined;
  private apiAccessToken: string | undefined;
  private inboxID: string | undefined;
  private accountId: string | undefined;

  constructor() {
    this.host = process.env.CHATWOOT_HOST;
    this.apiVersion = process.env.CHATWOOT_API_VERSION;
    this.apiAccessToken = process.env.CHATWOOT_API_ACCESS_TOKEN;
    this.inboxID = process.env.CHATWOOT_INBOX_ID;
    this.accountId = process.env.CHATWOOT_ACCOUNT_ID;
  }

  private async fetchFromChatwoot(url: string, method: string = "GET", body: any = null) {
    try {
      logger.log(`💬 Chatwoot API Request: ${method.toUpperCase()} ${url}`);
      
      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          api_access_token: this.apiAccessToken!,
        },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const data = await response.json();
      
      logger.log(`✅ Chatwoot API Response: ${response.status} ${url}`);
      return data;
    } catch (error) {
      logger.error(`❌ Chatwoot API Error: ${method.toUpperCase()} ${url} - ${error}`);
      throw error;
    }
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T | false> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        logger.warn(`Intent ${attempt}/${maxRetries} failed: ${error}`);
        
        if (attempt < maxRetries) {
          // Espera exponencial: 1s, 2s, 4s
          const waitTime = delayMs * Math.pow(2, attempt - 1);
          logger.log(`Waiting ${waitTime}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    return false;
  }

  public async createContact(phoneNumber: string, name: string) {
    try {
      logger.log(`👤 Chatwoot: Creating contact for ${phoneNumber} (${name})`);
      
      const data = await this.fetchFromChatwoot(
        `${this.host}/${this.apiVersion}/accounts/${this.accountId}/contacts`,
        "POST",
        {
          name: name,
          phone: phoneNumber,
          identifier: phoneNumber,
          inbox_id: this.inboxID,
          source_id: phoneNumber,
        }
      );
      
      logger.log(`✅ Chatwoot: Contact created successfully for ${phoneNumber}`);
      return data
    } catch (error) {
      logger.error(`❌ Chatwoot Error creating contact for ${phoneNumber}: ${error}`);
      return false;
    }
  }

  public async createConversation(phoneNumber: string, message: string) {
    try {
      logger.log(`💬 Chatwoot: Creating conversation for ${phoneNumber}`);
      
      const contactID = await this.getContactID(phoneNumber);
      const data = await this.fetchFromChatwoot(
        `${this.host}/${this.apiVersion}/accounts/${this.accountId}/conversations`,
        "POST",
        {
          inbox_id: this.inboxID,
          contact_id: contactID,
          source_id: phoneNumber,
          message: {
            content: message,
            message_type: "outgoing",
            private: true,
          }
        }
      );
      
      logger.log(`✅ Chatwoot: Conversation created successfully for ${phoneNumber}`);
      return data
    } catch (error) {
      logger.error(`❌ Chatwoot Error creating conversation for ${phoneNumber}: ${error}`);
      return false;
    }
  }

  public async getContactID(phoneNumber: string) {
    try {
      logger.log(`🔍 Chatwoot: Fetching contact ID for ${phoneNumber}`);
      
      const data = await this.fetchFromChatwoot(
        `${this.host}/${this.apiVersion}/accounts/${this.accountId}/contacts/search?q=${phoneNumber}`
      );
      
      logger.log(`✅ Chatwoot: Contact ID found for ${phoneNumber}`);
      return data.payload[0].id;
    } catch (error) {
      logger.error(`❌ Chatwoot Error fetching contact ID for ${phoneNumber}: ${error}`);
      return false;
    }
  }

  public async getConversationID(phoneNumber: string) {
    try {
      logger.log(`🔍 Chatwoot: Fetching conversation ID for ${phoneNumber}`);
      
      const contactID = await this.getContactID(phoneNumber);
      const data = await this.fetchFromChatwoot(
        `${this.host}/${this.apiVersion}/accounts/${this.accountId}/contacts/${contactID}/conversations`
      );

      for (const conversation of data.payload) {
        for (const message of conversation.messages) {
          if (message.inbox_id.toString() === this.inboxID!.toString()) {
            logger.log(`✅ Chatwoot: Conversation ID found for ${phoneNumber}`);
            return message.conversation_id;
          }
        }
      }

      logger.error(`❌ Chatwoot: No conversation found with inbox_id: ${this.inboxID} for ${phoneNumber}`);
      return false;
    } catch (error) {
      logger.error(`❌ Chatwoot Error fetching conversation ID for ${phoneNumber}: ${error}`);
      return false;
    }
  }

  public async getAttributes(phoneNumber: string) {
    try {
      logger.log(`📋 Chatwoot: Fetching attributes for ${phoneNumber}`);
      
      return await this.retryOperation(async () => {
        const data = await this.fetchFromChatwoot(
          `${this.host}/${this.apiVersion}/accounts/${this.accountId}/contacts/search?q=${phoneNumber}`
        );
        
        logger.log(`✅ Chatwoot: Attributes fetched successfully for ${phoneNumber}`);
        return data.payload[0].custom_attributes;
      });
    } catch (error) {
      logger.error(`❌ Chatwoot Error fetching attributes for ${phoneNumber} after all retries: ${error}`);
      return false;
    }
  }

  public async setAttributes(phoneNumber: string, attributeName: string, attribute: string) {
    try {
      logger.log(`📝 Chatwoot: Setting attribute ${attributeName} for ${phoneNumber}`);
      
      const contactID = await this.getContactID(phoneNumber);
      await this.fetchFromChatwoot(
        `${this.host}/${this.apiVersion}/accounts/${this.accountId}/contacts/${contactID}`,
        "PUT",
        {
          custom_attributes: {
            [attributeName]: attribute,
          },
        }
      );
      
      logger.log(`✅ Chatwoot: Attribute ${attributeName} set successfully for ${phoneNumber}`);
      return true;
    } catch (error) {
      logger.error(`❌ Chatwoot Error setting attribute ${attributeName} for ${phoneNumber}: ${error}`);
      return false;
    }
  }

  public async getLabels(phoneNumber: string) {
    try {
      logger.log(`🏷️ Chatwoot: Fetching labels for ${phoneNumber}`);
      
      const conversationID = await this.getConversationID(phoneNumber);
      const data = await this.fetchFromChatwoot(
        `${this.host}/${this.apiVersion}/accounts/${this.accountId}/conversations/${conversationID}/labels`
      );
      
      logger.log(`✅ Chatwoot: Labels fetched successfully for ${phoneNumber}`);
      return data.payload;
    } catch (error) {
      logger.error(`❌ Chatwoot Error fetching labels for ${phoneNumber}: ${error}`);
      return ;
    }
  }

  public async setLabels(phoneNumber, labels) {
    try {
      logger.log(`🏷️ Chatwoot: Setting labels for ${phoneNumber}: ${Array.isArray(labels) ? labels.join(', ') : labels}`);
      
      const conversationID = await this.getConversationID(phoneNumber);
      await this.fetchFromChatwoot(
        `${this.host}/${this.apiVersion}/accounts/${this.accountId}/conversations/${conversationID}/labels`,
        "POST",
        {
          labels: Array.isArray(labels) ? labels : [labels]
        }
      );
      
      logger.log(`✅ Chatwoot: Labels set successfully for ${phoneNumber}`);
      return true;
    } catch (error) {
      logger.error(`❌ Chatwoot Error setting labels for ${phoneNumber}: ${error}`);
      return false;
    }
  }

  public async sendNotes(phoneNumber, content, message_type, is_private) {
    try {
      logger.log(`📝 Chatwoot: Sending ${message_type} note to ${phoneNumber} (private: ${is_private})`);
      
      const conversationID = await this.getConversationID(phoneNumber);
      await this.fetchFromChatwoot(
        `${this.host}/${this.apiVersion}/accounts/${this.accountId}/conversations/${conversationID}/messages`,
        "POST",
        {
          content: content,
          message_type: message_type,
          private: is_private,
        }
      );
      
      logger.log(`✅ Chatwoot: Note sent successfully to ${phoneNumber}`);
      return true;
    } catch (error) {
      logger.error(`❌ Chatwoot Error sending note to ${phoneNumber}: ${error}`);
      return false;
    }
  }

  public async sendMedia(
    conversationID: string,
    content: string,
    message_type: string,
    blob: any,
    fileType: "image" | "video" | "document" | "audio",
    is_private: boolean,
  ): Promise<boolean> {
    try {
      logger.log(`📎 Chatwoot: Sending ${fileType} media to conversation ${conversationID} (private: ${is_private})`);
      
      const formData = new FormData()
      formData.set("content", content)
      formData.set("message_type", message_type)
      formData.set("file_type", fileType)
      formData.set("private", String(is_private))

      const fileExtensions: Record<string, string> = {
        image: "png",
        audio: "mp3",
        video: "mp4",
        document: "pdf",
      }

      const fileExtension = fileExtensions[fileType] || "bin"
      const fileName = `${generateRandomHexName()}.${fileExtension}`

      formData.set("attachments[]", blob, fileName)

      logger.log(`💬 Chatwoot API Request: POST media upload to conversation ${conversationID}`);

      const response = await fetch(
        `${this.host}/${this.apiVersion}/accounts/${this.accountId}/conversations/${conversationID}/messages`,
        {
          method: "POST",
          headers: {
            api_access_token: this.apiAccessToken,
          },
          body: formData,
        },
      )

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }

      logger.log(`✅ Chatwoot: ${fileType} media sent successfully to conversation ${conversationID}`);
      return true
    } catch (error) {
      logger.error(`❌ Chatwoot Error sending ${fileType} media to conversation ${conversationID}: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  public async setAgent(phoneNumber: string, agent: string) {
    try {
      logger.log(`👤 Chatwoot: Assigning agent ${agent} to conversation for ${phoneNumber}`);
      
      const conversationID = await this.getConversationID(phoneNumber);
      await this.fetchFromChatwoot(
        `${this.host}/${this.apiVersion}/accounts/${this.accountId}/conversations/${conversationID}/assignments?assignee_id=${agent}`,
        "POST"
      );
      
      logger.log(`✅ Chatwoot: Agent ${agent} assigned successfully to ${phoneNumber}`);
      return true;
    } catch (error) {
      logger.error(`❌ Chatwoot Error assigning agent ${agent} to ${phoneNumber}: ${error}`);
      return false;
    }
  }

  public async togglePriority(phoneNumber: string, priority: string) {
    try {
      logger.log(`🚨 Chatwoot: Setting priority ${priority} for conversation with ${phoneNumber}`);
      
      const conversationID = await this.getConversationID(phoneNumber);
      await this.fetchFromChatwoot(
        `${this.host}/${this.apiVersion}/accounts/${this.accountId}/conversations/${conversationID}/toggle_priority`,
        "POST",
        {
          priority: priority,
        }
      );
      
      logger.log(`✅ Chatwoot: Priority ${priority} set successfully for ${phoneNumber}`);
      return true;
    } catch (error) {
      logger.error(`❌ Chatwoot Error setting priority ${priority} for ${phoneNumber}: ${error}`);
      return false;
    } 
  }
}

const chatwootService = new ChatwootService();
export default chatwootService