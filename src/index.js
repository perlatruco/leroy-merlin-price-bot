const axios = require('axios');
const cheerio = require('cheerio');

class LeroyMerlinClient {
  constructor(baseUrl = 'https://www.leroymerlin.es') {
    this.baseUrl = baseUrl;
  }

  async getHtml(url) {
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 20000
    });

    return response.data;
  }

  normalizeText(value) {
    return (value || '')
      .replace(/\s+/g, ' ')
      .replace(/\u00a0/g, ' ')
      .trim();
  }

  buildSearchUrl(query) {
    return `${this.baseUrl}/search/?q=${encodeURIComponent(query)}`;
  }

  extractAbsoluteUrl(url) {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) return `${this.baseUrl}${url}`;
    return `${this.baseUrl}/${url}`;
  }

  extractProductCardInfo($, card) {
    const titleEl =
      $(card).find('[data-test-id="product-title"], .product-title, .product-name, h2, h3, a[title], .name').first();
    const cardLink = $(card).find('a[href]').first();

    const title = this.normalizeText(titleEl.text() || $(cardLink).attr('title') || '');
    const href = this.extractAbsoluteUrl($(cardLink).attr('href'));

    return {
      title: title || 'Producto Leroy Merlin',
      url: href
    };
  }

  async searchProducts(query) {
    const searchUrl = this.buildSearchUrl(query);
    const html = await this.getHtml(searchUrl);
    const $ = cheerio.load(html);

    const seen = new Set();
    const products = [];

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = this.normalizeText($(el).text());

      const isLikelyProduct =
        /\/fp\//i.test(href) ||
        /\/ficha-producto\//i.test(href) ||
        /product/i.test(href) ||
        /\/p\//i.test(href);

      if (!isLikelyProduct || !text) return;

      const absolute = this.extractAbsoluteUrl(href);
      if (!absolute || seen.has(absolute)) return;

      seen.add(absolute);
      products.push({
        title: text || 'Producto Leroy Merlin',
        url: absolute
      });
    });

    return products.slice(0, 5);
  }

  extractJsonLdProducts($) {
    const scripts = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      const content = $(el).contents().text();
      if (!content) return;

      try {
        const parsed = JSON.parse(content);
        scripts.push(parsed);
      } catch (error) {
        // Ignore malformed JSON-LD blocks
      }
    });

    const result = [];
    const parseNested = (value) => {
      if (Array.isArray(value)) {
        value.forEach(parseNested);
        return;
      }

      if (!value || typeof value !== 'object') return;

      if (value['@type'] === 'Product' || value['@type'] === 'Offer' || value['@type'] === 'BreadcrumbList') {
        result.push(value);
      }

      Object.values(value).forEach(parseNested);
    };

    scripts.forEach(parseNested);
    return result;
  }

  extractPriceFromJsonLd(jsonLdItems) {
    const candidates = [];

    for (const item of jsonLdItems) {
      if (item && item.offers) {
        const prices = Array.isArray(item.offers) ? item.offers : [item.offers];
        for (const offer of prices) {
          if (offer && offer.price) {
            candidates.push(Number(offer.price));
          }
        }
      }

      if (item && item.price) {
        candidates.push(Number(item.price));
      }
    }

    return candidates.find((value) => !Number.isNaN(value));
  }

  extractStorePrices($) {
    const priceMatches = [];

    $('body').find('*').each((_, el) => {
      const text = this.normalizeText($(el).text());
      if (!text) return;

      const matched = text.match(/([A-Za-zÀ-ÿ\s]+?)\s*[:\-]?\s*(\d+(?:[.,]\d{1,2})?)\s*€|€\s*(\d+(?:[.,]\d{1,2})?)/i);
      if (!matched) return;

      const label = (matched[1] || 'Tienda').trim();
      const value = matched[2] || matched[3] || '';

      if (!label || !value) return;

      priceMatches.push({
        label: label.length > 30 ? label.slice(0, 30) : label,
        price: Number(value.replace(',', '.'))
      });
    });

    const unique = [];
    const seen = new Set();

    for (const item of priceMatches) {
      const key = `${item.label}:${item.price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }

    return unique.slice(0, 6);
  }

  async getProductDetails(url) {
    const html = await this.getHtml(url);
    const $ = cheerio.load(html);

    const jsonLd = this.extractJsonLdProducts($);
    const priceFromJsonLd = this.extractPriceFromJsonLd(jsonLd);

    const title = this.normalizeText(
      $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text() ||
      jsonLd.find((item) => item.name)?.name ||
      'Producto Leroy Merlin'
    );

    const image = $('meta[property="og:image"]').attr('content') || '';
    const storePrices = this.extractStorePrices($);

    return {
      title,
      url,
      image,
      price: priceFromJsonLd ? `${priceFromJsonLd.toFixed(2).replace('.', ',')} €` : null,
      storePrices: storePrices.length ? storePrices : []
    };
  }
}

module.exports = LeroyMerlinClient;
