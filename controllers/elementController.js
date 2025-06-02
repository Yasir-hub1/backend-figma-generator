// backend/controllers/elementController.js - COMPLETO Y CORREGIDO
const Element = require('../models/Element');
const Project = require('../models/Project');
const Screen = require('../models/Screen');

// CORRECCIÓN: Crear un nuevo elemento
const createElement = async (req, res) => {
  try {
    const { screenId, type, name, content, position, size, styles, flutterWidget, flutterProps } = req.body;
    
    console.log('Creando elemento:', { screenId, type, name });
    
    // Validar que screenId esté presente
    if (!screenId) {
      return res.status(400).json({ message: 'Screen ID es requerido' });
    }

    // Verificar que la screen existe
    const screen = await Screen.findById(screenId);
    if (!screen) {
      return res.status(404).json({ message: 'Screen no encontrada' });
    }

    // Verificar permisos del proyecto
    const project = await Project.findById(screen.projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para crear elementos en este proyecto' });
    }

    // Crear el elemento
    const element = new Element({
      screenId,
      type,
      name: name || `${type} ${Date.now()}`,
      content: content || '',
      position: position || { x: 0, y: 0 },
      size: size || { width: 100, height: 50 },
      styles: styles || {},
      flutterWidget: flutterWidget || type,
      flutterProps: flutterProps || {}
    });

    const savedElement = await element.save();
    console.log('Elemento creado:', savedElement._id);
    
    res.status(201).json(savedElement);
  } catch (error) {
    console.error('Error al crear elemento:', error);
    res.status(500).json({ message: 'Error al crear elemento', error: error.message });
  }
};

// CORRECCIÓN: Obtener elementos por screen (la función que faltaba)
const getElementsByScreen = async (req, res) => {
  try {
    const { screenId } = req.params;
    
    console.log('Obteniendo elementos para screen:', screenId);
    
    if (!screenId) {
      return res.status(400).json({ message: 'Screen ID es requerido' });
    }

    // Verificar que la screen existe
    const screen = await Screen.findById(screenId);
    if (!screen) {
      return res.status(404).json({ message: 'Screen no encontrada' });
    }

    // Verificar permisos del proyecto
    const project = await Project.findById(screen.projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para ver elementos de este proyecto' });
    }

    // Buscar elementos que pertenezcan a esta screen
    const elements = await Element.find({ screenId: screenId }).sort({ createdAt: -1 });
    
    console.log(`Encontrados ${elements.length} elementos para screen ${screenId}`);
    
    res.status(200).json(elements);
  } catch (error) {
    console.error('Error al obtener elementos por screen:', error);
    res.status(500).json({ message: 'Error al obtener elementos', error: error.message });
  }
};

// MANTENER: Obtener todos los elementos de un proyecto (compatibilidad)
const getElements = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    console.log('Obteniendo elementos para proyecto:', projectId);
    
    // Verificar si el proyecto existe
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar permisos
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para ver este proyecto' });
    }
    
    // Obtener todas las screens del proyecto
    const screens = await Screen.find({ projectId: projectId });
    const screenIds = screens.map(screen => screen._id);
    
    // Obtener elementos de todas las screens
    const elements = await Element.find({ screenId: { $in: screenIds } });
    
    res.status(200).json(elements);
  } catch (error) {
    console.error('Error al obtener elementos:', error);
    res.status(500).json({ message: 'Error al obtener elementos', error: error.message });
  }
};

// Actualizar un elemento
const updateElement = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, content, position, size, styles, flutterWidget, flutterProps } = req.body;
    
    console.log('Actualizando elemento:', id);
    
    const element = await Element.findById(id);
    if (!element) {
      return res.status(404).json({ message: 'Elemento no encontrado' });
    }
    
    // Verificar permisos a través de la screen
    const screen = await Screen.findById(element.screenId);
    if (!screen) {
      return res.status(404).json({ message: 'Screen no encontrada' });
    }
    
    const project = await Project.findById(screen.projectId);
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para editar este elemento' });
    }
    
    // Actualizar elemento
    element.name = name || element.name;
    element.content = content !== undefined ? content : element.content;
    element.position = position || element.position;
    element.size = size || element.size;
    element.styles = styles ? { ...element.styles, ...styles } : element.styles;
    element.flutterWidget = flutterWidget || element.flutterWidget;
    element.flutterProps = flutterProps ? { ...element.flutterProps, ...flutterProps } : element.flutterProps;
    element.updatedAt = Date.now();
    
    await element.save();
    
    res.status(200).json(element);
  } catch (error) {
    console.error('Error al actualizar elemento:', error);
    res.status(500).json({ message: 'Error al actualizar el elemento', error: error.message });
  }
};

// Eliminar un elemento
const deleteElement = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Eliminando elemento:', id);
    
    const element = await Element.findById(id);
    if (!element) {
      return res.status(404).json({ message: 'Elemento no encontrado' });
    }
    
    // Verificar permisos a través de la screen
    const screen = await Screen.findById(element.screenId);
    if (!screen) {
      return res.status(404).json({ message: 'Screen no encontrada' });
    }
    
    const project = await Project.findById(screen.projectId);
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar este elemento' });
    }
    
    // Eliminar el elemento
    await Element.findByIdAndDelete(id);
    
    res.status(200).json({ message: 'Elemento eliminado con éxito' });
  } catch (error) {
    console.error('Error al eliminar elemento:', error);
    res.status(500).json({ message: 'Error al eliminar el elemento', error: error.message });
  }
};

// Duplicar un elemento
// Duplicar un elemento
const duplicateElement = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Duplicando elemento:', id);
    
    const originalElement = await Element.findById(id);
    if (!originalElement) {
      return res.status(404).json({ message: 'Elemento no encontrado' });
    }
    
    // Verificar permisos a través de la screen
    const screen = await Screen.findById(originalElement.screenId);
    if (!screen) {
      return res.status(404).json({ message: 'Screen no encontrada' });
    }
    
    const project = await Project.findById(screen.projectId);
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para duplicar este elemento' });
    }
    
    // CORRECCIÓN: Crear una copia del elemento excluyendo campos de MongoDB
    const elementData = originalElement.toObject();
    
    // Excluir campos que MongoDB genera automáticamente
    delete elementData._id;
    delete elementData.__v;
    delete elementData.createdAt;
    delete elementData.updatedAt;
    delete elementData.id; // También excluir el campo virtual 'id'
    
    // Crear el nuevo elemento con datos modificados
    const newElement = new Element({
      ...elementData,
      name: `${elementData.name} (copia)`,
      position: {
        x: elementData.position.x + 20,
        y: elementData.position.y + 20
      }
    });
    
    const savedElement = await newElement.save();
    
    res.status(201).json(savedElement);
  } catch (error) {
    console.error('Error al duplicar elemento:', error);
    res.status(500).json({ message: 'Error al duplicar el elemento', error: error.message });
  }
};

// CORRECCIÓN: Exportar a Flutter por screen específica
const exportToFlutterByScreen = async (req, res) => {
  try {
    const { screenId } = req.params;
    
    console.log('Exportando screen a Flutter:', screenId);
    
    if (!screenId) {
      return res.status(400).json({ message: 'Screen ID es requerido' });
    }

    // Obtener la screen
    const screen = await Screen.findById(screenId);
    if (!screen) {
      return res.status(404).json({ message: 'Screen no encontrada' });
    }

    // Verificar permisos
    const project = await Project.findById(screen.projectId);
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para exportar esta screen' });
    }

    // Obtener elementos de esta screen
    const elements = await Element.find({ screenId: screenId }).sort({ createdAt: 1 });

    // Generar código Flutter para esta screen específica
    const flutterCode = generateFlutterCodeForScreen(screen, elements);
    
    res.status(200).json({
      message: 'Screen exportada a Flutter con éxito',
      screenName: screen.name,
      ...flutterCode
    });
  } catch (error) {
    console.error('Error al exportar screen a Flutter:', error);
    res.status(500).json({ message: 'Error al exportar a Flutter', error: error.message });
  }
};

// Exportar proyecto completo a Flutter (mantener por compatibilidad)
const exportToFlutter = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    console.log('Exportando proyecto a Flutter:', projectId);
    
    // Verificar si el proyecto existe
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar permisos
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para exportar este proyecto' });
    }
    
    // Obtener todas las screens del proyecto
    const screens = await Screen.find({ projectId: projectId });
    
    // Generar código para cada screen
    const exportData = {
      projectName: project.name,
      screens: []
    };
    
    for (const screen of screens) {
      const elements = await Element.find({ screenId: screen._id }).sort({ createdAt: 1 });
      const screenCode = generateFlutterCodeForScreen(screen, elements);
      
      exportData.screens.push({
        screenName: screen.name,
        ...screenCode
      });
    }
    
    res.status(200).json({
      message: 'Proyecto exportado a Flutter con éxito',
      ...exportData
    });
    
  } catch (error) {
    console.error('Error al exportar proyecto a Flutter:', error);
    res.status(500).json({ 
      message: 'Error al exportar a Flutter', 
      error: error.message 
    });
  }
};

// FUNCIÓN AUXILIAR: Generar código Flutter para una screen
const generateFlutterCodeForScreen = (screen, elements) => {
  const screenName = screen.name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
  
  const dartCode = `import 'package:flutter/material.dart';

class ${screenName}Screen extends StatelessWidget {
  const ${screenName}Screen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Color(0xFF${(screen.canvas?.background || '#FFFFFF').replace('#', '')}),
      body: Container(
        width: ${screen.canvas?.width || 360}.0,
        height: ${screen.canvas?.height || 640}.0,
        child: Stack(
          children: [
${elements.map(element => generateElementCode(element)).join('\n')}
          ],
        ),
      ),
    );
  }
}`;

  const pubspecCode = `name: flutter_app
description: Generated Flutter app from ${screen.name}

publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=2.17.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.2

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^2.0.0

flutter:
  uses-material-design: true`;

  const readmeCode = `# ${screen.name} - Flutter Screen

Esta pantalla fue generada automáticamente desde tu diseño.

## Descripción
- Nombre: ${screen.name}
- Dimensiones: ${screen.canvas?.width || 360}x${screen.canvas?.height || 640}
- Elementos: ${elements.length}

## Uso
\`\`\`dart
Navigator.push(
  context,
  MaterialPageRoute(builder: (context) => ${screenName}Screen()),
);
\`\`\``;

  return {
    dart: dartCode,
    pubspec: pubspecCode,
    readme: readmeCode
  };
};

// FUNCIÓN AUXILIAR: Generar código para un elemento individual
const generateElementCode = (element) => {
  const position = element.position || { x: 0, y: 0 };
  const size = element.size || { width: 100, height: 50 };
  const indent = '            ';
  
  const getColorValue = (color) => {
    if (!color || color === 'transparent') return '0xFFFFFFFF';
    const hex = color.replace('#', '');
    return `0xFF${hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex}`.toUpperCase();
  };
  
  switch (element.type) {
    case 'text':
      return `${indent}Positioned(
${indent}  left: ${position.x}.0,
${indent}  top: ${position.y}.0,
${indent}  child: Container(
${indent}    width: ${size.width}.0,
${indent}    height: ${size.height}.0,
${indent}    child: Text(
${indent}      '${(element.content || 'Text').replace(/'/g, "\\'")}',
${indent}      style: TextStyle(
${indent}        color: Color(${getColorValue(element.styles?.color || '#000000')}),
${indent}        fontSize: ${element.styles?.fontSize || 14}.0,
${indent}        fontWeight: ${element.styles?.fontWeight === 'bold' ? 'FontWeight.bold' : 'FontWeight.normal'},
${indent}      ),
${indent}    ),
${indent}  ),
${indent}),`;
    
    case 'elevatedButton':
      return `${indent}Positioned(
${indent}  left: ${position.x}.0,
${indent}  top: ${position.y}.0,
${indent}  child: SizedBox(
${indent}    width: ${size.width}.0,
${indent}    height: ${size.height}.0,
${indent}    child: ElevatedButton(
${indent}      onPressed: () {
${indent}        // TODO: Implementar acción del botón
${indent}      },
${indent}      child: Text('${(element.content || 'Button').replace(/'/g, "\\'")}'),
${indent}    ),
${indent}  ),
${indent}),`;
    
    case 'container':
      return `${indent}Positioned(
${indent}  left: ${position.x}.0,
${indent}  top: ${position.y}.0,
${indent}  child: Container(
${indent}    width: ${size.width}.0,
${indent}    height: ${size.height}.0,
${indent}    decoration: BoxDecoration(
${indent}      color: Color(${getColorValue(element.styles?.backgroundColor || '#F5F5F5')}),
${indent}      borderRadius: BorderRadius.circular(${element.styles?.borderRadius || 0}.0),
${indent}    ),
${indent}    child: Center(
${indent}      child: Text('${(element.content || element.name || 'Container').replace(/'/g, "\\'")}'),
${indent}    ),
${indent}  ),
${indent}),`;
    
    default:
      return `${indent}Positioned(
${indent}  left: ${position.x}.0,
${indent}  top: ${position.y}.0,
${indent}  child: Container(
${indent}    width: ${size.width}.0,
${indent}    height: ${size.height}.0,
${indent}    decoration: BoxDecoration(
${indent}      color: Colors.grey[300],
${indent}      border: Border.all(color: Colors.grey),
${indent}    ),
${indent}    child: Center(
${indent}      child: Text('${element.type}'),
${indent}    ),
${indent}  ),
${indent}),`;
  }
};

module.exports = {
  createElement,
  getElementsByScreen,
  getElements,
  updateElement,
  deleteElement,
  duplicateElement,
  exportToFlutterByScreen,
  exportToFlutter
};