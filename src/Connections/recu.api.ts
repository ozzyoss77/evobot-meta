// apiClient.ts
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
  private baseUrl = "https://recu.com.co/main/api"
  private token: string | null = null

  async login(username: string, password: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Login failed: ${error.error}`)
    }

    const data: LoginResponse = await response.json()
    this.token = data.access_token
  }

  private getAuthHeaders(): HeadersInit {
    if (!this.token) throw new Error("Not authenticated")
    return {
      "Content-Type": "application/json",
      Authorization: `jwt ${this.token}`,
    }
  }

  async registrarEvento(etiqueta: EtiquetaTipo, datosEtiqueta: object): Promise<any> {
    const response = await fetch(`${this.baseUrl}/prejucicial`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ etiqueta, datos_etiqueta: datosEtiqueta }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Error al registrar evento")
    }

    return data
  }
}

const recuApiClient = new RecuApiClient();

export default recuApiClient;