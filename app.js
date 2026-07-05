const flagUrl = (code) => 'https://flagcdn.com/w80/' + code + '.png';

const sheetUrls = {
  groups: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSkYrXOdNaoswPyFHdMbSJCaO5U_JSk2KucQv_XMfGYu3ZUuDYpP2wI91C1UrEn15gP-KX0Ma33nRim/pub?gid=521295586&single=true&output=csv',
  roundOf32: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSkYrXOdNaoswPyFHdMbSJCaO5U_JSk2KucQv_XMfGYu3ZUuDYpP2wI91C1UrEn15gP-KX0Ma33nRim/pub?gid=2001384069&single=true&output=csv',
  roundOf16: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSkYrXOdNaoswPyFHdMbSJCaO5U_JSk2KucQv_XMfGYu3ZUuDYpP2wI91C1UrEn15gP-KX0Ma33nRim/pub?gid=417647722&single=true&output=csv'
};

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load ' + path);
  return response.json();
}

async function loadText(url) {
  const bust = url.includes('?') ? '&' : '?';
  const response = await fetch(url + bust + 'v=' + Date.now(), { cache: 'no-store' });
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

async function loadPool() {
  const fallback = loadJson('./data/pool.json');

  try {
    const sheetData = await Promise.all([
      loadText(sheetUrls.groups),
      loadText(sheetUrls.roundOf32),
      loadText(sheetUrls.roundOf16)
    ]);

    const groupRows = parseCsv(sheetData[0]);
    const roundOf32Rows = parseCsv(sheetData[1]);
    const roundOf16Rows = parseCsv(sheetData[2]);
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

    return {
      generatedFrom: 'Published Google Sheet',
      players,
      leaderboard,
      groupPicks,
      roundOf32Picks: parsePickRows(roundOf32Rows, players),
      roundOf16Picks
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
  const finalWinners = winnersByStage(results, 'Finals');
  const roundOf16ByPlayer = new Map((pool.roundOf16Picks || []).map((player) => [player.name, player.picks || []]));

  const leaderboard = (pool.leaderboard || []).map((row) => {
    const roundOf16Points = pointsForWinners(roundOf16ByPlayer.get(row.name), roundOf16Winners);
    const quarterfinalPoints = pointsForWinners([], quarterfinalWinners);
    const semifinalPoints = pointsForWinners([], semifinalWinners);
    const finalPoints = pointsForWinners([], finalWinners);

    return {
      ...row,
      roundOf16Points,
      quarterfinalPoints,
      semifinalPoints,
      finalPoints,
      total: row.groupPoints + row.roundOf32Points + roundOf16Points + quarterfinalPoints + semifinalPoints + finalPoints
    };
  }).sort((a, b) => b.total - a.total || b.groupPoints - a.groupPoints || a.name.localeCompare(b.name));

  return { ...pool, leaderboard };
}

function leaderboardRow(row, index) {
  return '<tr><td><span class="rank">' + (index + 1) + '</span></td><td><strong>' + row.name + '</strong></td><td><strong>' + row.total + '</strong></td><td>' + row.groupPoints + '</td><td>' + row.roundOf32Points + '</td><td>' + (row.roundOf16Points || 0) + '</td><td>' + (row.quarterfinalPoints || 0) + '</td><td>' + (row.semifinalPoints || 0) + '</td><td>' + (row.finalPoints || 0) + '</td><td><span class="pill">' + row.champion + '</span></td></tr>';
}

function podiumCard(row, index) {
  return '<article class="podium-card"><span class="rank">' + (index + 1) + '</span><div><span class="label">' + row.champion + ' champion pick</span><strong>' + row.name + '</strong></div><span class="points">' + row.total + '</span></article>';
}

function roundOf16Card(player) {
  const chips = (player.picks || []).map((team) => '<span class="pick-chip"><strong>' + cleanTeam(team) + '</strong></span>').join('');
  const body = chips || '<span class="pick-chip"><strong>Not submitted</strong></span>';
  return '<article class="fixture-card"><div class="fixture-top"><span>Picks</span><span>' + player.name + '</span></div><div class="pick-list">' + body + '</div></article>';
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
    document.querySelector('#matchGrid').innerHTML = results.matches.map(matchCard).join('');
    document.querySelector('#leaderboardRows').innerHTML = pool.leaderboard.map(leaderboardRow).join('');
    document.querySelector('#fixtureGrid').innerHTML = (pool.roundOf16Picks || []).map(roundOf16Card).join('');
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
