// Task 2: Middleware Personalizado (10 minutos)
// Crear middleware personalizado para funcionalidades comunes.

// Middleware de Logging
// middleware/logger.js
function logger(req, res, next) {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const ip = req.ip || req.connection.remoteAddress;

  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);

  // Medir tiempo de respuesta
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] ${method} ${url} - ${res.statusCode} - ${duration}ms`);
  });

  next();
}

module.exports = logger;
// Uso en la aplicación
const express = require('express');
const logger = require('./middleware/logger');

const app = express();
// app.use(logger); // Logging para todas las rutas
// Middleware de Autenticación Básica
// middleware/auth.js

// Lista de usuarios (en producción vendría de una BD)
const users = {
  'admin': { password: 'admin123', role: 'admin' },
  'user': { password: 'user123', role: 'user' }
};

// Middleware de autenticación básica
function basicAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="API"');
    return res.status(401).json({ error: 'Autenticación requerida' });
  }

  // Decodificar credenciales
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  // Verificar credenciales
  const user = users[username];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  // Agregar información del usuario al request
  req.user = {
    username,
    role: user.role
  };

  next();
}

// Middleware de autorización por roles
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }

    next();
  };
}

module.exports = { basicAuth, requireRole };
// Uso en rutas
const express = require('express');
const { basicAuth, requireRole } = require('./middleware/auth');

const app = express();

// Rutas públicas (sin autenticación)
app.get('/public', (req, res) => {
  res.json({ message: 'Esta ruta es pública' });
});

// Rutas que requieren autenticación
app.get('/profile', basicAuth, (req, res) => {
  res.json({
    message: `Hola ${req.user.username}!`,
    role: req.user.role
  });
});

// Rutas que requieren rol específico
app.get('/admin', basicAuth, requireRole('admin'), (req, res) => {
  res.json({ message: 'Solo administradores pueden ver esto' });
});
// Middleware de Validación
// middleware/validation.js

// Middleware para validar que ciertos campos estén presentes
function validateFields(requiredFields) {
  return (req, res, next) => {
    const missingFields = [];

    for (const field of requiredFields) {
      if (!req.body[field]) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Campos requeridos faltantes',
        missing: missingFields
      });
    }

    next();
  };
}

// Middleware para validar tipos de datos
function validateTypes(typeRules) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, expectedType] of Object.entries(typeRules)) {
      const value = req.body[field];

      if (value !== undefined) {
        if (expectedType === 'string' && typeof value !== 'string') {
          errors.push(`${field} debe ser texto`);
        } else if (expectedType === 'number' && typeof value !== 'number') {
          errors.push(`${field} debe ser número`);
        } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
          errors.push(`${field} debe ser boolean`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Errores de validación',
        details: errors
      });
    }

    next();
  };
}

// Middleware para sanitizar datos
function sanitizeInput(fieldsToTrim) {
  return (req, res, next) => {
    if (req.body) {
      for (const field of fieldsToTrim) {
        if (typeof req.body[field] === 'string') {
          req.body[field] = req.body[field].trim();
        }
      }
    }

    next();
  };
}

module.exports = { validateFields, validateTypes, sanitizeInput };
// Uso en rutas
const express = require('express');
const { validateFields, validateTypes, sanitizeInput } = require('./middleware/validation');

const app = express();
app.use(express.json());

// Crear usuario con validación
app.post('/usuarios',
  validateFields(['nombre', 'email']),  // Campos requeridos
  validateTypes({                       // Tipos de datos
    nombre: 'string',
    email: 'string',
    edad: 'number'
  }),
  sanitizeInput(['nombre', 'email']),   // Limpiar espacios
  (req, res) => {
    // Procesar usuario válido
    res.json({ message: 'Usuario creado', usuario: req.body });
  }
);