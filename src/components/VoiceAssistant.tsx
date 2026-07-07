import { useState, useCallback, useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Loader2,
  Volume2,
  Settings,
  Image as ImageIcon,
  Trash2,
  Lock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

type Message = {
  role: "user" | "assistant";
  content: string;
  image?: string;
};

type Provider = "openai" | "gemini" | "anthropic";

type ChatSettings = {
  apiKey: string;
  provider: Provider;
  model: string;
  baseUrl: string;
};

const DEFAULT_SETTINGS: Record<Provider, { baseUrl: string; model: string }> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-20250514",
  },
};

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  anthropic: "Anthropic Claude",
};

const SETTINGS_KEY = "chat_settings_admin";
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cinema-chat`;

const loadSettings = (): ChatSettings => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    apiKey: "",
    provider: "openai",
    model: DEFAULT_SETTINGS.openai.model,
    baseUrl: DEFAULT_SETTINGS.openai.baseUrl,
  };
};

const saveSettingsToStorage = (settings: ChatSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

const VoiceAssistant = () => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [settings, setSettings] = useState<ChatSettings>(loadSettings);
  const [tempSettings, setTempSettings] = useState<ChatSettings>(settings);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!user?.id) {
        setMessages([]);
        return;
      }

      const { data, error } = await supabase
        .from("chat_messages")
        .select("role, content, image_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading messages:", error);
        return;
      }

      if (data) {
        setMessages(
          data.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            image: m.image_url || undefined,
          }))
        );
      }
    };

    loadMessages();
  }, [user?.id]);

  const saveMessageToDB = async (msg: Message) => {
    if (!user?.id) return;

    const { error } = await supabase.from("chat_messages").insert({
      user_id: user.id,
      role: msg.role,
      content: msg.content,
      image_url: msg.image || null,
    });

    if (error) {
      console.error("Error saving message:", error);
    }
  };

  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ar-SA";
      utterance.rate = 1;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const buildMessages = (userMessage: string, image?: string) => {
    const systemMsg = {
      role: "system" as const,
      content: `أنت مساعد ذكي متخصص في السينما العربية. أنت تعرف كل شيء عن الأفلام العربية والفنانين والمخرجين والمهرجانات السينمائية العربية.
مهامك:
- الإجابة على أسئلة المستخدمين حول الأفلام العربية
- تقديم معلومات عن الفنانين والمخرجين
- اقتراح أفلام للمشاهدة بناءً على تفضيلات المستخدم
- مشاركة معلومات تاريخية عن السينما العربية
إذا أرسل المستخدم صورة، قم بتحليلها ووصف محتواها.`,
    };

    const userMsg: Message = { role: "user", content: userMessage };
    if (image) userMsg.image = image;

    return [systemMsg, ...messages, userMsg];
  };

  const buildOpenAIFormat = (msgs: ReturnType<typeof buildMessages>) => {
    return msgs.map((m) => {
      if (m.role === "system") {
        return { role: "system", content: m.content };
      }
      if (m.image && m.role === "user") {
        return {
          role: "user",
          content: [
            { type: "text", text: m.content },
            { type: "image_url", image_url: { url: m.image } },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });
  };

  const streamChat = async (userMessage: string) => {
    const userMsg: Message = { role: "user", content: userMessage };
    if (uploadedImage) userMsg.image = uploadedImage;

    setMessages((prev) => [...prev, userMsg]);
    if (user?.id) saveMessageToDB(userMsg);

    setIsLoading(true);
    setUploadedImage(null);

    let assistantContent = "";

    try {
      let resp: Response;

      if (settings.apiKey) {
        const allMessages = buildMessages(userMessage, uploadedImage);
        const openaiFormat = buildOpenAIFormat(allMessages);

        let url = "";
        let headers: Record<string, string> = {};
        let body: Record<string, unknown> = {};

        if (settings.provider === "anthropic") {
          url = `${settings.baseUrl}/messages`;
          headers = {
            "Content-Type": "application/json",
            "x-api-key": settings.apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          };
          const systemMsg = openaiFormat.find((m) => m.role === "system");
          const otherMsgs = openaiFormat.filter((m) => m.role !== "system");
          body = {
            model: settings.model,
            max_tokens: 2048,
            system: systemMsg?.content || "",
            messages: otherMsgs,
            stream: true,
          };
        } else {
          url = `${settings.baseUrl}/chat/completions`;
          headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.apiKey}`,
          };
          body = {
            model: settings.model,
            messages: openaiFormat,
            stream: true,
          };
        }

        resp = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
      } else {
        const allMessages = buildMessages(userMessage, uploadedImage);
        const msgsToSend = allMessages.map((m) => ({
          role: m.role === "system" ? "user" : m.role,
          content: m.content,
        }));

        resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: msgsToSend }),
        });
      }

      if (!resp.ok) {
        const err = await resp.text();
        console.error("AI API error:", resp.status, err);
        throw new Error(`خطأ من الـ API (${resp.status})`);
      }

      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) throw new Error("No reader");

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const isAnthropic = settings.apiKey && settings.provider === "anthropic";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);

            let content = "";
            if (isAnthropic) {
              if (parsed.type === "content_block_delta") {
                content = parsed.delta?.text || "";
              }
            } else {
              content = parsed.choices?.[0]?.delta?.content || "";
            }

            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                };
                return newMsgs;
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      if (assistantContent) {
        const assistantMsg: Message = {
          role: "assistant",
          content: assistantContent,
        };
        if (user?.id) saveMessageToDB(assistantMsg);
        speak(assistantContent);
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في الاتصال",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startListening = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast({
        title: "غير مدعوم",
        description: "المتصفح لا يدعم التعرف على الصوت",
        variant: "destructive",
      });
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = "ar-SA";
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
      streamChat(transcript);
    };

    recognitionRef.current.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current.start();
    setIsListening(true);
  }, [messages, toast, settings, uploadedImage]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !uploadedImage) || isLoading) return;
    const text = inputText || "وصف الصورة";
    setInputText("");
    streamChat(text);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "خطأ",
        description: "ارفع ملف صورة بس",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleProviderChange = (provider: Provider) => {
    const defaults = DEFAULT_SETTINGS[provider];
    setTempSettings({
      ...tempSettings,
      provider,
      baseUrl: defaults.baseUrl,
      model: defaults.model,
    });
  };

  const handleSaveSettings = () => {
    saveSettingsToStorage(tempSettings);
    setSettings(tempSettings);
    setShowSettings(false);
    toast({ title: "تم الحفظ", description: "الإعدادات اتحفظت" });
  };

  const clearChat = async () => {
    if (user?.id) {
      const { error } = await supabase
        .from("chat_messages")
        .delete()
        .eq("user_id", user.id);

      if (error) {
        console.error("Error clearing chat:", error);
      }
    }
    setMessages([]);
    stopSpeaking();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-gold to-gold-dark shadow-lg flex items-center justify-center transition-all hover:scale-110 ${
          isOpen ? "hidden" : ""
        }`}
      >
        <Bot className="w-7 h-7 text-background" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background animate-pulse" />
      </button>

      {isOpen && (
        <div className="fixed bottom-6 left-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-card border border-gold/30 rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[80vh]">
          {showSettings ? (
            <div className="flex flex-col h-full max-h-[80vh]">
              <div className="bg-gradient-to-r from-gold/20 to-gold/10 p-4 flex items-center justify-between border-b border-gold/20">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-foreground">الإعدادات</h3>
                  <Lock className="w-4 h-4 text-gold" />
                </div>
                <button
                  onClick={() => {
                    setShowSettings(false);
                    setTempSettings(settings);
                  }}
                  className="w-8 h-8 rounded-full hover:bg-gold/20 flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                <div className="bg-gold/10 border border-gold/20 rounded-lg p-3 text-xs text-muted-foreground">
                  <Lock className="w-3 h-3 inline mr-1 text-gold" />
                  الشات شغال بـ Gemini المدمج. الإعدادات دي اختيارية لو عايز تستخدم API مخصص.
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    مزود الخدمة
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(PROVIDER_LABELS) as Provider[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => handleProviderChange(p)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          tempSettings.provider === p
                            ? "bg-gold text-background"
                            : "bg-secondary text-foreground hover:bg-gold/20"
                        }`}
                      >
                        {PROVIDER_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={tempSettings.apiKey}
                    onChange={(e) =>
                      setTempSettings({ ...tempSettings, apiKey: e.target.value })
                    }
                    placeholder="sk-..."
                    className="w-full bg-secondary border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={tempSettings.baseUrl}
                    onChange={(e) =>
                      setTempSettings({ ...tempSettings, baseUrl: e.target.value })
                    }
                    className="w-full bg-secondary border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">
                    Model
                  </label>
                  <input
                    type="text"
                    value={tempSettings.model}
                    onChange={(e) =>
                      setTempSettings({ ...tempSettings, model: e.target.value })
                    }
                    className="w-full bg-secondary border border-gold/20 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold"
                  />
                </div>

                {!tempSettings.apiKey && (
                  <p className="text-xs text-muted-foreground bg-secondary rounded-lg p-3">
                    الشات شغال بـ Gemini المدمج. لو عايز تستخدم API مخصص، حط الـ Key بتاعك:
                    <br />
                    - OpenAI: platform.openai.com
                    <br />
                    - Gemini: aistudio.google.com
                    <br />
                    - Anthropic: console.anthropic.com
                  </p>
                )}
              </div>

              <div className="p-4 border-t border-gold/20">
                <button
                  onClick={handleSaveSettings}
                  className="w-full py-2 rounded-lg bg-gold text-background font-medium hover:bg-gold-light transition-colors"
                >
                  حفظ
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-r from-gold/20 to-gold/10 p-4 flex items-center justify-between border-b border-gold/20 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">المساعد السينمائي</h3>
                    <p className="text-xs text-muted-foreground">
                      {user
                        ? `${user.email?.split("@")[0]}`
                        : "زائر"}
                      {settings.apiKey
                        ? ` - ${PROVIDER_LABELS[settings.provider]}`
                        : " - Gemini"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <button
                      onClick={clearChat}
                      className="w-8 h-8 rounded-full hover:bg-gold/20 flex items-center justify-center transition-colors"
                      title="مسح المحادثة"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setTempSettings(settings);
                        setShowSettings(true);
                      }}
                      className="w-8 h-8 rounded-full hover:bg-gold/20 flex items-center justify-center transition-colors"
                      title="الإعدادات (Admin فقط)"
                    >
                      <Settings className="w-5 h-5 text-muted-foreground" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      stopSpeaking();
                    }}
                    className="w-8 h-8 rounded-full hover:bg-gold/20 flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>مرحباً! اسألني أي سؤال عن السينما العربية</p>
                    {isAdmin && !settings.apiKey && (
                      <button
                        onClick={() => {
                          setTempSettings(settings);
                          setShowSettings(true);
                        }}
                        className="mt-3 text-xs text-gold underline"
                      >
                        اضغط هنا لضبط API Key مخصص
                      </button>
                    )}
                  </div>
                )}
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 ${
                      msg.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        msg.role === "user" ? "bg-gold/20" : "bg-secondary"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <User className="w-4 h-4 text-gold" />
                      ) : (
                        <Bot className="w-4 h-4 text-gold" />
                      )}
                    </div>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        msg.role === "user"
                          ? "bg-gold text-background rounded-tr-sm"
                          : "bg-secondary text-foreground rounded-tl-sm"
                      }`}
                    >
                      {msg.image && (
                        <img
                          src={msg.image}
                          alt="uploaded"
                          className="rounded-lg mb-2 max-h-40 object-cover"
                        />
                      )}
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <Bot className="w-4 h-4 text-gold" />
                    </div>
                    <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-gold" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {uploadedImage && (
                <div className="px-4 py-2 border-t border-gold/10 shrink-0">
                  <div className="relative inline-block">
                    <img
                      src={uploadedImage}
                      alt="upload preview"
                      className="h-16 rounded-lg object-cover"
                    />
                    <button
                      onClick={() => setUploadedImage(null)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                </div>
              )}

              <div className="p-4 border-t border-gold/20 shrink-0">
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="w-10 h-10 rounded-full bg-secondary hover:bg-gold/20 flex items-center justify-center transition-colors text-gold shrink-0"
                    title="ارفع صورة"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    disabled={isLoading}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
                      isListening
                        ? "bg-red-500 text-white animate-pulse"
                        : "bg-secondary hover:bg-gold/20 text-gold"
                    }`}
                  >
                    {isListening ? (
                      <MicOff className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </button>

                  {isSpeaking && (
                    <button
                      type="button"
                      onClick={stopSpeaking}
                      className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center animate-pulse shrink-0"
                    >
                      <Volume2 className="w-5 h-5 text-gold" />
                    </button>
                  )}

                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="اكتب سؤالك هنا..."
                    disabled={isLoading}
                    className="flex-1 min-w-0 bg-secondary border border-gold/20 rounded-full px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold transition-colors"
                  />

                  <button
                    type="submit"
                    disabled={(!inputText.trim() && !uploadedImage) || isLoading}
                    className="w-10 h-10 rounded-full bg-gold text-background flex items-center justify-center hover:bg-gold-light transition-colors disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default VoiceAssistant;
