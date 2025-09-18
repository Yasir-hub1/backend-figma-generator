// backend/middleware/optionalAuthMiddleware.js - Middleware de autenticación opcional
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    // Obtener token del encabezado
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      // Si hay token, verificar y agregar información del usuario
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
      req.userId = decoded.id;
      req.user = { id: decoded.id, email: decoded.email };
      console.log('🔑 Usuario autenticado encontrado:', req.userId);
    } else {
      // Si no hay token, continuar sin información de usuario
      req.userId = null;
      req.user = null;
      console.log('🔓 No hay token de autenticación');
    }
    
    next();
  } catch (error) {
    // Si hay error con el token, continuar sin información de usuario
    req.userId = null;
    req.user = null;
    console.log('⚠️ Error verificando token, continuando sin autenticación:', error.message);
    next();
  }
};
