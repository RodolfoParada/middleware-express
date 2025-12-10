// app-extendida-middleware.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const Joi = require('joi'); // Necesitas instalar 'joi'

// --- 1. CONFIGURACIÓN INICIAL ---
const app = express();

// Base de datos simulada y otros datos (se mantienen igual)
let usuarios = [/* ... */];
let productos = [/* ... */];

// --- 2. DATOS DE I18N (Internacionalización) ---
const i18n_messages = {
  es: {
    'auth_required': 'Token de autenticación requerido',
    'invalid_token': 'Token inválido',
    'unauthorized_user': 'Usuario no autenticado',
    'insufficient_permissions': 'Permisos insuficientes',
    'missing_fields': 'Campos requeridos faltantes',
    'invalid_data': 'Datos de petición inválidos',
    'json_parse_error': 'JSON inválido en el body de la petición',
    'internal_server_error': 'Error interno del servidor',
    'rate_limit_exceeded': 'Límite de peticiones excedido, intente en %s segundos',
    'route_not_found': 'Ruta no encontrada',
    'invalid_credentials': 'Credenciales inválidas',
    'user_created': 'Usuario creado exitosamente',
    'product_created': 'Producto creado exitosamente'
  },
  en: {
    'auth_required': 'Authentication token required',
    'invalid_token': 'Invalid token',
    'unauthorized_user': 'User not authenticated',
    'insufficient_permissions': 'Insufficient permissions',
    'missing_fields': 'Required fields are missing',
    'invalid_data': 'Invalid request data',
    'json_parse_error': 'Invalid JSON in the request body',
    'internal_server_error': 'Internal server error',
    'rate_limit_exceeded': 'Rate limit exceeded, try again in %s seconds',
    'route_not_found': 'Route not found',
    'invalid_credentials': 'Invalid credentials',
    'user_created': 'User successfully created',
    'product_created': 'Product successfully created'
  }
};

// --- 3. MIDDLEWARE DE TERCEROS ---
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- 4. MIDDLEWARE PERSONALIZADO: I18N (Internacionalización) ---
app.use((req, res, next) => {
  const lang = req.headers['accept-language']?.split(',')[0].trim().toLowerCase() || 'es';
  req.lang = i18n_messages[lang] ? lang : 'es';
  
  // Función helper para obtener el mensaje traducido
  res.locals.i18n = (key, ...replacements) => {
    let message = i18n_messages[req.lang][key] || i18n_messages['es'][key];
    replacements.forEach(rep => {
      message = message.replace('%s', rep); // Reemplazo simple
    });
    return message;
  };
  next();
});

// --- 5. MIDDLEWARE PERSONALIZADO: Logger Detallado y Timestamp ---
// (Se mantienen igual, pero el timestamp se usa junto a i18n)
app.use((req, res, next) => {
  const start = Date.now();
  res.locals.timestamp = new Date().toISOString();
  console.log(`[${res.locals.timestamp}] ${req.method} ${req.url} - IP: ${req.ip} - Lang: ${req.lang}`);
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// --- 6. MIDDLEWARE PERSONALIZADO: RATE LIMITING (Control de Tasa) ---
// Almacenamiento simple en memoria (usar Redis en producción)
const rateLimitStore = {};
const RATE_LIMIT_PERIOD = 60; // 60 segundos (ventana)
const RATE_LIMIT_COUNT = 5;  // 5 peticiones

function rateLimit(config = { max: RATE_LIMIT_COUNT, window: RATE_LIMIT_PERIOD }) {
  return (req, res, next) => {
    const ip = req.ip;
    const key = `${req.method}:${req.url.split('?')[0]}:${ip}`;
    const now = Date.now();
    
    if (!rateLimitStore[key] || rateLimitStore[key].resetTime < now) {
      // Inicializar o resetear
      rateLimitStore[key] = { count: 1, resetTime: now + (config.window * 1000) };
    } else {
      rateLimitStore[key].count++;
    }

    const { count, resetTime } = rateLimitStore[key];

    if (count > config.max) {
      const remainingSeconds = Math.ceil((resetTime - now) / 1000);
      res.set('Retry-After', remainingSeconds);
      res.set('X-RateLimit-Limit', config.max);
      res.set('X-RateLimit-Remaining', 0);

      return res.status(429).json({
        error: res.locals.i18n('rate_limit_exceeded', remainingSeconds),
        timestamp: res.locals.timestamp
      });
    }

    const remaining = config.max - count;
    res.set('X-RateLimit-Limit', config.max);
    res.set('X-RateLimit-Remaining', remaining);
    next();
  };
}

// --- 7. MIDDLEWARE PERSONALIZADO: CACHÉ (Solo para GET) ---
// Almacenamiento en memoria para caché (usar Redis en producción)
const cacheStore = new Map();
const CACHE_TTL = 30000; // 30 segundos (Tiempo de vida)

function cacheResponse(req, res, next) {
  if (req.method !== 'GET') {
    return next();
  }

  const key = req.originalUrl;
  const cachedData = cacheStore.get(key);

  if (cachedData && cachedData.expiry > Date.now()) {
    console.log(`[CACHE HIT] ${key}`);
    res.set('X-Cache-Status', 'HIT');
    return res.json(cachedData.response); // Retorna la respuesta cacheada
  }

  console.log(`[CACHE MISS] ${key}`);
  res.set('X-Cache-Status', 'MISS');

  // Sobrescribe la función 'send' de la respuesta para interceptar y guardar
  const originalJson = res.json;
  res.json = function(body) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      cacheStore.set(key, {
        response: body,
        expiry: Date.now() + CACHE_TTL
      });
      res.set('Cache-Control', `public, max-age=${CACHE_TTL / 1000}`);
    }
    // Llama al json original para enviar la respuesta real
    originalJson.call(res, body);
  };
  
  next();
}

// Función para invalidar la caché (Importante para POST/PUT/DELETE)
function invalidateCache(req, res, next) {
    cacheStore.clear(); // Limpia toda la caché (Simple)
    console.log('[CACHE INVALIDATED] Cache borrada por petición de escritura.');
    next();
}

// --- 8. MIDDLEWARE PERSONALIZADO: VALIDACIÓN CON JOI (Esquemas) ---
function validateSchema(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const details = error.details.map(d => ({
        key: d.context.key,
        message: d.message.replace(/['"]/g, ''),
        type: d.type
      }));

      return res.status(400).json({
        error: res.locals.i18n('invalid_data'),
        details: details,
        timestamp: res.locals.timestamp
      });
    }
    next();
  };
}

// --- 9. ESQUEMAS JOI ---
const usuarioSchema = Joi.object({
  nombre: Joi.string().min(3).required(),
  email: Joi.string().email().required(),
  activo: Joi.boolean().optional()
});

const productoSchema = Joi.object({
  nombre: Joi.string().min(3).required(),
  precio: Joi.number().greater(0).required(),
  categoria: Joi.string().required(),
  stock: Joi.number().integer().min(0).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});


// --- MIDDLEWARES DE AUTH/PERMISOS (Se mantienen igual) ---
function validarAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: res.locals.i18n('auth_required'), timestamp: res.locals.timestamp });
  }
  const token = authHeader.substring(7);
  if (token !== 'mi-token-secreto') {
    return res.status(401).json({ error: res.locals.i18n('invalid_token'), timestamp: res.locals.timestamp });
  }
  req.usuario = { id: 1, nombre: 'Admin', role: 'admin' };
  next();
}

function validarPermisos(permisoRequerido) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: res.locals.i18n('unauthorized_user'), timestamp: res.locals.timestamp });
    }
    const permisosUsuario = { 1: ['leer', 'escribir', 'admin'] };
    const permisos = permisosUsuario[req.usuario.id] || [];
    if (!permisos.includes(permisoRequerido)) {
      return res.status(403).json({ error: res.locals.i18n('insufficient_permissions'), timestamp: res.locals.timestamp });
    }
    next();
  };
}

// --- 10. RUTAS (Aplicando nuevos Middlewares) ---

// Rutas públicas
app.get('/', rateLimit({ max: 10, window: 15 }), (req, res) => {
  res.json({ /* ... info general ... */ });
});

app.post('/auth/login', rateLimit({ max: 3, window: 60 }), validateSchema(loginSchema), (req, res) => {
  const { email, password } = req.body;
  if (email === 'admin@example.com' && password === 'admin123') {
    res.json({
      token: 'mi-token-secreto',
      usuario: { id: 1, nombre: 'Admin', role: 'admin' },
      timestamp: res.locals.timestamp
    });
  } else {
    res.status(401).json({ error: res.locals.i18n('invalid_credentials'), timestamp: res.locals.timestamp });
  }
});

// Rutas protegidas - Usuarios (Aplicando Caché, Rate Limiting y Validación Joi)
app.get('/api/usuarios', rateLimit(), validarAuth, cacheResponse, (req, res) => {
  res.json({ usuarios, total: usuarios.length, timestamp: res.locals.timestamp });
});

app.post('/api/usuarios', validarAuth, validarPermisos('escribir'), invalidateCache, validateSchema(usuarioSchema), (req, res) => {
  const nuevoUsuario = {
    id: usuarios.length + 1,
    nombre: req.body.nombre,
    email: req.body.email,
    activo: req.body.activo !== undefined ? req.body.activo : true,
    fechaCreacion: res.locals.timestamp
  };
  usuarios.push(nuevoUsuario);
  res.status(201).json({ mensaje: res.locals.i18n('user_created'), usuario: nuevoUsuario, timestamp: res.locals.timestamp });
});

// Rutas protegidas - Productos (Aplicando Caché, Rate Limiting y Validación Joi)
app.get('/api/productos', rateLimit(), validarAuth, cacheResponse, (req, res) => {
  // ... lógica de filtrado de productos (se mantiene igual) ...
  let resultados = [...productos];
  res.json({ productos: resultados, total: resultados.length, filtros: req.query, timestamp: res.locals.timestamp });
});

app.post('/api/productos', validarAuth, validarPermisos('escribir'), invalidateCache, validateSchema(productoSchema), (req, res) => {
  const nuevoProducto = {
    id: productos.length + 1,
    nombre: req.body.nombre,
    precio: parseFloat(req.body.precio),
    categoria: req.body.categoria,
    stock: req.body.stock || 0,
    fechaCreacion: res.locals.timestamp
  };
  productos.push(nuevoProducto);
  res.status(201).json({ mensaje: res.locals.i18n('product_created'), producto: nuevoProducto, timestamp: res.locals.timestamp });
});


// --- 11. MIDDLEWARE DE MANEJO DE ERRORES (Actualizado con I18N) ---
app.use((error, req, res, next) => {
  console.error('Error:', error);
  // Errores de JSON inválido
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: res.locals.i18n('json_parse_error'), timestamp: res.locals.timestamp });
  }
  // Error genérico
  res.status(500).json({
    error: res.locals.i18n('internal_server_error'),
    mensaje: process.env.NODE_ENV === 'development' ? error.message : res.locals.i18n('internal_server_error'),
    timestamp: res.locals.timestamp
  });
});

// --- 12. MIDDLEWARE 404 (Actualizado con I18N) ---
app.use((req, res) => {
  res.status(404).json({
    error: res.locals.i18n('route_not_found'),
    timestamp: res.locals.timestamp,
    sugerencias: [ /* ... sugerencias ... */ ]
  });
});

// --- 13. INICIAR SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API Extendida en http://localhost:${PORT}`);
});

// Ejercicio: Extiende el sistema de middleware agregando: middleware para rate limiting personalizado por ruta,
//  middleware de caché para respuestas GET, middleware de internacionalización (i18n) para mensajes de error,
//   y middleware de validación usando esquemas con una librería como Joi.