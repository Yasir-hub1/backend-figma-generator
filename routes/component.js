// backend/routes/component.js
const express = require('express');
const router = express.Router();
const elementController = require('../controllers/elementController');
const authMiddleware = require('../middleware/authMiddleware');

// Todas las rutas de elementos requieren autenticación
router.use(authMiddleware);

// CRUD para elementos
router.post('/', elementController.createElement);
router.post('/:id/duplicate', authMiddleware, elementController.duplicateElement);

router.get('/project/:projectId', elementController.getElements);
router.put('/:id', elementController.updateElement);
router.delete('/:id', elementController.deleteElement);

// Exportar a Angular
router.get('/export/:projectId', elementController.exportToAngular);
// router.post('/projects/:projectId/export/flutter', elementController.exportToFlutter);
router.post('/export/flutter/:projectId', elementController.exportToFlutter);


module.exports = router;