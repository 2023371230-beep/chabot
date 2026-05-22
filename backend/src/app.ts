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
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorMiddleware);
