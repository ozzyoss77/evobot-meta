/**
 * Importación de librerías y tipos necesarios
 */
import { createClient } from "next-sanity";

/**
 * Inicializar el cliente de Sanity
 *
 * Este cliente permite hacer consultas a la API de Sanity.
 * Los valores de configuración deben provenir de variables de entorno.
 */
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-04-02"; // Puedes usar la fecha de hoy.

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
});