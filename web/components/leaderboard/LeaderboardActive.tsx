"use client";

import { Accordion, Stack } from "@mantine/core";
import { useAuth } from "@/lib/auth/AuthProvider";
import { EmptyState } from "@/components/common/EmptyState";
import type {
  EspnEventStatus,
  LeaderboardEntry,
  ScoreboardLeader,
  TournamentStatus,
} from "@/lib/types/api";
import { LeaderboardHero } from "./LeaderboardHero";
import { LeadersTicker } from "./LeadersTicker";
import { TeamLeaderCard } from "./TeamLeaderCard";

interface Props {
  entries: LeaderboardEntry[];
  status: Exclude<TournamentStatus, "upcoming">;
  tournamentName: string;
  eventStatus: EspnEventStatus | null;
  leaders: ScoreboardLeader[];
}

export function LeaderboardActive({
  entries,
  status,
  tournamentName,
  eventStatus,
  leaders,
}: Props) {
  const { user } = useAuth();

  const myIndex = user
    ? entries.findIndex((e) => e.userId === user.uid)
    : -1;
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const myScore = myIndex >= 0 ? entries[myIndex].totalScore : null;

  return (
    <Stack gap="md">
      <LeaderboardHero
        tournamentName={tournamentName}
        status={status}
        eventStatus={eventStatus}
        myTeamRank={myRank}
        myTeamScore={myScore}
        teamCount={entries.length}
      />

      <LeadersTicker leaders={leaders} />

      {entries.length === 0 ? (
        <EmptyState
          title="No teams to score yet."
          description="Scores will appear here once teams are in and the tournament is underway."
        />
      ) : (
        <Accordion multiple variant="separated" radius="md">
          {entries.map((entry, idx) => (
            <TeamLeaderCard
              key={entry.teamId}
              entry={entry}
              rank={idx + 1}
              isMine={!!user && entry.userId === user.uid}
            />
          ))}
        </Accordion>
      )}
    </Stack>
  );
}
