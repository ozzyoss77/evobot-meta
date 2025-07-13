import chatwootService from "src/Connections/chatwoot.class";
import Logger from "src/Utils/logger";
import appwriteService from "src/Connections/appwrite";
import { newAIResponse } from "src/AIApi/api-llm";
import "dotenv/config";

const logger = new Logger();

function replaceVariables(text: string, variables: { [key: string]: string }): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] || match);
}

// Función para validar que lleguen todos los parámetros requeridos
function validateRequiredFields(data: any): { isValid: boolean; missingFields: string[] } {
  const requiredFields = [
    'telefono',
    'carta_texto',
    'carta_url',
    'nombre_deudor',
    'id_deudor',
    'nombre_acreedor',
    'plantilla',
    'cuerpo_plantilla',
    'evento',
    'primer_descuento_capital',
    'primer_descuento_interes',
    'primer_descuento_honorarios',
    'total_primer_descuento',
    'maximo_descuento_capital',
    'maximo_descuento_interes',
    'maximo_descuento_honorarios',
    'total_maximo_deescuento',
    'valor_cuota_primer_descuento',
    'valor_cuota_maximo_descuento',
    'numero_cuotas',
    'pago_inicial_primer_descuento',
    'pago_inicial_maximo_descuento',
    'primer_fecha_pago',
    'maxima_fecha_pago',
    'total_capital',
    'total_interes',
    'total_honorarios',
    'total_deuda'
  ];

  const missingFields = requiredFields.filter(field => !data[field] || data[field] === '');
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

export async function recuMassive(bot, req, res) {
  try {
    // Validar que lleguen todos los parámetros requeridos
    const validation = validateRequiredFields(req.body);
    if (!validation.isValid) {
      logger.error(`Campos faltantes: ${validation.missingFields.join(', ')}`);
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ 
        error: "Campos requeridos faltantes", 
        missingFields: validation.missingFields 
      }));
    }

    // Validar que el evento sea "document"
    if (req.body.evento !== 'document') {
      logger.error(`Evento inválido: ${req.body.evento}. Debe ser 'document'`);
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ 
        error: "Evento inválido. Debe ser 'document'" 
      }));
    }

    const {
      telefono,
      carta_texto,
      carta_url,
      nombre_deudor,
      id_deudor,
      nombre_acreedor,
      plantilla,
      cuerpo_plantilla,
      primer_descuento_capital,
      primer_descuento_interes,
      primer_descuento_honorarios,
      total_primer_descuento,
      maximo_descuento_capital,
      maximo_descuento_interes,
      maximo_descuento_honorarios,
      total_maximo_deescuento,
      valor_cuota_primer_descuento,
      valor_cuota_maximo_descuento,
      numero_cuotas,
      pago_inicial_primer_descuento,
      pago_inicial_maximo_descuento,
      primer_fecha_pago,
      maxima_fecha_pago,
      total_capital,
      total_interes,
      total_honorarios,
      total_deuda
    } = req.body;

    // Crear objeto con todas las variables para reemplazar en la plantilla
    const templateVariables = {
      nombre_deudor,
      nombre_acreedor,
      primer_descuento_capital,
      primer_descuento_interes,
      primer_descuento_honorarios,
      total_primer_descuento,
      maximo_descuento_capital,
      maximo_descuento_interes,
      maximo_descuento_honorarios,
      total_maximo_deescuento,
      valor_cuota_primer_descuento,
      valor_cuota_maximo_descuento,
      numero_cuotas,
      pago_inicial_primer_descuento,
      pago_inicial_maximo_descuento,
      primer_fecha_pago,
      maxima_fecha_pago,
      total_capital,
      total_interes,
      total_honorarios,
      total_deuda
    };

    const templateBodyParsed = replaceVariables(cuerpo_plantilla, templateVariables);

    // Enviar plantilla con documento PDF
    await bot.provider.sendTemplate(
      telefono,
      plantilla,
      'es_Mx', // Asumiendo que el idioma es español
      [
        {
          type: "header",
          parameters: [
            {
              type: "document",
              link: carta_url,
            }
          ]
        },
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: nombre_deudor
            },
            {
              type: "text",
              text: nombre_acreedor
            },
            {
              type: "text",
              text: total_deuda
            }
          ]
        }
      ]
    );

    // Crear contacto en Chatwoot
    const contactID = await chatwootService.getContactID(telefono);
    if (!contactID) {
      await chatwootService.createContact(telefono, nombre_deudor);
    }

    // Crear conversación en Chatwoot
    const conversationID = await chatwootService.getConversationID(telefono);
    if (!conversationID) {
      await chatwootService.createConversation(telefono, templateBodyParsed);
    }

    // // Enviar notas a Chatwoot
    // await chatwootService.sendNotes(telefono, templateBodyParsed, "outgoing", true);

    // Guardar en Appwrite con todos los nuevos campos
    await appwriteService.createDocument(
      'recu_clients_db',
      'recu_clients',
      {
        telefono,
        nombre_deudor,
        nombre_acreedor,
        id_deudor,
        carta_url,
        carta_texto,
        plantilla,
        cuerpo_plantilla,
        evento: req.body.evento,
        primer_descuento_capital,
        primer_descuento_interes,
        primer_descuento_honorarios,
        total_primer_descuento,
        maximo_descuento_capital,
        maximo_descuento_interes,
        maximo_descuento_honorarios,
        total_maximo_deescuento,
        valor_cuota_primer_descuento,
        valor_cuota_maximo_descuento,
        numero_cuotas,
        pago_inicial_primer_descuento,
        pago_inicial_maximo_descuento,
        primer_fecha_pago,
        maxima_fecha_pago,
        total_capital,
        total_interes,
        total_honorarios,
        total_deuda,
        fecha_envio: new Date().toISOString()
      }
    );

    // Enviar contexto a la IA
    await newAIResponse(telefono, `${JSON.stringify(req.body)}`);

    logger.log(`Plantilla enviada a ${telefono}`);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "enviado" }));

  } catch (error) {
    logger.error(`Error en recuMassive: ${error}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "No enviado" }));
  }
}