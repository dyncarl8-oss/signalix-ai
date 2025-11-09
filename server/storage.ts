import { UserCredits } from "@shared/schema";
import { UserModel } from "./db";

export interface IStorage {
  getUserCredits(userId: string): Promise<UserCredits | undefined>;
  setUserCredits(userId: string, credits: number): Promise<void>;
  decrementUserCredits(userId: string): Promise<boolean>;
  incrementUserCredits(userId: string, amount: number): Promise<void>;
  grantUnlimitedAccess(userId: string): Promise<void>;
  revokeUnlimitedAccess(userId: string): Promise<void>;
  upsertUser(userData: { id: string; username: string; name: string; profilePictureUrl?: string | null }): Promise<void>;
}

export class MongoStorage implements IStorage {
  async getUserCredits(userId: string): Promise<UserCredits | undefined> {
    const user = await UserModel.findOne({ id: userId });
    if (!user) {
      return undefined;
    }
    return { 
      userId: user.id, 
      credits: user.credits,
      hasUnlimitedAccess: user.hasUnlimitedAccess || false
    };
  }

  async setUserCredits(userId: string, credits: number): Promise<void> {
    await UserModel.findOneAndUpdate(
      { id: userId },
      { 
        $set: { credits, updatedAt: new Date() },
        $setOnInsert: { 
          username: userId,
          name: userId,
          profilePictureUrl: null,
        }
      },
      { upsert: true, new: true }
    );
  }

  async decrementUserCredits(userId: string): Promise<boolean> {
    const user = await UserModel.findOne({ id: userId });
    if (!user) {
      return false;
    }
    
    // If user has unlimited access, always allow (don't decrement)
    if (user.hasUnlimitedAccess) {
      return true;
    }
    
    // Otherwise, check if they have credits
    if (user.credits <= 0) {
      return false;
    }
    
    user.credits -= 1;
    user.updatedAt = new Date();
    await user.save();
    return true;
  }

  async incrementUserCredits(userId: string, amount: number): Promise<void> {
    const user = await UserModel.findOne({ id: userId });
    if (user) {
      user.credits += amount;
      user.updatedAt = new Date();
      await user.save();
    } else {
      await UserModel.create({
        id: userId,
        username: "unknown",
        name: "Unknown User",
        credits: amount,
      });
    }
  }

  async grantUnlimitedAccess(userId: string): Promise<void> {
    await UserModel.findOneAndUpdate(
      { id: userId },
      { 
        $set: { 
          hasUnlimitedAccess: true,
          updatedAt: new Date() 
        }
      },
      { upsert: true, new: true }
    );
  }

  async revokeUnlimitedAccess(userId: string): Promise<void> {
    await UserModel.findOneAndUpdate(
      { id: userId },
      { 
        $set: { 
          hasUnlimitedAccess: false,
          updatedAt: new Date() 
        }
      },
      { upsert: true, new: true }
    );
  }

  async upsertUser(userData: { 
    id: string; 
    username: string; 
    name: string; 
    profilePictureUrl?: string | null 
  }): Promise<void> {
    await UserModel.findOneAndUpdate(
      { id: userData.id },
      {
        username: userData.username,
        name: userData.name,
        profilePictureUrl: userData.profilePictureUrl,
        updatedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

export const storage = new MongoStorage();
