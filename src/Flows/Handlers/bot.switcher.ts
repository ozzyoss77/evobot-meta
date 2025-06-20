import { addKeyword } from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { MetaProvider as Provider } from "@builderbot/provider-meta";
import chatwootService from "src/Connections/chatwoot.class";
import Logger from "src/Utils/logger";
import { sendTextFormated } from "src/Utils/messages-formater";
import "dotenv/config";

const logger = new Logger();
const botSwitcher = process.env.BOT_SWITCHER;
const botPhoneNumber = process.env.BOT_PHONENUMBER || "";

const botSwitcherFlow = addKeyword<Provider, Database>(botSwitcher).addAction(
  async (ctx, { globalState, endFlow, provider }) => {
    if (ctx.to !== botPhoneNumber) {
      return endFlow();
    }
    let blockState = globalState.get("block") || "";

    let message;
    if (blockState === "true") {
      await globalState.update({ block: "false" });
      blockState = globalState.getAllState(); // Update blockState
      message = "Bot activado";
      logger.log(`Bot activado`);
    } else if (blockState === "false") {
      await globalState.update({ block: "true" });
      blockState = globalState.getAllState(); // Update blockState
      message = "Bot desactivado";
      logger.log(`Bot desactivado`);
    } else {
      await globalState.update({ block: "true" });
      blockState = globalState.getAllState(); // Update blockState
      message = "Bot desactivado";
      logger.log(`Bot desactivado`);
    }
    await sendTextFormated(ctx.from, message, provider);
    await chatwootService.sendNotes(ctx.from, message, "outgoing", true);
    return endFlow();
  }
);

export default botSwitcherFlow;
