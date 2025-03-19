import { nameProject } from "./config.js";
import { getIssueAssignee, getPullRequestReviewers } from "./gitUtils.js";
import {
  moveTaskToInProgress,
  moveTaskToInReview,
  moveTaskToDone,
} from "./taskMover.js";
import { mapGitHubToTelegram, sendTelegramMessage } from "./telegram.js";
import { extractIssueNumber } from "./utils.js";

export async function handleCreateEvent(payload) {
  const branchName = payload.ref;
  const issueNumber = extractIssueNumber(branchName);
  if (!issueNumber) {
    console.warn(
      `⚠️ Branch name "${branchName}" does not match the expected pattern.`
    );
    return;
  }

  try {
    const repoFullName = payload?.repository?.full_name;
    const assignee = await getIssueAssignee(repoFullName, issueNumber);
    const result = await moveTaskToInProgress(issueNumber);

    const statusMessage = result.alreadyInProgress
      ? `⚠️ Issue ${issueNumber} is already in IN_PROGRESS status.`
      : `✅ Issue ${issueNumber} successfully moved to IN_PROGRESS.`;

    await sendTelegramMessage(
      `🔔 GitHub Webhook: create\n` +
        `📂 Repository: ${repoFullName}\n` +
        `🔢 Issue Number: ${issueNumber}\n` +
        `👤 Assigned: ${assignee}\n` +
        `🔗 Link: ${result.issueUrl || "no data"}\n` +
        statusMessage,
      "",
      true
    );
  } catch (err) {
    console.error(`❌ Error moving issue ${issueNumber} to IN_PROGRESS:`, err);
    await sendTelegramMessage(
      `❌ Error updating issue ${issueNumber}: ${err.message}`,
      "",
      true
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

  if (payload.action === "opened") {
    try {
      const result = await moveTaskToInReview(issueNumber);

      const statusMessage = result.alreadyInReview
        ? `⚠️ Issue ${issueNumber} is already in IN_REVIEW status.`
        : `✅ Issue ${issueNumber} successfully moved to IN_REVIEW.`;
      await sendTelegramMessage(
        `🔔 GitHub Webhook: pull_request (opened)\n` +
          `📂 Repository: ${repoFullName}\n` +
          `🔢 Issue Number: ${issueNumber}\n` +
          `👤 Assigned: ${assignee}\n` +
          `🔗 PR: ${payload.pull_request.html_url}\n` +
          statusMessage,
        "",
        true
      );
    } catch (err) {
      console.error(`❌ Error moving issue ${issueNumber} to IN_REVIEW:`, err);
      await sendTelegramMessage(
        `❌ Error updating issue ${issueNumber}: ${err.message}`,
        "",
        true
      );
    }
  }

  if (payload.action === "closed") {
    try {
      const result = await moveTaskToDone(issueNumber);
      const statusMessage = result.alreadyDone
        ? `⚠️ Issue ${issueNumber} is already in DONE status.`
        : `✅ Issue ${issueNumber} successfully moved to DONE.`;
      await sendTelegramMessage(
        `🔔 GitHub Webhook: pull_request (closed)\n` +
          `📂 Repository: ${repoFullName}\n` +
          `🔢 Issue Number: ${issueNumber}\n` +
          `👤 Assigned: ${assignee}\n` +
          `🔗 PR: ${payload.pull_request.html_url}\n` +
          statusMessage,
        "",
        true
      );
    } catch (err) {
      console.error(`❌ Error moving issue ${issueNumber} to DONE:`, err);
      await sendTelegramMessage(
        `❌ Error updating issue ${issueNumber}: ${err.message}`,
        "",
        true
      );
    }
  }

  if (payload.action === "review_requested") {
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
  }

  if (payload.action === "review_request_removed") {
    const removedReviewer = mapGitHubToTelegram(
      payload.requested_reviewer?.login || "Unknown"
    );

    await sendTelegramMessage(
      `🔔  ${removedReviewer}\n` +
        `🙈 I'm sorry, brother. Don't check the PR  <a href="${payload.pull_request.html_url}">#19</a>\n`,
      "HTML",
      true
    );
  }

  if (payload.action === "assigned") {
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
  }

  if (payload.action === "unassigned") {
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
  }
}
