import axios, { AxiosInstance } from "axios";
import Logger from "src/Utils/logger";
import { fileTypeFromBuffer } from 'file-type';
import { removeWhatsAppSuffix } from "src/Utils/formatter";
import "dotenv/config";

const logger = new Logger();

const host = process.env.AI_HOST;
const apikey = process.env.AI_API_KEY;
const workspace = process.env.AI_COLLECTION_NAME;


function validateAIConfiguration() {
  const missingConfigs: string[] = [];

  if (!host) missingConfigs.push("AI_HOST");
  if (!apikey) missingConfigs.push("AI_API_KEY");
  if (!workspace) missingConfigs.push("AI_COLLECTION_NAME");

  if (missingConfigs.length > 0) {
    const message = `AI API missing required configuration: ${missingConfigs.join(", ")}`;
    logger.error(message);
    throw new Error(message);
  }

  logger.log(`AI API configuration validated for workspace ${workspace}`);
}

validateAIConfiguration();

const aiClient: AxiosInstance = axios.create({
  baseURL: host,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${apikey}`,
  },
});

aiClient.interceptors.request.use(
  (config) => {
    const endpoint = config.url || "unknown";
    logger.log(`AI API request ${config.method?.toUpperCase() || "GET"} ${endpoint}`);

    const payload: any = config.data;
    if (payload?.question && typeof payload.question === "string") {
      logger.log(`AI API question length ${payload.question.length}`);
    }

    if (Array.isArray(payload?.uploads)) {
      logger.log(`AI API uploads count ${payload.uploads.length}`);
    }

    return config;
  },
  (error) => {
    logger.error(`AI API request error ${error}`);
    return Promise.reject(error);
  }
);

aiClient.interceptors.response.use(
  (response) => {
    const endpoint = response.config.url || "unknown";
    logger.log(`AI API response ${response.status} ${endpoint}`);

    const data = response.data;
    if (data?.text && typeof data.text === "string") {
      logger.log(`AI API response text length ${data.text.length}`);
    }

    if (Array.isArray(data?.sources)) {
      const tokenCount = data.sources.reduce((sum: number, source: any) => {
        return sum + (source?.token_count_estimate || 0);
      }, 0);
      logger.log(`AI API token count ${tokenCount}`);
    }

    return response;
  },
  (error) => {
    const status = error.response?.status;
    const details = error.response?.data ? JSON.stringify(error.response.data) : "no response body";
    logger.error(`AI API response error ${status || "unknown"} ${details}`);
    return Promise.reject(error);
  }
);

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}



export async function newAIResponseFlow(slug: string, message: string, currentAttempt = 1): Promise<string | false> {
  const maxRetries = 3;

  try {
    const formattedPhoneNumber = removeWhatsAppSuffix(slug);
    logger.log(`AI API generating response for ${formattedPhoneNumber} attempt ${currentAttempt} of ${maxRetries}`);

    const response = await aiClient.post(
      `/api/v1/prediction/${workspace}`,
      {
        question: message,
        streaming: false,
        overrideConfig: {
            sessionId: formattedPhoneNumber,
            stream: false,
        }
      }
    );
    const textResponse = response.data.text;

    return textResponse;
  } catch (error) {
    if (currentAttempt < maxRetries) {
      const waitTime = 1000 * currentAttempt;
      logger.warn(`AI API attempt ${currentAttempt} failed for ${slug}, retrying in ${waitTime} ms`);
      await wait(waitTime);
      return newAIResponseFlow(slug, message, currentAttempt + 1);
    }

    logger.error(`Error getting response from AI API: ${error}`);
    return false;
  }
}

export async function newImageResponseAI(slug: string, message: string, imageBuffer: Buffer) {
  try {
    const formattedPhoneNumber = removeWhatsAppSuffix(slug);
    // Validar que el buffer no esté vacío
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
      logger.error("Buffer is empty or not a Buffer.");
      return { textResponse: false, totalTokenCount: false };
    }

    // Determinar el tipo de archivo y MIME
    const fileType = await fileTypeFromBuffer(imageBuffer);

    if (!fileType) {
      logger.error("Cannot determine file type.");
      return { textResponse: false, totalTokenCount: false };
    }

    const { mime, ext } = fileType;
    const base64Prefix = `data:${mime};base64,`;
    const imageB64 = imageBuffer.toString('base64');
    const contentString = `${base64Prefix}${imageB64}`;

    // Realizar la solicitud
    const response = await aiClient.post(
      `/api/v1/prediction/${workspace}`,
      {
        question: message,
        streaming: false,
        overrideConfig: {
            sessionId: formattedPhoneNumber,
            stream: false,
        },
        uploads: [
          {
            type: 'file',
            name: `image.${ext}`,
            data: contentString,
            mime: mime,
          }
        ]
      }
    );

    const textResponse = response.data.text;

    return textResponse;
  } catch (error) {
    logger.error(`Error getting response from AI API: ${error.response?.data}`);
    throw error;
  }
}

export async function deleteThreadAI(slug: string) {
  try {
    const formattedPhoneNumber = removeWhatsAppSuffix(slug);
    const response = await aiClient.delete(
      `/api/v1/chatmessage/${workspace}`,
      {
        params: {
          sessionId: formattedPhoneNumber,
        },
      }
    );
    if (response.status === 200 && response.data.affected > 0) {
      logger.log(`Thread ${formattedPhoneNumber} deleted successfully`);
      return 'Thread deleted successfully';
    } else {
      logger.error(`Error deleting thread: ${response.data}`);
      return 'Error deleting thread';
    }
  } catch (error) {
    logger.error(`Error deleting thread: ${error.response?.data}`);
    return 'Error deleting thread';
  }
}

