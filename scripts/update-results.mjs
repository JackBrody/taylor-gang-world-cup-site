import { writeFile } from 'node:fs/promises';

const outputPath = new URL('../data/results.json', import.meta.url);
const fallback = {
  "lastUpdated": "2026-07-02",
  "stage": "Round of 32",
  "source": {
    "name": "Economic Times and Guardian live reports",
    "url": "https://m.economictimes.com/news/new-updates/fifa-world-cup-2026-who-won-yesterday-latest-match-results-and-whos-into-the-round-of-16/articleshow/132128073.cms"
  },
  "matches": [
    {
      "date": "2026-07-02",
      "stage": "Round of 32",
      "winner": "Mexico",
      "scoreline": "2-0",
      "teams": [
        {
          "name": "Mexico",
          "flag": "mx",
          "score": 2
        },
        {
          "name": "Ecuador",
          "flag": "ec",
          "score": 0
        }
      ]
    },
    {
      "date": "2026-07-02",
      "stage": "Round of 32",
      "winner": "England",
      "scoreline": "2-1",
      "teams": [
        {
          "name": "England",
          "flag": "gb-eng",
          "score": 2
        },
        {
          "name": "DR Congo",
          "flag": "cd",
          "score": 1
        }
      ]
    },
    {
      "date": "2026-07-02",
      "stage": "Round of 32",
      "winner": "Belgium",
      "scoreline": "3-2",
      "teams": [
        {
          "name": "Belgium",
          "flag": "be",
          "score": 3
        },
        {
          "name": "Senegal",
          "flag": "sn",
          "score": 2
        }
      ]
    },
    {
      "date": "2026-07-02",
      "stage": "Round of 32",
      "winner": "United States",
      "scoreline": "2-0",
      "teams": [
        {
          "name": "United States",
          "flag": "us",
          "score": 2
        },
        {
          "name": "Bosnia and Herzegovina",
          "flag": "ba",
          "score": 0
        }
      ]
    }
  ]
};

const flagOverrides = {
  England: 'gb-eng',
  'United States': 'us',
  USA: 'us',
  'DR Congo': 'cd',
  'Bosnia and Herzegovina': 'ba'
};

function countryCode(team) {
  if (flagOverrides[team]) return flagOverrides[team];
  return team.slice(0, 2).toLowerCase();
}

function normalizeEspnEvent(event) {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors || [];
  if (competitors.length < 2) return null;
  const teams = competitors.map((item) => ({
    name: item.team?.shortDisplayName || item.team?.displayName || item.team?.name,
    flag: countryCode(item.team?.shortDisplayName || item.team?.displayName || item.team?.name || ''),
    score: Number(item.score || 0)
  }));
  const winner = competitors.find((item) => item.winner)?.team;
  return {
    date: String(event.date || '').slice(0, 10),
    stage: competition?.notes?.[0]?.headline || event.season?.slug || 'World Cup',
    winner: winner?.shortDisplayName || winner?.displayName || teams.sort((a, b) => b.score - a.score)[0]?.name,
    scoreline: teams.map((team) => team.score).join('-'),
    teams
  };
}

async function loadEspnResults() {
  const url = process.env.WORLD_CUP_RESULTS_URL || 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Scoreboard request failed: ${response.status}`);
  const payload = await response.json();
  const matches = (payload.events || [])
    .map(normalizeEspnEvent)
    .filter(Boolean)
    .filter((match) => match.winner)
    .slice(0, 8);
  if (!matches.length) throw new Error('No completed World Cup matches found in scoreboard response.');
  return {
    lastUpdated: new Date().toISOString().slice(0, 10),
    stage: payload.leagues?.[0]?.name || 'FIFA World Cup 2026',
    source: { name: 'ESPN scoreboard API', url },
    matches
  };
}

let results;
try {
  results = await loadEspnResults();
} catch (error) {
  results = { ...fallback, lastUpdated: new Date().toISOString().slice(0, 10), updateNote: error.message };
}

await writeFile(outputPath, JSON.stringify(results, null, 2) + '\n');
console.log(`Updated results.json with ${results.matches.length} matches`);
