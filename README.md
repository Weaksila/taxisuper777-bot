# TAXISUPER777 Bot

Telegram bot for taxi/passenger matching between Yangiyer, Toshkent and Guliston.

## Features
- Driver and passenger flows
- Parcel requests
- Driver approval by admins
- Ratings and trip history
- Complaints to admins
- Health check for Render

## Local запуск
```bash
npm install
cp .env.example .env  # PORT нужен только локально
npm run dev
```

## Deploy to Render
1. Push this project to GitHub.
2. Create a new **Web Service** in Render.
3. Connect the repository.
4. Render will read `render.yaml`, or manually set:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
5. Add environment variables:
   - `TELEGRAM_BOT_TOKEN`
   - `ADMIN_IDS`

## Important
Current data storage is in-memory. After restart/deploy, drivers, orders, complaints and history are reset. For production, connect PostgreSQL or another database.


Render usually sets `PORT` automatically, so you normally do not need to add it manually in Render.
