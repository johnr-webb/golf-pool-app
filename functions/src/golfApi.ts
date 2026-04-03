import axios from 'axios';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'golf-leaderboard-data.p.rapidapi.com';

export interface GolferScoreData {
  golferId: string;
  name: string;
  score: number;
  thru: number;
  status: 'active' | 'cut' | 'finished' | 'withdrawn' | 'dns';
  position: number;
}

export interface TournamentData {
  tournamentId: string;
  name: string;
  status: 'pre' | 'live' | 'post';
  round: number;
}

const GOLFER_ID_MAP: Record<string, string> = {
  'Scottie Scheffler': '1',
  'Rory McIlroy': '2',
  'Jon Rahm': '3',
  'Brooks Koepka': '4',
  'Bryson DeChambeau': '5',
  'Xander Schauffele': '6',
  'Viktor Hovland': '7',
  'Collin Morikawa': '8',
  'Ludvig Aberg': '9',
  'Tyrrell Hatton': '10',
  'Dustin Johnson': '11',
  'Cameron Smith': '12',
  'Jordan Spieth': '13',
  'Tommy Fleetwood': '14',
  'Rickie Fowler': '15',
  'Patrick Cantlay': '16',
  'Justin Thomas': '17',
  'Sahith Theegala': '18',
  'Hideki Matsuyama': '19',
  'Matt Fitzpatrick': '20',
  'Max Homa': '21',
  'Tony Finau': '22',
};

function mapStatus(apiStatus: string): GolferScoreData['status'] {
  const status = apiStatus.toLowerCase();
  if (status.includes('cut')) return 'cut';
  if (status.includes('wd') || status.includes('withdrawn')) return 'withdrawn';
  if (status.includes('dns')) return 'dns';
  if (status === 'f' || status === 'finished') return 'finished';
  return 'active';
}

export async function fetchLiveScores(tournamentId?: string): Promise<{
  tournament: TournamentData;
  scores: GolferScoreData[];
}> {
  const targetTournament = tournamentId || 'masters-2025';

  if (!RAPIDAPI_KEY) {
    console.log('No RapidAPI key found, using mock data');
    return generateMockData(targetTournament);
  }

  try {
    const response = await axios.get(
      `https://${RAPIDAPI_HOST}/tournament/${targetTournament}/leaderboard`,
      {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
        timeout: 10000,
      }
    );

    const data = response.data;
    const tournament = data.tournament || {};
    const players = data.leaderboard?.players || [];

    const scores: GolferScoreData[] = players.map((player: any) => ({
      golferId: GOLFER_ID_MAP[player.player_name] || player.player_id?.toString(),
      name: player.player_name,
      score: player.score !== undefined ? parseInt(player.score) : 0,
      thru: player.thru || 0,
      status: mapStatus(player.status || ''),
      position: player.position || 0,
    }));

    return {
      tournament: {
        tournamentId: targetTournament,
        name: tournament.name || 'Tournament',
        status: tournament.status === 'IN_PROGRESS' ? 'live' : 
                tournament.status === 'COMPLETED' ? 'post' : 'pre',
        round: tournament.round || 1,
      },
      scores,
    };
  } catch (error: any) {
    console.error('Error fetching from API:', error.message);
    return generateMockData(targetTournament);
  }
}

function generateMockData(tournamentId: string): {
  tournament: TournamentData;
  scores: GolferScoreData[];
} {
  const mockGolfers = [
    { name: 'Scottie Scheffler', id: '1' },
    { name: 'Rory McIlroy', id: '2' },
    { name: 'Jon Rahm', id: '3' },
    { name: 'Brooks Koepka', id: '4' },
    { name: 'Bryson DeChambeau', id: '5' },
    { name: 'Xander Schauffele', id: '6' },
    { name: 'Viktor Hovland', id: '7' },
    { name: 'Collin Morikawa', id: '8' },
    { name: 'Ludvig Aberg', id: '9' },
    { name: 'Tyrrell Hatton', id: '10' },
    { name: 'Dustin Johnson', id: '11' },
    { name: 'Cameron Smith', id: '12' },
    { name: 'Jordan Spieth', id: '13' },
    { name: 'Tommy Fleetwood', id: '14' },
    { name: 'Rickie Fowler', id: '15' },
    { name: 'Patrick Cantlay', id: '16' },
    { name: 'Justin Thomas', id: '17' },
    { name: 'Sahith Theegala', id: '18' },
    { name: 'Hideki Matsuyama', id: '19' },
    { name: 'Matt Fitzpatrick', id: '20' },
    { name: 'Max Homa', id: '21' },
    { name: 'Tony Finau', id: '22' },
  ];

  const scores: GolferScoreData[] = mockGolfers.map((golfer, index) => {
    const isActive = Math.random() > 0.15;
    const isCut = !isActive && Math.random() > 0.3;
    const score = Math.floor(Math.random() * 18) - 4;

    return {
      golferId: golfer.id,
      name: golfer.name,
      score,
      thru: isActive ? Math.floor(Math.random() * 18) + 1 : isCut ? Math.floor(Math.random() * 14) + 1 : 18,
      status: isActive ? 'active' : isCut ? 'cut' : 'finished',
      position: isActive ? index + 1 : Math.floor(Math.random() * 100) + 20,
    };
  });

  scores.sort((a, b) => a.position - b.position);

  return {
    tournament: {
      tournamentId,
      name: 'Masters Tournament',
      status: 'live',
      round: 2,
    },
    scores,
  };
}
