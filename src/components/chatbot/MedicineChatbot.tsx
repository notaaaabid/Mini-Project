import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, X, Send, Bot, User, AlertTriangle, Sparkles } from 'lucide-react';
import { STORAGE_KEYS, Medicine } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { askGemini, isGeminiConfigured } from '@/lib/gemini';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: Date;
}

const MedicineChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const geminiEnabled = isGeminiConfigured();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: geminiEnabled
        ? "Hello! I'm MediCare AI, powered by Gemini ✨\n\nI can help you with:\n\n• Medicine timing & dosage guidance\n• What to take with/avoid with medicines\n• Side effects & precautions\n• Drug interaction awareness\n• General wellness tips\n\nAsk me anything about medicines!"
        : "Hello! I'm your MediCare AI assistant. I can help you with medicine-related questions such as:\n\n• When to take a medicine (before/after food)\n• What to drink with medications\n• Foods to avoid\n• Dosage timing\n• General precautions\n\nHow can I help you today?",
      isBot: true,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const [medicines, setMedicines] = useState<Medicine[]>([]);

  useEffect(() => {
    const fetchMedicines = async () => {
      const { data } = await supabase.from('medicines').select('*');
      if (data) setMedicines(data as Medicine[]);
    };
    fetchMedicines();
  }, []);

  // ===== KEYWORD FALLBACK (original logic) =====
  const findMedicineInfo = (query: string): string | null => {
    const lowerQuery = query.toLowerCase();

    const medicine = medicines.find(m =>
      lowerQuery.includes(m.name.toLowerCase()) ||
      m.name.toLowerCase().split(' ').some(word => word.length > 2 && lowerQuery.includes(word.toLowerCase()))
    );

    if (medicine && medicine.instructions) {
      const { instructions } = medicine;
      const timingMap: Record<string, string> = {
        'before_food': 'before meals',
        'after_food': 'after meals',
        'with_food': 'with food',
        'anytime': 'at any time'
      };

      return `**${medicine.name}**\n\n` +
        `📋 **When to take:** ${timingMap[instructions.timing] || instructions.timing || 'Not specified'}\n\n` +
        `🥤 **What to drink:** ${instructions.drinkWith || 'Water'}\n\n` +
        `🚫 **Foods to avoid:** ${instructions.foodsToAvoid?.length > 0 ? instructions.foodsToAvoid.join(', ') : 'No specific restrictions'}\n\n` +
        `⏰ **Dosage timing:** ${instructions.dosageTiming || 'As directed'}\n\n` +
        `⚠️ **Precautions:**\n${instructions.precautions?.length > 0 ? instructions.precautions.map(p => `• ${p}`).join('\n') : '• Follow your doctor\'s advice'}`;
    } else if (medicine) {
      return `**${medicine.name}**\n\n` +
        `💊 ${medicine.description || 'Medicine available in our store.'}\n` +
        `💰 Price: $${medicine.price?.toFixed(2) || 'N/A'}\n` +
        `📦 Stock: ${medicine.stock ?? 'N/A'}`;
    }

    return null;
  };

  const generateKeywordResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase();

    const medicineInfo = findMedicineInfo(query);
    if (medicineInfo) return medicineInfo;

    if (lowerQuery.includes('before') && lowerQuery.includes('food')) {
      return "Many medicines work best when taken before food because:\n\n• Better absorption on an empty stomach\n• Reduces interaction with food\n• More effective for conditions like acid reflux\n\nExamples include antibiotics, antacids, and some diabetes medications. Always check your specific medication's instructions!";
    }

    if (lowerQuery.includes('after') && lowerQuery.includes('food')) {
      return "Taking medicine after food is often recommended when:\n\n• The medicine may irritate your stomach\n• Food helps with absorption\n• To reduce nausea or stomach upset\n\nCommon examples include pain relievers like ibuprofen and some vitamins. Always follow your prescription instructions!";
    }

    if (lowerQuery.includes('water') || lowerQuery.includes('drink')) {
      return "**General guidelines for taking medicine with liquids:**\n\n• 💧 **Water** is safest for most medicines\n• 🥛 **Milk** can interfere with some antibiotics\n• ☕ **Avoid caffeine** with stimulant medications\n• 🍊 **Grapefruit juice** interacts with many medicines\n• 🍷 **Alcohol** should be avoided with most medications\n\nAlways take medicines with at least a full glass of water unless directed otherwise.";
    }

    if (lowerQuery.includes('avoid') || lowerQuery.includes('food')) {
      return "**Common food-drug interactions to avoid:**\n\n• Dairy products with certain antibiotics\n• Grapefruit with cholesterol medications\n• Leafy greens (vitamin K) with blood thinners\n• Alcohol with pain relievers and sedatives\n• Tyramine-rich foods with MAOIs\n\nAsk about your specific medication for personalized advice!";
    }

    if (lowerQuery.includes('morning') || lowerQuery.includes('night') || lowerQuery.includes('timing')) {
      return "**When to take your medicine matters!**\n\n☀️ **Morning medications:**\n• Thyroid medicines (on empty stomach)\n• Diuretics (to avoid nighttime bathroom trips)\n• Some antidepressants\n\n🌙 **Evening/Night medications:**\n• Cholesterol medications (statins)\n• Blood pressure medicines\n• Sleep aids\n\nConsistency is key - take your medicine at the same time daily!";
    }

    if (lowerQuery.includes('help') || lowerQuery.includes('what can you')) {
      return "I can help you with:\n\n• 💊 Medicine intake timing (before/after food)\n• 🥤 What to drink with medications\n• 🍎 Foods to avoid\n• ⏰ Dosage timing recommendations\n• ⚠️ General precautions\n\nJust ask about any medicine in our database or general medication questions!";
    }

    return "I'm not sure about that specific question. Try asking about:\n\n• A specific medicine name (e.g., 'Tell me about Paracetamol')\n• When to take medicine (before/after food)\n• What to drink with medications\n• Foods to avoid with medicines\n• Dosage timing\n\nI'm here to help with medicine-related questions!";
  };

  // ===== SEND MESSAGE =====
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsTyping(true);

    let responseText: string;

    if (geminiEnabled) {
      // Build conversation history from recent messages (last 10)
      const history = messages
        .slice(-10)
        .map(m => ({
          role: (m.isBot ? "model" : "user") as "user" | "model",
          text: m.content,
        }));

      // Enrich with medicine data if a medicine name is mentioned
      let enrichedInput = currentInput;
      const medicineInfo = findMedicineInfo(currentInput);
      if (medicineInfo) {
        enrichedInput = `${currentInput}\n\n[SYSTEM CONTEXT - The following medicine exists in our database:\n${medicineInfo}]\nUse the above data to give an informed response.`;
      }

      const result = await askGemini(enrichedInput, history);

      if (result.error) {
        // Fallback to keyword-based
        console.warn("Gemini error, falling back:", result.error);
        if (result.error === "quota_exceeded") {
          responseText = "⚠️ **AI quota temporarily exceeded.** Using offline mode.\n\n" + generateKeywordResponse(currentInput);
        } else {
          responseText = generateKeywordResponse(currentInput);
        }
      } else {
        responseText = result.text;
      }
    } else {
      // Keyword fallback
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 800));
      responseText = generateKeywordResponse(currentInput);
    }

    const botMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: responseText,
      isBot: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, botMessage]);
    setIsTyping(false);
  };

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg z-50",
          "bg-primary hover:bg-primary/90 text-primary-foreground",
          isOpen && "bg-destructive hover:bg-destructive/90"
        )}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 w-96 h-[500px] flex flex-col shadow-xl z-50 border-2 overflow-hidden">
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-foreground/20 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold flex items-center gap-1.5">
                MediCare AI
                {geminiEnabled && <Sparkles className="w-4 h-4 text-yellow-300" />}
              </h3>
              <p className="text-xs opacity-80">
                {geminiEnabled ? "Powered by Gemini AI" : "Medicine guidance chatbot"}
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-warning/10 border-b border-warning/20 px-4 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-warning-foreground/80">
              General info only. Consult your doctor for medical advice.
            </p>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2",
                    message.isBot ? "justify-start" : "justify-end"
                  )}
                >
                  {message.isBot && (
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-4 py-2 text-sm",
                      message.isBot
                        ? "bg-muted text-foreground"
                        : "bg-primary text-primary-foreground"
                    )}
                  >
                    {message.isBot ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                  </div>
                  {!message.isBot && (
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-2 justify-start">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={geminiEnabled ? "Ask anything about medicines..." : "Ask about a medicine..."}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={!input.trim() || isTyping}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </Card>
      )}
    </>
  );
};

export default MedicineChatbot;
