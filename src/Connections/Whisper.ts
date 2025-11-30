import OpenAI from "openai";
import Queue from "queue-promise";
import tmp from "tmp";
import fs from "fs";
import Logger from "src/Utils/logger";
import 'dotenv/config';

const logger = new Logger();

logger.log(`🚀 Whisper: Initializing OpenAI Whisper service`);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

logger.log(`✅ Whisper: OpenAI client configured successfully`);

const queue = new Queue({
    concurrent: 1,
    interval: 100,
});

logger.log(`🔄 Whisper: Processing queue initialized with concurrent: 1, interval: 100ms`);

async function processTranscription(buffer) {
    logger.log(`🎵 Whisper: Starting audio transcription process`);
    
    const bufferSize = (buffer.length / 1024).toFixed(2);
    logger.log(`📊 Whisper: Audio buffer size: ${bufferSize} KB`);
    
    const tempFile = tmp.fileSync({ postfix: '.ogg' });
    logger.log(`📁 Whisper: Created temporary file: ${tempFile.name}`);
    
    fs.writeFileSync(tempFile.name, buffer);
    logger.log(`💾 Whisper: Audio buffer written to temporary file`);

    try {
        logger.log(`🤖 Whisper: Sending audio to OpenAI for transcription`);
        
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFile.name),
            // model: "whisper-1"
            model: "gpt-4o-mini-transcribe"
        });

        const textLength = transcription.text.length;
        logger.log(`✅ Whisper: Transcription completed successfully - ${textLength} characters`);
        logger.log(`📝 Whisper: Transcribed text: "${transcription.text.substring(0, 100)}${textLength > 100 ? '...' : ''}"`);

        tempFile.removeCallback();
        logger.log(`🗑️ Whisper: Temporary file cleaned up`);
        
        return transcription.text;
    } catch (error) {
        logger.error(`❌ Whisper: Error during transcription - ${error}`);
        tempFile.removeCallback();
        logger.log(`🗑️ Whisper: Temporary file cleaned up after error`);
        return 'La conversión falló';
    }
}

function voiceToText(buffer) {
    logger.log(`📥 Whisper: Adding transcription request to processing queue`);
    
    return new Promise((resolve, reject) => {
        queue.enqueue(() => {
            logger.log(`⚙️ Whisper: Processing transcription from queue`);
            return processTranscription(buffer)
                .then(result => {
                    logger.log(`✅ Whisper: Queue processing completed successfully`);
                    resolve(result);
                })
                .catch(error => {
                    logger.error(`❌ Whisper: Queue processing failed - ${error}`);
                    reject(error);
                });
        });
    });
}

export {
    voiceToText
};