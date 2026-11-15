import 'dotenv/config';
import { buildApp } from './app';

const port = Number(process.env.PORT || 3002);
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

buildApp().listen({ host: '127.0.0.1', port }).catch(error => {
  console.error(error);
  process.exit(1);
});
