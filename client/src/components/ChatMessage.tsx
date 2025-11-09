import { format } from "date-fns";
import { type Message } from "@shared/schema";
import { PredictionCard } from "./PredictionCard";
import { AnalysisLoadingIndicator } from "./AnalysisLoadingIndicator";

interface ChatMessageProps {
  message: Message;
  isAnalyzing?: boolean;
}

export function ChatMessage({ message, isAnalyzing = false }: ChatMessageProps) {
  const isBot = message.sender === "bot";

  return (
    <div
      className={`flex gap-2 md:gap-3 lg:gap-4 ${isBot ? "justify-start" : "justify-end"}`}
      data-testid={`message-${message.sender}-${message.id}`}
    >
      {isBot && (
        <div className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs md:text-sm">
          S
        </div>
      )}
      
      <div className={`flex flex-col gap-1 ${isBot ? "max-w-[85%] sm:max-w-[75%] lg:max-w-[70%]" : "max-w-[90%] sm:max-w-[85%] lg:max-w-[75%]"}`}>
        {isBot && (
          <div className="text-xs font-semibold uppercase text-primary">
            SignalixAI
          </div>
        )}
        
        <div
          className={`rounded-lg p-2.5 md:p-3 lg:p-4 ${
            isBot
              ? "bg-card border border-card-border"
              : "bg-primary text-primary-foreground"
          }`}
        >
          <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
          
          {isAnalyzing && (
            <div className="mt-3 md:mt-4 pt-3 border-t border-border">
              <AnalysisLoadingIndicator />
            </div>
          )}
          
          {message.prediction && (
            <div className="mt-2.5 md:mt-3">
              <PredictionCard prediction={message.prediction} />
            </div>
          )}
        </div>
        
        <div className="text-xs font-mono text-muted-foreground px-1">
          {format(message.timestamp, "HH:mm")}
        </div>
      </div>
    </div>
  );
}
