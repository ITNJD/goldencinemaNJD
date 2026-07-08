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

    // SearXNG public instance (JSON API)
    const searxInstances = [
      "https://search.sapti.me",
      "https://searx.tiekoetter.com",
      "https://search.bus-hit.me",
    ];

    for (const instance of searxInstances) {
      if (results.length > 0) break;
      try {
        const url = `${instance}/search?q=${encodeURIComponent(query)}&format=json&language=ar`;
        const resp = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(5000),
        });
        const data = await resp.json();
        if (data.results) {
          for (const r of data.results.slice(0, 5)) {
            results.push({
              title: r.title || "",
              snippet: r.content || "",
            });
          }
        }
      } catch (e) {
        console.error(`SearXNG ${instance} failed:`, e);
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
