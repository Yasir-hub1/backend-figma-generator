// backend/models/Screen.js
const mongoose = require('mongoose');

const ScreenSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  canvas: {
    width: {
      type: Number,
      default: 360
    },
    height: {
      type: Number,
      default: 640
    },
    background: {
      type: String,
      default: '#FFFFFF'
    }
  },
  elements: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Element'
  }],
  order: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Screen', ScreenSchema);