import axios from "axios";
import Logger from "src/Utils/logger";
import { fileTypeFromBuffer } from 'file-type';
import { removeWhatsAppSuffix } from "src/Utils/formatter";
import "dotenv/config";

const logger = new Logger();

const host = process.env.AI_HOST;
const apikey = process.env.AI_API_KEY;
const workspace = process.env.AI_COLLECTION_NAME;

export async function newThread(name: string, slug: string) {
  try {
    const formattedPhoneNumber = removeWhatsAppSuffix(slug);
    const response = await axios.post(
      `${host}/api/v1/workspace/${workspace}/thread/new`,
      {
        name,
        slug: `${formattedPhoneNumber}-${workspace}`,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apikey}`,
        },
      }
    );
    if (response?.data?.thread === null) {
      // logger.log(`Thread already exists`);
      return;
    }
    return response.data.thread;
  } catch (error) {
    logger.error(`Error creating new thread: ${error.response?.data}`);
  }
}

export async function newAIResponse(slug: string, message: string, currentAttempt = 1) {
  const maxRetries = 3;
  
  try {
    const formattedPhoneNumber = removeWhatsAppSuffix(slug);
    const response = await axios.post(
      `${host}/api/v1/workspace/${workspace}/thread/${formattedPhoneNumber}-${workspace}/chat`,
      {
        message,
        mode: "chat",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apikey}`,
        },
      }
    );
    const textResponse = response.data.textResponse;
    const sources = response.data.sources;

    const totalTokenCount = sources.reduce((sum: number, source: any) => {
      return sum + (source.token_count_estimate || 0);
    }, 0);
    
    return { textResponse, totalTokenCount };
  } catch (error) {
    if (currentAttempt < maxRetries) {
      logger.log(`Attempt ${currentAttempt} of ${maxRetries} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * currentAttempt));
      return newAIResponse(slug, message, currentAttempt + 1);
    }
    
    logger.error(`Error getting response from AI API after ${maxRetries} attempts: ${JSON.stringify(error.response?.data)}`);
    return { textResponse: false, totalTokenCount: false };
  }
}

export async function newImageResponse(slug: string, message: string, imageBuffer: Buffer) {
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
    const response = await axios.post(
      `${host}/api/v1/workspace/${workspace}/thread/${formattedPhoneNumber}-${workspace}/chat`,
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
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apikey}`,
        },
      }
    );

    const textResponse = response.data.textResponse;
    const sources = response.data.sources;

    // Calcular el total de tokens
    const totalTokenCount = sources.reduce((sum: number, source: any) => {
      return sum + (source.token_count_estimate || 1);
    }, 0);

    // logger.log(`Token count: ${totalTokenCount}`);
    return { textResponse, totalTokenCount };
  } catch (error) {
    logger.error(`Error getting response from AI API: ${error.response?.data}`);
    throw error;
  }
}

export async function updateThread(name: string, slug: string) {
  try {
    const formattedPhoneNumber = removeWhatsAppSuffix(slug);
    const response = await axios.post(
      `${host}/api/v1/workspace/${workspace}/thread/${formattedPhoneNumber}-${workspace}/update`,
      {
        thread: {
          name,
          slug: `${formattedPhoneNumber}-${workspace}`,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apikey}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    // logger.error(`Error updating thread: ${error.response?.data}`);
    return "error";
  }
}

export async function deleteThread(slug: string) {
  try {
    const response = await axios.delete(
      `${host}/api/v1/workspace/${workspace}/thread/${slug}-${workspace}`,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apikey}`,
        },
      }
    );
    logger.log(`Thread ${slug} deleted successfully`);
    return response.data;
  } catch (error) {
    logger.error(`Error deleting thread: ${error.response?.data}`);
    return "error";
  }
}

export async function getThreads(slug: string) {
  try {
    const formattedPhoneNumber = removeWhatsAppSuffix(slug);
    const response = await axios.get(
      `${host}/api/v1/workspace/${workspace}/thread/${formattedPhoneNumber}-${workspace}/chats`,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apikey}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    logger.error(`Error getting threads: ${error.response?.data}`);
    return "error";
  }
}

export async function checkThread(slug: string) {
  try {
    const formattedPhoneNumber = removeWhatsAppSuffix(slug);
    await axios.get(
      `${host}/api/v1/workspace/${workspace}/thread/${formattedPhoneNumber}-${workspace}/chats`,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apikey}`,
        },
      }
    );
    return true;
  } catch (error) {
    const formattedPhoneNumber = removeWhatsAppSuffix(slug);
    logger.log(`Thread ${formattedPhoneNumber} does not exist or there was an error checking it: ${error.response?.data}`);
    return false;
  }
}