/**
 * 1. Consulta para obtener todos los tipos de propiedad visibles
 *
 * Esta consulta devuelve todos los tipos de inmuebles (como casa, departamento, etc.)
 * que tienen la propiedad 'visible' establecida en true, ordenados alfabéticamente.
 */
export const allPropertyTypesQuery = `
  *[_type == "propertyType" && visible == true] {
    _id,
    title
  } | order(title asc)
`;

/**
 * 2. Consulta para obtener todos los tipos de operación visibles
 *
 * Esta consulta devuelve todos los tipos de operación (como venta, alquiler, etc.)
 * que tienen la propiedad 'visible' establecida en true, ordenados alfabéticamente.
 */
export const allListingTypesQuery = `
  *[_type == "listingType" && visible == true] {
    _id,
    title
  } | order(title asc)
`;

/**
 * 3. Consulta para obtener todos los distritos visibles
 *
 * Esta consulta devuelve todos los distritos que tienen la propiedad 'visible'
 * establecida en true, incluyendo su descripción y URL de imagen, ordenados alfabéticamente.
 * El campo "imageUrl" es una proyección que obtiene la URL directa de la imagen.
 */
export const allDistrictsQuery = `
  *[_type == "district" && visible == true] {
    _id,
    title,
    description,
    "imageUrl": image.asset->url
  } | order(title asc)
`;

/**
 * 4. Consulta para obtener un inmueble por su slug con todas las relaciones expandidas
 *
 * Esta consulta devuelve un inmueble específico basado en su slug (URL amigable),
 * y expande todas las referencias relacionadas (tipo de operación, tipo de propiedad, distrito, preguntas).
 * También proyecta las URLs de video y PDF directamente para facilitar su uso en el frontend.
 *
 * @param {string} $slug - El slug del inmueble a buscar
 */
export const propertyBySlugQuery = `
  *[_type == "property" && slug == $slug][0] {
    _id,
    title,
    slug,
    visible,
    description,
    "listingType": listingType->title,
    "propertyType": propertyType->title,
    "district": district->{
      _id,
      title,
      description,
      "imageUrl": image.asset->url
    },
    price,
    details,
    apartmentType,
    age,
    exclusives,
    location,
    characteristics,
    "videoUrl": video.asset->playbackId,
    videoThumbTimestamp,
    "pdfUrl": pdf.asset->url,
    "questions": questionnaire.questions[]->{ 
      _id, 
      question,
      answers
    },
    crm
  }
`;

/**
 * 5. Consulta para obtener todos los inmuebles visibles con información básica
 *
 * Esta consulta devuelve una lista de todos los inmuebles visibles con información básica
 * suficiente para mostrar en una lista o grid. Referencias como tipo de operación, tipo de
 * propiedad y distrito son expandidas solo hasta el título para reducir el tamaño de los datos.
 * Los resultados están ordenados del más reciente al más antiguo.
 */
export const allPropertiesBasicQuery = `
  *[_type == "property" && visible == true] {
    _id,
    title,
    slug,
    "listingType": listingType->title,
    "propertyType": propertyType->title,
    "district": district->title,
    price,
    details,
    "imageUrl": images.asset->url
  } | order(_createdAt desc)
`;

/**
 * 6. Consulta para filtrar inmuebles por múltiples criterios
 *
 * Esta consulta permite filtrar inmuebles basados en múltiples criterios como:
 * - Tipo de operación (venta, alquiler)
 * - Tipo de propiedad (casa, departamento)
 * - Distrito/ubicación
 * - Rango de precios (en USD)
 * - Número de dormitorios y baños
 * - Rango de área construida
 *
 * También permite ordenar los resultados y paginarlos estableciendo índices de inicio y fin.
 *
 * @param {Object} props - Objeto con los parámetros de filtrado
 * @param {string} [props.listingTypeId] - ID del tipo de operación
 * @param {string} [props.propertyTypeId] - ID del tipo de propiedad
 * @param {string} [props.districtId] - ID del distrito
 * @param {number} [props.minPrice] - Precio mínimo en USD
 * @param {number} [props.maxPrice] - Precio máximo en USD
 * @param {number} [props.bedrooms] - Número mínimo de dormitorios
 * @param {number} [props.bathrooms] - Número mínimo de baños
 * @param {number} [props.minArea] - Área construida mínima en m²
 * @param {number} [props.maxArea] - Área construida máxima en m²
 * @param {string} [props.orderBy='_createdAt'] - Campo por el cual ordenar
 * @param {string} [props.order='desc'] - Dirección de ordenamiento ('asc' o 'desc')
 * @param {number} [props.start=0] - Índice de inicio para paginación
 * @param {number} [props.end=10] - Índice de fin para paginación
 */
export const filteredPropertiesQuery = `
  *[_type == "property" && visible == true
    ${/* Filtrar por tipo de operación */ ""}
    ${(props) =>
      props.listingTypeId
        ? `&& listingType._ref == "${props.listingTypeId}"`
        : ""}
    
    ${/* Filtrar por tipo de propiedad */ ""}
    ${(props) =>
      props.propertyTypeId
        ? `&& propertyType._ref == "${props.propertyTypeId}"`
        : ""}
    
    ${/* Filtrar por distrito */ ""}
    ${(props) =>
      props.districtId ? `&& district._ref == "${props.districtId}"` : ""}
    
    ${/* Filtrar por rango de precios en USD */ ""}
    ${(props) => (props.minPrice ? `&& price.USD >= ${props.minPrice}` : "")}
    ${(props) => (props.maxPrice ? `&& price.USD <= ${props.maxPrice}` : "")}
    
    ${/* Filtrar por número de dormitorios */ ""}
    ${(props) =>
      props.bedrooms ? `&& details.bedrooms >= ${props.bedrooms}` : ""}
    
    ${/* Filtrar por número de baños */ ""}
    ${(props) =>
      props.bathrooms ? `&& details.bathrooms >= ${props.bathrooms}` : ""}
    
    ${/* Filtrar por área construida */ ""}
    ${(props) =>
      props.minArea ? `&& details.areaBuilt >= ${props.minArea}` : ""}
    ${(props) =>
      props.maxArea ? `&& details.areaBuilt <= ${props.maxArea}` : ""}
  ] {
    _id,
    title,
    slug,
    "listingType": listingType->title,
    "propertyType": propertyType->title,
    "district": district->title,
    price,
    details,
    "imageUrl": images.asset->url
  } | order(${(props) => props.orderBy || "_createdAt"} ${(props) =>
  props.order || "desc"})
  [${(props) => props.start || 0}...${(props) => props.end || 10}]
`;

/**
 * 7. Consulta para obtener inmuebles por características específicas
 *
 * Esta consulta permite filtrar inmuebles basados en características como:
 * - Si acepta mascotas (petFriendly)
 * - Si es compatible con AirBnB (airbnbFriendly)
 * - Amenidades específicas (piscina, gimnasio, etc.)
 * - Servicios específicos (aire acondicionado, calefacción, etc.)
 *
 * La consulta usa la función `count()` para verificar si alguno de los elementos
 * en los arrays de amenidades y servicios coincide con los valores buscados.
 *
 * @param {Object} props - Objeto con los parámetros de filtrado
 * @param {boolean} [props.petFriendly] - Filtrar por propiedades que acepten mascotas
 * @param {boolean} [props.airbnbFriendly] - Filtrar por propiedades compatibles con AirBnB
 * @param {string[]} [props.amenities] - Lista de amenidades para filtrar
 * @param {string[]} [props.services] - Lista de servicios para filtrar
 */
export const propertiesByCharacteristicsQuery = `
  *[_type == "property" && visible == true
    ${/* Filtrar por aceptación de mascotas */ ""}
    ${(props) =>
      props.petFriendly ? `&& characteristics.petFriendly == true` : ""}
    
    ${/* Filtrar por compatibilidad con AirBnB */ ""}
    ${(props) =>
      props.airbnbFriendly ? `&& characteristics.airbnbFriendly == true` : ""}
    
    ${/* Filtrar por amenidades */ ""}
    ${(props) =>
      props.amenities
        ? `&& count((characteristics.amenities[])[@ in ${JSON.stringify(
            props.amenities
          )}]) > 0`
        : ""}
    
    ${/* Filtrar por servicios */ ""}
    ${(props) =>
      props.services
        ? `&& count((characteristics.services[])[@ in ${JSON.stringify(
            props.services
          )}]) > 0`
        : ""}
  ] {
    _id,
    title,
    slug,
    "listingType": listingType->title,
    "propertyType": propertyType->title,
    "district": district->title,
    price,
    details,
    characteristics,
    "imageUrl": images.asset->url
  } | order(_createdAt desc)
`;

/**
 * 8. Consulta para obtener inmuebles en un área geográfica específica
 *
 * Esta consulta permite buscar inmuebles dentro de un cuadro delimitador geográfico
 * definido por coordenadas mínimas y máximas de latitud y longitud.
 * Es útil para implementar búsquedas basadas en mapas donde el usuario puede
 * seleccionar un área de interés.
 *
 * @param {number} $minLat - Latitud mínima del área de búsqueda
 * @param {number} $maxLat - Latitud máxima del área de búsqueda
 * @param {number} $minLng - Longitud mínima del área de búsqueda
 * @param {number} $maxLng - Longitud máxima del área de búsqueda
 */
export const propertiesByGeoLocationQuery = `
  *[_type == "property" && visible == true && 
    location.lngLat.lat >= $minLat && 
    location.lngLat.lat <= $maxLat && 
    location.lngLat.lng >= $minLng && 
    location.lngLat.lng <= $maxLng
  ] {
    _id,
    title,
    slug,
    "listingType": listingType->title,
    "propertyType": propertyType->title,
    "district": district->title,
    location,
    price,
    details,
    "imageUrl": images.asset->url
  }
`;

/**
 * 9. Consulta para contar inmuebles por distrito
 *
 * Esta consulta devuelve una lista de todos los distritos visibles junto con
 * el número de inmuebles visibles en cada distrito. Es útil para construir
 * filtros de navegación mostrando la cantidad de resultados por distrito.
 */
export const propertiesCountByDistrictQuery = `
  {
    "districts": *[_type == "district" && visible == true] {
      _id,
      title,
      "count": count(*[_type == "property" && visible == true && district._ref == ^._id])
    }
  }
`;

/**
 * 10. Consulta para obtener inmuebles similares
 *
 * Esta consulta busca inmuebles que tengan el mismo distrito y tipo de propiedad
 * que un inmueble específico, excluyendo el inmueble actual. Es útil para
 * mostrar recomendaciones de "propiedades similares" en la página de detalles
 * de un inmueble.
 *
 * @param {string} $currentPropertyId - ID del inmueble actual (para excluirlo)
 * @param {string} $districtId - ID del distrito a coincidir
 * @param {string} $propertyTypeId - ID del tipo de propiedad a coincidir
 */
export const similarPropertiesQuery = `
  *[_type == "property" 
    && visible == true 
    && _id != $currentPropertyId
    && district._ref == $districtId
    && propertyType._ref == $propertyTypeId
  ] {
    _id,
    title,
    slug,
    "listingType": listingType->title,
    "propertyType": propertyType->title,
    "district": district->title,
    price,
    details,
    "imageUrl": images.asset->url
  }[0...4]
`;

/**
 * 11. Consulta para obtener inmuebles destacados
 *
 * Esta consulta obtiene los inmuebles más recientes para mostrarlos como "destacados"
 * en la página principal. Se limita a 6 resultados.
 *
 * Nota: Se podría modificar para usar un campo específico de "destacado" si
 * se agrega al esquema en lugar de simplemente mostrar los más recientes.
 */
export const featuredPropertiesQuery = `
  *[_type == "property" && visible == true] {
    _id,
    title,
    slug,
    "listingType": listingType->title,
    "propertyType": propertyType->title,
    "district": district->title,
    price,
    details,
    "imageUrl": images.asset->url
  } | order(_createdAt desc)[0...6]
`;

/**
 * 12. Consulta para buscar inmuebles por texto
 *
 * Esta consulta permite realizar búsquedas de texto en varios campos del inmueble,
 * incluyendo el título, la descripción, el nombre del distrito, y el valor CRM.
 * El operador 'match' permite realizar búsquedas flexibles que manejan variaciones
 * en el texto.
 *
 * @param {string} $searchQuery - Texto de búsqueda (generalmente se usa con comodines, ej: "*texto*")
 */
export const searchPropertiesQuery = `
  *[_type == "property" && visible == true && (
    title match $searchQuery ||
    description match $searchQuery ||
    district->title match $searchQuery ||
    crm match $searchQuery
  )] {
    _id,
    title,
    slug,
    "listingType": listingType->title,
    "propertyType": propertyType->title,
    "district": district->title,
    price,
    details,
    "imageUrl": images.asset->url
  }
`;