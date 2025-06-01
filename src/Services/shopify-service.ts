import { BaseIntegrationService, IntegrationResponse } from "src/interfaces/types";
import axios from "axios";
import { newAIResponse } from "src/AIApi/api-llm";
import 'dotenv/config';

export class ShopifyService extends BaseIntegrationService {
  private apiUrl: string;
  private isActive: string;
  constructor() {
    super();
    this.apiUrl = process.env.SHOPIFY_API_URL || "";
    this.isActive = process.env.SHOPIFY_ACTIVATED || "false";
  }

  isEnabled(): boolean {
    return this.isActive === "true";
  }

  async processTag(text: string, state: Map<string, any>): Promise<IntegrationResponse> {
    const checkProductsRegex = /\$%checkProducts: filter='([^']+)'%(\$)?/g;
    const match = checkProductsRegex.exec(text);
    const filter = match ? match[1] : "";
    console.log('esto es el filter',filter || "No se detectó filtro");

    if (!match) {
      return { success: false, text };
    }

    try {
      // const response = await axios.get(this.apiUrl);
      const response = await axios.post(this.apiUrl, 
        {
          business_id: process.env.SHOPIFY_BUSINESS_ID,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "shopify_access_token": process.env.SHOPIFY_ACCESS_TOKEN
          }
        }
      )

      const activeProducts = response.data.filter((product: any) => {
        const searchTerms = filter.toLowerCase().split(' ').filter(term => term.length > 0);
        const productTitle = product.title_product.toLowerCase();
        
        return searchTerms.every(term => productTitle.includes(term));
      });

      if (response.status === 200) {
        const { textResponse } = await this.generateAIResponse(`${JSON.stringify(activeProducts)}`, state);
        return {
          success: true,
          text: textResponse,
        };
      } else if (response.status === 400) {
        const { textResponse } = await this.generateAIResponse("Los productos no están disponibles en este momento", state);
        return {
          success: false,
          text: textResponse,
        };
      } else {
        return { success: false, text: "Ocurrió un error inesperado consultando los productos." };
      }
    } catch (error: any) {
      if (error.response && error.response.status === 400) {
        const { textResponse } = await this.generateAIResponse("Los productos no están disponibles en este momento", state);
        return {
          success: false,
          text: textResponse,
        };
      }
      this.logger.error(`Error en ShopifyService: ${error?.message}`);
      return { success: false, text: "Parece que hubo un error consultando los productos, inténtalo de nuevo más tarde." };
    }
  }

  private async generateAIResponse(data: any, state: Map<string, any>) {
    return await newAIResponse(state.get("phone"), `$%${typeof data === "string" ? data : JSON.stringify(data)}%$`);
  }
}
