import { addKeyword, EVENTS } from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { MetaProvider as Provider } from "@builderbot/provider-meta";
import "dotenv/config";

const templateFlow = addKeyword<Provider, Database>(EVENTS.TEMPLATE).addAction(
  async (_, { endFlow }) => {
    return endFlow();
  }
);

export default templateFlow;