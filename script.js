// ==UserScript==
// @name        NetAcad Answer Highlight
// @namespace   Violentmonkey Scripts
// @match       *://www.netacad.com/*
// @run-at      document-idle
// @grant       GM.xmlHttpRequest
// @version     1.0
// @author      Natthapas
// @description 28/05/2025, 23:22:08
// ==/UserScript==

(function () {
  function gmFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        method: options.method || "GET",
        url,
        headers: options.headers || {},
        data: options.body || null,
        responseType: options.responseType || "text",
        onload: (res) => {
          resolve({
            ok: res.status >= 200 && res.status < 300,
            status: res.status,
            statusText: res.statusText,
            text: () => Promise.resolve(res.responseText),
            json: () => Promise.resolve(JSON.parse(res.responseText)),
            blob: () => Promise.resolve(new Blob([res.response])),
          });
        },
        onerror: reject,
      });
    });
  }

  const answerCache = {};

  async function main(evnt) {
    const questionElement = evnt.originalTarget.closest(".mcq__inner");

    if (questionElement === null) {
      return;
    }
    const question =
      questionElement.firstElementChild.firstElementChild.shadowRoot.firstElementChild.firstElementChild.firstElementChild.children[1].firstElementChild.firstElementChild.textContent
        .toLowerCase()
        .replaceAll(/[ ./]/g, "-")
        .replaceAll(/[^\w-]/g, "")
        .replaceAll(/-+/g, "-")
        .slice(0, 196);

    console.log("Question:", question);

    if (!(question in answerCache)) {
      answerCache[question] = [];

      try {
        const answerResponse = await gmFetch(
          `https://itexamanswers.net/question/${question}`
        );

        const answerData = await answerResponse.text();
        const answerMatches = [
          ...answerData.matchAll(
            /<span style="color: (?:#ff0000|red);">(?:<strong>)?(.*?)(?:<\/strong>)?<\/span>/g
          ),
          ...answerData.matchAll(/<li class="correct_answer">(.*?)<\/li>/g),
        ];

        console.log("Fetched answers:", answerMatches);

        for (const match of answerMatches) {
          answerCache[question].push(match[1].trim().toLowerCase());
        }
      } catch (err) {
        console.warn("Failed to fetch answer:", err);
      }
    }

    console.log("Answers:", answerCache[question]);

    const widget = questionElement.children[1];

    for (const choice of widget.children) {
      const choiceText =
        choice.children[1].children[1].firstElementChild.textContent
          .trim()
          .toLowerCase();
      console.log("Choice:", choiceText);

      if (answerCache[question].some((answer) => choiceText === answer)) {
        choice.children[1].style.outline = `4px solid #6abf4b`;
        console.log("^ Is correct");
      }
    }
  }

  document.body.addEventListener("click", main, true);
})();
