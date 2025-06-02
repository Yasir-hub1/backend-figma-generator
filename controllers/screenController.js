// backend/controllers/screenController.js
const Screen = require('../models/Screen');
const Project = require('../models/Project');
const Element = require('../models/Element');

// Crear una nueva screen
exports.createScreen = async (req, res) => {
  try {
    console.log("createScreen ",req.body)
    const { projectId, name, canvas } = req.body;
    
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar permisos
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para crear screens en este proyecto' });
    }
    
    // Obtener el siguiente orden
    const screenCount = await Screen.countDocuments({ projectId });
    
    const screen = new Screen({
      name: name || `Screen ${screenCount + 1}`,
      projectId,
      canvas: canvas || { 
        width: project.canvas?.width || 360, 
        height: project.canvas?.height || 640,
        background: project.canvas?.background || '#FFFFFF'
      },
      order: screenCount
    });
    
    await screen.save();
    
    res.status(201).json({
      message: 'Screen creada con éxito',
      screen
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear screen', error: error.message });
  }
};

// Obtener todas las screens de un proyecto
exports.getScreens = async (req, res) => {
  try {
    console.log("GET SCRREEN ",req.params);
    const { projectId } = req.params;
    
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar permisos
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para ver este proyecto' });
    }
    
    const screens = await Screen.find({ projectId }).sort({ order: 1 });
    
    res.status(200).json(screens);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener screens', error: error.message });
  }
};

// Obtener una screen específica
exports.getScreen = async (req, res) => {
  try {
    const { id } = req.params;
    
    const screen = await Screen.findById(id);
    if (!screen) {
      return res.status(404).json({ message: 'Screen no encontrada' });
    }
    
    // Verificar permisos del proyecto
    const project = await Project.findById(screen.projectId);
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para ver esta screen' });
    }
    
    res.status(200).json(screen);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener screen', error: error.message });
  }
};

// Actualizar una screen
exports.updateScreen = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, canvas } = req.body;
    
    const screen = await Screen.findById(id);
    if (!screen) {
      return res.status(404).json({ message: 'Screen no encontrada' });
    }
    
    // Verificar permisos
    const project = await Project.findById(screen.projectId);
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para editar esta screen' });
    }
    
    screen.name = name || screen.name;
    screen.canvas = { ...screen.canvas, ...canvas };
    screen.updatedAt = Date.now();
    
    await screen.save();
    
    res.status(200).json({
      message: 'Screen actualizada con éxito',
      screen
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar screen', error: error.message });
  }
};

// Eliminar una screen
exports.deleteScreen = async (req, res) => {
  try {
    console.log("deleteScreen",JSON.stringify(req.params.id));
    const { id } = req.params;
    
    const screen = await Screen.findById(id);
    if (!screen) {
      return res.status(404).json({ message: 'Screen no encontrada' });
    }
    
    // Verificar permisos
    const project = await Project.findById(screen.projectId);
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar esta screen' });
    }
    
    // Verificar que no sea la única screen
    const totalScreens = await Screen.countDocuments({ projectId: screen.projectId });
    if (totalScreens <= 1) {
      return res.status(400).json({ message: 'No se puede eliminar la única screen del proyecto' });
    }
    
    // Eliminar todos los elementos de la screen
    await Element.deleteMany({ screenId: id });
    
    // Eliminar la screen
    await Screen.findByIdAndDelete(id);
    
    res.status(200).json({ message: 'Screen eliminada con éxito' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar screen', error: error.message });
  }
};

// Reordenar screens
exports.reorderScreens = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { screenOrders } = req.body; // Array de { id, order }
    
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar permisos
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para reordenar screens' });
    }
    
    // actualizar el orden de cada screen
    const updatePromises = screenOrders.map(({ id, order }) => 
      Screen.findByIdAndUpdate(id, { order, updatedAt: Date.now() })
    );
    
    await Promise.all(updatePromises);
    
    res.status(200).json({ message: 'Orden de screens actualizado con éxito' });
  } catch (error) {
    res.status(500).json({ message: 'Error al reordenar screens', error: error.message });
  }
};