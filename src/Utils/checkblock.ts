import chatwootService from "src/Connections/chatwoot.class";

export async function checkBlock(state, globalState) {
    // *Check if the bot is off globally
    const botOffGlobal = globalState.get('block') || "";
    if (botOffGlobal === "true") {
      return true;
    }    
    // *Check if the bot is off
    if ((await chatwootService.getAttributes(state.get("phone")))?.bot === "Off") {
      return true;
    }
    return false;
}

export async function checkBlockFollowUp(phoneNumber) {
    if ((await chatwootService.getAttributes(phoneNumber))?.bot === "Off") {
      return true;
    }
    return false;
}