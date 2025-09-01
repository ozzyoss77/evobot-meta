import axios, { AxiosInstance } from 'axios'
import Logger from 'src/Utils/logger';

const logger = new Logger();

export class CalApiClient {
  private baseUrl: string;
  private apiKey: string;
  private axiosInstance: AxiosInstance;

  constructor(apiKey: string) {
    this.baseUrl = 'https://api.cal.com/v2';
    this.apiKey = apiKey;
    
    // Crear instancia con interceptors
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Interceptors estilo VTEX
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.log(`📅 Cal.com API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ Cal.com API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.log(`✅ Cal.com API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('❌ Cal.com API Response Error:', error.response?.status, error.response?.data);
        return Promise.reject(error);
      }
    );
  }

  public async checkAvailability(date: string): Promise<boolean> {
    try {
      logger.log(`🔍 Cal.com: Checking availability for date: ${date}`);
      
      const params = {
        eventTypeId: process.env.CAL_EVENT_TYPE_ID || "",
        start: `${date}T00:00:00Z`,
        end: `${date}T23:59:59Z`,
        timeZone: process.env.BOT_TIMEZONE || "UTC"
      };

      const response = await this.axiosInstance.get(`/slots`, {
        headers: {
          'cal-api-version': '2024-09-04',
        },
        params
      });
      
      logger.log(`✅ Cal.com: Availability check completed for ${date}`);
      return response.data;
    } catch (error) {
      logger.error(`❌ Cal.com Error checking availability for ${date}: ${error}`);
      return false;
    }
  }

  public async getRequiredBookingFields(): Promise<any> {
    try {
      logger.log(`📋 Cal.com: Fetching required booking fields`);
      
      const { data } = await this.axiosInstance.get(`/event-types/${process.env.CAL_EVENT_TYPE_ID || ""}`, {
        headers: {
          'cal-api-version': '2024-06-14',
        }
      });
      
      const requiredFields: Record<string, boolean> = {};
      data.data.bookingFields.forEach(field => {
        if (field.required === true && field.slug !== 'title') {
          requiredFields[field.slug] = true;
        }
      });
      
      logger.log(`✅ Cal.com: Found ${Object.keys(requiredFields).length} required fields`);
      return requiredFields;
    } catch (error) {
      logger.error(`❌ Cal.com Error fetching booking fields: ${error}`);
      return [];
    }
  }

  public async scheduleAppointment(paramsObject: any): Promise<any> {
    try {
      logger.log(`🗓️ Cal.com: Scheduling appointment for ${paramsObject.name} (${paramsObject.email})`);
      
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
      
      const response = await this.axiosInstance.post(`/bookings`, payload, {
        headers: {
          'cal-api-version': '2024-08-13',
        }
      });
      
      logger.log(`✅ Cal.com: Appointment scheduled successfully for ${name}`);
      return response.data;
    } catch (error) {
      logger.error(`❌ Cal.com Error scheduling appointment: ${JSON.stringify(error)}`);
      return false;
    }
  }
}

export default CalApiClient;