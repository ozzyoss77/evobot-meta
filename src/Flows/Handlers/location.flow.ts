import { addKeyword, EVENTS } from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { MetaProvider as Provider } from "@builderbot/provider-meta";
import "dotenv/config";

const locationFlow = addKeyword<Provider, Database>(EVENTS.LOCATION).addAction(
  async (_, { endFlow }) => {
    return endFlow();
  }
);

export default locationFlow;