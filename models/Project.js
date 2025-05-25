// backend/models/Project.js
const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  deviceType: {
    type: String,
    enum: ['custom', 'iphone12', 'iphone8', 'pixel5', 'samsungs21', 'ipad'],
    default: 'custom'
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collaborators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  canvas: {
    width: {
      type: Number,
      default: 360 // Valor predeterminado para móvil
    },
    height: {
      type: Number,
      default: 640 // Valor predeterminado para móvil
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
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Project', ProjectSchema);