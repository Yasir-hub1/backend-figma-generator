// backend/models/Diagram.js - Modelo para Diagramas UML
const mongoose = require('mongoose');

const diagramSchema = new mongoose.Schema({
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

  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },

  // Tipo de diagrama UML
  type: {
    type: String,
    enum: ['class', 'sequence', 'usecase', 'activity', 'state', 'component', 'deployment'],
    required: true,
    default: 'class'
  },

  // Canvas configuration
  canvas: {
    width: {
      type: Number,
      default: 1200,
      min: 500,
      max: 5000
    },
    height: {
      type: Number,
      default: 800,
      min: 400,
      max: 3000
    },
    background: {
      type: String,
      default: '#FFFFFF',
      match: /^#[0-9A-F]{6}$/i
    }
  },

  // Configuración específica del diagrama
  settings: {
    showStereotypes: {
      type: Boolean,
      default: true
    },
    showVisibility: {
      type: Boolean,
      default: true
    },
    showOperations: {
      type: Boolean,
      default: true
    },
    showAttributes: {
      type: Boolean,
      default: true
    },
    gridVisible: {
      type: Boolean,
      default: true
    },
    snapToGrid: {
      type: Boolean,
      default: true
    },
    zoom: {
      type: Number,
      default: 1,
      min: 0.1,
      max: 5
    }
  },

  // Posición y orden del diagrama
  position: {
    x: {
      type: Number,
      default: 0
    },
    y: {
      type: Number,
      default: 0
    }
  },

  order: {
    type: Number,
    default: 0,
    index: true
  },

  // Estado del diagrama
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  },

  // Metadatos de exportación
  lastExport: {
    format: {
      type: String,
      enum: ['plantuml', 'xmi', 'json', 'png', 'svg']
    },
    timestamp: Date,
    size: Number
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para optimizar consultas
diagramSchema.index({ projectId: 1, order: 1 });
diagramSchema.index({ projectId: 1, type: 1 });
diagramSchema.index({ projectId: 1, updatedAt: -1 });
diagramSchema.index({ name: 'text', description: 'text' });

// Virtual para contar elementos UML
diagramSchema.virtual('elementCount', {
  ref: 'UMLElement',
  localField: '_id',
  foreignField: 'diagramId',
  count: true
});

// Virtual para contar conexiones
diagramSchema.virtual('connectionCount', {
  ref: 'UMLConnection',
  localField: '_id',
  foreignField: 'diagramId',
  count: true
});

// Middleware para establecer order automáticamente
diagramSchema.pre('save', async function(next) {
  if (this.isNew && (this.order === undefined || this.order === 0)) {
    const lastDiagram = await this.constructor.findOne({ projectId: this.projectId })
      .sort({ order: -1 })
      .select('order');

    this.order = lastDiagram ? lastDiagram.order + 1 : 1;
  }
  next();
});

// Método estático para reordenar diagramas
diagramSchema.statics.reorderDiagrams = async function(projectId, diagramOrders) {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      for (const { diagramId, order } of diagramOrders) {
        await this.findByIdAndUpdate(
          diagramId,
          { order },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }
};

// Método para duplicar diagrama
diagramSchema.methods.duplicate = async function(newName) {
  const UMLElement = mongoose.model('UMLElement');
  const UMLConnection = mongoose.model('UMLConnection');

  // Crear nuevo diagrama
  const duplicatedDiagram = new this.constructor({
    name: newName || `${this.name} - Copia`,
    description: this.description,
    projectId: this.projectId,
    type: this.type,
    canvas: { ...this.canvas },
    settings: { ...this.settings },
    position: { ...this.position }
  });

  await duplicatedDiagram.save();

  // Duplicar elementos
  const elements = await UMLElement.find({ diagramId: this._id });
  const elementMap = new Map(); // Para mapear IDs antiguos con nuevos

  for (const element of elements) {
    const newElement = new UMLElement({
      ...element.toObject(),
      _id: new mongoose.Types.ObjectId(),
      diagramId: duplicatedDiagram._id
    });

    elementMap.set(element._id.toString(), newElement._id);
    await newElement.save();
  }

  // Duplicar conexiones con IDs actualizados
  const connections = await UMLConnection.find({ diagramId: this._id });

  for (const connection of connections) {
    const newConnection = new UMLConnection({
      ...connection.toObject(),
      _id: new mongoose.Types.ObjectId(),
      diagramId: duplicatedDiagram._id,
      sourceElementId: elementMap.get(connection.sourceElementId.toString()),
      targetElementId: elementMap.get(connection.targetElementId.toString())
    });

    await newConnection.save();
  }

  return duplicatedDiagram;
};

module.exports = mongoose.model('Diagram', diagramSchema);