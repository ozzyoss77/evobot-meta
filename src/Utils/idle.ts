import { EVENTS, addKeyword } from "@builderbot/bot";
import { BotContext, TFlow } from "@builderbot/bot/dist/types";
import Logger from "src/Utils/logger";

const logger = new Logger();

// *Object to store timers for each user
const timers = {};

// *Flow for handling inactivity
const idleFlow = addKeyword(EVENTS.ACTION).addAction(
  async (_, { state, endFlow, provider }) => {
    logger.log("Inactivity detected");
    await provider.sendText(
      state.get("phone"),
      "Se ha cerrado la sesión, por inactividad."
    );
    return endFlow();
  }
);

// *Function to start the inactivity timer for a user
const start = (
  ctx: BotContext,
  gotoFlow: (a: TFlow) => Promise<void>,
  ms: number
) => {
  timers[ctx.from] = setTimeout(() => {
    return gotoFlow(idleFlow);
  }, ms);
};

// *Function to reset the inactivity timer for a user
const reset = (
  ctx: BotContext,
  gotoFlow: (a: TFlow) => Promise<void>,
  ms: number
) => {
  stop(ctx);
  if (timers[ctx.from]) {
    clearTimeout(timers[ctx.from]);
  }
  start(ctx, gotoFlow, ms);
};

// *Function to stop the inactivity timer for a user
const stop = (ctx: BotContext) => {
  if (timers[ctx.from]) {
    clearTimeout(timers[ctx.from]);
    delete timers[ctx.from];
  }
};

export { start, reset, stop, idleFlow };
