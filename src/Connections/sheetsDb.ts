import SheetDB from "sheetdb-node";
import Logger from "src/Utils/logger";
import axios from "axios";

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

  constructor(private apiKey: string, private sheetId: string) {
    this.client = new SheetDB({
      apiKey: this.apiKey,
      address: this.sheetId,
    });
  }

  // *Método para create un nuevo registro
  async create(data: any): Promise<any> {
    try {
      const response = await axios.post(`https://sheetdb.io/api/v1/${this.sheetId}`,
        { data: [data] },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`
          }
        }
       );
      return response;
    } catch (error) {
      logger.error(`Error creating record: ${error}`);
      return false;
    }
  }

  // *Método para query registers
  async query(filter: any = {}): Promise<any> {
    try {
      const response = await axios.get(`https://sheetdb.io/api/v1/${this.sheetId}/search?${filter}`,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        }
      }
      );
      return response;
    } catch (error) {
      logger.error(`Error querying records: ${error}`);
      return false;
    }
  }

  // *Método para update registers
  // TODO: iMPLEMENTAR BATCH UPDATE
  async update(filter: any, newRecords: any): Promise<any> {
    try {
      const response = await axios.put(`https://sheetdb.io/api/v1/${this.sheetId}/${filter}/${newRecords}`,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        }
      }
      );
      return response;
    } catch (error) {
      logger.error(`Error updating records: ${error}`);
      return false;
    }
  }

  // *Método para delete registers
  async delete(filter: Partial<T>): Promise<T[] | false> {
    try {
      const response = await this.client.delete(filter);
      return response;
    } catch (error) {
      logger.error(`Error deleting records: ${error}`);
      return false;
    }
  }

  // *Método para insertar múltiples registers
  async getMultiples(registers: T[]): Promise<T[] | false> {
    try {
      const responses = await Promise.all(
        registers.map((register) =>
          this.create(register).catch(() => false)
        )
      );

      if (responses.includes(false)) {
        return false;
      }

      return responses as T[];
    } catch (error) {
      logger.error(`Error inserting multiple records: ${error}`);
      return false;
    }
  }

  // *Método para obtener el primer registro que coincida con un filtro
  async getFirst(filter: Partial<T> = {}): Promise<T | null | false> {
    try {
      const registers = await this.query(filter);
      if (registers === false) return false;
      return registers.length > 0 ? registers[0] : null;
    } catch (error) {
      logger.error(`Error getting first record: ${error}`);
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
//         console.log('Usuario creado:', nuevoUsuario);

//         // query usuarios
//         const usuariosFiltrados = await usuarioManager.query({
//             edad: 30
//         });
//         console.log('Usuarios de 30 años:', usuariosFiltrados);

//         // Demostración para Productos
//         const nuevoProducto = await productoManager.create({
//             nombre: 'Laptop',
//             precio: 1000,
//             categoria: 'Electrónica'
//         });
//         console.log('Producto creado:', nuevoProducto);
//     } catch (error) {
//         console.error('Error en la demostración:', error);
//     }
// }

// Descomentar para ejecutar la demostración
// ejemploUso();
