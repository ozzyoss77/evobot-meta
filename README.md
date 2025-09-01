# 🤖 EvoBot Meta - Advanced WhatsApp Business Bot

<p align="center">
  <a href="https://builderbot.vercel.app/">
    <picture>
      <img src="https://builderbot.vercel.app/assets/thumbnail-vector.png" height="80">
    </picture>
  </a>
</p>

<p align="center">
  <a aria-label="NPM version" href="https://www.npmjs.com/package/@builderbot/bot">
    <img alt="" src="https://img.shields.io/npm/v/@builderbot/bot?color=%2300c200&label=%40bot-whatsapp">
  </a>
  <a aria-label="Join the community on GitHub" href="https://link.codigoencasa.com/DISCORD">
    <img alt="" src="https://img.shields.io/discord/915193197645402142?logo=discord">
  </a>
</p>

EvoBot Meta es un bot avanzado de WhatsApp Business construido con BuilderBot que incluye integración con IA, sistema de seguimiento automatizado, gestión de multimedia, y conectores para múltiples servicios como CRM, calendarios, y e-commerce.

## 🚀 Características Principales

### 🤖 Inteligencia Artificial
- **Conversaciones inteligentes** con OpenAI GPT
- **Transcripción de audio** con Whisper
- **Síntesis de voz** con ElevenLabs
- **Análisis de imágenes** con IA
- **Gestión de hilos de conversación** persistentes

### 📱 Gestión Multimedia
- Procesamiento de **imágenes, videos, documentos y ubicaciones**
- **Notificaciones automáticas** para administradores
- **Archivos temporales** seguros con limpieza automática
- Soporte para **plantillas multimedia** de WhatsApp

### 🔄 Automatización y Follow-up
- **Sistema de seguimiento automático** configurable
- **Múltiples intentos** de re-engagement
- **Plantillas personalizables** por idioma
- **Gestión de tiempo** por zona horaria

### 🔗 Integraciones CRM y Servicios
- **Chatwoot** - Centro de atención al cliente
- **Cal.com** - Gestión de citas y calendarios
- **GoHighLevel (GHL)** - CRM y marketing automation
- **HubSpot** - Gestión de contactos
- **Shopify** - E-commerce y seguimiento de órdenes
- **Appwrite** - Base de datos y almacenamiento
- **SheetDB** - Integración con Google Sheets

### 🛡️ Seguridad y Control
- **Lista blanca** de usuarios autorizados
- **Bloqueo automático** de usuarios
- **Control de administrador** con API key
- **Logging avanzado** con Winston
- **Rate limiting** y cola de mensajes

## 📋 Requisitos Previos

- Node.js 18 o superior
- pnpm como gestor de paquetes
- Redis para caché y sesiones
- Cuentas configuradas en los servicios que desees integrar

## 🛠️ Instalación

1. **Clona el repositorio**:
```bash
git clone <repository-url>
cd evobot-meta
```

2. **Instala las dependencias**:
```bash
pnpm install
```

3. **Configura las variables de entorno**:
```bash
cp .env.example .env
# Edita el archivo .env con tus configuraciones
```

4. **Inicia el bot**:
```bash
# Desarrollo
pnpm dev

# Producción
pnpm build
pnpm start
```

## ⚙️ Configuración

### Variables de Entorno Esenciales

#### Bot Principal
```bash
# Configuración del Bot de WhatsApp
BOT_JWT_TOKEN=tu_jwt_token_meta
BOT_NUMBER_ID=tu_numero_id_meta
BOT_VERIFY_TOKEN=tu_verify_token
BOT_VERSION=v17.0
BOT_PHONENUMBER=5491234567890
BOT_TIMEZONE=America/Bogota
```

#### Inteligencia Artificial
```bash
# OpenAI para GPT y Whisper
OPENAI_API_KEY=sk-tu-api-key-openai

# IA API personalizada
AI_HOST=https://tu-api-ia.com
AI_API_KEY=tu-api-key-ia
AI_COLLECTION_NAME=tu-coleccion
```

### Configuración de Servicios

Consulta el archivo `.env.example` para ver todas las variables disponibles organizadas por servicio.

## 🏗️ Arquitectura del Proyecto

```
src/
├── app.ts                  # Punto de entrada principal
├── AIApi/                  # Servicios de IA
│   └── api-llm.ts         # Integración con LLM
├── Connections/           # Conectores a servicios externos
│   ├── appwrite.ts       # Base de datos Appwrite
│   ├── chatwoot.class.ts # CRM Chatwoot
│   ├── ElevenLab_Voices.ts # Síntesis de voz
│   ├── redis.ts          # Cache Redis
│   ├── sheetsDb.ts       # Google Sheets
│   └── Whisper.ts        # Transcripción de audio
├── Controllers/          # Controladores de endpoints
│   └── controllers.ts    # Webhooks y API endpoints
├── Flows/               # Flujos de conversación
│   ├── init.flow.ts     # Flujo de inicialización
│   ├── text.flow.ts     # Procesamiento de texto
│   ├── voice.flow.ts    # Procesamiento de voz
│   ├── image.flow.ts    # Procesamiento de imágenes
│   └── Handlers/        # Manejadores específicos
├── Services/            # Servicios de negocio
│   ├── cal-services.ts  # Integración Cal.com
│   ├── followup-service.ts # Sistema de seguimiento
│   ├── lobby-service.ts # Servicio de lobby/PMS
│   └── shopify-service.ts # Integración Shopify
└── Utils/              # Utilidades
    ├── formatter.ts    # Formateo de mensajes
    ├── logger.ts       # Sistema de logging
    ├── regex.ts        # Procesamiento de texto
    └── idle.ts         # Gestión de inactividad
```

## 🔧 API Endpoints

### Webhooks Disponibles

#### `/v1/calendar` - Eventos de Calendario
```bash
POST /v1/calendar
Content-Type: application/json

{
  "triggerEvent": "BOOKING_CREATED|MEETING_STARTED",
  "payload": {
    "responses": {
      "phone": { "value": "+5491234567890" },
      "name": { "value": "Juan Pérez" }
    },
    "startTime": "2024-01-15T10:00:00Z",
    "metadata": {
      "videoCallUrl": "https://meet.google.com/xxx"
    }
  }
}
```

#### `/v1/massive` - Envío Masivo
```bash
POST /v1/massive
Content-Type: application/json

{
  "number": "5491234567890",
  "url": "https://ejemplo.com/imagen.jpg",
  "message": "Mensaje de acompañamiento",
  "event": "image|video|document|text",
  "template": "nombre_plantilla",
  "languageCode": "es"
}
```

#### `/v1/ghl` - GoHighLevel
```bash
POST /v1/ghl
Content-Type: application/json

{
  "first_name": "Juan",
  "phone": "+5491234567890"
}
```

#### `/v1/shopify` - Shopify Orders
```bash
POST /v1/shopify
Content-Type: application/json

{
  "destination": {
    "phone": "5491234567890",
    "name": "Cliente"
  },
  "order_id": "12345",
  "tracking_company": "Correo Argentino",
  "tracking_number": "AR123456789",
  "tracking_url": "https://tracking.com/AR123456789"
}
```

## 🎯 Flujos de Conversación

### Flujo Principal (`init.flow.ts`)
- **Verificación de usuario autorizado**
- **Registro en base de datos**
- **Inicialización del sistema de seguimiento**
- **Gestión de listas blancas**

### Flujo de Texto (`text.flow.ts`)
- **Procesamiento con IA**
- **Análisis de regex y comandos**
- **Integración con servicios externos**
- **Respuestas contextuales**

### Flujo de Voz (`voice.flow.ts`)
- **Transcripción automática con Whisper**
- **Procesamiento con IA del texto transcrito**
- **Opción de respuesta en audio con ElevenLabs**
- **Almacenamiento temporal seguro**

### Flujo de Imagen (`image.flow.ts`)
- **Análisis de imágenes con IA**
- **Procesamiento contextual**
- **Notificaciones a administradores**

## 🔐 Seguridad y Administración

### Sistema de Bloqueo
```bash
# Mensaje para bloquear/desbloquear el bot
BOT_SWITCHER="admin toggle"
BOT_BLOCK_MESSAGE="block user"
```

### Lista Blanca
```bash
BOT_WHITELIST=true
# Solo usuarios autorizados pueden usar el bot
```

### Autenticación de Administrador
```bash
ADMIN_APIKEY=tu-api-key-super-secreta
```

## 📊 Logging y Monitoreo

El sistema incluye logging detallado con Winston:

- **Logs de conversaciones**
- **Métricas de uso de tokens**
- **Errores y excepciones**
- **Actividad de integraciones**
- **Rendimiento de endpoints**

Los logs se guardan en:
- `logs/bot.log` - Log principal
- `core.class.log` - Log del core
- `queue.class.log` - Log de la cola

## 🚀 Deployment

### Con Docker
```bash
# Build de la imagen
docker build -t evobot-meta .

# Ejecutar contenedor
docker run -d --name evobot-meta \
  --env-file .env \
  -p 3004:3004 \
  evobot-meta
```

### Producción
```bash
# Construir para producción
pnpm build

# Iniciar en producción
NODE_ENV=production pnpm start
```

## 🛠️ Desarrollo

### Scripts Disponibles
```bash
pnpm dev      # Desarrollo con hot reload
pnpm build    # Construir para producción  
pnpm start    # Iniciar en producción
pnpm lint     # Linter ESLint
```

### Estructura de Commits
Usa commits descriptivos siguiendo conventional commits:
- `feat:` nuevas características
- `fix:` corrección de bugs
- `docs:` documentación
- `refactor:` refactorización
- `test:` pruebas

## 🤝 Contribución

1. Fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📞 Soporte

- [💻 Discord](https://link.codigoencasa.com/DISCORD)
- [👌 𝕏 (Twitter)](https://twitter.com/leifermendez)
- [📚 Documentación BuilderBot](https://builderbot.vercel.app/)

## 📄 Licencia

Este proyecto está bajo la Licencia ISC. Ver el archivo `LICENSE` para más detalles.

---

**⭐ Si este proyecto te resulta útil, no olvides darle una estrella en GitHub!**