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

    // Try DuckDuckGo Lite (simpler HTML)
    let results: Array<{ title: string; snippet: string }> = [];

    try {
      const ddgUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
      const ddgResp = await fetch(ddgUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      const ddgHtml = await ddgResp.text();

      // Parse lite results: <a class="result-link" href="...">title</a> ... <td class="result-snippet">snippet</td>
      const linkRegex = /<a[^>]*class="result-link"[^>]*>([\s\S]*?)<\/a>/gi;
      const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

      const titles: string[] = [];
      const snippets: string[] = [];
      let m;

      while ((m = linkRegex.exec(ddgHtml)) !== null) {
        const t = m[1].replace(/<[^>]*>/g, "").trim();
        if (t) titles.push(t);
      }
      while ((m = snippetRegex.exec(ddgHtml)) !== null) {
        const s = m[1].replace(/<[^>]*>/g, "").trim();
        if (s) snippets.push(s);
      }

      for (let i = 0; i < Math.min(titles.length, snippets.length, 5); i++) {
        results.push({ title: titles[i], snippet: snippets[i] });
      }
    } catch (e) {
      console.error("DuckDuckGo lite failed:", e);
    }

    // Fallback: try Google
    if (results.length === 0) {
      try {
        const gUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=ar`;
        const gResp = await fetch(gUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "ar,en;q=0.9",
          },
        });
        const gHtml = await gResp.text();

        // Google: <div class="..."><h3>title</h3></div>...<span class="...">snippet</span>
        const gTitleRegex = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
        const titles: string[] = [];
        let m;
        while ((m = gTitleRegex.exec(gHtml)) !== null) {
          const t = m[1].replace(/<[^>]*>/g, "").trim();
          if (t && t.length > 5) titles.push(t);
        }

        // Get snippets from <span> or <div> near results
        const gSnippetRegex = /<span[^>]*>((?:(?!<\/span>).)*(?:فيلم|مسلسل|سينما|cinema|movie)(?:(?!<\/span>).)*)<\/span>/gi;
        const snippets: string[] = [];
        while ((m = gSnippetRegex.exec(gHtml)) !== null) {
          const s = m[1].replace(/<[^>]*>/g, "").trim();
          if (s && s.length > 10) snippets.push(s);
        }

        // If no cinema snippets, try general snippets
        if (snippets.length === 0) {
          const generalSnippet = /<div[^>]*class="[^"]*"[^>]*>((?:(?!<\/div>).){50,200})<\/div>/gi;
          while ((m = generalSnippet.exec(gHtml)) !== null) {
            const s = m[1].replace(/<[^>]*>/g, "").trim();
            if (s && s.length > 20 && s.length < 300) snippets.push(s);
            if (snippets.length >= 5) break;
          }
        }

        for (let i = 0; i < Math.min(titles.length, Math.max(snippets.length, 1), 5); i++) {
          results.push({
            title: titles[i],
            snippet: snippets[i] || "",
          });
        }
      } catch (e) {
        console.error("Google search failed:", e);
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
