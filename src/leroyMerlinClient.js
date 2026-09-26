const axios = require('axios');
const cheerio = require('cheerio');

class LeroyMerlinClient {
  constructor(baseUrl = 'https://www.leroymerlin.es') {
    this.baseUrl = baseUrl;
  }

  async getHtml(url) {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 40000
    });

    return response.data;
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
    const html = await this.getHtml(url);
    const $ = cheerio.load(html);

    const products = [];
    const seen = new Set();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const text = this.normalizeText($(el).text());

      if (!href || !text) return;

      const isProductLink = /\/fp\//i.test(href) || /\/ficha-producto\//i.test(href) || /\/product/i.test(href) || /\/p\//i.test(href);
      if (!isProductLink) return;

      const urlAbsolute = this.extractAbsoluteUrl(href);
      if (seen.has(urlAbsolute)) return;
      seen.add(urlAbsolute);

      products.push({
        title: this.sanitizeProductTitle(text),
        url: urlAbsolute
      });
    });

    const unique = products.filter((p) => p.title && p.title.length > 2);
    return unique.slice(0, 5);
  }

  extractJsonLdObjects($) {
    const objects = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).contents().text();
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        objects.push(parsed);
      } catch (_) {
        // Ignorar JSON-LD malformado
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
    return objects;
  }

  extractPriceFromJsonLd(items) {
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;

      const offers = Array.isArray(item.offers) ? item.offers : [item.offers].filter(Boolean);
      for (const offer of offers) {
        if (offer && offer.price) {
          const price = this.parsePriceNumber(offer.price);
          if (price !== null) return price;
        }
      }

      if (item.price) {
        const price = this.parsePriceNumber(item.price);
        if (price !== null) return price;
      }
    }

    return null;
  }

  parseStorePrices($) {
    const candidates = [];
    // Regex completo para detectar precios por tienda
    const priceRegex = /(?:\b(?:Tienda|Local|Madrid|Barcelona|Valencia|Sevilla|Bilbao|Málaga|Alicante|Zaragoza|Murcia|Mallorca|Galicia|Córdoba|Granada|Toledo|Valladolid|Albacete|Pamplona)\b[^€\n]*?)(\d+(?:[.,]\d{1,2})?)\s*€/gi;

    const textNodes = $('body').text();
    const matches = textNodes.matchAll(priceRegex);

    for (const match of matches) {
      const rawLabel = match[0].replace(/\d+(?:[.,]\d{1,2})?\s*€?/gi, '').replace(/[:\-]/g, '').trim();
      const rawPrice = match[1];
      const price = this.parsePriceNumber(rawPrice);
      if (price === null) continue;

      if (rawLabel.length > 0 && rawLabel.length < 40) {
        candidates.push({ label: rawLabel || 'Tienda', price });
      }
    }

    if (!candidates.length) {
      const priceMatches = [...textNodes.matchAll(/(\d+(?:[.,]\d{1,2})?)\s*€/g)];
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

    return unique.slice(0, 6);
  }

  async getProductDetails(url) {
    const html = await this.getHtml(url);
    const $ = cheerio.load(html);

    const title = this.normalizeText(
      $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text() ||
      $('title').text() ||
      'Producto Leroy Merlin'
    );

    const image = $('meta[property="og:image"]').attr('content') || '';
    const jsonLd = this.extractJsonLdObjects($);
    const productPrice = this.extractPriceFromJsonLd(jsonLd);

    const pageText = $('body').text();
    let detectedPrice = null;
    const genericPriceMatch = pageText.match(/(\d+(?:[.,]\d{1,2})?)\s*€/);

    if (genericPriceMatch) {
      detectedPrice = this.parsePriceNumber(genericPriceMatch[1]);
    }

    const finalPrice = productPrice ?? detectedPrice;

    return {
      title: this.sanitizeProductTitle(title),
      image,
      url,
      price: finalPrice !== null ? `${finalPrice.toFixed(2).replace('.', ',')} €` : null,
      storePrices: this.parseStorePrices($)
    };
  }
}

module.exports = LeroyMerlinClient;
