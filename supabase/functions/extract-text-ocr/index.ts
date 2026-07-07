import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTHORIZED_EMAIL = "michaelmounir396@gmail.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "يجب تسجيل الدخول أولاً" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "جلسة غير صالحة، يرجى تسجيل الدخول مجدداً" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (user.email !== AUTHORIZED_EMAIL) {
      return new Response(
        JSON.stringify({ error: "غير مصرح لك باستخدام هذه الخاصية" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageUrl, apiKey, provider, model, baseUrl } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "Image URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API Key is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Extracting text from image:", imageUrl, "by user:", user.email);

    let url = "";
    let headers: Record<string, string> = {};
    let body: Record<string, unknown> = {};

    const ocrSystemPrompt = `أنت خبير في استخراج النصوص من الصور (OCR) وتصحيح الأخطاء اللغوية العربية.

مهمتك:
1. استخراج كل النص الموجود في الصورة بدقة عالية
2. تصحيح أي أخطاء إملائية أو نحوية في النص المستخرج
3. الحفاظ على التنسيق الأصلي للنص (فقرات، عناوين)
4. إذا لم تجد نصاً في الصورة، أرجع رسالة توضح ذلك

أرجع النص المستخرج والمصحح فقط، بدون أي شرح إضافي.`;

    const ocrUserMessage = {
      role: "user",
      content: [
        { type: "text", text: "استخرج النص العربي من هذه الصورة وصححه لغوياً:" },
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    };

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
        system: ocrSystemPrompt,
        messages: [ocrUserMessage],
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
          { role: "system", content: ocrSystemPrompt },
          ocrUserMessage,
        ],
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
          { role: "system", content: ocrSystemPrompt },
          ocrUserMessage,
        ],
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content || "";

    console.log("Text extracted successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        text: extractedText 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("OCR error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to extract text" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
