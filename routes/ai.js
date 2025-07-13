// backend/routes/ai.js - VERSIÓN CORREGIDA CON MANEJO ROBUSTO DE ERRORES
const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');
const authMiddleware = require('../middleware/authMiddleware');
const Element = require('../models/Element');
const Screen = require('../models/Screen');
const Project = require('../models/Project');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');
const sharp = require('sharp');
const path = require('path');

router.use(authMiddleware);

// CONFIGURACIÓN MEJORADA DE AXIOS CON KEEP-ALIVE Y TIMEOUTS
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 5,
  maxFreeSockets: 2,
  timeout: 60000,
  freeSocketTimeout: 30000,
  scheduling: 'fifo'
});

const openAIClient = axios.create({
  httpsAgent,
  timeout: 60000, // 60 segundos
  headers: {
    'Connection': 'keep-alive',
    'Content-Type': 'application/json'
  },
  // Configuración de reintentos
  retry: 3,
  retryDelay: (retryCount) => {
    return Math.pow(2, retryCount) * 1000; // Exponential backoff
  }
});

// INTERCEPTOR PARA MANEJO DE ERRORES Y REINTENTOS
openAIClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    
    // Verificar si es un error recuperable
    const isRetryableError = 
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNABORTED' ||
      (error.response && [429, 502, 503, 504].includes(error.response.status));
    
    // Verificar si ya se alcanzó el límite de reintentos
    if (!config || !isRetryableError || config.__retryCount >= (config.retry || 3)) {
      return Promise.reject(error);
    }
    
    // Incrementar contador de reintentos
    config.__retryCount = config.__retryCount || 0;
    config.__retryCount += 1;
    
    // Calcular delay para backoff exponencial
    const delay = config.retryDelay ? config.retryDelay(config.__retryCount) : 1000;
    
    console.log(`🔄 Reintentando petición (${config.__retryCount}/${config.retry}) en ${delay}ms...`);
    
    // Esperar antes del reintento
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Reintentar la petición
    return openAIClient(config);
  }
);

// Mover la API_KEY a variables de entorno (RECOMENDADO)
const API_KEY = "";

// CONFIGURACIÓN DE MULTER PARA AUDIO
const upload = multer({
  dest: 'temp/audio/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de audio'), false);
    }
  }
});

// CONFIGURACIÓN DE MULTER PARA IMÁGENES
const imageUpload = multer({
  dest: 'temp/images/',
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB máximo
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen (JPEG, PNG, WebP, GIF)'), false);
    }
  }
});

// FUNCIÓN MEJORADA PARA LLAMADAS A OPENAI
async function callOpenAI(payload, options = {}) {
  const {
    maxRetries = 3,
    timeout = 60000,
    model = 'gpt-4o'
  } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🤖 Intento ${attempt}/${maxRetries} - Llamando a OpenAI...`);
      
      const response = await openAIClient.post('https://api.openai.com/v1/chat/completions', {
        model,
        ...payload
      }, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
        timeout,
        retry: maxRetries,
        __retryCount: 0
      });

      console.log('✅ Respuesta exitosa de OpenAI');
      return response.data;

    } catch (error) {
      console.error(`❌ Error en intento ${attempt}:`, {
        code: error.code,
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });

      // Si es el último intento o no es un error recuperable, lanzar error
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }

      // Calcular delay con jitter para evitar thundering herd
      const baseDelay = Math.pow(2, attempt) * 1000;
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;

      console.log(`⏳ Esperando ${Math.round(delay)}ms antes del siguiente intento...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// FUNCIÓN PARA VERIFICAR SI UN ERROR ES RECUPERABLE
function isRetryableError(error) {
  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EPIPE', 'ENOTFOUND'];
  const retryableStatuses = [429, 500, 502, 503, 504];
  
  return (
    retryableCodes.includes(error.code) ||
    (error.response && retryableStatuses.includes(error.response.status))
  );
}

// ENDPOINT DE CHAT MEJORADO
router.post('/chat', async (req, res) => {
  try {
    const { messages, context } = req.body;

    console.log('🤖 AI: Procesando request de chat');
    console.log('- Context:', context);
    console.log('- Messages count:', messages.length);

    // Validar entrada
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Messages array es requerido y no puede estar vacío',
        actions: [],
        response: 'Por favor proporciona un mensaje válido.'
      });
    }

    // Llamar a OpenAI con manejo robusto de errores
    const aiResponse = await callOpenAI({
      messages,
      temperature: 0.7,
      max_tokens: 2000
    }, {
      maxRetries: 3,
      timeout: 60000
    });
    
    const aiContent = aiResponse.choices[0]?.message?.content;
    
    if (!aiContent) {
      throw new Error('Respuesta vacía de OpenAI');
    }
    
    console.log('✅ AI: Respuesta completa de OpenAI recibida');
    
    // Extraer acciones del contenido
    const extractedData = extractActionsFromAIContent(aiContent);
    
    console.log('📊 AI: Resultado de extracción:', {
      messageLength: extractedData.message.length,
      actionsCount: extractedData.actions.length,
      method: extractedData.method
    });
    
    // Respuesta estructurada
    res.json({
      response: extractedData.message,
      actions: extractedData.actions,
      message: extractedData.message,
      success: true,
      debug: {
        originalLength: aiContent.length,
        extractedActions: extractedData.actions.length,
        extractionMethod: extractedData.method,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ AI: Error en chat:', error);
    
    // Determinar tipo de error y respuesta apropiada
    let errorMessage = 'Error al comunicarse con la IA';
    let statusCode = 500;
    
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Tiempo de conexión agotado. Intenta nuevamente.';
      statusCode = 503;
    } else if (error.response?.status === 429) {
      errorMessage = 'Límite de solicitudes alcanzado. Intenta en unos momentos.';
      statusCode = 429;
    } else if (error.response?.status === 401) {
      errorMessage = 'Error de autenticación con la API';
      statusCode = 401;
    } else if (error.response?.status >= 500) {
      errorMessage = 'Servicio temporalmente no disponible';
      statusCode = 503;
    }
    
    res.status(statusCode).json({ 
      success: false,
      message: errorMessage,
      error:  error.message ,
      actions: [],
      response: 'Lo siento, hubo un error procesando tu solicitud. Por favor intenta nuevamente.',
      debug:  {
        code: error.code,
        status: error.response?.status,
        timestamp: new Date().toISOString()
      } 
    });
  }
});

// ENDPOINT DE TRANSCRIPCIÓN MEJORADO
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  let tempFilePath = null;
  
  try {
    console.log('🎤 AI: Procesando transcripción de audio');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se recibió archivo de audio',
        transcription: ''
      });
    }
    
    tempFilePath = req.file.path;
    console.log('📁 Audio recibido:', {
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
    
    if (!fs.existsSync(tempFilePath)) {
      throw new Error('Archivo de audio no encontrado');
    }
    
    // Preparar FormData para Whisper
    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempFilePath), {
      filename: 'audio.webm',
      contentType: req.file.mimetype
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'es');
    formData.append('response_format', 'text');
    
    console.log('🔄 Enviando audio a OpenAI Whisper...');
    
    // Llamar a Whisper con timeout mayor para archivos de audio
    const transcriptionResponse = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${API_KEY}`,
        },
        timeout: 90000, // 90 segundos para audio
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        httpsAgent
      }
    );
    
    const transcription = transcriptionResponse.data;
    console.log('✅ Transcripción recibida');
    
    const cleanedTranscription = typeof transcription === 'string' 
      ? transcription.trim() 
      : (transcription.text || '').trim();
    
    if (!cleanedTranscription) {
      return res.json({
        success: false,
        transcription: '',
        message: 'No se pudo transcribir el audio. Intenta hablar más claro.',
        originalTranscription: ''
      });
    }
    
    const processedTranscription = processDesignCommand(cleanedTranscription);
    
    res.json({
      success: true,
      transcription: processedTranscription,
      originalTranscription: cleanedTranscription,
      message: 'Audio transcrito correctamente',
      metadata: {
        originalSize: req.file.size,
        processingTime: Date.now(),
        language: 'es'
      }
    });
    
  } catch (error) {
    console.error('❌ Error en transcripción:', error);
    
    let errorMessage = 'Error al procesar el audio';
    let statusCode = 500;
    
    if (error.response) {
      const status = error.response.status;
      statusCode = status;
      
      switch (status) {
        case 400:
          errorMessage = 'Formato de audio no válido o archivo corrupto';
          break;
        case 413:
          errorMessage = 'Archivo de audio demasiado grande. Máximo 10MB.';
          break;
        case 429:
          errorMessage = 'Demasiadas solicitudes. Intenta nuevamente en un momento.';
          break;
        default:
          errorMessage = 'Error del servicio de transcripción';
      }
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Tiempo de espera agotado. El audio puede ser demasiado largo.';
      statusCode = 408;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      transcription: '',
      debug:{
        originalError: error.message,
        code: error.code
      }
    });
    
  } finally {
    // Limpiar archivo temporal
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('🗑️ Archivo temporal eliminado');
      } catch (cleanupError) {
        console.warn('⚠️ Error al eliminar archivo temporal:', cleanupError);
      }
    }
  }
});

// ENDPOINT DE ANÁLISIS DE IMAGEN MEJORADO
// REEMPLAZAR TODO el endpoint /analyze-image con esta versión más robusta:

router.post('/analyze-image', imageUpload.single('image'), async (req, res) => {
  let tempImagePath = null;
  let processedImagePath = null;
  
  try {
    console.log('🖼️ AI: Procesando análisis de imagen');
    
    if (!req.file) {
      return res.status(400).json({
        error: 'No se recibió archivo de imagen'
      });
    }
    
    tempImagePath = req.file.path;
    processedImagePath = path.join('temp/images', `processed_${req.file.filename}.jpg`);
    
    console.log('📁 Imagen recibida:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: tempImagePath
    });
    
    // Verificar que el archivo existe
    if (!fs.existsSync(tempImagePath)) {
      throw new Error('Archivo de imagen no encontrado');
    }
    
    // Procesar imagen para optimizar para la IA
    console.log('🔄 Optimizando imagen para análisis...');
    const processedImageInfo = await processImageForAI(tempImagePath, processedImagePath);
    
    // Convertir a base64 para enviar a OpenAI
    const base64Image = await imageToBase64(processedImagePath);
    
    
    console.log('🤖 Enviando imagen a GPT-4 Vision...');
    
    // Prompt especializado para análisis de mockups y diseños
    const analysisPrompt = `Analiza esta imagen de diseño/mockup de interfaz móvil y extrae todos los elementos visuales para recrear el diseño en Flutter.

INSTRUCCIONES DE ANÁLISIS:
1. Identifica TODOS los elementos UI visibles: botones, textos, imágenes, contenedores, barras, campos de entrada, etc.
2. Determina las posiciones aproximadas de cada elemento (coordenadas x,y relativas)
3. Calcula tamaños aproximados (ancho x alto)
4. Identifica colores de fondo, texto, bordes
5. Detecta tipografías (tamaños de fuente, pesos)
6. Reconoce patrones de layout (filas, columnas, centrado, etc.)
7. Identifica navegación (app bars, bottom bars, tabs, etc.)

ELEMENTOS A DETECTAR:
- AppBars/Headers (títulos, iconos, acciones)
- Botones (elevados, outlined, texto, FAB)
- Campos de texto (inputs, search bars)
- Textos (títulos, subtítulos, párrafos, labels)
- Imágenes (avatares, fondos, ilustraciones)
- Cards/Contenedores (con bordes, sombras, contenido)
- Listas (items, separadores)
- Navegación (bottom nav, tabs, drawer)
- Iconos y elementos gráficos
- Espaciado y padding

RESPUESTA REQUERIDA:
Devuelve un JSON con la estructura de acciones para recrear el diseño:

\`\`\`json
{
  "analysis": {
    "screenType": "descripción del tipo de pantalla",
    "backgroundColor": "#color",
    "mainLayout": "descripción del layout principal",
    "elementsCount": número_total_elementos
  },
  "actions": [
    {
      "type": "create",
      "elementType": "tipo_widget_flutter",
      "name": "Nombre descriptivo",
      "content": "contenido_texto_si_aplica",
      "position": {"x": coordenada_x, "y": coordenada_y},
      "size": {"width": ancho, "height": alto},
      "styles": {
        "backgroundColor": "#color",
        "textColor": "#color",
        "fontSize": tamaño,
        "borderRadius": radio,
        "elevation": elevación,
        "padding": espaciado,
        // más estilos según el elemento
      },
      "flutterProps": {
        // propiedades específicas de Flutter
      }
    }
    // ... más elementos
  ]
}
\`\`\`

WIDGETS FLUTTER DISPONIBLES:
appBar, container, text, elevatedButton, outlinedButton, textButton, floatingActionButton, textField, card, image, icon, row, column, stack, listView, bottomNavigationBar, tabBar, divider, switch, checkbox, slider, wrap, center, align, padding, margin, decoratedBox, clipRRect, opacity

CONSIDERACIONES IMPORTANTES:
- Canvas disponible: 360x640 pixels
- Usa coordenadas precisas basadas en la posición visual
- Estima colores lo más aproximado posible (hexadecimal)
- Para imágenes, usa placeholder: "https://picsum.photos/ancho/alto"
- Prioriza elementos principales primero
- Asegúrate que los elementos no se superpongan
- Mantén proporciones coherentes

Analiza la imagen y proporciona el JSON completo para recrear el diseño.`;

    // Llamar a GPT-4 Vision
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: analysisPrompt
            },
            {
              type: 'image_url',
              image_url: {
                url: base64Image,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.1 // Baja temperatura para análisis más preciso
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      timeout: 60000 // 60 segundos para análisis de imagen
    });
    
    const aiAnalysis = response.data.choices[0].message.content;
    console.log('✅ Análisis de IA recibido:', aiAnalysis);
    
    // Extraer JSON del análisis
    const analysisData = extractImageAnalysisData(aiAnalysis);
    
    console.log('📊 Resultado del análisis:', {
      analysisFound: !!analysisData.analysis,
      actionsCount: analysisData.actions.length,
      screenType: analysisData.analysis?.screenType,
      elementsDetected: analysisData.analysis?.elementsCount
    });
    
    res.json({
      success: true,
      message: 'Imagen analizada correctamente',
      analysis: analysisData.analysis,
      actions: analysisData.actions,
      originalImage: {
        name: req.file.originalname,
        size: req.file.size,
        dimensions: `${processedImageInfo.width}x${processedImageInfo.height}`
      },
      debug: {
        originalLength: aiAnalysis.length,
        extractedActions: analysisData.actions.length,
        processingTime: Date.now()
      }
    });
    
  } catch (error) {
    console.error('❌ Error en análisis de imagen:', error);
    
    let errorMessage = 'Error al analizar la imagen';
    let statusCode = 500;
    
    if (error.response) {
      const status = error.response.status;
      const responseData = error.response.data;
      
      console.error('🔴 Error de OpenAI Vision:', { status, data: responseData });
      
      switch (status) {
        case 400:
          errorMessage = 'Imagen no válida o formato no soportado';
          statusCode = 400;
          break;
        case 413:
          errorMessage = 'Imagen demasiado grande. Máximo 25MB.';
          statusCode = 413;
          break;
        case 429:
          errorMessage = 'Límite de solicitudes alcanzado. Intenta nuevamente en un momento.';
          statusCode = 429;
          break;
        case 500:
          errorMessage = 'Error interno del servicio de análisis de imagen';
          break;
        default:
          errorMessage = responseData?.error?.message || 'Error desconocido del servicio de análisis';
      }
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Tiempo de espera agotado. La imagen puede ser muy compleja.';
      statusCode = 408;
    } else if (error.message.includes('imagen')) {
      errorMessage = error.message;
      statusCode = 400;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      analysis: null,
      actions: [],
      debug: process.env.NODE_ENV === 'development' ? {
        originalError: error.message,
        stack: error.stack
      } : undefined
    });
    
  } finally {
    // Limpiar archivos temporales
    const filesToClean = [tempImagePath, processedImagePath].filter(Boolean);
    
    for (const file of filesToClean) {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
          console.log('🗑️ Archivo temporal eliminado:', file);
        } catch (cleanupError) {
          console.warn('⚠️ Error al eliminar archivo temporal:', cleanupError);
        }
      }
    }
  }
});

// FUNCIÓN PARA ANÁLISIS CON IA (CON REINTENTOS)

// CREAR DIRECTORIOS TEMPORALES SI NO EXISTEN
function createTempDirectories() {
  const dirs = ['temp/audio', 'temp/images'];
  dirs.forEach(dir => {
    const fullPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`📁 Directorio creado: ${dir}`);
    }
  });
}

// FUNCIONES AUXILIARES (mantener las existentes)
async function processImageForAI(inputPath, outputPath) {
  try {
    const metadata = await sharp(inputPath).metadata();
    
    const maxDimension = 1024;
    let newWidth = metadata.width;
    let newHeight = metadata.height;
    
    if (newWidth > maxDimension || newHeight > maxDimension) {
      const ratio = Math.min(maxDimension / newWidth, maxDimension / newHeight);
      newWidth = Math.round(newWidth * ratio);
      newHeight = Math.round(newHeight * ratio);
    }
    
    const processedImage = await sharp(inputPath)
      .resize(newWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality: 85,
        progressive: true
      })
      .toBuffer();
    
    await sharp(processedImage).toFile(outputPath);
    
    return {
      width: newWidth,
      height: newHeight,
      size: processedImage.length,
      buffer: processedImage
    };
    
  } catch (error) {
    throw new Error(`Error al procesar imagen: ${error.message}`);
  }
}

async function imageToBase64(imagePath) {
  try {
    const imageBuffer = await fs.promises.readFile(imagePath);
    const base64String = imageBuffer.toString('base64');
    return `data:image/jpeg;base64,${base64String}`;
  } catch (error) {
    throw new Error('Error al convertir imagen a base64');
  }
}

function getImageAnalysisPrompt() {
  return `Analiza esta imagen de diseño/mockup de interfaz móvil y extrae todos los elementos visuales para recrear el diseño en Flutter.

INSTRUCCIONES DE ANÁLISIS:
1. Identifica TODOS los elementos UI visibles: botones, textos, imágenes, contenedores, barras, campos de entrada, etc.
2. Determina las posiciones aproximadas de cada elemento (coordenadas x,y relativas)
3. Calcula tamaños aproximados (ancho x alto)
4. Identifica colores de fondo, texto, bordes
5. Detecta tipografías (tamaños de fuente, pesos)
6. Reconoce patrones de layout (filas, columnas, centrado, etc.)
7. Identifica navegación (app bars, bottom bars, tabs, etc.)

Responde con un JSON estructurado con analysis y actions array para recrear el diseño.`;
}

// Mantener las funciones existentes de extractActionsFromAIContent, processDesignCommand, etc.
// (incluir todas las funciones auxiliares que ya tienes)

// Incluir aquí todas las demás funciones auxiliares existentes...
function extractActionsFromAIContent(aiContent) {
  // Tu implementación existente
  let actions = [];
  let message = aiContent;
  let extractionMethod = 'none';
  
  console.log('🔍 AI: Iniciando extracción de acciones...');
  
  // MÉTODO 1: Extraer JSON del bloque de código
  const jsonBlockMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/);
  
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    try {
      const jsonPart = jsonBlockMatch[1].trim();
      console.log('📋 AI: JSON encontrado en bloque:', jsonPart);
      
      const parsedJson = JSON.parse(jsonPart);
      if (parsedJson.actions && Array.isArray(parsedJson.actions)) {
        actions = parsedJson.actions;
        message = aiContent.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
        
        console.log(`✅ Método 1: ${actions.length} acciones extraídas del bloque JSON`);
      }
    } catch (jsonError) {
      console.warn('⚠️ AI: Error al procesar JSON del bloque:', jsonError);
    }
  }
  
  return {
    actions,
    message,
    method: extractionMethod
  };
}

// AGREGAR ESTA FUNCIÓN AL FINAL DEL ARCHIVO ai.js (antes de module.exports)
function processDesignCommand(transcription) {
  if (!transcription || typeof transcription !== 'string') {
    return transcription;
  }
  
  let processed = transcription.trim();
  console.log('🔄 Procesando comando de diseño:', processed);
  
  // Normalizar a minúsculas para comparación
  const lowerText = processed.toLowerCase();
  
  // MAPEO INTELIGENTE Y SENSIBLE DE COMANDOS DE VOZ
  const voiceCommandMappings = [
    // App Bar / Barra Superior - MUY ESPECÍFICO
    {
      triggers: ['app bar', 'appbar', 'barra superior', 'header', 'cabecera'],
      result: 'crea una barra de aplicación superior'
    },
    
    // Bottom Navigation - MUY ESPECÍFICO  
    {
      triggers: ['navbar', 'nav bar', 'navegación inferior', 'barra navegación', 'bottom navigation', 'navegación'],
      result: 'crea una barra de navegación inferior'
    },
    
    // Botones
    {
      triggers: ['botón', 'button', 'boton'],
      result: 'crea un botón'
    },
    
    // Login
    {
      triggers: ['login', 'log in', 'iniciar sesión', 'formulario login'],
      result: 'crea un formulario de login con email y password'
    },
    
    // Cards
    {
      triggers: ['card', 'tarjeta', 'carta'],
      result: 'crea una tarjeta'
    },
    
    // Texto
    {
      triggers: ['texto', 'text', 'título', 'titulo', 'label'],
      result: 'crea un texto'
    },
    
    // Imagen
    {
      triggers: ['imagen', 'image', 'foto', 'picture'],
      result: 'crea una imagen'
    },
    
    // Campo de texto
    {
      triggers: ['campo texto', 'input', 'textfield', 'campo entrada'],
      result: 'crea un campo de texto'
    }
  ];
  
  // Buscar coincidencias EXACTAS primero
  for (const mapping of voiceCommandMappings) {
    for (const trigger of mapping.triggers) {
      if (lowerText.includes(trigger)) {
        console.log(`🎯 Coincidencia encontrada: "${trigger}" → "${mapping.result}"`);
        processed = mapping.result;
        
        // Capitalizar y retornar inmediatamente
        return processed.charAt(0).toUpperCase() + processed.slice(1);
      }
    }
  }
  
  // Si no hay coincidencia exacta, limpiar verbos innecesarios
  processed = processed
    .replace(/\b(crea|haz|agrega|añade|pon|ponme|hazme|créame|creame)\s+/gi, 'crea ')
    .replace(/\bme\s+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Capitalizar primera letra
  if (processed.length > 0) {
    processed = processed.charAt(0).toUpperCase() + processed.slice(1);
  }
  
  console.log(`✅ Comando final: "${transcription}" → "${processed}"`);
  return processed;
}

function extractImageAnalysisData(aiAnalysis) {
  let analysis = null;
  let actions = [];
  
  console.log('🔍 AI: Extrayendo datos del análisis de imagen...');
  
  try {
    // MÉTODO 1: Extraer JSON completo del bloque de código
    const jsonBlockMatch = aiAnalysis.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (jsonBlockMatch && jsonBlockMatch[1]) {
      try {
        const jsonPart = jsonBlockMatch[1].trim();
        console.log('📋 JSON encontrado en análisis de imagen');
        
        const parsedJson = JSON.parse(jsonPart);
        
        if (parsedJson.analysis) {
          analysis = parsedJson.analysis;
        }
        
        if (parsedJson.actions && Array.isArray(parsedJson.actions)) {
          actions = parsedJson.actions;
          console.log(`✅ ${actions.length} acciones extraídas del análisis de imagen`);
        }
        
      } catch (jsonError) {
        console.warn('⚠️ Error al procesar JSON del análisis:', jsonError);
      }
    }
    
    // MÉTODO 2: Buscar objetos JSON sueltos si no se encontró en bloque
    if (actions.length === 0) {
      console.log('🔍 Buscando acciones alternativas en el análisis...');
      
      // Buscar array de acciones
      const actionsMatch = aiAnalysis.match(/"actions":\s*\[([\s\S]*?)\]/);
      if (actionsMatch) {
        try {
          const actionsJson = `[${actionsMatch[1]}]`;
          const parsedActions = JSON.parse(actionsJson);
          if (Array.isArray(parsedActions)) {
            actions = parsedActions;
            console.log(`✅ ${actions.length} acciones encontradas alternativamente`);
          }
        } catch (e) {
          console.warn('⚠️ Error al parsear acciones alternativas');
        }
      }
      
      // Buscar análisis por separado
      const analysisMatch = aiAnalysis.match(/"analysis":\s*\{([^}]+)\}/);
      if (analysisMatch && !analysis) {
        try {
          const analysisJson = `{${analysisMatch[1]}}`;
          analysis = JSON.parse(analysisJson);
          console.log('✅ Análisis encontrado alternativamente');
        } catch (e) {
          console.warn('⚠️ Error al parsear análisis alternativo');
        }
      }
    }
    
    // MÉTODO 3: Crear análisis por defecto si no se encontró
    if (!analysis) {
      analysis = {
        screenType: 'Diseño móvil analizado',
        backgroundColor: '#FFFFFF',
        mainLayout: 'Layout personalizado',
        elementsCount: actions.length
      };
      console.log('🔧 Análisis por defecto creado');
    }
    
    // MÉTODO 4: Validar y limpiar acciones
    const validatedActions = [];
    
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      
      if (action && action.type === 'create' && action.elementType) {
        // Validar y corregir propiedades requeridas
        const validatedAction = {
          type: 'create',
          elementType: action.elementType,
          name: action.name || `Elemento ${i + 1}`,
          content: action.content || '',
          position: {
            x: Math.max(0, Math.min(340, action.position?.x || 20)),
            y: Math.max(0, Math.min(600, action.position?.y || 20 + (i * 60)))
          },
          size: {
            width: Math.max(20, Math.min(320, action.size?.width || 100)),
            height: Math.max(20, Math.min(100, action.size?.height || 40))
          },
          styles: action.styles || {},
          flutterProps: action.flutterProps || {}
        };
        
        validatedActions.push(validatedAction);
      }
    }
    
    actions = validatedActions;
    
    console.log('📊 Análisis final extraído:', {
      analysisComplete: !!analysis,
      actionsCount: actions.length,
      screenType: analysis?.screenType
    });
    
  } catch (error) {
    console.error('❌ Error al extraer análisis de imagen:', error);
    
    // Fallback: crear análisis vacío
    analysis = {
      screenType: 'Error en análisis',
      backgroundColor: '#FFFFFF',
      mainLayout: 'No se pudo analizar',
      elementsCount: 0
    };
    actions = [];
  }
  
  return { analysis, actions };
}

// CREAR DIRECTORIO DE IMÁGENES TEMPORALES SI NO EXISTE
const createImageTempDir = () => {
  const imageDir = path.join(__dirname, '../temp/images');
  if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
    console.log('📁 Directorio de imágenes temporales creado');
  }
};

// Inicializar directorios al cargar el módulo
createTempDirectories();

module.exports = router;