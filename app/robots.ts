import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/settings", "/profile", "/friends", "/tasks"],
    },
    sitemap: "https://www.dangdoro.com/sitemap.xml",
  };
}
