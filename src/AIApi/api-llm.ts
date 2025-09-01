import axios, { AxiosInstance } from "axios";
import Logger from "src/Utils/logger";
import { fileTypeFromBuffer } from 'file-type';
import { removeWhatsAppSuffix } from "src/Utils/formatter";
import "dotenv/config";

const logger = new Logger();

const host = process.env.AI_HOST;
const apikey = process.env.AI_API_KEY;
const workspace = process.env.AI_COLLECTION_NAME;

// Crear instancia de axios con interceptors
const aiClient: AxiosInstance = axios.create({
  baseURL: host,
  timeout: 120000, // 2 minutos para respuestas AI
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${apikey}`,
  }
});

// Interceptors para logs detallados
aiClient.interceptors.request.use(
  (config) => {
    const endpoint = config.url?.split('/').pop();
    logger.log(`🤖 AI API Request: ${config.method?.toUpperCase()} ${endpoint}`);
    
    if (config.data?.message) {
      const messageLength = config.data.message.length;
      logger.log(`📝 AI Message length: ${messageLength} characters`);
    }
    
    if (config.data?.attachments?.length > 0) {
      logger.log(`📎 AI Attachments: ${config.data.attachments.length} files`);
    }
    
    return config;
  },
  (error) => {
    logger.error(`❌ AI API Request Error: ${error}`);
    return Promise.reject(error);
  }
);

aiClient.interceptors.response.use(
  (response) => {
    const endpoint = response.config.url?.split('/').pop();
    logger.log(`✅ AI API Response: ${response.status} ${endpoint}`);
    
    if (response.data?.textResponse) {
      const responseLength = response.data.textResponse.length;
      logger.log(`💬 AI Response length: ${responseLength} characters`);
    }
    
    if (response.data?.sources) {
      const tokenCount = response.data.sources.reduce((sum: number, source: any) => {
        return sum + (source.token_count_estimate || 0);
      }, 0);
      logger.log(`🎯 AI Token count: ${tokenCount} tokens`);
    }
    
    return response;
  },
  (error) => {
    logger.error(`❌ AI API Response Error: ${error.response?.status} ${error.response?.data}`);
    return Promise.reject(error);
  }
);

// Validar configuración al inicializar
function validateAIConfiguration() {
  const missingConfigs = [];
  
  if (!host) missingConfigs.push('AI_HOST');
  if (!apikey) missingConfigs.push('AI_API_KEY');
  if (!workspace) missingConfigs.push('AI_COLLECTION_NAME');
  
  if (missingConfigs.length > 0) {
    const errorMsg = `❌ AI API: Missing required configuration: ${missingConfigs.join(', ')}`;
    logger.error(errorMsg);
    throw new Error(`AI API configuration missing: ${missingConfigs.join(', ')}`);
  } else {
    logger.log(`✅ AI API: Configuration validated - Workspace: ${workspace}`);
  }
}

// Validar configuración al cargar el módulo
validateAIConfiguration();

export async function newThread(name: string, slug: string) {
  try {
    const formattedPhoneNumber = removeWhatsAppSuffix(slug);
    logger.log(`🧵 AI: Creating new thread for ${formattedPhoneNumber} with name: ${name}`);
    
    const response = await aiClient.post(
      `/api/v1/workspace/${workspace}/thread/new`,
      {
        name,
        slug: `${formattedPhoneNumber}-${workspace}`,
      }
    );
    
    if (response?.data?.thread === null) {
      logger.log(`📋 AI: Thread already exists for ${formattedPhoneNumber}`);
      return;
    }
    
    logger.log(`✅ AI: New thread created successfully for ${formattedPhoneNumber}`);
    return response.data.thread;
  } catch (error) {
    logger.error(`❌ AI: Error creating new thread for ${slug}: ${error.response?.data}`);
    throw error;
  }
}

export async function newAIResponse(slug: string, message: string, currentAttempt = 1) {
  const maxRetries = 3;
  const formattedPhoneNumber = removeWhatsAppSuffix(slug);
  
  try {
    logger.log(`🤖 AI: Generating response for ${formattedPhoneNumber} (attempt ${currentAttempt}/${maxRetries})`);
    
    if (!message || typeof message !== 'string') {
      logger.error(`❌ AI: Invalid message for ${formattedPhoneNumber}`);
      return { textResponse: false, totalTokenCount: false };
    }
    
    const response = await aiClient.post(
      `/api/v1/workspace/${workspace}/thread/${formattedPhoneNumber}-${workspace}/chat`,
      {
        message,
        mode: "chat",
      }
    );
    
    const textResponse = response.data.textResponse;
    const sources = response.data.sources;

    const totalTokenCount = sources.reduce((sum: number, source: any) => {
      return sum + (source.token_count_estimate || 0);
    }, 0);
    
    logger.log(`✅ AI: Response generated successfully for ${formattedPhoneNumber} (${totalTokenCount} tokens)`);
    return { textResponse, totalTokenCount };
  } catch (error) {
    if (currentAttempt < maxRetries) {
      const waitTime = 1000 * currentAttempt;
      logger.warn(`⚠️ AI: Attempt ${currentAttempt}/${maxRetries} failed for ${formattedPhoneNumber}, retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return newAIResponse(slug, message, currentAttempt + 1);
    }
    
    logger.error(`❌ AI: Failed to get response for ${formattedPhoneNumber} after ${maxRetries} attempts: ${JSON.stringify(error.response?.data)}`);
    return { textResponse: false, totalTokenCount: false };
  }
}

export async function newImageResponse(slug: string, message: string, imageBuffer: Buffer) {
  try {
    const formattedPhoneNumber = removeWhatsAppSuffix(slug);
    logger.log(`🖼️ AI: Processing image response for ${formattedPhoneNumber}`);
    
    // Validar que el buffer no esté vacío
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
      logger.error(`❌ AI: Invalid image buffer for ${formattedPhoneNumber}`);
      return { textResponse: false, totalTokenCount: false };
    }

    const bufferSize = (imageBuffer.length / 1024).toFixed(2);
    logger.log(`📸 AI: Image size: ${bufferSize} KB for ${formattedPhoneNumber}`);

    // Determinar el tipo de archivo y MIME
    const fileType = await fileTypeFromBuffer(new Uint8Array(imageBuffer));

    if (!fileType) {
      logger.error(`❌ AI: Cannot determine file type for ${formattedPhoneNumber}`);
      return { textResponse: false, totalTokenCount: false };
    }

    const { mime, ext } = fileType;
    logger.log(`📄 AI: Image type detected: ${mime} (.${ext}) for ${formattedPhoneNumber}`);
    
    const base64Prefix = `data:${mime};base64,`;
    const imageB64 = imageBuffer.toString('base64');
    const contentString = `${base64Prefix}${imageB64}`;

    // Realizar la solicitud
    const response = await aiClient.post(
      `/api/v1/workspace/${workspace}/thread/${formattedPhoneNumber}-${workspace}/chat`,
      {
        message,
        mode: "chat",
        attachments: [
          {
            name: `image.${ext}`,
            mime: mime,
            contentString: contentString,
          },
        ],
      }
    );

    const textResponse = response.data.textResponse;
    const sources = response.data.sources;

    // Calcular el total de tokens
    const totalTokenCount = sources.reduce((sum: number, source: any) => {
      return sum + (source.token_count_estimate || 1);
    }, 0);

    logger.log(`✅ AI: Image response generated successfully for ${formattedPhoneNumber} (${totalTokenCount} tokens)`);
    return { textResponse, totalTokenCount };
  } catch (error) {
    logger.error(`❌ AI: Error processing image for ${slug}: ${error.response?.data}`);
    throw error;
  }
}

export async function updateThread(name: string, slug: string) {
  try {
    const formattedPhoneNumber = removeWhatsAppSuffix(slug);
    logger.log(`🔄 AI: Updating thread for ${formattedPhoneNumber} with name: ${name}`);
    
    const response = await aiClient.post(
      `/api/v1/workspace/${workspace}/thread/${formattedPhoneNumber}-${workspace}/update`,
      {
        thread: {
          name,
          slug: `${formattedPhoneNumber}-${workspace}`,
        },
      }
    );
    
    logger.log(`✅ AI: Thread updated successfully for ${formattedPhoneNumber}`);
    return response.data;
  } catch (error) {
    logger.error(`❌ AI: Error updating thread for ${slug}: ${error.response?.data}`);
    return "error";
  }
}

export async function deleteThread(slug: string) {
  try {
    const formattedPhoneNumber = removeWhatsAppSuffix(slug);
    logger.log(`🗑️ AI: Deleting thread for ${formattedPhoneNumber}`);
    
    const response = await aiClient.delete(
      `/api/v1/workspace/${workspace}/thread/${formattedPhoneNumber}-${workspace}`
    );
    
    logger.log(`✅ AI: Thread ${formattedPhoneNumber} deleted successfully`);
    return response.data;
  } catch (error) {
    logger.error(`❌ AI: Error deleting thread for ${slug}: ${error.response?.data}`);
    return "error";
  }
}

export async function getThreads(slug: string) {
  try {
    const formattedPhoneNumber = removeWhatsAppSuffix(slug);
    logger.log(`📋 AI: Getting threads for ${formattedPhoneNumber}`);
    
    const response = await aiClient.get(
      `/api/v1/workspace/${workspace}/thread/${formattedPhoneNumber}-${workspace}/chats`
    );
    
    const chatCount = response.data?.history?.length || 0;
    logger.log(`✅ AI: Retrieved ${chatCount} chat messages for ${formattedPhoneNumber}`);
    return response.data;
  } catch (error) {
    logger.error(`❌ AI: Error getting threads for ${slug}: ${error.response?.data}`);
    return "error";
  }
}

export async function checkThread(slug: string) {
  try {
    const formattedPhoneNumber = removeWhatsAppSuffix(slug);
    logger.log(`🔍 AI: Checking if thread exists for ${formattedPhoneNumber}`);
    
    await aiClient.get(
      `/api/v1/workspace/${workspace}/thread/${formattedPhoneNumber}-${workspace}/chats`
    );
    
    logger.log(`✅ AI: Thread exists for ${formattedPhoneNumber}`);
    return true;
  } catch (error) {
    const formattedPhoneNumber = removeWhatsAppSuffix(slug);
    logger.log(`📭 AI: Thread ${formattedPhoneNumber} does not exist or error checking: ${error.response?.data}`);
    return false;
  }
}