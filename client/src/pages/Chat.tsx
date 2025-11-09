import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { type Message, type TradingPair } from "@shared/schema";
import { ChatHeader } from "@/components/ChatHeader";
import { ChatMessage } from "@/components/ChatMessage";
import { PairSelector } from "@/components/PairSelector";
import { useWebSocket } from "@/lib/useWebSocket";
import { useWhopAuth } from "@/hooks/useWhopAuth";
import { useMutation } from "@tanstack/react-query";
import { purchaseCredits } from "@/lib/whop-payment";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [selectedPair, setSelectedPair] = useState<TradingPair | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const params = useParams<{ experienceId?: string }>();
  const experienceId = params.experienceId;
  const { isLoading, hasAccess, error } = useWhopAuth(experienceId);
  const { sendMessage, isConnected, messages: serverMessages, clearMessages } = useWebSocket(experienceId);
  const { toast } = useToast();

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const success = await purchaseCredits();
      if (!success) {
        throw new Error("Purchase failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      toast({
        title: "Welcome to Unlimited Access!",
        description: "You now have unlimited AI predictions. Analyze as many pairs as you want!",
      });
      setShowPurchaseDialog(false);
    },
    onError: () => {
      toast({
        title: "Purchase failed",
        description: "There was an error processing your purchase. Please try again.",
        variant: "destructive",
      });
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Send welcome message on first connection
  useEffect(() => {
    if (isConnected && messages.length === 0) {
      sendMessage({ type: "new_session" });
    }
  }, [isConnected]);

  // Process server messages
  useEffect(() => {
    if (serverMessages.length === 0) return;

    const latestMessage = serverMessages[serverMessages.length - 1];

    if (latestMessage.type === "typing") {
      setIsTyping(true);
      return;
    }

    if (latestMessage.type === "credits_update") {
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      return;
    }

    if (latestMessage.type === "insufficient_credits") {
      setIsTyping(false);
      setShowPurchaseDialog(true);
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      
      const newMessage: Message = {
        id: Date.now().toString() + Math.random(),
        sender: "bot",
        content: latestMessage.content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, newMessage]);
      return;
    }

    setIsTyping(false);

    const newMessage: Message = {
      id: Date.now().toString() + Math.random(),
      sender: "bot",
      content: latestMessage.content,
      timestamp: new Date(),
      prediction: latestMessage.prediction as Message["prediction"],
    };

    setMessages((prev) => [...prev, newMessage]);
  }, [serverMessages]);

  const handleNewSession = () => {
    setMessages([]);
    setIsTyping(false);
    setSelectedPair(undefined);
    clearMessages();
    sendMessage({ type: "new_session" });
  };

  const handleCryptoPairSelection = (pair: TradingPair) => {
    setSelectedPair(pair);
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      content: pair,
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    sendMessage({ type: "select_pair", pair });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background" data-testid="loading-page">
        <div className="text-center text-muted-foreground">
          Verifying access...
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background" data-testid="access-denied-page">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">
            {error || "You don't have access to this experience."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="chat-page">
      <header className="border-b border-border bg-background/95 backdrop-blur-sm">
        <ChatHeader onNewSession={handleNewSession} />
      </header>
      
      <div className="flex-1 overflow-y-auto px-3 md:px-6 lg:px-12 xl:px-24 py-4 md:py-6">
        <div className="space-y-3 md:space-y-4">
          {!isConnected && (
            <div className="text-center text-muted-foreground text-sm">
              Connecting to SignalixAI...
            </div>
          )}
          
          {messages.map((message, index) => {
            const isLastBotMessage = message.sender === "bot" && index === messages.length - 1;
            const showAnalyzing = isTyping && isLastBotMessage;
            const showPairSelector = message.sender === "bot" && 
                                    !message.prediction && 
                                    index === messages.length - 1;
            
            return (
              <div key={message.id}>
                <ChatMessage 
                  message={message} 
                  isAnalyzing={showAnalyzing}
                />
                {showPairSelector && !isTyping && (
                  <div className="mt-3 md:mt-4 ml-0 md:ml-12">
                    <PairSelector 
                      onSelectPair={handleCryptoPairSelection}
                      selectedPair={selectedPair}
                    />
                  </div>
                )}
              </div>
            );
          })}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      <AlertDialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg" data-testid="dialog-purchase-credits">
          <AlertDialogHeader>
            <AlertDialogTitle>Out of Credits</AlertDialogTitle>
            <AlertDialogDescription>
              You've used all your free analysis credits. Get unlimited access for $10/month to analyze as many crypto pairs as you want with no limits!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel data-testid="button-cancel-purchase">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => purchaseMutation.mutate()}
              disabled={purchaseMutation.isPending}
              data-testid="button-confirm-purchase"
            >
              {purchaseMutation.isPending ? "Processing..." : "Get Unlimited Access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
