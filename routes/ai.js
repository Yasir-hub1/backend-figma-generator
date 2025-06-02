// backend/routes/ai.js - VERSIÓN ADAPTATIVA COMPLETA
const express = require('express');
const router = express.Router();
const axios = require('axios');
const authMiddleware = require('../middleware/authMiddleware');
const Element = require('../models/Element');
const Screen = require('../models/Screen');
const Project = require('../models/Project');

router.use(authMiddleware);

router.post('/chat', async (req, res) => {
  try {
    const { messages, context } = req.body;
    const API_KEY = "";

    console.log('🤖 AI: Procesando request de chat');
    console.log('- Context:', context);
    console.log('- Messages count:', messages.length);

    // Llamar a OpenAI
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4',
      messages,
      temperature: 0.7,
      max_tokens: 2000
    }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      }
    });
    
    const aiContent = response.data.choices[0].message.content;
    console.log('✅ AI: Respuesta completa de OpenAI:', aiContent);
    
    // SISTEMA MEJORADO DE EXTRACCIÓN DE ACCIONES
    const extractedData = extractActionsFromAIContent(aiContent);
    
    console.log('📊 AI: Resultado de extracción:');
    console.log('- Message length:', extractedData.message.length);
    console.log('- Actions count:', extractedData.actions.length);
    console.log('- Actions details:', JSON.stringify(extractedData.actions, null, 2));
    
    // Respuesta estructurada
    res.json({
      response: extractedData.message,
      actions: extractedData.actions,
      message: extractedData.message, // Para compatibilidad
      debug: {
        originalLength: aiContent.length,
        extractedActions: extractedData.actions.length,
        extractionMethod: extractedData.method
      }
    });
    
  } catch (error) {
    console.error('❌ AI: Error al comunicarse con OpenAI:', error);
    
    // Respuesta de error estructurada
    res.status(500).json({ 
      message: 'Error al comunicarse con la IA', 
      error: error.message,
      actions: [],
      response: 'Lo siento, hubo un error procesando tu solicitud.'
    });
  }
});

// FUNCIÓN PRINCIPAL PARA EXTRAER ACCIONES DEL CONTENIDO DE LA IA
function extractActionsFromAIContent(aiContent) {
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
  
  // MÉTODO 2: Buscar objetos JSON sueltos en el texto
  if (actions.length === 0) {
    console.log('🔍 AI: Buscando objetos JSON alternativos...');
    
    // Patrones para encontrar JSON
    const jsonPatterns = [
      /\{[\s\S]*?"actions"[\s\S]*?\}(?=\s*$|\s*\n\s*$)/gm,
      /\{[\s\S]*?"type":\s*"create"[\s\S]*?\}/g,
      /actions:\s*\[([\s\S]*?)\]/g
    ];
    
    for (const pattern of jsonPatterns) {
      const matches = aiContent.match(pattern);
      if (matches) {
        for (const match of matches) {
          try {
            let jsonText = match.trim();
            
            // Limpiar el texto para que sea JSON válido
            if (!jsonText.startsWith('{')) {
              jsonText = `{"actions": [${jsonText}]}`;
            }
            
            const parsed = JSON.parse(jsonText);
            
            if (parsed.actions && Array.isArray(parsed.actions)) {
              actions = parsed.actions;
              extractionMethod = 'json_loose';
              console.log(`✅ Método 2: ${actions.length} acciones encontradas con patrón JSON`);
              break;
            } else if (parsed.type === 'create') {
              actions = [parsed];
              extractionMethod = 'single_action';
              console.log(`✅ Método 2: 1 acción individual encontrada`);
              break;
            }
          } catch (e) {
            // Continuar con el siguiente patrón
          }
        }
        if (actions.length > 0) break;
      }
    }
  }
  
  // MÉTODO 3: Detectar elementos por palabras clave y crear acciones automáticas
  if (actions.length === 0) {
    console.log('🤖 AI: Intentando detectar elementos por palabras clave...');
    
    const lowerContent = aiContent.toLowerCase();
    const detectedActions = [];
    
    // Detección de botones
    if (lowerContent.includes('botón') || lowerContent.includes('button') || lowerContent.includes('elevatedbutton')) {
      const buttonAction = createDefaultAction('elevatedButton', {
        name: 'Botón generado por IA',
        content: extractButtonText(aiContent) || 'Click Me',
        position: { x: 130, y: 295 },
        size: { width: 120, height: 40 },
        styles: {
          backgroundColor: extractColor(aiContent, 'azul') || '#2196F3',
          textColor: '#FFFFFF',
          borderRadius: 8
        }
      });
      detectedActions.push(buttonAction);
      console.log('🎯 AI: Botón detectado automáticamente');
    }
    
    // Detección de tarjetas/cards
    if (lowerContent.includes('card') || lowerContent.includes('tarjeta')) {
      const cardAction = createDefaultAction('card', {
        name: 'Tarjeta generada por IA',
        position: { x: 30, y: 30 },
        size: { width: 300, height: 200 },
        styles: {
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          elevation: 4,
          padding: 16
        }
      });
      
      // Agregar contenido a la tarjeta si se detectan imágenes o texto
      const cardContent = [];
      
      if (lowerContent.includes('imagen') || lowerContent.includes('image')) {
        cardContent.push({
          type: 'create',
          elementType: 'container',
          name: 'Imagen de la Tarjeta',
          position: { x: 0, y: 0 },
          size: { width: 268, height: 120 },
          styles: {
            backgroundImage: 'https://picsum.photos/300/150',
            borderRadius: 8
          }
        });
      }
      
      if (lowerContent.includes('texto') || lowerContent.includes('title') || lowerContent.includes('título')) {
        cardContent.push({
          type: 'create',
          elementType: 'text',
          name: 'Texto de la Tarjeta',
          content: extractTextContent(aiContent) || 'Título de ejemplo',
          position: { x: 0, y: cardContent.length > 0 ? 130 : 20 },
          size: { width: 268, height: 30 },
          styles: {
            color: '#333333',
            fontSize: 16,
            fontWeight: 'bold'
          }
        });
      }
      
      if (cardContent.length > 0) {
        cardAction.content = cardContent;
      }
      
      detectedActions.push(cardAction);
      console.log('🎯 AI: Tarjeta detectada automáticamente');
    }
    
    // Detección de navegación
    if (lowerContent.includes('navigation') || lowerContent.includes('navegación') || lowerContent.includes('bottom')) {
      const navAction = createDefaultAction('bottomNavigationBar', {
        name: 'Navegación Inferior',
        position: { x: 0, y: 584 },
        size: { width: 360, height: 56 },
        styles: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderColor: '#E0E0E0'
        },
        flutterProps: {
          currentIndex: 0,
          type: 'fixed'
        }
      });
      detectedActions.push(navAction);
      console.log('🎯 AI: Navegación detectada automáticamente');
    }
    
    // Detección de texto
    if (lowerContent.includes('texto') || lowerContent.includes('text') || lowerContent.includes('título')) {
      const textAction = createDefaultAction('text', {
        name: 'Texto generado por IA',
        content: extractTextContent(aiContent) || 'Texto de ejemplo',
        position: { x: 50, y: 100 },
        size: { width: 260, height: 30 },
        styles: {
          color: extractColor(aiContent) || '#000000',
          fontSize: 16,
          textAlign: 'left'
        }
      });
      detectedActions.push(textAction);
      console.log('🎯 AI: Texto detectado automáticamente');
    }
    
    if (detectedActions.length > 0) {
      actions = detectedActions;
      extractionMethod = 'keyword_detection';
      console.log(`✅ Método 3: ${actions.length} acciones detectadas por palabras clave`);
    }
  }
  
  // MÉTODO 4: Procesar acciones anidadas
  if (actions.length > 0) {
    const flattenedActions = flattenNestedActions(actions);
    if (flattenedActions.length > actions.length) {
      actions = flattenedActions;
      extractionMethod += '_flattened';
      console.log(`🔄 AI: Acciones aplanadas: ${actions.length} acciones totales`);
    }
  }
  
  return {
    actions,
    message,
    method: extractionMethod
  };
}

// FUNCIÓN PARA CREAR ACCIONES POR DEFECTO
function createDefaultAction(elementType, overrides = {}) {
  const defaults = {
    type: 'create',
    elementType: elementType,
    name: `${elementType} IA`,
    content: '',
    position: { x: 100, y: 100 },
    size: { width: 100, height: 50 },
    styles: {},
    flutterProps: {}
  };
  
  return { ...defaults, ...overrides };
}

// FUNCIÓN PARA EXTRAER TEXTO DE BOTONES
function extractButtonText(content) {
  const buttonTextPatterns = [
    /"content":\s*"([^"]+)"/,
    /texto.*?["']([^"']+)["']/i,
    /button.*?["']([^"']+)["']/i,
    /click\s+([a-zA-Z\s]+)/i
  ];
  
  for (const pattern of buttonTextPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

// FUNCIÓN PARA EXTRAER TEXTO GENERAL
function extractTextContent(content) {
  const textPatterns = [
    /"content":\s*"([^"]+)"/,
    /título.*?["']([^"']+)["']/i,
    /text.*?["']([^"']+)["']/i,
    /contenido.*?["']([^"']+)["']/i
  ];
  
  for (const pattern of textPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

// FUNCIÓN PARA EXTRAER COLORES
function extractColor(content, colorHint = '') {
  const colorMap = {
    'azul': '#2196F3',
    'blue': '#2196F3',
    'rojo': '#F44336',
    'red': '#F44336',
    'verde': '#4CAF50',
    'green': '#4CAF50',
    'amarillo': '#FFEB3B',
    'yellow': '#FFEB3B',
    'negro': '#000000',
    'black': '#000000',
    'blanco': '#FFFFFF',
    'white': '#FFFFFF',
    'gris': '#9E9E9E',
    'gray': '#9E9E9E'
  };
  
  // Buscar color específico en el hint
  if (colorHint && colorMap[colorHint.toLowerCase()]) {
    return colorMap[colorHint.toLowerCase()];
  }
  
  // Buscar colores en el contenido
  const lowerContent = content.toLowerCase();
  for (const [colorName, colorValue] of Object.entries(colorMap)) {
    if (lowerContent.includes(colorName)) {
      return colorValue;
    }
  }
  
  // Buscar colores hexadecimales
  const hexMatch = content.match(/#[0-9A-Fa-f]{6}/);
  if (hexMatch) {
    return hexMatch[0];
  }
  
  return null;
}

// FUNCIÓN PARA APLANAR ACCIONES ANIDADAS
function flattenNestedActions(actions) {
  const flattened = [];
  
  for (const action of actions) {
    // Agregar la acción principal
    const mainAction = { ...action };
    
    // Si tiene contenido anidado, procesarlo
    if (action.content && Array.isArray(action.content)) {
      console.log(`🔄 AI: Procesando ${action.content.length} elementos anidados en ${action.elementType}`);
      
      // Guardar el contenido anidado y limpiar la acción principal
      const nestedElements = [...action.content];
      delete mainAction.content;
      
      // Agregar la acción principal primero
      flattened.push(mainAction);
      
      // Procesar elementos anidados
      for (let i = 0; i < nestedElements.length; i++) {
        const nestedElement = nestedElements[i];
        
        if (nestedElement.type === 'create') {
          // Ajustar posiciones relativas al elemento padre
          const adjustedElement = {
            ...nestedElement,
            position: {
              x: (action.position?.x || 0) + (nestedElement.position?.x || 0),
              y: (action.position?.y || 0) + (nestedElement.position?.y || 0)
            },
            size: nestedElement.size || { width: 100, height: 50 },
            styles: nestedElement.styles || {},
            flutterProps: nestedElement.flutterProps || {},
            parentId: `parent_${Date.now()}_${i}` // Referencia al padre
          };
          
          flattened.push(adjustedElement);
        }
      }
    } else {
      // Acción simple sin anidamiento
      flattened.push(mainAction);
    }
  }
  
  return flattened;
}

module.exports = router;