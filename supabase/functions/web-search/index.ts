import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use DuckDuckGo HTML search and parse results
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const html = await response.text();

    // Parse results from DuckDuckGo HTML
    const results: Array<{ title: string; snippet: string; url: string }> = [];
    const resultRegex =
      /<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;

    while ((match = resultRegex.exec(html)) !== null && results.length < 5) {
      const title = match[1].replace(/<[^>]*>/g, "").trim();
      const snippet = match[2].replace(/<[^>]*>/g, "").trim();
      if (title && snippet) {
        results.push({ title, snippet, url: "" });
      }
    }

    // Fallback: simpler regex if above doesn't match
    if (results.length === 0) {
      const simpleRegex = /<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/g;
      const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

      const titles: string[] = [];
      const snippets: string[] = [];

      while ((match = simpleRegex.exec(html)) !== null) {
        titles.push(match[1].replace(/<[^>]*>/g, "").trim());
      }
      while ((match = snippetRegex.exec(html)) !== null) {
        snippets.push(match[1].replace(/<[^>]*>/g, "").trim());
      }

      for (let i = 0; i < Math.min(titles.length, snippets.length, 5); i++) {
        if (titles[i] && snippets[i]) {
          results.push({ title: titles[i], snippet: snippets[i], url: "" });
        }
      }
    }

    return new Response(
      JSON.stringify({ results, query }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Search error:", error);
    return new Response(
      JSON.stringify({ error: "Search failed", results: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
