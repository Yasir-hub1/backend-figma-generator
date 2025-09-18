// backend/models/Project.js - VERIFICACIÓN
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500
  },
  
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  collaborators: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  
  // IMPORTANTE: Canvas configuration
  canvas: {
    width: {
      type: Number,
      default: 360,
      min: 100,
      max: 2000
    },
    height: {
      type: Number,
      default: 640,
      min: 100,
      max: 3000
    },
    background: {
      type: String,
      default: '#FFFFFF',
      match: /^#[0-9A-F]{6}$/i
    }
  },
  
  // IMPORTANTE: Device type
  deviceType: {
    type: String,
    enum: ['iphone12', 'iphone8', 'pixel5', 'samsungs21', 'tablet', 'custom'],
    default: 'custom'
  },
  
  // Estado del proyecto
  status: {
    type: String,
    enum: ['draft', 'active', 'archived'],
    default: 'active'
  },
  
  // Configuración adicional
  settings: {
    exportFormat: {
      type: String,
      enum: ['flutter', 'react-native', 'xamarin'],
      default: 'flutter'
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    gridSnap: {
      type: Boolean,
      default: true
    }
  },

  // Configuración de compartir proyecto
  shareConfig: {
    token: {
      type: String,
      unique: true,
      sparse: true
    },
    permissions: {
      canEdit: { type: Boolean, default: true },
      canCreateDiagrams: { type: Boolean, default: true },
      canDeleteDiagrams: { type: Boolean, default: false },
      canInviteOthers: { type: Boolean, default: false },
      canExport: { type: Boolean, default: true }
    },
    expirationDate: {
      type: Date,
      default: null
    },
    isPublic: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para optimizar consultas
projectSchema.index({ owner: 1, updatedAt: -1 });
projectSchema.index({ collaborators: 1, updatedAt: -1 });
projectSchema.index({ name: 'text', description: 'text' });

// Virtual para contar screens
projectSchema.virtual('screenCount', {
  ref: 'Screen',
  localField: '_id',
  foreignField: 'projectId',
  count: true
});

// Middleware para validaciones
projectSchema.pre('save', function(next) {
  // Asegurar que el owner esté en los colaboradores (solo si no está ya)
  const ownerInCollaborators = this.collaborators.some(collab => {
    if (!collab) return false;
    
    // Formato antiguo: solo ObjectId
    if (collab.equals && collab.equals(this.owner)) {
      return true;
    }
    
    // Formato nuevo: objeto con userId
    if (collab.userId) {
      return (collab.userId.equals && collab.userId.equals(this.owner)) ||
             collab.userId.toString() === this.owner.toString();
    }
    
    return false;
  });

  if (!ownerInCollaborators) {
    this.collaborators.push(this.owner);
  }

  // Limpiar colaboradores nulos o indefinidos
  this.collaborators = this.collaborators.filter(collab => collab != null);

  next();
});


// Método para verificar si un usuario tiene acceso
projectSchema.methods.hasAccess = function(userId) {
  // Verificar si es el propietario
  if (this.owner.equals(userId)) {
    return true;
  }
  
  // Verificar si es colaborador
  return this.collaborators.some(collab => {
    if (!collab) return false;
    
    // Formato antiguo: solo ObjectId
    if (collab.equals && collab.equals(userId)) {
      return true;
    }
    
    // Formato nuevo: objeto con userId
    if (collab.userId) {
      return (collab.userId.equals && collab.userId.equals(userId)) ||
             collab.userId.toString() === userId.toString();
    }
    
    return false;
  });
};

// Método para verificar si un usuario es owner
projectSchema.methods.isOwner = function(userId) {
  return this.owner.equals(userId);
};

module.exports = mongoose.model('Project', projectSchema);