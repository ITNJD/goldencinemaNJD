import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function searchGoogle(query: string, apiKey: string, cx: string): Promise<string> {
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=5&lr=lang_ar`;
    const resp = await fetch(url);
    if (!resp.ok) return "";
    const data = await resp.json();
    if (!data.items || data.items.length === 0) return "";
    return data.items.map((item: { title: string; snippet: string; link: string }) =>
      `- ${item.title}: ${item.snippet} (${item.link})`
    ).join("\n");
  } catch {
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

    const lastUserMsg = messages?.filter((m: { role: string }) => m.role === "user").pop();
    const userQuestion = lastUserMsg?.content || "";

    let searchContext = "";
    if (searchApiKey && searchEngineId && userQuestion) {
      searchContext = await searchGoogle(userQuestion, searchApiKey, searchEngineId);
    }

    const systemPrompt = `أنت مساعد ذكي ومفيد. عندك معرفة واسعة عن كل المواضيع.
- أجب باللغة العربية بطريقة ودية ومختصرة
- إذا لم تعرف الإجابة، قل ذلك بوضوح${searchContext ? `\n\nنتائج بحث من الإنترنت:\n${searchContext}\n\nاستخدم هذه النتائج للإجابة إذا كانت مناسبة.` : ""}`;

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
