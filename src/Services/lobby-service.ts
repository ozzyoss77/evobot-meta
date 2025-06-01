import { BaseIntegrationService, IntegrationResponse } from "src/interfaces/types";
import axios from "axios";
import { newAIResponse } from "../AIApi/api-llm";

export class LobbyService extends BaseIntegrationService {
  private apiUrl: string;
  private apiKey: string;
  private isActive: string;

  constructor() {
    super();
    this.apiUrl = process.env.LOBBY_PMS_API_URL;
    this.apiKey = process.env.LOBBY_PMS_API_KEY;
    this.isActive = process.env.LOBBY_PMS_ACTIVATE || "false";
  }

  isEnabled(): boolean {
    return this.isActive === "true";
  }

  async processTag(text: string, state: Map<string, any>): Promise<IntegrationResponse> {
    const regex = /\|\|\s*start_date:\s*(\d{4}-\d{2}-\d{2})\s*end_date:\s*(\d{4}-\d{2}-\d{2})\s*category_id:\s*(\d+)\s*\|\|/;
    const match = text.match(regex);

    if (!match) {
      return { success: false, text };
    }

    const [fullMatch, startDate, endDate, categoryId] = match;
    
    try {
      const availability = await this.checkAvailability(startDate, endDate, categoryId);
      const {textResponse, totalTokenCount} = await this.generateAIResponse(availability, state);
      
      return {
        success: true,
        text: textResponse,

      };
    } catch (error) {
      this.logger.error(`Error en LobbyService: ${error?.message}`);
      return { success: false, text: "Parece que hubo en error consultando la disponibilidad, intentalo de nuevo mas tarde" };
    }
  }

  private async checkAvailability(startDate: string, endDate: string, categoryId: string) {
    const response = await axios.post(
      this.apiUrl,
      {
        start_date: startDate,
        end_date: endDate,
        category_id: categoryId,
      },
      {
        headers: {
          "Content-Type": "application/json",
          apikey: this.apiKey,
        },
      }
    );
    return response.data;
  }

  private async generateAIResponse(availability: any, state: Map<string, any>) {
    if (availability.unavailable_dates?.length > 0) {
      const unavailableDates = availability.unavailable_dates.join(", ");
      return await newAIResponse(state.get("phone"), `%%${unavailableDates}%%`);
    }
    return await newAIResponse(state.get("phone"), `%%available%%`);
  }
}