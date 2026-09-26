# Leroy Merlin Price Bot

Bot de Telegram para buscar productos de Leroy Merlin España y mostrar el precio más relevante disponible.

## Requisitos

- Node.js 18+
- Token de Telegram generado por @BotFather

## Instalación

```bash
npm install
```

## Configuración

Copia `.env.example` a `.env` y rellena tu token:

```bash
cp .env.example .env
```

Contenido recomendado:

```env
TELEGRAM_BOT_TOKEN=tu_token_de_telegram
```

## Ejecución

```bash
npm start
```

## Uso

En Telegram:

- `/start`
- `taladro`
- `pintura blanca`
- `sierra circular`

El bot buscará productos en Leroy Merlin España y devolverá el primero con precio detectable.

## Nota importante

Leroy Merlin España no publica una API pública oficial para precios por tienda. Este bot usa scraping del sitio web y puede requerir ajustes si cambian la estructura HTML.
