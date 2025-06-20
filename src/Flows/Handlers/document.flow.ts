import { addKeyword, EVENTS } from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { MetaProvider as Provider } from "@builderbot/provider-meta";
import chatwootService from "src/Connections/chatwoot.class";
import { sendTextFormated } from "src/Utils/messages-formater";
import "dotenv/config";

const multimediaNotifications = process.env.BOT_MULTIMEDIA_NOTIFICATIONS || "false";
const botPhoneNumber = process.env.BOT_PHONENUMBER || "";

const documentFlow = addKeyword<Provider, Database>(EVENTS.DOCUMENT).addAction(
  async (ctx, { state, endFlow, provider }) => {
    if (ctx.to !== botPhoneNumber) {
      return endFlow();
    }
    if (multimediaNotifications === 'true' && ctx.type === "document") {
      await sendTextFormated(
        process.env.BOT_ADMIN_PHONE_NUMBER,
        `La conversación con el nombre ${state.get(
          "name"
        )} y el teléfono ${state.get('phone')} ha enviado un documento`,
        provider
      );
      await chatwootService.sendNotes(state.get("phone"), `La conversación con el nombre ${state.get(
        "name"
      )} y el teléfono ${state.get('phone')} ha enviado un documento`, "outgoing", true);
      return endFlow();
    } else {
      return endFlow();
    }
  }
);

export default documentFlow;
