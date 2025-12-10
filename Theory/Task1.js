// Task 1: Tipos de Middleware en Express (8 minutos)
// El middleware es el corazón de Express.js. Son funciones que tienen acceso al objeto request (req), response (res) y a la siguiente función middleware en el ciclo petición-respuesta.

// ¿Qué es el Middleware?
// Función que se ejecuta durante el ciclo petición-respuesta:

function middleware(req, res, next) {
  // Hacer algo con req o res
  console.log(`${req.method} ${req.url}`);

  // Llamar next() para pasar al siguiente middleware
  next();
}
// Tipos de Middleware
// 1. Application-level middleware

const express = require('express');
const app = express();

// Se ejecuta en todas las peticiones
app.use(middleware);

// Se ejecuta solo en rutas que empiecen con /api
app.use('/api', middleware);

// Se ejecuta solo en rutas GET
app.get('*', middleware);
// 2. Router-level middleware

const express = require('express');
const router = express.Router();

// Middleware solo para este router
router.use(middleware);

// Se aplica a todas las rutas del router
router.get('/productos', handler);
// 3. Error-handling middleware

// Debe tener 4 parámetros (err, req, res, next)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Algo salió mal!');
});
// 4. Built-in middleware

// Express incluye algunos middleware built-in
app.use(express.json());      // Parsear JSON
app.use(express.urlencoded()); // Parsear datos de formularios
app.use(express.static('public')); // Servir archivos estáticos
// 5. Third-party middleware

const cors = require('cors');
const helmet = require('helmet');

app.use(cors());     // Habilitar CORS
app.use(helmet());   // Seguridad básica