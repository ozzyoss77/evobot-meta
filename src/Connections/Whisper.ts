import OpenAI from "openai";
import Queue from "queue-promise";
import tmp from "tmp";
import fs from "fs";
import Logger from "src/Utils/logger";
import 'dotenv/config';

const logger = new Logger();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const queue = new Queue({
    concurrent: 1,
    interval: 100,
});

async function processTranscription(buffer) {
    const tempFile = tmp.fileSync({ postfix: '.ogg' });
    fs.writeFileSync(tempFile.name, buffer);

    try {
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFile.name),
            // model: "whisper-1"
            model: "gpt-4o-mini-transcribe"
        });

        tempFile.removeCallback();
        return transcription.text;
    } catch (error) {
        logger.error(`Error during transcription: ${error}`);
        tempFile.removeCallback();
        return 'La conversión falló';
    }
}

function voiceToText(buffer) {
    return new Promise((resolve, reject) => {
        queue.enqueue(() => processTranscription(buffer).then(resolve).catch(reject));
    });
}

export {
    voiceToText
};