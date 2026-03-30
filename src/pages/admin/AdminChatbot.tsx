import AdminSidebar from "@/components/layout/AdminSidebar";
import MedicineChatbot from "@/components/chatbot/MedicineChatbot";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STORAGE_KEYS, Medicine, chatbotKnowledge } from "@/lib/data";
import { Bot, Pill, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const AdminChatbot = () => {
  return (
    <div className="min-h-screen bg-background m-5">
      <AdminSidebar />
      <main className={cn("transition-all pt-16 lg:pt-0 lg:pl-64", "p-8")}>
        <div className="max-w-4xl mx-auto text-center py-20">
          <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bot className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Interactive Chatbot Verification
          </h1>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            Use the chatbot widget in the bottom-right corner to test and verify AI responses.
            <br />
            This ensures accurate information delivery to patients.
          </p>

          <div className="grid gap-4 md:grid-cols-3 text-left max-w-3xl mx-auto mt-12">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Medicine Info</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Ask about dosage, timing, and side effects of specific medicines.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Interactions</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Verify warnings about food interactions (e.g., grapefruit, dairy).
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">General Health</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Test general wellness advice and fallback responses.
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* The Chatbot Widget */}
      <MedicineChatbot />
    </div>
  );
};

export default AdminChatbot;
