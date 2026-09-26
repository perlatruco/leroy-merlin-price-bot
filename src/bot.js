const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const LeroyMerlinClient = require('./leroyMerlinClient');

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const client = new LeroyMerlinClient();

if (!token) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN no está definido en .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

function formatProductResponse(product) {
  const lines = [];

  lines.push(`*${product.title || 'Producto'}*`);
  lines.push('');

  if (product.price) {
    lines.push(`💰 Precio general: *${product.price}*`);
    lines.push('');
  }

  if (product.storePrices && product.storePrices.length > 0) {
    lines.push('🏪 *Precios por tienda:*');
    const sortedPrices = product.storePrices.sort((a, b) => a.price - b.price);
    sortedPrices.forEach((entry, index) => {
      const icon = index === 0 ? '✅' : '  ';
      lines.push(`${icon} ${entry.label}: *${entry.price.toFixed(2).replace('.', ',')} €*`);
    });
    lines.push('');
    const cheapest = sortedPrices[0];
    lines.push(`🎯 Mejor precio: *${cheapest.label} - ${cheapest.price.toFixed(2).replace('.', ',')} €*`);
    lines.push('');
  }

  if (product.url) {
    lines.push(`🔗 [Ver producto en Leroy Merlin](${product.url})`);
  }

  return lines.join('\n');
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const intro = [
    '🏠 *Leroy Merlin Price Bot*',
    '',
    'Hola 👋 Soy tu bot de precios de Leroy Merlin España.',
    '',
    'Escribe el nombre de un producto, por ejemplo:',
    '• taladro',
    '• pintura blanca',
    '• sierra circular',
    '• bombilla LED',
    '',
    'Y te buscaré el mejor precio disponible en las tiendas.'
  ].join('\n');

  bot.sendMessage(chatId, intro, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const help = [
    '📖 *Comandos disponibles:*',
    '',
    '/start - Inicia el bot',
    '/help - Muestra esta ayuda',
    '',
    '🔍 *Cómo buscar:*',
    'Solo escribe el nombre del producto que buscas.',
    '',
    '⚠️ *Notas:*',
    '• Los precios se actualizan en tiempo real',
    '• Si no encuentra precios por tienda, mostrará el precio general',
    '• Espera unos segundos para obtener resultados'
  ].join('\n');

  bot.sendMessage(chatId, help, { parse_mode: 'Markdown' });
});

bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const query = msg.text.trim();

  if (!query || query.length < 2) {
    bot.sendMessage(chatId, '❌ Por favor, escribe un nombre de producto más largo.');
    return;
  }

  const loadingMsg = await bot.sendMessage(chatId, '🔍 Buscando en Leroy Merlin España…');

  try {
    const searchResults = await client.searchProducts(query);

    if (!searchResults.length) {
      bot.editMessageText(
        '❌ No encontré resultados para esa búsqueda.\n\nPrueba con:',
        { chat_id: chatId, message_id: loadingMsg.message_id }
      );
      return;
    }

    await bot.editMessageText(
      '📦 Cargando detalles del producto…',
      { chat_id: chatId, message_id: loadingMsg.message_id }
    );

    const product = await client.getProductDetails(searchResults[0].url);
    const response = formatProductResponse(product);

    bot.editMessageText(
      response,
      { chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error:', error.message);
    bot.editMessageText(
      '⚠️ Hubo un error al consultar Leroy Merlin.\n\nIntentalo de nuevo en unos segundos.',
      { chat_id: chatId, message_id: loadingMsg.message_id }
    );
  }
});

bot.on('polling_error', (error) => {
  console.error('Error de polling:', error);
});

console.log('✅ Bot de Telegram iniciado correctamente.');
console.log('📍 Esperando mensajes...');
