import axios from 'axios';
import Logger from 'src/Utils/logger';

const logger = new Logger();

export class CalApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string) {
    this.baseUrl = 'https://api.cal.com/v2';
    this.apiKey = apiKey;
  }

  /**
   * Método 1: Verifica si una fecha está disponible en el calendario.
   * Se asume que existe un endpoint GET /availability que recibe la fecha.
   * @param date Fecha a verificar
   * @returns Promise<boolean> true si está disponible, false en caso contrario
   */
  public async checkAvailability(date: string): Promise<boolean> {
    try {// Construir los parámetros de la consulta
      const params = {
        eventTypeId: process.env.CAL_EVENT_TYPE_ID || "",
        start: `${date}T00:00:00Z`,
        end: `${date}T23:59:59Z`,
        timeZone: process.env.BOT_TIMEZONE || "UTC"
      };

      // Realizar la solicitud GET al endpoint /v2/slots
      const response = await axios.get(`${this.baseUrl}/slots`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'cal-api-version': '2024-09-04',
          'Content-Type': 'application/json'
        },
        params
      });
      return response.data;

      // Verificar si hay slots disponibles en la respuesta
      // const slots = response.data;
      // return slots && slots.length > 0;
    } catch (error) {
      logger.error(`Error al verificar disponibilidad: ${error}`);
      return false;
    }
  }

  /**
   * Método 2: Consulta el endpoint de un tipo de evento y retorna los bookingFields obligatorios.
   * Se realiza una petición GET a /event-types/{eventTypeId}.
   * @param eventTypeId Identificador del tipo de evento
   * @returns Promise<BookingField[]> Arreglo con los bookingFields que tienen required === true
   */
  public async getRequiredBookingFields(): Promise<any> {
    try {
      const { data } = await axios.get(`${this.baseUrl}/event-types/${process.env.CAL_EVENT_TYPE_ID || ""}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'cal-api-version': '2024-06-14',
          'Content-Type': 'application/json'
        }
      });
      const requiredFields: Record<string, boolean> = {}; // Declaración de requiredFields
      data.data.bookingFields.forEach(field => {
        if (field.required === true && field.slug !== 'title') {
          requiredFields[field.slug] = true;
        }
      });
      return requiredFields;
    } catch (error) {
      logger.error(`Error al obtener bookingFields: ${error}`);
      return [];
    }
  }

  /**
   * Método 3: Agenda una cita en el calendario.
   * Se asume que el endpoint para crear una cita es POST /appointments.
   * @param paramsObject Objeto con los datos necesarios para agendar la cita
   * @returns Promise<any> Respuesta de la API luego de agendar la cita
   */
  public async scheduleAppointment(paramsObject: any): Promise<any> {
    try {
      const { start, name, email, ...otherFields } = paramsObject;
      const payload = {
        start,
        eventTypeId: parseInt(process.env.CAL_EVENT_TYPE_ID || ""),
        attendee: {
          name,
          email,
          timeZone: process.env.BOT_TIMEZONE || "UTC",
        },
        bookingFieldsResponses: {
          ...otherFields
        }
      }
      const response = await axios.post(`${this.baseUrl}/bookings`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'cal-api-version': '2024-08-13',
            'Content-Type': 'application/json'
          }
        });
      return response.data;
    } catch (error) {
      logger.error(`Error al agendar la cita: ${JSON.stringify(error)}`);
      return false;
    }
  }
}

export default CalApiClient;