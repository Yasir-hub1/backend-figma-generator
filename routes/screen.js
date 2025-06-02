// backend/routes/screen.js
const express = require('express');
const router = express.Router();
const screenController = require('../controllers/screenController');
const authMiddleware = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// CRUD para screens
router.post('/', screenController.createScreen);
router.get('/project/:projectId', screenController.getScreens);
router.get('/:id', screenController.getScreen);
router.put('/:id', screenController.updateScreen);
router.delete('/:id', screenController.deleteScreen);
router.put('/project/:projectId/reorder', screenController.reorderScreens);

module.exports = router;