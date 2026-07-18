const flagUrl = (code) => 'https://flagcdn.com/w80/' + code + '.png';

const sheetUrls = {
  groups: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSkYrXOdNaoswPyFHdMbSJCaO5U_JSk2KucQv_XMfGYu3ZUuDYpP2wI91C1UrEn15gP-KX0Ma33nRim/pub?gid=521295586&single=true&output=csv',
  roundOf32: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSkYrXOdNaoswPyFHdMbSJCaO5U_JSk2KucQv_XMfGYu3ZUuDYpP2wI91C1UrEn15gP-KX0Ma33nRim/pub?gid=2001384069&single=true&output=csv',
  roundOf16: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSkYrXOdNaoswPyFHdMbSJCaO5U_JSk2KucQv_XMfGYu3ZUuDYpP2wI91C1UrEn15gP-KX0Ma33nRim/pub?gid=417647722&single=true&output=csv',
  quarterfinals: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSkYrXOdNaoswPyFHdMbSJCaO5U_JSk2KucQv_XMfGYu3ZUuDYpP2wI91C1UrEn15gP-KX0Ma33nRim/pub?gid=913422121&single=true&output=csv',
  semifinals: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSkYrXOdNaoswPyFHdMbSJCaO5U_JSk2KucQv_XMfGYu3ZUuDYpP2wI91C1UrEn15gP-KX0Ma33nRim/pub?gid=96105003&single=true&output=csv',
  thirdPlace: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSkYrXOdNaoswPyFHdMbSJCaO5U_JSk2KucQv_XMfGYu3ZUuDYpP2wI91C1UrEn15gP-KX0Ma33nRim/pub?gid=1599422056&single=true&output=csv'
};

const AUTO_REFRESH_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10000;

const teamFlagCodes = {
  argentina: 'ar',
  brazil: 'br',
  canada: 'ca',
  england: 'gb-eng',
  france: 'fr',
  spain: 'es'
};

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function loadJson(path) {
  const bust = path.includes('?') ? '&' : '?';
  const response = await fetchWithTimeout(path + bust + 'v=' + Date.now(), { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load ' + path);
  return response.json();
}

async function loadText(url) {
  const bust = url.includes('?') ? '&' : '?';
  const response = await fetchWithTimeout(url + bust + 'v=' + Date.now(), { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load sheet data');
  return response.text();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === ',' && !inQuotes) {
      row.push(field.trim());
      field = '';
    } else if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows.filter((cells) => cells.some(Boolean));
}

function numberCell(value) {
  const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanTeam(team) {
  return String(team || '')
    .replace('TÃƒÂ¼rkiye', 'Turkiye')
    .replace('TÃ¼rkiye', 'Turkiye')
    .replace('Türkiye', 'Turkiye')
    .replace('CÃƒÂ´te dÃ¢â‚¬â„¢Ivoire', "Cote d'Ivoire")
    .replace("CÃƒÂ´te d'Ivoire", "Cote d'Ivoire")
    .replace('Côte d’Ivoire', "Cote d'Ivoire")
    .replace("Côte d'Ivoire", "Cote d'Ivoire")
    .replace('CuraÃƒÂ§ao', 'Curacao')
    .replace('Curaçao', 'Curacao')
    .trim();
}

function canonicalTeam(team) {
  const cleaned = cleanTeam(team).toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases = {
    usa: 'unitedstates',
    us: 'unitedstates',
    unitedstatesofamerica: 'unitedstates',
    coteivoire: 'cotedivoire'
  };
  return aliases[cleaned] || cleaned;
}

function flagCodeForTeam(team) {
  return teamFlagCodes[canonicalTeam(team)] || '';
}

function flagStyle(team) {
  const code = flagCodeForTeam(team);
  return code ? ' style="--pick-flag: url(' + flagUrl(code) + ');"' : '';
}

function playersFromHeader(row) {
  return row.slice(1, 9).filter(Boolean);
}

function rowByLabel(rows, label) {
  return rows.find((row) => String(row[0] || '').toLowerCase() === label.toLowerCase());
}

function parsePickRows(rows, players) {
  return rows
    .slice(1)
    .filter((row) => row[0] !== 'TOTAL' && row.some((cell) => String(cell).toLowerCase() === 'vs'))
    .map((row) => {
      const vsIndex = row.findIndex((cell) => String(cell).toLowerCase() === 'vs');
      const home = cleanTeam(row[vsIndex - 1]);
      const away = cleanTeam(row[vsIndex + 1]);
      const picks = {};
      players.forEach((player, index) => {
        picks[player] = cleanTeam(row[index + 1]);
      });
      return { match: home + ' vs ' + away, home, away, picks };
    })
    .filter((fixture) => fixture.home && fixture.away);
}

function emptyPicks(players) {
  return players.map((name) => ({ name, picks: [] }));
}

function parsePlayerPickColumns(rows, players) {
  const headerIndex = rows.findIndex((row) => players.filter((player) => row.some((cell) => cell === player)).length >= 2);
  if (headerIndex < 0) return emptyPicks(players);

  const header = rows[headerIndex];
  return players.map((name) => {
    const columnIndex = header.findIndex((cell) => cell === name);
    const picks = columnIndex < 0
      ? []
      : rows.slice(headerIndex + 1).map((row) => cleanTeam(row[columnIndex])).filter(Boolean);
    return { name, picks };
  });
}

async function loadPool() {
  const fallback = loadJson('./data/pool.json');

  try {
    const sheetResults = await Promise.allSettled([
      loadText(sheetUrls.groups),
      loadText(sheetUrls.roundOf32),
      loadText(sheetUrls.roundOf16),
      loadText(sheetUrls.quarterfinals),
      loadText(sheetUrls.semifinals),
      loadText(sheetUrls.thirdPlace)
    ]);

    if (sheetResults.some((result) => result.status === 'rejected')) {
      throw new Error('One or more Google Sheet tabs could not be loaded.');
    }

    const sheetData = sheetResults.map((result) => result.value);

    const groupRows = parseCsv(sheetData[0]);
    const roundOf32Rows = parseCsv(sheetData[1]);
    const roundOf16Rows = parseCsv(sheetData[2]);
    const quarterfinalRows = parseCsv(sheetData[3]);
    const semifinalRows = parseCsv(sheetData[4]);
    const thirdPlaceRows = parseCsv(sheetData[5]);
    const players = playersFromHeader(groupRows[0]);
    const groupTotal = rowByLabel(groupRows, 'TOTAL') || [];
    const championRow = rowByLabel(groupRows, 'Champion') || [];
    const roundOf32Total = rowByLabel(roundOf32Rows, 'TOTAL') || [];

    const leaderboard = players.map((name, index) => {
      const groupPoints = numberCell(groupTotal[index + 1]);
      const roundOf32Points = numberCell(roundOf32Total[index + 1]);
      const roundOf16Points = 0;
      const quarterfinalPoints = 0;
      const semifinalPoints = 0;
      const finalPoints = 0;
      return {
        name,
        groupPoints,
        roundOf32Points,
        roundOf16Points,
        quarterfinalPoints,
        semifinalPoints,
        finalPoints,
        total: groupPoints + roundOf32Points + roundOf16Points + quarterfinalPoints + semifinalPoints + finalPoints,
        champion: cleanTeam(championRow[index + 1])
      };
    }).sort((a, b) => b.total - a.total || b.groupPoints - a.groupPoints || a.name.localeCompare(b.name));

    const groupPicks = groupRows
      .slice(1)
      .filter((row) => row[0] && !['TOTAL', 'Champion'].includes(row[0]))
      .map((row) => ({
        slot: row[0],
        picks: Object.fromEntries(players.map((player, index) => [player, cleanTeam(row[index + 1])]))
      }));

    const roundOf16Picks = players.map((name, index) => ({
      name,
      picks: roundOf16Rows.slice(1).map((row) => cleanTeam(row[index + 1])).filter(Boolean)
    }));
    const quarterfinalPicks = parsePlayerPickColumns(quarterfinalRows, players);
    const semifinalPicks = parsePlayerPickColumns(semifinalRows, players);
    const thirdPlacePicks = parsePlayerPickColumns(thirdPlaceRows, players);

    return {
      generatedFrom: 'Published Google Sheet',
      players,
      leaderboard,
      groupPicks,
      roundOf32Picks: parsePickRows(roundOf32Rows, players),
      roundOf16Picks,
      quarterfinalPicks,
      semifinalPicks,
      thirdPlacePicks
    };
  } catch (error) {
    console.warn('Using saved pool data because the Google Sheet could not be loaded.', error);
    return fallback;
  }
}

function teamLine(team, winner) {
  const isWinner = team.name === winner;
  return '<div class="team-line ' + (isWinner ? 'winner' : '') + '"><img src="' + flagUrl(team.flag) + '" alt="" loading="lazy"><strong>' + cleanTeam(team.name) + '</strong><span class="points">' + team.score + '</span></div>';
}

function matchCard(match) {
  return '<article class="match-card"><div class="match-top"><span>' + match.date + '</span><span>' + match.stage + '</span></div><p class="scoreline">' + match.scoreline + '</p>' + teamLine(match.teams[0], match.winner) + teamLine(match.teams[1], match.winner) + '</article>';
}

function latestMatches(results) {
  return (results.matches || []).filter((match) => !['round of 32', 'round of 16', 'quarterfinals'].includes(String(match.stage || '').toLowerCase()));
}

function winnersByStage(results, stageName) {
  return (results.matches || [])
    .filter((match) => String(match.stage || '').toLowerCase() === stageName.toLowerCase())
    .map((match) => match.winner)
    .filter(Boolean);
}

function pointsForWinners(picks, winners) {
  const canonicalPicks = new Set((picks || []).map(canonicalTeam));
  return winners.reduce((points, winner) => points + (canonicalPicks.has(canonicalTeam(winner)) ? 2 : 0), 0);
}

function scorePool(pool, results) {
  const roundOf16Winners = winnersByStage(results, 'Round of 16');
  const quarterfinalWinners = winnersByStage(results, 'Quarterfinals');
  const semifinalWinners = winnersByStage(results, 'Semi-finals');
  const thirdPlaceWinners = winnersByStage(results, 'Third place play-off');
  const finalWinners = winnersByStage(results, 'Finals');
  const roundOf16ByPlayer = new Map((pool.roundOf16Picks || []).map((player) => [player.name, player.picks || []]));
  const quarterfinalByPlayer = new Map((pool.quarterfinalPicks || []).map((player) => [player.name, player.picks || []]));
  const semifinalByPlayer = new Map((pool.semifinalPicks || []).map((player) => [player.name, player.picks || []]));
  const thirdPlaceByPlayer = new Map((pool.thirdPlacePicks || []).map((player) => [player.name, player.picks || []]));

  const leaderboard = (pool.leaderboard || []).map((row) => {
    const roundOf16Points = pointsForWinners(roundOf16ByPlayer.get(row.name), roundOf16Winners);
    const quarterfinalPoints = pointsForWinners(quarterfinalByPlayer.get(row.name), quarterfinalWinners);
    const semifinalPoints = pointsForWinners(semifinalByPlayer.get(row.name), semifinalWinners);
    const thirdPlacePoints = pointsForWinners(thirdPlaceByPlayer.get(row.name), thirdPlaceWinners);
    const finalPoints = pointsForWinners([], finalWinners);

    return {
      ...row,
      roundOf16Points,
      quarterfinalPoints,
      semifinalPoints,
      thirdPlacePoints,
      finalPoints,
      total: row.groupPoints + row.roundOf32Points + roundOf16Points + quarterfinalPoints + semifinalPoints + thirdPlacePoints + finalPoints
    };
  }).sort((a, b) => b.total - a.total || b.groupPoints - a.groupPoints || a.name.localeCompare(b.name));

  return { ...pool, leaderboard };
}

function leaderboardRow(row, index) {
  return '<tr><td><span class="rank">' + (index + 1) + '</span></td><td><strong>' + row.name + '</strong></td><td><strong>' + row.total + '</strong></td><td>' + row.groupPoints + '</td><td>' + row.roundOf32Points + '</td><td>' + (row.roundOf16Points || 0) + '</td><td>' + (row.quarterfinalPoints || 0) + '</td><td>' + (row.semifinalPoints || 0) + '</td><td>' + (row.thirdPlacePoints || 0) + '</td><td>' + (row.finalPoints || 0) + '</td><td><span class="pill champion-pill champion-pill-' + canonicalTeam(row.champion) + '"' + flagStyle(row.champion) + '>' + row.champion + '</span></td></tr>';
}

function podiumCard(row, index) {
  return '<article class="podium-card"><span class="rank">' + (index + 1) + '</span><div><span class="label">' + row.champion + ' champion pick</span><strong>' + row.name + '</strong></div><span class="points">' + row.total + '</span></article>';
}

function pickCard(player, label) {
  const chips = (player.picks || []).map((team) => '<span class="pick-chip"><strong>' + cleanTeam(team) + '</strong></span>').join('');
  const body = chips || '<span class="pick-chip"><strong>Not submitted</strong></span>';
  return '<article class="fixture-card"><div class="fixture-top"><span>' + label + '</span><span>' + player.name + '</span></div><div class="pick-list">' + body + '</div></article>';
}

function quarterfinalCard(player) {
  return pickCard(player, 'Quarterfinals');
}

function picksTable(players, picksByPlayer) {
  const picks = picksByPlayer || emptyPicks(players || []);
  const maxRows = Math.max(0, ...picks.map((player) => (player.picks || []).length));
  const headers = picks.map((player) => '<th>' + player.name + '</th>').join('');
  const rows = Array.from({ length: maxRows }, (_, rowIndex) => {
    const cells = picks.map((player) => '<td>' + cleanTeam((player.picks || [])[rowIndex] || '') + '</td>').join('');
    return '<tr>' + cells + '</tr>';
  }).join('');
  return '<div class="picks-table-wrap"><table class="picks-table"><thead><tr>' + headers + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function thirdPlaceCards(players, picksByPlayer) {
  const picks = picksByPlayer || emptyPicks(players || []);
  const cards = picks.map((player) => {
    const pick = cleanTeam((player.picks || [])[0] || '');
    const tone = pick ? canonicalTeam(pick) : 'empty';
    const label = pick || 'No pick submitted';
    return '<article class="bronze-card bronze-card-' + tone + '"' + flagStyle(pick) + '><span class="bronze-player">' + player.name + '</span><strong>' + label + '</strong><span class="bronze-label">3rd place pick</span></article>';
  }).join('');

  return '<div class="bronze-pick-grid">' + cards + '</div>';
}

function matchKey(teamA, teamB) {
  return [canonicalTeam(teamA), canonicalTeam(teamB)].sort().join('|');
}

function scoreForTeam(match, teamName) {
  const team = (match.teams || []).find((entry) => canonicalTeam(entry.name) === canonicalTeam(teamName));
  return team ? team.score : '';
}

function bracketTeam(teamName, match) {
  const name = cleanTeam(teamName || 'TBD');
  const isWinner = match && canonicalTeam(match.winner) === canonicalTeam(name);
  const score = match ? scoreForTeam(match, name) : '';
  return '<div class="bracket-team bracket-team-' + canonicalTeam(name) + ' ' + (isWinner ? 'winner' : '') + '"' + flagStyle(name) + '><strong>' + name + '</strong><span class="bracket-score">' + score + '</span></div>';
}

function bracketMatch(label, date, teamA, teamB, match) {
  return '<article class="bracket-match ' + (!match ? 'pending' : '') + '"><div class="bracket-meta"><span>' + label + '</span><span>' + date + '</span></div>' + bracketTeam(teamA, match) + bracketTeam(teamB, match) + '</article>';
}

function findMatch(matchMap, teamA, teamB) {
  return matchMap.get(matchKey(teamA, teamB));
}

function winnerOrTbd(match) {
  return match && match.winner ? cleanTeam(match.winner) : 'TBD';
}

function loserOrTbd(match) {
  if (!match || !match.winner) return 'TBD';
  const loser = (match.teams || []).find((team) => canonicalTeam(team.name) !== canonicalTeam(match.winner));
  return loser ? cleanTeam(loser.name) : 'TBD';
}

function buildBracket(results) {
  const matchMap = new Map((results.matches || []).map((match) => [matchKey(match.teams[0].name, match.teams[1].name), match]));

  const roundOf16 = [
    { label: 'R16 1', date: 'Jul 4', teams: ['Canada', 'Morocco'] },
    { label: 'R16 2', date: 'Jul 4', teams: ['France', 'Paraguay'] },
    { label: 'R16 3', date: 'Jul 5', teams: ['Brazil', 'Norway'] },
    { label: 'R16 4', date: 'Jul 5', teams: ['Mexico', 'England'] },
    { label: 'R16 5', date: 'Jul 6', teams: ['Spain', 'Portugal'] },
    { label: 'R16 6', date: 'Jul 6', teams: ['United States', 'Belgium'] },
    { label: 'R16 7', date: 'Jul 7', teams: ['Argentina', 'Egypt'] },
    { label: 'R16 8', date: 'Jul 7', teams: ['Switzerland', 'Colombia'] }
  ].map((slot) => ({ ...slot, match: findMatch(matchMap, slot.teams[0], slot.teams[1]) }));

  const quarterfinals = [
    { label: 'QF 1', date: 'Thu, Jul 9 4:00 p.m.', teams: ['France', 'Morocco'] },
    { label: 'QF 2', date: 'Fri, Jul 10 3:00 p.m.', teams: ['Spain', 'Belgium'] },
    { label: 'QF 3', date: 'Sat, Jul 11 5:00 p.m.', teams: ['Norway', 'England'] },
    { label: 'QF 4', date: 'Sat, Jul 11 9:00 p.m.', teams: ['Argentina', 'Switzerland'] }
  ].map((slot) => {
    const teams = slot.teams.map((team) => {
      const qualified = roundOf16.some((roundSlot) => canonicalTeam(roundSlot.match && roundSlot.match.winner) === canonicalTeam(team));
      return qualified ? team : 'TBD';
    });
    return { ...slot, teams, match: teams.includes('TBD') ? null : findMatch(matchMap, teams[0], teams[1]) };
  });

  const semifinals = [
    { label: 'SF 1', date: 'Tue, Jul 14 3:00 p.m.', source: [0, 1] },
    { label: 'SF 2', date: 'Wed, Jul 15 3:00 p.m.', source: [2, 3] }
  ].map((slot) => {
    const teams = slot.source.map((index) => winnerOrTbd(quarterfinals[index].match));
    return { ...slot, teams, match: teams.includes('TBD') ? null : findMatch(matchMap, teams[0], teams[1]) };
  });

  const finalTeams = semifinals.map((slot) => winnerOrTbd(slot.match));
  const finalMatch = finalTeams.includes('TBD') ? null : findMatch(matchMap, finalTeams[0], finalTeams[1]);
  const thirdPlaceTeams = semifinals.map((slot) => loserOrTbd(slot.match));
  const thirdPlaceMatch = thirdPlaceTeams.includes('TBD') ? null : findMatch(matchMap, thirdPlaceTeams[0], thirdPlaceTeams[1]);

  return [
    { title: 'Semi-finals', matches: semifinals },
    { title: 'Third place play-off', matches: [{ label: 'Third place play-off', date: 'Sat, Jul 18 5:00 p.m.', teams: thirdPlaceTeams, match: thirdPlaceMatch }] },
    { title: 'Final', matches: [{ label: 'Final', date: 'Sun, Jul 19 3:00 p.m.', teams: finalTeams, match: finalMatch }] }
  ];
}

function bracketRound(round) {
  const matches = round.matches.map((slot) => bracketMatch(slot.label, slot.date, slot.teams[0], slot.teams[1], slot.match)).join('');
  const roundClass = cleanTeam(round.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return '<div class="bracket-round bracket-round-' + roundClass + '"><h3>' + round.title + '</h3>' + matches + '</div>';
}

async function render({ manual = false } = {}) {
  const updateButtons = Array.from(document.querySelectorAll('.update-button'));

  if (manual) {
    updateButtons.forEach((button) => {
      button.disabled = true;
      button.textContent = 'UPDATING...';
    });
  }

  try {
    const [results, rawPool] = await Promise.all([loadJson('./data/results.json'), loadPool()]);
    const pool = scorePool(rawPool, results);
    document.querySelector('#lastUpdated').textContent = results.lastUpdated;
    document.querySelector('#stageName').textContent = results.stage;
    document.querySelector('#sourceLink').href = results.source.url;
    document.querySelector('#sourceLink').textContent = results.source.name;
    document.querySelector('#podium').innerHTML = pool.leaderboard.slice(0, 3).map(podiumCard).join('');
    document.querySelector('#matchGrid').innerHTML = latestMatches(results).map(matchCard).join('');
    document.querySelector('#leaderboardRows').innerHTML = pool.leaderboard.map(leaderboardRow).join('');
    document.querySelector('#bracketGrid').innerHTML = buildBracket(results).map(bracketRound).join('');
    document.querySelector('#thirdPlaceGrid').innerHTML = thirdPlaceCards(pool.players || [], pool.thirdPlacePicks);
  } finally {
    if (manual) {
      updateButtons.forEach((button) => {
        button.disabled = false;
        button.textContent = 'UPDATE';
      });
    }
  }
}

document.querySelectorAll('.update-button').forEach((button) => {
  button.addEventListener('click', () => render({ manual: true }));
});
render().catch((error) => {
  document.querySelector('#matchGrid').innerHTML = '<p>' + error.message + '</p>';
});

setInterval(() => {
  render().catch((error) => {
    console.warn('Automatic refresh failed.', error);
  });
}, AUTO_REFRESH_MS);
