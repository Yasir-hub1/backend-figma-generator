// backend/models/UMLConnection.js - Modelo para Conexiones/Relaciones UML
const mongoose = require('mongoose');

const umlConnectionSchema = new mongoose.Schema({
  diagramId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Diagram',
    required: true,
    index: true
  },

  // Elementos conectados
  sourceElementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UMLElement',
    required: true,
    index: true
  },

  targetElementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UMLElement',
    required: true,
    index: true
  },

  // Tipo de relación UML
  type: {
    type: String,
    enum: [
      'association',      // Asociación
      'aggregation',      // Agregación
      'composition',      // Composición
      'inheritance',      // Herencia/Generalización
      'realization',      // Realización/Implementación
      'dependency',       // Dependencia
      'use',             // Uso (para casos de uso)
      'include',         // Include (casos de uso)
      'extend',          // Extend (casos de uso)
      // Relaciones de Cardinalidad/Multiplicidad
      'one-to-one',      // Relación 1:1
      'one-to-many',     // Relación 1:*
      'many-to-one',     // Relación *:1
      'many-to-many',    // Relación *:*
      'zero-to-one',     // Relación 0..1:1
      'zero-to-many',    // Relación 0..1:*
      'one-or-many',     // Relación 1..*:*
      'intermediate-table', // Tabla intermedia
      'intermediate-table-connection' // Conexión de tabla intermedia (sin flecha)
    ],
    required: true
  },

  // Propiedades de la relación
  properties: {
    // Etiquetas/nombres de la relación
    name: {
      type: String,
      default: ''
    },
    stereotype: {
      type: String,
      default: ''
    },

    // Multiplicidad en ambos extremos
    sourceMultiplicity: {
      type: String,
      default: ''
    },
    targetMultiplicity: {
      type: String,
      default: ''
    },

    // Roles en ambos extremos
    sourceRole: {
      type: String,
      default: ''
    },
    targetRole: {
      type: String,
      default: ''
    },

    // Navegabilidad
    sourceNavigable: {
      type: Boolean,
      default: true
    },
    targetNavigable: {
      type: Boolean,
      default: true
    },

    // Direccionalidad
    bidirectional: {
      type: Boolean,
      default: false
    },

    // Para casos de uso - condiciones
    condition: {
      type: String,
      default: ''
    },

    // Para dependencias - tipo específico
    dependencyType: {
      type: String,
      enum: ['use', 'call', 'parameter', 'local', 'global', ''],
      default: ''
    },

    // Para relaciones de cardinalidad
    cardinality: {
      source: {
        type: String,
        default: ''
      },
      target: {
        type: String,
        default: ''
      }
    },

    // Para tablas intermedias
    isIntermediateTable: {
      type: Boolean,
      default: false
    },

    // Información adicional para tablas intermedias
    intermediateTableInfo: {
      name: {
        type: String,
        default: ''
      },
      description: {
        type: String,
        default: ''
      },
      attributes: [{
        name: {
          type: String,
          required: true
        },
        type: {
          type: String,
          default: 'String'
        },
        required: {
          type: Boolean,
          default: false
        },
        defaultValue: {
          type: String,
          default: ''
        }
      }]
    }
  },

  // Puntos de conexión en los elementos
  connectionPoints: {
    source: {
      x: { type: Number, default: 0.5 }, // Porcentaje (0-1) del borde del elemento
      y: { type: Number, default: 0.5 },
      side: { type: String, enum: ['top', 'right', 'bottom', 'left'], default: 'right' }
    },
    target: {
      x: { type: Number, default: 0.5 },
      y: { type: Number, default: 0.5 },
      side: { type: String, enum: ['top', 'right', 'bottom', 'left'], default: 'left' }
    }
  },

  // Puntos intermedios para líneas curvas
  waypoints: [{
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  }],

  // Estilos visuales de la línea
  styles: {
    lineColor: {
      type: String,
      default: '#000000'
    },
    lineWidth: {
      type: Number,
      default: 1,
      min: 1,
      max: 10
    },
    lineStyle: {
      type: String,
      enum: ['solid', 'dashed', 'dotted'],
      default: 'solid'
    },
    arrowSize: {
      type: Number,
      default: 10,
      min: 0,  // Permitir 0 para conexiones sin flecha
      max: 20
    },
    fontSize: {
      type: Number,
      default: 10
    },
    fontFamily: {
      type: String,
      default: 'Arial, sans-serif'
    },
    textColor: {
      type: String,
      default: '#000000'
    }
  },

  // Posiciones de las etiquetas
  labelPositions: {
    name: {
      x: { type: Number, default: 0.5 }, // Posición relativa en la línea (0-1)
      y: { type: Number, default: 0.5 },
      offset: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: -10 }
      }
    },
    sourceMultiplicity: {
      x: { type: Number, default: 0.1 },
      y: { type: Number, default: 0.1 },
      offset: {
        x: { type: Number, default: 5 },
        y: { type: Number, default: -5 }
      }
    },
    targetMultiplicity: {
      x: { type: Number, default: 0.9 },
      y: { type: Number, default: 0.9 },
      offset: {
        x: { type: Number, default: -5 },
        y: { type: Number, default: -5 }
      }
    }
  },

  // Z-index para layering
  zIndex: {
    type: Number,
    default: 0
  },

  // Estado de la conexión
  visible: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para optimizar consultas
umlConnectionSchema.index({ diagramId: 1 });
umlConnectionSchema.index({ sourceElementId: 1 });
umlConnectionSchema.index({ targetElementId: 1 });
umlConnectionSchema.index({ type: 1 });

// Virtual para elemento fuente
umlConnectionSchema.virtual('sourceElement', {
  ref: 'UMLElement',
  localField: 'sourceElementId',
  foreignField: '_id',
  justOne: true
});

// Virtual para elemento destino
umlConnectionSchema.virtual('targetElement', {
  ref: 'UMLElement',
  localField: 'targetElementId',
  foreignField: '_id',
  justOne: true
});

// Validación para evitar auto-conexiones
umlConnectionSchema.pre('save', function(next) {
  if (this.sourceElementId.equals(this.targetElementId)) {
    next(new Error('Un elemento no puede conectarse a sí mismo'));
  } else {
    next();
  }
});

// Método para calcular la longitud de la línea
umlConnectionSchema.methods.calculateLength = async function() {
  await this.populate(['sourceElement', 'targetElement']);

  const source = this.sourceElement;
  const target = this.targetElement;

  if (!source || !target) {
    return 0;
  }

  // Calcular puntos de conexión reales
  const sourcePoint = this.calculateConnectionPoint(source, this.connectionPoints.source);
  const targetPoint = this.calculateConnectionPoint(target, this.connectionPoints.target);

  // Si hay waypoints, calcular la distancia total
  if (this.waypoints && this.waypoints.length > 0) {
    let totalLength = 0;
    let currentPoint = sourcePoint;

    for (const waypoint of this.waypoints) {
      totalLength += Math.sqrt(
        Math.pow(waypoint.x - currentPoint.x, 2) +
        Math.pow(waypoint.y - currentPoint.y, 2)
      );
      currentPoint = waypoint;
    }

    // Distancia del último waypoint al target
    totalLength += Math.sqrt(
      Math.pow(targetPoint.x - currentPoint.x, 2) +
      Math.pow(targetPoint.y - currentPoint.y, 2)
    );

    return totalLength;
  }

  // Distancia directa
  return Math.sqrt(
    Math.pow(targetPoint.x - sourcePoint.x, 2) +
    Math.pow(targetPoint.y - sourcePoint.y, 2)
  );
};

// Helper para calcular punto de conexión real
umlConnectionSchema.methods.calculateConnectionPoint = function(element, connectionPoint) {
  const { x: relX, y: relY, side } = connectionPoint;
  const { position, size } = element;

  let pointX, pointY;

  switch (side) {
    case 'top':
      pointX = position.x + (size.width * relX);
      pointY = position.y;
      break;
    case 'right':
      pointX = position.x + size.width;
      pointY = position.y + (size.height * relY);
      break;
    case 'bottom':
      pointX = position.x + (size.width * relX);
      pointY = position.y + size.height;
      break;
    case 'left':
      pointX = position.x;
      pointY = position.y + (size.height * relY);
      break;
    default:
      pointX = position.x + (size.width * relX);
      pointY = position.y + (size.height * relY);
  }

  return { x: pointX, y: pointY };
};

// Método para validar la conexión según el tipo UML
umlConnectionSchema.methods.validateUMLRules = async function() {
  await this.populate(['sourceElement', 'targetElement']);

  const source = this.sourceElement;
  const target = this.targetElement;
  const errors = [];

  if (!source || !target) {
    errors.push('Elementos de conexión no encontrados');
    return { isValid: false, errors };
  }

  // Reglas específicas por tipo de conexión
  switch (this.type) {
    case 'inheritance':
      // Solo clases/interfaces pueden heredar
      if (!['class', 'interface', 'abstract_class'].includes(source.type) ||
          !['class', 'interface', 'abstract_class'].includes(target.type)) {
        errors.push('La herencia solo es válida entre clases e interfaces');
      }
      // Una clase no puede heredar de una interface (debe ser realization)
      if (source.type === 'class' && target.type === 'interface') {
        errors.push('Las clases implementan interfaces (usar realization), no las heredan');
      }
      break;

    case 'realization':
      // Solo clases pueden implementar interfaces
      if (source.type !== 'class' || target.type !== 'interface') {
        errors.push('La realización solo es válida de clase a interface');
      }
      break;

    case 'use':
      // Solo válido en diagramas de casos de uso
      if (source.type !== 'actor' || target.type !== 'use_case') {
        errors.push('La relación "use" solo es válida de actor a caso de uso');
      }
      break;

    case 'include':
    case 'extend':
      // Solo entre casos de uso
      if (source.type !== 'use_case' || target.type !== 'use_case') {
        errors.push(`La relación "${this.type}" solo es válida entre casos de uso`);
      }
      break;

    // Validaciones para relaciones de cardinalidad
    case 'one-to-one':
    case 'one-to-many':
    case 'many-to-one':
    case 'many-to-many':
    case 'zero-to-one':
    case 'zero-to-many':
    case 'one-or-many':
      // Las relaciones de cardinalidad son válidas entre cualquier tipo de elemento
      // pero se recomienda principalmente entre clases
      if (!['class', 'interface', 'abstract_class'].includes(source.type) ||
          !['class', 'interface', 'abstract_class'].includes(target.type)) {
        console.warn(`Relación de cardinalidad "${this.type}" entre elementos no estándar: ${source.type} -> ${target.type}`);
      }
      break;

    case 'intermediate-table':
      // Las tablas intermedias requieren al menos dos clases
      if (!['class', 'interface', 'abstract_class'].includes(source.type) ||
          !['class', 'interface', 'abstract_class'].includes(target.type)) {
        errors.push('Las tablas intermedias solo son válidas entre clases e interfaces');
      }
      // Una tabla intermedia debe tener información adicional
      if (!this.properties.intermediateTableInfo || !this.properties.intermediateTableInfo.name) {
        errors.push('Las tablas intermedias requieren un nombre');
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Método estático para encontrar conexiones entre dos elementos
umlConnectionSchema.statics.findBetweenElements = function(elementId1, elementId2) {
  return this.find({
    $or: [
      { sourceElementId: elementId1, targetElementId: elementId2 },
      { sourceElementId: elementId2, targetElementId: elementId1 }
    ]
  });
};

// Método estático para validar que no existan conexiones duplicadas
umlConnectionSchema.statics.checkDuplicate = async function(sourceId, targetId, type) {
  const existing = await this.findOne({
    sourceElementId: sourceId,
    targetElementId: targetId,
    type: type
  });

  return existing !== null;
};

module.exports = mongoose.model('UMLConnection', umlConnectionSchema);