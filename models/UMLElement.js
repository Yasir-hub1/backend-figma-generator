// backend/models/UMLElement.js - Modelo para Elementos UML
const mongoose = require('mongoose');

// Schema para atributos de clase UML
const attributeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    trim: true
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'protected', 'package'],
    default: 'private'
  },
  defaultValue: {
    type: String,
    default: ''
  },
  isStatic: {
    type: Boolean,
    default: false
  },
  isFinal: {
    type: Boolean,
    default: false
  }
}, { _id: false });

// Schema para métodos/operaciones de clase UML
const operationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  returnType: {
    type: String,
    default: 'void',
    trim: true
  },
  parameters: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      required: true,
      trim: true
    },
    defaultValue: {
      type: String,
      default: ''
    }
  }],
  visibility: {
    type: String,
    enum: ['public', 'private', 'protected', 'package'],
    default: 'public'
  },
  isStatic: {
    type: Boolean,
    default: false
  },
  isAbstract: {
    type: Boolean,
    default: false
  },
  isFinal: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const umlElementSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  diagramId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Diagram',
    required: true,
    index: true
  },

  // Tipo de elemento UML
  type: {
    type: String,
    enum: [
      'class', 'interface', 'abstract_class', 'enum',
      'package', 'component', 'actor', 'use_case', 'note',
      'intermediate_table'
    ],
    required: true
  },

  // Posición en el canvas
  position: {
    x: {
      type: Number,
      required: true,
      default: 0
    },
    y: {
      type: Number,
      required: true,
      default: 0
    }
  },

  // Tamaño del elemento
  size: {
    width: {
      type: Number,
      required: true,
      default: 200
    },
    height: {
      type: Number,
      required: true,
      default: 150
    }
  },

  // Propiedades específicas del tipo de elemento
  properties: {
    // Para clases, interfaces, etc.
    stereotype: {
      type: String,
      default: ''
    },
    isAbstract: {
      type: Boolean,
      default: false
    },
    packageName: {
      type: String,
      default: ''
    },

    // Atributos y operaciones para clases/interfaces
    attributes: [attributeSchema],
    operations: [operationSchema],

    // Para enums
    literals: [{
      name: String,
      value: String
    }],

    // Para casos de uso
    preconditions: [String],
    postconditions: [String],
    mainFlow: [String],
    alternativeFlows: [{
      name: String,
      steps: [String]
    }],

    // Para actores
    description: {
      type: String,
      default: ''
    },

    // Para notas
    text: {
      type: String,
      default: ''
    },

    // Para tablas intermedias
    isIntermediateTable: {
      type: Boolean,
      default: false
    },
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

  // Estilos visuales
  styles: {
    backgroundColor: {
      type: String,
      default: '#FFFFFF'
    },
    borderColor: {
      type: String,
      default: '#000000'
    },
    borderWidth: {
      type: Number,
      default: 1
    },
    fontSize: {
      type: Number,
      default: 12
    },
    fontFamily: {
      type: String,
      default: 'Arial, sans-serif'
    },
    textColor: {
      type: String,
      default: '#000000'
    },
    cornerRadius: {
      type: Number,
      default: 0
    }
  },

  // Z-index para layering
  zIndex: {
    type: Number,
    default: 1
  },

  // Metadatos
  locked: {
    type: Boolean,
    default: false
  },
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
umlElementSchema.index({ diagramId: 1, type: 1 });
umlElementSchema.index({ diagramId: 1, zIndex: 1 });
umlElementSchema.index({ name: 'text' });

// Virtual para contar conexiones entrantes
umlElementSchema.virtual('incomingConnections', {
  ref: 'UMLConnection',
  localField: '_id',
  foreignField: 'targetElementId',
  count: true
});

// Virtual para contar conexiones salientes
umlElementSchema.virtual('outgoingConnections', {
  ref: 'UMLConnection',
  localField: '_id',
  foreignField: 'sourceElementId',
  count: true
});

// Método para duplicar elemento
umlElementSchema.methods.duplicate = function(offsetX = 20, offsetY = 20) {
  console.log('🔄 Iniciando duplicación del elemento:', {
    originalId: this._id,
    originalName: this.name,
    originalType: this.type
  });

  // Crear un nuevo documento completamente desde cero
  const duplicated = new this.constructor({
    diagramId: this.diagramId,
    name: `${this.name} - Copia`,
    type: this.type,
    position: {
      x: this.position.x + offsetX,
      y: this.position.y + offsetY
    },
    size: { ...this.size },
    styles: { ...this.styles },
    properties: { ...this.properties },
    zIndex: this.zIndex || 0
  });

  console.log('🔄 Elemento duplicado creado:', {
    newId: duplicated._id,
    newName: duplicated.name,
    newType: duplicated.type,
    position: duplicated.position,
    diagramId: duplicated.diagramId
  });

  return duplicated;
};

// Método para validar elemento según su tipo
umlElementSchema.methods.validate = function() {
  const errors = [];

  // Validaciones básicas
  if (!this.name || this.name.trim() === '') {
    errors.push('El nombre es requerido');
  }

  // Validaciones específicas por tipo
  switch (this.type) {
    case 'class':
    case 'interface':
    case 'abstract_class':
      // Validar que los atributos tengan nombre y tipo
      this.properties.attributes.forEach((attr, index) => {
        if (!attr.name) {
          errors.push(`Atributo ${index + 1}: nombre requerido`);
        }
        if (!attr.type) {
          errors.push(`Atributo ${index + 1}: tipo requerido`);
        }
      });

      // Validar que las operaciones tengan nombre
      this.properties.operations.forEach((op, index) => {
        if (!op.name) {
          errors.push(`Operación ${index + 1}: nombre requerido`);
        }
        // Validar parámetros
        op.parameters.forEach((param, paramIndex) => {
          if (!param.name || !param.type) {
            errors.push(`Operación ${index + 1}, parámetro ${paramIndex + 1}: nombre y tipo requeridos`);
          }
        });
      });
      break;

    case 'enum':
      if (!this.properties.literals || this.properties.literals.length === 0) {
        errors.push('Los enums deben tener al menos un literal');
      }
      break;

    case 'use_case':
      if (!this.properties.description || this.properties.description.trim() === '') {
        errors.push('Los casos de uso deben tener una descripción');
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Método estático para generar código
umlElementSchema.statics.generateCode = function(elements, language = 'java') {
  const generators = {
    java: this.generateJavaCode,
    csharp: this.generateCSharpCode,
    python: this.generatePythonCode
  };

  const generator = generators[language.toLowerCase()];
  if (!generator) {
    throw new Error(`Lenguaje no soportado: ${language}`);
  }

  return generator(elements);
};

// Generador de código Java
umlElementSchema.statics.generateJavaCode = function(elements) {
  return elements.filter(el => ['class', 'interface', 'enum'].includes(el.type))
    .map(element => {
      let code = '';

      // Package declaration
      if (element.properties.packageName) {
        code += `package ${element.properties.packageName};\n\n`;
      }

      // Class/Interface declaration
      const visibility = 'public';
      const isAbstract = element.properties.isAbstract ? 'abstract ' : '';
      const keyword = element.type === 'interface' ? 'interface' : 'class';

      code += `${visibility} ${isAbstract}${keyword} ${element.name} {\n`;

      if (element.type === 'enum') {
        // Enum literals
        const literals = element.properties.literals.map(lit => lit.name).join(', ');
        code += `    ${literals};\n`;
      } else {
        // Attributes
        element.properties.attributes.forEach(attr => {
          const visibility = this.getJavaVisibility(attr.visibility);
          const isStatic = attr.isStatic ? 'static ' : '';
          const isFinal = attr.isFinal ? 'final ' : '';
          const defaultValue = attr.defaultValue ? ` = ${attr.defaultValue}` : '';

          code += `    ${visibility} ${isStatic}${isFinal}${attr.type} ${attr.name}${defaultValue};\n`;
        });

        if (element.properties.attributes.length > 0 && element.properties.operations.length > 0) {
          code += '\n';
        }

        // Operations
        element.properties.operations.forEach(op => {
          const visibility = this.getJavaVisibility(op.visibility);
          const isStatic = op.isStatic ? 'static ' : '';
          const isAbstract = op.isAbstract ? 'abstract ' : '';
          const isFinal = op.isFinal ? 'final ' : '';

          const params = op.parameters.map(p => `${p.type} ${p.name}`).join(', ');

          if (element.type === 'interface' || op.isAbstract) {
            code += `    ${visibility} ${op.returnType} ${op.name}(${params});\n`;
          } else {
            code += `    ${visibility} ${isStatic}${isAbstract}${isFinal}${op.returnType} ${op.name}(${params}) {\n`;
            code += `        // TODO: Implementar\n`;
            code += `    }\n`;
          }
        });
      }

      code += '}\n';
      return code;
    }).join('\n\n');
};

// Helper para convertir visibilidad a Java
umlElementSchema.statics.getJavaVisibility = function(visibility) {
  switch (visibility) {
    case 'public': return 'public';
    case 'private': return 'private';
    case 'protected': return 'protected';
    case 'package': return '';
    default: return 'private';
  }
};

module.exports = mongoose.model('UMLElement', umlElementSchema);