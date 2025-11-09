import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { tradingPairs, type TradingPair } from "@shared/schema";

interface PairSelectorProps {
  onSelectPair: (pair: TradingPair) => void;
  selectedPair?: TradingPair;
}

export function PairSelector({ onSelectPair, selectedPair }: PairSelectorProps) {
  const cryptoPairs = tradingPairs.filter(p => p.includes('USDT'));
  const forexPairs = tradingPairs.filter(p => p.includes('USD') && !p.includes('USDT'));

  return (
    <div className="space-y-3 md:space-y-4" data-testid="pair-selector">
      <div className="space-y-2 md:space-y-3">
        <div className="text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-wide">Crypto</div>
        <div className="flex flex-wrap gap-2 md:gap-2.5 lg:gap-3">
          {cryptoPairs.map((pair) => (
            <Button
              key={pair}
              variant={selectedPair === pair ? "default" : "outline"}
              size="sm"
              onClick={() => onSelectPair(pair)}
              className="text-xs md:text-sm"
              data-testid={`button-pair-${pair.replace('/', '-')}`}
            >
              {pair}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2 md:space-y-3">
        <div className="text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-wide">Forex</div>
        <div className="flex flex-wrap gap-2 md:gap-2.5 lg:gap-3">
          {forexPairs.map((pair) => (
            <Button
              key={pair}
              variant={selectedPair === pair ? "default" : "outline"}
              size="sm"
              onClick={() => onSelectPair(pair)}
              className="text-xs md:text-sm"
              data-testid={`button-pair-${pair.replace('/', '-')}`}
            >
              {pair}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
