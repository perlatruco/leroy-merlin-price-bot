const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class LeroyMerlinClient {
  constructor(baseUrl = 'https://www.leroymerlin.es') {
    this.baseUrl = baseUrl;
    this.debugDir = path.join(__dirname, '../debug');
    this.ensureDebugDir();
  }

  ensureDebugDir() {
    if (!fs.existsSync(this.debugDir)) {
      fs.mkdirSync(this.debugDir, { recursive: true });
    }
  }

  saveDebugFile(filename, content) {
    const filepath = path.join(this.debugDir, filename);
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`📝 Archivo de debug guardado: ${filepath}`);
  }

  async getHtml(url) {
    console.log(`🌐 Descargando: ${url}`);
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 40000
      });

      console.log(`✅ Descarga exitosa. Status: ${response.status}, Tamaño: ${response.data.length} bytes`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error al descargar: ${error.message}`);
      throw error;
    }
  }

  normalizeText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/\u00a0/g, ' ')
      .trim();
  }

  extractAbsoluteUrl(url) {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) return `${this.baseUrl}${url}`;
    return `${this.baseUrl}/${url}`;
  }

  buildSearchUrl(query) {
    return `${this.baseUrl}/search/?q=${encodeURIComponent(query)}`;
  }

  extractTextFromSelectors($, selectors) {
    for (const selector of selectors) {
      const found = $(selector).first().text();
      if (found && this.normalizeText(found)) {
        return this.normalizeText(found);
      }
    }
    return '';
  }

  parsePriceNumber(value) {
    if (!value) return null;
    const cleaned = String(value).replace(/[^0-9,\.]/g, '').replace('.', '').replace(',', '.');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  sanitizeProductTitle(value) {
    return this.normalizeText(value).replace(/\s*[-|]?(precio|en stock|comprar).*$/i, '') || 'Producto Leroy Merlin';
  }

  async searchProducts(query) {
    const url = this.buildSearchUrl(query);
    console.log(`\n🔍 === BUSCANDO: "${query}" ===`);
    
    try {
      const html = await this.getHtml(url);
      
      // Guardar HTML completo para inspección
      this.saveDebugFile(`search_${query}_full.html`, html);
      
      const $ = cheerio.load(html);

      // Debug: Analizar estructura de la página
      console.log(`\n📊 Análisis de la página de búsqueda:`);
      console.log(`   - Total de links: $('a').length = ${$('a').length}`);
      console.log(`   - Links con href: $('a[href]').length = ${$('a[href]').length}`);

      const products = [];
      const seen = new Set();

      // Detectar diferentes tipos de selectores de productos
      const productSelectors = [
        { name: 'a[href*="/fp/"]', regex: /\/fp\//i },
        { name: 'a[href*="/ficha-producto/"]', regex: /\/ficha-producto\//i },
        { name: 'a[href*="/product"]', regex: /\/product/i },
        { name: 'a[href*="/p/"]', regex: /\/p\//i },
        { name: 'article a', regex: null },
        { name: '[data-testid*="product"] a', regex: null }
      ];

      for (const selector of productSelectors) {
        const elements = $(selector.name);
        if (elements.length > 0) {
          console.log(`   ✓ Selector "${selector.name}": ${elements.length} elementos encontrados`);
        }
      }

      // Procesar enlaces
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        const text = this.normalizeText($(el).text());

        if (!href || !text) return;

        const isProductLink = /\/fp\//i.test(href) || /\/ficha-producto\//i.test(href) || /\/product/i.test(href) || /\/p\//i.test(href);
        
        if (isProductLink) {
          const urlAbsolute = this.extractAbsoluteUrl(href);
          if (!seen.has(urlAbsolute)) {
            seen.add(urlAbsolute);
            products.push({
              title: this.sanitizeProductTitle(text),
              url: urlAbsolute
            });
          }
        }
      });

      const unique = products.filter((p) => p.title && p.title.length > 2);
      
      console.log(`\n📦 Resultados encontrados:`);
      console.log(`   - Productos detectados: ${products.length}`);
      console.log(`   - Productos únicos (título > 2 chars): ${unique.length}`);
      
      if (unique.length > 0) {
        console.log(`\n   Primeros 3 resultados:`);
        unique.slice(0, 3).forEach((p, i) => {
          console.log(`   ${i + 1}. "${p.title}"`);
          console.log(`      ${p.url}`);
        });
      }

      // Guardar resultados de búsqueda
      this.saveDebugFile(`search_${query}_results.json`, JSON.stringify(unique, null, 2));

      return unique.slice(0, 5);
    } catch (error) {
      console.error(`❌ Error en searchProducts: ${error.message}`);
      throw error;
    }
  }

  extractJsonLdObjects($) {
    console.log(`\n🔎 Buscando JSON-LD...`);
    const objects = [];
    const jsonLdElements = $('script[type="application/ld+json"]');
    
    console.log(`   - Elementos JSON-LD encontrados: ${jsonLdElements.length}`);
    
    jsonLdElements.each((_, el) => {
      const raw = $(el).contents().text();
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        objects.push(parsed);
        console.log(`   ✓ JSON-LD válido parseado (${parsed['@type'] || 'unknown'})`);
      } catch (e) {
        console.log(`   ✗ JSON-LD malformado: ${e.message.substring(0, 50)}`);
      }
    });

    const flatten = (value) => {
      if (!value || typeof value !== 'object') return;
      if (value['@type'] === 'Product' || value['@type'] === 'Offer') {
        objects.push(value);
      }
      Object.values(value).forEach(flatten);
    };

    objects.forEach(flatten);
    console.log(`   - Total de objetos Product/Offer: ${objects.filter(o => o['@type'] === 'Product' || o['@type'] === 'Offer').length}`);
    
    return objects;
  }

  extractPriceFromJsonLd(items) {
    console.log(`\n💰 Extrayendo precio de JSON-LD...`);
    
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;

      const offers = Array.isArray(item.offers) ? item.offers : [item.offers].filter(Boolean);
      for (const offer of offers) {
        if (offer && offer.price) {
          const price = this.parsePriceNumber(offer.price);
          if (price !== null) {
            console.log(`   ✓ Precio encontrado: ${price} €`);
            return price;
          }
        }
      }

      if (item.price) {
        const price = this.parsePriceNumber(item.price);
        if (price !== null) {
          console.log(`   ✓ Precio encontrado: ${price} €`);
          return price;
        }
      }
    }

    console.log(`   ✗ No se encontró precio en JSON-LD`);
    return null;
  }

  parseStorePrices($) {
    console.log(`\n🏪 Buscando precios por tienda...`);
    
    const candidates = [];
    const priceRegex = /(?:\b(?:Tienda|Local|Madrid|Barcelona|Valencia|Sevilla|Bilbao|Málaga|Alicante|Zaragoza|Murcia|Mallorca|Galicia|Córdoba|Granada|Toledo|Valladolid|Albacete|Pamplona)\b[^€\n]*?)(\d+(?:[.,]\d{1,2})?)\s*€/gi;

    const textNodes = $('body').text();
    const matches = textNodes.matchAll(priceRegex);

    let matchCount = 0;
    for (const match of matches) {
      matchCount++;
      const rawLabel = match[0].replace(/\d+(?:[.,]\d{1,2})?\s*€?/gi, '').replace(/[:\-]/g, '').trim();
      const rawPrice = match[1];
      const price = this.parsePriceNumber(rawPrice);
      if (price === null) continue;

      if (rawLabel.length > 0 && rawLabel.length < 40) {
        candidates.push({ label: rawLabel || 'Tienda', price });
      }
    }

    console.log(`   - Matches regex encontrados: ${matchCount}`);
    console.log(`   - Precios por tienda: ${candidates.length}`);

    if (!candidates.length) {
      console.log(`   ℹ️  Buscando precios genéricos...`);
      const priceMatches = [...textNodes.matchAll(/(\d+(?:[.,]\d{1,2})?)\s*€/g)];
      console.log(`   - Matches de precio genérico: ${priceMatches.length}`);
      
      for (const match of priceMatches.slice(0, 4)) {
        candidates.push({ label: 'Precio', price: this.parsePriceNumber(match[1]) || 0 });
      }
    }

    const unique = [];
    const seen = new Set();

    candidates.forEach((item) => {
      const key = `${item.label}:${item.price}`;
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(item);
    });

    if (unique.length > 0) {
      console.log(`   ✓ Precios únicos encontrados:`);
      unique.forEach((p, i) => {
        console.log(`     ${i + 1}. ${p.label}: ${p.price} €`);
      });
    }

    return unique.slice(0, 6);
  }

  async getProductDetails(url) {
    console.log(`\n📄 === OBTENIENDO DETALLES DEL PRODUCTO ===`);
    console.log(`   URL: ${url}`);
    
    try {
      const html = await this.getHtml(url);
      
      // Guardar HTML completo para inspección
      const filename = `product_${Date.now()}_full.html`;
      this.saveDebugFile(filename, html);
      
      const $ = cheerio.load(html);

      console.log(`\n🏷️  Buscando título...`);
      const title = this.normalizeText(
        $('meta[property="og:title"]').attr('content') ||
        $('h1').first().text() ||
        $('title').text() ||
        'Producto Leroy Merlin'
      );
      console.log(`   ✓ Título: "${title}"`);

      const image = $('meta[property="og:image"]').attr('content') || '';
      if (image) console.log(`   ✓ Imagen OG encontrada`);

      const jsonLd = this.extractJsonLdObjects($);
      const productPrice = this.extractPriceFromJsonLd(jsonLd);

      const pageText = $('body').text();
      let detectedPrice = null;
      const genericPriceMatch = pageText.match(/(\d+(?:[.,]\d{1,2})?)\s*€/);

      if (genericPriceMatch) {
        detectedPrice = this.parsePriceNumber(genericPriceMatch[1]);
        console.log(`   ℹ️  Precio genérico detectado: ${detectedPrice} €`);
      } else {
        console.log(`   ✗ No se detectó precio genérico en el texto`);
      }

      const finalPrice = productPrice ?? detectedPrice;

      const storePrices = this.parseStorePrices($);

      const result = {
        title: this.sanitizeProductTitle(title),
        image,
        url,
        price: finalPrice !== null ? `${finalPrice.toFixed(2).replace('.', ',')} €` : null,
        storePrices: storePrices
      };

      console.log(`\n✅ Resultado final:`);
      console.log(JSON.stringify(result, null, 2));

      // Guardar resultado
      this.saveDebugFile(`product_${Date.now()}_result.json`, JSON.stringify(result, null, 2));

      return result;
    } catch (error) {
      console.error(`❌ Error en getProductDetails: ${error.message}`);
      throw error;
    }
  }
}

module.exports = LeroyMerlinClient;
