// backend/models/Element.js
const mongoose = require('mongoose');

const ElementSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      // Tipos existentes
      'container', 'text', 'button', 'image', 'input', 'checkbox', 
      'radio', 'select', 'icon', 'textarea', 'navbar', 'link', 
      'menu', 'menuItem', 'card', 'hero', 'footer', 'carousel', 
      'video', 'avatar', 'alert', 'badge', 'tooltip', 'progress',
      // Nuevos tipos para Flutter
      'elevatedButton', 'outlinedButton', 'textButton', 'row', 'column',
      'stack', 'expanded', 'appBar', 'floatingActionButton', 'textField',
      'switch', 'slider', 'bottomNavigationBar', 'tabBar', 'drawer',
      'divider'
    ]
  },
  name: {
    type: String,
    required: true
  },
  content: {
    type: String,
    default: ''
  },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  size: {
    width: { type: Number, default: 100 },
    height: { type: Number, default: 100 }
  },
  styles: {
    backgroundColor: { type: String, default: 'transparent' },
    color: { type: String, default: '#000000' },
    borderWidth: { type: Number, default: 0 },
    borderColor: { type: String, default: '#000000' },
    borderRadius: { type: Number, default: 0 },
    fontFamily: { type: String, default: 'Arial' },
    fontSize: { type: Number, default: 14 },
    padding: { type: String, default: '0px' },
    margin: { type: String, default: '0px' },
    boxShadow: { type: String, default: 'none' },
    zIndex: { type: Number, default: 1 },
    opacity: { type: Number, default: 1 },
    display: { type: String, default: 'block' },
    flexDirection: { type: String, default: 'row' },
    justifyContent: { type: String, default: 'flex-start' },
    alignItems: { type: String, default: 'flex-start' },
    textAlign: { type: String, default: 'left' },
    customCSS: { type: String, default: '' }
  },
  flutterWidget: {
    type: String,
    default: null
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Element',
    default: null
  },
  children: [{
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

module.exports = mongoose.model('Element', ElementSchema);