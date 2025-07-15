import Logger from "src/Utils/logger";
import { redisClient } from "./redis";
import "dotenv/config";

const recuHost = process.env.RECU_HOST || "https://pruebas.recu.com.co/omni/webhook";
const recuUsername = process.env.RECU_USERNAME || "IntegrationIAPPS";
const recuPassword = process.env.RECU_PASSWORD || "your_password_here";
const envToken = process.env.RECU_TOKEN || "your_token_here";
const logger = new Logger();

export interface LoginResponse {
  access_token: string
  token_type: string
}

export type EtiquetaTipo =
  | "no_contacto"
  | "correccion_numero"
  | "no_desea_negociar"
  | "propuesta_fuera_limites"
  | "acuerdo_de_pago"

class RecuApiClient {
  private baseUrl = recuHost
  private token: string | null = null
  private readonly TOKEN_KEY = "recu_api_token"
  private readonly TOKEN_EXPIRY = 30 * 24 * 60 * 60 // 30 días en segundos

  async login(username: string, password: string): Promise<{ access_token: string, token_type: string }> {
    const response = await fetch(`${this.baseUrl}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    })

    if (response.status === 401) {
      const errorData = await response.json()
      logger.error(`401 Unauthorized: Token no enviado, vencido o inválido: ${errorData.error}`)
      return {
        access_token: "error",
        token_type: "error"
      }
    }

    if (response.status === 403) {
      const errorData = await response.json()
      logger.error(`403 Forbidden: Token válido pero sin permisos suficientes: ${errorData.error}`)
      return {
        access_token: "error",
        token_type: "error"
      }
    }

    if (!response.ok) {
      const error = await response.json()
      logger.error(`Login failed: ${error.error || "Error desconocido"}`)
      return {
        access_token: "error",
        token_type: "error"
      }
    }

    const data: LoginResponse = await response.json()
    return {
      access_token: data.access_token,
      token_type: data.token_type
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `jwt ${this.token}`,
        },
      })

      if (response.status === 401) {
        const errorData = await response.json()
        logger.error(`Token expirado, requiere nuevo login: ${errorData.error}`)
        this.token = null
        return false
      }

      if (response.ok) {
        const data: LoginResponse = await response.json()
        this.token = data.access_token
        return true
      }

      return false
    } catch (error) {
      logger.error(`Error al renovar token: ${error || "Error desconocido"}`)
      return false
    }
  }

  private async getValidToken(): Promise<string> {
    try {
      // Intentar obtener token desde Redis
      const cachedToken = await redisClient.get(this.TOKEN_KEY)
      
      if (cachedToken) {
        logger.log("Token encontrado en Redis, verificando validez...")
        this.token = cachedToken
        
        // Verificar si el token sigue siendo válido
        const isValid = await this.verifyToken(cachedToken)
        if (isValid) {
          logger.log("Token de Redis es válido")
          return cachedToken
        } else {
          logger.log("Token de Redis expirado, eliminando...")
          await redisClient.del(this.TOKEN_KEY)
        }
      }

      // Si no hay token válido, generar uno nuevo
      logger.log("Generando nuevo token...")
      const loginResult = await this.login(recuUsername, recuPassword)
      
      if (loginResult.access_token === "error") {
        throw new Error("No se pudo obtener un token válido")
      }

      // Almacenar el nuevo token en Redis con expiración
      await redisClient.set(this.TOKEN_KEY, loginResult.access_token)
      await redisClient.getClient().expire(this.TOKEN_KEY, this.TOKEN_EXPIRY)
      
      this.token = loginResult.access_token
      logger.log("Nuevo token generado y almacenado en Redis")
      
      return loginResult.access_token
    } catch (error) {
      logger.error(`Error al obtener token válido: ${error}`)
      throw error
    }
  }

  private async verifyToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/verify`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `jwt ${token}`,
        },
      })

      return response.ok
    } catch (error) {
      logger.error(`Error al verificar token: ${error}`)
      return false
    }
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    try {
      const token = await this.getValidToken()
      return {
        "Content-Type": "application/json",
        Authorization: `jwt ${token}`,
      }
    } catch (error) {
      logger.error(`Error al obtener headers de autenticación: ${error}`)
      // Fallback al token hardcodeado en caso de error
      return {
        "Content-Type": "application/json",
        Authorization: `jwt ${envToken}`,
      }
    }
  }

  async registerLead(etiqueta: EtiquetaTipo, datosEtiqueta: object): Promise<{ success: boolean, message: string }> {
    try {
      const headers = await this.getAuthHeaders()
      
      const response = await fetch(`${this.baseUrl}/prejudicial`, {
        method: "POST",
        headers,
        body: JSON.stringify({ etiqueta, datos_etiqueta: datosEtiqueta }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Si el token expiró durante la operación, intentar renovar y reintentar
        if (response.status === 401) {
          logger.log("Token expirado durante operación, renovando...")
          await redisClient.del(this.TOKEN_KEY)
          this.token = null
          
          // Reintentar con nuevo token
          const newHeaders = await this.getAuthHeaders()
          const retryResponse = await fetch(`${this.baseUrl}/prejudicial`, {
            method: "POST",
            headers: newHeaders,
            body: JSON.stringify({ etiqueta, datos_etiqueta: datosEtiqueta }),
          })
          
          const retryData = await retryResponse.json()
          
          if (!retryResponse.ok) {
            logger.error(`Error al registrar evento después de renovar token: ${retryData.error}`)
            return {
              success: false,
              message: retryData.error
            }
          }
          
          return retryData
        }
        
        logger.error(`Error al registrar evento: ${data.error}`)
        return {
          success: false,
          message: data.error
        }
      }

      return data
    } catch (error) {
      logger.error(`Error en registerLead: ${error}`)
      return {
        success: false,
        message: `Error interno: ${error}`
      }
    }
  }
}

const recuApiClient = new RecuApiClient();
export default recuApiClient;