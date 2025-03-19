import { nameProject } from "./config.js";
import { getIssueAssignee } from "./gitUtils.js";
import {
  moveTaskToInProgress,
  moveTaskToInReview,
  moveTaskToDone,
} from "./taskMover.js";
import { mapGitHubToTelegram, sendTelegramMessage } from "./telegram.js";
import { escapeMarkdown, extractIssueNumber } from "./utils.js";

/**
 * Функция для перемещения карточки.
 * Принимает номер задачи и функцию перемещения.
 */
async function moveCard(issueNumber, moveTaskFunction) {
  return await moveTaskFunction(issueNumber);
}

/**
 * Функция для формирования и отправки уведомления.
 * Принимает объект с настройками уведомления.
 * Все уведомления отправляются в отладочный чат (debug), если не указано иное.
 */
async function notifyCardUpdate({
  eventType,
  issueNumber,
  repoFullName,
  assignee,
  result,
  alreadyFlag,
  stateLabel,
  linkLabel,
  linkValueFn,
  format = "",
}) {
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
  await sendTelegramMessage(message, { debug: true, parse_mode: format });
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

  try {
    const result = await moveCard(issueNumber, moveTaskToInProgress);
    await notifyCardUpdate({
      eventType: "create",
      issueNumber,
      repoFullName,
      assignee,
      result,
      alreadyFlag: "alreadyInProgress",
      stateLabel: "IN_PROGRESS",
      linkLabel: "🔗 Link",
      linkValueFn: (result) => result.issueUrl || "no data",
    });
  } catch (err) {
    console.error(`❌ Error moving issue ${issueNumber} to IN_PROGRESS:`, err);
    await sendTelegramMessage(
      `❌ Error updating issue ${issueNumber}: ${err.message}`,
      { debug: true }
    );
  }
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
    case "closed":
      try {
        const result = await moveCard(issueNumber, moveTaskToDone);
        await notifyCardUpdate({
          eventType: "pull_request (closed)",
          issueNumber,
          repoFullName,
          assignee,
          result,
          alreadyFlag: "alreadyDone",
          stateLabel: "DONE",
          linkLabel: "🔗 PR",
          linkValueFn: () => payload.pull_request.html_url,
        });
      } catch (err) {
        console.error(`❌ Error moving issue ${issueNumber} to DONE:`, err);
        await sendTelegramMessage(
          `❌ Error updating issue ${issueNumber}: ${err.message}`,
          { debug: true }
        );
      }
      break;

    case "review_requested": {
      const requestedReviewer = mapGitHubToTelegram(
        payload.requested_reviewer?.login || "Unknown"
      );
      await moveCard(issueNumber, moveTaskToInReview);

      const safeRequestedReviewer = escapeMarkdown(requestedReviewer);
      await sendTelegramMessage(
        `🔔  ${safeRequestedReviewer}\n` +
          `🫡 Check please PR [#${payload.pull_request.number}](${payload.pull_request.html_url}) (${nameProject})\n` +
          `🚀 [Deploy](https://deploy-preview-${payload.pull_request.number}--${nameProject}.netlify.app)`,
        { parse_mode: "Markdown", debug: false }
      );
      break;
    }

    case "review_request_removed": {
      const removedReviewer = mapGitHubToTelegram(
        payload.requested_reviewer?.login || "Unknown"
      );
      const safeRequestedReviewer = escapeMarkdown(removedReviewer);
      await sendTelegramMessage(
        `🔔  ${safeRequestedReviewer}\n` +
          `🙈 I'm sorry, brother. Don't check the PR  [#19](${payload.pull_request.html_url})\n`,
        { parse_mode: "Markdown", debug: false }
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
        { debug: true }
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
        { debug: true }
      );
      break;
    }

    default:
      console.warn(`Unhandled pull request action: ${payload.action}`);
  }
}
