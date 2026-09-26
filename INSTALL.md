# 🚀 Guía de Instalación - Leroy Merlin Price Bot

## Requisitos Previos

- **Node.js 18+** (descarga desde [nodejs.org](https://nodejs.org))
- **npm** (incluido con Node.js)
- **Token de Telegram Bot** (crea uno con [@BotFather](https://t.me/BotFather))

## Paso 1: Clonar el Repositorio

```bash
git clone https://github.com/perlatruco/leroy-merlin-price-bot.git
cd leroy-merlin-price-bot
```

## Paso 2: Instalar Dependencias

```bash
npm install
```

## Paso 3: Crear Token de Telegram

1. Abre Telegram y busca **@BotFather**
2. Escribe `/start` y luego `/newbot`
3. Elige un nombre para tu bot (ej: "mi-bot-leroy")
4. Elige un username único (ej: "mi_bot_leroy_bot")
5. Copia el token que te proporciona (será algo como: `123456789:ABCdefGHIjklmnoPQRstuvWXYZ`)

## Paso 4: Configurar Variables de Entorno

```bash
cp .env.example .env
```

Abre el archivo `.env` y reemplaza:

```env
TELEGRAM_BOT_TOKEN=tu_token_aqui
```

## Paso 5: Ejecutar el Bot

```bash
npm start
```

Deberías ver un mensaje similar a:

```
✅ Bot de Telegram iniciado correctamente.
📍 Esperando mensajes...
```

## Paso 6: Probar el Bot

1. Abre tu bot en Telegram (busca el username que creaste)
2. Escribe `/start`
3. Escribe un producto, por ejemplo: `taladro`
4. El bot buscará y te mostrará los precios

## 🚀 Ejecución en Producción

Para que el bot se ejecute continuamente en un servidor:

### Opción A: Usar PM2 (Recomendado)

```bash
npm install -g pm2
pm2 start src/index.js --name "leroy-merlin-bot"
pm2 save
pm2 startup
```

### Opción B: Usar Screen

```bash
screen -S leroy-bot
npm start
# Presiona Ctrl+A y luego D para desconectarte sin cerrar el bot
```

### Opción C: Usar Systemd (Linux)

Crea `/etc/systemd/system/leroy-bot.service`:

```ini
[Unit]
Description=Leroy Merlin Price Bot
After=network.target

[Service]
Type=simple
User=tu_usuario
WorkingDirectory=/ruta/al/proyecto
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Luego:

```bash
sudo systemctl enable leroy-bot
sudo systemctl start leroy-bot
sudo systemctl status leroy-bot
```

## 🐛 Solución de Problemas

### El bot no inicia
- ❌ Verifica que el token en `.env` sea correcto
- ❌ Comprueba que tienes Node.js 18+ instalado: `node --version`
- ❌ Asegúrate de tener internet y que no hay bloques de IP

### No encuentra productos
- ❌ El sitio de Leroy Merlin puede haber cambiado su estructura
- ❌ Intenta con nombres de productos más simples
- ❌ Revisa los logs para más detalles

### Error de timeout
- ❌ La conexión a Leroy Merlin es lenta
- ❌ Intenta de nuevo en unos segundos

## 📝 Logs y Debug

Para ver logs más detallados:

```bash
NODE_DEBUG=* npm start
```

## 📞 Soporte

Si tienes problemas, abre un issue en el repositorio de GitHub.
