import Logger from "src/Utils/logger";
import "dotenv/config";

const recuHost = process.env.RECU_HOST || "https://pruebas.recu.com.co/omni/webhook";
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

  private getAuthHeaders(): HeadersInit {
    if (!this.token) {
      logger.error("Not authenticated")
      return {
        "Content-Type": "application/json",
        Authorization: `jwt ${this.token}`,
      }
    }
    return {
      "Content-Type": "application/json",
      Authorization: `jwt ${this.token}`,
    }
  }

  async registerLead(etiqueta: EtiquetaTipo, datosEtiqueta: object): Promise<{ success: boolean, message: string }> {
    const response = await fetch(`${this.baseUrl}/prejudicial`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ etiqueta, datos_etiqueta: datosEtiqueta }),
    })

    const data = await response.json()

    if (!response.ok) {
      const errorData = await response.json()
      logger.error(`Error al registrar evento: ${errorData.error}`)
      return {
        success: false,
        message: data.error
      }
    }

    return data
  }
}

const recuApiClient = new RecuApiClient();
export default recuApiClient;