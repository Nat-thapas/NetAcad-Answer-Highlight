// ==UserScript==
// @name        NetAcad Answer Highlight
// @namespace   https://natthapas.dev
// @match       *://www.netacad.com/*
// @run-at      document-idle
// @grant       GM.xmlHttpRequest
// @version     1.0.5
// @author      Natthapas
// @description Highlight the correct and wrong answer when you answer a question. Yellow highlight means that question doesn't exist on the data source.
// ==/UserScript==

(function () {
  const dataSourceURL = "https://itexamanswers.net/question/";

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

  function decodeHtmlEntities(str) {
    return str.replace(/&#([0-9]{1,4});/gi, function (match, numStr) {
      var num = parseInt(numStr, 10);
      return String.fromCharCode(num);
    });
  }

  function addLinkButton(element, url) {
    if (element.hasAttribute("data-answer-link-appended")) {
      return;
    }

    const linkElement = document.createElement("a");
    linkElement.href = url;
    linkElement.target = "_blank";
    linkElement.style.color = "inherit";
    linkElement.style.display = "inline-block";
    linkElement.style.textDecoration = "none";
    linkElement.style.verticalAlign = "middle";
    linkElement.innerHTML =
      '&nbsp;<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link-icon lucide-external-link"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';

    element
      .querySelector("base-view")
      .shadowRoot.querySelector(".component__title-inner")
      .appendChild(linkElement);

    element.setAttribute("data-answer-link-appended", true);
  }

  const answerCache = {};

  async function main(evnt) {
    const questionElement = evnt.composedPath()[0].closest(".component__inner");

    if (questionElement === null) {
      return;
    }

    const isMultipleChoiceQuestion = questionElement.classList.contains("mcq");

    const question = questionElement
      .querySelector("base-view")
      .shadowRoot.querySelector(".component__body-inner")
      .textContent.toLowerCase()
      .replaceAll(/[ ./]/g, "-")
      .replaceAll(/[^a-z0-9-]/gi, "")
      .replaceAll(/-+/g, "-")
      .slice(0, 196)
      .replace(/-$/, "");

    console.log("Question:", question);

    const url = dataSourceURL + question;
    addLinkButton(questionElement, url);

    if (!isMultipleChoiceQuestion) {
      answerCache[question] = [];
    } else if (!(question in answerCache)) {
      answerCache[question] = [];

      try {
        const answerResponse = await gmFetch(url);

        const answerData = await answerResponse.text();
        const answerMatches = [
          ...answerData.matchAll(
            /<span style="color: (?:#ff0000|red);">(?:<strong>)?(.*?)(?:<\/strong>)?<\/span>/g
          ),
          ...answerData.matchAll(/<li class="correct_answer">(.*?)<\/li>/g),
        ];

        console.log("Fetched answers:", answerMatches);

        for (const match of answerMatches) {
          answerCache[question].push(
            decodeHtmlEntities(match[1])
              .trim()
              .toLowerCase()
              .replace(/[\u2018\u2019]/g, "'")
              .replace(/[\u201C\u201D]/g, '"')
              .replace(/^[^a-z0-9]+/i, "")
              .replace(/[^a-z0-9]+$/i, "")
          );
        }
      } catch (err) {
        console.warn("Failed to fetch answer:", err);
      }
    }

    if (isMultipleChoiceQuestion) {
      console.log("Answers:", answerCache[question]);
    } else {
      console.log(
        "Question is not multiple choice, answer parsing and highlighting is unsupported"
      );
      return;
    }

    const widget = questionElement.querySelector(".mcq__widget");

    if (widget === null) {
      return;
    }

    if (answerCache[question].length === 0) {
      console.warn(
        "No correct answer available, this could mean that the question does not exist on the data source or something was not parsed correctly"
      );
      for (const choice of widget.children) {
        const label = choice.querySelector(".mcq__item-label");
        if (label === null) {
          continue;
        }
        const input = choice.querySelector("input");
        if (input === null) {
          continue;
        }
        if (input.checked) {
          label.style.outline = `4px solid #ffcc31`;
        } else {
          label.style.outline = "none";
        }
      }
      return;
    }

    for (const choice of widget.children) {
      const choiceTextElement = choice.querySelector(".mcq__item-text-inner");
      if (choiceTextElement === null) {
        continue;
      }
      const choiceText = choiceTextElement.textContent
        .trim()
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/^[^a-z0-9]+/i, "")
        .replace(/[^a-z0-9]+$/i, "");

      console.log("Choice:", choiceText);

      const label = choice.querySelector(".mcq__item-label");

      if (label === null) {
        continue;
      }

      if (answerCache[question].some((answer) => choiceText === answer)) {
        label.style.outline = `4px solid #6abf4b`;
        console.log("^ Is correct");
      } else if (choice.querySelector("input").checked) {
        label.style.outline = `4px solid #ea5656`;
      } else {
        label.style.outline = "none";
      }
    }
  }

  document.body.addEventListener("click", main, true);
})();
