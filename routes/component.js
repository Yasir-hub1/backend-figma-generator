// backend/routes/component.js - CORREGIDO
const express = require('express');
const router = express.Router();
const elementController = require('../controllers/elementController');
const authMiddleware = require('../middleware/authMiddleware');

// Todas las rutas de elementos requieren autenticación
router.use(authMiddleware);

// CRUD para elementos
router.post('/', elementController.createElement);

// CORRECCIÓN: Ruta para obtener elementos por screen (la que estaba fallando)
router.get('/screen/:screenId', elementController.getElementsByScreen);



// Actualizar y eliminar elemento
router.put('/:id', elementController.updateElement);
router.delete('/:id', elementController.deleteElement);

// Duplicar elemento
router.post('/:id/duplicate', elementController.duplicateElement);

// CORRECCIÓN: Exportar a Flutter por screen (no por proyecto)
router.post('/export/flutter/:screenId', elementController.exportToFlutterByScreen);

// Mantener ruta de exportación por proyecto si la necesitas
router.post('/export/flutter/project/:projectId', elementController.exportToFlutter);

// Ruta para obtener elementos por proyecto (mantener por compatibilidad)
router.get('/project/:projectId', elementController.getElements);

// ================================
// DEBUGGING - Remover en producción
// ================================
if (process.env.NODE_ENV === 'development') {
    // Middleware para loggear todas las requests
    router.use((req, res, next) => {
      console.log(`🌐 ${req.method} ${req.originalUrl}`);
      console.log('📋 Body:', req.body);
      console.log('🔑 Params:', req.params);
      next();
    });
  }

module.exports = router;