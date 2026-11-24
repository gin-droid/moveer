import { useEffect } from "react";
import { appPath } from "@/lib/appPath";

const getSiteUrl = () => import.meta.env.VITE_SITE_URL || window.location.origin;

function upsertMeta(selector, attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function upsertJsonLd(id, data) {
  if (!data) return;
  const existing = document.head.querySelector(`script[data-jsonld="${id}"]`);
  const script = existing instanceof HTMLScriptElement ? existing : document.createElement("script");
  if (script !== existing) {
    script.setAttribute("data-jsonld", id);
    document.head.appendChild(script);
  }
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(data);
}

/**
 * useSEO — sets per-page meta tags at runtime (title, description,
 * Open Graph, Twitter Card, canonical URL, JSON-LD structured data).
 * Works for SPA crawlers that render JavaScript (Google, Bing).
 */
/** @param {{title?: string, description?: string, path?: string, image?: string, type?: string, jsonLd?: unknown}} options */
export function useSEO({ title, description, path, image, type = "website", jsonLd }) {
  useEffect(() => {
    if (title) document.title = title;
    const siteUrl = getSiteUrl();
    const url = `${siteUrl}${appPath(path || "/")}`;

    upsertMeta('meta[name="description"]', "name", "description", description);
    upsertMeta('meta[property="og:title"]', "property", "og:title", title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", description);
    upsertMeta('meta[property="og:url"]', "property", "og:url", url);
    upsertMeta('meta[property="og:type"]', "property", "og:type", type);
    upsertMeta('meta[property="og:site_name"]', "property", "og:site_name", "moVeerAI");
    upsertMeta('meta[property="og:image"]', "property", "og:image", image);
    upsertMeta('meta[name="twitter:card"]', "name", "twitter:card", image ? "summary_large_image" : "summary");
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", image);
    upsertLink("canonical", url);
    upsertJsonLd("page", jsonLd);

    return () => {
      // Clean up JSON-LD so it doesn't leak between pages
      const el = document.head.querySelector('script[data-jsonld="page"]');
      if (el) el.remove();
    };
  }, [title, description, path, image, type, jsonLd]);
}