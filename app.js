const flagUrl = (code) => `https://flagcdn.com/w80/${code}.png`;

async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json();
}

function cleanTeam(team) {
  return String(team || '')
    .replace('TÃƒÂ¼rkiye', 'Turkiye')
    .replace('TÃ¼rkiye', 'Turkiye')
    .replace('CÃƒÂ´te dÃ¢â‚¬â„¢Ivoire', "Cote d'Ivoire")
    .replace("CÃƒÂ´te d'Ivoire", "Cote d'Ivoire")
    .replace('Côte d’Ivoire', "Cote d'Ivoire")
    .replace("Côte d'Ivoire", "Cote d'Ivoire")
    .replace('CuraÃƒÂ§ao', 'Curacao')
    .trim();
}

function teamLine(team, winner) {
  const isWinner = team.name === winner;
  return `<div class="team-line ${isWinner ? 'winner' : ''}"><img src="${flagUrl(team.flag)}" alt="" loading="lazy"><strong>${cleanTeam(team.name)}</strong><span class="points">${team.score}</span></div>`;
}

function matchCard(match) {
  return `<article class="match-card"><div class="match-top"><span>${match.date}</span><span>${match.stage}</span></div><p class="scoreline">${match.scoreline}</p>${teamLine(match.teams[0], match.winner)}${teamLine(match.teams[1], match.winner)}</article>`;
}

function leaderboardRow(row, index) {
  return `<tr><td><span class="rank">${index + 1}</span></td><td><strong>${row.name}</strong></td><td><strong>${row.total}</strong></td><td>${row.groupPoints}</td><td>${row.roundOf32Points}</td><td><span class="pill">${row.champion}</span></td></tr>`;
}

function podiumCard(row, index) {
  return `<article class="podium-card"><span class="rank">${index + 1}</span><div><span class="label">${row.champion} champion pick</span><strong>${row.name}</strong></div><span class="points">${row.total}</span></article>`;
}

function roundOf16Card(player) {
  const chips = (player.picks || []).map((team) => `<span class="pick-chip"><strong>${cleanTeam(team)}</strong></span>`).join('');
  const body = chips || '<span class="pick-chip"><strong>Not submitted</strong></span>';
  return `<article class="fixture-card"><div class="fixture-top"><span>Round of 16</span><span>${player.name}</span></div><div class="pick-list">${body}</div></article>`;
}

async function render() {
  const [results, pool] = await Promise.all([loadJson('./data/results.json'), loadJson('./data/pool.json')]);
  document.querySelector('#lastUpdated').textContent = results.lastUpdated;
  document.querySelector('#stageName').textContent = results.stage;
  document.querySelector('#sourceLink').href = results.source.url;
  document.querySelector('#sourceLink').textContent = results.source.name;
  document.querySelector('#podium').innerHTML = pool.leaderboard.slice(0, 3).map(podiumCard).join('');
  document.querySelector('#matchGrid').innerHTML = results.matches.map(matchCard).join('');
  document.querySelector('#leaderboardRows').innerHTML = pool.leaderboard.map(leaderboardRow).join('');
  document.querySelector('#fixtureGrid').innerHTML = (pool.roundOf16Picks || []).map(roundOf16Card).join('');
}

document.querySelector('#refreshButton').addEventListener('click', render);
render().catch((error) => {
  document.querySelector('#matchGrid').innerHTML = `<p>${error.message}</p>`;
});
