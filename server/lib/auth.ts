import { Request } from "express";
import { whopSdk, isWhopEnabled } from "./whop-sdk";

export interface WhopUser {
  userId: string;
  experienceId?: string;
  companyId?: string;
}

export async function verifyWhopToken(req: Request): Promise<WhopUser | null> {
  if (!isWhopEnabled || !whopSdk) {
    console.warn("Whop SDK not configured - skipping authentication");
    return null;
  }

  try {
    const token = req.headers["x-whop-user-token"] as string;
    
    if (!token) {
      console.warn("[Whop Auth] No x-whop-user-token header found in request");
      return null;
    }

    console.log("[Whop Auth] Found token, verifying...");
    // Pass the token string directly to the SDK
    // The SDK expects a string, Headers, or Request object, not Express req.headers
    const { userId } = await whopSdk.verifyUserToken(token);
    console.log("[Whop Auth] Successfully verified Whop user:", userId);
    
    return {
      userId,
    };
  } catch (error) {
    console.error("[Whop Auth] Error verifying Whop token:", error);
    if (error instanceof Error) {
      console.error("[Whop Auth] Error message:", error.message);
    }
    
    // If token verification fails, return null so the caller can decide how to handle it
    return null;
  }
}

export async function checkExperienceAccess(
  userId: string,
  experienceId: string
): Promise<{ hasAccess: boolean; accessLevel?: "customer" | "admin" }> {
  if (!isWhopEnabled || !whopSdk) {
    console.warn("Whop SDK not configured - allowing access in standalone mode");
    return { hasAccess: true, accessLevel: "customer" };
  }

  try {
    const access = await whopSdk.users.checkAccess(experienceId, { id: userId });
    
    return {
      hasAccess: access.has_access,
      accessLevel: access.access_level as "customer" | "admin",
    };
  } catch (error) {
    console.error("Error checking experience access:", error);
    return { hasAccess: false };
  }
}

export async function checkCompanyAccess(
  userId: string,
  companyId: string
): Promise<{ hasAccess: boolean; accessLevel?: "customer" | "admin" }> {
  if (!isWhopEnabled || !whopSdk) {
    console.warn("Whop SDK not configured - allowing access in standalone mode");
    return { hasAccess: true, accessLevel: "admin" };
  }

  try {
    const access = await whopSdk.users.checkAccess(companyId, { id: userId });
    
    return {
      hasAccess: access.has_access,
      accessLevel: access.access_level as "customer" | "admin",
    };
  } catch (error) {
    console.error("Error checking company access:", error);
    return { hasAccess: false };
  }
}
