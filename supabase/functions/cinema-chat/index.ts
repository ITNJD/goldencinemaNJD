import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function searchGoogle(query: string, apiKey: string, cx: string): Promise<string> {
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=10&lr=lang_ar`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error("Search API error:", resp.status, await resp.text());
      return "";
    }
    const data = await resp.json();
    if (!data.items || data.items.length === 0) return "";
    return data.items.map((item: { title: string; snippet: string; link: string }) =>
      `- ${item.title}: ${item.snippet} [${item.link}]`
    ).join("\n");
  } catch (e) {
    console.error("Search error:", e);
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, apiKey, provider, model, baseUrl, searchApiKey, searchEngineId } = await req.json();

    if (!apiKey) {
      throw new Error("API Key is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: movies } = await supabase
      .from("movies")
      .select("title, year, director, genre, rating, synopsis, duration")
      .order("year", { ascending: false })
      .limit(50);

    const { data: artists } = await supabase
      .from("artists")
      .select("name, birth_year, death_year, role, biography")
      .limit(30);

    let moviesContext = "";
    if (movies && movies.length > 0) {
      moviesContext = `\nأفلام موجودة في موقع "السينما الذهبية":\n${movies.map((m, i) => `${i + 1}. "${m.title}" (${m.year}) - إخراج: ${m.director || "غير معروف"} - تصنيف: ${(m.genre || []).join(", ")} - تقييم: ${m.rating || "غير مقيم"}`).join("\n")}`;
    }

    let artistsContext = "";
    if (artists && artists.length > 0) {
      artistsContext = `\nفنانين موجودين في موقع "السينما الذهبية":\n${artists.map((a, i) => `${i + 1}. ${a.name} (${a.birth_year || "?"} - ${a.death_year || "حتى الآن"}) - ${a.role?.join(", ") || ""}`).join("\n")}`;
    }

    const lastUserMsg = messages?.filter((m: { role: string }) => m.role === "user").pop();
    const userQuestion = lastUserMsg?.content || "";

    let searchContext = "";
    if (searchApiKey && searchEngineId && userQuestion) {
      searchContext = await searchGoogle(userQuestion, searchApiKey, searchEngineId);
      console.log("Search results:", searchContext ? "Found" : "Empty");
    } else {
      console.log("Search skipped:", { searchApiKey: !!searchApiKey, searchEngineId: !!searchEngineId });
    }

    const systemPrompt = `أنت مساعد ذكي ومفيد متخصص في السينما العربية.

معلومات مهمة جداً:
- السنة الحالية هي 2026
- أنت مساعد لموقع "السينما الذهبية"

${moviesContext}

${artistsContext}

${searchContext ? `\nنتائج بحث من الإنترنت (استخدمها للإجابة):\n${searchContext}` : "\nملاحظة: لا توجد نتائج بحث متاحة حالياً."}

قواعد صارمة:
1. إذا كان هناك نتائج بحث، استخدمها فقط للإجابة واحذر المستخدم من المصدر
2. لا تخترع أسماء أفلام أو مخرجين أو ممثلين - فقط استخدم ما هو موجود في النتائج أو في قواعد البيانات أعلاه
3. إذا لم تجد معلومة، قل "لا تتوفر لدي معلومات كافية"
4. إذا سأل المستخدم عن فيلم من الموقع، وضح أنه من "السينما الذهبية"
5. إذا سأل عن أحدث الأفلام، استخدم نتائج البحث فقط
6. أجب باللغة العربية بطريقة ودية ومختصرة
7. إذا كان هناك روابط في نتائج البحث، شاركها مع المستخدم`;

    let url = "";
    let headers: Record<string, string> = {};
    let body: Record<string, unknown> = {};

    if (provider === "anthropic") {
      url = `${baseUrl || "https://api.anthropic.com/v1"}/messages`;
      headers = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      };
      body = {
        model: model || "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages,
        stream: true,
      };
    } else if (provider === "gemini") {
      url = `${baseUrl || "https://generativelanguage.googleapis.com/v1beta/openai"}/chat/completions`;
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };
      body = {
        model: model || "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      };
    } else {
      url = `${baseUrl || "https://api.openai.com/v1"}/chat/completions`;
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };
      body = {
        model: model || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("AI API error:", response.status, err);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `خطأ: ${response.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير معروف" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
