// backend/server.js - ACTUALIZADO PARA SCREENS
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');

// Importar rutas
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/project');
const componentRoutes = require('./routes/component');
const aiRoutes = require('./routes/ai');
const screenRoutes = require('./routes/screen');

// Configuración
dotenv.config();
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

app.use(express.json({ limit: '10mb' })); // Aumentar a 10mb
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/screens', screenRoutes);
app.use('/api/components', componentRoutes);
app.use('/api/ai', aiRoutes);

// Conexión a la base de datos
mongoose.connect('mongodb+srv://sol:oQ4ryE6rkoCSkaS3@figma.qmqcr5m.mongodb.net/?retryWrites=true&w=majority&appName=figma/figma-angular-generator', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB conectado'))
.catch(err => console.error('❌ Error de conexión a MongoDB:', err));

// Inicializar lista global de usuarios activos
global.activeUsers = [];

// Configuración de Socket.io para colaboración en tiempo real
io.on('connection', (socket) => {
  console.log('🔌 Usuario conectado:', socket.id);
  
  let currentUser = null;
  let currentProjectId = null;

  // Autenticar usuario al conectarse
  socket.on('authenticate', (data) => {
    const { userId, username, token } = data;
    
    // Aquí deberías verificar el token JWT
    // Por simplicidad, asumimos que es válido
    
    currentUser = {
      userId,
      username,
      socketId: socket.id
    };
    
    console.log(`👤 Usuario ${username} (${userId}) autenticado`);
  });

  // Unirse a la sala del proyecto
  socket.on('join-project', (data) => {
    const { projectId } = data;
    
    if (!currentUser) {
      console.log('⚠️ Usuario no autenticado intentando unirse a un proyecto');
      return;
    }
    
    socket.join(projectId);
    currentProjectId = projectId;
    
    // Añadir a usuarios activos
    currentUser.projectId = projectId;
    global.activeUsers.push(currentUser);
    
    console.log(`🚀 Usuario ${currentUser.username} unido al proyecto ${projectId}`);
    
    // Notificar a todos en el proyecto sobre el nuevo usuario
    io.to(projectId).emit('user-joined', {
      user: currentUser,
      activeUsers: global.activeUsers.filter(user => user.projectId === projectId)
    });
  });

  // Manejar actualizaciones de diseño (elementos y screens)
  socket.on('update-design', (data) => {
    console.log('🔄 Actualización de diseño recibida:', data.type);
    console.log("update-design ", JSON.stringify(data, null, 2));
    
    // Validar que el usuario esté autenticado y en el proyecto correcto
    if (!currentUser || currentProjectId !== data.projectId) {
      console.log('⚠️ Usuario no autorizado para actualizar este proyecto');
      return;
    }
    
    // NUEVA LÓGICA: Normalizar datos según el tipo
    let normalizedData = { ...data };
    
    if (data.type === 'screen-added' || data.type === 'screen-updated') {
      // Asegurar estructura consistente para screens
      if (data.screen && !data.screen.screen) {
        normalizedData.screen = {
          ...data.screen,
          screen: data.screen // Duplicar para mantener compatibilidad
        };
      }
    }
    
    // Transmitir los cambios a todos los usuarios en la sala excepto al emisor
    socket.to(data.projectId).emit('design-updated', normalizedData);
    
    // NUEVO: También emitir eventos específicos para mejor manejo
    switch (data.type) {
      case 'element-added':
        console.log(`➕ Elemento añadido por ${currentUser.username}`);
        socket.to(data.projectId).emit('element-added-collaborative', {
          element: data.element,
          projectId: data.projectId,
          addedBy: currentUser
        });
        break;
        
      case 'element-updated':
        console.log(`✏️ Elemento actualizado por ${currentUser.username}`);
        socket.to(data.projectId).emit('element-updated-collaborative', {
          element: data.element,
          projectId: data.projectId,
          updatedBy: currentUser
        });
        break;
        
      case 'element-deleted':
        console.log(`🗑️ Elemento eliminado por ${currentUser.username}`);
        socket.to(data.projectId).emit('element-deleted-collaborative', {
          elementId: data.elementId,
          projectId: data.projectId,
          deletedBy: currentUser
        });
        break;
        
      case 'screen-added':
        console.log(`📱 Screen añadida por ${currentUser.username}: ${data?.screen?.name || data?.screen?.screen?.name}`);
        socket.to(data.projectId).emit('screen-added-collaborative', {
          screen: normalizedData.screen,
          projectId: data.projectId,
          addedBy: currentUser
        });
        break;
        
      case 'screen-updated':
        console.log(`📝 Screen actualizada por ${currentUser.username}: ${data?.screen?.name || data?.screen?.screen?.name}`);
        socket.to(data.projectId).emit('screen-updated-collaborative', {
          screen: normalizedData.screen,
          projectId: data.projectId,
          updatedBy: currentUser
        });
        break;
        
      case 'screen-deleted':
        console.log(`🗑️ Screen eliminada por ${currentUser.username}`);
        socket.to(data.projectId).emit('screen-deleted-collaborative', {
          screenId: data.screenId,
          projectId: data.projectId,
          deletedBy: currentUser
        });
        break;
        
      default:
        console.log(`🔄 Actualización desconocida: ${data.type}`);
    }
  });

  socket.on('request-sync', (data) => {
    const { projectId, screenId } = data;
    
    if (!currentUser || currentProjectId !== projectId) {
      console.log('⚠️ Usuario no autorizado para solicitar sync');
      return;
    }
    
    console.log(`🔄 Solicitando sincronización para screen ${screenId} por ${currentUser.username}`);
    
    // Notificar a otros usuarios para que envíen el estado actual
    socket.to(projectId).emit('sync-requested', {
      requestedBy: currentUser,
      screenId: screenId
    });
  });

  // NUEVO: Respuesta a solicitud de sincronización
  socket.on('sync-response', (data) => {
    const { projectId, screenId, elements, requestedBySocketId } = data;
    
    if (!currentUser || currentProjectId !== projectId) {
      console.log('⚠️ Usuario no autorizado para responder sync');
      return;
    }
    
    console.log(`📤 Enviando datos de sincronización a ${requestedBySocketId}`);
    
    // Enviar elementos actuales al usuario que los solicitó
    io.to(requestedBySocketId).emit('sync-data', {
      screenId,
      elements,
      syncedBy: currentUser
    });
  });

  // Manejar interacciones con elementos
  socket.on('element-interaction', (data) => {
    console.log('🎯 Interacción con elemento:', {
      elementId: data.elementId,
      action: data.action,
      user: data.username
    });
    
    // Validar datos
    if (!data.projectId || !data.elementId || !currentUser) {
      console.log('⚠️ Datos de interacción inválidos');
      return;
    }
    
    // Validar que el usuario esté en el proyecto correcto
    if (currentProjectId !== data.projectId) {
      console.log('⚠️ Usuario no autorizado para interactuar en este proyecto');
      return;
    }
    
    // Retransmitir a todos los demás usuarios en la sala
    socket.to(data.projectId).emit('element-interaction', data);
  });
  
  // Fin de interacción con elementos
  socket.on('element-interaction-end', (data) => {
    console.log('🏁 Fin de interacción con elemento:', data.elementId);
    
    // Validar datos
    if (!data.projectId || !data.elementId) {
      console.log('⚠️ Datos de fin de interacción inválidos');
      return;
    }
    
    // Validar que el usuario esté en el proyecto correcto
    if (currentProjectId !== data.projectId) {
      console.log('⚠️ Usuario no autorizado para finalizar interacción en este proyecto');
      return;
    }
    
    // Retransmitir a todos los demás usuarios en la sala
    socket.to(data.projectId).emit('element-interaction-end', data);
  });

  // Evento específico para notificar eliminación de elementos
  socket.on('element-deleted', (data) => {
    console.log('🗑️ Elemento eliminado:', {
      elementId: data.elementId,
      user: data.username
    });
    
    // Validar datos
    if (!data.projectId || !data.elementId || !currentUser) {
      console.log('⚠️ Datos de eliminación inválidos');
      return;
    }
    
    // Validar que el usuario esté en el proyecto correcto
    if (currentProjectId !== data.projectId) {
      console.log('⚠️ Usuario no autorizado para eliminar en este proyecto');
      return;
    }
    
    // Notificar a otros usuarios sobre la eliminación
    socket.to(data.projectId).emit('element-deleted', {
      elementId: data.elementId,
      userId: currentUser.userId,
      username: currentUser.username
    });
    
    // También enviar una actualización general
    socket.to(data.projectId).emit('design-updated', {
      type: 'element-deleted',
      elementId: data.elementId
    });
  });

  // Manejar cambios de screen actual (opcional, para sincronizar qué screen están viendo los usuarios)
  socket.on('screen-changed', (data) => {
    console.log('📱 Usuario cambió de screen:', {
      screenId: data.screenId,
      screenName: data.screenName,
      user: currentUser?.username
    });
    
    // Validar datos
    if (!data.projectId || !data.screenId || !currentUser) {
      console.log('⚠️ Datos de cambio de screen inválidos');
      return;
    }
    
    // Validar que el usuario esté en el proyecto correcto
    if (currentProjectId !== data.projectId) {
      console.log('⚠️ Usuario no autorizado para cambiar screen en este proyecto');
      return;
    }
    
    // Notificar a otros usuarios qué screen está viendo este usuario
    socket.to(data.projectId).emit('user-screen-changed', {
      userId: currentUser.userId,
      username: currentUser.username,
      screenId: data.screenId,
      screenName: data.screenName
    });
  });

  // Manejar desconexiones
  socket.on('disconnect', () => {
    console.log('❌ Usuario desconectado:', socket.id);
    
    if (currentUser) {
      // Eliminar de la lista de usuarios activos
      global.activeUsers = global.activeUsers.filter(user => user.socketId !== socket.id);
      
      // Notificar a los demás usuarios si estaba en un proyecto
      if (currentProjectId) {
        io.to(currentProjectId).emit('user-left', {
          user: currentUser,
          activeUsers: global.activeUsers.filter(user => user.projectId === currentProjectId)
        });
        
        console.log(`👋 Usuario ${currentUser.username} se desconectó del proyecto ${currentProjectId}`);
      }
    }
  });

  // Manejar errores de socket
  socket.on('error', (error) => {
    console.error('❌ Error en socket:', error);
  });
});

// Middleware de manejo de errores global
app.use((err, req, res, next) => {
  console.error('❌ Error en servidor:', err.stack);
  res.status(500).json({ 
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno'
  });
});

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Servidor funcionando correctamente',
    activeUsers: global.activeUsers.length,
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📡 Socket.IO configurado y listo para conexiones`);
  console.log(`🔗 URL del servidor: http://localhost:${PORT}`);
});