import { addKeyword, EVENTS } from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { MetaProvider as Provider } from "@builderbot/provider-meta";
import "dotenv/config";

const botPhoneNumber = process.env.BOT_PHONENUMBER || "";

const locationFlow = addKeyword<Provider, Database>(EVENTS.LOCATION).addAction(
  async (ctx, { endFlow }) => {
    if (ctx.to !== botPhoneNumber) {
      return endFlow();
    }
    return endFlow();
  }
);

export default locationFlow;