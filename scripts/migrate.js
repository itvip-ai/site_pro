import 'dotenv/config';
import { initSchema, db } from '../src/config/db.js';

initSchema();
console.log('✓ Схема БД создана/актуализирована.');
db.close();
