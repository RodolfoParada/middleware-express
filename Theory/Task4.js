// Task 4: Middleware de Seguridad y Optimización (4 minutos)
// Middleware para mejorar seguridad y rendimiento.

// Helmet para Seguridad
const express = require('express');
const helmet = require('helmet');

const app = express();

// Configuración básica de seguridad
app.use(helmet());

// O configuración personalizada
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
// Compresión Gzip
const express = require('express');
const compression = require('compression');

const app = express();

// Comprimir todas las respuestas
app.use(compression());

// Comprimir solo ciertos tipos de contenido
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));
// Rate Limiting
const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();

// Limitar peticiones por IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 peticiones por ventana
  message: 'Demasiadas peticiones desde esta IP',
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// Limitar específico para API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Demasiadas peticiones a la API'
});

app.use('/api/', apiLimiter);