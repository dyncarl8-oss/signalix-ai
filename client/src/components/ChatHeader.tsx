import { ArrowPathIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { purchaseCredits } from "@/lib/whop-payment";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ChatHeaderProps {
  onNewSession: () => void;
}

interface WhopUser {
  id: string;
  username: string;
  name: string;
  profile_pic_url?: string | null;
}

interface UserCredits {
  userId: string;
  credits: number;
  hasUnlimitedAccess: boolean;
}

export function ChatHeader({ onNewSession }: ChatHeaderProps) {
  const { toast } = useToast();
  
  const { data: user } = useQuery<WhopUser | null>({
    queryKey: ["/api/auth/me"],
  });

  const { data: credits, isLoading: creditsLoading } = useQuery<UserCredits>({
    queryKey: ["/api/credits"],
  });

  const { data: subscriptionData } = useQuery<{ manageUrl: string; status: string } | null>({
    queryKey: ["/api/subscription/manage-url"],
    enabled: credits?.hasUnlimitedAccess === true,
    retry: false,
  });

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
    },
    onError: () => {
      toast({
        title: "Purchase failed",
        description: "There was an error processing your purchase. Please try again.",
        variant: "destructive",
      });
    },
  });

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="flex items-center justify-between gap-2 md:gap-4 lg:gap-6 px-3 md:px-6 lg:px-12 xl:px-24 py-2.5 md:py-3 lg:py-4 w-full" data-testid="chat-header">
      <div className="flex items-center gap-2 md:gap-3 lg:gap-4 flex-1 min-w-0">
        <Avatar className="h-8 w-8 md:h-9 md:w-9 lg:h-10 lg:w-10 flex-shrink-0" data-testid="avatar-user">
          {user?.profile_pic_url && (
            <AvatarImage 
              src={user.profile_pic_url} 
              alt={user.name || "User"}
              onError={(e) => {
                console.error("[Avatar] Failed to load profile picture:", user.profile_pic_url);
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0 flex-1">
          <h2 className="text-sm md:text-base font-semibold truncate" data-testid="text-username">
            {user?.name || "SignalixAI"}
          </h2>
          {user?.username && (
            <p className="text-xs text-muted-foreground truncate hidden sm:block" data-testid="text-handle">
              @{user.username}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 md:gap-2 lg:gap-3 flex-shrink-0">
        {!creditsLoading && credits && (
          <div className="flex items-center gap-1.5 md:gap-2 lg:gap-3">
            <Badge variant="secondary" className="text-xs" data-testid="badge-credits">
              <SparklesIcon className="w-3 h-3 mr-1" />
              <span className="hidden xs:inline">{credits.hasUnlimitedAccess ? "∞ credits" : `${credits.credits} credits`}</span>
              <span className="xs:hidden">{credits.hasUnlimitedAccess ? "∞" : credits.credits}</span>
            </Badge>
            {!credits.hasUnlimitedAccess ? (
              <Button
                variant="default"
                size="sm"
                onClick={() => purchaseMutation.mutate()}
                disabled={purchaseMutation.isPending}
                className="text-xs lg:text-sm whitespace-nowrap"
                data-testid="button-buy-credits"
              >
                <span className="hidden sm:inline">{purchaseMutation.isPending ? "Processing..." : "Get Unlimited"}</span>
                <span className="sm:hidden">{purchaseMutation.isPending ? "..." : "Upgrade"}</span>
              </Button>
            ) : subscriptionData?.manageUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(subscriptionData.manageUrl, '_blank')}
                className="text-xs whitespace-nowrap hidden sm:inline-flex"
                data-testid="button-manage-subscription"
              >
                Manage
              </Button>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onNewSession}
          className="gap-1.5 md:gap-2"
          data-testid="button-new-session"
        >
          <ArrowPathIcon className="w-4 h-4" />
          <span className="hidden sm:inline">New Session</span>
        </Button>
      </div>
    </div>
  );
}
