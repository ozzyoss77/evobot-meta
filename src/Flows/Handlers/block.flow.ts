import { addKeyword } from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { MetaProvider as Provider } from "@builderbot/provider-meta";
import chatwootService from "src/Connections/chatwoot.class";
import { start, stop } from "src/Utils/idle";
import Logger from "src/Utils/logger";
import { sendTextFormated } from "src/Utils/messages-formater";
import "dotenv/config";

const logger = new Logger();
const blockMessage = process.env.BOT_BLOCK_MESSAGE;

const blockFlow = addKeyword<Provider, Database>(blockMessage)
  .addAction(async (ctx, { state, gotoFlow, provider }) => {
    await state.update({
      phone: ctx.from,
    });
    await sendTextFormated(
      state.get("phone"),
      "Introduce el número de teléfono del usuario que deseas bloquear siguiendo el ejemplo.\n\nEjemplo: *57xxxxxxxxx*",
      provider
    );
    await chatwootService.sendNotes(state.get("phone"), "Introduce el número de teléfono del usuario que deseas bloquear siguiendo el ejemplo.\n\nEjemplo: *57xxxxxxxxx*", "outgoing", true);
    start(ctx, gotoFlow, 30000);
    return;
  })
  .addAction(
    { capture: true },
    async (ctx, { state, endFlow, fallBack, gotoFlow, provider }) => {
      stop(ctx);
      await state.update({
        userBlocked: ctx.body,
      });

      try {
        const blocked = await chatwootService.setAttributes(
          state.get("userBlocked"),
          "bot",
          "Off"
        );
        if (!blocked) {
          logger.log("bloqueado");
          logger.error(
            `No se pudo bloquear el usuario: ${state.get("userBlocked")}`
          );
          await sendTextFormated(
            state.get("phone"),
            "❌ No se pudo bloquear el usuario, revise si el teléfono es correcto y vuelva a intentarlo.🤡",
            provider
          );
          await chatwootService.sendNotes(state.get("phone"), "❌ No se pudo bloquear el usuario, revise si el teléfono es correcto y vuelva a intentarlo.🤡", "outgoing", true);
          start(ctx, gotoFlow, 30000);
          return fallBack("Intenta de nuevo.");
        }
        logger.log(`Usuario bloqueado: ${state.get("userBlocked")}`);
        await sendTextFormated(
          state.get("phone"),
          "✅ El usuario ha sido bloqueado satisfactoriamente 🤗",
          provider
        );
        await chatwootService.sendNotes(state.get("phone"), "✅ El usuario ha sido bloqueado satisfactoriamente 🤗", "outgoing", true);
        return endFlow();
      } catch (error) {
        logger.error(`Error en blockFlow: ${error}`);
        await chatwootService.sendNotes(state.get("phone"), "Algo salió mal, intenta de nuevo más tarde.", "outgoing", true);
        return endFlow("Algo salió mal, intenta de nuevo más tarde.");
      }
    }
  );

export default blockFlow;
