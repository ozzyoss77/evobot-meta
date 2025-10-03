import axios, { AxiosInstance } from 'axios';
import 'dotenv/config';

interface VtexConfig {
  accountName: string;
  environment: string;
  appKey: string;
  appToken: string;
}

interface VtexProduct {
  Id: number;
  Name: string;
  CategoryId: number;
  BrandId: number;
  RefId: string;
  Title: string;
  Description: string;
  Keywords: string;
  IsActive: boolean;
  MetaTagDescription: string;
}

interface VtexSku {
  Id: number;
  ProductId: number;
  NameComplete: string;
  ProductName: string;
  ProductDescription: string;
  RefId: string;
  IsActive: boolean;
  IsKit: boolean;
  UnitMultiplier: number;
  MeasurementUnit: string;
}

interface VtexPrice {
  skuId: string;
  costPrice: number;
  basePrice: number;
  listPrice: number;
  markup: number;
  fixedPrices: FixedPrice[];
}

interface FixedPrice {
  tradePolicyId: string;
  value: number;
  listPrice: number;
  minQuantity: number;
  dateRange?: {
    from: string;
    to: string;
  };
}

interface VtexInventory {
  skuId: string;
  warehouseId: string;
  warehouseName: string;
  totalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  unlimitedQuantity: boolean;
}

interface ShippingAddress {
  postalCode: string;
  country: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
}

interface ShippingItem {
  id: string;
  quantity: number;
  price: number; // Precio en centavos
  dimensions?: {
    weight: number; // en gramos
    height: number; // en cm
    width: number; // en cm
    length: number; // en cm
  };
}

interface ShippingOption {
  id: string;
  name: string;
  price: number; // en centavos
  estimate: string; // ej: "2bd" (2 business days)
  deliveryWindow?: {
    startDateUtc: string;
    endDateUtc: string;
  };
}

interface ShippingResponse {
  logisticsInfo: Array<{
    itemIndex: number;
    stockBalance: number;
    quantity: number;
    shipsTo: string[];
    slas: ShippingOption[];
    deliveryChannels: Array<{
      id: string;
      stockBalance: number;
    }>;
  }>;
}

export class VtexService {
  private client: AxiosInstance;
  private config: VtexConfig;

  constructor(config: VtexConfig) {
    this.config = config;
    
    this.client = axios.create({
      baseURL: `https://${config.accountName}.${config.environment}.com.br`,
      headers: {
        'X-VTEX-API-AppKey': config.appKey,
        'X-VTEX-API-AppToken': config.appToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 10000, // 10 segundos de timeout
    });

    // Interceptor para logs de debug (opcional)
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🚀 VTEX API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ VTEX API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ VTEX API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('❌ VTEX API Response Error:', error.response?.status, error.response?.data);
        return Promise.reject(error);
      }
    );
  }

  // ==================== MÉTODOS DE PRODUCTOS ====================

  /**
   * Obtiene un producto por su ID
   */
  async obtenerProducto(productId: number): Promise<VtexProduct> {
    try {
      const response = await this.client.get(
        `/api/catalog_system/pvt/products/ProductGet/${productId}`
      );
      return response.data;
    } catch (error) {
      throw new Error(`Error al obtener producto ${productId}: ${error}`);
    }
  }

  /**
   * Obtiene múltiples productos por categoría
   */
  async obtenerProductosPorCategoria(categoryId: number): Promise<{ products: number[], skus: number[] }> {
    try {
      const response = await this.client.get(
        `/api/catalog_system/pvt/products/GetProductAndSkuIds`,
        {
          params: { categoryId }
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Error al obtener productos de categoría ${categoryId}: ${error}`);
    }
  }

  /**
   * Busca productos por término de búsqueda
   */
  async buscarProductos(termino: string, generoID: string, desde: number = 0, hasta: number = 50): Promise<any[]> {
    try {
      // Codificar el término de búsqueda para caracteres especiales
      const terminoCodificado = encodeURIComponent(termino);
      
      const response = await this.client.get(
        `/api/catalog_system/pub/products/search`,
        {
          params: { 
            ft: terminoCodificado, // Usar el término codificado
            _from: desde,
            _to: hasta,
            fq:`C:${generoID}` // 1 hombre y 10 mujer como string
          }
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Error al buscar productos "${termino}": ${error}`);
    }
  }

  /**
   * Obtiene información detallada de un SKU
   */
  async obtenerSku(skuId: number): Promise<VtexSku> {
    try {
      const response = await this.client.get(
        `/api/catalog_system/pvt/sku/stockkeepingunitbyid/${skuId}`
      );
      return response.data;
    } catch (error) {
      throw new Error(`Error al obtener SKU ${skuId}: ${error}`);
    }
  }

  // ==================== MÉTODOS DE PRECIOS ====================

  /**
   * Obtiene el precio de un SKU
   */
  async obtenerPrecio(skuId: number): Promise<VtexPrice> {
    try {
      const response = await this.client.get(
        `/api/pricing/prices/${skuId}`
      );
      return response.data;
    } catch (error) {
      throw new Error(`Error al obtener precio del SKU ${skuId}: ${error}`);
    }
  }

  /**
   * Obtiene el precio computado de un SKU (con descuentos y promociones aplicadas)
   */
  async obtenerPrecioComputado(
    skuId: number, 
    tradePolicyId: string = '1'
  ): Promise<any> {
    try {
      const response = await this.client.get(
        `/api/pricing/prices/${skuId}/computed/${tradePolicyId}`
      );
      return response.data;
    } catch (error) {
      throw new Error(`Error al obtener precio computado del SKU ${skuId}: ${error}`);
    }
  }

  /**
   * Obtiene precios de múltiples SKUs
   */
  async obtenerPreciosMultiples(skuIds: number[]): Promise<VtexPrice[]> {
    try {
      const promesas = skuIds.map(skuId => this.obtenerPrecio(skuId));
      const resultados = await Promise.allSettled(promesas);
      
      return resultados
        .filter((resultado): resultado is PromiseFulfilledResult<VtexPrice> => 
          resultado.status === 'fulfilled'
        )
        .map(resultado => resultado.value);
    } catch (error) {
      throw new Error(`Error al obtener precios múltiples: ${error}`);
    }
  }

  // ==================== MÉTODOS DE DISPONIBILIDAD/INVENTARIO ====================

  /**
   * Obtiene la disponibilidad de un SKU en un almacén específico
   */
  async obtenerDisponibilidad(
    skuId: number, 
    warehouseId: string
  ): Promise<VtexInventory> {
    try {
      const response = await this.client.get(
        `/api/logistics/pvt/inventory/skus/${skuId}/warehouses/${warehouseId}`
      );
      return {
        skuId: skuId.toString(),
        warehouseId,
        warehouseName: response.data.warehouseName || '',
        totalQuantity: response.data.totalQuantity || 0,
        reservedQuantity: response.data.reservedQuantity || 0,
        availableQuantity: response.data.availableQuantity || 0,
        unlimitedQuantity: response.data.unlimitedQuantity || false,
      };
    } catch (error) {
      throw new Error(`Error al obtener disponibilidad del SKU ${skuId} en almacén ${warehouseId}: ${error}`);
    }
  }

  /**
   * Obtiene la disponibilidad de un SKU en todos los almacenes
   */
  async obtenerDisponibilidadTotal(skuId: number): Promise<VtexInventory[]> {
    try {
      const response = await this.client.get(
        `/api/logistics/pvt/inventory/skus/${skuId}`
      );
      
      if (!response.data.balance) {
        return [];
      }

      return response.data.balance.map((balance: any) => ({
        skuId: skuId.toString(),
        warehouseId: balance.warehouseId,
        warehouseName: balance.warehouseName || '',
        totalQuantity: balance.totalQuantity || 0,
        reservedQuantity: balance.reservedQuantity || 0,
        availableQuantity: balance.availableQuantity || 0,
        unlimitedQuantity: balance.unlimitedQuantity || false,
      }));
    } catch (error) {
      throw new Error(`Error al obtener disponibilidad total del SKU ${skuId}: ${error}`);
    }
  }

  /**
   * Verifica si un SKU está disponible (tiene stock)
   */
  async estaDisponible(skuId: number): Promise<boolean> {
    try {
      const disponibilidades = await this.obtenerDisponibilidadTotal(skuId);
      return disponibilidades.some(
        disp => disp.unlimitedQuantity || disp.availableQuantity > 0
      );
    } catch (error) {
      console.warn(`Error al verificar disponibilidad del SKU ${skuId}: ${error}`);
      return false;
    }
  }

  // ==================== MÉTODOS DE TARIFAS DE ENVÍO ====================

  /**
   * Calcula las tarifas de envío para una dirección y items específicos
   */
  async calcularTarifasEnvio(
    postalcode: string,
    items: ShippingItem[],
  ): Promise<ShippingResponse> {
    try {
      // Construir el payload para la simulación de envío
      const payload = {
        postalCode: postalcode,
        country: 'COL',
        items: items.map((item, index) => ({
          id: item.id,
          quantity: parseInt(item.quantity.toString()),
          seller: '1',
          deliveryChannel: 'delivery'
        }))
      };

      const response = await this.client.post(
        `/api/checkout/pub/orderforms/simulation`,
        payload
      );

      return response.data;
    } catch (error) {
      throw new Error(`Error al calcular tarifas de envío: ${error}`);
    }
  }

  // /**
  //  * Obtiene las opciones de envío más baratas y más rápidas
  //  */
  // async obtenerMejoresOpcionesEnvio(
  //   direccion: ShippingAddress,
  //   items: ShippingItem[]
  // ): Promise<{ masBarata: ShippingOption | null, masRapida: ShippingOption | null }> {
  //   try {
  //     const respuestaEnvio = await this.calcularTarifasEnvio(direccion, items);
      
  //     let todasOpciones: ShippingOption[] = [];
      
  //     respuestaEnvio.logisticsInfo.forEach(logInfo => {
  //       todasOpciones = todasOpciones.concat(logInfo.slas);
  //     });

  //     if (todasOpciones.length === 0) {
  //       return { masBarata: null, masRapida: null };
  //     }

  //     // Encontrar la opción más barata
  //     const masBarata = todasOpciones.reduce((menor, actual) => 
  //       actual.price < menor.price ? actual : menor
  //     );

  //     // Encontrar la opción más rápida (asumiendo formato "Xbd" para días hábiles)
  //     const masRapida = todasOpciones.reduce((rapida, actual) => {
  //       const diasActual = this.extraerDiasEnvio(actual.estimate);
  //       const diasRapida = this.extraerDiasEnvio(rapida.estimate);
  //       return diasActual < diasRapida ? actual : rapida;
  //     });

  //     return { masBarata, masRapida };
  //   } catch (error) {
  //     throw new Error(`Error al obtener mejores opciones de envío: ${error}`);
  //   }
  // }

  // ==================== MÉTODOS AUXILIARES ====================

  /**
   * Extrae el número de días de una estimación de envío (ej: "2bd" -> 2)
   */
  private extraerDiasEnvio(estimate: string): number {
    const match = estimate.match(/(\d+)/);
    return match ? parseInt(match[1]) : 999;
  }

  /**
   * Obtiene información completa de un producto incluyendo precios y disponibilidad
   */
  async obtenerInformacionCompleta(
    productId: number,
    incluirPrecios: boolean = true,
    incluirDisponibilidad: boolean = true
  ): Promise<any> {
    try {
      const producto = await this.obtenerProducto(productId);
      const resultado: any = { producto };

      if (incluirPrecios) {
        // Aquí necesitarías obtener los SKUs del producto primero
        // Para simplificar, asumimos que conoces el SKU ID
        // En un caso real, necesitarías hacer una consulta adicional
      }

      if (incluirDisponibilidad) {
        // Similar al caso de precios
      }

      return resultado;
    } catch (error) {
      throw new Error(`Error al obtener información completa del producto ${productId}: ${error}`);
    }
  }

  /**
   * Convierte precios de centavos a unidades monetarias
   */
  static centavosAUnidades(centavos: number): number {
    return centavos / 100;
  }

  /**
   * Convierte unidades monetarias a centavos
   */
  static unidadesACentavos(unidades: number): number {
    return Math.round(unidades * 100);
  }
}

// Ejemplo de uso:
/*
const vtexService = new VtexService({
  accountName: 'tuaccount',
  environment: 'vtexcommercestable', // o 'myvtex'
  appKey: 'tu-app-key',
  appToken: 'tu-app-token'
});

// Obtener producto
const producto = await vtexService.obtenerProducto(123);

// Obtener precio
const precio = await vtexService.obtenerPrecio(456);

// Verificar disponibilidad
const disponible = await vtexService.estaDisponible(456);

// Calcular envío
const opciones = await vtexService.obtenerMejoresOpcionesEnvio(
  { postalCode: '01310-100', country: 'BRA' },
  [{ id: '456', quantity: 1, price: 2990 }]
);
*/
