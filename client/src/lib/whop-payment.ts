import { whopIframeSdk } from "./whop-iframe";

export async function purchaseCredits(): Promise<boolean> {
  if (!whopIframeSdk) {
    console.warn("Whop iframe SDK not available - simulating purchase in dev mode");
    
    try {
      const response = await fetch("/api/credits/purchase", {
        method: "POST",
        body: JSON.stringify({ success: true }),
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        throw new Error("Purchase request failed");
      }
      
      return true;
    } catch (error) {
      console.error("Error simulating purchase:", error);
      return false;
    }
  }

  try {
    const response = await fetch("/api/credits/plan-id");
    const { planId } = await response.json();
    
    if (!planId) {
      console.error("Plan ID not available from server");
      return false;
    }

    const result = await whopIframeSdk.inAppPurchase({
      planId: planId,
    });

    if (result.status === "ok") {
      console.log("Payment successful!");
      
      const purchaseResponse = await fetch("/api/credits/purchase", {
        method: "POST",
        body: JSON.stringify({ success: true }),
        headers: { "Content-Type": "application/json" },
      });
      
      if (!purchaseResponse.ok) {
        throw new Error("Failed to update credits after purchase");
      }
      
      return true;
    } else {
      console.log("Payment was not completed:", result.error);
      return false;
    }
  } catch (error) {
    console.error("Error during payment:", error);
    return false;
  }
}
