// src/server/services/nhle-api.ts
const NHLE_BASE_URL = "https://api-web.nhle.com/v1";

export interface NhleScoresResponse {
  games: NhleGame[];
  currentDate: string;
  prevDate: string;
  nextDate: string;
}

export interface NhleGame {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  venue: { default: string };
  startTimeUTC: string;
  gameState: string;
  gameScheduleState: string;
  awayTeam: NhleTeam;
  homeTeam: NhleTeam;
  clock?: {
    timeRemaining: string;
    secondsRemaining: number;
    running: boolean;
    inIntermission: boolean;
  };
  period?: number;
  periodDescriptor?: { number: number; periodType: string };
  goals?: NhleGoal[];
}

export interface NhleTeam {
  id: number;
  name: { default: string };
  abbrev: string;
  score: number;
  sog: number;
  logo: string;
}

export interface NhleGoal {
  period: number;
  periodDescriptor: { number: number; periodType: string };
  timeInPeriod: string;
  playerId: number;
  name: { default: string };
  firstName: { default: string };
  lastName: { default: string };
  goalModifier: string;
  assists: NhleAssist[];
  teamAbbrev: string;
  goalsToDate: number;
  awayScore: number;
  homeScore: number;
  strength: string;
}

export interface NhleAssist {
  playerId: number;
  name: { default: string };
  assistsToDate: number;
}

export interface NhleScheduleResponse {
  gameWeek: NhleScheduleDay[];
}

export interface NhleScheduleDay {
  date: string;
  dayAbbrev: string;
  numberOfGames: number;
  games: NhleScheduleGame[];
}

export interface NhleScheduleGame {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  startTimeUTC: string;
  gameState: string;
  awayTeam: { abbrev: string };
  homeTeam: { abbrev: string };
}

export interface NhleSkaterGameLog {
  gameId: number;
  teamAbbrev: string;
  gameDate: string;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  powerPlayGoals: number;
  powerPlayPoints: number;
  shorthandedGoals: number;
  shorthandedPoints: number;
  gameWinningGoals: number;
  otGoals: number;
  shots: number;
  pim: number;
  toi: string;
}

export interface NhleGoalieGameLog {
  gameId: number;
  teamAbbrev: string;
  gameDate: string;
  gamesStarted: number;
  decision: string;
  shotsAgainst: number;
  goalsAgainst: number;
  savePctg: number;
  shutouts: number;
  toi: string;
  pim: number;
  goals: number;
  assists: number;
}

export interface NhleGameLogResponse {
  gameLog: (NhleSkaterGameLog | NhleGoalieGameLog)[];
  playerStatsSeasons: unknown[];
}

async function nhleFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${NHLE_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`NHL-e API error: ${response.status} ${response.statusText} for GET ${path}`);
  }
  return response.json() as Promise<T>;
}

export function fetchScores(): Promise<NhleScoresResponse> {
  return nhleFetch<NhleScoresResponse>("/score/now");
}

export function fetchSchedule(date: string): Promise<NhleScheduleResponse> {
  return nhleFetch<NhleScheduleResponse>(`/schedule/${date}`);
}

export function fetchPlayerGameLog(nhlId: number): Promise<NhleGameLogResponse> {
  return nhleFetch<NhleGameLogResponse>(`/player/${nhlId}/game-log/now`);
}

export function fetchClubStats(team: string, season: string): Promise<unknown> {
  return nhleFetch(`/club-stats/${team}/${season}/2`);
}
