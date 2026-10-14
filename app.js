import { createHomeHero } from "./hero.js";
import { copy } from "./copy.js";
import { createPresence } from "./presence.js";
import { createAlignment } from "./alignment.js";
const WAITLIST_ENDPOINT = "https://script.google.com/macros/s/AKfycbwN3xRW_DM05LIjXte12CIrqhf9-hgpzs75bE2ANSNNDSmDiThZ3G8fk4vf-oqAJje9SA/exec";
let destroyAlignments = () => {};
let homeHero;

const params = new URLSearchParams(location.search);
let locale = Object.hasOwn(copy, params.get("lang"))
  ? params.get("lang")
  : "en";
let activeDialog = null;
let replayTimers = [];
let conversationObserver;
let finishConversation = () => {};
const dialog = document.querySelector("#info-dialog");
function syncDialogViewport() {
  if (!dialog.open) return;
  const viewport = window.visualViewport;
  const height = viewport?.height ?? innerHeight;
  const top = viewport?.offsetTop ?? 0;
  dialog.style.setProperty("--dialog-top", `${top}px`);
  dialog.style.setProperty(
    "--dialog-bottom",
    `${Math.max(0, innerHeight - height - top)}px`,
  );
  dialog.style.setProperty("--dialog-height", `${height}px`);
  // Keep the focused field above a mobile keyboard after the visual area shrinks.
  const field = dialog.querySelector("input:focus, textarea:focus");
  if (field) requestAnimationFrame(() => {
    if (dialog.open && document.activeElement === field)
      field.scrollIntoView({ block: "nearest", behavior: "instant" });
  });
}
window.visualViewport?.addEventListener("resize", syncDialogViewport);
window.visualViewport?.addEventListener("scroll", syncDialogViewport);
window.addEventListener("resize", syncDialogViewport);
const icons = [
  '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M11 24c0-8 6-14 13-14s13 6 13 14M6 24C6 13 14 5 24 5s18 8 18 19M17 24c0-5 3-8 7-8s7 3 7 8-3 8-7 8m-13-8c0 11 6 18 15 18"/></svg>',
  '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M7 39V9h27v30H7Zm7 0V12l20-7v34l-20 5v-5Z"/><path d="M23 25h3M35 39h7"/></svg>',
  '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><circle cx="19" cy="24" r="13"/><circle cx="29" cy="24" r="13"/><path d="M24 5v4m0 30v4"/></svg>',
  '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M24 4 7 11v12c0 10 7 16 17 21 10-5 17-11 17-21V11L24 4Z"/><rect x="16" y="21" width="16" height="13" rx="3"/><path d="M19 21v-5a5 5 0 0 1 10 0v5m-5 5v3"/></svg>',
];
function stopReplay() {
  replayTimers.forEach(clearTimeout);
  replayTimers = [];
}
function sections(c) {
  return `<nav class="journey-nav" aria-label="${c.journey}">${[
    ["top", c.navStart],
    ["experience", c.navExperience],
    ["approach", c.navApproach],
    ["story", c.navStory],
    ["questions", c.navQuestions],
    ["join", c.join],
  ]
    .map(
      ([id, label]) =>
        `<a href="#${id}" aria-label="${label}"><span class="journey-dot" aria-hidden="true"></span><span class="journey-label">${label}</span></a>`,
    )
    .join(
      "",
    )}</nav><section class="experience section" id="experience"><div class="wrap experience-grid">
  <div class="section-intro reveal"><p class="eyebrow">${c.experienceEyebrow}</p><h2>${c.experienceTitle}</h2><p>${c.experienceBody}</p></div>
  <div class="conversation-space"><div class="connection-halo" aria-hidden="true"></div><div class="chat reveal" role="group" aria-label="${c.chatLabel}"><div class="chat-header"><span class="chat-glyph" aria-hidden="true"><i></i></span><div><strong>Hugr</strong><small>${c.chatSubtitle}</small></div><span class="chat-label">${c.chatLabel}</span></div>
   <div class="chat-message"><span class="chat-speaker">Hugr</span><p>${c.chatOne}</p></div>
   <div class="chat-message user"><span class="chat-speaker">${c.you}</span><p>${c.chatTwo}</p></div>
   <div class="chat-message"><span class="chat-speaker">Hugr</span><p>${c.chatThree}</p></div>
  </div></div>
 </div></section>
 ${c.conceptionTitle ? `<section class="conception section wrap" id="conception"><div class="section-intro reveal"><p class="eyebrow">${c.conceptionEyebrow}</p><h2>${c.conceptionTitle}</h2>${c.conceptionBody}${c.conceptionClose ? `<p class="conception-close">${c.conceptionClose}</p>` : ""}</div></section>` : ""}
 <section class="principles section wrap" id="approach"><p class="eyebrow reveal">${c.principlesEyebrow}</p><div class="intro-row reveal"><h2>${c.principlesTitle}</h2><p>${c.principlesBody}</p></div><div class="principle-grid"><div class="principle-thread" aria-hidden="true"></div>${c.principles.map((p, i) => `<article class="principle reveal"><div class="principle-top"><span class="section-number">0${i + 1}</span><span class="principle-symbol">${icons[i]}</span></div><div class="principle-copy"><h3>${p.title}</h3><p>${p.text}</p></div></article>`).join("")}</div></section>
 <section class="statement" id="heart"><div class="heart-beacon" aria-hidden="true"><span></span><span></span><i></i></div><p class="eyebrow reveal">${c.statementEyebrow}</p><blockquote class="reveal">${c.statement}</blockquote><p class="statement-bottom reveal">${c.statementBottom}</p></section>
 <section class="story section wrap" id="story"><div class="story-grid"><figure class="portrait reveal"><img src="./assets/peter.jpg" alt="${c.founder}" width="600" height="600" loading="lazy"><figcaption><strong>${c.founder}</strong>${c.founderRole}</figcaption></figure><div class="story-text reveal"><p class="eyebrow">${c.storyEyebrow}</p><h2>${c.storyTitle}</h2><p>${c.storyOne}</p><p>${c.storyTwo}</p><p>${c.storyThree}</p><p class="signature">${c.storySignature}</p><button type="button" class="small-link story-more" aria-expanded="false" aria-controls="story-full"><span>${c.storyMore}</span><span aria-hidden="true">+</span></button><div class="story-full" id="story-full" hidden>${c.storyFull.map((p) => `<p>${p}</p>`).join("")}</div></div></div></section>
 <section class="faq section wrap" id="questions"><div class="faq-heading reveal"><p class="eyebrow">${c.faqEyebrow}</p><h2>${c.faqTitle}</h2><p>${c.faqIntro}</p><a class="small-link" href="mailto:hello@byhugr.io">${c.faqContact}<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 18 18 6M6 6h12v12"/></svg></a></div><div class="faq-list reveal">${c.faq.slice(0, 5).map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</div>${c.faqAll ? `<a class="small-link faq-all reveal" href="questions.html?lang=${locale}">${c.faqAll}<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 18 18 6M6 6h12v12"/></svg></a>` : ""}</section>
 <section class="join" id="join"><div class="alignment-scene"><canvas id="alignment" aria-hidden="true"></canvas><span class="alignment-person">${c.joinCenter}</span></div><p class="eyebrow">${c.joinEyebrow}</p><h2>${c.joinTitle}</h2><p>${c.joinBody}</p><button type="button" class="button" data-dialog="waitlist"><span>${c.join}</span><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 18 18 6M6 6h12v12"/></svg></button><small class="join-note">${c.joinNote}</small></section>`;
}
function footer(c) {
  return `<footer class="site-footer wrap"><div class="footer-top"><div class="footer-brand"><a href="#top" class="wordmark" aria-label="${c.home}">HU<span>G</span>R</a><p>${c.footerLine}</p></div><div class="footer-links"><button data-dialog="privacy">${c.privacy}</button><button data-dialog="support">${c.support}</button><a href="mailto:hello@byhugr.io">${c.contact}<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 18 18 6M6 6h12v12"/></svg></a></div></div><div class="footer-bottom"><div><p>${c.footerMaker}</p><p>${c.footerCompany}</p></div><p class="disclaimer">${c.footerDisclaimer}</p></div></footer>`;
}
function render() {
  destroyAlignments();
  stopReplay();
  conversationObserver?.disconnect();
  const c = copy[locale];
  homeHero?.setLocale(c);
  document.documentElement.lang = locale === "nl" ? "nl-BE" : locale;
  document.title = c.title;
  document.querySelector('meta[name="description"]').content = c.description;
  for (const el of document.querySelectorAll("[data-i18n]"))
    el.innerHTML = c[el.dataset.i18n];
  document
    .querySelectorAll("[data-lang]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.lang === locale)),
    );
  document
    .querySelector(".site-header .wordmark")
    .setAttribute("aria-label", c.home);
  document
    .querySelector(".desktop-nav")
    .setAttribute("aria-label", c.navigation);
  document.querySelector(".languages").setAttribute("aria-label", c.language);
  const questionsNav = document.querySelector('.desktop-nav a[data-nav="questions"]');
  if (questionsNav) questionsNav.href = `questions.html?lang=${locale}`;
  document.querySelector(".dialog-close").setAttribute("aria-label", c.close);
  document.querySelector("#store-preview").innerHTML =
    `<div class="store-badges"><button type="button" class="store-badge apple-badge" disabled aria-label="${c.appStoreUnavailable}"><img src="./assets/app-store-en.svg" alt="" width="120" height="40"></button><button type="button" class="store-badge play-badge play-${locale}" disabled aria-label="${c.googlePlayUnavailable}"><img src="./assets/google-play-${locale}.png" alt="" width="646" height="250"></button></div><span class="store-soon">${c.storeSoon}</span>`;
  document.querySelector("#page-sections").innerHTML = sections(c);
  document.querySelector("#page-footer").innerHTML = footer(c);
  const alignmentCleanup = [
    createAlignment(document.querySelector("#alignment"), { showCore: false }),
  ];
  destroyAlignments = () => alignmentCleanup.forEach((cleanup) => cleanup());
  document.querySelector(".story-more").addEventListener("click", (e) => {
    const b = e.currentTarget;
    const open = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", String(open));
    document.querySelector("#story-full").hidden = !open;
    b.innerHTML = `<span>${open ? c.storyLess : c.storyMore}</span><span aria-hidden="true">${open ? "−" : "+"}</span>`;
  });
  prepareConversation(c);
  reveal();
  observeJourney();
  if (activeDialog) renderDialog(activeDialog);
}
// Reveal the illustrative conversation only when the card is actually in view.
function prepareConversation(c) {
  const chat = document.querySelector(".chat");
  const messages = [...chat.querySelectorAll(".chat-message")];
  const replay = chat.querySelector(".replay") || { addEventListener() {} };
  const quiet = () =>
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.classList.contains("motion-paused");
  let started = false;
  const waiting = (message, value) => {
    message.classList.toggle("is-waiting", value);
    message.setAttribute("aria-hidden", String(value));
  };
  finishConversation = () => {
    stopReplay();
    messages.forEach((m) => waiting(m, false));
    chat.dataset.playback = "complete";
    chat.classList.remove("is-playing");
    replay.disabled = false;
    replay.innerHTML = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></svg><span>${c.replay}</span>`;
  };
  const play = () => {
    if (quiet()) {
      finishConversation();
      return;
    }
    started = true;
    stopReplay();
    messages.forEach((m) => waiting(m, true));
    chat.dataset.playback = "playing";
    chat.classList.add("is-playing");
    replay.disabled = true;
    replay.innerHTML = `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></svg><span>${c.playing}</span>`;
    [120, 780, 1440].forEach((delay, i) =>
      replayTimers.push(
        setTimeout(() => {
          waiting(messages[i], false);
          if (i === messages.length - 1) finishConversation();
        }, delay),
      ),
    );
  };
  replay.addEventListener("click", play);
  if (quiet()) {
    finishConversation();
    return;
  }
  chat.dataset.playback = "waiting";
  messages.forEach((m) => waiting(m, true));
  conversationObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !started) play();
        else if (!entry.isIntersecting && chat.dataset.playback === "playing") {
          stopReplay();
          started = false;
          chat.dataset.playback = "waiting";
          chat.classList.remove("is-playing");
          messages.forEach((m) => waiting(m, true));
        }
      }
    },
    { threshold: 0.2 },
  );
  conversationObserver.observe(chat);
}
document.addEventListener("hugr-motion", (e) => {
  if (e.detail.paused) finishConversation();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopReplay();
  } else if (document.querySelector('.chat[data-playback="playing"]'))
    finishConversation();
});

let journeyObserver;
function observeJourney() {
  journeyObserver?.disconnect();
  journeyObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          document.querySelectorAll(".journey-nav a").forEach((a) => {
            const section =
              entry.target.id === "hero" ? "top" : entry.target.id;
            const current = a.hash === "#" + section;
            if (current) a.setAttribute("aria-current", "location");
            else a.removeAttribute("aria-current");
          });
        }
    },
    { rootMargin: "-25% 0px -45% 0px" },
  );
  document
    .querySelectorAll("#hero,#experience,#conception,#approach,#story,#questions,#join")
    .forEach((el) => journeyObserver.observe(el));
}
let observer;
function reveal() {
  observer?.disconnect();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.documentElement.classList.add("motion-enabled");
  observer = new IntersectionObserver(
    (es) =>
      es.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.remove("pending");
          observer.unobserve(e.target);
        }
      }),
    { threshold: 0.06 },
  );
  document.querySelectorAll(".reveal").forEach((el) => {
    el.classList.add("pending");
    observer.observe(el);
  });
}
function renderDialog(kind) {
  const c = copy[locale];
  let content = "";
  if (kind === "waitlist") {
    content = `<div class="waitlist-intro"><span class="threshold-light" aria-hidden="true"></span><h2 id="dialog-title">${c.waitlistTitle}</h2><p class="waitlist-body">${c.waitlistBody}</p><form class="waitlist-form" novalidate><label class="sr-only" for="waitlist-email">${c.emailLabel}</label><div class="email-line"><input id="waitlist-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="${c.emailPlaceholder}" aria-describedby="waitlist-feedback" required><button type="submit"><span>${c.emailSubmit}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div><label class="waitlist-consent"><input type="checkbox" id="waitlist-consent" required /><span>${c.consentLabel}</span></label><p id="waitlist-feedback" class="form-feedback" role="status" aria-live="polite"></p></form></div>`;
  } else if (kind === "privacy")
    content = `<p class="eyebrow">${c.privacy}</p><h2 id="dialog-title">${c.privacyTitle.replaceAll("<br>", " ")}</h2><p>${c.privacyIntro}</p>${c.privacyHeadings.map((h, i) => `<h3>${h}</h3><p>${c.privacyBodies[i]}</p>`).join("")}<p><a href="${locale === "fr" ? "/fr/privacy" : "/privacy"}" target="_blank" rel="noopener noreferrer">${c.privacyLink} <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 18 18 6M6 6h12v12"/></svg></a></p><p class="policy-note">${c.privacyNote}</p>`;
  else
    content = `<p class="eyebrow">${c.support}</p><h2 id="dialog-title">${c.supportTitle.replaceAll("<br>", " ")}</h2><p>${c.supportIntro}</p><h3>${c.supportUrgentTitle}</h3><p>${c.supportUrgent}</p><h3>${c.supportLinesTitle}</h3><ul><li>${c.supportNl} : <a href="tel:1813">1813</a> · <a href="https://www.zelfmoord1813.be/" target="_blank" rel="noopener noreferrer">Zelfmoordlijn</a> / <a href="tel:106">106</a> · <a href="https://www.tele-onthaal.be/" target="_blank" rel="noopener noreferrer">Tele-Onthaal</a></li><li>${c.supportFr} : <a href="tel:080032123">0800 32 123</a> · <a href="https://www.preventionsuicide.be/" target="_blank" rel="noopener noreferrer">Centre de Prévention du Suicide</a> / <a href="tel:107">107</a> · <a href="https://tele-accueil.be/" target="_blank" rel="noopener noreferrer">Télé-Accueil</a></li></ul><p><a href="https://findahelpline.com/" target="_blank" rel="noopener noreferrer">${c.supportElsewhere}</a></p><h3>${c.supportContactTitle}</h3><p>${c.supportContact}</p><h3>${c.supportAvailabilityTitle}</h3><p>${c.supportAvailability}</p><h3>${c.supportBrokenTitle}</h3><p>${c.supportBroken}</p>`;
  dialog.classList.toggle("waitlist-dialog", kind === "waitlist");
  dialog.classList.toggle("content-dialog", kind !== "waitlist");
  document.querySelector("#dialog-content").innerHTML =
    `<div class="dialog-body">${kind !== "waitlist" ? '<span class="threshold-light" aria-hidden="true"></span>' : ""}${content}</div>`;
  if (kind === "waitlist") {
    const form = dialog.querySelector("form");
    const email = form.querySelector("input");
    const feedback = form.querySelector(".form-feedback");
    email.addEventListener("input", () => {
      email.removeAttribute("aria-invalid");
      feedback.textContent = "";
      form.classList.remove("preview-sent");
    });
    const consent = form.querySelector("#waitlist-consent");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!email.validity.valid) {
        email.setAttribute("aria-invalid", "true");
        feedback.textContent = c.emailInvalid;
        email.focus();
        return;
      }
      if (!consent.checked) {
        feedback.textContent = c.consentRequired;
        consent.focus();
        return;
      }
      email.removeAttribute("aria-invalid");
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      const data = {
        email: email.value.trim(),
        language: locale,
        source: params.get("source") || params.get("from") || "website",
        consent: true,
        consent_text: c.consentLabel,
        signed_up_at: new Date().toISOString(),
      };
      fetch(WAITLIST_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(data),
      })
        .then(() => {
          const intro = dialog.querySelector(".waitlist-intro");
          if (intro) {
            intro.classList.add("is-confirmed");
            intro.innerHTML =
              `<span class="threshold-light" aria-hidden="true"></span>` +
              `<div class="waitlist-done" role="status" aria-live="polite">` +
              `<span class="done-halo" aria-hidden="true"><span class="done-ring"></span>` +
              `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>` +
              `<p class="done-text">${c.waitlistSuccess}</p></div>`;
          } else {
            form.classList.add("preview-sent");
            feedback.textContent = c.waitlistSuccess;
          }
        })
        .catch(() => {
          submit.disabled = false;
          feedback.textContent = c.waitlistError;
        });
    });
  }
}
document.addEventListener("click", (e) => {
  const trigger = e.target.closest("[data-dialog]");
  if (trigger) {
    activeDialog = trigger.dataset.dialog;
    renderDialog(activeDialog);
    clearTimeout(closeTimer);
    dialog.classList.remove("is-closing");
    dialog.showModal();
    document.body.classList.add("dialog-open");
    syncDialogViewport();
    document.dispatchEvent(
      new CustomEvent("hugr-dialog", { detail: { open: true } }),
    );
    document.querySelector("#dialog-content").scrollTop = 0;
    document.body.style.overflow = "hidden";
  }
});
dialog.querySelector(".dialog-close").addEventListener("click", closeDialog);
let closeTimer;
function closeDialog() {
  if (!dialog.open || dialog.classList.contains("is-closing")) return;
  dialog.classList.add("is-closing");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) dialog.close();
  else closeTimer = setTimeout(() => dialog.close(), 180);
}
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeDialog();
});
dialog.addEventListener("close", () => {
  // A native close event can arrive after another dialog has already opened.
  if (dialog.open) return;
  clearTimeout(closeTimer);
  activeDialog = null;
  document.body.classList.remove("dialog-open");
  document.dispatchEvent(
    new CustomEvent("hugr-dialog", { detail: { open: false } }),
  );
  document.body.style.overflow = "";
});
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeDialog();
  }
});
document.querySelectorAll("[data-lang]").forEach((b) =>
  b.addEventListener("click", () => {
    if (locale === b.dataset.lang) return;
    locale = b.dataset.lang;
    const u = new URL(location.href);
    u.searchParams.set("lang", locale);
    history.replaceState(null, "", u);
    render();
  }),
);
render();
createPresence(document.querySelector("#presence"));
homeHero = await createHomeHero(copy[locale]);
homeHero.setLocale(copy[locale]);

function updateProgress() {
  const max = document.documentElement.scrollHeight - innerHeight;
  document.querySelector(".reading-progress").style.transform =
    `scaleX(${max > 0 ? scrollY / max : 0})`;
  document.body.classList.toggle("has-scrolled", scrollY > innerHeight * 0.55);
}
window.addEventListener("scroll", updateProgress, { passive: true });
window.addEventListener("resize", updateProgress, { passive: true });
updateProgress();
