import { addKeyword, EVENTS } from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { MetaProvider as Provider } from "@builderbot/provider-meta";
import appwriteService from "src/Connections/appwrite";
import { voiceToText } from "src/Connections/Whisper";
import TextToSpeechConverter from "src/Connections/ElevenLab_Voices";
import chatwootService from "src/Connections/chatwoot.class";
import { getResponse, inyectDateTime } from "src/Utils/formatter";
import { sendTextFormated, sendMediaFormated } from "src/Utils/messages-formater";
import Logger from "src/Utils/logger";
import tmp from "tmp";
import "dotenv/config";

const logger = new Logger();
const selecter = process.env.BOT_VOICE_RESPONSE_ACTIVATE;
const bucketId = "aiclon-audios"

/**
 * *Function to get the transcription from the voice
 * @param state
 * @returns
 */
async function getTranscription(state) {
  const time = inyectDateTime();
  const transcription = await voiceToText(state.get("buffer"));
  return await state.update({ message: `Fecha y hora actual: ${time}\n${transcription}` });
}


/**
 * *Function to initialize the flow
 * @param state
 * @param ctx
 * @param endFlow
 * @returns
 */
async function init(state, provider, endFlow) {
  // *Get the voice from the context
  await getTranscription(state);

  // *Get the response from the AI
  const response =await getResponse(state);
  if (response === process.env.BOT_FAILURE_MESSAGE) {
    await sendTextFormated(state.get("phone"), response, provider);
    await chatwootService.sendNotes(state.get("phone"), response, "outgoing", true);
    return endFlow();
  }

  if (selecter === "true") {
    const converter = new TextToSpeechConverter();
    try {
      const buffer = await converter.convert(response);
      const blob = new Blob([buffer], { type: 'audio/mp3' });
      const tempFile = tmp.fileSync({ postfix: ".mp3" });
      const url = (await appwriteService.createFile(bucketId, tempFile.name, buffer, 'audio/mp3')) || "";
      tempFile.removeCallback();
      const intent = await sendMediaFormated(state.get('phone'), 'audio', url, provider);
      const conversationID = await chatwootService.getConversationID(state.get("phone"));
      await chatwootService.sendMedia(conversationID, '', "outgoing", blob, "audio", true);
      if (!intent) {
        logger.log(`No se pudo enviar el audio a ${state.get("phone")}`);
        await sendTextFormated(state.get("phone"), state.get("response"), provider);
        await chatwootService.sendNotes(state.get("phone"), state.get("response"), "outgoing", true);
      }
      await appwriteService.deleteFile(bucketId, tempFile.name);
      return endFlow();
    } catch (error) {
      logger.error(`Error al convertir el texto a audio: ${error.message}` || `Error al convertir el texto a audio: ${error.response?.data}` || `Error al convertir el texto a audio: ${error.data}`);
      await sendTextFormated(state.get("phone"), state.get("response"), provider);
      await chatwootService.sendNotes(state.get("phone"), state.get("response"), "outgoing", true);
      return endFlow();
    }
  }

  // *Send the response
  await sendTextFormated(state.get("phone"), response, provider);
  await chatwootService.sendNotes(state.get("phone"), response, "outgoing", true);

  // *End flow for the voice note event
  return endFlow();
}

/**
 * *Flow to handle the voice note event
 */
const voiceFlow = addKeyword<Provider, Database>(EVENTS.VOICE_NOTE).addAction(
  async (ctx, { state, globalState, endFlow, provider }) => {
    const buffer = await provider.saveBuffer(ctx);
    await state.update({
      name: ctx.name,
      phone: ctx.from,
      buffer: buffer,
    });

    // *Check if the bot is off globally
    const botOffGlobal = globalState.get("block") || "";
    if (botOffGlobal === "true") {
      return endFlow();
    }

    // *Check if the bot is off
    if ((await chatwootService.getAttributes(state.get("phone")))?.bot === "Off") {
      return endFlow();
    }
    await init(state, provider, endFlow);
  }
);

export default voiceFlow;
