// Standalone FAQ page. Reuses copy.js for all content and mirrors the landing's
// footer + privacy/support dialogs so it behaves identically. Language switches in place.
import { copy } from "./copy.js";

const params = new URLSearchParams(location.search);
let locale = Object.hasOwn(copy, params.get("lang")) ? params.get("lang") : "en";
let activeDialog = null;
const dialog = document.querySelector("#info-dialog");
const BACK = {
  en: "Back to home",
  fr: "Retour à l’accueil",
  nl: "Terug naar de startpagina",
};

function footer(c) {
  return `<footer class="site-footer wrap"><div class="footer-top"><div class="footer-brand"><a href="index.html" class="wordmark" aria-label="${c.home}">HU<span>G</span>R</a><p>${c.footerLine}</p></div><div class="footer-links"><button data-dialog="privacy">${c.privacy}</button><button data-dialog="support">${c.support}</button><a href="mailto:hello@byhugr.io">${c.contact}<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 18 18 6M6 6h12v12"/></svg></a></div></div><div class="footer-bottom"><div><p>${c.footerMaker}</p><p>${c.footerCompany}</p></div><p class="disclaimer">${c.footerDisclaimer}</p></div></footer>`;
}

function privacyContent(c) {
  return `<p class="eyebrow">${c.privacy}</p><h2 id="dialog-title">${c.privacyTitle.replaceAll("<br>", " ")}</h2><p>${c.privacyIntro}</p>${c.privacyHeadings.map((h, i) => `<h3>${h}</h3><p>${c.privacyBodies[i]}</p>`).join("")}<p><a href="${locale === "fr" ? "https://byhugr.io/fr/#/privacy" : "https://byhugr.io/#/privacy"}" target="_blank" rel="noopener noreferrer">${c.privacyLink} <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 18 18 6M6 6h12v12"/></svg></a></p><p class="policy-note">${c.privacyNote}</p>`;
}

function supportContent(c) {
  return `<p class="eyebrow">${c.support}</p><h2 id="dialog-title">${c.supportTitle.replaceAll("<br>", " ")}</h2><p>${c.supportIntro}</p><h3>${c.supportUrgentTitle}</h3><p>${c.supportUrgent}</p><h3>${c.supportLinesTitle}</h3><ul><li>${c.supportNl} : <a href="tel:1813">1813</a> · <a href="https://www.zelfmoord1813.be/" target="_blank" rel="noopener noreferrer">Zelfmoordlijn</a> / <a href="tel:106">106</a> · <a href="https://www.tele-onthaal.be/" target="_blank" rel="noopener noreferrer">Tele-Onthaal</a></li><li>${c.supportFr} : <a href="tel:080032123">0800 32 123</a> · <a href="https://www.preventionsuicide.be/" target="_blank" rel="noopener noreferrer">Centre de Prévention du Suicide</a> / <a href="tel:107">107</a> · <a href="https://tele-accueil.be/" target="_blank" rel="noopener noreferrer">Télé-Accueil</a></li></ul><p><a href="https://findahelpline.com/" target="_blank" rel="noopener noreferrer">${c.supportElsewhere}</a></p><h3>${c.supportContactTitle}</h3><p>${c.supportContact}</p><h3>${c.supportAvailabilityTitle}</h3><p>${c.supportAvailability}</p><h3>${c.supportBrokenTitle}</h3><p>${c.supportBroken}</p>`;
}

function renderDialog(kind) {
  const c = copy[locale];
  document.querySelector("#dialog-content").innerHTML =
    kind === "privacy" ? privacyContent(c) : supportContent(c);
  dialog.classList.toggle("content-dialog", true);
  dialog.classList.toggle("waitlist-dialog", false);
}
function openDialog(kind) {
  activeDialog = kind;
  renderDialog(kind);
  if (!dialog.open) dialog.showModal();
}
function closeDialog() {
  activeDialog = null;
  if (dialog.open) dialog.close();
}

function render() {
  const c = copy[locale];
  document.documentElement.lang = locale === "nl" ? "nl-BE" : locale;
  document.title = `${c.navQuestions} — Hugr`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.content = c.description;

  for (const el of document.querySelectorAll("[data-i18n]"))
    el.innerHTML = c[el.dataset.i18n];

  document
    .querySelectorAll("[data-lang]")
    .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === locale)));

  document.querySelectorAll("[data-target]").forEach((a) => {
    const t = a.dataset.target;
    if (t === "questions") a.href = `questions.html?lang=${locale}`;
    else if (t === "top") a.href = `index.html?lang=${locale}`;
    else a.href = `index.html?lang=${locale}#${t}`;
  });

  document.querySelector(".site-header .wordmark")?.setAttribute("aria-label", c.home);
  document.querySelector(".desktop-nav")?.setAttribute("aria-label", c.navigation);
  document.querySelector(".languages")?.setAttribute("aria-label", c.language);
  document.querySelector(".dialog-close")?.setAttribute("aria-label", c.close);

  document.querySelector("#faq-h1").innerHTML = c.faqTitle;
  document.querySelector("#faq-intro").textContent = c.faqIntro;
  document.querySelector("#faq-list").innerHTML = c.faq
    .map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`)
    .join("");
  document.querySelector("#faq-back").textContent = BACK[locale] || BACK.en;

  document.querySelector("#page-footer").innerHTML = footer(c);
  const fwm = document.querySelector("#page-footer .wordmark");
  if (fwm) fwm.href = `index.html?lang=${locale}`;
  document
    .querySelectorAll('[data-dialog="privacy"]')
    .forEach((b) => b.addEventListener("click", () => openDialog("privacy")));
  document
    .querySelectorAll('[data-dialog="support"]')
    .forEach((b) => b.addEventListener("click", () => openDialog("support")));

  if (activeDialog) renderDialog(activeDialog);
}

document.querySelectorAll("[data-lang]").forEach((b) =>
  b.addEventListener("click", () => {
    locale = b.dataset.lang;
    history.replaceState(null, "", `?lang=${locale}`);
    render();
  }),
);
document.querySelector(".dialog-close").addEventListener("click", closeDialog);
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) closeDialog();
});
dialog.addEventListener("close", () => {
  activeDialog = null;
});

render();
