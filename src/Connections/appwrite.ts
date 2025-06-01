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

  }

  //****************** Database ******************

  async searchOneDocument(databaseId, collectionId, method, attribute, value) {
    try {
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
        this.logger.log("No document found");
        return false;
      }
      return response.data.documents[0];
    } catch (error) {
      this.logger.error(`Error searching one document: ${error}`);
      return false;
    }
  }

  async getDocument(databaseId, collectionId, documentId) {
    try {
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
      return true;
    } catch (error) {
      this.logger.error(`Error getting document: ${error}`);
      return false;
    }
  }

  async createDocument(databaseId, collectionId, data) {
    try {
      await axios.post(
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
      return true;
    } catch (error) {
      this.logger.error(`Error creating document: ${error}`);
      return false;
    }
  }

  async tokenUsageMetrics(databaseId, collectionId, phone, tokens) {
    try {
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
      return true;
    } catch (error) {
      this.logger.error(`Error creating document: ${error}`);
      return false;
    }
  }

  async getTokensByWorkspace(period) {
    try {
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
      return response.data.documents;
    } catch (error) {
      this.logger.error(`Error getting tokens by workspace: ${error}`);
      return false;
    }
  }

  //****************** Storage ******************
  async getFile(bucketId, fileId) {
    try {
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
      return true;
    } catch (error) {
      this.logger.error(`Error getting file: ${error}`);
      return false;
    }
  }

  async createFile(bucketId, fileName, buffer, mimeType) {
    try {
      // const data = new File([buffer], fileName, { type: `${mimeType}` });
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
      return url;
    } catch (error) {
      this.logger.error(`Error creating file: ${error}`);
      return false;
    }
  }

  async deleteFile(bucketId, fileName) {
    try {
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
      return true;
    } catch (error) {
      this.logger.error(`Error deleting file: ${error}`);
      return false;
    }
  }

  async searchFiles(bucketId, search) {
    try {
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
      const url = `${this.baseUrl}/storage/buckets/${bucketId}/files/${fileId}/view?project=${this.project}&project=${this.project}&mode=admin`;
      return url;
    } catch (error) {
      this.logger.error(`Error searching files: ${error}`);
      return false;
    }
  }

  async getFileId(bucketId, search) {
    try {
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
      return response.data.files[0].$id;
    } catch (error) {
      this.logger.error(`Error searching files: ${error}`);
      return false;
    }
  }
}

// Example usage
const appwriteService = new AppwriteService();

// Test a method
// (async () => {
//   const result = await appwriteService.getDocument(
//     "your_collection_id",
//     "your_document_id"
//   );
//   console.log("Get document result:", result);
// })();

export default appwriteService;
