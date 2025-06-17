/**
 * Interfaz para el tipo de propiedad
 * Esta interfaz representa los diferentes tipos de inmuebles (como casa, departamento, etc.)
 * que se pueden crear en el CMS Sanity.
 */
export interface PropertyType {
    _id: string; // ID único generado por Sanity
    _type: "propertyType"; // Tipo de documento en Sanity
    visible: boolean; // Indica si el tipo de propiedad debe mostrarse en el sitio
    title: string; // Título del tipo de propiedad
  }
  
  /**
   * Interfaz para el tipo de operación
   * Esta interfaz representa los diferentes tipos de operaciones (como venta, alquiler, etc.)
   * que se pueden tener para un inmueble en el CMS Sanity.
   */
  export interface ListingType {
    _id: string; // ID único generado por Sanity
    _type: "listingType"; // Tipo de documento en Sanity
    visible: boolean; // Indica si el tipo de operación debe mostrarse en el sitio
    title: string; // Título del tipo de operación
  }
  
  /**
   * Interfaz para el distrito
   * Esta interfaz representa los distritos o zonas geográficas
   * donde pueden estar ubicados los inmuebles en el CMS Sanity.
   */
  export interface District {
    _id: string; // ID único generado por Sanity
    _type: "district"; // Tipo de documento en Sanity
    visible: boolean; // Indica si el distrito debe mostrarse en el sitio
    title: string; // Nombre del distrito
    description?: string; // Descripción opcional del distrito
    image?: {
      // Imagen opcional del distrito
      _type: "image"; // Tipo de campo en Sanity
      asset: {
        // Referencia al asset de la imagen
        _ref: string; // Referencia al ID del asset
        _type: "reference"; // Tipo de referencia
      };
    };
  }
  
  /**
   * Interfaz principal para una propiedad/inmueble
   * Esta interfaz representa la estructura completa de un inmueble en el CMS Sanity,
   * incluyendo todos sus campos, referencias y datos anidados.
   */
  export interface Property {
    _id: string; // ID único generado por Sanity
    _type: "property"; // Tipo de documento en Sanity
    visible: boolean; // Indica si el inmueble debe mostrarse en el sitio
    title: string; // Título del inmueble
    slug: string; // URL amigable para el inmueble
  
    // Referencia al tipo de operación (venta, alquiler, etc.)
    listingType: {
      _ref: string; // ID del tipo de operación referenciado
      _type: "reference"; // Tipo de campo en Sanity
    };
  
    // Referencia al tipo de propiedad (casa, departamento, etc.)
    propertyType: {
      _ref: string; // ID del tipo de propiedad referenciado
      _type: "reference"; // Tipo de campo en Sanity
    };
  
    // Referencias a las etiquetas de imágenes sin iconos
    images: {
      _ref: string; // ID de la etiqueta de imágenes
      _type: "reference"; // Tipo de campo en Sanity
    };
  
    // Referencias a las etiquetas de imágenes con iconos
    imagesWithIcons: {
      _ref: string; // ID de la etiqueta de imágenes con iconos
      _type: "reference"; // Tipo de campo en Sanity
    };
  
    description?: string; // Descripción opcional del inmueble
  
    // Referencia al distrito donde se encuentra el inmueble
    district: {
      _ref: string; // ID del distrito referenciado
      _type: "reference"; // Tipo de campo en Sanity
    };
  
    // Información de precios en diferentes monedas
    price: {
      PEN: number; // Precio en soles peruanos
      USD: number; // Precio en dólares estadounidenses
      hoaPEN?: number; // Valor de mantenimiento en soles (opcional)
      hoaUSD?: number; // Valor de mantenimiento en dólares (opcional)
    };
  
    // Detalles específicos del inmueble
    details: {
      bedrooms?: number; // Número de dormitorios (opcional)
      bathrooms?: number; // Número de baños (opcional)
      parking?: number; // Número de estacionamientos (opcional)
      parkingLocation?: string; // Ubicación del estacionamiento (opcional)
      areaBuilt: number; // Área construida en metros cuadrados
      areaPrivate?: number; // Área libre en metros cuadrados (opcional)
      levels?: number; // Número de pisos interiores (opcional)
      floor?: number; // Número del piso (para departamentos, opcional)
      apartmentsPerFloor?: number; // Número de departamentos por piso (opcional)
    };
  
    // Tipo de departamento (solo para tipo de inmueble "Departamento")
    apartmentType?: string[]; // Array de tipos (Flat, Penthouse, Dúplex, etc.)
  
    // Información sobre la antigüedad del inmueble
    age?: {
      brandNew?: boolean; // Indica si es a estrenar
      yearBuilt?: number; // Año de construcción
      inConstruction?: boolean; // Indica si está en construcción
      deliveryDate?: string; // Fecha de entrega estimada
      renovationDate?: string; // Fecha de última remodelación
    };
  
    exclusives?: string[]; // Características exclusivas del inmueble
  
    // Ubicación geográfica detallada
    location: {
      address: string; // Dirección del inmueble
      communityBuildingName?: string; // Nombre del edificio o urbanización (opcional)
      reference?: string; // Punto de referencia (opcional)
      lngLat: {
        // Coordenadas geográficas
        _type: "geopoint"; // Tipo de campo en Sanity
        lat: number; // Latitud
        lng: number; // Longitud
      };
    };
  
    // Características específicas del inmueble
    characteristics?: {
      petFriendly?: boolean; // Indica si acepta mascotas
      airbnbFriendly?: boolean; // Indica si permite alquileres temporales
      tipoDeVista?: string[]; // Tipos de vista (al mar, a la ciudad, etc.)
      interior?: string[]; // Características interiores
      exterior?: string[]; // Características exteriores
      amenities?: string[]; // Zonas comunes
      services?: string[]; // Servicios incluidos
      general?: string[]; // Características generales
      sector?: string[]; // Características del sector/zona
    };
  
    // Video del inmueble
    video: {
      _type: "mux.video"; // Tipo de campo en Sanity (video procesado por Mux)
      asset: {
        _ref: string; // Referencia al asset del video
        _type: "reference"; // Tipo de referencia
      };
    };
  
    videoThumbTimestamp?: number; // Marca de tiempo para la miniatura del video
  
    // PDF opcional del inmueble
    pdf?: {
      _type: "file"; // Tipo de campo en Sanity
      asset: {
        _ref: string; // Referencia al asset del archivo
        _type: "reference"; // Tipo de referencia
      };
    };
  
    // Cuestionario con preguntas referenciadas
    questionnaire: {
      questions: Array<{
        _ref: string; // ID de la pregunta referenciada
        _type: "reference"; // Tipo de referencia
      }>;
    };
  
    crm: string; // Etiqueta para integración con CRM (Monday.com)
  }
  
  /**
   * Interfaz para las preguntas del cuestionario
   * Esta interfaz representa las preguntas que pueden ser asociadas
   * a un inmueble como parte de su cuestionario.
   */
  export interface Question {
    _id: string; // ID único generado por Sanity
    _type: "questions"; // Tipo de documento en Sanity
    question: string; // Texto de la pregunta
    answers?: string[]; // Posibles respuestas (opcional)
  }
  
  /**
   * Interfaz extendida para propiedades con referencias expandidas
   * Esta versión de la interfaz Property incluye los objetos completos referenciados
   * en lugar de solo sus referencias, útil para mostrar datos completos en la UI.
   */
  export interface PropertyWithReferences
    extends Omit<
      Property,
      "listingType" | "propertyType" | "district" | "questionnaire"
    > {
    listingType: ListingType; // Objeto completo del tipo de operación
    propertyType: PropertyType; // Objeto completo del tipo de propiedad
    district: District; // Objeto completo del distrito
    questionnaire: {
      questions: Question[]; // Array de objetos completos de preguntas
    };
  }