import {
  moveTaskToInProgress,
  moveTaskToInReview,
  moveTaskToInDone,
} from "./taskMover.js";
import { sendTelegramMessage } from "./telegram.js";
import { extractIssueNumber } from "./utils.js";

export async function handleCreateEvent(payload) {
  const branchName = payload.ref;
  const issueNumber = extractIssueNumber(branchName);
  if (!issueNumber) {
    console.log(
      `⚠️ Branch name "${branchName}" не соответствует ожидаемому шаблону.`
    );
    return;
  }

  try {
    const result = await moveTaskToInProgress(issueNumber);
    const statusMessage = result.alreadyInProgress
      ? `⚠️ Задача ${issueNumber} уже в статусе IN_PROGRESS.`
      : `✅ Задача ${issueNumber} успешно перемещена в IN_PROGRESS.`;
    await sendTelegramMessage(
      `🔔 GitHub Webhook: create\n` +
        `📂 Репозиторий: ${payload?.repository?.full_name || "unknown"}\n` +
        `🔢 Номер задачи: ${issueNumber}\n` +
        `🔗 Ссылка: ${result.issueUrl || "нет данных"}\n` +
        statusMessage
    );
  } catch (err) {
    console.error(
      `❌ Ошибка при перемещении задачи ${issueNumber} в IN_PROGRESS:`,
      err
    );
    await sendTelegramMessage(
      `❌ Ошибка при обновлении задачи ${issueNumber}: ${err.message}`
    );
  }
}

export async function handlePullRequestEvent(payload) {
  const prBranchName = payload.pull_request.head.ref;
  const issueNumber = extractIssueNumber(prBranchName);
  if (!issueNumber) {
    console.log(
      `⚠️ PR branch name "${prBranchName}" не соответствует ожидаемому шаблону.`
    );
    return;
  }

  if (payload.action === "opened") {
    try {
      const result = await moveTaskToInReview(issueNumber);
      const statusMessage = result.alreadyInReview
        ? `⚠️ Задача ${issueNumber} уже в статусе IN_REVIEW.`
        : `✅ Задача ${issueNumber} успешно перемещена в IN_REVIEW.`;
      await sendTelegramMessage(
        `🔔 GitHub Webhook: pull_request (opened)\n` +
          `📂 Репозиторий: ${payload.repository.full_name}\n` +
          `🔢 Номер задачи: ${issueNumber}\n` +
          `🔗 PR: ${payload.pull_request.html_url}\n` +
          statusMessage
      );
    } catch (err) {
      console.error(
        `❌ Ошибка при перемещении задачи ${issueNumber} в IN_REVIEW:`,
        err
      );
      await sendTelegramMessage(
        `❌ Ошибка при обновлении задачи ${issueNumber}: ${err.message}`
      );
    }
  }

  if (payload.action === "closed") {
    try {
      const result = await moveTaskToInDone(issueNumber);
      const statusMessage = result.alreadyDone
        ? `⚠️ Задача ${issueNumber} уже в статусе DONE.`
        : `✅ Задача ${issueNumber} успешно перемещена в DONE.`;
      await sendTelegramMessage(
        `🔔 GitHub Webhook: pull_request (closed)\n` +
          `📂 Репозиторий: ${payload.repository.full_name}\n` +
          `🔢 Номер задачи: ${issueNumber}\n` +
          `🔗 PR: ${payload.pull_request.html_url}\n` +
          statusMessage
      );
    } catch (err) {
      console.error(
        `❌ Ошибка при перемещении задачи ${issueNumber} в DONE:`,
        err
      );
      await sendTelegramMessage(
        `❌ Ошибка при обновлении задачи ${issueNumber}: ${err.message}`
      );
    }
  }
}
