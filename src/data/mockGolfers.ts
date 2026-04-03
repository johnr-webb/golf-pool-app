import type { Golfer } from '../types';

export const mockGolfers: Golfer[] = [
  // Favorites (odds < 20)
  { id: '1', name: 'Scottie Scheffler', bucket: 'favorite', odds: 650, worldRanking: 1, country: 'USA' },
  { id: '2', name: 'Rory McIlroy', bucket: 'favorite', odds: 800, worldRanking: 2, country: 'NIR' },
  { id: '3', name: 'Jon Rahm', bucket: 'favorite', odds: 1200, worldRanking: 3, country: 'ESP' },
  { id: '4', name: 'Brooks Koepka', bucket: 'favorite', odds: 1400, worldRanking: 5, country: 'USA' },
  { id: '5', name: 'Bryson DeChambeau', bucket: 'favorite', odds: 1600, worldRanking: 4, country: 'USA' },

  // Contenders (odds 20-50)
  { id: '6', name: 'Xander Schauffele', bucket: 'contender', odds: 2200, worldRanking: 6, country: 'USA' },
  { id: '7', name: 'Viktor Hovland', bucket: 'contender', odds: 2500, worldRanking: 7, country: 'NOR' },
  { id: '8', name: 'Collin Morikawa', bucket: 'contender', odds: 2800, worldRanking: 8, country: 'USA' },
  { id: '9', name: 'Ludvig Aberg', bucket: 'contender', odds: 3000, worldRanking: 10, country: 'SWE' },
  { id: '10', name: 'Tyrrell Hatton', bucket: 'contender', odds: 3500, worldRanking: 12, country: 'ENG' },
  { id: '11', name: 'Dustin Johnson', bucket: 'contender', odds: 4000, worldRanking: 9, country: 'USA' },
  { id: '12', name: 'Cameron Smith', bucket: 'contender', odds: 4500, worldRanking: 15, country: 'AUS' },

  // Longshots (odds 50+)
  { id: '13', name: 'Jordan Spieth', bucket: 'longshot', odds: 5500, worldRanking: 18, country: 'USA' },
  { id: '14', name: 'Tommy Fleetwood', bucket: 'longshot', odds: 6000, worldRanking: 14, country: 'ENG' },
  { id: '15', name: 'Rickie Fowler', bucket: 'longshot', odds: 7000, worldRanking: 22, country: 'USA' },
  { id: '16', name: 'Patrick Cantlay', bucket: 'longshot', odds: 8000, worldRanking: 11, country: 'USA' },
  { id: '17', name: 'Justin Thomas', bucket: 'longshot', odds: 9000, worldRanking: 20, country: 'USA' },
  { id: '18', name: 'Sahith Theegala', bucket: 'longshot', odds: 10000, worldRanking: 25, country: 'USA' },
  { id: '19', name: 'Hideki Matsuyama', bucket: 'longshot', odds: 12000, worldRanking: 16, country: 'JPN' },
  { id: '20', name: 'Matt Fitzpatrick', bucket: 'longshot', odds: 15000, worldRanking: 28, country: 'ENG' },
  { id: '21', name: 'Max Homa', bucket: 'longshot', odds: 18000, worldRanking: 30, country: 'USA' },
  { id: '22', name: 'Tony Finau', bucket: 'longshot', odds: 20000, worldRanking: 19, country: 'USA' },
];

export const getGolfersByBucket = (bucket: 'favorite' | 'contender' | 'longshot') => {
  return mockGolfers.filter(g => g.bucket === bucket);
};

export const getGolferById = (id: string) => {
  return mockGolfers.find(g => g.id === id);
};
