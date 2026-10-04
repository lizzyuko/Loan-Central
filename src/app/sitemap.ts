import type { MetadataRoute } from "next";
import { LEGAL_DOCUMENTS } from "@/content/legal";

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/apply", "/about", "/contact", ...Object.keys(LEGAL_DOCUMENTS).map((s) => `/legal/${s}`)];
  return pages.map((path) => ({
    url: `${appUrl}${path}`,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/apply" ? 0.9 : 0.5,
  }));
}
