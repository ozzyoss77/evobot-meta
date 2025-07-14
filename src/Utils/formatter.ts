import Logger from "src/Utils/logger";
import moment from "moment-timezone";
import RegexService from "src/Utils/regex";
import {
  newThread,
  newAIResponse,
  checkThread,
  newImageResponse,
} from "src/AIApi/api-llm";
import appwriteService from "src/Connections/appwrite";
import "dotenv/config";

const timeZone = process.env.BOT_TIMEZONE || "UTC";

const logger = new Logger();

export function inyectDateTime() {
  const now = new Date();

  return moment.tz(now, timeZone).format("YYYY/MM/DD - HH:mm:ss");
}

export function formatDateTime(isoDateTime, timeZone) {
  const date = new Date(isoDateTime);

  // *Opciones de formato para la fecha y hora según la zona horaria
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timeZone,
    hour12: false,
  };

  // *Formatear la fecha y hora según la zona horaria
  const formatter = new Intl.DateTimeFormat("es-ES", options);
  const parts = formatter.formatToParts(date);

  // *Extraer las partes relevantes
  const day = parts.find((part) => part.type === "day")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const year = parts.find((part) => part.type === "year")?.value || "";
  const hours = parts.find((part) => part.type === "hour")?.value || "";
  const minutes = parts.find((part) => part.type === "minute")?.value || "";

  // *Crear los resultados formateados
  const formattedDate = `${day}-${month}-${year}`;
  const formattedTime = `${hours}:${minutes}`;

  return {
    date: formattedDate,
    time: formattedTime,
  };
}

export async function getResponse(state, provider) {
  const regex = new RegexService(provider);
  const threadExists = await checkThread(state.get("phone"));
  if (!threadExists) {
    await newThread(state.get("name"), state.get("phone"));
  }
  const { textResponse, totalTokenCount } = await newAIResponse(
    state.get("phone"),
    state.get("message")
  );

  if (!textResponse) {
    logger.error("No se pudo obtener la respuesta del AI");
    return process.env.BOT_FAILURE_MESSAGE;
  }

  // await appwriteService.tokenUsageMetrics(
  //   "aiclon-db-metrics",
  //   "token-usage-metrics",
  //   state.get("phone"),
  //   totalTokenCount
  // );

  const processedMessage = await regex.processText(textResponse, state, provider);
  return processedMessage;
}

export async function getResponseImage(state, buffer, provider) {
  const regex = new RegexService(provider);
  const threadExists = await checkThread(state.get("phone"));
  if (!threadExists) {
    await newThread(state.get("name"), state.get("phone"));
  }
  const { textResponse, totalTokenCount } = await newImageResponse(
    state.get("phone"),
    state.get("message"),
    buffer
  );

  if (!textResponse) {
    logger.error("No se pudo obtener la respuesta del AI");
    return process.env.BOT_FAILURE_MESSAGE;
  }

  // await appwriteService.tokenUsageMetrics(
  //   "aiclon-db-metrics",
  //   "token-usage-metrics",
  //   state.get("phone"),
  //   totalTokenCount
  // );

  const processedMessage = await regex.processText(textResponse, state, provider);
  return processedMessage;
}

export function removeWhatsAppSuffix(input: string): string {
  return input.replace(/@.+$/, "");
}