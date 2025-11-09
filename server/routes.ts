import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { generatePrediction } from "./prediction";
import { type TradingPair, tradingPairs } from "@shared/schema";
import { verifyWhopToken, checkExperienceAccess } from "./lib/auth";
import { isWhopEnabled, whopSdk } from "./lib/whop-sdk";

interface ClientMessage {
  type: "user_message" | "select_pair" | "history" | "new_session";
  content?: string;
  pair?: TradingPair;
  userId?: string;
}

interface ServerMessage {
  type: "bot_message" | "typing" | "prediction" | "insufficient_credits" | "credits_update";
  content: string;
  prediction?: {
    pair: TradingPair;
    direction: "UP" | "DOWN" | "NEUTRAL";
    confidence: number;
    duration: string;
    analysis?: string;
  };
  credits?: number;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  app.get("/api/auth/verify", async (req, res) => {
    const user = await verifyWhopToken(req);
    
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    return res.json({ user });
  });

  app.get("/api/auth/me", async (req, res) => {
    // In development mode without Whop, return mock user data
    if (process.env.NODE_ENV === "development" && !isWhopEnabled) {
      return res.json({
        id: "dev_user",
        username: "developer",
        name: "Developer",
        profile_pic_url: null,
      });
    }

    // If Whop is not enabled, return null
    if (!isWhopEnabled) {
      return res.json(null);
    }

    try {
      // Verify the user token first
      const user = await verifyWhopToken(req);
      
      // In development, if no user token, return mock data
      if (!user && process.env.NODE_ENV === "development") {
        return res.json({
          id: "dev_user",
          username: "developer",
          name: "Developer",
          profile_pic_url: null,
        });
      }

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check if whopSdk is available
      if (!whopSdk) {
        return res.status(500).json({ error: "Whop SDK not initialized" });
      }

      // Fetch user details from Whop
      const userDetails = await whopSdk.users.retrieve(user.userId);
      
      // Extract profile picture URL from Whop API response
      // Whop can return profile_picture in different formats, so we handle multiple cases
      let profilePicUrl: string | null = null;
      
      if (userDetails.profile_picture) {
        if (typeof userDetails.profile_picture === 'string') {
          profilePicUrl = userDetails.profile_picture;
        } else if (typeof userDetails.profile_picture === 'object') {
          const picObj = userDetails.profile_picture as any;
          profilePicUrl = picObj.url || picObj.image_url || null;
        }
      }
      
      console.log("[Whop Auth] Profile picture URL extracted:", profilePicUrl);
      
      // Save/update user in database
      await storage.upsertUser({
        id: userDetails.id,
        username: userDetails.username,
        name: userDetails.name || userDetails.username,
        profilePictureUrl: profilePicUrl,
      });
      
      return res.json({
        id: userDetails.id,
        username: userDetails.username,
        name: userDetails.name || userDetails.username,
        profile_pic_url: profilePicUrl,
      });
    } catch (error) {
      console.error("Error fetching user details:", error);
      // In development, return mock data on error
      if (process.env.NODE_ENV === "development") {
        return res.json({
          id: "dev_user",
          username: "developer",
          name: "Developer",
          profile_pic_url: null,
        });
      }
      return res.status(500).json({ error: "Failed to fetch user details" });
    }
  });

  app.post("/api/auth/check-access", async (req, res) => {
    const { experienceId } = req.body;

    // If Whop is not enabled, allow access in standalone mode
    if (!isWhopEnabled) {
      return res.json({ 
        hasAccess: true,
        accessLevel: "customer",
      });
    }

    // If no experienceId is provided, allow access (root route)
    if (!experienceId) {
      return res.json({
        hasAccess: true,
        accessLevel: "customer",
      });
    }

    // Verify the Whop token
    const user = await verifyWhopToken(req);
    
    if (!user) {
      return res.status(401).json({ 
        error: "Unauthorized - valid Whop authentication required. Please access this app through Whop." 
      });
    }

    // Verify user has access to the experience
    const access = await checkExperienceAccess(user.userId, experienceId);
    
    return res.json({ 
      hasAccess: access.hasAccess,
      accessLevel: access.accessLevel,
    });
  });

  app.get("/api/credits", async (req, res) => {
    try {
      let userId = "dev_user";
      
      if (isWhopEnabled) {
        const user = await verifyWhopToken(req);
        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        userId = user.userId;
      }

      let userCredits = await storage.getUserCredits(userId);
      
      if (!userCredits) {
        await storage.setUserCredits(userId, 10);
        userCredits = await storage.getUserCredits(userId);
      }

      // If user has unlimited access and Whop is enabled, verify the membership is still active
      if (userCredits?.hasUnlimitedAccess && isWhopEnabled && whopSdk) {
        const planId = process.env.WHOP_PLAN_ID;
        const companyId = process.env.WHOP_COMPANY_ID;
        
        if (planId && companyId) {
          try {
            // Check if user has an active membership
            const memberships = [];
            for await (const membership of whopSdk.memberships.list({
              company_id: companyId,
              user_ids: [userId],
              plan_ids: [planId],
              statuses: ["active", "trialing", "past_due"]
            })) {
              memberships.push(membership);
            }

            // If no active membership found, revoke unlimited access
            if (memberships.length === 0) {
              console.log(`[Credits] No active membership found for user ${userId}, revoking unlimited access`);
              await storage.revokeUnlimitedAccess(userId);
              userCredits = await storage.getUserCredits(userId);
            }
          } catch (error) {
            console.error("[Credits] Error checking membership status:", error);
            // Continue with current credits on error to avoid disrupting user experience
          }
        }
      }

      return res.json(userCredits);
    } catch (error) {
      console.error("Error fetching credits:", error);
      return res.status(500).json({ error: "Failed to fetch credits" });
    }
  });

  app.get("/api/credits/plan-id", async (req, res) => {
    const planId = process.env.WHOP_PLAN_ID;
    if (!planId) {
      return res.status(500).json({ error: "Plan ID not configured" });
    }
    return res.json({ planId });
  });

  app.get("/api/subscription/manage-url", async (req, res) => {
    try {
      if (!isWhopEnabled || !whopSdk) {
        return res.status(404).json({ error: "Whop integration not enabled" });
      }

      const user = await verifyWhopToken(req);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get the plan ID to filter memberships
      const planId = process.env.WHOP_PLAN_ID;
      if (!planId) {
        return res.status(500).json({ error: "Plan ID not configured" });
      }

      // Get the company ID
      const companyId = process.env.WHOP_COMPANY_ID;
      if (!companyId) {
        return res.status(500).json({ error: "Company ID not configured" });
      }

      // List memberships for this user filtered by plan ID and company ID
      const memberships = [];
      for await (const membership of whopSdk.memberships.list({
        company_id: companyId,
        user_ids: [user.userId],
        plan_ids: [planId],
        statuses: ["active", "trialing", "past_due"]
      })) {
        memberships.push(membership);
      }

      // Get the first active membership (should only be one)
      const activeMembership = memberships[0];
      
      if (!activeMembership || !activeMembership.manage_url) {
        return res.status(404).json({ error: "No active subscription found" });
      }

      return res.json({ 
        manageUrl: activeMembership.manage_url,
        status: activeMembership.status
      });
    } catch (error) {
      console.error("Error fetching subscription manage URL:", error);
      return res.status(500).json({ error: "Failed to fetch subscription details" });
    }
  });

  app.post("/api/credits/purchase", async (req, res) => {
    try {
      const { success } = req.body;

      let userId = "dev_user";
      
      if (isWhopEnabled) {
        const user = await verifyWhopToken(req);
        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        userId = user.userId;
      }

      if (success) {
        // Grant unlimited access instead of adding credits
        await storage.grantUnlimitedAccess(userId);
        const updatedCredits = await storage.getUserCredits(userId);
        return res.json({ 
          success: true, 
          credits: updatedCredits 
        });
      } else {
        return res.json({ 
          success: false, 
          error: "Payment failed" 
        });
      }
    } catch (error) {
      console.error("Error processing purchase:", error);
      return res.status(500).json({ error: "Failed to process purchase" });
    }
  });

  // WebSocket server on distinct path to avoid conflicts with Vite HMR
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('Client connected');

    // Store prediction history for this session
    const predictionHistory: Array<{
      pair: TradingPair;
      direction: "UP" | "DOWN" | "NEUTRAL";
      confidence: number;
      timestamp: Date;
    }> = [];

    // Don't send welcome message automatically on connection
    // User will see the welcome when they click "New Session" or on first visit

    ws.on('message', (data) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());

        if (message.type === 'select_pair' && message.pair) {
          const userId = message.userId || "dev_user";
          handlePairSelection(ws, message.pair, predictionHistory, userId);
        } else if (message.type === 'user_message' && message.content) {
          const userId = message.userId || "dev_user";
          handleUserMessage(ws, message.content, predictionHistory, userId);
        } else if (message.type === 'history') {
          handleHistory(ws, predictionHistory);
        } else if (message.type === 'new_session') {
          handleNewSession(ws, predictionHistory);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });

  async function handlePairSelection(
    ws: WebSocket,
    pair: TradingPair,
    history: Array<any>,
    userId: string
  ) {
    if (ws.readyState !== WebSocket.OPEN) return;

    try {
      let userCredits = await storage.getUserCredits(userId);
      
      if (!userCredits) {
        await storage.setUserCredits(userId, 10);
        userCredits = await storage.getUserCredits(userId);
      }

      if (!userCredits) {
        console.error("Failed to initialize user credits");
        return;
      }

      // Check if user has credits (but don't deduct yet - only check)
      if (!userCredits.hasUnlimitedAccess) {
        if (userCredits.credits <= 0) {
          const insufficientMsg: ServerMessage = {
            type: "insufficient_credits",
            content: "You've run out of analysis credits! Purchase more to continue analyzing crypto pairs.",
            credits: 0,
          };
          ws.send(JSON.stringify(insufficientMsg));
          return;
        }
      }

      // Step 1: Show initial thinking
      const thinkingMsg: ServerMessage = {
        type: "bot_message",
        content: `Analyzing ${pair}...`,
      };
      ws.send(JSON.stringify(thinkingMsg));
      
      // Small delay before showing typing indicator
      await new Promise(resolve => setTimeout(resolve, 600));
      
      if (ws.readyState !== WebSocket.OPEN) return;
      
      // Step 2: Show typing indicator while analyzing
      const typingMsg: ServerMessage = {
        type: "typing",
        content: "",
      };
      ws.send(JSON.stringify(typingMsg));
      
      // Step 3: Fetch and analyze real market data (this takes time)
      const startTime = Date.now();
      const prediction = await generatePrediction(pair);
      const analysisTime = Date.now() - startTime;
      
      // Ensure minimum analysis time of 2 seconds for credibility
      const minAnalysisTime = 2000;
      if (analysisTime < minAnalysisTime) {
        await new Promise(resolve => setTimeout(resolve, minAnalysisTime - analysisTime));
      }
      
      if (ws.readyState !== WebSocket.OPEN) return;

      // Only deduct credits if we got an actionable prediction (UP or DOWN, not NEUTRAL)
      const isActionablePrediction = prediction.direction !== "NEUTRAL";
      
      if (isActionablePrediction && !userCredits.hasUnlimitedAccess) {
        const success = await storage.decrementUserCredits(userId);
        
        if (!success) {
          // This shouldn't happen since we checked earlier, but handle it just in case
          const insufficientMsg: ServerMessage = {
            type: "insufficient_credits",
            content: "You've run out of analysis credits! Purchase more to continue analyzing crypto pairs.",
            credits: 0,
          };
          ws.send(JSON.stringify(insufficientMsg));
          return;
        }
      }
      
      // Store in history
      history.push({
        pair: prediction.pair,
        direction: prediction.direction,
        confidence: prediction.confidence,
        timestamp: new Date(),
      });

      // Send prediction with comprehensive analysis
      const predictionMsg: ServerMessage = {
        type: "prediction",
        content: prediction.analysis || `Analysis complete for ${pair}`,
        prediction,
      };
      ws.send(JSON.stringify(predictionMsg));

      // Send updated credits count
      const updatedCredits = await storage.getUserCredits(userId);
      if (updatedCredits) {
        const creditsUpdateMsg: ServerMessage = {
          type: "credits_update",
          content: "",
          credits: updatedCredits.credits,
        };
        ws.send(JSON.stringify(creditsUpdateMsg));
      }

      // Inform user about credit status based on prediction type
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        
        let followUpContent: string;
        
        if (!isActionablePrediction) {
          // NEUTRAL prediction - no credits consumed
          followUpContent = "No credits consumed for this analysis. Market conditions didn't meet our confidence threshold. Try another pair!";
        } else {
          // Actionable prediction - credits were deducted
          followUpContent = "Want another prediction? Pick a different pair below.";
        }
        
        const followUpMsg: ServerMessage = {
          type: "bot_message",
          content: followUpContent,
        };
        ws.send(JSON.stringify(followUpMsg));
      }, 1000);
    } catch (error) {
      console.error("Error generating prediction:", error);
      
      if (ws.readyState !== WebSocket.OPEN) return;
      
      const errorMsg: ServerMessage = {
        type: "bot_message",
        content: "Market data service is temporarily unavailable. Please try again in a moment.",
      };
      ws.send(JSON.stringify(errorMsg));
    }
  }

  function handleUserMessage(
    ws: WebSocket,
    content: string,
    history: Array<any>,
    userId: string
  ) {
    if (ws.readyState !== WebSocket.OPEN) return;

    // Check for /history command
    if (content.toLowerCase() === "/history") {
      handleHistory(ws, history);
      return;
    }

    // Try to match trading pair (crypto or forex)
    const upperContent = content.toUpperCase().replace(/\s/g, "");
    const matchedPair = tradingPairs.find(
      (pair) => upperContent.includes(pair.replace("/", ""))
    );

    if (matchedPair) {
      handlePairSelection(ws, matchedPair, history, userId);
    } else {
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        
        const helpMsg: ServerMessage = {
          type: "bot_message",
          content: "I can help you with crypto and forex predictions! Try selecting a pair like BTC/USDT, EUR/USD, or use the quick select buttons below.",
        };
        ws.send(JSON.stringify(helpMsg));
      }, 500);
    }
  }

  function handleHistory(ws: WebSocket, history: Array<any>) {
    if (ws.readyState !== WebSocket.OPEN) return;

    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) return;

      if (history.length === 0) {
        const noHistoryMsg: ServerMessage = {
          type: "bot_message",
          content: "No prediction history yet. Try selecting a crypto pair to get started!",
        };
        ws.send(JSON.stringify(noHistoryMsg));
        return;
      }

      const recent = history.slice(-5);
      let historyText = `Last ${recent.length} Predictions:\n\n`;
      recent.forEach((pred, idx) => {
        const directionLabel = pred.direction === "NEUTRAL" ? "NEUTRAL" : pred.direction;
        historyText += `${idx + 1}. ${pred.pair} - ${directionLabel} (${pred.confidence}%)\n`;
      });

      const historyMsg: ServerMessage = {
        type: "bot_message",
        content: historyText,
      };
      ws.send(JSON.stringify(historyMsg));
    }, 500);
  }

  function handleNewSession(ws: WebSocket, history: Array<any>) {
    if (ws.readyState !== WebSocket.OPEN) return;

    // Clear prediction history
    history.length = 0;

    // Send welcome message
    const welcomeMsg: ServerMessage = {
      type: "bot_message",
      content: "Welcome to SignalixAI! I provide real-time crypto and forex predictions powered by AI analysis. Simply pick a trading pair below to get started.",
    };
    ws.send(JSON.stringify(welcomeMsg));
  }

  return httpServer;
}
