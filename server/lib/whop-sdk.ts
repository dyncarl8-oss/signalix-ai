import Whop from "@whop/sdk";

const hasWhopConfig = process.env.WHOP_API_KEY && process.env.WHOP_APP_ID;

if (!hasWhopConfig) {
  console.warn("⚠️  Whop integration disabled: WHOP_API_KEY and WHOP_APP_ID not configured");
  console.warn("   App will run in standalone mode without Whop authentication");
}

export const whopSdk = hasWhopConfig 
  ? new Whop({
      apiKey: process.env.WHOP_API_KEY,
      appID: process.env.WHOP_APP_ID,
    })
  : null;

export const isWhopEnabled = hasWhopConfig;
