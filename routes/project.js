// backend/routes/project.js - CORREGIDO
const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authMiddleware = require('../middleware/authMiddleware');

console.log('🔧 Project Controller cargado:', Object.keys(projectController));

// Todas las rutas de proyectos requieren autenticación
router.use(authMiddleware);

// ================================
// RUTAS PRINCIPALES DE PROYECTOS
// ================================

// Crear proyecto (POST /api/projects)
router.post('/', projectController.createProject);

// Obtener todos los proyectos del usuario (GET /api/projects)
router.get('/', projectController.getProjects);

// Obtener un proyecto específico (GET /api/projects/:id)
router.get('/:id', projectController.getProject);

// Actualizar proyecto (PUT /api/projects/:id)
router.put('/:id', projectController.updateProject);

// Eliminar proyecto (DELETE /api/projects/:id)
router.delete('/:id', projectController.deleteProject);

// ================================
// RUTAS DE COLABORADORES
// ================================

// Obtener colaboradores (GET /api/projects/:id/collaborators)
router.get('/:id/collaborators', projectController.getCollaborators);

// Añadir colaborador (POST /api/projects/:id/collaborators)
router.post('/:id/collaborators', projectController.addCollaborator);

// Eliminar colaborador (DELETE /api/projects/:id/collaborators/:userId)
router.delete('/:id/collaborators/:userId', projectController.removeCollaborator);

// ================================
// RUTAS DE ACTIVIDAD Y ESTADO
// ================================

// Obtener usuarios activos (GET /api/projects/:id/active-users)
router.get('/:id/active-users', projectController.getActiveUsers);

// ================================
// DEBUGGING - Remover en producción
// ================================
if (process.env.NODE_ENV === 'development') {
  // Middleware de logging para debug
  router.use((req, res, next) => {
    console.log(`🌐 PROJECT ROUTE: ${req.method} ${req.originalUrl}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('📋 Body:', req.body);
    }
    if (req.params && Object.keys(req.params).length > 0) {
      console.log('🔑 Params:', req.params);
    }
    next();
  });
}

module.exports = router;