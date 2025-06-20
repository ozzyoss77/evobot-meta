import { addKeyword, EVENTS } from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { MetaProvider as Provider } from "@builderbot/provider-meta";
import chatwootService from "src/Connections/chatwoot.class";
import { getResponseImage } from "src/Utils/formatter";
import { inyectDateTime } from "src/Utils/formatter";
import { sendTextFormated } from "src/Utils/messages-formater";
import "dotenv/config";

const mediaActivate = process.env.BOT_MEDIA_ACTIVATE || "false";
const multimediaNotifications = process.env.BOT_MULTIMEDIA_NOTIFICATIONS || "false";
const botPhoneNumber = process.env.BOT_PHONENUMBER || "";

/**
 * *Function to initialize the flow
 * @param state
 * @param ctx
 * @param endFlow
 * @returns
 */
async function init(state, endFlow, provider) {
  // *Get the response from the AI
  const response = await getResponseImage(state, state.get("buffer"), provider);
  if (
    response ===
    process.env.BOT_FAILURE_MESSAGE
  ) {
    await sendTextFormated(state.get("phone"), response, provider);
    await chatwootService.sendNotes(state.get("phone"), response, "outgoing", true);
    return endFlow();
  }

  // *Send the response
  await sendTextFormated(state.get("phone"), response, provider);
  await chatwootService.sendNotes(state.get("phone"), response, "outgoing", true);

  // *End flow for the media event
  return endFlow();
}

/**
 * *Flow to handle the voice note event
 */
const imageFlow = addKeyword<Provider, Database>(EVENTS.MEDIA).addAction(
  async (ctx, { state, globalState, endFlow, provider }) => {
    if (ctx.to !== botPhoneNumber) {
      return endFlow();
    }
    if (mediaActivate === "true" && ctx.type === "image") {
      const buffer = await provider.saveBuffer(ctx);
      const time = inyectDateTime();
      await state.update({
        name: ctx.name,
        phone: ctx.from,
        buffer: buffer,
        message: `Fecha y hora actual: ${time}\n${ctx.caption || "."}`,
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

      // *Initialize the flow
      await init(state, endFlow, provider);
    } else {
      if (multimediaNotifications === 'true') {
        const bodyText = `La conversación con el nombre ${state.get("name")} y el teléfono ${state.get('phone')} ha enviado una imagen`
        await sendTextFormated(
          process.env.BOT_ADMIN_PHONE_NUMBER,
          bodyText,
          provider
        );
        await chatwootService.sendNotes(state.get("phone"), bodyText, "outgoing", true);
        return endFlow();
      } else {
        return endFlow();
      }
    }
  }
);

export default imageFlow;
