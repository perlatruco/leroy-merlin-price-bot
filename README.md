const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const LeroyMerlinClient = require('./leroyMerlinClient');

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const client = new LeroyMerlinClient();

if (!token) {
  console.error('Falta TELEGRAM_BOT_TOKEN en el archivo .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

function formatProductResponse(product) {
  const parts = [];
  parts.push(`*${product.title}*`);

  if (product.price) {
    parts.push(`Precio general: ${product.price}`);
  }

  if (product.storePrices && product.storePrices.length > 0) {
    parts.push('Precios por tienda:');
    product.storePrices.forEach((entry, index) => {
      parts.push(`${index + 1}. ${entry.label}: ${entry.price.toFixed(2).replace('.', ',')} €`);
    });
  } else {
    parts.push('No pude detectar precios por tienda en esta página, pero aquí tienes el enlace del producto.');
  }

  if (product.url) {
    parts.push(`\nEnlace: ${product.url}`);
  }

  return parts.join('\n');
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const intro = [
    'Hola 👋',
    'Soy el bot de precios de Leroy Merlin España.',
    'Solo escribe el nombre de un producto, por ejemplo:',
    '• taladro',
    '• pintura blanca',
    '• sierra circular',
    'Y te buscaré el mejor resultado disponible.'
  ].join('\n');

  bot.sendMessage(chatId, intro);
});

bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) {
    return;
  }

  const chatId = msg.chat.id;
  const query = msg.text.trim();

  if (!query) {
    return;
  }

  try {
    await bot.sendMessage(chatId, `Buscando “${query}” en Leroy Merlin…`);

    const searchResults = await client.searchProducts(query);

    if (!searchResults.length) {
      await bot.sendMessage(chatId, 'No encontré resultados para esa búsqueda. Prueba con un nombre más específico.');
      return;
    }

    const result = await client.getProductDetails(searchResults[0].url);
    const response = formatProductResponse(result);

    await bot.sendMessage(chatId, response, {
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error(error);
    await bot.sendMessage(chatId, 'Hubo un error al consultar Leroy Merlin. Inténtalo de nuevo en unos segundos.');
  }
});

console.log('Bot de Telegram iniciado.');
