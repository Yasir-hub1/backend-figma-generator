// backend/controllers/projectController.js
const Project = require('../models/Project');
const Element = require('../models/Element');
const User = require('../models/User');

// Modificar createProject en projectController.js para manejar deviceType
exports.createProject = async (req, res) => {
  try {
    const { name, description, canvas, deviceType } = req.body;
    
    const project = new Project({
      name,
      description,
      owner: req.userId,
      collaborators: [req.userId],
      canvas: canvas || {},
      deviceType: deviceType || 'custom'
    });

    await project.save();
    
    res.status(201).json({
      message: 'Proyecto creado con éxito',
      project
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear el proyecto', error: error.message });
  }
};

// Modificar updateProject en projectController.js para manejar deviceType
exports.updateProject = async (req, res) => {
  try {
    const { name, description, canvas, deviceType } = req.body;
    
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar si el usuario es propietario del proyecto
    if (!project.owner.equals(req.userId)) {
      return res.status(403).json({ message: 'No tienes permiso para editar este proyecto' });
    }
    
    project.name = name || project.name;
    project.description = description || project.description;
    project.canvas = canvas || project.canvas;
    project.deviceType = deviceType || project.deviceType;
    project.updatedAt = Date.now();
    
    await project.save();
    
    res.status(200).json({
      message: 'Proyecto actualizado con éxito',
      project
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar el proyecto', error: error.message });
  }
};
// Obtener todos los proyectos del usuario
exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.userId },
        { collaborators: req.userId }
      ]
    }).populate('owner', 'username email');
    
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener proyectos', error: error.message });
  }
};

// Obtener un proyecto por su ID
exports.getProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'username email')
      .populate('collaborators', 'username email');
    
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar si el usuario tiene acceso al proyecto
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab._id.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para ver este proyecto' });
    }
    
    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el proyecto', error: error.message });
  }
};


// Eliminar un proyecto
exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar si el usuario es propietario del proyecto
    if (!project.owner.equals(req.userId)) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar este proyecto' });
    }
    
    // Eliminar todos los elementos asociados al proyecto
    await Element.deleteMany({ projectId: project._id });
    
    // Eliminar el proyecto
    await Project.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ message: 'Proyecto eliminado con éxito' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar el proyecto', error: error.message });
  }
};

// Añadir colaborador a un proyecto
exports.addCollaborator = async (req, res) => {
  try {
    const { collaboratorId } = req.body;
    const { id } = req.params;
    
    console.log('Añadiendo colaborador, datos recibidos:', { 
      projectId: id, 
      collaboratorId,
      body: req.body
    });
    
    if (!collaboratorId) {
      return res.status(400).json({ message: 'ID de colaborador no proporcionado' });
    }
    
    const project = await Project.findById(id);
    
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar si el usuario es propietario del proyecto o colaborador
    const isOwner = project.owner.equals(req.userId);
    const isCollaborator = project.collaborators.some(collab => collab.equals(req.userId));
    
    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: 'No tienes permiso para añadir colaboradores' });
    }
    
    // Verificar si el colaborador ya existe en el proyecto
    if (project.collaborators.some(collab => collab.equals(collaboratorId))) {
      return res.status(400).json({ message: 'El usuario ya es colaborador de este proyecto' });
    }
    
    // Verificar si el colaborador existe
    const collaborator = await User.findById(collaboratorId);
    if (!collaborator) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    project.collaborators.push(collaboratorId);
    project.updatedAt = Date.now();
    
    await project.save();
    
    res.status(200).json({
      message: 'Colaborador añadido con éxito',
      project
    });
  } catch (error) {
    console.error('Error al añadir colaborador:', error);
    res.status(500).json({ message: 'Error al añadir colaborador', error: error.message });
  }
};

// Eliminar colaborador de un proyecto
exports.removeCollaborator = async (req, res) => {
  try {
    const { collaboratorId } = req.params;
    
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar si el usuario es propietario del proyecto
    if (!project.owner.equals(req.userId)) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar colaboradores' });
    }
    
    // Verificar que no se esté intentando eliminar al propietario
    if (collaboratorId === project.owner.toString()) {
      return res.status(400).json({ message: 'No puedes eliminar al propietario del proyecto' });
    }
    
    project.collaborators = project.collaborators.filter(
      collab => collab.toString() !== collaboratorId
    );
    
    project.updatedAt = Date.now();
    
    await project.save();
    
    res.status(200).json({
      message: 'Colaborador eliminado con éxito',
      project
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar colaborador', error: error.message });
  }
}
  // Obtener colaboradores de un proyecto
  exports.getCollaborators = async (req, res) => {
    try {
      const project = await Project.findById(req.params.id)
        .populate('collaborators', 'username email');
      
      if (!project) {
        return res.status(404).json({ message: 'Proyecto no encontrado' });
      }
      
      // Verificar si el usuario tiene acceso al proyecto
      if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab._id.equals(req.userId))) {
        return res.status(403).json({ message: 'No tienes permiso para ver este proyecto' });
      }
      
      // Incluir al propietario con los colaboradores
      const ownerData = await User.findById(project.owner, 'username email');
      
      // Filtrar cualquier colaborador que tenga el mismo ID que el propietario
      const filteredCollaborators = project.collaborators.filter(
        collab => !collab._id.equals(project.owner)
      );
      
      // Crear una lista unificada con el propietario marcado
      const allCollaborators = [
        { ...ownerData.toObject(), isOwner: true },
        ...filteredCollaborators.map(collab => ({
          ...collab.toObject(),
          isOwner: false
        }))
      ];
      
      console.log("allCollaborators ", allCollaborators);
      res.status(200).json(allCollaborators);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener colaboradores', error: error.message });
    }
  };

// Eliminar colaborador de un proyecto
exports.removeCollaborator = async (req, res) => {
  try {
    const { id, userId } = req.params;
    
    const project = await Project.findById(id);
    
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar si el usuario es propietario del proyecto
    if (!project.owner.equals(req.userId)) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar colaboradores' });
    }
    
    // Verificar que no se esté intentando eliminar al propietario
    if (userId === project.owner.toString()) {
      return res.status(400).json({ message: 'No puedes eliminar al propietario del proyecto' });
    }
    
    project.collaborators = project.collaborators.filter(
      collab => collab.toString() !== userId
    );
    
    project.updatedAt = Date.now();
    
    await project.save();
    
    res.status(200).json({
      message: 'Colaborador eliminado con éxito',
      project
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar colaborador', error: error.message });
  }
};

// Obtener usuarios activos en un proyecto
exports.getActiveUsers = async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await Project.findById(id);
    
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar si el usuario tiene acceso al proyecto
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para ver este proyecto' });
    }
    
    // Obtener la lista de usuarios activos del gestor de Socket.io
    // Esta información debe estar almacenada en una variable global o utilizando Redis
    const activeUsers = global.activeUsers ? global.activeUsers.filter(user => user.projectId === id) : [];
    
    res.status(200).json(activeUsers);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuarios activos', error: error.message });
  }
};
