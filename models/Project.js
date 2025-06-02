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
  
  collaborators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
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
  // Asegurar que el owner esté en los colaboradores
  if (!this.collaborators.includes(this.owner)) {
    this.collaborators.push(this.owner);
  }

  // Remover duplicados en colaboradores y asegurar que todos sean ObjectId válidos
  this.collaborators = [...new Set(this.collaborators.map(id => id.toString()))]
    .map(id => new mongoose.Types.ObjectId(id));

  next();
});


// Método para verificar si un usuario tiene acceso
projectSchema.methods.hasAccess = function(userId) {
  return this.owner.equals(userId) || this.collaborators.some(collab => collab.equals(userId));
};

// Método para verificar si un usuario es owner
projectSchema.methods.isOwner = function(userId) {
  return this.owner.equals(userId);
};

module.exports = mongoose.model('Project', projectSchema);