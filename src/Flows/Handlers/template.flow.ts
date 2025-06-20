import { addKeyword, EVENTS } from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { MetaProvider as Provider } from "@builderbot/provider-meta";
import "dotenv/config";

const botPhoneNumber = process.env.BOT_PHONENUMBER || "";

const templateFlow = addKeyword<Provider, Database>(EVENTS.TEMPLATE).addAction(
  async (ctx, { endFlow }) => {
    if (ctx.to !== botPhoneNumber) {
      return endFlow();
    }
    return endFlow();
  }
);

export default templateFlow;