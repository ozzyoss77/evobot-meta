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
      return await response.json();
    } catch (error) {
      logger.error(`Error fetching from Chatwoot: ${error}`);
      throw error;
    }
  }

  public async createContact(phoneNumber: string, name: string) {
    try {
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
      return data.payload.id;
    } catch (error) {
      logger.error(`Error en createContact:", ${error}`);
      return false;
    }
  }

  public async createConversation(phoneNumber: string, message: string) {
    try {
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
      return data.payload.id;
    } catch (error) {
      logger.error(`Error en createConversation:", ${error}`);
      return false;
    }
  }

  public async getContactID(phoneNumber: string) {
    try {
      const data = await this.fetchFromChatwoot(
        `${this.host}/${this.apiVersion}/accounts/${this.accountId}/contacts/search?q=${phoneNumber}`
      );
      return data.payload[0].id;
    } catch (error) {
      logger.error(`Error en getContactID:", ${error}`);
      return false;
    }
  }

  public async getConversationID(phoneNumber: string) {
    try {
      const contactID = await this.getContactID(phoneNumber);
      const data = await this.fetchFromChatwoot(
        `${this.host}/${this.apiVersion}/accounts/${this.accountId}/contacts/${contactID}/conversations`
      );

      for (const conversation of data.payload) {
        for (const message of conversation.messages) {
          if (message.inbox_id.toString() === this.inboxID!.toString()) {
            return message.conversation_id;
          }
        }
      }

      console.error(`No se encontró ningún mensaje con inbox_id: ${this.inboxID}`);
      return false;
    } catch (error) {
      logger.error(`Error en getConversationID:", ${error}`);
      return false;
    }
  }

  public async getAttributes(phoneNumber: string) {
    try {
      const data = await this.fetchFromChatwoot(
        `${this.host}/${this.apiVersion}/accounts/${this.accountId}/contacts/search?q=${phoneNumber}`
      );
      return data.payload[0].custom_attributes;
    } catch (error) {
      logger.error(`Error en getAttributes:", ${error}`);
      return false;
    }
  }

  public async setAttributes(phoneNumber: string, attributeName: string, attribute: string) {
    try {
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
      return true;
    } catch (error) {
      logger.error(`Error en setAttributes:", ${error}`);
      return false;
    }
  }

  public async getLabels(phoneNumber: string) {
    try {
      const conversationID = await this.getConversationID(phoneNumber);
      const data = await this.fetchFromChatwoot(
        `${this.host}/${this.apiVersion}/accounts/${this.accountId}/conversations/${conversationID}/labels`
      );
      return data.payload;
    } catch (error) {
      logger.error(`Error en getLabels:", ${error}`);
      return ;
    }
  }

  public async setLabels(phoneNumber, labels) {
    try {
      const conversationID = await this.getConversationID(phoneNumber);
      await this.fetchFromChatwoot(
        `${this.host}/${this.apiVersion}/accounts/${this.accountId}/conversations/${conversationID}/labels`,
        "POST",
        {
          labels: Array.isArray(labels) ? labels : [labels]
        }
      );
      return true;
    } catch (error) {
      logger.error(`Error en setLabels:", ${error}`);
      return false;
    }
  }

  public async sendNotes(phoneNumber, content, message_type, is_private) {
    try {
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
      return true;
    } catch (error) {
      logger.error(`Error en sendNotes:", ${error}`);
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

      return true
    } catch (error) {
      logger.error(`Error en sendMedia: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  public async setAgent(phoneNumber: string, agent: string) {
    try {
      const conversationID = await this.getConversationID(phoneNumber);
      await this.fetchFromChatwoot(
        `${this.host}/${this.apiVersion}/accounts/${this.accountId}/conversations/${conversationID}/assignments?assignee_id=${agent}`,
        "POST"
      );
      return true;
    } catch (error) {
      logger.error(`Error en setAgent:", ${error}`);
      return false;
    }
  }

  public async togglePriority(phoneNumber: string, priority: string) {
    try {
      const conversationID = await this.getConversationID(phoneNumber);
      await this.fetchFromChatwoot(
        `${this.host}/${this.apiVersion}/accounts/${this.accountId}/conversations/${conversationID}/toggle_priority`,
        "POST",
        {
          priority: priority,
        }
      );
      return true;
    } catch (error) {
      logger.error(`Error en togglePriority:", ${error}`);
      return false;
    } 
  }
}

const chatwootService = new ChatwootService();
export default chatwootService