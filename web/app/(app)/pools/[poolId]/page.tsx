"use client";

import { useParams } from "next/navigation";
import { PoolDetailView } from "@/components/pools/PoolDetailView";

export default function PoolDetailPage() {
  const { poolId } = useParams<{ poolId: string }>();
  return <PoolDetailView poolId={poolId} />;
}
