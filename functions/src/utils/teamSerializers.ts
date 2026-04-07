import type { DocumentSnapshot } from "firebase-admin/firestore";
import { db } from "../config/firebase";

export interface PlayerDetailResponse {
  id: string;
  name: string;
  odds: string;
  espnMapped: boolean;
}

export function serializePlayerDetail(
  playerDoc: DocumentSnapshot,
): PlayerDetailResponse | null {
  if (!playerDoc.exists) {
    return null;
  }

  const player = playerDoc.data();
  if (!player) {
    return null;
  }

  return {
    id: playerDoc.id,
    name: player.name,
    odds: player.odds,
    espnMapped: player.espnMapped === true,
  };
}

export async function loadOwnerNames(
  userIds: string[],
): Promise<Map<string, string>> {
  const uniqueUserIds = [...new Set(userIds)];
  const userDocs = await Promise.all(
    uniqueUserIds.map((userId) => db.collection("users").doc(userId).get()),
  );

  const ownerNameByUserId = new Map<string, string>();
  userDocs.forEach((userDoc) => {
    if (!userDoc.exists) {
      return;
    }

    const user = userDoc.data();
    if (!user) {
      return;
    }

    ownerNameByUserId.set(
      userDoc.id,
      user.displayName || user.realName || "Unknown player",
    );
  });

  return ownerNameByUserId;
}
