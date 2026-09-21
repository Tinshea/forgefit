import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { config } from './config.js';
import { pool } from './db.js';
import { HttpError } from './lib/http.js';
import { exercisesRouter } from './routes/exercises.js';
import { workoutsRouter } from './routes/workouts.js';
import { sportsRouter } from './routes/sports.js';
import { weatherRouter } from './routes/weather.js';
import { appsRouter } from './routes/apps.js';
import { placesRouter } from './routes/places.js';
import { notesRouter } from './routes/notes.js';
import { tilesRouter } from './routes/tiles.js';
import { healthRouter } from './routes/health.js';
import { statsRouter } from './routes/stats.js';
import { programsRouter } from './routes/programs.js';
import { nutritionRouter } from './routes/nutrition.js';
import { profileRouter } from './routes/profile.js';
import { calendarRouter } from './routes/calendar.js';
import { exportRouter } from './routes/export.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', true);
  app.use(helmet());
  app.use(compression());

  app.use(cors({
    origin(origin, callback) {
      // Requêtes sans Origin : outils serveur-à-serveur, webhooks, curl.
      if (!origin) return callback(null, true);
      if (config.corsOrigins.includes(origin)) return callback(null, true);
      // Un refus CORS est un refus de configuration, pas un plantage :
      // sans statut explicite il remonterait en 500 et enverrait
      // chercher le bug au mauvais endroit.
      return callback(new HttpError(
        403,
        `Origine non autorisée : ${origin}. Ajoute-la à CORS_ORIGINS.`,
        { allowed: config.corsOrigins },
      ));
    },
    allowedHeaders: ['Content-Type', 'X-User-Id', 'X-ForgeFit-Signature', 'X-ForgeFit-Source'],
  }));

  // Le corps brut est conserve : la signature HMAC porte sur les octets
  // recus, pas sur un JSON re-serialise (ordre des cles, espaces...).
  app.use(express.json({
    limit: '25mb', // un export Apple Health complet est volumineux
    verify: (req, _res, buf) => { req.rawBody = buf; },
  }));

  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', database: 'up', env: config.env });
    } catch (err) {
      res.status(503).json({ status: 'degraded', database: 'down', error: err.message });
    }
  });

  app.use('/api/exercises', exercisesRouter);
  app.use('/api/workouts', workoutsRouter);
  app.use('/api/sports', sportsRouter);
  app.use('/api/weather', weatherRouter);
  app.use('/api/apps', appsRouter);
  app.use('/api/places', placesRouter);
  app.use('/api/notes', notesRouter);
  app.use('/api/tiles', tilesRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/programs', programsRouter);
  app.use('/api/nutrition', nutritionRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/calendar', calendarRouter);
  app.use('/api/export', exportRouter);
  // healthRouter porte /api/health-sync et /api/health/*
  app.use('/api', healthRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint inconnu', path: req.originalUrl });
  });

  // eslint-disable-next-line no-unused-vars -- Express identifie le
  // middleware d'erreur a son arite : le 4e parametre est obligatoire.
  app.use((err, req, res, next) => {
    const status = err instanceof HttpError ? err.status : (err.status ?? 500);
    if (status >= 500) console.error('[api]', err);
    res.status(status).json({
      error: err.message ?? 'Erreur interne',
      ...(err.details ? { details: err.details } : {}),
    });
  });

  return app;
}
