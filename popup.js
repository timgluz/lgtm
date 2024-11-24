const lgtmSystemPrompt = `
You are a helpful and friendly assistant who helps users write better code reviews.

Rewrite the code review to be more constructive, helpful and friendly.
Please do not change the code itself.
Please follow the Triple R principle: Request, Rationale, and Result.
Please format the comment in the following format:
  <label>: [decorations, optional] <subject>
  [discussion, optional]

Where:
  * <label> is a label that signifies what kind of comment is being left
    possible values: ["praise", nit", "suggestion", "issue", "todo", "question", "thought", "chore", "typo"].
  * <decorations>, extra decorating label for comment ["non-blocking", "blocking", "if-minor"].
  * <subject> is the main content of the comment. Should be short and to the point, max 80 characters.
  * [discussion] is the optional content of the comment. This contains supporting statements, context,
    reasoning that helps communicate the "why" and "next steps" for resolving the subject.
    Should be concise and to the point, keeps short max 320characters
`;

function showErrorMessage(message) {
  errorEl = document.getElementById("error-message");
  if (errorEl) {
    errorEl.textContent = message;
  } else {
    console.error(message);
  }
}

// rewriteComment rewrites comment using AI model
// hint: if windows.ai is not defined, you need to activate rewrite flag in chrome://flags
async function rewriteComment(sourceEl, tone) {
  const writer = await window.ai.rewriter.create({ tone: tone });

  if (!sourceEl) {
    console.error("Source element not found");
    return;
  }

  if (!targetEl) {
    console.error("Target element not found, will use source element");
    targetEl = sourceEl;
  }

  console.log("Rewriting comment...", sourceEl.value);
  const stream = await writer.rewriteStreaming(sourceEl.value);

  for await (const chunk of stream) {
    targetEl.append(chunk);
  }
}

async function lgtm(sourceEl, targetEl) {
  const capabilities = await chrome.aiOriginTrial.languageModel.capabilities();
  if (capabilities.available !== "readily") {
    console.error("Model is not available, check capabilities", capabilities);
    return;
  }

  let userPrompt = sourceEl.value.trim();
  if (!userPrompt) {
    console.error("User prompt is empty, using placeholder");
    userPrompt = sourceEl.placeholder.trim();
  }

  const session = await chrome.aiOriginTrial.languageModel.create({
    initialPrompts: [
      { role: "system", content: lgtmSystemPrompt },
      { role: "user", content: "i hate tabs" },
      {
        role: "assistant",
        content: [
          "nit: we should follow consistent style",
          "",
          "Consistent style makes easier to read and maintain code. Please check if editor is configured correctly.",
        ].join("\n"),
      },
    ],
  });

  const usageEl = document.getElementById("token-usage");
  const usageMessage = `${session.tokensSoFar}/${session.maxTokens} ${session.tokensLeft} left)`;
  if (usageEl) {
    usageEl.textContent = usageMessage;
  } else {
    console.log(usageMessage);
  }

  // Prompt the model and stream the result:
  const result = await session.prompt(userPrompt);
  if (!result) {
    showErrorMessage("Failed to get result from model");
  }

  if (targetEl) {
    targetEl.textContent = result;
  } else {
    console.log("result:", result);
  }

  session.destroy();
}

function checkPreconditions() {
  const showNotSupportedMessage = () => {
    document.querySelector(".not-supported-message").hidden = false;
  };

  if (!self.ai || !self.ai.writer || !self.ai.rewriter) {
    return showNotSupportedMessage();
  }
}

async function init() {
  console.log("Checking preconditions...");
  checkPreconditions();

  const downloadSession = await chrome.aiOriginTrial.languageModel.create({
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`);
      });
    },
  });

  downloadSession.destroy();

  console.log("Registering actions");
  let lgtmButton = document.getElementById("btn-lgtm");
  if (!lgtmButton || lgtmButton === null) {
    console.log("Could not find rewrite button");
    return;
  }

  console.log("Found rewrite button");
  lgtmButton.addEventListener("click", async () => {
    console.log("Improving comment...");
    const commentEl = document.getElementById("comment");
    const rewriteEl = document.getElementById("rewrite");
    await lgtm(commentEl, rewriteEl);
  });

  // register tone buttons
  let causalBtn = document.getElementById("btn-rewrite-causal");
  if (!causalBtn || causalBtn === null) {
    console.error("Could not find causal button");
  } else {
    causalBtn.addEventListener("click", async () => {
      console.log("Rewriting comment to be more causal...");
      const rewriteEl = document.getElementById("rewrite");
      await rewriteComment(rewriteEl, "causal");
    });
  }

  let formalBtn = document.getElementById("btn-rewrite-formal");
  if (!formalBtn || formalBtn === null) {
    console.error("Could not find formal button");
  } else {
    console.log("Found formal button");

    formalBtn.addEventListener("click", async () => {
      console.log("Rewriting comment to be more formal...");
      const rewriteEl = document.getElementById("rewrite");
      await rewriteComment(rewriteEl, "formal");
    });
  }

  let copyBtn = document.getElementById("btn-rewrite-copy");
  if (!copyBtn || copyBtn === null) {
    console.error("Could not find copy button");
  } else {
    console.log("Found copy button");

    copyBtn.addEventListener("click", async () => {
      const rewriteEl = document.getElementById("rewrite");
      if (!rewriteEl) {
        console.error("Rewritten comment element not found");
        return;
      }

      console.log("Copying rewritten comment...");

      // copy to clipboard
      navigator.clipboard.writeText(rewriteEl.textContent).then(() => {
        console.log("Copied to clipboard");
      });
    });
  }
}

console.log("initializing popup.js");
init();
