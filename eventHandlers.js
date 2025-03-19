import { nameProject } from "./config.js";
import { getIssueAssignee } from "./gitUtils.js";
import {
  moveTaskToInProgress,
  moveTaskToInReview,
  moveTaskToDone,
} from "./taskMover.js";
import { mapGitHubToTelegram, sendTelegramMessage } from "./telegram.js";
import { extractIssueNumber } from "./utils.js";

/**
 * Универсальная функция для обработки изменений статуса задачи.
 * Принимает объект с настройками:
 * - eventType: тип вебхука для отображения (например, "create" или "pull_request (opened)")
 * - issueNumber: номер задачи
 * - repoFullName: полное имя репозитория
 * - assignee: ответственный
 * - moveTaskFunction: функция для изменения статуса задачи
 * - alreadyFlag: имя булевого свойства результата, обозначающее, что задача уже в нужном статусе
 * - stateLabel: метка статуса (например, "IN_PROGRESS")
 * - linkLabel: ярлык для ссылки (например, "🔗 Link" или "🔗 PR")
 * - linkValueFn: функция для извлечения ссылки из результата или payload
 */
async function processTaskEvent({
  eventType,
  issueNumber,
  repoFullName,
  assignee,
  moveTaskFunction,
  alreadyFlag,
  stateLabel,
  linkLabel,
  linkValueFn,
}) {
  try {
    const result = await moveTaskFunction(issueNumber);
    const statusMessage = result[alreadyFlag]
      ? `⚠️ Issue ${issueNumber} is already in ${stateLabel.toUpperCase()} status.`
      : `✅ Issue ${issueNumber} successfully moved to ${stateLabel.toUpperCase()}.`;
    const linkValue = linkValueFn ? linkValueFn(result) : "";
    const message =
      `🔔 GitHub Webhook: ${eventType}\n` +
      `📂 Repository: ${repoFullName}\n` +
      `🔢 Issue Number: ${issueNumber}\n` +
      `👤 Assigned: ${assignee}\n` +
      (linkValue ? `${linkLabel}: ${linkValue}\n` : "") +
      statusMessage;
    await sendTelegramMessage(message, "", true);
  } catch (err) {
    console.error(
      `❌ Error moving issue ${issueNumber} to ${stateLabel.toUpperCase()}:`,
      err
    );
    await sendTelegramMessage(
      `❌ Error updating issue ${issueNumber}: ${err.message}`,
      "",
      true
    );
  }
}

export async function handleCreateEvent(payload) {
  const branchName = payload.ref;
  const issueNumber = extractIssueNumber(branchName);
  if (!issueNumber) {
    console.warn(
      `⚠️ Branch name "${branchName}" does not match the expected pattern.`
    );
    return;
  }

  const repoFullName = payload.repository.full_name;
  const assignee = await getIssueAssignee(repoFullName, issueNumber);

  await processTaskEvent({
    eventType: "create",
    issueNumber,
    repoFullName,
    assignee,
    moveTaskFunction: moveTaskToInProgress,
    alreadyFlag: "alreadyInProgress",
    stateLabel: "IN_PROGRESS",
    linkLabel: "🔗 Link",
    linkValueFn: (result) => result.issueUrl || "no data",
  });
}

export async function handlePullRequestEvent(payload) {
  const prBranchName = payload.pull_request.head.ref;
  const issueNumber = extractIssueNumber(prBranchName);
  if (!issueNumber) {
    console.warn(
      `⚠️ PR branch name "${prBranchName}" does not match the expected pattern.`
    );
    return;
  }

  const repoFullName = payload.repository.full_name;
  const assignee = await getIssueAssignee(repoFullName, issueNumber);
  const assigneesArray = payload.pull_request.assignees || [];
  const assigneesList = assigneesArray.length
    ? assigneesArray.map((user) => user.login).join(", ")
    : "None";

  switch (payload.action) {
    case "opened":
      await processTaskEvent({
        eventType: "pull_request (opened)",
        issueNumber,
        repoFullName,
        assignee,
        moveTaskFunction: moveTaskToInReview,
        alreadyFlag: "alreadyInReview",
        stateLabel: "IN_REVIEW",
        linkLabel: "🔗 PR",
        linkValueFn: () => payload.pull_request.html_url,
      });
      break;

    case "closed":
      await processTaskEvent({
        eventType: "pull_request (closed)",
        issueNumber,
        repoFullName,
        assignee,
        moveTaskFunction: moveTaskToDone,
        alreadyFlag: "alreadyDone",
        stateLabel: "DONE",
        linkLabel: "🔗 PR",
        linkValueFn: () => payload.pull_request.html_url,
      });
      break;

    case "review_requested": {
      const requestedReviewer = mapGitHubToTelegram(
        payload.requested_reviewer?.login || "Unknown"
      );
      await sendTelegramMessage(
        `🔔  ${requestedReviewer}\n` +
          `🫡 Check please PR  <a href="${payload.pull_request.html_url}">#19</a>\n` +
          `🚀 <a href="https://deploy-preview-${issueNumber}--${nameProject}.netlify.app">Deploy</a>`,
        "HTML",
        true
      );
      break;
    }

    case "review_request_removed": {
      const removedReviewer = mapGitHubToTelegram(
        payload.requested_reviewer?.login || "Unknown"
      );
      await sendTelegramMessage(
        `🔔  ${removedReviewer}\n` +
          `🙈 I'm sorry, brother. Don't check the PR  <a href="${payload.pull_request.html_url}">#19</a>\n`,
        "HTML",
        true
      );
      break;
    }

    case "assigned": {
      const requestedReviewer = mapGitHubToTelegram(
        payload.requested_reviewer?.login || "Unknown"
      );
      await sendTelegramMessage(
        `🔔 GitHub Webhook: assignee_added\n` +
          `📂 Repository: ${repoFullName}\n` +
          `🔢 Issue Number: ${issueNumber}\n` +
          `👥 Assignees: ${assigneesList}\n` +
          `👀 Reviewer: ${requestedReviewer}\n` +
          `🔗 PR: ${payload.pull_request.html_url}`,
        "",
        true
      );
      break;
    }

    case "unassigned": {
      const requestedReviewer = mapGitHubToTelegram(
        payload.requested_reviewer?.login || "Unknown"
      );
      await sendTelegramMessage(
        `🔔 GitHub Webhook: assignee_removed\n` +
          `📂 Repository: ${repoFullName}\n` +
          `🔢 Issue Number: ${issueNumber}\n` +
          `👥 Assignees: ${assigneesList}\n` +
          `👀 Reviewer: ${requestedReviewer}\n` +
          `🔗 PR: ${payload.pull_request.html_url}`,
        "",
        true
      );
      break;
    }

    default:
      console.warn(`Unhandled pull request action: ${payload.action}`);
  }
}
