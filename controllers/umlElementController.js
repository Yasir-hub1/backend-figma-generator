// backend/controllers/umlElementController.js - Controlador para Elementos UML
const UMLElement = require('../models/UMLElement');
const UMLConnection = require('../models/UMLConnection');
const Diagram = require('../models/Diagram');
const Project = require('../models/Project');

// Obtener elementos y conexiones de un diagrama
exports.getUMLElements = async (req, res) => {
  try {
    const { diagramId } = req.params;

    console.log('📦 Obteniendo elementos UML del diagrama:', diagramId);

    // Verificar que el diagrama existe y el usuario tiene acceso
    const diagram = await Diagram.findById(diagramId);
    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para acceder a este diagrama' });
    }

    // Obtener elementos y conexiones
    const elements = await UMLElement.find({ diagramId })
      .sort({ zIndex: 1, createdAt: 1 });

    const connections = await UMLConnection.find({ diagramId })
      .sort({ zIndex: 1, createdAt: 1 })
      .populate('sourceElement targetElement');

    console.log(`✅ ${elements.length} elementos y ${connections.length} conexiones encontradas`);

    res.json({
      message: 'Elementos UML obtenidos correctamente',
      elements,
      connections
    });
  } catch (error) {
    console.error('❌ Error al obtener elementos UML:', error);
    res.status(500).json({ message: 'Error al obtener elementos UML', error: error.message });
  }
};

// Crear elemento UML
exports.createUMLElement = async (req, res) => {
  try {
    const {
      name, diagramId, type, position, size, properties, styles, zIndex
    } = req.body;

    console.log('📝 Creando elemento UML:', { name, type, diagramId, userId: req.userId });

    // Verificar que el diagrama existe y el usuario tiene acceso
    const diagram = await Diagram.findById(diagramId);
    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para crear elementos en este diagrama' });
    }

    // Valores por defecto según el tipo de elemento
    const getDefaultProperties = (elementType) => {
      const defaults = {
        class: {
          stereotype: '',
          isAbstract: false,
          packageName: '',
          attributes: [],
          operations: []
        },
        interface: {
          stereotype: '<<interface>>',
          isAbstract: true,
          packageName: '',
          attributes: [],
          operations: []
        },
        abstract_class: {
          stereotype: '<<abstract>>',
          isAbstract: true,
          packageName: '',
          attributes: [],
          operations: []
        },
        enum: {
          stereotype: '<<enum>>',
          literals: [{ name: 'VALUE1', value: 'VALUE1' }]
        },
        use_case: {
          description: '',
          preconditions: [],
          postconditions: [],
          mainFlow: [],
          alternativeFlows: []
        },
        actor: {
          description: ''
        },
        note: {
          text: 'Nueva nota'
        }
      };
      return defaults[elementType] || {};
    };

    const getDefaultSize = (elementType) => {
      const sizes = {
        class: { width: 200, height: 150 },
        interface: { width: 200, height: 120 },
        abstract_class: { width: 200, height: 150 },
        enum: { width: 150, height: 100 },
        package: { width: 250, height: 200 },
        component: { width: 180, height: 100 },
        actor: { width: 80, height: 100 },
        use_case: { width: 120, height: 80 },
        note: { width: 150, height: 100 }
      };
      return sizes[elementType] || { width: 150, height: 100 };
    };

    const element = new UMLElement({
      name,
      diagramId,
      type,
      position: position || { x: 100, y: 100 },
      size: size || getDefaultSize(type),
      properties: {
        ...getDefaultProperties(type),
        ...properties
      },
      styles: {
        backgroundColor: '#FFFFFF',
        borderColor: '#000000',
        borderWidth: 1,
        fontSize: 12,
        fontFamily: 'Arial, sans-serif',
        textColor: '#000000',
        cornerRadius: type === 'use_case' ? 25 : 0,
        ...styles
      },
      zIndex: zIndex || 1
    });

    // Validar elemento
    const validation = element.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        message: 'Datos del elemento inválidos',
        errors: validation.errors
      });
    }

    await element.save();

    console.log('✅ Elemento UML creado exitosamente:', element._id);

    // Emitir evento de socket para notificar a otros usuarios
    if (global.io) {
      global.io.to(project._id.toString()).emit('uml-updated', {
        type: 'element-added',
        projectId: project._id,
        diagramId: diagram._id,
        element: element,
        userId: req.userId,
        username: req.user?.username || req.user?.name || 'Usuario'
      });
      console.log('📡 Socket emitido: element-added para proyecto', project._id);
    }

    res.status(201).json({
      message: 'Elemento UML creado con éxito',
      element
    });
  } catch (error) {
    console.error('❌ Error al crear elemento UML:', error);
    res.status(500).json({ message: 'Error al crear elemento UML', error: error.message });
  }
};

// Actualizar elemento UML
exports.updateUMLElement = async (req, res) => {
  try {
    const { elementId } = req.params;
    const updates = req.body;

    console.log('📝 Actualizando elemento UML:', elementId);

    const element = await UMLElement.findById(elementId);

    if (!element) {
      return res.status(404).json({ message: 'Elemento UML no encontrado' });
    }

    // Verificar permisos del diagrama/proyecto
    const diagram = await Diagram.findById(element.diagramId);
    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para actualizar este elemento' });
    }

    // Campos permitidos para actualización
    const allowedUpdates = [
      'name', 'position', 'size', 'properties', 'styles', 'zIndex', 'locked', 'visible'
    ];

    const updateData = {};
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });

    const updatedElement = await UMLElement.findByIdAndUpdate(
      elementId,
      updateData,
      { new: true, runValidators: true }
    );

    // Validar elemento actualizado
    const validation = updatedElement.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        message: 'Datos del elemento actualizados son inválidos',
        errors: validation.errors
      });
    }

    console.log('✅ Elemento UML actualizado:', updatedElement.name);

    // Emitir evento de socket para actualización en tiempo real
    if (global.io) {
      global.io.to(diagram.projectId.toString()).emit('uml-updated', {
        type: 'element-updated',
        diagramId: diagram._id,
        projectId: diagram.projectId,
        userId: req.userId,
        username: req.user?.username || req.user?.name || 'Usuario',
        element: updatedElement
      });
      console.log('📡 Socket emitido: element-updated para diagrama', diagram._id);
    }

    res.json({
      message: 'Elemento UML actualizado correctamente',
      element: updatedElement
    });
  } catch (error) {
    console.error('❌ Error al actualizar elemento UML:', error);
    res.status(500).json({ message: 'Error al actualizar elemento UML', error: error.message });
  }
};

// Eliminar elemento UML
exports.deleteUMLElement = async (req, res) => {
  try {
    const { elementId } = req.params;

    console.log('🗑️ Eliminando elemento UML:', elementId);

    const element = await UMLElement.findById(elementId);

    if (!element) {
      return res.status(404).json({ message: 'Elemento UML no encontrado' });
    }

    // Verificar permisos del diagrama/proyecto
    const diagram = await Diagram.findById(element.diagramId);
    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para eliminar este elemento' });
    }

    // Eliminar conexiones relacionadas con este elemento
    await UMLConnection.deleteMany({
      $or: [
        { sourceElementId: elementId },
        { targetElementId: elementId }
      ]
    });

    // Eliminar el elemento
    await UMLElement.findByIdAndDelete(elementId);

    console.log('✅ Elemento UML eliminado exitosamente');

    // Emitir evento de socket para notificar a otros usuarios
    if (global.io) {
      global.io.to(project._id.toString()).emit('uml-updated', {
        type: 'element-deleted',
        projectId: project._id,
        diagramId: diagram._id,
        elementId: elementId,
        userId: req.userId,
        username: req.user?.username || req.user?.name || 'Usuario'
      });
      console.log('📡 Socket emitido: element-deleted para proyecto', project._id);
    }

    res.json({
      message: 'Elemento UML eliminado correctamente'
    });
  } catch (error) {
    console.error('❌ Error al eliminar elemento UML:', error);
    res.status(500).json({ message: 'Error al eliminar elemento UML', error: error.message });
  }
};

// Duplicar elemento UML
exports.duplicateUMLElement = async (req, res) => {
  try {
    const { elementId } = req.params;
    const { offsetX = 20, offsetY = 20 } = req.body;

    console.log('📋 Duplicando elemento UML:', elementId);
    console.log('📋 Offset:', { offsetX, offsetY });

    const element = await UMLElement.findById(elementId);

    if (!element) {
      return res.status(404).json({ message: 'Elemento UML no encontrado' });
    }

    console.log('📋 Elemento original encontrado:', {
      id: element._id,
      name: element.name,
      type: element.type
    });

    // Verificar permisos del diagrama/proyecto
    const diagram = await Diagram.findById(element.diagramId);
    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para duplicar este elemento' });
    }

    console.log('📋 Creando elemento duplicado...');
    const duplicatedElement = element.duplicate(offsetX, offsetY);
    
    console.log('📋 Elemento duplicado creado:', {
      id: duplicatedElement._id,
      name: duplicatedElement.name,
      type: duplicatedElement.type,
      position: duplicatedElement.position
    });

    console.log('📋 Guardando elemento duplicado en la base de datos...');
    await duplicatedElement.save();

    console.log('✅ Elemento UML duplicado exitosamente:', duplicatedElement._id);

    res.status(201).json({
      message: 'Elemento UML duplicado correctamente',
      element: duplicatedElement
    });
  } catch (error) {
    console.error('❌ Error al duplicar elemento UML:', error);
    res.status(500).json({ message: 'Error al duplicar elemento UML', error: error.message });
  }
};

// Exportar diagrama UML
exports.exportUML = async (req, res) => {
  try {
    const { diagramId } = req.params;
    const { format = 'plantuml' } = req.body;

    console.log('📤 Exportando diagrama UML:', diagramId, 'formato:', format);

    // Verificar que el diagrama existe y el usuario tiene acceso
    const diagram = await Diagram.findById(diagramId);
    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para exportar este diagrama' });
    }

    // Obtener elementos y conexiones
    const elements = await UMLElement.find({ diagramId });
    const connections = await UMLConnection.find({ diagramId })
      .populate('sourceElement targetElement');

    let exportContent = '';

    switch (format.toLowerCase()) {
      case 'plantuml':
        exportContent = generatePlantUML(diagram, elements, connections);
        break;
      case 'xmi':
        exportContent = generateXMI(diagram, elements, connections);
        break;
      case 'json':
        exportContent = JSON.stringify({
          diagram: diagram.toObject(),
          elements: elements.map(el => el.toObject()),
          connections: connections.map(conn => conn.toObject())
        }, null, 2);
        break;
      default:
        return res.status(400).json({ message: 'Formato de exportación no soportado' });
    }

    // Actualizar metadatos de exportación
    await Diagram.findByIdAndUpdate(diagramId, {
      lastExport: {
        format,
        timestamp: new Date(),
        size: Buffer.byteLength(exportContent, 'utf8')
      }
    });

    console.log('✅ Diagrama exportado exitosamente');

    res.json({
      message: 'Diagrama exportado correctamente',
      format,
      content: exportContent,
      filename: `${diagram.name.replace(/\s+/g, '_')}.${getFileExtension(format)}`,
      size: Buffer.byteLength(exportContent, 'utf8')
    });
  } catch (error) {
    console.error('❌ Error al exportar diagrama:', error);
    res.status(500).json({ message: 'Error al exportar diagrama', error: error.message });
  }
};

// Generar código desde diagrama UML
exports.generateCode = async (req, res) => {
  try {
    const { diagramId } = req.params;
    const { language = 'java' } = req.body;

    console.log('🔧 Generando código desde diagrama:', diagramId, 'lenguaje:', language);

    // Verificar que el diagrama existe y el usuario tiene acceso
    const diagram = await Diagram.findById(diagramId);
    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para generar código de este diagrama' });
    }

    // Solo diagramas de clases pueden generar código
    if (diagram.type !== 'class') {
      return res.status(400).json({ message: 'Solo los diagramas de clases pueden generar código' });
    }

    // Obtener elementos de clase
    const elements = await UMLElement.find({
      diagramId,
      type: { $in: ['class', 'interface', 'abstract_class', 'enum'] }
    });

    if (elements.length === 0) {
      return res.status(400).json({ message: 'No hay clases en el diagrama para generar código' });
    }

    const generatedCode = UMLElement.generateCode(elements, language);

    console.log('✅ Código generado exitosamente');

    res.json({
      message: 'Código generado correctamente',
      language,
      code: generatedCode,
      classCount: elements.length
    });
  } catch (error) {
    console.error('❌ Error al generar código:', error);
    res.status(500).json({ message: 'Error al generar código', error: error.message });
  }
};

// Validar diagrama UML
exports.validateUML = async (req, res) => {
  try {
    const { diagramId } = req.params;

    console.log('✅ Validando diagrama UML:', diagramId);

    // Verificar que el diagrama existe y el usuario tiene acceso
    const diagram = await Diagram.findById(diagramId);
    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para validar este diagrama' });
    }

    // Obtener elementos y conexiones
    const elements = await UMLElement.find({ diagramId });
    const connections = await UMLConnection.find({ diagramId })
      .populate('sourceElement targetElement');

    const validationResults = {
      diagram: {
        isValid: true,
        errors: [],
        warnings: []
      },
      elements: [],
      connections: []
    };

    // Validar elementos
    for (const element of elements) {
      const elementValidation = element.validate();
      validationResults.elements.push({
        elementId: element._id,
        name: element.name,
        type: element.type,
        isValid: elementValidation.isValid,
        errors: elementValidation.errors
      });

      if (!elementValidation.isValid) {
        validationResults.diagram.isValid = false;
      }
    }

    // Validar conexiones
    for (const connection of connections) {
      const connectionValidation = await connection.validateUMLRules();
      validationResults.connections.push({
        connectionId: connection._id,
        type: connection.type,
        source: connection.sourceElement?.name,
        target: connection.targetElement?.name,
        isValid: connectionValidation.isValid,
        errors: connectionValidation.errors
      });

      if (!connectionValidation.isValid) {
        validationResults.diagram.isValid = false;
      }
    }

    // Validaciones globales del diagrama
    if (elements.length === 0) {
      validationResults.diagram.warnings.push('El diagrama no contiene elementos');
    }

    // Detectar elementos sin conexiones (solo para algunos tipos)
    const isolatedElements = elements.filter(element => {
      if (!['class', 'interface'].includes(element.type)) return false;

      const hasConnections = connections.some(conn =>
        conn.sourceElementId.equals(element._id) ||
        conn.targetElementId.equals(element._id)
      );
      return !hasConnections;
    });

    if (isolatedElements.length > 0) {
      validationResults.diagram.warnings.push(
        `${isolatedElements.length} elementos sin relaciones: ${isolatedElements.map(el => el.name).join(', ')}`
      );
    }

    console.log(`✅ Validación completada. Válido: ${validationResults.diagram.isValid}`);

    res.json({
      message: 'Validación completada',
      ...validationResults
    });
  } catch (error) {
    console.error('❌ Error al validar diagrama:', error);
    res.status(500).json({ message: 'Error al validar diagrama', error: error.message });
  }
};

// Helper functions
function generatePlantUML(diagram, elements, connections) {
  let plantuml = `@startuml ${diagram.name.replace(/\s+/g, '_')}\n\n`;

  // Agregar elementos
  elements.forEach(element => {
    switch (element.type) {
      case 'class':
        plantuml += generatePlantUMLClass(element);
        break;
      case 'interface':
        plantuml += `interface ${element.name} {\n`;
        element.properties.operations.forEach(op => {
          plantuml += `  ${op.name}()\n`;
        });
        plantuml += `}\n\n`;
        break;
      case 'enum':
        plantuml += `enum ${element.name} {\n`;
        element.properties.literals.forEach(literal => {
          plantuml += `  ${literal.name}\n`;
        });
        plantuml += `}\n\n`;
        break;
    }
  });

  // Agregar relaciones
  connections.forEach(connection => {
    if (connection.sourceElement && connection.targetElement) {
      plantuml += generatePlantUMLRelation(connection);
    }
  });

  plantuml += '@enduml\n';
  return plantuml;
}

function generatePlantUMLClass(element) {
  let classStr = `class ${element.name} {\n`;

  // Atributos
  element.properties.attributes.forEach(attr => {
    const visibility = attr.visibility === 'private' ? '-' :
                      attr.visibility === 'protected' ? '#' : '+';
    classStr += `  ${visibility}${attr.name} : ${attr.type}\n`;
  });

  // Métodos
  element.properties.operations.forEach(op => {
    const visibility = op.visibility === 'private' ? '-' :
                      op.visibility === 'protected' ? '#' : '+';
    classStr += `  ${visibility}${op.name}() : ${op.returnType}\n`;
  });

  classStr += '}\n\n';
  return classStr;
}

function generatePlantUMLRelation(connection) {
  const source = connection.sourceElement.name;
  const target = connection.targetElement.name;

  switch (connection.type) {
    case 'inheritance':
      return `${source} --|> ${target}\n`;
    case 'realization':
      return `${source} ..|> ${target}\n`;
    case 'association':
      return `${source} --> ${target}\n`;
    case 'aggregation':
      return `${source} o-- ${target}\n`;
    case 'composition':
      return `${source} *-- ${target}\n`;
    case 'dependency':
      return `${source} ..> ${target}\n`;
    default:
      return `${source} -- ${target}\n`;
  }
}

function generateXMI(diagram, elements, connections) {
  // Implementación básica de XMI - esto sería más complejo en una implementación real
  const xmi = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmlns:xmi="http://www.omg.org/XMI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:uml="http://www.eclipse.org/uml2/3.0.0/UML">
  <uml:Model xmi:id="${diagram._id}" name="${diagram.name}">
    ${elements.map(element => `
    <packagedElement xmi:type="uml:Class" xmi:id="${element._id}" name="${element.name}"/>
    `).join('')}
  </uml:Model>
</xmi:XMI>`;
  return xmi;
}

function getFileExtension(format) {
  const extensions = {
    plantuml: 'puml',
    xmi: 'xmi',
    json: 'json'
  };
  return extensions[format] || 'txt';
}

module.exports = {
  getUMLElements: exports.getUMLElements,
  createUMLElement: exports.createUMLElement,
  updateUMLElement: exports.updateUMLElement,
  deleteUMLElement: exports.deleteUMLElement,
  duplicateUMLElement: exports.duplicateUMLElement,
  exportUML: exports.exportUML,
  generateCode: exports.generateCode,
  validateUML: exports.validateUML
};