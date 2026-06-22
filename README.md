# QGROUP — каталог оборудования

Веб-приложение: публичная витрина-каталог + закрытый доступ для партнёров + админ-панель
для ведения каталога. Стек: **Node.js + Express + EJS + SQLite** (легко мигрирует на
PostgreSQL/MySQL), изображения — **WebP** (sharp), импорт прайса из **Excel** с извлечением
встроенных фотографий.

> Это каталог-справочник, а не складская система: остатков, заказов, корзины и оплаты нет.

---

## Роли и доступ

| Уровень | Логин | Розн. цена | Партн. цена | Редактирование | Пользователи |
|---|---|---|---|---|---|
| Публичный посетитель | нет | ✅ | ❌ | ❌ | ❌ |
| Партнёр | да | ✅ | ✅ | ❌ | ❌ |
| Менеджер | да | ✅ | ✅ | ✅ | только партнёры |
| Админ | да | ✅ | ✅ | ✅ | менеджеры + партнёры |

**Безопасность партнёрской цены.** Поле `price_partner` физически вырезается на сервере
(единая точка — `serializeProduct()` в [src/models/product.js](src/models/product.js)) для
всех, кроме партнёра/менеджера/админа. В публичный HTML/ответ оно не попадает вообще —
не «прячется через CSS».

---

## Быстрый старт (локально)

Требуется **Node.js 20+** (проверено на 24). На Windows для `better-sqlite3`/`sharp`
используются готовые бинарники — компилятор не нужен.

```bash
npm install
cp .env.example .env          # Windows: copy .env.example .env
npm run migrate               # создать таблицы
npm run seed                  # создать админа по умолчанию
npm run dev                   # запуск с автоперезагрузкой (или npm start)
```

Открыть: <http://localhost:3000>

**Админ по умолчанию:** `admin` / `qgroup2024` (задаётся в `.env`).
⚠️ Смените пароль после первого входа (Админка → Пользователи → Сбросить пароль).

---

## Импорт прайса (разовый)

Прайс — `.xlsx`, где каждый лист = категория, а фотографии встроены в книгу и привязаны к
строкам. Скрипт сам определяет колонки по заголовкам (`Код`, `Наименование`, `Описание`,
`Цена за шт. (USD)`, `Цена для партнёров (USD)`), извлекает картинки по якорю строки,
конвертирует в WebP (+ превью) и складывает в `public/images/products`.

```bash
npm run import-price -- data/price.xlsx          # обычный импорт
node scripts/importPrice.js data/price.xlsx --dry-run    # пробный прогон без записи
node scripts/importPrice.js data/price.xlsx --no-images  # без обработки картинок
```

- **Идемпотентно по `code`:** повторный запуск обновляет товары, а не плодит дубли.
- Большой файл (десятки МБ, сотни картинок) — дайте Node больше памяти:
  ```bash
  node --max-old-space-size=4096 scripts/importPrice.js data/price.xlsx
  ```

---

## Структура проекта

```
src/
  config/db.js          подключение SQLite + схема (единственное место смены БД)
  models/               product.js (+ защита партн. цены), user.js, log.js
  controllers/          catalog.js, auth.js, adminProducts.js, adminUsers.js
  middleware/auth.js    сессия, роли, локали для шаблонов
  routes/               public.js (витрина+вход), admin.js (бэк-офис)
  utils/                images.js (sharp→WebP), helpers.js
  index.js              сборка приложения
views/                  EJS-шаблоны (витрина + админка + partials)
public/                 css/app.css, js/app.js, images/products/<webp>
scripts/                migrate.js, seed.js, importPrice.js
data/                   qgroup.db (SQLite, не в git)
```

---

## Перевод карточек на румынский (машинный)

Названия/описания товаров импортируются на русском. Поля `name_ro`/`description_ro`
заполняются машинным переводом (бесплатно, без ключа — публичный Google-эндпоинт):

```bash
npm run translate                 # перевести все пустые RO-поля (имена + описания)
node scripts/translate.js --field=desc      # только описания
node scripts/translate.js --limit=100       # частями
node scripts/translate.js --dry-run         # без записи в БД
```

- **Идемпотентно/возобновляемо:** заполняет только пустые RO-поля. Прервался (лимит/сеть) —
  запустите снова, продолжит с места остановки.
- Чистые артикулы (без кириллицы, напр. `28001`, `SmartLine020/4`) не переводятся — на
  румынском показывается оригинал (фолбэк).
- Качество — машинное; любую карточку можно поправить вручную в админке.
- `TRANSLATE_DELAY_MS` — пауза между запросами (по умолчанию 400 мс).

## Конструктор КП (коммерческие предложения)

Перенесён из Google Apps Script и встроен в сайт. Доступен по роли (ссылка «Конструктор КП»
в шапке) на странице-хабе `/kp`.

- **Билдеры:** общий (`/kp/general`), LED (`/kp/led`), партнёрский (`/kp/partner`) — каждый с
  мобильной версией `…/mobile`. Исходные HTML лежат в [kp-builders/](kp-builders/).
- **Доступ по ролям:** `admin` — все; `sales` (продавец) — общий, и LED при включённой
  галочке «Доступ к LED» в профиле; `partner` — только партнёрский; `manager` — без КП
  (ведёт каталог).
- **Мост вместо Google Apps Script:** клиентский [public/js/gas-shim.js](public/js/gas-shim.js)
  эмулирует `google.script.run` и вызывает REST API `POST /kp/api/<fn>`
  ([src/controllers/kp.js](src/controllers/kp.js)). Логика 1:1 с оригиналом.
- **Данные:** каталог КП берётся из общего каталога товаров (цена = розничная); карточки
  менеджеров (имя/телефон/отдел/цвет для подписи) — из учёток пользователей (заполняются в
  админке → Пользователи → Действия → контактные данные); сами КП хранятся в таблице `kps`.
- **PDF:** печать средствами браузера (Ctrl/Cmd+P → «Сохранить как PDF»).
- ⚠️ Исходник общего мобильного билдера (`kpmobile.txt`) был повреждён — пока для
  `/kp/general/mobile` отдаётся десктоп-версия. Положите чистую копию в `kp-builders/` как
  `general-mobile.html` и поправьте маппинг в `BUILDERS` (kp.js).

## Деплой на VPS (nginx + PM2 + HTTPS)

1. **Подготовка сервера**
   ```bash
   sudo apt update && sudo apt install -y nginx
   # Node 20+ через NodeSource или nvm
   git clone <repo> /var/www/qgroup && cd /var/www/qgroup
   npm ci --omit=dev
   cp .env.example .env      # отредактировать: SESSION_SECRET, ADMIN_*, NODE_ENV=production
   npm run migrate && npm run seed
   ```

2. **Запуск через PM2**
   ```bash
   sudo npm i -g pm2
   pm2 start src/index.js --name qgroup-catalog
   pm2 save && pm2 startup     # автозапуск после перезагрузки
   ```

3. **nginx как reverse-proxy + статика** (`/etc/nginx/sites-available/qgroup`)
   ```nginx
   server {
     listen 80;
     server_name catalog.example.com;

     # Статику (картинки, css, js) отдаёт nginx напрямую — быстро и без Node.
     location /images/ { alias /var/www/qgroup/public/images/; expires 7d; access_log off; }
     location /css/    { alias /var/www/qgroup/public/css/;    expires 7d; }
     location /js/     { alias /var/www/qgroup/public/js/;     expires 7d; }

     location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;   # нужно для secure-cookie
     }
   }
   ```
   ```bash
   sudo ln -s /etc/nginx/sites-available/qgroup /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

4. **HTTPS (Let's Encrypt)**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d catalog.example.com
   ```
   Приложение использует `trust proxy` и `cookie.secure='auto'`, поэтому защищённые
   cookie включатся автоматически после перехода на HTTPS.

### Вариант с Docker

```dockerfile
FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run migrate && npm run seed
EXPOSE 3000
CMD ["node", "src/index.js"]
```
Том для сохранности данных и картинок: `-v qgroup_data:/app/data -v qgroup_img:/app/public/images`.

---

## Смена SQLite на PostgreSQL / MySQL

Вся работа с БД изолирована в [src/config/db.js](src/config/db.js) (подключение + схема) и
моделях [src/models/](src/models/). Порядок миграции:

1. Поставить драйвер/ORM (`pg` или Knex/Prisma) и поднять пустую базу на VPS.
2. Переписать `db` и `initSchema()` в `db.js` под новый драйвер; SQL в схеме почти
   переносимый (заменить `AUTOINCREMENT` на `SERIAL`/`AUTO_INCREMENT`, `datetime('now')`
   на `now()`/`CURRENT_TIMESTAMP`).
3. В моделях запросы используют именованные плейсхолдеры (`@param`) и обычный SQL —
   адаптируются под выбранный драйвер.
4. Перенести данные: повторно запустить `import-price` на новой БД либо выгрузить/залить
   таблицы.

---

## Безопасность и заметки

- Пароли — bcrypt; сессии — httpOnly + SameSite=Lax + secure(auto за HTTPS).
- На `/login` стоит rate-limit (20 попыток / 15 мин на IP).
- Удаление товара — **мягкое** (`is_active = 0`), данные не теряются.
- Описания экранируются перед выводом (защита от XSS).
- Языки интерфейса — русский (по умолчанию) и румынский, переключатель RU/RO в шапке и
  админке. Выбор хранится в cookie `lang`. Словари — в [src/config/i18n.js](src/config/i18n.js)
  (ключи `t('...')`). Переведён интерфейс; данные товаров (названия/описания) остаются как в
  прайсе. Фирменные цвета и логотип QGROUP — в [public/css/app.css](public/css/app.css) и
  `public/images/logo.png`.
- Сессии хранятся в памяти процесса (MemoryStore) — для ~50 онлайн-посетителей достаточно;
  при кластеризации/множестве воркеров подключить стор (например, `connect-sqlite3`).
