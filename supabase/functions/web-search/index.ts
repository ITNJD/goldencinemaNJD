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

    // Brave Search (free, no API key needed for html)
    try {
      const braveUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
      const resp = await fetch(braveUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html",
          "Accept-Language": "ar,en;q=0.9",
        },
      });
      const html = await resp.text();

      // Brave: <div class="snippet-title">title</div> <div class="snippet-description">desc</div>
      const titleRegex = /<div[^>]*class="[^"]*snippet-title[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      const descRegex = /<div[^>]*class="[^"]*snippet-description[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

      const titles: string[] = [];
      const descs: string[] = [];
      let m;

      while ((m = titleRegex.exec(html)) !== null) {
        const t = m[1].replace(/<[^>]*>/g, "").trim();
        if (t && t.length > 3) titles.push(t);
      }
      while ((m = descRegex.exec(html)) !== null) {
        const d = m[1].replace(/<[^>]*>/g, "").trim();
        if (d && d.length > 10) descs.push(d);
      }

      for (let i = 0; i < Math.min(titles.length, descs.length, 5); i++) {
        results.push({ title: titles[i], snippet: descs[i] });
      }
    } catch (e) {
      console.error("Brave search error:", e);
    }

    // Fallback: DuckDuckGo
    if (results.length === 0) {
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
        console.error("DDG error:", e);
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
