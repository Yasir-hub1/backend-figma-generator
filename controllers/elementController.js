// backend/controllers/elementController.js - COMPLETO Y CORREGIDO
const Element = require('../models/Element');
const Project = require('../models/Project');
const Screen = require('../models/Screen');

// CORRECCIÓN: Crear un nuevo elemento
const createElement = async (req, res) => {
  try {
    const { screenId, type, name, content, position, size, styles, flutterWidget, flutterProps } = req.body;
    
    console.log('Creando elemento:', { screenId, type, name });
    
    // Validar que screenId esté presente
    if (!screenId) {
      return res.status(400).json({ message: 'Screen ID es requerido' });
    }

    // Verificar que la screen existe
    const screen = await Screen.findById(screenId);
    if (!screen) {
      return res.status(404).json({ message: 'Screen no encontrada' });
    }

    // Verificar permisos del proyecto
    const project = await Project.findById(screen.projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para crear elementos en este proyecto' });
    }

    // Crear el elemento
    const element = new Element({
      screenId,
      type,
      name: name || `${type} ${Date.now()}`,
      content: content || '',
      position: position || { x: 0, y: 0 },
      size: size || { width: 100, height: 50 },
      styles: styles || {},
      flutterWidget: flutterWidget || type,
      flutterProps: flutterProps || {}
    });

    const savedElement = await element.save();
    console.log('Elemento creado:', savedElement._id);
    
    res.status(201).json(savedElement);
  } catch (error) {
    console.error('Error al crear elemento:', error);
    res.status(500).json({ message: 'Error al crear elemento', error: error.message });
  }
};

// CORRECCIÓN: Obtener elementos por screen (la función que faltaba)
const getElementsByScreen = async (req, res) => {
  try {
    const { screenId } = req.params;
    
    // console.log('Obteniendo elementos para screen:', screenId);
    
    if (!screenId) {
      return res.status(400).json({ message: 'Screen ID es requerido' });
    }

    // Verificar que la screen existe
    const screen = await Screen.findById(screenId);
    if (!screen) {
      return res.status(404).json({ message: 'Screen no encontrada' });
    }

    // Verificar permisos del proyecto
    const project = await Project.findById(screen.projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }

    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para ver elementos de este proyecto' });
    }

    // Buscar elementos que pertenezcan a esta screen
    const elements = await Element.find({ screenId: screenId }).sort({ createdAt: -1 });
    
    // console.log(`Encontrados ${elements.length} elementos para screen ${screenId}`);
    
    res.status(200).json(elements);
  } catch (error) {
    console.error('Error al obtener elementos por screen:', error);
    res.status(500).json({ message: 'Error al obtener elementos', error: error.message });
  }
};

// MANTENER: Obtener todos los elementos de un proyecto (compatibilidad)
const getElements = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    console.log('Obteniendo elementos para proyecto:', projectId);
    
    // Verificar si el proyecto existe
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar permisos
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para ver este proyecto' });
    }
    
    // Obtener todas las screens del proyecto
    const screens = await Screen.find({ projectId: projectId });
    const screenIds = screens.map(screen => screen._id);
    
    // Obtener elementos de todas las screens
    const elements = await Element.find({ screenId: { $in: screenIds } });
    
    res.status(200).json(elements);
  } catch (error) {
    console.error('Error al obtener elementos:', error);
    res.status(500).json({ message: 'Error al obtener elementos', error: error.message });
  }
};

// Actualizar un elemento
const updateElement = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, content, position, size, styles, flutterWidget, flutterProps } = req.body;
    
    console.log('Actualizando elemento:', id);
    
    const element = await Element.findById(id);
    if (!element) {
      return res.status(404).json({ message: 'Elemento no encontrado' });
    }
    
    // Verificar permisos a través de la screen
    const screen = await Screen.findById(element.screenId);
    if (!screen) {
      return res.status(404).json({ message: 'Screen no encontrada' });
    }
    
    const project = await Project.findById(screen.projectId);
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para editar este elemento' });
    }
    
    // Actualizar elemento
    element.name = name || element.name;
    element.content = content !== undefined ? content : element.content;
    element.position = position || element.position;
    element.size = size || element.size;
    element.styles = styles ? { ...element.styles, ...styles } : element.styles;
    element.flutterWidget = flutterWidget || element.flutterWidget;
    element.flutterProps = flutterProps ? { ...element.flutterProps, ...flutterProps } : element.flutterProps;
    element.updatedAt = Date.now();
    
    await element.save();
    
    res.status(200).json(element);
  } catch (error) {
    console.error('Error al actualizar elemento:', error);
    res.status(500).json({ message: 'Error al actualizar el elemento', error: error.message });
  }
};

// Eliminar un elemento
const deleteElement = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Eliminando elemento:', id);
    
    const element = await Element.findById(id);
    if (!element) {
      return res.status(404).json({ message: 'Elemento no encontrado' });
    }
    
    // Verificar permisos a través de la screen
    const screen = await Screen.findById(element.screenId);
    if (!screen) {
      return res.status(404).json({ message: 'Screen no encontrada' });
    }
    
    const project = await Project.findById(screen.projectId);
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar este elemento' });
    }
    
    // Eliminar el elemento
    await Element.findByIdAndDelete(id);
    
    res.status(200).json({ message: 'Elemento eliminado con éxito' });
  } catch (error) {
    console.error('Error al eliminar elemento:', error);
    res.status(500).json({ message: 'Error al eliminar el elemento', error: error.message });
  }
};

// Duplicar un elemento
// Duplicar un elemento
const duplicateElement = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Duplicando elemento:', id);
    
    const originalElement = await Element.findById(id);
    if (!originalElement) {
      return res.status(404).json({ message: 'Elemento no encontrado' });
    }
    
    // Verificar permisos a través de la screen
    const screen = await Screen.findById(originalElement.screenId);
    if (!screen) {
      return res.status(404).json({ message: 'Screen no encontrada' });
    }
    
    const project = await Project.findById(screen.projectId);
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para duplicar este elemento' });
    }
    
    // CORRECCIÓN: Crear una copia del elemento excluyendo campos de MongoDB
    const elementData = originalElement.toObject();
    
    // Excluir campos que MongoDB genera automáticamente
    delete elementData._id;
    delete elementData.__v;
    delete elementData.createdAt;
    delete elementData.updatedAt;
    delete elementData.id; // También excluir el campo virtual 'id'
    
    // Crear el nuevo elemento con datos modificados
    const newElement = new Element({
      ...elementData,
      name: `${elementData.name} (copia)`,
      position: {
        x: elementData.position.x + 20,
        y: elementData.position.y + 20
      }
    });
    
    const savedElement = await newElement.save();
    
    res.status(201).json(savedElement);
  } catch (error) {
    console.error('Error al duplicar elemento:', error);
    res.status(500).json({ message: 'Error al duplicar el elemento', error: error.message });
  }
};

// CORRECCIÓN: Exportar a Flutter por screen específica
const exportToFlutterByScreen = async (req, res) => {
  try {
    const { screenId } = req.params;
    const { includeStyles, includePositions } = req.body || { includeStyles: true, includePositions: true };
    
    console.log('Exportando screen a Flutter:', screenId, {
      includeStyles,
      includePositions
    });
    
    if (!screenId) {
      return res.status(400).json({ message: 'Screen ID es requerido' });
    }

    // Obtener la screen
    const screen = await Screen.findById(screenId);
    if (!screen) {
      return res.status(404).json({ message: 'Screen no encontrada' });
    }

    // Verificar permisos
    const project = await Project.findById(screen.projectId);
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para exportar esta screen' });
    }

    // Obtener elementos de esta screen
    const elements = await Element.find({ screenId: screenId }).sort({ zIndex: 1, createdAt: 1 });
    
    console.log(`Encontrados ${elements.length} elementos para exportar`);
    
    if (elements.length === 0) {
      console.log('La screen no tiene elementos, generando pantalla vacía');
    }

    // Generar código Flutter para esta screen específica
    const flutterCode = generateFlutterCodeForScreen(screen, elements);
    
    // Normalizar nombre de clase
    const screenName = screen.name
      .replace(/\s+/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .replace(/^[0-9]/, 'S$&');
    
    res.status(200).json({
      message: 'Screen exportada a Flutter con éxito',
      screenName: screen.name,
      screenId: screen._id,
      projectName: project.name,
      widget: flutterCode.widget,      // Solo el widget
      screen: flutterCode.screen,      // Código completo de la pantalla
      pubspec: flutterCode.pubspec,    // Archivo pubspec.yaml
      readme: flutterCode.readme,      // README.md
      fullCode: flutterCode.fullCode,  // Código completo para compatibilidad
      timestamp: new Date().toISOString(),
      elementsCount: elements.length,
      canvasSize: {
        width: screen.canvas?.width || 360,
        height: screen.canvas?.height || 640
      }
    });
  } catch (error) {
    console.error('Error al exportar screen a Flutter:', error);
    res.status(500).json({ 
      message: 'Error al exportar a Flutter', 
      error: error.message 
    });
  }
};

// Exportar proyecto completo a Flutter (mantener por compatibilidad)
const exportToFlutter = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    console.log('Exportando proyecto a Flutter:', projectId);
    
    // Verificar si el proyecto existe
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Proyecto no encontrado' });
    }
    
    // Verificar permisos
    if (!project.owner.equals(req.userId) && !project.collaborators.some(collab => collab.equals(req.userId))) {
      return res.status(403).json({ message: 'No tienes permiso para exportar este proyecto' });
    }
    
    // Obtener todas las screens del proyecto
    const screens = await Screen.find({ projectId: projectId });
    
    // Generar código para cada screen
    const exportData = {
      projectName: project.name,
      screens: []
    };
    
    for (const screen of screens) {
      const elements = await Element.find({ screenId: screen._id }).sort({ createdAt: 1 });
      const screenCode = generateFlutterCodeForScreen(screen, elements);
      
      exportData.screens.push({
        screenName: screen.name,
        ...screenCode
      });
    }
    
    res.status(200).json({
      message: 'Proyecto exportado a Flutter con éxito',
      ...exportData
    });
    
  } catch (error) {
    console.error('Error al exportar proyecto a Flutter:', error);
    res.status(500).json({ 
      message: 'Error al exportar a Flutter', 
      error: error.message 
    });
  }
};

// FUNCIÓN AUXILIAR CORREGIDA: Generar código Flutter para una screen (con MaterialApp)
const generateFlutterCodeForScreen = (screen, elements) => {
  // Normalizar nombre de clase para evitar caracteres no válidos
  const screenName = screen.name
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .replace(/^[0-9]/, 'S$&'); // Evitar que comience con número
  
  // Convertir color de fondo
  const getBackgroundColor = (color) => {
    if (!color || color === 'transparent') return 'Colors.white';
    
    // Manejar formatos de color
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      return `Color(0xFF${hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex})`;
    }
    
    if (color.startsWith('rgb')) {
      const values = color.match(/\d+/g);
      if (values && values.length >= 3) {
        const r = parseInt(values[0]).toString(16).padStart(2, '0');
        const g = parseInt(values[1]).toString(16).padStart(2, '0');
        const b = parseInt(values[2]).toString(16).padStart(2, '0');
        const a = values.length > 3 ? Math.round(parseFloat(values[3]) * 255).toString(16).padStart(2, '0') : 'FF';
        return `Color(0x${a}${r}${g}${b})`;
      }
    }
    
    // Colores predefinidos de Flutter
    const predefinedColors = {
      'red': 'Colors.red',
      'blue': 'Colors.blue',
      'green': 'Colors.green',
      'yellow': 'Colors.yellow',
      'black': 'Colors.black',
      'white': 'Colors.white',
      'grey': 'Colors.grey',
      'gray': 'Colors.grey'
    };
    
    return predefinedColors[color.toLowerCase()] || 'Colors.white';
  };
  
  // Determinar si tiene AppBar
  const hasAppBar = elements.some(el => el.type === 'appBar');
  
  // Determinar si tiene FloatingActionButton
  const hasFAB = elements.some(el => el.type === 'floatingActionButton');
  const fabElement = hasFAB ? elements.find(el => el.type === 'floatingActionButton') : null;
  
  // Determinar si tiene BottomNavigationBar
  const hasBottomNav = elements.some(el => el.type === 'bottomNavigationBar');
  const bottomNavElement = hasBottomNav ? elements.find(el => el.type === 'bottomNavigationBar') : null;
  
  // Filtrar elementos que no son parte de la estructura básica
  const contentElements = elements.filter(el => 
    el.type !== 'appBar' && 
    el.type !== 'floatingActionButton' && 
    el.type !== 'bottomNavigationBar'
  );
  
  // Generar código de la clase con MaterialApp como raíz
  const dartCode = `import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${screen.name}',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      home: const ${screenName}Screen(),
    );
  }
}

class ${screenName}Screen extends StatelessWidget {
  const ${screenName}Screen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ${getBackgroundColor(screen.canvas?.background || '#FFFFFF')},
      ${hasAppBar ? generateAppBarCode(elements.find(el => el.type === 'appBar')) : '// No AppBar definido'}
      ${hasFAB ? generateFABCode(fabElement) : '// No FloatingActionButton definido'}
      ${hasBottomNav ? generateBottomNavCode(bottomNavElement) : '// No BottomNavigationBar definido'}
      body: SizedBox(
        width: ${screen.canvas?.width || 360}.0,
        height: ${screen.canvas?.height || 640}.0,
        child: Stack(
          children: [
${contentElements.map(element => generateElementCode(element)).join('\n')}
          ],
        ),
      ),
    );
  }
}`;

  // Función para generar código del AppBar
  function generateAppBarCode(appBar) {
    if (!appBar) return 'appBar: null,';
    
    const styles = appBar.styles || {};
    const color = styles.backgroundColor || '#2196F3';
    
    return `appBar: AppBar(
        title: Text('${(appBar.content || 'AppBar').replace(/'/g, "\\'")}'),
        backgroundColor: ${getBackgroundColor(color)},
        elevation: ${styles.elevation || 4}.0,
      ),`;
  }
  
  // Función para generar código del FloatingActionButton
  function generateFABCode(fab) {
    if (!fab) return 'floatingActionButton: null,';
    
    const styles = fab.styles || {};
    const color = styles.backgroundColor || '#FF4081';
    
    return `floatingActionButton: FloatingActionButton(
        onPressed: () {
          // Acción del FAB
        },
        backgroundColor: ${getBackgroundColor(color)},
        child: Icon(Icons.add),
      ),`;
  }
  
  // Función para generar código del BottomNavigationBar
  function generateBottomNavCode(bottomNav) {
    if (!bottomNav) return 'bottomNavigationBar: null,';
    
    const styles = bottomNav.styles || {};
    const color = styles.backgroundColor || '#FFFFFF';
    
    return `bottomNavigationBar: BottomNavigationBar(
        items: const <BottomNavigationBarItem>[
          BottomNavigationBarItem(
            icon: Icon(Icons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.search),
            label: 'Search',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
        currentIndex: 0,
        selectedItemColor: Colors.blue,
        backgroundColor: ${getBackgroundColor(color)},
      ),`;
  }

  // Generar solo el widget (sin MaterialApp)
  const widgetCode = `import 'package:flutter/material.dart';

class ${screenName}Widget extends StatelessWidget {
  const ${screenName}Widget({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: ${screen.canvas?.width || 360}.0,
      height: ${screen.canvas?.height || 640}.0,
      child: Stack(
        children: [
${elements.map(element => generateElementCode(element)).join('\n')}
        ],
      ),
    );
  }
}`;

  // Generar pubspec.yaml
  const pubspecCode = `name: flutter_app
description: Generated Flutter app from ${screen.name}

publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.5

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^2.0.2

flutter:
  uses-material-design: true`;

  // Generar main.dart completo (incluye app completa)
  const mainDartCode = `import 'package:flutter/material.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${screen.name}',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      home: const ${screenName}Screen(),
    );
  }
}

class ${screenName}Screen extends StatelessWidget {
  const ${screenName}Screen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ${getBackgroundColor(screen.canvas?.background || '#FFFFFF')},
      ${hasAppBar ? generateAppBarCode(elements.find(el => el.type === 'appBar')) : '// No AppBar definido'}
      ${hasFAB ? generateFABCode(fabElement) : '// No FloatingActionButton definido'}
      ${hasBottomNav ? generateBottomNavCode(bottomNavElement) : '// No BottomNavigationBar definido'}
      body: SizedBox(
        width: ${screen.canvas?.width || 360}.0,
        height: ${screen.canvas?.height || 640}.0,
        child: Stack(
          children: [
${contentElements.map(element => generateElementCode(element)).join('\n')}
          ],
        ),
      ),
    );
  }
}`;

  // Generar README.md
  const readmeCode = `# ${screen.name} - Flutter App

Esta aplicación fue generada automáticamente desde tu diseño.

## Descripción
- Nombre: ${screen.name}
- Dimensiones: ${screen.canvas?.width || 360}x${screen.canvas?.height || 640}
- Elementos: ${elements.length}

## Uso

Para ejecutar la aplicación:

\`\`\`bash
flutter pub get
flutter run
\`\`\`

## Estructura

- **main.dart**: Contiene la aplicación completa con MaterialApp y Scaffold
- **widget_only.dart**: Contiene solo el widget de la pantalla sin MaterialApp (para usar en otras pantallas)

## Notas

Esta aplicación está configurada con Material Design 3 y utiliza posicionamiento preciso para recrear tu diseño.
`;

  // Devolver todos los códigos generados
  return {
    widget: widgetCode,       // Solo el widget (para componentes)
    screen: dartCode,         // Pantalla con MaterialApp (para aplicación completa)
    pubspec: pubspecCode,     // Archivo pubspec.yaml
    readme: readmeCode,       // README.md
    fullCode: mainDartCode,   // Código completo (main.dart)
    timestamp: new Date().toISOString()
  };
};

// FUNCIÓN AUXILIAR CORREGIDA: Generar código para un elemento individual
const generateElementCode = (element) => {
  const position = element.position || { x: 0, y: 0 };
  const size = element.size || { width: 100, height: 50 };
  const styles = element.styles || {};
  const indent = '            ';
  
  // Función mejorada para manejar colores
  const getColorValue = (color) => {
    if (!color) return '0xFF000000';
    if (color === 'transparent') return '0x00000000';
    
    // Manejar formato rgba
    if (color.startsWith('rgba')) {
      const rgba = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      if (rgba) {
        const r = parseInt(rgba[1]).toString(16).padStart(2, '0');
        const g = parseInt(rgba[2]).toString(16).padStart(2, '0');
        const b = parseInt(rgba[3]).toString(16).padStart(2, '0');
        const a = Math.round(parseFloat(rgba[4]) * 255).toString(16).padStart(2, '0');
        return `0x${a}${r}${g}${b}`.toUpperCase();
      }
    }
    
    // Manejar formato rgb
    if (color.startsWith('rgb')) {
      const rgb = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgb) {
        const r = parseInt(rgb[1]).toString(16).padStart(2, '0');
        const g = parseInt(rgb[2]).toString(16).padStart(2, '0');
        const b = parseInt(rgb[3]).toString(16).padStart(2, '0');
        return `0xFF${r}${g}${b}`.toUpperCase();
      }
    }
    
    // Manejar formato hexadecimal
    const hex = color.replace('#', '');
    if (hex.length === 3) {
      const r = hex[0] + hex[0];
      const g = hex[1] + hex[1];
      const b = hex[2] + hex[2];
      return `0xFF${r}${g}${b}`.toUpperCase();
    }
    
    return `0xFF${hex}`.toUpperCase();
  };

  // Función para manejar font weight
  const getFontWeight = (weight) => {
    if (!weight) return 'FontWeight.normal';
    
    const weights = {
      'normal': 'FontWeight.normal',
      'bold': 'FontWeight.bold',
      '100': 'FontWeight.w100',
      '200': 'FontWeight.w200',
      '300': 'FontWeight.w300',
      '400': 'FontWeight.w400',
      '500': 'FontWeight.w500',
      '600': 'FontWeight.w600',
      '700': 'FontWeight.w700',
      '800': 'FontWeight.w800',
      '900': 'FontWeight.w900'
    };
    
    return weights[weight] || 'FontWeight.normal';
  };
  
  // Función para manejar text align
  const getTextAlign = (align) => {
    if (!align) return null;
    
    const aligns = {
      'left': 'TextAlign.left',
      'center': 'TextAlign.center',
      'right': 'TextAlign.right',
      'justify': 'TextAlign.justify'
    };
    
    return aligns[align] || null;
  };

  // Función para generar código de border radius
  const getBorderRadius = (radius) => {
    if (!radius) return null;
    
    if (!isNaN(parseFloat(radius))) {
      return `BorderRadius.circular(${parseFloat(radius)}.0)`;
    }
    
    if (typeof radius === 'string' && radius.includes('px')) {
      const value = parseFloat(radius);
      if (!isNaN(value)) {
        return `BorderRadius.circular(${value}.0)`;
      }
    }
    
    return null;
  };
  
  // Función para generar código de border
  const getBorder = (width, color) => {
    if (!width || !color) return null;
    
    let borderWidth = 1.0;
    if (typeof width === 'number') {
      borderWidth = width;
    } else if (typeof width === 'string' && width.includes('px')) {
      borderWidth = parseFloat(width);
      if (isNaN(borderWidth)) borderWidth = 1.0;
    }
    
    return `Border.all(
${indent}        color: Color(${getColorValue(color)}),
${indent}        width: ${borderWidth}.0,
${indent}      )`;
  };
  
  // Generar código según el tipo de elemento
  switch (element.type) {
    case 'text':
      return `${indent}Positioned(
${indent}  left: ${position.x}.0,
${indent}  top: ${position.y}.0,
${indent}  child: SizedBox(
${indent}    width: ${size.width}.0,
${indent}    height: ${size.height}.0,
${indent}    child: Text(
${indent}      '${(element.content || 'Text').replace(/'/g, "\\'")}',
${indent}      style: TextStyle(
${indent}        color: Color(${getColorValue(styles.color || '#000000')}),
${indent}        fontSize: ${styles.fontSize || 14}.0,
${indent}        fontWeight: ${getFontWeight(styles.fontWeight)},
${styles.fontFamily ? `${indent}        fontFamily: '${styles.fontFamily}',\n` : ''}${styles.letterSpacing ? `${indent}        letterSpacing: ${parseFloat(styles.letterSpacing)}.0,\n` : ''}${indent}      ),
${getTextAlign(styles.textAlign) ? `${indent}      textAlign: ${getTextAlign(styles.textAlign)},\n` : ''}${indent}      overflow: TextOverflow.visible,
${indent}    ),
${indent}  ),
${indent}),`;
    
    case 'elevatedButton':
    case 'outlinedButton':
    case 'textButton':
      const buttonType = element.type === 'elevatedButton' ? 'ElevatedButton' : 
                         element.type === 'outlinedButton' ? 'OutlinedButton' : 'TextButton';
      
      return `${indent}Positioned(
${indent}  left: ${position.x}.0,
${indent}  top: ${position.y}.0,
${indent}  child: SizedBox(
${indent}    width: ${size.width}.0,
${indent}    height: ${size.height}.0,
${indent}    child: ${buttonType}(
${indent}      onPressed: () {
${indent}        // Acción del botón
${indent}      },
${indent}      style: ${buttonType}.styleFrom(
${styles.backgroundColor ? `${indent}        backgroundColor: Color(${getColorValue(styles.backgroundColor)}),\n` : ''}${styles.foregroundColor || styles.color ? `${indent}        foregroundColor: Color(${getColorValue(styles.foregroundColor || styles.color)}),\n` : ''}${styles.padding ? `${indent}        padding: EdgeInsets.all(${parseFloat(styles.padding)}.0),\n` : ''}${getBorderRadius(styles.borderRadius) ? `${indent}        shape: RoundedRectangleBorder(borderRadius: ${getBorderRadius(styles.borderRadius)}),\n` : ''}${indent}      ),
${indent}      child: Text(
${indent}        '${(element.content || 'Button').replace(/'/g, "\\'")}',
${styles.fontSize ? `${indent}        style: TextStyle(fontSize: ${parseFloat(styles.fontSize)}.0),\n` : ''}${indent}      ),
${indent}    ),
${indent}  ),
${indent}),`;
    
    case 'container':
      return `${indent}Positioned(
${indent}  left: ${position.x}.0,
${indent}  top: ${position.y}.0,
${indent}  child: Container(
${indent}    width: ${size.width}.0,
${indent}    height: ${size.height}.0,
${indent}    decoration: BoxDecoration(
${styles.backgroundColor ? `${indent}      color: Color(${getColorValue(styles.backgroundColor)}),\n` : ''}${getBorderRadius(styles.borderRadius) ? `${indent}      borderRadius: ${getBorderRadius(styles.borderRadius)},\n` : ''}${getBorder(styles.borderWidth, styles.borderColor) ? `${indent}      border: ${getBorder(styles.borderWidth, styles.borderColor)},\n` : ''}${styles.boxShadow && styles.boxShadow !== 'none' ? `${indent}      boxShadow: [
${indent}        BoxShadow(
${indent}          color: Colors.black.withOpacity(0.25),
${indent}          spreadRadius: 1,
${indent}          blurRadius: 3,
${indent}          offset: const Offset(0, 2),
${indent}        ),
${indent}      ],\n` : ''}${indent}    ),
${element.content ? `${indent}    child: Center(
${indent}      child: Text('${element.content.replace(/'/g, "\\'")}'),
${indent}    ),\n` : ''}${indent}  ),
${indent}),`;
    
    case 'image':
      return `${indent}Positioned(
${indent}  left: ${position.x}.0,
${indent}  top: ${position.y}.0,
${indent}  child: Container(
${indent}    width: ${size.width}.0,
${indent}    height: ${size.height}.0,
${getBorderRadius(styles.borderRadius) ? `${indent}    clipBehavior: Clip.antiAlias,
${indent}    decoration: BoxDecoration(
${indent}      borderRadius: ${getBorderRadius(styles.borderRadius)},
${indent}    ),\n` : ''}${indent}    child: ${element.content ? `Image.network(
${indent}      '${element.content}',
${indent}      fit: BoxFit.cover,
${indent}      errorBuilder: (context, error, stackTrace) {
${indent}        return Container(
${indent}          color: Colors.grey[300],
${indent}          child: const Center(child: Icon(Icons.broken_image)),
${indent}        );
${indent}      },
${indent}    )` : `Container(
${indent}      color: Colors.grey[300],
${indent}      child: const Center(child: Icon(Icons.image)),
${indent}    )`},
${indent}  ),
${indent}),`;
    
    case 'appBar':
      return `${indent}Positioned(
${indent}  left: ${position.x}.0,
${indent}  top: ${position.y}.0,
${indent}  child: Container(
${indent}    width: ${size.width}.0,
${indent}    height: ${size.height}.0,
${indent}    decoration: BoxDecoration(
${indent}      color: Color(${getColorValue(styles.backgroundColor || '#2196F3')}),
${indent}      boxShadow: [
${indent}        BoxShadow(
${indent}          color: Colors.black.withOpacity(0.1),
${indent}          spreadRadius: 0,
${indent}          blurRadius: 4,
${indent}          offset: const Offset(0, 2),
${indent}        ),
${indent}      ],
${indent}    ),
${indent}    child: const Padding(
${indent}      padding: EdgeInsets.symmetric(horizontal: 16.0),
${indent}      child: Row(
${indent}        mainAxisAlignment: MainAxisAlignment.spaceBetween,
${indent}        children: [
${indent}          Text(
${indent}            '${(element.content || 'AppBar').replace(/'/g, "\\'")}',
${indent}            style: TextStyle(
${indent}              color: Colors.white,
${indent}              fontSize: 20.0,
${indent}              fontWeight: FontWeight.w500,
${indent}            ),
${indent}          ),
${indent}          Icon(Icons.more_vert, color: Colors.white),
${indent}        ],
${indent}      ),
${indent}    ),
${indent}  ),
${indent}),`;
    
    case 'divider':
      return `${indent}Positioned(
${indent}  left: ${position.x}.0,
${indent}  top: ${position.y}.0,
${indent}  child: SizedBox(
${indent}    width: ${size.width}.0,
${indent}    height: ${size.height}.0,
${indent}    child: Divider(
${indent}      color: Color(${getColorValue(styles.color || '#BDBDBD')}),
${indent}      thickness: ${styles.borderWidth ? parseFloat(styles.borderWidth) : 1}.0,
${indent}    ),
${indent}  ),
${indent}),`;
    
    case 'card':
      return `${indent}Positioned(
${indent}  left: ${position.x}.0,
${indent}  top: ${position.y}.0,
${indent}  child: SizedBox(
${indent}    width: ${size.width}.0,
${indent}    height: ${size.height}.0,
${indent}    child: Card(
${indent}      color: Color(${getColorValue(styles.backgroundColor || '#FFFFFF')}),
${indent}      elevation: ${styles.elevation || 1}.0,
${getBorderRadius(styles.borderRadius) ? `${indent}      shape: RoundedRectangleBorder(
${indent}        borderRadius: ${getBorderRadius(styles.borderRadius)},
${indent}      ),\n` : ''}${indent}      child: Padding(
${indent}        padding: const EdgeInsets.all(16.0),
${indent}        child: Center(
${indent}          child: Text(
${indent}            '${(element.content || 'Card Content').replace(/'/g, "\\'")}',
${indent}            style: TextStyle(
${indent}              fontSize: 16.0,
${styles.color ? `${indent}              color: Color(${getColorValue(styles.color)}),\n` : ''}${indent}            ),
${indent}          ),
${indent}        ),
${indent}      ),
${indent}    ),
${indent}  ),
${indent}),`;
    
    case 'textField':
      return `${indent}Positioned(
${indent}  left: ${position.x}.0,
${indent}  top: ${position.y}.0,
${indent}  child: SizedBox(
${indent}    width: ${size.width}.0,
${indent}    height: ${size.height}.0,
${indent}    child: TextField(
${indent}      decoration: InputDecoration(
${indent}        hintText: '${(element.content || 'Hint text').replace(/'/g, "\\'")}',
${indent}        border: const OutlineInputBorder(),
${indent}        filled: ${styles.backgroundColor ? 'true' : 'false'},
${styles.backgroundColor ? `${indent}        fillColor: Color(${getColorValue(styles.backgroundColor)}),\n` : ''}${indent}      ),
${styles.color ? `${indent}      style: TextStyle(
${indent}        color: Color(${getColorValue(styles.color)}),
${indent}      ),\n` : ''}${indent}    ),
${indent}  ),
${indent}),`;
      
    case 'row':
    case 'column':
      const isRow = element.type === 'row';
      return `${indent}Positioned(
${indent}  left: ${position.x}.0,
${indent}  top: ${position.y}.0,
${indent}  child: SizedBox(
${indent}    width: ${size.width}.0,
${indent}    height: ${size.height}.0,
${indent}    child: ${isRow ? 'Row' : 'Column'}(
${indent}      mainAxisAlignment: MainAxisAlignment.center,
${indent}      crossAxisAlignment: CrossAxisAlignment.center,
${indent}      children: [
${indent}        Text('${isRow ? 'Row' : 'Column'} Layout')
${indent}      ],
${indent}    ),
${indent}  ),
${indent}),`;
    
    case 'stack':
      return `${indent}Positioned(
${indent}  left: ${position.x}.0,
${indent}  top: ${position.y}.0,
${indent}  child: SizedBox(
${indent}    width: ${size.width}.0,
${indent}    height: ${size.height}.0,
${indent}    child: Stack(
${indent}      children: [
${indent}        const Center(child: Text('Stack Layout'))
${indent}      ],
${indent}    ),
${indent}  ),
${indent}),`;
      
    default:
      return `${indent}Positioned(
${indent}  left: ${position.x}.0,
${indent}  top: ${position.y}.0,
${indent}  child: Container(
${indent}    width: ${size.width}.0,
${indent}    height: ${size.height}.0,
${indent}    decoration: BoxDecoration(
${indent}      color: Colors.grey[300],
${indent}      border: Border.all(color: Colors.grey),
${indent}    ),
${indent}    child: Center(
${indent}      child: Text('${element.type}'),
${indent}    ),
${indent}  ),
${indent}),`;
  }
};

module.exports = {
  createElement,
  getElementsByScreen,
  getElements,
  updateElement,
  deleteElement,
  duplicateElement,
  exportToFlutterByScreen,
  exportToFlutter
};