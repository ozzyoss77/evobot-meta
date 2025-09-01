import axios, { AxiosInstance } from "axios";
import fs from "fs";
import Logger from "src/Utils/logger";
import 'dotenv/config';

const logger = new Logger();

class TextToSpeechConverter {
  apiKey: string;
  voiceId: string;
  apiUrl: string;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.apiKey = process.env.ELEVEN_LABS_API_KEY;
    this.voiceId = process.env.ELEVEN_LABS_VOICE_ID;
    this.apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`;
    
    // Validaciones de configuración
    this.validateConfiguration();
    
    // Crear instancia de axios con interceptors estilo VTEX
    this.axiosInstance = axios.create({
      timeout: 60000, // 60 segundos para audio
      baseURL: 'https://api.elevenlabs.io/v1',
    });

    // Interceptors para logs detallados
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.log(`🎙️ ElevenLabs API Request: ${config.method?.toUpperCase()} ${config.url}`);
        if (config.data?.text) {
          logger.log(`📝 ElevenLabs Text length: ${config.data.text.length} characters`);
          logger.log(`🔊 ElevenLabs Voice ID: ${this.voiceId}`);
          logger.log(`🎛️ ElevenLabs Model: ${config.data.model_id}`);
        }
        return config;
      },
      (error) => {
        console.error('❌ ElevenLabs API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.log(`✅ ElevenLabs API Response: ${response.status} ${response.config.url}`);
        if (response.data && response.headers['content-type']?.includes('audio')) {
          const audioSize = response.data.byteLength || response.data.length || 0;
          logger.log(`🎵 ElevenLabs Audio generated: ${(audioSize / 1024).toFixed(2)} KB`);
        }
        return response;
      },
      (error) => {
        console.error('❌ ElevenLabs API Response Error:', error.response?.status, error.response?.data);
        return Promise.reject(error);
      }
    );

    logger.log(`🎙️ ElevenLabs TTS initialized - Voice: ${this.voiceId}`);
  }

  private validateConfiguration() {
    const missingConfigs = [];
    
    if (!this.apiKey) missingConfigs.push('ELEVEN_LABS_API_KEY');
    if (!this.voiceId) missingConfigs.push('ELEVEN_LABS_VOICE_ID');
    
    if (missingConfigs.length > 0) {
      const errorMsg = `❌ ElevenLabs: Missing required configuration: ${missingConfigs.join(', ')}`;
      console.error(errorMsg);
      logger.error(errorMsg);
    } else {
      logger.log(`✅ ElevenLabs: Configuration validated successfully`);
    }
  }

  getRequestData(text) {
    const requestData = {
      text: text,
      model_id: process.env.ELEVEN_LABS_MODEL || 'eleven_multilingual_v2',
      // language_code: process.env.ELEVEN_LABS_LANGUAGE_CODE || 'es',
      voice_settings: {
        stability: parseFloat(process.env.ELEVEN_LABS_STABILITY) || 0.5,
        similarity_boost: parseFloat(process.env.ELEVEN_LABS_SIMILARITY_BOOST) || 0.5,
        style: parseFloat(process.env.ELEVEN_LABS_STYLE_EXAGERATION) || 0.0,
        use_speaker_boost: true,
      },
      apply_text_normalization: process.env.ELEVEN_LABS_APPLY_TEXT_NORMALIZATION || 'auto',
      // apply_language_text_normalization: process.env.ELEVEN_LABS_APPLY_LANGUAGE_TEXT_NORMALIZATION === 'true' || false,
      // seed: parseInt(process.env.ELEVEN_LABS_SEED) || 0,
      pronunciation_dictionary_locators: [
        {
          pronunciation_dictionary_id: process.env.ELEVEN_LABS_PRONUNCIATION_DICTIONARY_ID,
          version_id: process.env.ELEVEN_LABS_PRONUNCIATION_DICTIONARY_VERSION_ID,
        },
      ],
    };

    // Log de configuración de voz (solo en debug)
    if (process.env.NODE_ENV === 'development') {
      logger.log(`🎛️ ElevenLabs Voice Settings: ${JSON.stringify({
        stability: requestData.voice_settings.stability,
        similarity_boost: requestData.voice_settings.similarity_boost,
        style: requestData.voice_settings.style,
        model: requestData.model_id
      })}`);
    }

    return requestData;
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
      const errorMsg = "No se proporcionó texto para la conversión.";
      console.warn(`⚠️ ElevenLabs: ${errorMsg}`);
      logger.error(errorMsg);
      return errorMsg;
    }

    if (typeof text !== 'string') {
      const errorMsg = "El texto debe ser una cadena de caracteres.";
      console.warn(`⚠️ ElevenLabs: ${errorMsg}`);
      logger.error(errorMsg);
      return errorMsg;
    }

    try {
      logger.log(`🎙️ ElevenLabs: Converting text to speech (${text.length} chars)`);
      
      const response = await this.axiosInstance.post(
        `/text-to-speech/${this.voiceId}`,
        this.getRequestData(text),
        this.getRequestConfig()
      );
      
      logger.log(`✅ ElevenLabs: Speech conversion successful`);
      return response.data;
    } catch (error) {
      const errorDetails = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        textLength: text.length
      };
      
      console.error(`❌ ElevenLabs: Speech conversion failed`, errorDetails);
      
      if (error.response?.status === 401) {
        logger.error(`ElevenLabs: Authentication failed - Check API key`);
        return 'Error de autenticación - Verifica la API key';
      } else if (error.response?.status === 429) {
        logger.error(`ElevenLabs: Rate limit exceeded`);
        return 'Límite de velocidad excedido - Intenta más tarde';
      } else if (error.response?.status === 422) {
        logger.error(`ElevenLabs: Invalid request parameters`);
        return 'Parámetros de solicitud inválidos';
      } else {
        logger.error(`ElevenLabs conversion failed: ${error.message || error.response?.data || error.data}`);
        return 'La solicitud a la API falló';
      }
    }
  }

  async saveToFile(fileName, data) {
    try {
      logger.log(`💾 ElevenLabs: Saving audio to file: ${fileName}`);
      
      if (!data) {
        const errorMsg = "No hay datos de audio para guardar.";
        console.error(`❌ ElevenLabs: ${errorMsg}`);
        logger.error(errorMsg);
        return errorMsg;
      }

      return new Promise((resolve, reject) => {
        fs.writeFile(fileName, data, (err) => {
          if (err) {
            const errorMsg = `Falló al guardar el archivo: ${err.message}`;
            console.error(`❌ ElevenLabs: ${errorMsg}`);
            logger.error(errorMsg);
            reject(errorMsg);
          } else {
            const fileSize = data.length || data.byteLength || 0;
            logger.log(`✅ ElevenLabs: Audio file saved successfully - ${fileName} (${(fileSize / 1024).toFixed(2)} KB)`);
            logger.log("Archivo de audio guardado con éxito.");
            resolve(true);
          }
        });
      });
    } catch (error) {
      const errorMsg = `Falló al guardar el archivo: ${error.message || error.response?.data || error.data}`;
      console.error(`❌ ElevenLabs: ${errorMsg}`);
      logger.error(errorMsg);
      return errorMsg;
    }
  }

  async convert(text: string, outputPath = null) {
    try {
      logger.log(`🚀 ElevenLabs: Starting conversion${outputPath ? ` to file: ${outputPath}` : ' (return buffer)'}`);
      
      if (!text || typeof text !== 'string') {
        const errorMsg = "Texto inválido para conversión.";
        console.warn(`⚠️ ElevenLabs: ${errorMsg}`);
        logger.error(errorMsg);
        return errorMsg;
      }

      const speechData = await this.fetchSpeechData(text);
      
      // Si speechData es un string, es un mensaje de error
      if (typeof speechData === 'string') {
        return speechData;
      }
      
      if (outputPath) {
        const saveResult = await this.saveToFile(outputPath, speechData);
        if (typeof saveResult === 'string') {
          // Error al guardar
          return saveResult;
        }
        logger.log(`✅ ElevenLabs: Conversion completed and saved to ${outputPath}`);
        return true; // Éxito al guardar
      } else {
        logger.log(`✅ ElevenLabs: Conversion completed, returning audio buffer`);
        return speechData;
      }
    } catch (error) {
      const errorMsg = `La conversión falló: ${error.message || error.response?.data || error.data}`;
      console.error(`❌ ElevenLabs: ${errorMsg}`);
      logger.error(errorMsg);
      return 'La conversión falló';
    }
  }
}

export default TextToSpeechConverter;