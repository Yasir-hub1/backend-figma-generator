// backend/server.js
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
app.use('/api/components', componentRoutes);
app.use('/api/ai', aiRoutes);

// Conexión a la base de datos
mongoose.connect('mongodb+srv://sol:oQ4ryE6rkoCSkaS3@figma.qmqcr5m.mongodb.net/?retryWrites=true&w=majority&appName=figma/figma-angular-generator', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB conectado'))
.catch(err => console.error('Error de conexión a MongoDB:', err));

// Configuración de Socket.io para colaboración en tiempo real
// Inicializar lista global de usuarios activos
global.activeUsers = [];

// Configuración de Socket.io para colaboración en tiempo real
io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);
  
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
    
    console.log(`Usuario ${username} (${userId}) autenticado`);
  });

  // Unirse a la sala del proyecto
  socket.on('join-project', (data) => {
    const { projectId } = data;
    
    if (!currentUser) {
      console.log('Usuario no autenticado intentando unirse a un proyecto');
      return;
    }
    
    socket.join(projectId);
    currentProjectId = projectId;
    
    // Añadir a usuarios activos
    currentUser.projectId = projectId;
    global.activeUsers.push(currentUser);
    
    console.log(`Usuario ${currentUser.username} unido al proyecto ${projectId}`);
    
    // Notificar a todos en el proyecto sobre el nuevo usuario
    io.to(projectId).emit('user-joined', {
      user: currentUser,
      activeUsers: global.activeUsers.filter(user => user.projectId === projectId)
    });
  });

  // Manejar actualizaciones de elementos de diseño
  socket.on('update-design', (data) => {
    // Transmitir los cambios a todos los usuarios en la sala excepto al emisor
    socket.to(data.projectId).emit('design-updated', data);
  });

  // Manejar desconexiones
  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
    
    if (currentUser) {
      // Eliminar de la lista de usuarios activos
      global.activeUsers = global.activeUsers.filter(user => user.socketId !== socket.id);
      
      // Notificar a los demás usuarios si estaba en un proyecto
      if (currentProjectId) {
        io.to(currentProjectId).emit('user-left', {
          user: currentUser,
          activeUsers: global.activeUsers.filter(user => user.projectId === currentProjectId)
        });
      }
    }
  });


  

  // Evento adicional para informar cuando se elimina un elemento
  socket.on('element-deleted', (data) => {
    socket.to(data.projectId).emit('element-deleted', {
      elementId: data.elementId,
      userId: currentUser?.userId,
      username: currentUser?.username
    });
    
    // También enviar una actualización a todos para que se elimine el elemento
    socket.to(data.projectId).emit('design-updated', {
      type: 'element-deleted',
      elementId: data.elementId
    });
  });

  // Manejar interacciones con elementos
  socket.on('element-interaction', (data) => {
    console.log('Interacción con elemento:', data);
    
    // Retransmitir a todos los demás usuarios en la sala
    socket.to(data.projectId).emit('element-interaction', data);
  });
  
  socket.on('element-interaction-end', (data) => {
    console.log('Fin de interacción con elemento:', data);
    
    // Retransmitir a todos los demás usuarios en la sala
    socket.to(data.projectId).emit('element-interaction-end', data);
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));