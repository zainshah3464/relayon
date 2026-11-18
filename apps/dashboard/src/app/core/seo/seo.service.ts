import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';

export interface SeoConfig {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: 'website' | 'article';
  keywords?: string[];
  publishedAt?: string;
  modifiedAt?: string;
  author?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  breadcrumbs?: Array<{ name: string; url: string }>;
  noindex?: boolean;
}

const BASE_URL = 'https://relayon.vercel.app';
const DEFAULT_IMAGE = `${BASE_URL}/assets/og-image.png`;
const SITE_NAME = 'Relayon';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);

  set(config: SeoConfig): void {
    const fullTitle = config.title.includes(SITE_NAME)
      ? config.title
      : `${config.title} · ${SITE_NAME}`;
    const url = `${BASE_URL}${config.path}`;
    const image = config.image ?? DEFAULT_IMAGE;

    // ── Title + description ──────────────────────────────
    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: config.description });

    if (config.keywords?.length) {
      this.meta.updateTag({ name: 'keywords', content: config.keywords.join(', ') });
    }

    // ── Robots ───────────────────────────────────────────
    this.meta.updateTag({
      name: 'robots',
      content: config.noindex
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large, max-snippet:-1',
    });

    // ── Canonical ────────────────────────────────────────
    this.setCanonical(url);

    // ── Open Graph ───────────────────────────────────────
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: config.description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:type', content: config.type ?? 'website' });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });

    // ── Twitter ──────────────────────────────────────────
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: config.description });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    // ── Article-specific ─────────────────────────────────
    if (config.type === 'article') {
      if (config.publishedAt) {
        this.meta.updateTag({ property: 'article:published_time', content: config.publishedAt });
      }
      if (config.modifiedAt) {
        this.meta.updateTag({ property: 'article:modified_time', content: config.modifiedAt });
      }
      if (config.author) {
        this.meta.updateTag({ property: 'article:author', content: config.author });
      }
    }

    // ── Breadcrumb schema ────────────────────────────────
    if (config.breadcrumbs?.length) {
      const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: config.breadcrumbs.map((bc, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: bc.name,
          item: `${BASE_URL}${bc.url}`,
        })),
      };
      this.appendJsonLd(breadcrumbSchema, 'breadcrumb');
    } else {
      this.removeJsonLd('breadcrumb');
    }

    // ── Page-specific JSON-LD ────────────────────────────
    this.removeJsonLd('page');
    if (config.jsonLd) {
      const items = Array.isArray(config.jsonLd) ? config.jsonLd : [config.jsonLd];
      for (const item of items) {
        this.appendJsonLd(item, 'page');
      }
    }
  }

  private setCanonical(url: string): void {
    let link = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private appendJsonLd(data: Record<string, unknown>, marker: string): void {
    const script = this.doc.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo', marker);
    script.textContent = JSON.stringify(data);
    this.doc.head.appendChild(script);
  }

  private removeJsonLd(marker: string): void {
    this.doc
      .querySelectorAll(`script[type="application/ld+json"][data-seo="${marker}"]`)
      .forEach((el) => el.remove());
  }
}