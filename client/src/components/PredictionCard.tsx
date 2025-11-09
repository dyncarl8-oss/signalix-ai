import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, MinusIcon } from "@heroicons/react/24/solid";
import { Badge } from "@/components/ui/badge";

interface PredictionCardProps {
  prediction: {
    pair: string;
    direction: "UP" | "DOWN" | "NEUTRAL";
    confidence: number;
    duration: string;
  };
}

export function PredictionCard({ prediction }: PredictionCardProps) {
  const isUp = prediction.direction === "UP";
  const isDown = prediction.direction === "DOWN";
  const isNeutral = prediction.direction === "NEUTRAL";

  return (
    <div
      className={`border rounded-lg p-2.5 md:p-3 space-y-2.5 md:space-y-3 ${
        isNeutral 
          ? "border-muted bg-muted/20" 
          : "border-accent bg-accent/20"
      }`}
      data-testid="prediction-card"
    >
      <div className="flex items-center gap-2">
        {isUp && (
          <ArrowTrendingUpIcon className="w-5 h-5 md:w-6 md:h-6 text-chart-2 flex-shrink-0" />
        )}
        {isDown && (
          <ArrowTrendingDownIcon className="w-5 h-5 md:w-6 md:h-6 text-destructive flex-shrink-0" />
        )}
        {isNeutral && (
          <MinusIcon className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-base md:text-lg font-bold truncate">
            {isNeutral ? "No Prediction" : `Prediction: ${prediction.direction}`}
          </div>
          <div className="text-xs text-muted-foreground">
            {isNeutral ? prediction.duration : `in the next ${prediction.duration}`}
          </div>
        </div>
      </div>

      <div className="space-y-1.5 md:space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Confidence:</span>
          <span className="text-sm font-mono font-bold text-chart-2">
            {prediction.confidence}%
          </span>
        </div>
        
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className={`h-full ${
              isNeutral ? "bg-muted-foreground" : "bg-chart-2"
            }`}
            style={{ width: `${prediction.confidence}%` }}
          />
        </div>
      </div>

      {!isNeutral && (
        <div className="flex flex-wrap gap-1.5 md:gap-2">
          <Badge variant="secondary" className="text-xs">
            {prediction.duration.toUpperCase()} duration
          </Badge>
          <Badge variant="outline" className="text-xs">
            Technical analysis
          </Badge>
        </div>
      )}
      {isNeutral && prediction.confidence > 0 && (
        <div className="flex flex-wrap gap-1.5 md:gap-2">
          <Badge variant="outline" className="text-xs">
            No clear trend - range-bound market
          </Badge>
        </div>
      )}
    </div>
  );
}
