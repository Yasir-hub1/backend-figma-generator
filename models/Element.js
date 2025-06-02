// backend/models/Element.js - MODELO FINAL
const mongoose = require('mongoose');

const elementSchema = new mongoose.Schema({
  // REFERENCIA A LA SCREEN (CRÍTICO)
  screenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Screen',
    required: true,
    index: true // Para consultas rápidas
  },
  
  // Tipo de elemento/widget
  type: {
    type: String,
    required: true,
    enum: [
      'text', 'container', 'elevatedButton', 'outlinedButton', 'textButton',
      'row', 'column', 'stack', 'expanded', 'appBar', 'floatingActionButton',
      'textField', 'card', 'divider', 'switch', 'checkbox', 'slider',
      'bottomNavigationBar', 'tabBar', 'drawer', 'image',"icon"
    ]
  },
  
  // Nombre del elemento
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  // Contenido (texto, imagen URL, etc.)
  content: {
    type: String,
    default: '',
    trim: true
  },
  
  // Posición en el canvas
  position: {
    x: { 
      type: Number, 
      default: 0,
      min: 0
    },
    y: { 
      type: Number, 
      default: 0,
      min: 0
    }
  },
  
  // Tamaño del elemento
  size: {
    width: { 
      type: Number, 
      default: 100,
      min: 1
    },
    height: { 
      type: Number, 
      default: 50,
      min: 1
    }
  },
  
  // Estilos CSS/Flutter
  styles: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Widget de Flutter específico
  flutterWidget: {
    type: String,
    default: function() { return this.type; },
    trim: true
  },
  
  // Propiedades específicas de Flutter
  flutterProps: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Orden en la pantalla (z-index)
  zIndex: {
    type: Number,
    default: 1,
    min: 0
  },
  
  // Elemento padre (para layouts anidados)
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Element',
    default: null
  },
  
  // Elementos hijos
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Element'
  }]
}, {
  timestamps: true,
  // Optimización para consultas
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para optimizar consultas
elementSchema.index({ screenId: 1, createdAt: -1 });
elementSchema.index({ screenId: 1, zIndex: 1 });
elementSchema.index({ parentId: 1 });

// Virtual para obtener la screen
elementSchema.virtual('screen', {
  ref: 'Screen',
  localField: 'screenId',
  foreignField: '_id',
  justOne: true
});

// Middleware para limpiar referencias huérfanas
elementSchema.pre('remove', async function() {
  // Limpiar referencias de hijos
  await this.model('Element').updateMany(
    { parentId: this._id },
    { $unset: { parentId: 1 } }
  );
});

module.exports = mongoose.model('Element', elementSchema);