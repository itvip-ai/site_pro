import 'dotenv/config';
import { initSchema, db } from '../src/config/db.js';
import { User } from '../src/models/user.js';
import { hashPassword } from '../src/utils/helpers.js';

initSchema();

const login = process.env.ADMIN_LOGIN || 'admin';
const password = process.env.ADMIN_PASSWORD || 'qgroup2024';

if (User.exists(login)) {
  console.log(`✓ Администратор «${login}» уже существует — пропуск.`);
} else {
  const hash = await hashPassword(password);
  User.create({ login, password_hash: hash, role: 'admin' }, null);
  console.log('✓ Создан администратор по умолчанию:');
  console.log(`    логин:  ${login}`);
  console.log(`    пароль: ${password}`);
  console.log('  ⚠️  Смените пароль после первого входа!');
}

db.close();
