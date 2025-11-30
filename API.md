# 📡 API Documentation - EvoBot Meta

## 🌐 Endpoints Overview

EvoBot Meta expone varios endpoints para integración con servicios externos y gestión del bot.

**Base URL:** `http://localhost:3004` (desarrollo) / `https://tu-dominio.com` (producción)

## 🔐 Autenticación

Algunos endpoints requieren autenticación mediante API key:

```bash
# Header requerido para endpoints protegidos
Authorization: Bearer YOUR_ADMIN_API_KEY
```

## 📋 Endpoints Disponibles

### 1. 📅 Calendar Events - `/v1/calendar`

Recibe webhooks de eventos de calendario (Cal.com, Calendly, etc.)

#### `POST /v1/calendar`

**Eventos Soportados:**
- `BOOKING_CREATED` - Nueva cita creada
- `MEETING_STARTED` - Reunión iniciada

**Request Body:**
```json
{
  "triggerEvent": "BOOKING_CREATED",
  "payload": {
    "responses": {
      "phone": {
        "value": "+5491234567890"
      },
      "name": {
        "value": "Juan Pérez"
      }
    },
    "startTime": "2024-01-15T10:00:00Z",
    "organizer": {
      "timeZone": "America/Bogota"
    },
    "metadata": {
      "videoCallUrl": "https://meet.google.com/abc-defg-hij"
    }
  }
}
```

**Response:**
```json
{
  "status": "sended"
}
```

**Funcionalidad:**
- Envía confirmación automática de cita al cliente
- Crea contacto en Chatwoot si no existe
- Registra el mensaje en Appwrite
- Formatea fecha y hora según zona horaria

---

### 2. 📢 Massive Messaging - `/v1/massive`

Envío masivo de mensajes multimedia usando plantillas de WhatsApp

#### `POST /v1/massive`

**Request Body:**
```json
{
  "number": "5491234567890",
  "url": "https://ejemplo.com/imagen.jpg",
  "message": "Mensaje de acompañamiento",
  "event": "image",
  "template": "plantilla_promocional",
  "languageCode": "es"
}
```

**Parámetros:**
- `number` (string): Número de teléfono sin el símbolo +
- `url` (string): URL del archivo multimedia (imagen/video/documento)
- `message` (string): Texto del mensaje
- `event` (string): Tipo de media - `image`, `video`, `document`, `text`
- `template` (string): Nombre de la plantilla aprobada de WhatsApp
- `languageCode` (string): Código del idioma (es, en, pt, etc.)

**Response:**
```json
{
  "status": "sent",
  "messageId": "wamid.abc123..."
}
```

**Tipos de Mensaje:**

#### Imagen
```json
{
  "event": "image",
  "url": "https://ejemplo.com/promocion.jpg"
}
```

#### Video
```json
{
  "event": "video", 
  "url": "https://ejemplo.com/tutorial.mp4"
}
```

#### Documento
```json
{
  "event": "document",
  "url": "https://ejemplo.com/catalogo.pdf"
}
```

#### Solo Texto
```json
{
  "event": "text",
  "template": "plantilla_solo_texto"
}
```

---

### 3. 📞 Contact Updates - `/v1/updatecontact`

Actualiza información de contactos en el sistema

#### `POST /v1/updatecontact`

**Request Body:**
```json
{
  "phone": "5491234567890",
  "name": "Juan Pérez",
  "email": "juan@ejemplo.com",
  "tags": ["cliente", "premium"],
  "customFields": {
    "empresa": "Mi Empresa SA",
    "cargo": "Director"
  }
}
```

**Response:**
```json
{
  "status": "updated",
  "contactId": "contact_abc123"
}
```

---

### 4. 🏢 GoHighLevel Integration - `/v1/ghl`

Recibe webhooks de GoHighLevel para nuevos contactos

#### `POST /v1/ghl`

**Request Body:**
```json
{
  "first_name": "Juan",
  "phone": "+5491234567890",
  "email": "juan@ejemplo.com",
  "tags": ["lead", "web"]
}
```

**Comportamientos según `GHL_MULTIMEDIA_ACTIVATE`:**

#### Modo "image"
- Envía imagen desde `GHL_MULTIMEDIA_URL`
- Incluye mensaje personalizado

#### Modo "video"  
- Envía video desde `GHL_MULTIMEDIA_URL`
- Incluye mensaje personalizado

#### Modo "text" (default)
- Envía solo mensaje de texto

**Response:**
```json
{
  "status": "processed",
  "contactCreated": true
}
```

---

### 5. 🔶 HubSpot Integration - `/v1/hubspot`

Recibe webhooks de HubSpot para nuevos contactos

#### `POST /v1/hubspot`

**Request Body:**
```json
{
  "phone": "5491234567890",
  "firstname": "Juan",
  "lastname": "Pérez",
  "email": "juan@ejemplo.com"
}
```

**Response:**
```json
{
  "status": "processed"
}
```

---

### 6. 🛒 Shopify Integration - `/v1/shopify`

Procesa eventos de Shopify (órdenes, envíos)

#### `POST /v1/shopify`

**Request Body - Confirmación de Orden:**
```json
{
  "destination": {
    "phone": "5491234567890",
    "name": "Cliente Ejemplo"
  },
  "order_id": "12345",
  "products": [
    {
      "name": "Producto A",
      "quantity": 2,
      "price": "50.00"
    }
  ],
  "total": "100.00"
}
```

**Request Body - Tracking de Envío:**
```json
{
  "destination": {
    "phone": "5491234567890", 
    "name": "Cliente Ejemplo"
  },
  "order_id": "12345",
  "tracking_company": "Correo Argentino",
  "tracking_number": "AR123456789",
  "tracking_url": "https://tracking.correoargentino.com.ar/AR123456789"
}
```

**Response:**
```json
{
  "status": "notification_sent"
}
```

---

### 7. 🔄 Follow-up Management - `/v1/followup`

Gestiona el sistema de seguimiento automático

#### `POST /v1/followup`

**Request Body:**
```json
{
  "action": "register|remove|update",
  "phoneNumber": "5491234567890",
  "intent": 1
}
```

**Acciones:**
- `register`: Registra número para seguimiento
- `remove`: Elimina del sistema de seguimiento  
- `update`: Actualiza intención (1 = primer seguimiento, 2 = segundo)

**Response:**
```json
{
  "status": "success",
  "action": "registered"
}
```

---

### 8. 🎯 Token Management - `/v1/tokens`

Obtiene métricas de uso de tokens de IA

#### `GET /v1/tokens`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_API_KEY
```

**Query Parameters:**
- `phone` (opcional): Filtrar por número de teléfono
- `from` (opcional): Fecha inicio (YYYY-MM-DD)
- `to` (opcional): Fecha fin (YYYY-MM-DD)

**Response:**
```json
{
  "totalTokens": 15420,
  "totalCost": 23.45,
  "usage": [
    {
      "phone": "5491234567890",
      "tokens": 1250,
      "cost": 2.15,
      "date": "2024-01-15"
    }
  ]
}
```

---

### 9. 🏥 Health Check - `/health`

Verifica el estado del sistema y servicios conectados

#### `GET /health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "redis": {
      "status": "connected",
      "latency": "2ms"
    },
    "appwrite": {
      "status": "connected",
      "latency": "45ms"
    },
    "openai": {
      "status": "connected",
      "lastCheck": "2024-01-15T10:29:30Z"
    },
    "chatwoot": {
      "status": "connected",
      "inbox": "active"
    }
  },
  "bot": {
    "status": "active",
    "uptime": "2d 5h 30m",
    "activeConversations": 23,
    "queueLength": 2
  }
}
```

---

## 🚨 Error Handling

Todos los endpoints retornan errores en formato estándar:

```json
{
  "error": {
    "code": "INVALID_PHONE",
    "message": "El número de teléfono no es válido",
    "details": {
      "field": "phone",
      "value": "invalid_number"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Códigos de Error Comunes

| Código | Descripción |
|--------|-------------|
| `INVALID_PHONE` | Número de teléfono inválido |
| `MISSING_REQUIRED_FIELD` | Campo requerido faltante |
| `UNAUTHORIZED` | API key inválida o faltante |
| `SERVICE_UNAVAILABLE` | Servicio externo no disponible |
| `RATE_LIMIT_EXCEEDED` | Límite de velocidad excedido |
| `INVALID_TEMPLATE` | Plantilla de WhatsApp no encontrada |

## 🔐 Autenticación y Seguridad

### API Key Management

```bash
# Configurar API key de administrador
ADMIN_APIKEY=tu-api-key-super-secreta

# Usar en requests
curl -H "Authorization: Bearer tu-api-key-super-secreta" \
  https://tu-bot.com/v1/tokens
```

### Rate Limiting

El bot incluye rate limiting automático:
- Máximo 100 requests por minuto por IP
- Máximo 1000 requests por hora por API key
- Cola de mensajes para evitar spam

### Webhooks Security

Para validar webhooks de servicios externos:

```bash
# Verificar signature de Meta Webhook
X-Hub-Signature-256: sha256=hash_calculado

# Token de verificación personalizado
RECU_TOKEN_MASSIVE=tu-token-secreto
```

## 📊 Monitoring y Analytics

### Logs de API

Todos los requests se loguean automáticamente:

```bash
# Ver logs de API en tiempo real
tail -f logs/bot.log | grep "API Request"

# Filtrar por endpoint
tail -f logs/bot.log | grep "/v1/calendar"

# Ver errores de API
tail -f logs/bot.log | grep "API Error"
```

### Métricas Disponibles

El sistema registra:
- Tiempo de respuesta por endpoint
- Número de requests por servicio
- Errores y su frecuencia
- Uso de tokens de IA
- Mensajes enviados por tipo

## 🔧 Testing de la API

### Usando curl

```bash
# Test health check
curl -X GET http://localhost:3004/health

# Test calendar webhook
curl -X POST http://localhost:3004/v1/calendar \
  -H "Content-Type: application/json" \
  -d '{
    "triggerEvent": "BOOKING_CREATED",
    "payload": {
      "responses": {
        "phone": {"value": "+5491234567890"},
        "name": {"value": "Test User"}
      },
      "startTime": "2024-01-15T10:00:00Z"
    }
  }'

# Test con autenticación
curl -X GET http://localhost:3004/v1/tokens \
  -H "Authorization: Bearer tu-api-key"
```

### Usando Postman

Importa esta collection base:

```json
{
  "info": {
    "name": "EvoBot Meta API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:3004"
    },
    {
      "key": "api_key", 
      "value": "tu-api-key"
    }
  ],
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/health"
      }
    }
  ]
}
```

## 📚 Recursos Adicionales

- [WhatsApp Business API Webhooks](https://developers.facebook.com/docs/whatsapp/webhooks)
- [Cal.com Webhook Documentation](https://cal.com/docs/integrations/webhooks)
- [GoHighLevel API Docs](https://highlevel.stoplight.io/)
- [Shopify Webhook Guide](https://shopify.dev/apps/webhooks)

---

**💡 Nota:** Mantén siempre actualizada la documentación cuando modifiques endpoints o agregues nuevas funcionalidades.
