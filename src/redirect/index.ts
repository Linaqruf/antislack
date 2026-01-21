import { getSettings, getBlockedSites, setBlockedSites } from '../lib/storage';
import { generateMathProblem, checkAnswer, MathProblem } from '../lib/math';
import { addBypassSession } from '../lib/bypass';
import { recordBlockAttempt, recordBypassAttempt, getUsageStats, calculateStreak } from '../lib/stats';
import { isNuclearModeActive, getRemainingTime, formatRemainingTime } from '../lib/nuclear';

// Motivational quotes pool
const quotes = [
  { text: "Stay on target. Stay on target.", author: "Gold Five" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Focus is saying no to 1,000 good ideas.", author: "Steve Jobs" },
  { text: "Houston, we are go for launch.", author: "Mission Control" },
  { text: "One small step for focus, one giant leap for productivity.", author: "Anonymous" },
  { text: "The obstacle is the way.", author: "Marcus Aurelius" },
  { text: "What you do today matters.", author: "Anonymous" },
  { text: "Discipline equals freedom.", author: "Jocko Willink" },
  { text: "Where focus goes, energy flows.", author: "Tony Robbins" },
  { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
];

let currentProblem: MathProblem | null = null;
let blockedDomain: string | null = null;
let nuclearCountdownInterval: ReturnType<typeof setInterval> | null = null;

function getRandomQuote() {
  return quotes[Math.floor(Math.random() * quotes.length)];
}

// Nuclear mode countdown functions
function startNuclearCountdown() {
  // Clear existing interval first to prevent memory leak
  if (nuclearCountdownInterval) {
    clearInterval(nuclearCountdownInterval);
  }
  updateNuclearDisplay();
  nuclearCountdownInterval = setInterval(updateNuclearDisplay, 1000);
}

async function updateNuclearDisplay() {
  const remaining = await getRemainingTime();

  if (remaining <= 0) {
    // Nuclear mode expired, refresh page to restore normal mode
    if (nuclearCountdownInterval) {
      clearInterval(nuclearCountdownInterval);
    }
    location.reload();
    return;
  }

  const { hours, minutes, seconds } = formatRemainingTime(remaining);

  const hoursEl = document.getElementById('nuclear-hours');
  const minutesEl = document.getElementById('nuclear-minutes');
  const secondsEl = document.getElementById('nuclear-seconds');

  if (hoursEl) hoursEl.textContent = hours;
  if (minutesEl) minutesEl.textContent = minutes;
  if (secondsEl) secondsEl.textContent = seconds;
}

// Clean up interval on page unload to prevent memory leaks
window.addEventListener('beforeunload', () => {
  if (nuclearCountdownInterval) {
    clearInterval(nuclearCountdownInterval);
    nuclearCountdownInterval = null;
  }
});

async function init() {
  try {
    const params = new URLSearchParams(window.location.search);
    blockedDomain = params.get('blocked');

  const domainEl = document.getElementById('blocked-domain');
  const quoteEl = document.getElementById('motivational-quote');
  const quoteAuthorEl = document.getElementById('quote-author');
  const productiveBtn = document.getElementById('productive-btn') as HTMLButtonElement;
  const bypassBtn = document.getElementById('bypass-btn') as HTMLButtonElement;
  const blockCountEl = document.getElementById('block-count');
  const streakDisplayEl = document.getElementById('streak-display');
  const settingsLink = document.getElementById('settings-link');

  // Math section elements
  const mainContent = document.getElementById('main-content');
  const mathSection = document.getElementById('math-section');
  const mathDomainEl = document.getElementById('math-domain');
  const bypassDurationEl = document.getElementById('bypass-duration');
  const mathQuestionEl = document.getElementById('math-question');
  const mathAnswerInput = document.getElementById('math-answer') as HTMLInputElement;
  const mathErrorEl = document.getElementById('math-error');
  const mathSuccessEl = document.getElementById('math-success');
  const submitAnswerBtn = document.getElementById('submit-answer-btn') as HTMLButtonElement;
  const cancelBypassBtn = document.getElementById('cancel-bypass-btn') as HTMLButtonElement;

  // Display blocked domain
  if (domainEl && blockedDomain) {
    domainEl.textContent = blockedDomain;
  }

  // Display random motivational quote
  const quote = getRandomQuote();
  if (quoteEl) {
    quoteEl.textContent = `"${quote.text}"`;
  }
  if (quoteAuthorEl) {
    quoteAuthorEl.textContent = `— ${quote.author}`;
  }

  // Load settings for productive redirect URL
  const settings = await getSettings();

  // Check for nuclear mode
  const { active: nuclearActive, error: nuclearError } = await isNuclearModeActive();
  const nuclearWarning = document.getElementById('nuclear-warning');

  // If there's an error checking nuclear mode, fail-safe to showing it as active
  if (nuclearError) {
    console.warn('AntiSlack: Could not verify nuclear mode:', nuclearError);
  }

  if (nuclearActive) {
    // Show nuclear warning bar
    if (nuclearWarning) nuclearWarning.classList.remove('hidden');
    // Hide bypass button completely
    if (bypassBtn) bypassBtn.style.display = 'none';
    // Start countdown timer
    startNuclearCountdown();
  }

  // Load and display streak
  const stats = await getUsageStats();
  const streak = calculateStreak(stats);
  if (streakDisplayEl) {
    streakDisplayEl.textContent = `${streak} day${streak !== 1 ? 's' : ''}`;
  }

  // Update bypass duration display
  if (bypassDurationEl) {
    bypassDurationEl.textContent = settings.bypassDurationMinutes.toString();
  }

  // Productive button redirects to default URL
  if (productiveBtn) {
    productiveBtn.addEventListener('click', () => {
      window.location.href = settings.defaultRedirectUrl;
    });
  }

  // Bypass button shows math problem
  if (bypassBtn) {
    if (settings.showBypassOption) {
      bypassBtn.addEventListener('click', () => {
        showMathSection();
      });
    } else {
      bypassBtn.style.display = 'none';
    }
  }

  // Update block count and increment it (debounced to prevent inflation on refresh)
  if (blockedDomain) {
    const sites = await getBlockedSites();
    const site = sites.find(
      (s) => s.pattern === blockedDomain || blockedDomain.endsWith('.' + s.pattern)
    );

    if (site) {
      // Use sessionStorage to debounce - only count once per 10-second window
      const sessionKey = `blocked-${blockedDomain}-${Math.floor(Date.now() / 10000)}`;

      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, 'true');

        // Increment block count
        site.blockCount++;
        await setBlockedSites(sites);

        // Record block attempt in stats
        await recordBlockAttempt(blockedDomain);
      }

      // Display current count regardless of whether we incremented
      if (blockCountEl) {
        blockCountEl.textContent = site.blockCount.toString();
      }
    }
  }

  // Settings link opens options page
  if (settingsLink) {
    settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  // --- Math Section Logic ---

  function showMathSection() {
    if (mainContent) mainContent.classList.add('hidden');
    if (mathSection) mathSection.classList.remove('hidden');
    if (mathDomainEl && blockedDomain) mathDomainEl.textContent = blockedDomain;

    // Generate a new problem
    generateNewProblem();

    // Focus the input
    if (mathAnswerInput) {
      mathAnswerInput.value = '';
      mathAnswerInput.focus();
    }
  }

  function hideMathSection() {
    if (mainContent) mainContent.classList.remove('hidden');
    if (mathSection) mathSection.classList.add('hidden');
    if (mathErrorEl) mathErrorEl.classList.add('hidden');
    if (mathSuccessEl) mathSuccessEl.classList.add('hidden');
  }

  function generateNewProblem() {
    currentProblem = generateMathProblem(settings.mathDifficulty);
    if (mathQuestionEl && currentProblem) {
      mathQuestionEl.textContent = `${currentProblem.question} = ?`;
    }
    if (mathErrorEl) mathErrorEl.classList.add('hidden');
    if (mathAnswerInput) {
      mathAnswerInput.value = '';
      mathAnswerInput.focus();
    }
  }

  async function handleSubmitAnswer() {
    if (!currentProblem || !mathAnswerInput || !blockedDomain) return;

    const userAnswer = parseInt(mathAnswerInput.value, 10);

    if (isNaN(userAnswer)) {
      if (mathErrorEl) {
        const errorText = mathErrorEl.querySelector('p');
        if (errorText) errorText.textContent = 'Please enter a number.';
        mathErrorEl.classList.remove('hidden');
      }
      return;
    }

    if (checkAnswer(currentProblem, userAnswer)) {
      // Correct answer!
      if (mathErrorEl) mathErrorEl.classList.add('hidden');
      if (mathSuccessEl) mathSuccessEl.classList.remove('hidden');
      if (submitAnswerBtn) submitAnswerBtn.disabled = true;
      if (mathAnswerInput) mathAnswerInput.disabled = true;

      // Record successful bypass attempt with difficulty
      await recordBypassAttempt(blockedDomain, true, settings.mathDifficulty);

      // Grant bypass session
      await addBypassSession(blockedDomain, settings.bypassDurationMinutes);

      // Redirect to the blocked site after a short delay
      setTimeout(() => {
        window.location.href = `https://${blockedDomain}`;
      }, 1500);
    } else {
      // Wrong answer - show error and generate new problem
      // Record failed bypass attempt
      await recordBypassAttempt(blockedDomain, false);

      if (mathErrorEl) {
        const errorText = mathErrorEl.querySelector('p');
        if (errorText) errorText.textContent = 'Incorrect. New challenge generated.';
        mathErrorEl.classList.remove('hidden');
      }

      // Shake the input field
      if (mathAnswerInput) {
        mathAnswerInput.classList.add('animate-shake');
        setTimeout(() => mathAnswerInput.classList.remove('animate-shake'), 500);
      }

      // Generate a new problem
      generateNewProblem();
    }
  }

  // Submit answer button
  if (submitAnswerBtn) {
    submitAnswerBtn.addEventListener('click', handleSubmitAnswer);
  }

  // Handle Enter key in input
  if (mathAnswerInput) {
    mathAnswerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleSubmitAnswer();
      }
    });
  }

  // Cancel bypass button
  if (cancelBypassBtn) {
    cancelBypassBtn.addEventListener('click', () => {
      hideMathSection();
    });
  }
  } catch (error) {
    console.error('AntiSlack: Redirect page initialization error:', error);
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <h2 style="color: #BFFF00;">Error Loading AntiSlack</h2>
          <p style="color: #666;">Please try reloading the page.</p>
        </div>
      `;
    }
  }
}

init();
