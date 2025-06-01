import axios from "axios";
import fs from "fs";
import Logger from "src/Utils/logger";
import 'dotenv/config';

const logger = new Logger();

class TextToSpeechConverter {
  apiKey: string;
  voiceId: string;
  apiUrl: string;
  constructor() {
    this.apiKey = process.env.ELEVEN_LABS_API_KEY;
    this.voiceId = process.env.ELEVEN_LABS_VOICE_ID;
    this.apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`;
  }

  getRequestData(text) {
    return {
      text: text,
      model_id: process.env.ELEVEN_LABS_MODEL,
      speed: parseInt(process.env.ELEVEN_LABS_SPEED),
      voice_settings: {
        stability: parseInt(process.env.ELEVEN_LABS_STABILITY),
        similarity_boost: parseInt(process.env.ELEVEN_LABS_SIMILARITY_BOOST),
        style: parseInt(process.env.ELEVEN_LABS_STYLE_EXAGERATION),
        use_speaker_boost: true,
      },
      // apply_text_normalization: 'on'
    };
  }

  getRequestConfig() {
    return {
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": this.apiKey,
      },
      responseType: "arraybuffer" as const,
    };
  }

  async fetchSpeechData(text) {
    if (!text) {
      logger.error("No se proporcionó texto para la conversión.");
      return 'No se proporcionó texto para la conversión.';
    }

    try {
      const response = await axios.post(
        this.apiUrl,
        this.getRequestData(text),
        this.getRequestConfig()
      );
      return response.data;
    } catch (error) {
      logger.error(`La conversión falló: ${error.message}` || `La conversión falló: ${error.response?.data}` || `La conversión falló: ${error.data}`);
      return 'La solicitud a la API falló';
    }
  }

  async saveToFile(fileName, data) {
    try {
      fs.writeFile(fileName, data, (err) => {
        if (err) {
          logger.error(`Falló al guardar el archivo: ${err.message}`);
          return 'Falló al guardar el archivo';
        }
        logger.log("Archivo de audio guardado con éxito.");
      });
    } catch (error) {
      logger.error(`Falló al guardar el archivo: ${error.message}` || `Falló al guardar el archivo: ${error.response?.data}` || `Falló al guardar el archivo: ${error.data}`);
      return 'Falló al guardar el archivo';
    }
  }

  async convert(text: string, outputPath = null) {
    try {
      const speechData = await this.fetchSpeechData(text);
      if (outputPath) {
        await this.saveToFile(outputPath, speechData);
      } else {
        return speechData;
      }
    } catch (error) {
      logger.error(`La conversión falló: ${error.message}` || `La conversión falló: ${error.response?.data}` || `La conversión falló: ${error.data}`);
      return 'La conversión falló';
    }
  }
}

export default TextToSpeechConverter;