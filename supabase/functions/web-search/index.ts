import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ error: "Query required", results: [] }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let results: Array<{ title: string; snippet: string }> = [];

    // Method 1: DuckDuckGo API (JSON)
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
      const ddgResp = await fetch(ddgUrl);
      const ddgData = await ddgResp.json();

      if (ddgData.AbstractText) {
        results.push({ title: ddgData.Heading || query, snippet: ddgData.AbstractText });
      }
      if (ddgData.RelatedTopics) {
        for (const topic of ddgData.RelatedTopics.slice(0, 5)) {
          if (topic.Text) {
            results.push({ title: topic.Text.substring(0, 80), snippet: topic.Text });
          }
        }
      }
    } catch (e) {
      console.error("DDG API error:", e);
    }

    // Method 2: DuckDuckGo HTML Lite (fallback)
    if (results.length === 0) {
      try {
        const resp = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        });
        const html = await resp.text();

        const linkMatches = [...html.matchAll(/<a[^>]*rel="nofollow"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];
        const snippetMatches = [...html.matchAll(/<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi)];

        for (let i = 0; i < Math.min(linkMatches.length, snippetMatches.length, 5); i++) {
          const title = linkMatches[i][2].replace(/<[^>]*>/g, "").trim();
          const snippet = snippetMatches[i][1].replace(/<[^>]*>/g, "").trim();
          if (title && snippet && title.length > 3) {
            results.push({ title, snippet });
          }
        }
      } catch (e) {
        console.error("DDG Lite error:", e);
      }
    }

    return new Response(JSON.stringify({ results, query }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Search error:", error);
    return new Response(JSON.stringify({ error: "Failed", results: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
