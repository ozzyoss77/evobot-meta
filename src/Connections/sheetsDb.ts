import SheetDB from "sheetdb-node";
import Logger from "src/Utils/logger";
import axios, { AxiosInstance } from "axios";

const logger = new Logger();

// *Interfaz para operaciones CRUD genéricas
interface CRUDOperations<T> {
  create(data: any): Promise<any>;
  query(filter?: any): Promise<any>;
  update(filter: any, newData: any): Promise<any>;
  delete(filter: any): Promise<any>;
}

// *Clase genérica para gestión de datos
class SheetDBClass<T extends Record<string, any>> implements CRUDOperations<T> {
  private client: SheetDB;
  private axiosInstance: AxiosInstance;

  constructor(private apiKey: string, private sheetId: string) {
    this.client = new SheetDB({
      apiKey: this.apiKey,
      address: this.sheetId,
    });

    // Validar configuración
    this.validateConfiguration();

    // Crear instancia de axios con interceptors estilo VTEX
    this.axiosInstance = axios.create({
      baseURL: 'https://sheetdb.io/api/v1',
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      }
    });

    // Interceptors para logs detallados
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.log(`📊 SheetDB API Request: ${config.method?.toUpperCase()} ${config.url}`);
        if (config.data) {
          logger.log(`📝 SheetDB Data: ${Array.isArray(config.data?.data) ? config.data.data.length + ' records' : 'single record'}`);
        }
        return config;
      },
      (error) => {
        console.error('❌ SheetDB API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.log(`✅ SheetDB API Response: ${response.status} ${response.config.url}`);
        if (response.data && Array.isArray(response.data)) {
          logger.log(`📋 SheetDB Response: ${response.data.length} records returned`);
        }
        return response;
      },
      (error) => {
        console.error('❌ SheetDB API Response Error:', error.response?.status, error.response?.data);
        return Promise.reject(error);
      }
    );

    logger.log(`📊 SheetDB initialized - Sheet: ${this.sheetId}`);
  }

  private validateConfiguration() {
    const missingConfigs = [];
    
    if (!this.apiKey) missingConfigs.push('API Key');
    if (!this.sheetId) missingConfigs.push('Sheet ID');
    
    if (missingConfigs.length > 0) {
      const errorMsg = `❌ SheetDB: Missing required configuration: ${missingConfigs.join(', ')}`;
      console.error(errorMsg);
      logger.error(errorMsg);
    } else {
      logger.log(`✅ SheetDB: Configuration validated successfully`);
    }
  }

  // *Método para create un nuevo registro
  async create(data: any): Promise<any> {
    try {
      logger.log(`📝 SheetDB: Creating new record in sheet ${this.sheetId}`);
      
      if (!data) {
        console.warn(`⚠️ SheetDB: No data provided for creation`);
        logger.error("No data provided for record creation");
        return false;
      }

      const response = await this.axiosInstance.post(`/${this.sheetId}`, { data: [data] });
      
      logger.log(`✅ SheetDB: Record created successfully in sheet ${this.sheetId}`);
      return response;
    } catch (error) {
      const errorMsg = `Error creating record in sheet ${this.sheetId}: ${error.response?.data?.message || error.message}`;
      console.error(`❌ SheetDB: ${errorMsg}`);
      logger.error(errorMsg);
      return false;
    }
  }

  // *Método para query registers
  async query(filter: any = {}): Promise<any> {
    try {
      const filterStr = typeof filter === 'object' ? new URLSearchParams(filter).toString() : filter;
      logger.log(`🔍 SheetDB: Querying records with filter: ${filterStr || 'none'}`);
      
      const url = filterStr ? `/${this.sheetId}/search?${filterStr}` : `/${this.sheetId}`;
      const response = await this.axiosInstance.get(url);
      
      const recordCount = Array.isArray(response.data) ? response.data.length : 0;
      logger.log(`✅ SheetDB: Query completed - ${recordCount} records found`);
      
      return response;
    } catch (error) {
      const errorMsg = `Error querying records from sheet ${this.sheetId}: ${error.response?.data?.message || error.message}`;
      console.error(`❌ SheetDB: ${errorMsg}`);
      logger.error(errorMsg);
      return false;
    }
  }

  // *Método para update registers
  async update(filter: any, newRecords: any): Promise<any> {
    try {
      logger.log(`🔄 SheetDB: Updating records in sheet ${this.sheetId} with filter: ${filter}`);
      
      if (!filter || !newRecords) {
        console.warn(`⚠️ SheetDB: Missing filter or new data for update`);
        logger.error("Missing filter or new data for update operation");
        return false;
      }

      const response = await this.axiosInstance.put(`/${this.sheetId}/${filter}/${newRecords}`);
      
      logger.log(`✅ SheetDB: Records updated successfully in sheet ${this.sheetId}`);
      return response;
    } catch (error) {
      const errorMsg = `Error updating records in sheet ${this.sheetId}: ${error.response?.data?.message || error.message}`;
      console.error(`❌ SheetDB: ${errorMsg}`);
      logger.error(errorMsg);
      return false;
    }
  }

  // *Método para delete registers
  async delete(filter: Partial<T>): Promise<T[] | false> {
    try {
      logger.log(`🗑️ SheetDB: Deleting records from sheet ${this.sheetId}`);
      
      if (!filter || Object.keys(filter).length === 0) {
        console.warn(`⚠️ SheetDB: No filter provided for deletion - operation cancelled for safety`);
        logger.error("No filter provided for deletion operation");
        return false;
      }

      const response = await this.client.delete(filter);
      
      logger.log(`✅ SheetDB: Records deleted successfully from sheet ${this.sheetId}`);
      return response;
    } catch (error) {
      const errorMsg = `Error deleting records from sheet ${this.sheetId}: ${error.message}`;
      console.error(`❌ SheetDB: ${errorMsg}`);
      logger.error(errorMsg);
      return false;
    }
  }

  // *Método para insertar múltiples registers
  async getMultiples(registers: T[]): Promise<T[] | false> {
    try {
      logger.log(`📊 SheetDB: Creating multiple records (${registers.length}) in sheet ${this.sheetId}`);
      
      if (!Array.isArray(registers) || registers.length === 0) {
        console.warn(`⚠️ SheetDB: No records provided for multiple creation`);
        logger.error("No records provided for multiple creation");
        return false;
      }

      const responses = await Promise.all(
        registers.map((register, index) =>
          this.create(register)
            .then(response => {
              logger.log(`✅ SheetDB: Record ${index + 1}/${registers.length} created successfully`);
              return response;
            })
            .catch((error) => {
              console.error(`❌ SheetDB: Record ${index + 1}/${registers.length} failed: ${error.message}`);
              return false;
            })
        )
      );

      const failedCount = responses.filter(response => response === false).length;
      const successCount = responses.length - failedCount;

      logger.log(`📊 SheetDB: Batch operation completed - ${successCount} success, ${failedCount} failed`);

      if (failedCount > 0) {
        logger.error(`${failedCount} out of ${registers.length} records failed to create`);
        return false;
      }

      return responses as T[];
    } catch (error) {
      const errorMsg = `Error inserting multiple records in sheet ${this.sheetId}: ${error.message}`;
      console.error(`❌ SheetDB: ${errorMsg}`);
      logger.error(errorMsg);
      return false;
    }
  }

  // *Método para obtener el primer registro que coincida con un filtro
  async getFirst(filter: Partial<T> = {}): Promise<T | null | false> {
    try {
      logger.log(`🎯 SheetDB: Getting first record matching filter from sheet ${this.sheetId}`);
      
      const registers = await this.query(filter);
      if (registers === false) {
        console.error(`❌ SheetDB: Query failed when searching for first record`);
        return false;
      }

      const result = registers.length > 0 ? registers[0] : null;
      
      if (result) {
        logger.log(`✅ SheetDB: First record found and returned`);
      } else {
        logger.log(`📭 SheetDB: No records found matching the filter`);
      }
      
      return result;
    } catch (error) {
      const errorMsg = `Error getting first record from sheet ${this.sheetId}: ${error.message}`;
      console.error(`❌ SheetDB: ${errorMsg}`);
      logger.error(errorMsg);
      return false;
    }
  }
}

export default SheetDBClass;



// Ejemplos de uso con diferentes tipos de datos
// async function ejemploUso() {
//     // Ejemplo con Usuarios
//     interface Usuario {
//         id?: string;
//         nombre: string;
//         edad: number;
//         email: string;
//     }

//     const usuarioManager = new SheetDBClass<Usuario>(
//         'tu_api_key_usuarios',
//         'id_hoja_usuarios'
//     );

//     // Ejemplo con Productos
//     interface Producto {
//         id?: string;
//         nombre: string;
//         precio: number;
//         categoria: string;
//     }

//     const productoManager = new SheetDBClass<Producto>(
//         'tu_api_key_productos',
//         'id_hoja_productos'
//     );

//     // Demostración de uso para Usuarios
//     try {
//         // create un usuario
//         const nuevoUsuario = await usuarioManager.create({
//             nombre: 'Juan Pérez',
//             edad: 30,
//             email: 'juan@ejemplo.com'
//         });
//         logger.log('Usuario creado:', nuevoUsuario);

//         // query usuarios
//         const usuariosFiltrados = await usuarioManager.query({
//             edad: 30
//         });
//         logger.log('Usuarios de 30 años:', usuariosFiltrados);

//         // Demostración para Productos
//         const nuevoProducto = await productoManager.create({
//             nombre: 'Laptop',
//             precio: 1000,
//             categoria: 'Electrónica'
//         });
//         logger.log('Producto creado:', nuevoProducto);
//     } catch (error) {
//         console.error('Error en la demostración:', error);
//     }
// }

// Descomentar para ejecutar la demostración
// ejemploUso();
