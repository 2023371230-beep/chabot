import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { corsOptions } from './config/cors';
import { errorMiddleware, notFoundHandler } from './shared/errors/error.middleware';
import apiRoutes from './routes';

export const app = express();

app.use(helmet());
app.use(cors(corsOptions));
// `verify` guarda el cuerpo TAL CUAL llego, antes de parsearlo.
// La firma X-Hub-Signature-256 de Meta se calcula sobre esos bytes exactos:
// re-serializar el JSON cambia espacios y orden de llaves, y la firma ya no
// coincide.
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    }
  })
);
app.use(morgan('dev'));

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorMiddleware);
