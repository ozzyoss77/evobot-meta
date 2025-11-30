import { CalApiClient } from "src/Connections/cal.com";
import { newAIResponse } from "src/AIApi/api-llm";
import Logger from "src/Utils/logger";
import 'dotenv/config';

const logger = new Logger();

export class CalService {
    private calApiClient: CalApiClient;
    private eventTypeId: string;

    constructor() {
        this.calApiClient = new CalApiClient(process.env.CAL_API_KEY || '');
        this.eventTypeId = process.env.CAL_EVENT_TYPE_ID || '';
    }

    async processCommand(text: string, state: Map<string, any>): Promise<any> {
        const checkAvailability = await this.checkAvailability(text, state);
        const sendAppointment = await this.sendAppointment(checkAvailability, state);
        return sendAppointment;
    }

    async checkAvailability(text: string, state: Map<string, any>) {
        const checkAvailabilityRegex = /\$\$checkAvailability:(\d{4}-\d{2}-\d{2})\$\$/;
        const checkAvailabilityMatch = text.match(checkAvailabilityRegex);

        if (checkAvailabilityMatch) {
            const date = checkAvailabilityMatch[1];
            const availability = await this.calApiClient.checkAvailability(date);
            const requiredBookingFields = await this.calApiClient.getRequiredBookingFields();

            const response = JSON.stringify({
                availability,
                requiredBookingFields
            });
            const { textResponse, totalTokenCount } = await this.generateAIResponse(response, state);
            return textResponse;
        } else {
            return text;
        }
    }

    async sendAppointment(text: string, state: Map<string, any>) {
        const paramsRegex = /\$\$([\s\S]*?start[\s\S]*?)\$\$/;
        const paramsMatch = text.match(paramsRegex);

        if (paramsMatch) {
            let paramsString = paramsMatch[1];
            const paramsObject = JSON.parse(paramsString);
            if (!paramsString.endsWith('}')) {
                paramsString += '}';
            }

            try {
                const sendAppointment = await this.calApiClient.scheduleAppointment(paramsObject);
                if (sendAppointment) {
                    const { textResponse, totalTokenCount } = await this.generateAIResponse(JSON.stringify(sendAppointment.data), state);
                    return textResponse;
                } else {
                    const { textResponse, totalTokenCount } = await this.generateAIResponse("Error al agendar la cita horario no disponible", state);
                    return textResponse;
                }
            } catch (error) {
                logger.log(JSON.stringify(error));
                return "Error al agendar la cita horario no disponible";
            }
        } else {
            return text;
        }
    }

    async generateAIResponse(text: string, state: Map<string, any>) {
        return await newAIResponse(state.get("phone"), text);
    }
}