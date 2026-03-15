// src/server/services/nhl-salary-api.ts
import { env } from "@/env/server";

export interface SalaryApiPlayer {
  nhlId: number;
  name: string;
  team: string;
  position: string;
  salary: number | null;
  injury: { status: string; description: string } | null;
}

export interface SalaryApiInjury {
  nhlId: number;
  name: string;
  status: string;
  description: string;
}

async function salaryApiFetch<T>(path: string, method: "GET" | "POST" = "GET"): Promise<T> {
  const response = await fetch(`${env.NHL_SALARY_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.NHL_SALARY_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(
      `NHL Salary API error: ${response.status} ${response.statusText} for ${method} ${path}`,
    );
  }
  return response.json() as Promise<T>;
}

export function fetchPlayers(): Promise<SalaryApiPlayer[]> {
  return salaryApiFetch<SalaryApiPlayer[]>("/players");
}

export function fetchPlayerById(nhlId: number): Promise<SalaryApiPlayer> {
  return salaryApiFetch<SalaryApiPlayer>(`/players/${nhlId}`);
}

export function fetchInjuries(): Promise<SalaryApiInjury[]> {
  return salaryApiFetch<SalaryApiInjury[]>("/injuries");
}

export function triggerPlayerScrape(): Promise<{ message: string }> {
  return salaryApiFetch<{ message: string }>("/admin/scrape/players", "POST");
}

export function triggerInjuryScrape(): Promise<{ message: string }> {
  return salaryApiFetch<{ message: string }>("/admin/scrape/injuries", "POST");
}
