import axios from "axios";
import Logger from "src/Utils/logger";
import FormData from "form-data";
import "dotenv/config";

const workspace = process.env.AI_COLLECTION_NAME;

function getMonthAndYear() {
  const date = new Date();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${month}-${year}`;
}

class AppwriteService {
  private logger: Logger;
  private baseUrl: string;
  private project: string;
  private apikey: string;
  private appwrite: any;

  constructor() {
    this.logger = new Logger();
    this.baseUrl = process.env.APPWRITE_API_ENDPOINT;
    this.project = process.env.APPWRITE_PROJECT_ID;
    this.apikey = process.env.APPWRITE_API_KEY;

    this.logger.log(`🚀 Appwrite: Initializing service with project ${this.project}`);
    this.logger.log(`🌐 Appwrite: API endpoint configured: ${this.baseUrl}`);
  }

  //****************** Database ******************

  async searchOneDocument(databaseId, collectionId, method, attribute, value) {
    try {
      this.logger.log(`🔍 Appwrite: Searching document in ${collectionId} where ${attribute}=${value}`);
      
      const response = await axios.get(
        `${this.baseUrl}/databases/${databaseId}/collections/${collectionId}/documents?queries[0]={"method":"${method}", "attribute":"${attribute}","values":["${value}"]}`,
        {
          headers: {
            "X-Appwrite-Project": this.project,
            "X-Appwrite-Key": this.apikey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        }
      );
      if (response.data.documents.length === 0) {
        this.logger.log(`📭 Appwrite: No document found in ${collectionId} for ${attribute}=${value}`);
        return false;
      }
      this.logger.log(`✅ Appwrite: Document found in ${collectionId} for ${attribute}=${value}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Appwrite: Error searching document in ${collectionId} - ${error}`);
      return false;
    }
  }

  async getDocument(databaseId, collectionId, documentId) {
    try {
      this.logger.log(`📋 Appwrite: Getting document ${documentId} from ${collectionId}`);
      
      await axios.get(
        `${this.baseUrl}/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`,
        {
          headers: {
            "X-Appwrite-Project": this.project,
            "X-Appwrite-Key": this.apikey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        }
      );
      this.logger.log(`✅ Appwrite: Document ${documentId} retrieved successfully from ${collectionId}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Appwrite: Error getting document ${documentId} from ${collectionId} - ${error}`);
      return false;
    }
  }

  async createDocument(databaseId, collectionId, data) {
    try {
      this.logger.log(`📝 Appwrite: Creating new document in ${collectionId}`);
      
      await axios.post(
        `${this.baseUrl}/databases/${databaseId}/collections/${collectionId}/documents`,
        {
          data: data
        },
        {
          headers: {
            "X-Appwrite-Project": this.project,
            "X-Appwrite-Key": this.apikey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        }
      );
      this.logger.log(`✅ Appwrite: Document created successfully in ${collectionId}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Appwrite: Error creating document in ${collectionId} - ${error}`);
      return false;
    }
  }

  async tokenUsageMetrics(databaseId, collectionId, phone, tokens) {
    try {
      this.logger.log(`📊 Appwrite: Saving token usage metrics for ${phone} - ${tokens} tokens`);
      
      await axios.post(
        `${this.baseUrl}/databases/${databaseId}/collections/${collectionId}/documents`,
        {
          documentId: "unique()",
          data: {
            workspace,
            phone,
            tokens,
            bill_period: getMonthAndYear(),
          }
        },
        {
          headers: {
            "X-Appwrite-Project": this.project,
            "X-Appwrite-Key": this.apikey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        }
      );
      this.logger.log(`✅ Appwrite: Token metrics saved for ${phone} (${tokens} tokens) - Period: ${getMonthAndYear()}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Appwrite: Error saving token metrics for ${phone} - ${error}`);
      return false;
    }
  }

  async getTokensByWorkspace(period) {
    try {
      this.logger.log(`📈 Appwrite: Getting token usage for period ${period}`);
      
      const response = await axios.get(
        `${this.baseUrl}/databases/aiclon-db-metrics/collections/token-usage-metrics/documents?queries[0]={"method":"equal", "attribute":"bill_period","values":["${period}"]}`,
        {
          headers: {
            "X-Appwrite-Project": this.project,
            "X-Appwrite-Key": this.apikey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        }
      );
      
      const documentCount = response.data.documents.length;
      this.logger.log(`✅ Appwrite: Retrieved ${documentCount} token usage records for period ${period}`);
      return response.data.documents;
    } catch (error) {
      this.logger.error(`❌ Appwrite: Error getting tokens for period ${period} - ${error}`);
      return false;
    }
  }

  //****************** Storage ******************
  async getFile(bucketId, fileId) {
    try {
      this.logger.log(`📁 Appwrite: Getting file ${fileId} from bucket ${bucketId}`);
      
      await axios.get(`${this.baseUrl}/storage/buckets/${bucketId}/files/${fileId}`,
        {
          headers: {
            "X-Appwrite-Project": this.project,
            "X-Appwrite-Key": this.apikey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        }
      );
      this.logger.log(`✅ Appwrite: File ${fileId} retrieved successfully from bucket ${bucketId}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Appwrite: Error getting file ${fileId} from bucket ${bucketId} - ${error}`);
      return false;
    }
  }

  async createFile(bucketId, fileName, buffer, mimeType) {
    try {
      this.logger.log(`📤 Appwrite: Uploading file ${fileName} to bucket ${bucketId} (${mimeType})`);
      
      const formData = new FormData();
      formData.append("fileId", "unique()");
      formData.append("file", buffer, { filename: fileName, contentType: mimeType });
      const response = await axios.post(
        `${this.baseUrl}/storage/buckets/${bucketId}/files`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            "X-Appwrite-Project": this.project,
            "X-Appwrite-Key": this.apikey,
          },
        }
      );
      const fileId = response.data.$id;
      const url = `${this.baseUrl}/storage/buckets/${bucketId}/files/${fileId}/view?project=${this.project}&project=${this.project}&mode=admin`;
      
      this.logger.log(`✅ Appwrite: File ${fileName} uploaded successfully with ID: ${fileId}`);
      this.logger.log(`🔗 Appwrite: File URL generated: ${url}`);
      return url;
    } catch (error) {
      this.logger.error(`❌ Appwrite: Error uploading file ${fileName} to bucket ${bucketId} - ${error}`);
      return false;
    }
  }

  async deleteFile(bucketId, fileName) {
    try {
      this.logger.log(`🗑️ Appwrite: Deleting file ${fileName} from bucket ${bucketId}`);
      
      const fileId = await this.getFileId(bucketId, fileName);
      await axios.delete(`${this.baseUrl}/storage/buckets/${bucketId}/files/${fileId}`,
        {
          headers: {
            "X-Appwrite-Project": this.project,
            "X-Appwrite-Key": this.apikey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        }
      );
      this.logger.log(`✅ Appwrite: File ${fileName} deleted successfully from bucket ${bucketId}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Appwrite: Error deleting file ${fileName} from bucket ${bucketId} - ${error}`);
      return false;
    }
  }

  async searchFiles(bucketId, search) {
    try {
      this.logger.log(`🔍 Appwrite: Searching files in bucket ${bucketId} with query: ${search}`);
      
      const response = await axios.get(
        `${this.baseUrl}/storage/buckets/${bucketId}/files?search=${search}`,
        {
          headers: {
            "X-Appwrite-Project": this.project,
            "X-Appwrite-Key": this.apikey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        }
      );
      const fileId = response.data.files[0].$id;
      const name = response.data.files[0].name;
      const url = `${this.baseUrl}/storage/buckets/${bucketId}/files/${fileId}/view?project=${this.project}&project=${this.project}&mode=admin`;
      
      this.logger.log(`✅ Appwrite: File found - ${name} (ID: ${fileId})`);
      return { url, name };
    } catch (error) {
      this.logger.error(`❌ Appwrite: Error searching files in bucket ${bucketId} with query ${search} - ${error}`);
      return false;
    }
  }

  async getFileId(bucketId, search) {
    try {
      this.logger.log(`🔍 Appwrite: Getting file ID for ${search} in bucket ${bucketId}`);
      
      const response = await axios.get(
        `${this.baseUrl}/storage/buckets/${bucketId}/files?search=${search}`,
        {
          headers: {
            "X-Appwrite-Project": this.project,
            "X-Appwrite-Key": this.apikey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        }
      );
      
      const fileId = response.data.files[0].$id;
      this.logger.log(`✅ Appwrite: File ID found: ${fileId} for ${search}`);
      return fileId;
    } catch (error) {
      this.logger.error(`❌ Appwrite: Error getting file ID for ${search} in bucket ${bucketId} - ${error}`);
      return false;
    }
  }

  async saveEventShopify(databaseId, collectionId, data) {
    try {
      this.logger.log(`🛍️ Appwrite: Saving Shopify event to ${collectionId}`);
      
      const response = await axios.post(
        `${this.baseUrl}/databases/${databaseId}/collections/${collectionId}/documents`,
        {
          documentId: "unique()",
          data: data
        },
        {
          headers: {
            "X-Appwrite-Project": this.project,
            "X-Appwrite-Key": this.apikey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        }
      );
      
      this.logger.log(`✅ Appwrite: Shopify event saved successfully with ID: ${response.data.$id}`);
      return response.data;
    } catch (error) {
      this.logger.error(`❌ Appwrite: Error saving Shopify event to ${collectionId} - ${error}`);
      return false;
    }
  }

  async getEventShopify(databaseId, collectionId, phone) {
    try {
      this.logger.log(`🛍️ Appwrite: Getting Shopify events for phone ${phone} from ${collectionId}`);
      
      const response = await axios.get(
        `${this.baseUrl}/databases/${databaseId}/collections/${collectionId}/documents?queries[0]={"method":"equal", "attribute":"phone","values":["${phone}"]}&queries[1]={"method":"orderDesc","attribute":"$createdAt"}`,
        {
          headers: {
            "X-Appwrite-Project": this.project,
            "X-Appwrite-Key": this.apikey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        }
      );

      // Retornar el primer documento si existe, o null si no hay documentos
      const event = response.data.documents[0];
      if (event) {
        this.logger.log(`✅ Appwrite: Shopify event found for ${phone} - Event ID: ${event.$id}`);
      } else {
        this.logger.log(`📭 Appwrite: No Shopify events found for ${phone}`);
      }
      return event;
    } catch (error) {
      this.logger.error(`❌ Appwrite: Error getting Shopify events for ${phone} from ${collectionId} - ${error}`);
      return false;
    }
  }

  async updateEventShopify(databaseId, collectionId, documentId, data) {
    try {
      this.logger.log(`🛍️ Appwrite: Updating Shopify event ${documentId} in ${collectionId}`);
      
      const response = await axios.patch(
        `${this.baseUrl}/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`,
        {
          data: data
        },
        {
          headers: {
            "X-Appwrite-Project": this.project,
            "X-Appwrite-Key": this.apikey,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        }
      );
      
      this.logger.log(`✅ Appwrite: Shopify event ${documentId} updated successfully`);
      return response.data;
    } catch (error) {
      this.logger.error(`❌ Appwrite: Error updating Shopify event ${documentId} in ${collectionId} - ${error}`);
      return false;
    }
  }
}

// Example usage
const appwriteService = new AppwriteService();

// Log de inicialización del servicio global
const logger = new Logger();
logger.log(`✅ Appwrite: Service instance created and ready for use`);

export default appwriteService;