/**
 * Importación de librerías y tipos necesarios
 */
import { client } from "src/Connections/gcn/client-gcn";
import {
  allPropertiesBasicQuery,
  propertyBySlugQuery,
  filteredPropertiesQuery,
  propertiesByCharacteristicsQuery,
  propertiesByGeoLocationQuery,
  similarPropertiesQuery,
  searchPropertiesQuery,
} from "src/Connections/gcn/queries";
import type { Property, PropertyWithReferences } from "src/Connections/gcn/types";

/**
 * Ejemplo 1: Obtener un inmueble por su slug
 *
 * Esta función busca un inmueble específico usando su slug (URL amigable)
 * y devuelve todos sus detalles, incluyendo las referencias expandidas.
 *
 * @param {string} slug - El slug del inmueble a buscar
 * @returns {Promise<PropertyWithReferences | null>} - Promesa con el inmueble o null si no se encuentra
 */
export async function getPropertyBySlug(
  slug: string
): Promise<PropertyWithReferences | null> {
  return client.fetch(propertyBySlugQuery, { slug });
}

/**
 * Ejemplo 2: Obtener todos los inmuebles con información básica
 *
 * Esta función devuelve una lista de todos los inmuebles visibles
 * con información básica suficiente para mostrar en listados.
 *
 * @returns {Promise<Property[]>} - Promesa con la lista de inmuebles
 */
export async function getAllProperties(): Promise<Property[]> {
  return client.fetch(allPropertiesBasicQuery);
}

/**
 * Ejemplo 3: Obtener inmuebles filtrados
 *
 * Esta función permite filtrar inmuebles por múltiples criterios como
 * tipo de operación, tipo de propiedad, distrito, rango de precios,
 * número de dormitorios y baños, y área construida.
 * También permite paginación y ordenamiento personalizado.
 *
 * @param {Object} params - Parámetros de filtrado
 * @param {string} [params.listingTypeId] - ID del tipo de operación
 * @param {string} [params.propertyTypeId] - ID del tipo de propiedad
 * @param {string} [params.districtId] - ID del distrito
 * @param {number} [params.minPrice] - Precio mínimo en USD
 * @param {number} [params.maxPrice] - Precio máximo en USD
 * @param {number} [params.bedrooms] - Número mínimo de dormitorios
 * @param {number} [params.bathrooms] - Número mínimo de baños
 * @param {number} [params.minArea] - Área construida mínima en m²
 * @param {number} [params.maxArea] - Área construida máxima en m²
 * @param {number} [params.start=0] - Índice de inicio para paginación
 * @param {number} [params.end=10] - Índice de fin para paginación
 * @param {string} [params.orderBy='_createdAt'] - Campo por el cual ordenar
 * @param {string} [params.order='desc'] - Dirección de ordenamiento ('asc' o 'desc')
 * @returns {Promise<Property[]>} - Promesa con la lista de inmuebles filtrados
 */
export async function getFilteredProperties({
  listingTypeId,
  propertyTypeId,
  districtId,
  minPrice,
  maxPrice,
  bedrooms,
  bathrooms,
  minArea,
  maxArea,
  start = 0,
  end = 10,
  orderBy = "_createdAt",
  order = "desc",
}: {
  listingTypeId?: string;
  propertyTypeId?: string;
  districtId?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  minArea?: number;
  maxArea?: number;
  start?: number;
  end?: number;
  orderBy?: string;
  order?: "asc" | "desc";
}): Promise<Property[]> {
  const query = filteredPropertiesQuery.replace(/\${\(props\) => props\.(\w+)(?:\s*\|\|\s*[^}]+)?}/g, (_, key) => {
    return String({
      listingTypeId,
      propertyTypeId,
      districtId,
      minPrice,
      maxPrice,
      bedrooms,
      bathrooms,
      minArea,
      maxArea,
      start,
      end,
      orderBy,
      order
    }[key] || '');
  });

  return client.fetch(query, {
    listingTypeId,
    propertyTypeId,
    districtId,
    minPrice,
    maxPrice,
    bedrooms,
    bathrooms,
    minArea,
    maxArea,
    start,
    end,
    orderBy,
    order
  });
}

/**
 * Ejemplo 4: Obtener inmuebles por características
 *
 * Esta función permite filtrar inmuebles por características específicas
 * como si aceptan mascotas, si son compatibles con AirBnB, y por amenidades
 * y servicios específicos.
 *
 * @param {Object} params - Parámetros de filtrado
 * @param {boolean} [params.petFriendly] - Filtrar por aceptación de mascotas
 * @param {boolean} [params.airbnbFriendly] - Filtrar por compatibilidad con AirBnB
 * @param {string[]} [params.amenities] - Lista de amenidades para filtrar
 * @param {string[]} [params.services] - Lista de servicios para filtrar
 * @returns {Promise<Property[]>} - Promesa con la lista de inmuebles filtrados
 */
export async function getPropertiesByCharacteristics({
  petFriendly,
  airbnbFriendly,
  amenities,
  services,
}: {
  petFriendly?: boolean;
  airbnbFriendly?: boolean;
  amenities?: string[];
  services?: string[];
}): Promise<Property[]> {
  const query = propertiesByCharacteristicsQuery.replace(/\${\(props\) => props\.(\w+)(?:\s*\|\|\s*[^}]+)?}/g, (_, key) => {
    return String({
      petFriendly,
      airbnbFriendly,
      amenities,
      services
    }[key] || '');
  });

  return client.fetch(query, {
    petFriendly,
    airbnbFriendly,
    amenities,
    services
  });
}

/**
 * Ejemplo 5: Obtener inmuebles por ubicación geográfica
 *
 * Esta función permite buscar inmuebles dentro de un cuadro delimitador
 * geográfico definido por coordenadas mínimas y máximas de latitud y longitud.
 *
 * @param {Object} params - Parámetros de búsqueda geográfica
 * @param {number} params.minLat - Latitud mínima del área de búsqueda
 * @param {number} params.maxLat - Latitud máxima del área de búsqueda
 * @param {number} params.minLng - Longitud mínima del área de búsqueda
 * @param {number} params.maxLng - Longitud máxima del área de búsqueda
 * @returns {Promise<Property[]>} - Promesa con la lista de inmuebles en el área
 */
export async function getPropertiesByGeoLocation({
  minLat,
  maxLat,
  minLng,
  maxLng,
}: {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}): Promise<Property[]> {
  return client.fetch(propertiesByGeoLocationQuery, {
    minLat,
    maxLat,
    minLng,
    maxLng,
  });
}

/**
 * Ejemplo 6: Obtener inmuebles similares
 *
 * Esta función busca inmuebles que tienen el mismo distrito y tipo de propiedad
 * que un inmueble específico, excluyendo el inmueble actual. Es útil para
 * mostrar recomendaciones de "propiedades similares" en la página de detalles.
 *
 * @param {Object} params - Parámetros para buscar propiedades similares
 * @param {string} params.currentPropertyId - ID del inmueble actual (para excluirlo)
 * @param {string} params.districtId - ID del distrito a coincidir
 * @param {string} params.propertyTypeId - ID del tipo de propiedad a coincidir
 * @returns {Promise<Property[]>} - Promesa con la lista de inmuebles similares
 */
export async function getSimilarProperties({
  currentPropertyId,
  districtId,
  propertyTypeId,
}: {
  currentPropertyId: string;
  districtId: string;
  propertyTypeId: string;
}): Promise<Property[]> {
  return client.fetch(similarPropertiesQuery, {
    currentPropertyId,
    districtId,
    propertyTypeId,
  });
}

/**
 * Ejemplo 7: Buscar inmuebles por texto
 *
 * Esta función permite realizar búsquedas de texto en varios campos del inmueble,
 * incluyendo el título, la descripción, el nombre del distrito, y el valor CRM.
 *
 * @param {string} searchQuery - Texto de búsqueda
 * @returns {Promise<Property[]>} - Promesa con la lista de inmuebles que coinciden con la búsqueda
 */
export async function searchProperties(
  searchQuery: string
): Promise<Property[]> {
  return client.fetch(searchPropertiesQuery, {
    searchQuery: `*${searchQuery}*`, // Agregar comodines para coincidencia parcial
  });
}