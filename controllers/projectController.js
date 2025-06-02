// backend/controllers/projectController.js - CORREGIDO Y COMPLETO
const Project = require('../models/Project');
const Screen = require('../models/Screen');
const Element = require('../models/Element');
const User = require('../models/User');

// CORRECCIÓN: Crear proyecto con canvas por defecto
exports.createProject = async (req, res) => {
  try {
    const { name, description, canvas, deviceType } = req.body;
    
    console.log('📝 Creando proyecto:', { name, deviceType, userId: req.userId });
    
    // Canvas por defecto basado en deviceType
    const getDefaultCanvas = (type) => {
      const canvasDefaults = {
        iphone12: { width: 375, height: 812, background: '#FFFFFF' },
        iphone8: { width: 375, height: 667, background: '#FFFFFF' },
        pixel5: { width: 393, height: 851, background: '#FFFFFF' },
        samsungs21: { width: 384, height: 854, background: '#FFFFFF' },
        tablet: { width: 768, height: 1024, background: '#FFFFFF' },
        custom: { width: 360, height: 640, background: '#FFFFFF' }
      };
      return canvasDefaults[type] || canvasDefaults.custom;
    };
    
    const finalDeviceType = deviceType || 'custom';
    const finalCanvas = canvas || getDefaultCanvas(finalDeviceType);
    
    const project = new Project({
      name,
      description,
      owner: req.userId,
      collaborators: [req.userId],
      canvas: finalCanvas,
      deviceType: finalDeviceType
    });

    await project.save();
    
    console.log('✅ Proyecto creado exitosamente:', project._id);
    
    res.status(201).json({
      message: 'Proyecto creado con éxito',
      project
    });
  } catch (error) {
    console.error('❌ Error al crear proyecto:', error);
    res.status(500).json({ message: 'Error al crear el proyecto', error: error.message });
  }
};

// CORRECCIÓN: Obtener todos los proyectos del usuario con información adicional
exports.getProjects = async (req, res) => {
  try {
    console.log('📂 Obteniendo proyectos para usuario:', req.userId);
    
    const projects = await Project.find({
      $or: [
        { owner: req.userId },
        { collaborators: req.userId }
      ]
    })
    .populate('owner', 'username email')
    .populate('collaborators', 'username email')
    .sort({ updatedAt: -1 });
    
    // Agregar información adicional a cada proyecto
    const projectsWithInfo = await Promise.all(
      projects.map(async (project) => {
        try {
          // Contar screens
          const screenCount = await Screen.countDocuments({ projectId: project._id });
          
          // Contar elementos totales
          const screens = await Screen.find({ projectId: project._id }, '_id');
          const screenIds = screens.map(s => s._id);
          const elementCount = await Element.countDocuments({ screenId: { $in: screenIds } });
          
          return {
            ...project.toObject(),
            stats: {
              screens: screenCount,
              elements: elementCount,
              collaborators: project.collaborators.length
            }
          };
        } catch (err) {
          console.warn('⚠️ Error obteniendo stats del proyecto:', project._id, err.message);
          return {
            ...project.toObject(),
            stats: {
              screens: 0,
              elements: 0,
              collaborators: project.collaborators.length
            }
          };
        }
      })
    );
    
    console.log(`✅ ${projectsWithInfo.length} proyectos obtenidos`);
    res.status(200).json(projectsWithInfo);
  } catch (error) {
    console.error('❌ Error al obtener proyectos:', error);
    res.status(500).json({ message: 'Error al obtener proyectos', error: error.message });
  }
};

// CORRECCIÓN: Obtener un proyecto por ID con información completa
exports.getProject = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Obteniendo proyecto:', id, 'para usuario:', req.userId);
    
    const project = await Project.findById(id)
      .populate('owner', 'username email')
      .populate('collaborators', 'username email');
    
    if (!project) {
      console.log('❌ Proyecto no encontrado:', id);
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar permisos
    const hasAccess = project.owner.equals(req.userId) || 
                     project.collaborators.some(collab => collab._id.equals(req.userId));
    
    if (!hasAccess) {
      console.log('🚫 Usuario sin permisos:', req.userId, 'para proyecto:', id);
      return res.status(403).json({ message: 'No tienes permiso para ver este proyecto' });
    }
    
    // Agregar información adicional
    try {
      const screenCount = await Screen.countDocuments({ projectId: id });
      const screens = await Screen.find({ projectId: id }, '_id');
      const screenIds = screens.map(s => s._id);
      const elementCount = await Element.countDocuments({ screenId: { $in: screenIds } });
      
      const projectWithInfo = {
        ...project.toObject(),
        stats: {
          screens: screenCount,
          elements: elementCount,
          collaborators: project.collaborators.length
        }
      };
      
      console.log('✅ Proyecto obtenido exitosamente:', project.name);
      res.status(200).json(projectWithInfo);
    } catch (statsError) {
      console.warn('⚠️ Error obteniendo stats, devolviendo proyecto básico:', statsError.message);
      res.status(200).json(project);
    }
  } catch (error) {
    console.error('❌ Error al obtener proyecto:', error);
    res.status(500).json({ message: 'Error al obtener el proyecto', error: error.message });
  }
};

// CORRECCIÓN: Actualizar proyecto con validaciones
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, canvas, deviceType } = req.body;
    
    console.log('📝 Actualizando proyecto:', id);
    
    const project = await Project.findById(id);
    
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar permisos
    if (!project.owner.equals(req.userId)) {
      return res.status(403).json({ message: 'No tienes permiso para editar este proyecto' });
    }
    
    // Actualizar campos
    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    if (canvas) project.canvas = { ...project.canvas, ...canvas };
    if (deviceType) project.deviceType = deviceType;
    
    project.updatedAt = Date.now();
    
    await project.save();
    
    console.log('✅ Proyecto actualizado:', project.name);
    
    res.status(200).json({
      message: 'Proyecto actualizado con éxito',
      project
    });
  } catch (error) {
    console.error('❌ Error al actualizar proyecto:', error);
    res.status(500).json({ message: 'Error al actualizar el proyecto', error: error.message });
  }
};

// CORRECCIÓN: Eliminar proyecto con limpieza completa
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Eliminando proyecto:', id);
    
    const project = await Project.findById(id);
    
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar permisos
    if (!project.owner.equals(req.userId)) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar este proyecto' });
    }
    
    // Limpieza completa en cascada
    try {
      // 1. Obtener todas las screens del proyecto
      const screens = await Screen.find({ projectId: id });
      const screenIds = screens.map(s => s._id);
      
      // 2. Eliminar todos los elementos de todas las screens
      if (screenIds.length > 0) {
        const deletedElements = await Element.deleteMany({ screenId: { $in: screenIds } });
        console.log(`🧹 ${deletedElements.deletedCount} elementos eliminados`);
      }
      
      // 3. Eliminar todas las screens
      const deletedScreens = await Screen.deleteMany({ projectId: id });
      console.log(`🧹 ${deletedScreens.deletedCount} screens eliminadas`);
      
      // 4. Eliminar el proyecto
      await Project.findByIdAndDelete(id);
      
      console.log('✅ Proyecto eliminado completamente:', project.name);
      
      res.status(200).json({ 
        message: 'Proyecto eliminado con éxito',
        deleted: {
          project: 1,
          screens: deletedScreens.deletedCount,
          elements: screenIds.length > 0 ? (await Element.countDocuments({ screenId: { $in: screenIds } })) : 0
        }
      });
    } catch (cleanupError) {
      console.error('❌ Error durante limpieza:', cleanupError);
      // Intentar eliminar solo el proyecto si falla la limpieza
      await Project.findByIdAndDelete(id);
      res.status(200).json({ 
        message: 'Proyecto eliminado (con advertencias en limpieza)',
        warning: 'Algunos elementos relacionados pueden requerir limpieza manual'
      });
    }
  } catch (error) {
    console.error('❌ Error al eliminar proyecto:', error);
    res.status(500).json({ message: 'Error al eliminar el proyecto', error: error.message });
  }
};

// CORRECCIÓN: Añadir colaborador con validaciones mejoradas
exports.addCollaborator = async (req, res) => {
  try {
    const { collaboratorId } = req.body;
    const { id } = req.params;
    
    console.log('👥 Añadiendo colaborador:', { projectId: id, collaboratorId, requesterId: req.userId });
    
    if (!collaboratorId) {
      return res.status(400).json({ message: 'ID de colaborador no proporcionado' });
    }
    
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar permisos (solo owner puede añadir colaboradores)
    if (!project.owner.equals(req.userId)) {
      return res.status(403).json({ message: 'Solo el propietario puede añadir colaboradores' });
    }
    
    // Verificar que no se añada a sí mismo si ya es owner
    if (project.owner.equals(collaboratorId)) {
      return res.status(400).json({ message: 'El propietario ya tiene acceso completo al proyecto' });
    }
    
    // Verificar si ya es colaborador
    if (project.collaborators.some(collab => collab.equals(collaboratorId))) {
      return res.status(400).json({ message: 'El usuario ya es colaborador de este proyecto' });
    }
    
    // Verificar que el colaborador existe
    const collaborator = await User.findById(collaboratorId);
    if (!collaborator) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    project.collaborators.push(collaboratorId);
    project.updatedAt = Date.now();
    
    await project.save();
    
    // Poblar información del nuevo colaborador
    await project.populate('collaborators', 'username email');
    
    console.log('✅ Colaborador añadido:', collaborator.username);
    
    res.status(200).json({
      message: 'Colaborador añadido con éxito',
      project,
      newCollaborator: {
        _id: collaborator._id,
        username: collaborator.username,
        email: collaborator.email
      }
    });
  } catch (error) {
    console.error('❌ Error al añadir colaborador:', error);
    res.status(500).json({ message: 'Error al añadir colaborador', error: error.message });
  }
};

// CORRECCIÓN: Obtener colaboradores con información del propietario
exports.getCollaborators = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('👥 Obteniendo colaboradores del proyecto:', id);
    
    const project = await Project.findById(id)
      .populate('owner', 'username email')
      .populate('collaborators', 'username email');
    
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar permisos
    const hasAccess = project.owner._id.equals(req.userId) || 
                     project.collaborators.some(collab => collab._id.equals(req.userId));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'No tienes permiso para ver este proyecto' });
    }
    
    // Crear lista unificada con roles claramente definidos
    const collaboratorsList = [
      {
        _id: project.owner._id,
        username: project.owner.username,
        email: project.owner.email,
        role: 'owner',
        isOwner: true,
        canEdit: true,
        canDelete: false // No puede eliminarse a sí mismo
      },
      ...project.collaborators
        .filter(collab => !collab._id.equals(project.owner._id)) // Evitar duplicados
        .map(collab => ({
          _id: collab._id,
          username: collab.username,
          email: collab.email,
          role: 'collaborator',
          isOwner: false,
          canEdit: false,
          canDelete: project.owner._id.equals(req.userId) // Solo el owner puede eliminar colaboradores
        }))
    ];
    
    console.log(`✅ ${collaboratorsList.length} colaboradores obtenidos`);
    res.status(200).json(collaboratorsList);
  } catch (error) {
    console.error('❌ Error al obtener colaboradores:', error);
    res.status(500).json({ message: 'Error al obtener colaboradores', error: error.message });
  }
};

// CORRECCIÓN: Eliminar colaborador con validaciones
exports.removeCollaborator = async (req, res) => {
  try {
    const { id, userId } = req.params;
    console.log('👥➖ Eliminando colaborador:', { projectId: id, userId });
    
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Solo el owner puede eliminar colaboradores
    if (!project.owner.equals(req.userId)) {
      return res.status(403).json({ message: 'Solo el propietario puede eliminar colaboradores' });
    }
    
    // No se puede eliminar al propietario
    if (project.owner.equals(userId)) {
      return res.status(400).json({ message: 'No puedes eliminar al propietario del proyecto' });
    }
    
    // Verificar que el usuario es colaborador
    if (!project.collaborators.some(collab => collab.equals(userId))) {
      return res.status(400).json({ message: 'El usuario no es colaborador de este proyecto' });
    }
    
    project.collaborators = project.collaborators.filter(
      collab => !collab.equals(userId)
    );
    project.updatedAt = Date.now();
    
    await project.save();
    
    console.log('✅ Colaborador eliminado del proyecto');
    
    res.status(200).json({
      message: 'Colaborador eliminado con éxito',
      project
    });
  } catch (error) {
    console.error('❌ Error al eliminar colaborador:', error);
    res.status(500).json({ message: 'Error al eliminar colaborador', error: error.message });
  }
};

// CORRECCIÓN: Obtener usuarios activos (mejorado)
exports.getActiveUsers = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('👤 Obteniendo usuarios activos del proyecto:', id);
    
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar permisos
    const hasAccess = project.owner.equals(req.userId) || 
                     project.collaborators.some(collab => collab.equals(req.userId));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'No tienes permiso para ver este proyecto' });
    }
    
    // Obtener usuarios activos del gestor de Socket.io o sistema de sesiones
    // Esto depende de tu implementación de WebSockets/Socket.io
    const activeUsers = global.activeUsers ? 
      global.activeUsers.filter(user => user.projectId === id) : [];
    
    console.log(`✅ ${activeUsers.length} usuarios activos encontrados`);
    res.status(200).json(activeUsers);
  } catch (error) {
    console.error('❌ Error al obtener usuarios activos:', error);
    res.status(500).json({ message: 'Error al obtener usuarios activos', error: error.message });
  }
};