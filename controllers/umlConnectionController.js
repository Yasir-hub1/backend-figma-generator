// backend/controllers/umlConnectionController.js - Controlador para Conexiones/Relaciones UML
const UMLConnection = require('../models/UMLConnection');
const UMLElement = require('../models/UMLElement');
const Diagram = require('../models/Diagram');
const Project = require('../models/Project');

// Obtener todas las conexiones de un diagrama
exports.getUMLConnections = async (req, res) => {
  try {
    const { diagramId } = req.params;

    console.log('🔗 Obteniendo conexiones UML del diagrama:', diagramId);

    // Verificar que el diagrama existe y el usuario tiene acceso
    const diagram = await Diagram.findById(diagramId);
    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para acceder a este diagrama' });
    }

    const connections = await UMLConnection.find({ diagramId })
      .sort({ zIndex: 1, createdAt: 1 })
      .populate('sourceElement targetElement');

    console.log(`✅ ${connections.length} conexiones encontradas`);

    res.json({
      message: 'Conexiones UML obtenidas correctamente',
      connections
    });
  } catch (error) {
    console.error('❌ Error al obtener conexiones UML:', error);
    res.status(500).json({ message: 'Error al obtener conexiones UML', error: error.message });
  }
};

// Crear conexión UML
exports.createUMLConnection = async (req, res) => {
  try {
    const {
      diagramId, sourceElementId, targetElementId, type,
      properties, connectionPoints, waypoints, styles, labelPositions
    } = req.body;

    console.log('📝 Creando conexión UML:', {
      type, diagramId, sourceElementId, targetElementId, userId: req.userId
    });

    // Verificar que el diagrama existe y el usuario tiene acceso
    const diagram = await Diagram.findById(diagramId);
    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para crear conexiones en este diagrama' });
    }

    // Verificar que los elementos existen y pertenecen al diagrama
    const sourceElement = await UMLElement.findOne({ _id: sourceElementId, diagramId });
    const targetElement = await UMLElement.findOne({ _id: targetElementId, diagramId });

    if (!sourceElement) {
      return res.status(404).json({ message: 'Elemento origen no encontrado en el diagrama' });
    }

    if (!targetElement) {
      return res.status(404).json({ message: 'Elemento destino no encontrado en el diagrama' });
    }

    // Verificar que no sea una auto-conexión
    if (sourceElementId === targetElementId) {
      return res.status(400).json({ message: 'Un elemento no puede conectarse a sí mismo' });
    }

    // Verificar si ya existe una conexión del mismo tipo entre los mismos elementos
    const existingConnection = await UMLConnection.checkDuplicate(sourceElementId, targetElementId, type);
    if (existingConnection) {
      return res.status(400).json({
        message: `Ya existe una conexión de tipo "${type}" entre estos elementos`
      });
    }

    // Valores por defecto según el tipo de conexión
    const getDefaultProperties = (connectionType) => {
      const defaults = {
        association: {
          name: '',
          stereotype: '',
          sourceMultiplicity: '1',
          targetMultiplicity: '*',
          sourceRole: '',
          targetRole: '',
          sourceNavigable: true,
          targetNavigable: true,
          bidirectional: false
        },
        aggregation: {
          name: '',
          stereotype: '',
          sourceMultiplicity: '1',
          targetMultiplicity: '*',
          sourceRole: 'whole',
          targetRole: 'part',
          sourceNavigable: true,
          targetNavigable: false,
          bidirectional: false
        },
        composition: {
          name: '',
          stereotype: '',
          sourceMultiplicity: '1',
          targetMultiplicity: '*',
          sourceRole: 'whole',
          targetRole: 'part',
          sourceNavigable: true,
          targetNavigable: false,
          bidirectional: false
        },
        inheritance: {
          name: '',
          stereotype: '',
          sourceMultiplicity: '',
          targetMultiplicity: '',
          sourceRole: 'child',
          targetRole: 'parent',
          sourceNavigable: false,
          targetNavigable: false,
          bidirectional: false
        },
        realization: {
          name: '',
          stereotype: '<<realize>>',
          sourceMultiplicity: '',
          targetMultiplicity: '',
          sourceRole: 'implementer',
          targetRole: 'interface',
          sourceNavigable: false,
          targetNavigable: false,
          bidirectional: false
        },
        dependency: {
          name: '',
          stereotype: '<<use>>',
          sourceMultiplicity: '',
          targetMultiplicity: '',
          sourceRole: 'client',
          targetRole: 'supplier',
          sourceNavigable: false,
          targetNavigable: false,
          bidirectional: false,
          dependencyType: 'use'
        },
        use: {
          name: '',
          stereotype: '',
          sourceMultiplicity: '',
          targetMultiplicity: '',
          sourceRole: 'actor',
          targetRole: 'use_case',
          sourceNavigable: false,
          targetNavigable: false,
          bidirectional: false
        },
        include: {
          name: '',
          stereotype: '<<include>>',
          condition: '',
          sourceMultiplicity: '',
          targetMultiplicity: '',
          sourceRole: 'base',
          targetRole: 'inclusion',
          sourceNavigable: false,
          targetNavigable: false,
          bidirectional: false
        },
        extend: {
          name: '',
          stereotype: '<<extend>>',
          condition: '',
          sourceMultiplicity: '',
          targetMultiplicity: '',
          sourceRole: 'extension',
          targetRole: 'base',
          sourceNavigable: false,
          targetNavigable: false,
          bidirectional: false
        },
        // Relaciones de Cardinalidad/Multiplicidad
        'one-to-one': {
          name: 'uno a uno',
          stereotype: '',
          sourceMultiplicity: '1',
          targetMultiplicity: '1',
          sourceRole: 'uno',
          targetRole: 'uno',
          sourceNavigable: true,
          targetNavigable: true,
          bidirectional: true,
          cardinality: { source: '1', target: '1' }
        },
        'one-to-many': {
          name: 'uno a muchos',
          stereotype: '',
          sourceMultiplicity: '1',
          targetMultiplicity: '*',
          sourceRole: 'uno',
          targetRole: 'muchos',
          sourceNavigable: true,
          targetNavigable: false,
          bidirectional: false,
          cardinality: { source: '1', target: '*' }
        },
        'many-to-one': {
          name: 'muchos a uno',
          stereotype: '',
          sourceMultiplicity: '*',
          targetMultiplicity: '1',
          sourceRole: 'muchos',
          targetRole: 'uno',
          sourceNavigable: false,
          targetNavigable: true,
          bidirectional: false,
          cardinality: { source: '*', target: '1' }
        },
        'many-to-many': {
          name: 'muchos a muchos',
          stereotype: '',
          sourceMultiplicity: '*',
          targetMultiplicity: '*',
          sourceRole: 'muchos',
          targetRole: 'muchos',
          sourceNavigable: true,
          targetNavigable: true,
          bidirectional: true,
          cardinality: { source: '*', target: '*' }
        },
        'zero-to-one': {
          name: 'cero a uno',
          stereotype: '',
          sourceMultiplicity: '0..1',
          targetMultiplicity: '1',
          sourceRole: 'opcional',
          targetRole: 'obligatorio',
          sourceNavigable: false,
          targetNavigable: true,
          bidirectional: false,
          cardinality: { source: '0..1', target: '1' }
        },
        'zero-to-many': {
          name: 'cero a muchos',
          stereotype: '',
          sourceMultiplicity: '0..1',
          targetMultiplicity: '*',
          sourceRole: 'opcional',
          targetRole: 'muchos',
          sourceNavigable: false,
          targetNavigable: true,
          bidirectional: false,
          cardinality: { source: '0..1', target: '*' }
        },
        'one-or-many': {
          name: 'uno o muchos',
          stereotype: '',
          sourceMultiplicity: '1..*',
          targetMultiplicity: '*',
          sourceRole: 'uno o más',
          targetRole: 'muchos',
          sourceNavigable: true,
          targetNavigable: false,
          bidirectional: false,
          cardinality: { source: '1..*', target: '*' }
        },
        // Tabla Intermedia
        'intermediate-table': {
          name: 'tabla intermedia',
          stereotype: '',
          sourceMultiplicity: '*',
          targetMultiplicity: '*',
          sourceRole: 'entidad',
          targetRole: 'entidad',
          sourceNavigable: true,
          targetNavigable: true,
          bidirectional: true,
          isIntermediateTable: true,
          cardinality: { source: '*', target: '*' },
          intermediateTableInfo: {
            name: 'TablaIntermedia',
            description: 'Tabla intermedia para relación muchos a muchos',
            attributes: [
              { name: 'id', type: 'String', required: true, defaultValue: '' },
              { name: 'createdAt', type: 'String', required: true, defaultValue: 'new Date()' }
            ]
          }
        }
      };
      return defaults[connectionType] || defaults.association;
    };

    // Preparar propiedades con manejo especial para tablas intermedias
    const defaultProps = getDefaultProperties(type);
    let finalProperties = {
      ...defaultProps,
      ...properties
    };

    // Manejo especial para tablas intermedias
    if (type === 'intermediate-table') {
      // Asegurar que intermediateTableInfo tenga la estructura correcta
      if (!finalProperties.intermediateTableInfo) {
        finalProperties.intermediateTableInfo = defaultProps.intermediateTableInfo;
      } else {
        // Validar y corregir la estructura de attributes si es necesario
        if (finalProperties.intermediateTableInfo.attributes) {
          finalProperties.intermediateTableInfo.attributes = finalProperties.intermediateTableInfo.attributes.map(attr => ({
            name: attr.name || '',
            type: attr.type || 'String',
            required: Boolean(attr.required),
            defaultValue: String(attr.defaultValue || '')
          }));
        }
      }

      // Crear un elemento UML real para la tabla intermedia
      const tableInfo = finalProperties.intermediateTableInfo;
      
      // Calcular posición en el punto medio entre los elementos
      const sourceElement = await UMLElement.findById(sourceElementId);
      const targetElement = await UMLElement.findById(targetElementId);
      
      if (sourceElement && targetElement) {
        const sourceCenter = {
          x: sourceElement.position.x + sourceElement.size.width / 2,
          y: sourceElement.position.y + sourceElement.size.height / 2
        };
        
        const targetCenter = {
          x: targetElement.position.x + targetElement.size.width / 2,
          y: targetElement.position.y + targetElement.size.height / 2
        };
        
        const tablePosition = {
          x: (sourceCenter.x + targetCenter.x) / 2 - 125, // Mitad del ancho de la tabla
          y: (sourceCenter.y + targetCenter.y) / 2 - 75   // Mitad de la altura de la tabla
        };

        // Crear el elemento tabla intermedia
        const intermediateTableElement = new UMLElement({
          diagramId,
          name: tableInfo.name || 'TablaIntermedia',
          type: 'intermediate_table',
          position: tablePosition,
          size: { width: 250, height: 150 },
          properties: {
            stereotype: '<<Intermediate Table>>',
            attributes: tableInfo.attributes || [],
            operations: [
              {
                name: 'getAttributes',
                parameters: [],
                returnType: 'Array',
                visibility: 'public'
              },
              {
                name: 'setAttributes',
                parameters: [{ name: 'attrs', type: 'Array' }],
                returnType: 'void',
                visibility: 'public'
              }
            ],
            isIntermediateTable: true,
            intermediateTableInfo: tableInfo
          }
        });

        await intermediateTableElement.save();
        
        // Actualizar la conexión para referenciar la tabla intermedia
        finalProperties.intermediateTableElementId = intermediateTableElement._id;
        
        console.log('✅ Tabla intermedia creada como elemento UML:', intermediateTableElement._id);

        // Crear conexiones desde y hacia la tabla intermedia (SIN FLECHAS - solo líneas)
        const sourceToTableConnection = new UMLConnection({
          diagramId,
          sourceElementId: sourceElement._id,
          targetElementId: intermediateTableElement._id,
          type: 'intermediate-table-connection',  // Tipo específico para conexiones de tabla intermedia
          properties: {
            name: `${sourceElement.name} to ${intermediateTableElement.name}`,
            sourceMultiplicity: '*',
            targetMultiplicity: '1',
            sourceRole: sourceElement.name.toLowerCase(),
            targetRole: intermediateTableElement.name.toLowerCase(),
            isIntermediateTableConnection: true
          },
          connectionPoints: {
            source: { x: 0.8, y: 0.5, side: 'right' },
            target: { x: 0.2, y: 0.5, side: 'left' }
          },
          styles: {
            lineColor: '#FF6B35',
            lineWidth: 2,
            lineStyle: 'solid',
            arrowSize: 0,  // Sin flecha
            markerEnd: 'none'  // Sin marcador de flecha
          }
        });

        const tableToTargetConnection = new UMLConnection({
          diagramId,
          sourceElementId: intermediateTableElement._id,
          targetElementId: targetElement._id,
          type: 'intermediate-table-connection',  // Tipo específico para conexiones de tabla intermedia
          properties: {
            name: `${intermediateTableElement.name} to ${targetElement.name}`,
            sourceMultiplicity: '1',
            targetMultiplicity: '*',
            sourceRole: intermediateTableElement.name.toLowerCase(),
            targetRole: targetElement.name.toLowerCase(),
            isIntermediateTableConnection: true
          },
          connectionPoints: {
            source: { x: 0.8, y: 0.5, side: 'right' },
            target: { x: 0.2, y: 0.5, side: 'left' }
          },
          styles: {
            lineColor: '#FF6B35',
            lineWidth: 2,
            lineStyle: 'solid',
            arrowSize: 0,  // Sin flecha
            markerEnd: 'none'  // Sin marcador de flecha
          }
        });

        await sourceToTableConnection.save();
        await tableToTargetConnection.save();

        console.log('✅ Conexiones de tabla intermedia creadas:', {
          sourceToTable: sourceToTableConnection._id,
          tableToTarget: tableToTargetConnection._id
        });

        // Poblar las conexiones antes de emitir eventos
        const populatedSourceToTable = await UMLConnection.findById(sourceToTableConnection._id)
          .populate('sourceElement')
          .populate('targetElement');
        
        const populatedTableToTarget = await UMLConnection.findById(tableToTargetConnection._id)
          .populate('sourceElement')
          .populate('targetElement');

        console.log('🔍 Conexiones populadas:');
        console.log('SourceToTable:', {
          id: populatedSourceToTable._id,
          source: populatedSourceToTable.sourceElement?.name,
          target: populatedSourceToTable.targetElement?.name,
          type: populatedSourceToTable.type
        });
        console.log('TableToTarget:', {
          id: populatedTableToTarget._id,
          source: populatedTableToTarget.sourceElement?.name,
          target: populatedTableToTarget.targetElement?.name,
          type: populatedTableToTarget.type
        });

        // Emitir eventos de socket para el elemento y las conexiones creadas
        if (global.io) {
          // Emitir evento para el elemento de tabla intermedia PRIMERO
          global.io.to(diagram.projectId.toString()).emit('uml-updated', {
            type: 'element-added',
            element: intermediateTableElement,
            diagramId: diagram._id,
            projectId: diagram.projectId,
            userId: req.userId
          });

          console.log('📡 Evento element-added emitido para tabla intermedia');

          // Esperar un momento antes de emitir las conexiones para asegurar que el elemento esté disponible
          setTimeout(() => {
            // Emitir eventos para las conexiones populadas
            global.io.to(diagram.projectId.toString()).emit('uml-updated', {
              type: 'connection-added',
              connection: populatedSourceToTable,
              diagramId: diagram._id,
              projectId: diagram.projectId,
              userId: req.userId
            });

            global.io.to(diagram.projectId.toString()).emit('uml-updated', {
              type: 'connection-added',
              connection: populatedTableToTarget,
              diagramId: diagram._id,
              projectId: diagram.projectId,
              userId: req.userId
            });

            console.log('📡 Eventos connection-added emitidos para conexiones de tabla intermedia');
          }, 100); // Pequeño delay para asegurar que el elemento se procese primero
        }
      }
    }

    // Para tablas intermedias, NO crear la conexión original entre elementos
    // Solo crear las conexiones a la tabla intermedia
    if (type === 'intermediate-table') {
      console.log('✅ Tabla intermedia creada - no se crea conexión directa entre elementos originales');
      
      // Retornar solo la información de que se creó la tabla intermedia
      return res.status(201).json({
        message: 'Tabla intermedia creada exitosamente',
        intermediateTable: true,
        connectionsCreated: 2
      });
    }

    const connection = new UMLConnection({
      diagramId,
      sourceElementId,
      targetElementId,
      type,
      properties: finalProperties,
      connectionPoints: connectionPoints || {
        source: { x: 0.5, y: 0.5, side: 'right' },
        target: { x: 0.5, y: 0.5, side: 'left' }
      },
      waypoints: waypoints || [],
      styles: {
        lineColor: '#000000',
        lineWidth: 1,
        lineStyle: type === 'realization' || type === 'dependency' ? 'dashed' : 'solid',
        arrowSize: 10,
        fontSize: 10,
        fontFamily: 'Arial, sans-serif',
        textColor: '#000000',
        ...styles
      },
      labelPositions: labelPositions || {
        name: { x: 0.5, y: 0.5, offset: { x: 0, y: -10 } },
        sourceMultiplicity: { x: 0.1, y: 0.1, offset: { x: 5, y: -5 } },
        targetMultiplicity: { x: 0.9, y: 0.9, offset: { x: -5, y: -5 } }
      }
    });

    // Validar la conexión según reglas UML
    const validation = await connection.validateUMLRules();
    if (!validation.isValid) {
      return res.status(400).json({
        message: 'Conexión inválida según reglas UML',
        errors: validation.errors
      });
    }

    await connection.save();

    // Cargar la conexión con sus elementos populados
    const populatedConnection = await UMLConnection.findById(connection._id)
      .populate('sourceElement targetElement');

    console.log('✅ Conexión UML creada exitosamente:', connection._id);

    // Emitir evento de socket para actualización en tiempo real
    if (global.io) {
      global.io.to(diagram.projectId.toString()).emit('uml-updated', {
        type: 'connection-added',
        connection: populatedConnection,
        diagramId: diagram._id,
        projectId: diagram.projectId,
        userId: req.userId,
        username: req.user?.username || req.user?.name || 'Usuario'
      });
      console.log('📡 Evento de socket emitido: connection-added');
    }

    res.status(201).json({
      message: 'Conexión UML creada con éxito',
      connection: populatedConnection
    });
  } catch (error) {
    console.error('❌ Error al crear conexión UML:', error);
    res.status(500).json({ message: 'Error al crear conexión UML', error: error.message });
  }
};

// Actualizar conexión UML
exports.updateUMLConnection = async (req, res) => {
  try {
    const { connectionId } = req.params;
    const updates = req.body;

    console.log('📝 Actualizando conexión UML:', connectionId);

    const connection = await UMLConnection.findById(connectionId);

    if (!connection) {
      return res.status(404).json({ message: 'Conexión UML no encontrada' });
    }

    // Verificar permisos del diagrama/proyecto
    const diagram = await Diagram.findById(connection.diagramId);
    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para actualizar esta conexión' });
    }

    // Campos permitidos para actualización
    const allowedUpdates = [
      'type', 'properties', 'connectionPoints', 'waypoints', 'styles', 'labelPositions', 'zIndex', 'visible'
    ];

    const updateData = {};
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });

    // Si se cambió el tipo, verificar duplicados
    if (updates.type && updates.type !== connection.type) {
      const existingConnection = await UMLConnection.checkDuplicate(
        connection.sourceElementId,
        connection.targetElementId,
        updates.type
      );

      if (existingConnection) {
        return res.status(400).json({
          message: `Ya existe una conexión de tipo "${updates.type}" entre estos elementos`
        });
      }
    }

    const updatedConnection = await UMLConnection.findByIdAndUpdate(
      connectionId,
      updateData,
      { new: true, runValidators: true }
    ).populate('sourceElement targetElement');

    // Validar la conexión actualizada según reglas UML
    const validation = await updatedConnection.validateUMLRules();
    if (!validation.isValid) {
      return res.status(400).json({
        message: 'Conexión actualizada es inválida según reglas UML',
        errors: validation.errors
      });
    }

    console.log('✅ Conexión UML actualizada:', updatedConnection.type);

    // Emitir evento de socket para actualización en tiempo real
    if (global.io) {
      global.io.to(diagram.projectId.toString()).emit('uml-updated', {
        type: 'connection-updated',
        connection: updatedConnection,
        diagramId: diagram._id,
        projectId: diagram.projectId,
        userId: req.userId,
        username: req.user?.username || req.user?.name || 'Usuario'
      });
      console.log('📡 Evento de socket emitido: connection-updated');
    }

    res.json({
      message: 'Conexión UML actualizada correctamente',
      connection: updatedConnection
    });
  } catch (error) {
    console.error('❌ Error al actualizar conexión UML:', error);
    res.status(500).json({ message: 'Error al actualizar conexión UML', error: error.message });
  }
};

// Eliminar conexión UML
exports.deleteUMLConnection = async (req, res) => {
  try {
    const { connectionId } = req.params;

    console.log('🗑️ Eliminando conexión UML:', connectionId);

    const connection = await UMLConnection.findById(connectionId);

    if (!connection) {
      return res.status(404).json({ message: 'Conexión UML no encontrada' });
    }

    // Verificar permisos del diagrama/proyecto
    const diagram = await Diagram.findById(connection.diagramId);
    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para eliminar esta conexión' });
    }

    // Eliminar la conexión
    await UMLConnection.findByIdAndDelete(connectionId);

    console.log('✅ Conexión UML eliminada exitosamente');

    // Emitir evento de socket para actualización en tiempo real
    if (global.io) {
      global.io.to(diagram.projectId.toString()).emit('uml-updated', {
        type: 'connection-deleted',
        connectionId: connectionId,
        diagramId: diagram._id,
        projectId: diagram.projectId,
        userId: req.userId,
        username: req.user?.username || req.user?.name || 'Usuario'
      });
      console.log('📡 Evento de socket emitido: connection-deleted');
    }

    res.json({
      message: 'Conexión UML eliminada correctamente'
    });
  } catch (error) {
    console.error('❌ Error al eliminar conexión UML:', error);
    res.status(500).json({ message: 'Error al eliminar conexión UML', error: error.message });
  }
};

// Obtener conexiones entre dos elementos específicos
exports.getConnectionsBetweenElements = async (req, res) => {
  try {
    const { elementId1, elementId2 } = req.params;

    console.log('🔍 Buscando conexiones entre elementos:', elementId1, elementId2);

    // Verificar que los elementos existen
    const element1 = await UMLElement.findById(elementId1);
    const element2 = await UMLElement.findById(elementId2);

    if (!element1 || !element2) {
      return res.status(404).json({ message: 'Uno o ambos elementos no encontrados' });
    }

    // Verificar que ambos elementos están en el mismo diagrama
    if (!element1.diagramId.equals(element2.diagramId)) {
      return res.status(400).json({ message: 'Los elementos deben estar en el mismo diagrama' });
    }

    // Verificar permisos del diagrama/proyecto
    const diagram = await Diagram.findById(element1.diagramId);
    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para acceder a este diagrama' });
    }

    const connections = await UMLConnection.findBetweenElements(elementId1, elementId2)
      .populate('sourceElement targetElement');

    console.log(`✅ ${connections.length} conexiones encontradas entre los elementos`);

    res.json({
      message: 'Conexiones entre elementos obtenidas correctamente',
      connections
    });
  } catch (error) {
    console.error('❌ Error al buscar conexiones entre elementos:', error);
    res.status(500).json({ message: 'Error al buscar conexiones', error: error.message });
  }
};

// Obtener estadísticas de conexiones de un elemento
exports.getElementConnectionStats = async (req, res) => {
  try {
    const { elementId } = req.params;

    console.log('📊 Obteniendo estadísticas de conexiones del elemento:', elementId);

    const element = await UMLElement.findById(elementId);

    if (!element) {
      return res.status(404).json({ message: 'Elemento no encontrado' });
    }

    // Verificar permisos del diagrama/proyecto
    const diagram = await Diagram.findById(element.diagramId);
    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para acceder a este elemento' });
    }

    // Obtener conexiones entrantes y salientes
    const incomingConnections = await UMLConnection.find({ targetElementId: elementId })
      .populate('sourceElement');

    const outgoingConnections = await UMLConnection.find({ sourceElementId: elementId })
      .populate('targetElement');

    // Agrupar por tipo de conexión
    const incomingByType = incomingConnections.reduce((acc, conn) => {
      acc[conn.type] = (acc[conn.type] || 0) + 1;
      return acc;
    }, {});

    const outgoingByType = outgoingConnections.reduce((acc, conn) => {
      acc[conn.type] = (acc[conn.type] || 0) + 1;
      return acc;
    }, {});

    const stats = {
      element: {
        id: element._id,
        name: element.name,
        type: element.type
      },
      totalIncoming: incomingConnections.length,
      totalOutgoing: outgoingConnections.length,
      totalConnections: incomingConnections.length + outgoingConnections.length,
      incomingByType,
      outgoingByType,
      connectedElements: {
        incoming: incomingConnections.map(conn => ({
          id: conn.sourceElement._id,
          name: conn.sourceElement.name,
          type: conn.sourceElement.type,
          connectionType: conn.type
        })),
        outgoing: outgoingConnections.map(conn => ({
          id: conn.targetElement._id,
          name: conn.targetElement.name,
          type: conn.targetElement.type,
          connectionType: conn.type
        }))
      }
    };

    console.log('✅ Estadísticas de conexiones obtenidas');

    res.json({
      message: 'Estadísticas de conexiones obtenidas correctamente',
      stats
    });
  } catch (error) {
    console.error('❌ Error al obtener estadísticas de conexiones:', error);
    res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message });
  }
};

// Validar todas las conexiones de un diagrama
exports.validateAllConnections = async (req, res) => {
  try {
    const { diagramId } = req.params;

    console.log('✅ Validando todas las conexiones del diagrama:', diagramId);

    // Verificar que el diagrama existe y el usuario tiene acceso
    const diagram = await Diagram.findById(diagramId);
    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para validar este diagrama' });
    }

    const connections = await UMLConnection.find({ diagramId })
      .populate('sourceElement targetElement');

    const validationResults = [];
    let allValid = true;

    for (const connection of connections) {
      const validation = await connection.validateUMLRules();

      validationResults.push({
        connectionId: connection._id,
        type: connection.type,
        source: connection.sourceElement?.name || 'Unknown',
        target: connection.targetElement?.name || 'Unknown',
        isValid: validation.isValid,
        errors: validation.errors
      });

      if (!validation.isValid) {
        allValid = false;
      }
    }

    console.log(`✅ Validación completada. ${validationResults.length} conexiones validadas`);

    res.json({
      message: 'Validación de conexiones completada',
      allValid,
      totalConnections: connections.length,
      validConnections: validationResults.filter(r => r.isValid).length,
      invalidConnections: validationResults.filter(r => !r.isValid).length,
      results: validationResults
    });
  } catch (error) {
    console.error('❌ Error al validar conexiones:', error);
    res.status(500).json({ message: 'Error al validar conexiones', error: error.message });
  }
};

module.exports = {
  getUMLConnections: exports.getUMLConnections,
  createUMLConnection: exports.createUMLConnection,
  updateUMLConnection: exports.updateUMLConnection,
  deleteUMLConnection: exports.deleteUMLConnection,
  getConnectionsBetweenElements: exports.getConnectionsBetweenElements,
  getElementConnectionStats: exports.getElementConnectionStats,
  validateAllConnections: exports.validateAllConnections
};