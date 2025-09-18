// backend/routes/diagram.js - Rutas para Diagramas UML
const express = require('express');
const router = express.Router();
const diagramController = require('../controllers/diagramController');
const authMiddleware = require('../middleware/authMiddleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// ======= RUTAS DE DIAGRAMAS UML =======

// GET /api/diagrams/project/:projectId - Obtener diagramas de un proyecto
router.get('/project/:projectId', diagramController.getDiagrams);

// GET /api/diagrams/:diagramId - Obtener diagrama específico
router.get('/:diagramId', diagramController.getDiagram);

// POST /api/diagrams - Crear nuevo diagrama
router.post('/', diagramController.createDiagram);

// PUT /api/diagrams/:diagramId - Actualizar diagrama
router.put('/:diagramId', diagramController.updateDiagram);

// DELETE /api/diagrams/:diagramId - Eliminar diagrama
router.delete('/:diagramId', diagramController.deleteDiagram);

// PUT /api/diagrams/project/:projectId/reorder - Reordenar diagramas
router.put('/project/:projectId/reorder', diagramController.reorderDiagrams);

// ======= RUTAS ADICIONALES =======

// POST /api/diagrams/:diagramId/duplicate - Duplicar diagrama
router.post('/:diagramId/duplicate', diagramController.duplicateDiagram);

// GET /api/diagrams/:diagramId/stats - Obtener estadísticas del diagrama
router.get('/:diagramId/stats', diagramController.getDiagramStats);

module.exports = router;