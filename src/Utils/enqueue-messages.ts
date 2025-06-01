import Logger from "src/Utils/logger";

const logger = new Logger();

interface Message {
  text: string;
  timestamp: number;
}

interface QueueConfig {
  gapSeconds: number;
}

interface QueueState {  
  queue: Message[];
  timer: NodeJS.Timeout | null;
  callback: ((body: string) => void) | null;
}

function createInitialState(): QueueState {
  return {
    queue: [],
    timer: null,
    callback: null
  };
}

function resetTimer(state: QueueState): QueueState {
  if (state.timer) {
    clearTimeout(state.timer);
  }
  return { ...state, timer: null };
}

function processQueue(state: QueueState): [string, QueueState] {
  const result = state.queue.map(message => message.text).join(" ");
  logger.log(`Accumulated messages: ${result}`);

  const newState = {
    ...state,
    queue: [],
    timer: null
  };

  return [result, newState];
}

function createMessageQueue(config: QueueConfig) {
  const queues: Record<string, QueueState> = {};

  return function enqueueMessage(userId: string, messageText: string, callback: (body: string) => void): void {
    if (!queues[userId]) {
      queues[userId] = createInitialState();
    }

    const state = resetTimer(queues[userId]);
    state.queue.push({ text: messageText, timestamp: Date.now() });
    state.callback = callback;

    state.timer = setTimeout(() => {
      const [result, newState] = processQueue(state);
      queues[userId] = newState;
      if (state.callback) {
        state.callback(result);
        state.callback = null;
      }
    }, config.gapSeconds);

    queues[userId] = state;
  };
}

export { createMessageQueue, QueueConfig };
