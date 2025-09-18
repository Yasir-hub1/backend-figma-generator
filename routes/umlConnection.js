// backend/routes/umlConnection.js - Rutas para Conexiones/Relaciones UML
const express = require('express');
const router = express.Router();
const umlConnectionController = require('../controllers/umlConnectionController');
const authMiddleware = require('../middleware/authMiddleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// ======= RUTAS BÁSICAS DE CONEXIONES UML =======

// GET /api/uml-connections/diagram/:diagramId - Obtener conexiones de un diagrama
router.get('/diagram/:diagramId', umlConnectionController.getUMLConnections);

// POST /api/uml-connections - Crear conexión/relación UML
router.post('/', umlConnectionController.createUMLConnection);

// PUT /api/uml-connections/:connectionId - Actualizar conexión
router.put('/:connectionId', umlConnectionController.updateUMLConnection);

// DELETE /api/uml-connections/:connectionId - Eliminar conexión
router.delete('/:connectionId', umlConnectionController.deleteUMLConnection);

// ======= RUTAS DE CONSULTA AVANZADA =======

// GET /api/uml-connections/between/:elementId1/:elementId2 - Obtener conexiones entre dos elementos
router.get('/between/:elementId1/:elementId2', umlConnectionController.getConnectionsBetweenElements);

// GET /api/uml-connections/element/:elementId/stats - Obtener estadísticas de conexiones de un elemento
router.get('/element/:elementId/stats', umlConnectionController.getElementConnectionStats);

// ======= RUTAS DE VALIDACIÓN =======

// POST /api/uml-connections/validate/:diagramId - Validar todas las conexiones de un diagrama
router.post('/validate/:diagramId', umlConnectionController.validateAllConnections);

module.exports = router;