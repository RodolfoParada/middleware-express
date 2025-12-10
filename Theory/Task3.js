// Task 3: Parsing de Datos y CORS (8 minutos)
// Middleware integrado para parsear datos y habilitar CORS.

// Parsing de JSON
const express = require('express');
const app = express();

// Middleware para parsear JSON automáticamente
app.use(express.json()); // Content-Type: application/json

// Limite de tamaño (opcional)
app.use(express.json({ limit: '10mb' }));

// Ahora req.body contiene el objeto JSON parseado
app.post('/api/datos', (req, res) => {
  console.log('Datos recibidos:', req.body);
  console.log('Tipo de nombre:', typeof req.body.nombre);

  res.json({
    recibido: true,
    datos: req.body
  });
});
// Parsing de Formularios
const express = require('express');
const app = express();

// Para datos de formularios application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// Para datos multipart/form-data (archivos)
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

app.post('/formulario', express.urlencoded({ extended: true }), (req, res) => {
  console.log('Datos del formulario:', req.body);
  res.json({ recibido: req.body });
});

app.post('/upload', upload.single('archivo'), (req, res) => {
  console.log('Archivo subido:', req.file);
  res.json({ message: 'Archivo subido', archivo: req.file.filename });
});
// Configuración de CORS
const express = require('express');
const app = express();

// CORS manual (básico)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Para preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// CORS con paquete cors (recomendado)
const cors = require('cors');

// CORS para todos los orígenes
app.use(cors());

// CORS con configuración específica
app.use(cors({
  origin: ['http://localhost:3000', 'https://miapp.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // Cache preflight por 24 horas
}));

// CORS por ruta específica
app.get('/api/public', cors(), (req, res) => {
  res.json({ message: 'Esta ruta permite CORS' });
});

app.get('/api/private', cors({
  origin: 'https://admin.miapp.com'
}), (req, res) => {
  res.json({ message: 'Solo admin puede acceder' });
});
// Combinando Middleware
const express = require('express');
const cors = require('cors');
const app = express();

// Orden importa: middleware se ejecuta en orden
app.use(cors());                    // 1. Habilitar CORS
app.use(express.json());           // 2. Parsear JSON
app.use(express.urlencoded());     // 3. Parsear formularios

// Middleware personalizado
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Ahora podemos acceder a req.body en todas las rutas
app.post('/api/datos', (req, res) => {
  res.json({
    method: req.method,
    url: req.url,
    body: req.body,
    headers: req.headers
  });
});