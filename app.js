"use strict";

const STORAGE_KEY = "noahMarceloPerformanceHub.v1";
const RAST_DISTANCE_METERS = 35;
const BASE_FILE_NAME = "noah-marcelo-performance-hub";
const chartRegistry = new Map();
let toastTimer = null;

const BASE_DATA = {
  version: 1,
  generatedAt: "2026-04-10",
  referenceNote:
    "Benchmarks iniciais inspirados na planilha enviada e usados aqui como faixas configuráveis para leitura rápida. O foco principal do painel é a evolução histórica de cada atleta.",
  athletes: [
    {
      id: "noah",
      displayName: "Noah",
      fullName: "Noah Fraga Hashimoto de Vietro",
      sport: "Futebol de base",
      theme: {
        accent: "#ff8c42",
        accentSoft: "#ffd05d",
        shadow: "rgba(255, 140, 66, 0.32)",
      },
      heroImage: "./assets/images/noah.jpeg",
      heroImagePosition: "50% 30%",
      profileImagePosition: "50% 10%",
      benchmarks: {
        relativeAveragePower: {
          label: "Potência relativa média",
          unit: "W/kg",
          higherIsBetter: true,
          nonAthlete: [1.3, 1.5],
          athlete: [1.6, 2.15],
          elite: [2.16, 3.6],
        },
        fatiguePercent: {
          label: "Índice de fadiga",
          unit: "%",
          higherIsBetter: false,
          nonAthlete: [60, 100],
          athlete: [30, 70],
          elite: [20, 40],
        },
        sljMeters: {
          label: "Salto horizontal",
          unit: "m",
          higherIsBetter: true,
          nonAthlete: [1.1, 1.3],
          athlete: [1.35, 1.6],
          elite: [1.5, 1.8],
        },
      },
      evaluations: [
        {
          id: "noah-2025-12-22",
          date: "2025-12-22",
          age: 8,
          weightKg: 30,
          heightM: 1.36,
          sljMeters: 1.45,
          rastTimes: [8.16, 7.95, 7.91, 8.74, 8.78, 9.18],
          notes:
            "Coleta de dezembro. Bom nível de explosão para a idade e queda marcada de rendimento ao longo dos tiros.",
          shapePhotos: [],
        },
        {
          id: "noah-2026-04-09",
          date: "2026-04-09",
          age: 8,
          weightKg: 30.5,
          heightM: 1.37,
          sljMeters: 1.54,
          rastTimes: [7.16, 7.7, 7.58, 7.74, 7.89, 7.83],
          notes:
            "Nova coleta com melhora clara de aceleração, sustentação melhor entre os tiros centrais e salto horizontal mais forte.",
          shapePhotos: [],
        },
      ],
    },
    {
      id: "marcelo",
      displayName: "Marcelo",
      fullName: "Marcelo F. H. de Vietro",
      sport: "Futebol de base",
      theme: {
        accent: "#3db8ff",
        accentSoft: "#ffd34f",
        shadow: "rgba(61, 184, 255, 0.32)",
      },
      heroImage: "./assets/images/marcelo.jpg",
      heroImagePosition: "center center",
      profileImagePosition: "center center",
      benchmarks: {
        relativeAveragePower: {
          label: "Potência relativa média",
          unit: "W/kg",
          higherIsBetter: true,
          nonAthlete: [1.5, 1.8],
          athlete: [1.9, 2.6],
          elite: [2.61, 3.9],
        },
        fatiguePercent: {
          label: "Índice de fadiga",
          unit: "%",
          higherIsBetter: false,
          nonAthlete: [55, 95],
          athlete: [30, 60],
          elite: [18, 38],
        },
        sljMeters: {
          label: "Salto horizontal",
          unit: "m",
          higherIsBetter: true,
          nonAthlete: [1.2, 1.45],
          athlete: [1.46, 1.75],
          elite: [1.76, 2.1],
        },
      },
      evaluations: [
        {
          id: "marcelo-2025-12-22",
          date: "2025-12-22",
          age: 11,
          weightKg: 35,
          heightM: 1.48,
          sljMeters: 1.51,
          rastTimes: [6.59, 7.41, 7.79, 8.33, 7.37, 8.23],
          notes:
            "Coleta inicial de dezembro. Bom pico de potência e espaço para ganhar consistência entre as repetições.",
          shapePhotos: [],
        },
      ],
    },
  ],
};

const state = loadState();

document.addEventListener("DOMContentLoaded", () => {
  renderApp();
  bindGlobalEvents();
  bindSmoothAnchors();
  setupRevealObserver();
});

function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  const fallback = clone(BASE_DATA);

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    return sanitizeState(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function sanitizeState(value) {
  return Boolean(
    value &&
      Array.isArray(value.athletes) &&
      value.athletes.every((athlete) => athlete.id && Array.isArray(athlete.evaluations))
  );
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    showToast(
      "Os dados ficaram grandes demais para salvar. Exporte um backup e remova algumas fotos do shape."
    );
    console.error(error);
    return false;
  }
}

function getAthletesWithMetrics() {
  return state.athletes.map((athlete) => {
    const evaluations = [...athlete.evaluations]
      .map((evaluation) => ({
        ...evaluation,
        metrics: computeEvaluationMetrics(evaluation),
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
      ...athlete,
      evaluations,
    };
  });
}

function computeEvaluationMetrics(evaluation) {
  const powers = evaluation.rastTimes.map(
    (time) => (evaluation.weightKg * RAST_DISTANCE_METERS ** 2) / time ** 3
  );
  const peakPower = Math.max(...powers);
  const minPower = Math.min(...powers);
  const meanPower = powers.reduce((sum, value) => sum + value, 0) / powers.length;
  const totalTime = evaluation.rastTimes.reduce((sum, value) => sum + value, 0);
  const bestTime = Math.min(...evaluation.rastTimes);
  const meanTime = totalTime / evaluation.rastTimes.length;
  const fatigueWs = totalTime ? (peakPower - minPower) / totalTime : 0;
  const fatiguePercent = peakPower ? ((peakPower - minPower) / peakPower) * 100 : 0;
  const relativePeakPower = peakPower / evaluation.weightKg;
  const relativeAveragePower = meanPower / evaluation.weightKg;
  const bmi = evaluation.weightKg / evaluation.heightM ** 2;
  const sljHeightRatio = evaluation.sljMeters / evaluation.heightM;

  return {
    powers,
    peakPower,
    minPower,
    meanPower,
    totalTime,
    bestTime,
    meanTime,
    fatigueWs,
    fatiguePercent,
    relativePeakPower,
    relativeAveragePower,
    bmi,
    sljHeightRatio,
  };
}

function getLatestEvaluation(athlete) {
  return athlete.evaluations[athlete.evaluations.length - 1] ?? null;
}

function getPreviousEvaluation(athlete) {
  return athlete.evaluations.length > 1 ? athlete.evaluations[athlete.evaluations.length - 2] : null;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatCompact(value, digits = 1) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value, digits = 1) {
  return `${formatNumber(value, digits)}%`;
}

function getBenchmarkStatus(athlete, metricKey, value) {
  const metric = athlete.benchmarks?.[metricKey];

  if (!metric) {
    return { label: "Sem faixa", tone: "mid" };
  }

  const { athlete: athleteBand, elite, higherIsBetter } = metric;

  if (higherIsBetter) {
    if (value >= elite[0]) {
      return { label: "Elite", tone: "good" };
    }

    if (value >= athleteBand[0]) {
      return { label: "Atleta", tone: "mid" };
    }

    return { label: "Base geral", tone: "alert" };
  }

  if (value <= elite[1]) {
    return { label: "Elite", tone: "good" };
  }

  if (value <= athleteBand[1]) {
    return { label: "Atleta", tone: "mid" };
  }

  return { label: "Pedir atenção", tone: "alert" };
}

function computeScore(athlete, evaluation) {
  const metrics = evaluation.metrics;
  const powerScore = scoreFromMetric(
    metrics.relativeAveragePower,
    athlete.benchmarks.relativeAveragePower,
    true
  );
  const fatigueScore = scoreFromMetric(
    metrics.fatiguePercent,
    athlete.benchmarks.fatiguePercent,
    false
  );
  const jumpScore = scoreFromMetric(metrics.sljMeters, athlete.benchmarks.sljMeters, true);
  return Math.round((powerScore + fatigueScore + jumpScore) / 3);
}

function scoreFromMetric(value, band, higherIsBetter) {
  const low = band.nonAthlete[0];
  const mid = band.athlete[0];
  const high = band.elite[0];

  if (higherIsBetter) {
    if (value <= low) {
      return clamp((value / low) * 55, 10, 55);
    }

    if (value <= mid) {
      return 56 + ((value - low) / Math.max(mid - low, 0.001)) * 16;
    }

    if (value <= high) {
      return 72 + ((value - mid) / Math.max(high - mid, 0.001)) * 18;
    }

    return clamp(90 + ((value - high) / Math.max(high * 0.3, 0.001)) * 10, 90, 100);
  }

  const invertedLow = band.nonAthlete[1];
  const invertedMid = band.athlete[1];
  const invertedHigh = band.elite[1];

  if (value >= invertedLow) {
    return clamp(55 - ((value - invertedLow) / Math.max(invertedLow * 0.25, 0.001)) * 30, 10, 55);
  }

  if (value >= invertedMid) {
    return 56 + ((invertedLow - value) / Math.max(invertedLow - invertedMid, 0.001)) * 16;
  }

  if (value >= invertedHigh) {
    return 72 + ((invertedMid - value) / Math.max(invertedMid - invertedHigh, 0.001)) * 18;
  }

  return clamp(90 + ((invertedHigh - value) / Math.max(invertedHigh * 0.35, 0.001)) * 10, 90, 100);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function metricDelta(current, previous, higherIsBetter = true) {
  if (previous === null || previous === undefined || previous === 0) {
    return "Primeira coleta";
  }

  const rawChange = ((current - previous) / Math.abs(previous)) * 100;
  const adjusted = higherIsBetter ? rawChange : rawChange * -1;
  return `${adjusted >= 0 ? "+" : ""}${formatCompact(adjusted, 1)}% vs. coleta anterior`;
}

function renderApp() {
  const athletes = getAthletesWithMetrics();
  renderHero(athletes);
  renderCompare(athletes);
  renderAthletes(athletes);
  populateAthleteSelect(athletes);
  ensureFormDate();
  destroyMissingCharts();
  queueCharts(athletes);
  setupRevealObserver();
}

function renderHero(athletes) {
  const heroGrid = document.getElementById("heroGrid");

  heroGrid.innerHTML = athletes
    .map((athlete) => {
      const latest = getLatestEvaluation(athlete);
      const score = computeScore(athlete, latest);
      const scoreLabel = score >= 80 ? "momento forte" : score >= 65 ? "boa base" : "em construção";
      const powerStatus = getBenchmarkStatus(
        athlete,
        "relativeAveragePower",
        latest.metrics.relativeAveragePower
      );

      return `
        <article class="hero-athlete-card" style="box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 70px ${athlete.theme.shadow};">
          <img class="hero-athlete-image" src="${athlete.heroImage}" alt="Foto de ${athlete.displayName}" style="object-position:${athlete.heroImagePosition || "center center"};" />
          <div class="hero-athlete-top">
            <span class="tag">${athlete.displayName}</span>
            <span class="tag">${formatDate(latest.date)}</span>
          </div>
          <div class="hero-athlete-content">
            <h3>${athlete.displayName}</h3>
            <p>${scoreLabel} com ${powerStatus.label.toLowerCase()} em potência relativa média e leitura automática do último ciclo.</p>
            <div class="hero-athlete-metrics">
              <div class="mini-metric">
                <span>Score geral</span>
                <strong>${score}</strong>
              </div>
              <div class="mini-metric">
                <span>Pot. rel. média</span>
                <strong>${formatNumber(latest.metrics.relativeAveragePower)} W/kg</strong>
              </div>
              <div class="mini-metric">
                <span>SLJ</span>
                <strong>${formatNumber(latest.sljMeters)} m</strong>
              </div>
              <div class="mini-metric">
                <span>Fadiga</span>
                <strong>${formatCompact(latest.metrics.fatiguePercent, 1)}%</strong>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCompare(athletes) {
  const summary = document.getElementById("compareSummary");
  const latestRows = athletes.map((athlete) => {
    const latest = getLatestEvaluation(athlete);
    return {
      athlete,
      latest,
      score: computeScore(athlete, latest),
    };
  });

  summary.innerHTML = `
    <div class="compare-topline">
      <div>
        <span>Leitura atual</span>
        <strong>Quem está puxando mais cada métrica agora</strong>
      </div>
    </div>
    <div class="compare-card-grid">
      ${buildCompareMiniCard(
        "Score geral",
        latestRows.reduce((best, row) => (row.score > best.score ? row : best), latestRows[0]),
        (row) => `${row.score} pts`
      )}
      ${buildCompareMiniCard(
        "Potência relativa média",
        latestRows.reduce(
          (best, row) =>
            row.latest.metrics.relativeAveragePower > best.latest.metrics.relativeAveragePower ? row : best,
          latestRows[0]
        ),
        (row) => `${formatNumber(row.latest.metrics.relativeAveragePower)} W/kg`
      )}
      ${buildCompareMiniCard(
        "SLJ",
        latestRows.reduce((best, row) => (row.latest.sljMeters > best.latest.sljMeters ? row : best), latestRows[0]),
        (row) => `${formatNumber(row.latest.sljMeters)} m`
      )}
      ${buildCompareMiniCard(
        "Menor fadiga",
        latestRows.reduce(
          (best, row) =>
            row.latest.metrics.fatiguePercent < best.latest.metrics.fatiguePercent ? row : best,
          latestRows[0]
        ),
        (row) => `${formatCompact(row.latest.metrics.fatiguePercent, 1)}%`
      )}
      ${buildCompareMiniCard(
        "Melhor tiro",
        latestRows.reduce((best, row) => (row.latest.metrics.bestTime < best.latest.metrics.bestTime ? row : best), latestRows[0]),
        (row) => `${formatNumber(row.latest.metrics.bestTime)} s`
      )}
      ${buildCompareMiniCard(
        "Coleta mais recente",
        latestRows.reduce((best, row) => (row.latest.date > best.latest.date ? row : best), latestRows[0]),
        (row) => formatDate(row.latest.date)
      )}
    </div>
  `;
}

function buildCompareMiniCard(label, winnerRow, formatter) {
  return `
    <article class="score-card">
      <div>
        <span>${label}</span>
        <strong>${winnerRow.athlete.displayName}</strong>
      </div>
      <div class="score-chip">${formatter(winnerRow)}</div>
    </article>
  `;
}

function renderAthletes(athletes) {
  const container = document.getElementById("athletes");
  container.innerHTML = athletes.map(renderAthleteSection).join("");
}

function renderAthleteSection(athlete) {
  const latest = getLatestEvaluation(athlete);
  const previous = getPreviousEvaluation(athlete);
  const score = computeScore(athlete, latest);
  const scoreStatus =
    score >= 85 ? "acima da faixa-alvo" : score >= 70 ? "ritmo competitivo" : "janela de evolução";
  const report = buildAthleteReport(athlete, latest, previous);
  const powerStatus = getBenchmarkStatus(
    athlete,
    "relativeAveragePower",
    latest.metrics.relativeAveragePower
  );
  const jumpStatus = getBenchmarkStatus(athlete, "sljMeters", latest.sljMeters);
  const fatigueStatus = getBenchmarkStatus(
    athlete,
    "fatiguePercent",
    latest.metrics.fatiguePercent
  );

  return `
    <section class="panel athlete-section reveal" id="athlete-${athlete.id}">
      <div class="athlete-hero-grid">
        <article class="athlete-visual">
          <img class="athlete-poster" src="${athlete.heroImage}" alt="Foto de ${athlete.displayName}" style="object-position:${athlete.profileImagePosition || "center center"};" />
          <div class="athlete-overlay">
            <div class="athlete-head">
              <div>
                <span class="eyebrow">${athlete.displayName}</span>
                <h2>${athlete.fullName}</h2>
                <p>${athlete.sport} • Última coleta em ${formatDate(latest.date)}</p>
              </div>
              <div class="report-chips">
                <span class="status-pill status-${powerStatus.tone}">${powerStatus.label} em potência</span>
                <span class="status-pill status-${jumpStatus.tone}">${jumpStatus.label} no salto</span>
              </div>
            </div>
          </div>
        </article>

        <article class="glass-card athlete-summary">
          <div class="card-header">
            <div>
              <h3>Leitura automática do ciclo</h3>
              <span>${scoreStatus}</span>
            </div>
            <div class="athlete-actions">
              <button class="button button-secondary" type="button" data-print-athlete="${athlete.id}">
                Imprimir PDF
              </button>
            </div>
          </div>

          <div class="metrics-grid">
            ${renderMetricCard(
              "Score geral",
              `${score}`,
              "Leitura combinada de potência, fadiga e salto",
              null
            )}
            ${renderMetricCard(
              "Potência relativa média",
              `${formatNumber(latest.metrics.relativeAveragePower)} W/kg`,
              metricDelta(
                latest.metrics.relativeAveragePower,
                previous?.metrics.relativeAveragePower,
                true
              ),
              powerStatus
            )}
            ${renderMetricCard(
              "Índice de fadiga",
              `${formatCompact(latest.metrics.fatiguePercent, 1)}%`,
              metricDelta(latest.metrics.fatiguePercent, previous?.metrics.fatiguePercent, false),
              fatigueStatus
            )}
            ${renderMetricCard(
              "SLJ",
              `${formatNumber(latest.sljMeters)} m`,
              metricDelta(latest.sljMeters, previous?.sljMeters, true),
              jumpStatus
            )}
            ${renderMetricCard(
              "Melhor tiro",
              `${formatNumber(latest.metrics.bestTime)} s`,
              metricDelta(latest.metrics.bestTime, previous?.metrics.bestTime, false),
              null
            )}
            ${renderMetricCard(
              "IMC",
              `${formatNumber(latest.metrics.bmi)} kg/m²`,
              "Acompanhar sempre com idade e maturação biológica",
              null
            )}
          </div>

          <p>${report.summary}</p>
        </article>
      </div>

      <div class="detail-grid">
        <article class="glass-card chart-card">
          <div class="card-header">
            <div>
              <h3>Evolução no tempo</h3>
              <span>Potência relativa média, melhor tiro e salto horizontal.</span>
            </div>
          </div>
          <canvas id="historyChart-${athlete.id}" aria-label="Evolução histórica de ${athlete.displayName}"></canvas>
        </article>

        <article class="glass-card chart-card">
          <div class="card-header">
            <div>
              <h3>Leitura do RAST mais recente</h3>
              <span>Potência calculada tiro a tiro com foco em pico, sustentação e queda.</span>
            </div>
          </div>
          <canvas id="sprintChart-${athlete.id}" aria-label="Potência do RAST de ${athlete.displayName}"></canvas>
        </article>
      </div>

      <div class="detail-grid">
        <article class="glass-card">
          <div class="card-header">
            <div>
              <h3>Tabela completa do RAST</h3>
              <span>Zagatto/Draper: potência = peso x distância² / tempo³.</span>
            </div>
          </div>
          ${renderRastTable(latest)}
        </article>

        <article class="report-card">
          <div class="card-header">
            <div>
              <h3>Diagnóstico com IA</h3>
              <span>Próximo passo planejado, ainda não implementado.</span>
            </div>
          </div>
          ${renderFutureAiDiagnosticCard(athlete, latest)}
        </article>
      </div>

      <div class="detail-grid">
        <article class="glass-card">
          <div class="card-header">
            <div>
              <h3>Histórico de avaliações</h3>
              <span>Use os cards para acompanhar a linha do tempo e as fotos do shape.</span>
            </div>
          </div>
          <div class="history-list">
            ${athlete.evaluations
              .slice()
              .reverse()
              .map((evaluation) => renderTimelineCard(athlete, evaluation))
              .join("")}
          </div>
        </article>

        <article class="report-card">
          <div class="card-header">
            <div>
              <h3>Indicadores-chave da última coleta</h3>
              <span>Resumo para mandar no WhatsApp sem precisar montar relatório na mão.</span>
            </div>
          </div>
          <ul class="insight-list">
            <li><strong>Potência média:</strong> ${formatNumber(latest.metrics.meanPower)} W (${formatNumber(latest.metrics.relativeAveragePower)} W/kg).</li>
            <li><strong>Pico de potência:</strong> ${formatNumber(latest.metrics.peakPower)} W (${formatNumber(latest.metrics.relativePeakPower)} W/kg).</li>
            <li><strong>Potência mínima:</strong> ${formatNumber(latest.metrics.minPower)} W.</li>
            <li><strong>Índice de fadiga:</strong> ${formatNumber(latest.metrics.fatigueWs)} W/s e ${formatPercent(latest.metrics.fatiguePercent)}.</li>
            <li><strong>SLJ relativo:</strong> ${formatNumber(latest.metrics.sljHeightRatio)} x a estatura corporal.</li>
            <li><strong>Observações:</strong> ${latest.notes || "Sem observações registradas."}</li>
          </ul>
        </article>
      </div>
    </section>
  `;
}

function renderMetricCard(title, value, detail, status) {
  return `
    <article class="metric-card">
      <small>${title}</small>
      <strong>${value}</strong>
      ${detail ? `<div class="delta-chip">${detail}</div>` : ""}
      ${
        status
          ? `<div class="status-pill status-${status.tone}" style="margin-top:0.7rem;">${status.label}</div>`
          : ""
      }
    </article>
  `;
}

function renderRastTable(evaluation) {
  const peakIndex = evaluation.metrics.powers.indexOf(evaluation.metrics.peakPower);
  const minIndex = evaluation.metrics.powers.indexOf(evaluation.metrics.minPower);

  return `
    <table class="latest-rast-table">
      <thead>
        <tr>
          <th>Tiro</th>
          <th>Tempo</th>
          <th>Potência</th>
          <th>Fase</th>
        </tr>
      </thead>
      <tbody>
        ${evaluation.rastTimes
          .map((time, index) => {
            const phase = getSprintPhaseLabel(index, peakIndex, minIndex, evaluation.metrics.powers);
            return `
              <tr>
                <td>${index + 1}</td>
                <td>${formatNumber(time)} s</td>
                <td>${formatNumber(evaluation.metrics.powers[index])} W</td>
                <td>${phase}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function renderTimelineCard(athlete, evaluation) {
  return `
    <article class="timeline-card">
      <div class="timeline-head">
        <div>
          <strong>${formatDate(evaluation.date)}</strong>
          <div class="timeline-meta">${evaluation.age} anos • ${formatNumber(evaluation.weightKg, 1)} kg • ${formatNumber(evaluation.heightM)} m</div>
        </div>
        <div class="score-chip">${computeScore(athlete, evaluation)} pts</div>
      </div>

      <div class="history-metrics">
        <span>SLJ ${formatNumber(evaluation.sljMeters)} m</span>
        <span>Pot. rel. média ${formatNumber(evaluation.metrics.relativeAveragePower)} W/kg</span>
        <span>Fadiga ${formatCompact(evaluation.metrics.fatiguePercent, 1)}%</span>
      </div>

      <p class="history-notes">${evaluation.notes || "Sem observações registradas."}</p>

      ${
        evaluation.shapePhotos?.length
          ? `
            <div class="shape-gallery">
              ${evaluation.shapePhotos
                .map(
                  (photo, index) =>
                    `<img src="${photo.dataUrl}" alt="Shape de ${athlete.displayName} na coleta ${formatDate(evaluation.date)} - foto ${index + 1}" />`
                )
                .join("")}
            </div>
          `
          : ""
      }

      <div class="timeline-actions">
        <button class="delete-eval-btn" type="button" data-athlete-id="${athlete.id}" data-evaluation-id="${evaluation.id}">
          Remover coleta
        </button>
      </div>
    </article>
  `;
}

function getSprintPhaseLabel(index, peakIndex, minIndex, powers) {
  if (index === peakIndex) {
    return "Pico";
  }

  if (index === minIndex) {
    return "Potência mínima";
  }

  if (index === 0) {
    return "Aceleração inicial";
  }

  const previous = powers[index - 1];
  const current = powers[index];

  if (current > previous) {
    return "Reaceleração";
  }

  if (current < previous) {
    return "Queda progressiva";
  }

  return "Sustentação";
}

function buildAthleteReport(athlete, latest, previous) {
  const powerStatus = getBenchmarkStatus(
    athlete,
    "relativeAveragePower",
    latest.metrics.relativeAveragePower
  );
  const jumpStatus = getBenchmarkStatus(athlete, "sljMeters", latest.sljMeters);
  const fatigueStatus = getBenchmarkStatus(
    athlete,
    "fatiguePercent",
    latest.metrics.fatiguePercent
  );

  const powerTrend = previous
    ? latest.metrics.relativeAveragePower > previous.metrics.relativeAveragePower
      ? "subiu"
      : "caiu"
    : "abriu";
  const jumpTrend = previous
    ? latest.sljMeters > previous.sljMeters
      ? "ganho"
      : "queda"
    : "registro inicial";
  const fatigueTrend = previous
    ? latest.metrics.fatiguePercent < previous.metrics.fatiguePercent
      ? "melhor controle de fadiga"
      : "queda maior entre os tiros"
    : "leitura inicial";

  return {
    summary: `${athlete.displayName} chega nesta coleta com ${powerStatus.label.toLowerCase()} em potência relativa média, ${jumpStatus.label.toLowerCase()} no salto horizontal e ${fatigueStatus.label.toLowerCase()} na sustentação dos sprints. Em relação ao ciclo anterior, a potência ${powerTrend}, o salto mostrou ${jumpTrend} e a fadiga indica ${fatigueTrend}.`,
    bullets: [
      `Explosão de membros inferiores em ${formatNumber(latest.sljMeters)} m, equivalente a ${formatNumber(latest.metrics.sljHeightRatio)} vezes a estatura corporal.`,
      `Potência média de ${formatNumber(latest.metrics.meanPower)} W e potência relativa média de ${formatNumber(latest.metrics.relativeAveragePower)} W/kg.`,
      `Pico de potência em ${formatNumber(latest.metrics.peakPower)} W, com melhor tiro em ${formatNumber(latest.metrics.bestTime)} s.`,
      `Índice de fadiga de ${formatNumber(latest.metrics.fatigueWs)} W/s e ${formatPercent(latest.metrics.fatiguePercent)}, útil para enxergar resistência de potência no futebol.`,
      `IMC calculado em ${formatNumber(latest.metrics.bmi)} kg/m². Em crianças, a leitura deve sempre considerar idade, maturação e acompanhamento profissional.`,
      previous
        ? `Comparando com ${formatDate(previous.date)}, o salto variou ${metricDelta(latest.sljMeters, previous.sljMeters, true)} e o melhor tiro variou ${metricDelta(latest.metrics.bestTime, previous.metrics.bestTime, false)}.`
        : "Este é o primeiro registro no painel, então os próximos lançamentos já vão alimentar comparativos automáticos.",
    ],
  };
}

function renderFutureAiDiagnosticCard(athlete, latest) {
  return `
    <div class="ai-future-card">
      <div class="status-pill status-mid">Em breve</div>
      <p class="ai-future-text">
        No futuro, este quadro vai receber uma análise individual gerada por IA para o
        ${athlete.displayName}, usando os dados da coleta, o histórico anterior e um texto mais
        completo de diagnóstico, pontos de atenção e recomendações.
      </p>
      <div class="ai-future-example">
        <strong>Exemplo de como esse diagnóstico poderá aparecer:</strong>
        <p>
          "${athlete.displayName} apresentou potência relativa média de
          ${formatNumber(latest.metrics.relativeAveragePower)} W/kg, com melhor tiro em
          ${formatNumber(latest.metrics.bestTime)} s e salto horizontal de
          ${formatNumber(latest.sljMeters)} m. A leitura inicial sugere boa capacidade de explosão,
          enquanto o índice de fadiga de ${formatPercent(latest.metrics.fatiguePercent)} pede atenção
          à sustentação do desempenho ao longo das repetições. Em um próximo passo, a IA poderá
          transformar esse conjunto em um parecer mais completo, com linguagem profissional e
          comparações históricas."
        </p>
      </div>
    </div>
  `;
}

function populateAthleteSelect(athletes) {
  const select = document.getElementById("athleteId");
  const currentValue = select.value;
  select.innerHTML = athletes
    .map((athlete) => `<option value="${athlete.id}">${athlete.displayName}</option>`)
    .join("");

  if (currentValue) {
    select.value = currentValue;
  }
}

function ensureFormDate() {
  const dateInput = document.querySelector('input[name="date"]');

  if (!dateInput.value) {
    const today = new Date();
    const month = `${today.getMonth() + 1}`.padStart(2, "0");
    const day = `${today.getDate()}`.padStart(2, "0");
    dateInput.value = `${today.getFullYear()}-${month}-${day}`;
  }
}

function bindGlobalEvents() {
  const form = document.getElementById("evaluationForm");
  form.addEventListener("submit", handleFormSubmit);

  document.getElementById("shapePhotosInput").addEventListener("change", handleShapePreview);
  document.getElementById("exportJsonBtn").addEventListener("click", exportJsonBackup);
  document.getElementById("exportExcelBtn").addEventListener("click", exportExcelWorkbook);
  document.getElementById("importJsonBtn").addEventListener("click", () =>
    document.getElementById("importJsonInput").click()
  );
  document.getElementById("importJsonInput").addEventListener("change", importJsonBackup);
  document.getElementById("resetDataBtn").addEventListener("click", resetToFactoryData);

  document.body.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-evaluation-id]");
    const printButton = event.target.closest("[data-print-athlete]");

    if (deleteButton) {
      removeEvaluation(deleteButton.dataset.athleteId, deleteButton.dataset.evaluationId);
    }

    if (printButton) {
      printAthlete(printButton.dataset.printAthlete);
    }
  });

  window.addEventListener("afterprint", () => {
    delete document.body.dataset.printFocus;
  });
}

function bindSmoothAnchors() {
  document.addEventListener("click", (event) => {
    const anchor = event.target.closest('a[href^="#"]');

    if (!anchor) {
      return;
    }

    const targetId = anchor.getAttribute("href");

    if (!targetId || targetId === "#") {
      return;
    }

    const target = document.querySelector(targetId);

    if (!target) {
      return;
    }

    event.preventDefault();
    smoothScrollToElement(target);
    history.replaceState(null, "", targetId);
  });
}

function smoothScrollToElement(target) {
  target.classList.add("is-visible");
  const startY = window.scrollY;
  const topbar = document.querySelector(".topbar");
  const offset = (topbar?.offsetHeight || 0) + 18;
  const targetY = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
  const delta = targetY - startY;
  const duration = 900;
  const start = performance.now();

  function easeInOutCubic(progress) {
    return progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  }

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(progress);
    window.scrollTo(0, startY + delta * eased);

    if (progress < 1) {
      window.requestAnimationFrame(tick);
    }
  }

  window.requestAnimationFrame(tick);
}

async function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const athlete = state.athletes.find((entry) => entry.id === formData.get("athleteId"));
  const files = Array.from(document.getElementById("shapePhotosInput").files || []);
  const shapePhotos = await Promise.all(files.map(compressImageFile));

  const evaluation = {
    id: `${athlete.id}-${Date.now()}`,
    date: formData.get("date"),
    age: Number(formData.get("age")),
    weightKg: Number(formData.get("weightKg")),
    heightM: Number(formData.get("heightM")),
    sljMeters: Number(formData.get("sljMeters")),
    rastTimes: [1, 2, 3, 4, 5, 6].map((index) => Number(formData.get(`sprint${index}`))),
    notes: formData.get("notes")?.toString().trim(),
    shapePhotos,
  };

  athlete.evaluations.push(evaluation);
  athlete.evaluations.sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!persistState()) {
    athlete.evaluations = athlete.evaluations.filter((item) => item.id !== evaluation.id);
    return;
  }

  renderApp();
  form.reset();
  renderShapePreview([]);
  showToast(`Coleta de ${athlete.displayName} salva com sucesso.`);
  window.location.hash = `#athlete-${athlete.id}`;
}

async function handleShapePreview(event) {
  const files = Array.from(event.target.files || []);
  const previews = await Promise.all(files.map((file) => compressImageFile(file, true)));
  renderShapePreview(previews);
}

function renderShapePreview(previews) {
  const container = document.getElementById("shapePreview");

  if (!previews.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Nenhuma foto selecionada</strong>
        <span>Ao escolher as imagens, a prévia aparece aqui.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = previews
    .map((preview) => `<img src="${preview.dataUrl}" alt="Prévia da foto anexada" />`)
    .join("");
}

function compressImageFile(file, previewOnly = false) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxEdge = previewOnly ? 620 : 1280;
        const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", previewOnly ? 0.78 : 0.82);
        resolve({
          name: file.name,
          type: "image/jpeg",
          dataUrl,
        });
      };
      image.onerror = reject;
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function exportJsonBackup() {
  const payload = JSON.stringify(state, null, 2);
  downloadBlob(`${BASE_FILE_NAME}.json`, payload, "application/json;charset=utf-8");
  showToast("Backup JSON exportado.");
}

function exportExcelWorkbook() {
  if (typeof XLSX === "undefined") {
    showToast("A biblioteca de Excel não carregou.");
    return;
  }

  const athletes = getAthletesWithMetrics();
  const workbook = XLSX.utils.book_new();

  const summaryRows = athletes.map((athlete) => {
    const latest = getLatestEvaluation(athlete);
    return {
      Atleta: athlete.displayName,
      Data: latest.date,
      Idade: latest.age,
      Peso_kg: latest.weightKg,
      Altura_m: latest.heightM,
      SLJ_m: latest.sljMeters,
      Melhor_Tiro_s: latest.metrics.bestTime,
      Potencia_Media_W: Number(latest.metrics.meanPower.toFixed(2)),
      Potencia_Relativa_Media_Wkg: Number(latest.metrics.relativeAveragePower.toFixed(2)),
      Potencia_Pico_W: Number(latest.metrics.peakPower.toFixed(2)),
      Potencia_Relativa_Pico_Wkg: Number(latest.metrics.relativePeakPower.toFixed(2)),
      Fadiga_Ws: Number(latest.metrics.fatigueWs.toFixed(2)),
      Fadiga_Pct: Number(latest.metrics.fatiguePercent.toFixed(2)),
      IMC: Number(latest.metrics.bmi.toFixed(2)),
      Score: computeScore(athlete, latest),
    };
  });
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Resumo");

  athletes.forEach((athlete) => {
    const historyRows = athlete.evaluations.map((evaluation) => ({
      Data: evaluation.date,
      Idade: evaluation.age,
      Peso_kg: evaluation.weightKg,
      Altura_m: evaluation.heightM,
      SLJ_m: evaluation.sljMeters,
      IMC: Number(evaluation.metrics.bmi.toFixed(2)),
      Melhor_Tiro_s: Number(evaluation.metrics.bestTime.toFixed(2)),
      Tempo_Medio_s: Number(evaluation.metrics.meanTime.toFixed(2)),
      Potencia_Media_W: Number(evaluation.metrics.meanPower.toFixed(2)),
      Potencia_Relativa_Media_Wkg: Number(evaluation.metrics.relativeAveragePower.toFixed(2)),
      Potencia_Pico_W: Number(evaluation.metrics.peakPower.toFixed(2)),
      Potencia_Minima_W: Number(evaluation.metrics.minPower.toFixed(2)),
      Fadiga_Ws: Number(evaluation.metrics.fatigueWs.toFixed(2)),
      Fadiga_Pct: Number(evaluation.metrics.fatiguePercent.toFixed(2)),
      Notas: evaluation.notes || "",
    }));

    const sprintRows = athlete.evaluations.flatMap((evaluation) =>
      evaluation.rastTimes.map((time, index) => ({
        Data: evaluation.date,
        Sprint: index + 1,
        Tempo_s: Number(time.toFixed(2)),
        Potencia_W: Number(evaluation.metrics.powers[index].toFixed(2)),
      }))
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(historyRows),
      `${athlete.displayName.slice(0, 10)}_Hist`
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(sprintRows),
      `${athlete.displayName.slice(0, 10)}_RAST`
    );
  });

  XLSX.writeFile(workbook, `${BASE_FILE_NAME}.xlsx`);
  showToast("Planilha Excel exportada.");
}

function importJsonBackup(event) {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);

      if (!sanitizeState(parsed)) {
        throw new Error("Formato inválido.");
      }

      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, clone(parsed));
      persistState();
      renderApp();
      showToast("Backup importado com sucesso.");
    } catch (error) {
      console.error(error);
      showToast("Não consegui ler esse backup JSON.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function resetToFactoryData() {
  const confirmed = window.confirm(
    "Isso vai apagar as coletas salvas neste navegador e voltar para os dados iniciais. Quer continuar?"
  );

  if (!confirmed) {
    return;
  }

  const resetData = clone(BASE_DATA);
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, resetData);
  persistState();
  renderApp();
  showToast("Dados iniciais restaurados.");
}

function removeEvaluation(athleteId, evaluationId) {
  const athlete = state.athletes.find((entry) => entry.id === athleteId);

  if (!athlete || athlete.evaluations.length === 1) {
    showToast("Não removi essa coleta para não deixar o atleta sem histórico.");
    return;
  }

  const confirmed = window.confirm("Remover essa coleta do histórico?");

  if (!confirmed) {
    return;
  }

  athlete.evaluations = athlete.evaluations.filter((evaluation) => evaluation.id !== evaluationId);
  persistState();
  renderApp();
  showToast("Coleta removida.");
}

function printAthlete(athleteId) {
  document.body.dataset.printFocus = athleteId;
  window.setTimeout(() => window.print(), 80);
}

function downloadBlob(fileName, content, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2600);
}

function queueCharts(athletes) {
  renderCompareChart(athletes);
  athletes.forEach((athlete) => {
    renderHistoryChart(athlete);
    renderSprintChart(athlete);
  });
}

function destroyMissingCharts() {
  const existingIds = new Set(Array.from(document.querySelectorAll("canvas")).map((node) => node.id));
  Array.from(chartRegistry.keys()).forEach((chartId) => {
    if (!existingIds.has(chartId)) {
      chartRegistry.get(chartId)?.destroy();
      chartRegistry.delete(chartId);
    }
  });
}

function registerChart(chartId, instance) {
  chartRegistry.get(chartId)?.destroy();
  chartRegistry.set(chartId, instance);
}

function renderCompareChart(athletes) {
  const canvas = document.getElementById("compareChart");
  const context = canvas.getContext("2d");
  const latestRows = athletes.map((athlete) => {
    const latest = getLatestEvaluation(athlete);
    return {
      athlete,
      latest,
      powerScore: scoreFromMetric(
        latest.metrics.relativeAveragePower,
        athlete.benchmarks.relativeAveragePower,
        true
      ),
      fatigueScore: scoreFromMetric(
        latest.metrics.fatiguePercent,
        athlete.benchmarks.fatiguePercent,
        false
      ),
      jumpScore: scoreFromMetric(latest.sljMeters, athlete.benchmarks.sljMeters, true),
    };
  });

  registerChart(
    canvas.id,
    new Chart(canvas, {
      type: "radar",
      data: {
        labels: ["Potência", "Sustentação", "Salto"],
        datasets: latestRows.map((row) => ({
          label: row.athlete.displayName,
          data: [row.powerScore, row.fatigueScore, row.jumpScore],
          backgroundColor: createRadarFill(
            context,
            row.athlete.theme.accent,
            `${row.athlete.theme.accent}08`
          ),
          borderColor: row.athlete.theme.accent,
          pointBackgroundColor: row.athlete.theme.accentSoft,
          pointBorderColor: row.athlete.theme.accentSoft,
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        })),
      },
      options: buildChartOptions({
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            angleLines: {
              color: "rgba(255,255,255,0.08)",
            },
            grid: {
              color: "rgba(255,255,255,0.08)",
            },
            pointLabels: {
              color: "rgba(215, 230, 255, 0.88)",
              font: {
                family: "Space Grotesk",
              },
            },
            ticks: {
              color: "rgba(215, 230, 255, 0.68)",
              backdropColor: "transparent",
            },
          },
        },
      }),
    })
  );
}

function renderHistoryChart(athlete) {
  const canvas = document.getElementById(`historyChart-${athlete.id}`);
  const context = canvas.getContext("2d");

  registerChart(
    canvas.id,
    new Chart(canvas, {
      type: "line",
      data: {
        labels: athlete.evaluations.map((evaluation) => formatDate(evaluation.date)),
        datasets: [
          {
            label: "Potência relativa média (W/kg)",
            data: athlete.evaluations.map((evaluation) => evaluation.metrics.relativeAveragePower),
            borderColor: athlete.theme.accent,
            backgroundColor: createVerticalGradient(
              context,
              `${athlete.theme.accent}52`,
              `${athlete.theme.accent}00`
            ),
            tension: 0.35,
            fill: true,
            yAxisID: "y",
            pointRadius: 4,
          },
          {
            label: "SLJ (m)",
            data: athlete.evaluations.map((evaluation) => evaluation.sljMeters),
            borderColor: athlete.theme.accentSoft,
            backgroundColor: `${athlete.theme.accentSoft}22`,
            tension: 0.35,
            yAxisID: "y1",
            pointRadius: 4,
          },
          {
            label: "Melhor tiro (s)",
            data: athlete.evaluations.map((evaluation) => evaluation.metrics.bestTime),
            borderColor: "#7df4ff",
            backgroundColor: "#7df4ff22",
            borderDash: [6, 6],
            tension: 0.35,
            yAxisID: "y2",
            pointRadius: 4,
          },
          {
            label: "Fadiga (%)",
            data: athlete.evaluations.map((evaluation) => evaluation.metrics.fatiguePercent),
            borderColor: "#ff8ca3",
            backgroundColor: "#ff8ca320",
            borderDash: [10, 4],
            tension: 0.3,
            yAxisID: "y3",
            pointRadius: 4,
          },
        ],
      },
      options: buildChartOptions({
        scales: {
          y: buildLinearScale("Pot. rel.", false),
          y1: buildLinearScale("SLJ", false),
          y2: buildLinearScale("Melhor tiro", true),
          y3: buildLinearScale("Fadiga", false),
        },
      }),
    })
  );
}

function renderSprintChart(athlete) {
  const canvas = document.getElementById(`sprintChart-${athlete.id}`);
  const context = canvas.getContext("2d");
  const latest = getLatestEvaluation(athlete);
  const peakIndex = latest.metrics.powers.indexOf(latest.metrics.peakPower);
  const minIndex = latest.metrics.powers.indexOf(latest.metrics.minPower);

  registerChart(
    canvas.id,
    new Chart(canvas, {
      data: {
        labels: latest.rastTimes.map((_, index) => `Tiro ${index + 1}`),
        datasets: [
          {
            type: "bar",
            label: "Potência (W)",
            data: latest.metrics.powers,
            backgroundColor: latest.metrics.powers.map((_, index) => {
              if (index === peakIndex) return athlete.theme.accentSoft;
              if (index === minIndex) return "#ff6678";
              return athlete.theme.accent;
            }),
            borderRadius: 14,
            order: 2,
          },
          {
            type: "line",
            label: "Tempo (s)",
            data: latest.rastTimes,
            borderColor: "#7df4ff",
            backgroundColor: createVerticalGradient(context, "#7df4ff35", "#7df4ff00"),
            fill: true,
            yAxisID: "y1",
            tension: 0.34,
            pointRadius: 4,
            pointHoverRadius: 6,
            order: 1,
          },
          {
            type: "line",
            label: "Potência média (W)",
            data: latest.rastTimes.map(() => latest.metrics.meanPower),
            borderColor: "#ffffffaa",
            borderDash: [8, 6],
            pointRadius: 0,
            yAxisID: "y",
            order: 0,
          },
        ],
      },
      options: buildChartOptions({
        scales: {
          y: buildLinearScale("Potência", false),
          y1: buildLinearScale("Tempo", true),
        },
      }),
    })
  );
}

function createVerticalGradient(context, topColor, bottomColor) {
  const gradient = context.createLinearGradient(0, 0, 0, context.canvas.height || 320);
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(1, bottomColor);
  return gradient;
}

function createRadarFill(context, edgeColor, centerColor) {
  const radius = Math.max(context.canvas.width, context.canvas.height) || 420;
  const gradient = context.createRadialGradient(
    context.canvas.width / 2,
    context.canvas.height / 2,
    12,
    context.canvas.width / 2,
    context.canvas.height / 2,
    radius
  );
  gradient.addColorStop(0, `${edgeColor}50`);
  gradient.addColorStop(1, centerColor);
  return gradient;
}

function buildChartOptions(overrides = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    elements: {
      line: {
        borderWidth: 2.5,
      },
    },
    plugins: {
      legend: {
        labels: {
          color: "#d7e6ff",
          font: {
            family: "Space Grotesk",
          },
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 8,
        },
      },
      tooltip: {
        backgroundColor: "rgba(7, 17, 31, 0.92)",
        titleColor: "#ffffff",
        bodyColor: "#d7e6ff",
        borderColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        padding: 12,
      },
    },
    scales: {
      x: {
        ticks: {
          color: "rgba(215, 230, 255, 0.8)",
        },
        grid: {
          color: "rgba(255,255,255,0.06)",
          drawBorder: false,
        },
      },
      y: buildLinearScale("Valor", false),
    },
    ...overrides,
  };
}

function buildLinearScale(title, reverse) {
  return {
    beginAtZero: !reverse,
    reverse,
    ticks: {
      color: "rgba(215, 230, 255, 0.8)",
      padding: 8,
    },
    title: {
      display: true,
      text: title,
      color: "rgba(215, 230, 255, 0.8)",
    },
    grid: {
      color: "rgba(255,255,255,0.06)",
      drawBorder: false,
    },
  };
}

function setupRevealObserver() {
  const items = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.04, rootMargin: "0px 0px -8% 0px" }
  );

  items.forEach((item) => observer.observe(item));
}
