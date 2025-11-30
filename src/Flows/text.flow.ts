import { addKeyword, EVENTS } from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { MetaProvider as Provider } from "@builderbot/provider-meta";
import { getResponse, getResponseImage } from "src/Utils/formatter";
import chatwootService from "src/Connections/chatwoot.class";
import { sendTextFormated } from "src/Utils/messages-formater";
import "dotenv/config";


/**
 * *Function to initialize the flow
 * @param state
 * @param ctx
 * @param endFlow
 * @returns
 */
async function init(state, endFlow, provider) {
  // *Get the response from the AI
  const response = await getResponse(state, provider);

  // *If the response is empty, end the flow
  if (response === process.env.BOT_FAILURE_MESSAGE) {
    await sendTextFormated(state.get("phone"), response, provider);
    await chatwootService.sendNotes(state.get("phone"), response, "outgoing", true);
    return endFlow();
  }

  // *Send the response to the user
  await sendTextFormated(state.get("phone"), response, provider);
  await chatwootService.sendNotes(state.get("phone"), response, "outgoing", true);
  
  // *End flow for the text message event
  return endFlow();
}

async function initImage(state, endFlow, provider) {
  // *Get the response from the AI
  const response = await getResponseImage(state, state.get("imageQuoted"), provider);
  if (response === process.env.BOT_FAILURE_MESSAGE) {
    await sendTextFormated(state.get("phone"), response, provider);
    await chatwootService.sendNotes(state.get("phone"), response, "outgoing", true);
    return endFlow();
  }

  // *Send the response to the user
  await sendTextFormated(state.get("phone"), response, provider);
  await chatwootService.sendNotes(state.get("phone"), response, "outgoing", true);

  // *Update the state
  await state.update({ imageQuoted: false });

  // *End flow for the text message event
  return endFlow();
}

// ************************************************************************************/
/**
 * *Flow to handle the text messages
 */
const textFlow = addKeyword<Provider, Database>(EVENTS.ACTION).addAction(
  async (ctx, { state, endFlow, provider }) => {
    const isImage = state.get("imageQuoted") || false;
    if (!isImage) {
      await init(state, endFlow, provider);
    } else {
      await initImage(state, endFlow, provider);
    }
  }
);

export default textFlow;
