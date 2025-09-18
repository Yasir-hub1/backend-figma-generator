// backend/controllers/diagramController.js - Controlador para Diagramas UML
const Diagram = require('../models/Diagram');
const UMLElement = require('../models/UMLElement');
const UMLConnection = require('../models/UMLConnection');
const Project = require('../models/Project');

// Obtener todos los diagramas de un proyecto
exports.getDiagrams = async (req, res) => {
  try {
    const { projectId } = req.params;

    console.log('📋 Obteniendo diagramas del proyecto:', projectId);

    // Verificar que el proyecto existe y el usuario tiene acceso
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    if (!project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para acceder a este proyecto' });
    }

    const diagrams = await Diagram.find({ projectId, status: 'active' })
      .sort({ order: 1, createdAt: 1 })
      .populate('elementCount connectionCount');

    console.log(`✅ ${diagrams.length} diagramas encontrados`);

    res.json({
      message: 'Diagramas obtenidos correctamente',
      diagrams
    });
  } catch (error) {
    console.error('❌ Error al obtener diagramas:', error);
    res.status(500).json({ message: 'Error al obtener diagramas', error: error.message });
  }
};

// Obtener un diagrama específico
exports.getDiagram = async (req, res) => {
  try {
    const { diagramId } = req.params;

    console.log('📊 Obteniendo diagrama:', diagramId);

    const diagram = await Diagram.findById(diagramId)
      .populate('elementCount connectionCount');

    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    // Verificar permisos del proyecto
    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para acceder a este diagrama' });
    }

    console.log('✅ Diagrama obtenido:', diagram.name);

    res.json({
      message: 'Diagrama obtenido correctamente',
      diagram
    });
  } catch (error) {
    console.error('❌ Error al obtener diagrama:', error);
    res.status(500).json({ message: 'Error al obtener diagrama', error: error.message });
  }
};

// Crear nuevo diagrama
exports.createDiagram = async (req, res) => {
  try {
    const { name, description, projectId, type, canvas, settings } = req.body;

    console.log('📝 Creando diagrama:', { name, type, projectId, userId: req.userId });

    // Verificar que el proyecto existe y el usuario tiene acceso
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    if (!project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para crear diagramas en este proyecto' });
    }

    // Canvas por defecto basado en el tipo de diagrama
    const getDefaultCanvas = (diagramType) => {
      const canvasDefaults = {
        class: { width: 1200, height: 800, background: '#FFFFFF' },
        sequence: { width: 1000, height: 600, background: '#FFFFFF' },
        usecase: { width: 800, height: 600, background: '#FFFFFF' },
        activity: { width: 800, height: 1000, background: '#FFFFFF' },
        state: { width: 800, height: 600, background: '#FFFFFF' },
        component: { width: 1000, height: 700, background: '#FFFFFF' },
        deployment: { width: 1000, height: 700, background: '#FFFFFF' }
      };
      return canvasDefaults[diagramType] || canvasDefaults.class;
    };

    const finalCanvas = canvas || getDefaultCanvas(type || 'class');

    const diagram = new Diagram({
      name,
      description,
      projectId,
      type: type || 'class',
      canvas: finalCanvas,
      settings: {
        showStereotypes: true,
        showVisibility: true,
        showOperations: true,
        showAttributes: true,
        gridVisible: true,
        snapToGrid: true,
        zoom: 1,
        ...settings
      }
    });

    await diagram.save();

    console.log('✅ Diagrama creado exitosamente:', diagram._id);

    // Emitir evento de socket para notificar a otros usuarios
    if (global.io) {
      global.io.to(projectId.toString()).emit('uml-updated', {
        type: 'diagram-added',
        diagram: diagram,
        projectId: projectId,
        userId: req.userId
      });
      console.log('📡 Evento diagram-added emitido para diagrama:', diagram._id);
    }

    res.status(201).json({
      message: 'Diagrama creado con éxito',
      diagram
    });
  } catch (error) {
    console.error('❌ Error al crear diagrama:', error);
    res.status(500).json({ message: 'Error al crear el diagrama', error: error.message });
  }
};

// Actualizar diagrama
exports.updateDiagram = async (req, res) => {
  try {
    const { diagramId } = req.params;
    const updates = req.body;

    console.log('📝 Actualizando diagrama:', diagramId);

    const diagram = await Diagram.findById(diagramId);

    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    // Verificar permisos del proyecto
    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para actualizar este diagrama' });
    }

    // Campos permitidos para actualización
    const allowedUpdates = [
      'name', 'description', 'type', 'canvas', 'settings', 'position', 'status'
    ];

    const updateData = {};
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });

    const updatedDiagram = await Diagram.findByIdAndUpdate(
      diagramId,
      updateData,
      { new: true, runValidators: true }
    ).populate('elementCount connectionCount');

    console.log('✅ Diagrama actualizado:', updatedDiagram.name);

    // Emitir evento de socket para notificar a otros usuarios
    if (global.io) {
      global.io.to(updatedDiagram.projectId.toString()).emit('uml-updated', {
        type: 'diagram-updated',
        diagram: updatedDiagram,
        projectId: updatedDiagram.projectId,
        userId: req.userId
      });
      console.log('📡 Evento diagram-updated emitido para diagrama:', updatedDiagram._id);
    }

    res.json({
      message: 'Diagrama actualizado correctamente',
      diagram: updatedDiagram
    });
  } catch (error) {
    console.error('❌ Error al actualizar diagrama:', error);
    res.status(500).json({ message: 'Error al actualizar diagrama', error: error.message });
  }
};

// Eliminar diagrama
exports.deleteDiagram = async (req, res) => {
  try {
    const { diagramId } = req.params;

    console.log('🗑️ Eliminando diagrama:', diagramId);

    const diagram = await Diagram.findById(diagramId);

    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    // Verificar permisos del proyecto
    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para eliminar este diagrama' });
    }

    // Eliminar elementos y conexiones asociadas
    await UMLElement.deleteMany({ diagramId });
    await UMLConnection.deleteMany({ diagramId });

    // Eliminar el diagrama
    await Diagram.findByIdAndDelete(diagramId);

    console.log('✅ Diagrama eliminado exitosamente');

    // Emitir evento de socket para notificar a otros usuarios
    if (global.io) {
      global.io.to(diagram.projectId.toString()).emit('uml-updated', {
        type: 'diagram-deleted',
        diagramId: diagramId,
        projectId: diagram.projectId,
        userId: req.userId
      });
      console.log('📡 Evento diagram-deleted emitido para diagrama:', diagramId);
    }

    res.json({
      message: 'Diagrama eliminado correctamente'
    });
  } catch (error) {
    console.error('❌ Error al eliminar diagrama:', error);
    res.status(500).json({ message: 'Error al eliminar diagrama', error: error.message });
  }
};

// Reordenar diagramas
exports.reorderDiagrams = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { diagramOrders } = req.body; // Array de { diagramId, order }

    console.log('🔄 Reordenando diagramas del proyecto:', projectId);

    // Verificar permisos del proyecto
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    if (!project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para reordenar diagramas en este proyecto' });
    }

    // Validar que todos los diagramas pertenecen al proyecto
    const diagramIds = diagramOrders.map(item => item.diagramId);
    const diagrams = await Diagram.find({
      _id: { $in: diagramIds },
      projectId
    });

    if (diagrams.length !== diagramIds.length) {
      return res.status(400).json({ message: 'Algunos diagramas no pertenecen al proyecto' });
    }

    // Reordenar usando el método estático del modelo
    await Diagram.reorderDiagrams(projectId, diagramOrders);

    // Obtener diagramas actualizados
    const updatedDiagrams = await Diagram.find({ projectId, status: 'active' })
      .sort({ order: 1 })
      .populate('elementCount connectionCount');

    console.log('✅ Diagramas reordenados exitosamente');

    res.json({
      message: 'Diagramas reordenados correctamente',
      diagrams: updatedDiagrams
    });
  } catch (error) {
    console.error('❌ Error al reordenar diagramas:', error);
    res.status(500).json({ message: 'Error al reordenar diagramas', error: error.message });
  }
};

// Duplicar diagrama
exports.duplicateDiagram = async (req, res) => {
  try {
    const { diagramId } = req.params;
    const { name } = req.body;

    console.log('📋 Duplicando diagrama:', diagramId);

    const diagram = await Diagram.findById(diagramId);

    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    // Verificar permisos del proyecto
    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para duplicar este diagrama' });
    }

    const duplicatedDiagram = await diagram.duplicate(name);

    console.log('✅ Diagrama duplicado exitosamente:', duplicatedDiagram._id);

    res.status(201).json({
      message: 'Diagrama duplicado correctamente',
      diagram: duplicatedDiagram
    });
  } catch (error) {
    console.error('❌ Error al duplicar diagrama:', error);
    res.status(500).json({ message: 'Error al duplicar diagrama', error: error.message });
  }
};

// Obtener estadísticas del diagrama
exports.getDiagramStats = async (req, res) => {
  try {
    const { diagramId } = req.params;

    console.log('📊 Obteniendo estadísticas del diagrama:', diagramId);

    const diagram = await Diagram.findById(diagramId);

    if (!diagram) {
      return res.status(404).json({ message: 'Diagrama no encontrado' });
    }

    // Verificar permisos del proyecto
    const project = await Project.findById(diagram.projectId);
    if (!project || !project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para acceder a este diagrama' });
    }

    // Obtener estadísticas
    const elementCount = await UMLElement.countDocuments({ diagramId });
    const connectionCount = await UMLConnection.countDocuments({ diagramId });

    // Estadísticas por tipo de elemento
    const elementStats = await UMLElement.aggregate([
      { $match: { diagramId: diagram._id } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    // Estadísticas por tipo de conexión
    const connectionStats = await UMLConnection.aggregate([
      { $match: { diagramId: diagram._id } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const stats = {
      totalElements: elementCount,
      totalConnections: connectionCount,
      elementsByType: elementStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      connectionsByType: connectionStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      lastUpdated: diagram.updatedAt,
      canvasSize: diagram.canvas
    };

    console.log('✅ Estadísticas obtenidas');

    res.json({
      message: 'Estadísticas obtenidas correctamente',
      stats
    });
  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
    res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message });
  }
};

module.exports = {
  getDiagrams: exports.getDiagrams,
  getDiagram: exports.getDiagram,
  createDiagram: exports.createDiagram,
  updateDiagram: exports.updateDiagram,
  deleteDiagram: exports.deleteDiagram,
  reorderDiagrams: exports.reorderDiagrams,
  duplicateDiagram: exports.duplicateDiagram,
  getDiagramStats: exports.getDiagramStats
};