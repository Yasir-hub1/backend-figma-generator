// backend/controllers/shareController.js - Controlador para compartir proyectos
const Project = require('../models/Project');
const User = require('../models/User');
const crypto = require('crypto');

// Generar enlace de compartir
exports.generateShareLink = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { permissions, expirationDays, isPublic, diagramId } = req.body;

    console.log('🔗 Generando enlace de compartir:', { projectId, permissions, expirationDays, isPublic });

    // Verificar que el proyecto existe y el usuario tiene acceso
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    if (!project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para compartir este proyecto' });
    }

    // Generar token único
    const shareToken = crypto.randomBytes(32).toString('hex');
    
    // Calcular fecha de expiración
    const expirationDate = expirationDays > 0 
      ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000)
      : null;

    // Crear configuración de compartir
    const shareConfig = {
      token: shareToken,
      permissions: {
        canEdit: permissions.canEdit || false,
        canCreateDiagrams: permissions.canCreateDiagrams || false,
        canDeleteDiagrams: permissions.canDeleteDiagrams || false,
        canInviteOthers: permissions.canInviteOthers || false,
        canExport: permissions.canExport || false
      },
      expirationDate,
      isPublic: isPublic || false,
      createdBy: req.userId,
      createdAt: new Date(),
      diagramId: diagramId || null
    };

    // Actualizar proyecto con configuración de compartir
    project.shareConfig = shareConfig;
    await project.save();

    // Generar enlace de compartir
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const shareLink = `${baseUrl}/join-project/${shareToken}`;

    console.log('✅ Enlace de compartir generado:', shareLink);

    // Emitir evento de socket
    if (global.io) {
      global.io.to(projectId.toString()).emit('uml-updated', {
        type: 'project-shared',
        projectId: projectId,
        shareConfig: shareConfig,
        userId: req.userId
      });
    }

    res.json({
      message: 'Enlace de compartir generado exitosamente',
      shareLink,
      shareConfig
    });

  } catch (error) {
    console.error('❌ Error generando enlace de compartir:', error);
    res.status(500).json({ message: 'Error al generar enlace de compartir', error: error.message });
  }
};

// Unirse a proyecto mediante enlace
exports.joinProjectByLink = async (req, res) => {
  try {
    const { shareToken } = req.params;
    const userId = req.userId; // Puede ser undefined si no está autenticado

    console.log('🔗 Uniéndose a proyecto con token:', shareToken);
    console.log('🔗 Usuario autenticado:', userId ? 'Sí' : 'No');
    console.log('🔗 req.user:', req.user);
    console.log('🔗 req.userId:', req.userId);

    // Buscar proyecto por token de compartir
    console.log('🔍 Buscando proyecto con token:', shareToken);
    const project = await Project.findOne({ 'shareConfig.token': shareToken });
    console.log('🔍 Proyecto encontrado:', project ? 'Sí' : 'No');
    
    if (!project) {
      console.log('❌ Proyecto no encontrado con token:', shareToken);
      return res.status(404).json({ message: 'Enlace de compartir inválido o expirado' });
    }
    
    console.log('✅ Proyecto encontrado:', project.name, 'ID:', project._id);

    // Verificar si el enlace ha expirado
    if (project.shareConfig.expirationDate && new Date() > project.shareConfig.expirationDate) {
      return res.status(410).json({ message: 'El enlace de compartir ha expirado' });
    }

    // Si el usuario está autenticado, verificar acceso y agregar como colaborador
    if (userId) {
      console.log('🔍 Verificando acceso para usuario:', userId);
      console.log('🔍 Owner del proyecto:', project.owner);
      console.log('🔍 Colaboradores actuales:', project.collaborators);
      
      // Verificar si el usuario ya tiene acceso
      const hasAccess = project.hasAccess(userId);
      console.log('🔍 Usuario tiene acceso:', hasAccess);
      
      if (hasAccess) {
        console.log('✅ Usuario ya tiene acceso al proyecto');
        return res.json({
          message: 'Ya tienes acceso a este proyecto',
          project: project,
          shareConfig: project.shareConfig
        });
      }

      // Agregar usuario al proyecto
      if (!project.collaborators) {
        project.collaborators = [];
      }

      // Verificar si el usuario ya está en la lista de colaboradores
      console.log('🔍 Verificando si usuario ya es colaborador...');
      const existingCollaborator = project.collaborators.find(collab => 
        collab && collab.userId && collab.userId.toString() === userId.toString()
      );
      console.log('🔍 Colaborador existente encontrado:', existingCollaborator ? 'Sí' : 'No');

      if (!existingCollaborator) {
        console.log('➕ Agregando usuario como colaborador...');
        const newCollaborator = {
          userId: userId,
          role: 'collaborator',
          permissions: project.shareConfig.permissions,
          joinedAt: new Date()
        };
        
        project.collaborators.push(newCollaborator);
        console.log('💾 Guardando proyecto...');
        await project.save();
        console.log('✅ Proyecto guardado exitosamente');
      }

      console.log('✅ Usuario agregado al proyecto:', userId);

      // Emitir evento de socket
      if (global.io) {
        global.io.to(project._id.toString()).emit('uml-updated', {
          type: 'user-joined',
          projectId: project._id,
          userId: userId,
          user: { id: userId, name: req.user?.name || 'Usuario' }
        });
      }
    }

    // Devolver información del proyecto (con o sin usuario autenticado)
    res.json({
      message: userId ? 'Te has unido al proyecto exitosamente' : 'Proyecto encontrado. Inicia sesión para unirte.',
      project: {
        _id: project._id,
        name: project.name,
        description: project.description,
        deviceType: project.deviceType,
        owner: project.owner,
        collaborators: project.collaborators || [],
        shareConfig: project.shareConfig
      },
      shareConfig: project.shareConfig,
      requiresAuth: !userId
    });

  } catch (error) {
    console.error('❌ Error uniéndose al proyecto:', error);
    res.status(500).json({ message: 'Error al unirse al proyecto', error: error.message });
  }
};

// Actualizar configuración de compartir
exports.updateShareSettings = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { permissions, expirationDays, isPublic } = req.body;

    console.log('⚙️ Actualizando configuración de compartir:', { projectId, permissions, expirationDays, isPublic });

    // Verificar que el proyecto existe y el usuario tiene acceso
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    if (!project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para modificar la configuración de compartir' });
    }

    // Actualizar configuración de compartir
    if (project.shareConfig) {
      if (permissions) {
        project.shareConfig.permissions = {
          ...project.shareConfig.permissions,
          ...permissions
        };
      }
      
      if (expirationDays !== undefined) {
        project.shareConfig.expirationDate = expirationDays > 0 
          ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000)
          : null;
      }
      
      if (isPublic !== undefined) {
        project.shareConfig.isPublic = isPublic;
      }

      project.shareConfig.updatedAt = new Date();
      await project.save();
    }

    console.log('✅ Configuración de compartir actualizada');

    // Emitir evento de socket
    if (global.io) {
      global.io.to(projectId.toString()).emit('uml-updated', {
        type: 'share-settings-updated',
        projectId: projectId,
        shareConfig: project.shareConfig,
        userId: req.userId
      });
    }

    res.json({
      message: 'Configuración de compartir actualizada exitosamente',
      shareConfig: project.shareConfig
    });

  } catch (error) {
    console.error('❌ Error actualizando configuración de compartir:', error);
    res.status(500).json({ message: 'Error al actualizar configuración de compartir', error: error.message });
  }
};

// Revocar enlace de compartir
exports.revokeShareLink = async (req, res) => {
  try {
    const { projectId } = req.params;

    console.log('🚫 Revocando enlace de compartir:', projectId);

    // Verificar que el proyecto existe y el usuario tiene acceso
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    if (!project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para revocar el enlace de compartir' });
    }

    // Eliminar configuración de compartir
    project.shareConfig = null;
    await project.save();

    console.log('✅ Enlace de compartir revocado');

    // Emitir evento de socket
    if (global.io) {
      global.io.to(projectId.toString()).emit('uml-updated', {
        type: 'share-link-revoked',
        projectId: projectId,
        userId: req.userId
      });
    }

    res.json({
      message: 'Enlace de compartir revocado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error revocando enlace de compartir:', error);
    res.status(500).json({ message: 'Error al revocar enlace de compartir', error: error.message });
  }
};

// Obtener información de compartir
exports.getShareInfo = async (req, res) => {
  try {
    const { projectId } = req.params;

    console.log('📊 Obteniendo información de compartir:', projectId);

    // Verificar que el proyecto existe y el usuario tiene acceso
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    if (!project.hasAccess(req.userId)) {
      return res.status(403).json({ message: 'No tienes permisos para ver la información de compartir' });
    }

    res.json({
      message: 'Información de compartir obtenida exitosamente',
      shareConfig: project.shareConfig,
      collaborators: project.collaborators || []
    });

  } catch (error) {
    console.error('❌ Error obteniendo información de compartir:', error);
    res.status(500).json({ message: 'Error al obtener información de compartir', error: error.message });
  }
};

module.exports = {
  generateShareLink: exports.generateShareLink,
  joinProjectByLink: exports.joinProjectByLink,
  updateShareSettings: exports.updateShareSettings,
  revokeShareLink: exports.revokeShareLink,
  getShareInfo: exports.getShareInfo
};
