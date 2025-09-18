// backend/routes/share.js - CORREGIDO
const express = require('express');
const router = express.Router();
const shareController = require('../controllers/shareController');
const authMiddleware = require('../middleware/authMiddleware');
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware');

// GET /api/share/join/:shareToken - Unirse a proyecto mediante enlace (PÚBLICA CON AUTENTICACIÓN OPCIONAL)
router.get('/join/:shareToken', optionalAuthMiddleware, shareController.joinProjectByLink);

// Aplicar middleware de autenticación a las rutas restantes
router.use(authMiddleware);

// CAMBIAR ESTAS RUTAS - quitar "projects/" del inicio
// POST /api/share/:projectId/share -> se convierte en POST /api/share/:projectId
router.post('/:projectId', shareController.generateShareLink);

// PUT /api/share/:projectId/settings
router.put('/:projectId/settings', shareController.updateShareSettings);

// DELETE /api/share/:projectId
router.delete('/:projectId', shareController.revokeShareLink);

// GET /api/share/:projectId/info
router.get('/:projectId/info', shareController.getShareInfo);

module.exports = router;