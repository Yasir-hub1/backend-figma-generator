// backend/routes/umlElement.js - Rutas para Elementos UML
const express = require('express');
const router = express.Router();
const umlElementController = require('../controllers/umlElementController');
const authMiddleware = require('../middleware/authMiddleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// ======= RUTAS BÁSICAS DE ELEMENTOS UML =======

// GET /api/uml-elements/diagram/:diagramId - Obtener elementos y conexiones de un diagrama
router.get('/diagram/:diagramId', umlElementController.getUMLElements);

// POST /api/uml-elements - Crear elemento UML
router.post('/', umlElementController.createUMLElement);

// PUT /api/uml-elements/:elementId - Actualizar elemento UML
router.put('/:elementId', umlElementController.updateUMLElement);

// DELETE /api/uml-elements/:elementId - Eliminar elemento UML
router.delete('/:elementId', umlElementController.deleteUMLElement);

// POST /api/uml-elements/:elementId/duplicate - Duplicar elemento UML
router.post('/:elementId/duplicate', umlElementController.duplicateUMLElement);

// ======= RUTAS DE EXPORTACIÓN E IMPORTACIÓN =======

// POST /api/uml-elements/export/uml/:diagramId - Exportar a PlantUML/XMI/JSON/Imagen
router.post('/export/uml/:diagramId', umlElementController.exportUML);

// POST /api/uml-elements/generate-code/:diagramId - Generar código (Java/C#/Python)
router.post('/generate-code/:diagramId', umlElementController.generateCode);

// POST /api/uml-elements/import/:diagramId - Importar desde archivo UML
router.post('/import/:diagramId', (req, res) => {
  // TODO: Implementar importación de archivos UML
  res.status(501).json({
    message: 'Importación de archivos UML no implementada aún',
    plannedFormats: ['xmi', 'plantuml', 'json']
  });
});

// ======= RUTAS DE VALIDACIÓN =======

// POST /api/uml-elements/validate/:diagramId - Validar diagrama UML
router.post('/validate/:diagramId', umlElementController.validateUML);

module.exports = router;