import fetch from "node-fetch";

const GITHUB_TOKEN = process.env.TOKEN_AUTOMATIZATION;

export async function getIssueAssignee(repoFullName, issueNumber) {
  const url = `https://api.github.com/repos/${repoFullName}/issues/${issueNumber}`;
  const response = await fetch(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` },
  });

  if (!response.ok) {
    console.warn(`⚠️ Couldn't get issue data issue #${issueNumber}`);
    return "Not assigned";
  }

  const data = await response.json();
  return data.assignee?.login || "Not assigned";
}

export async function getPullRequestReviewers(repoFullName, pullNumber) {
  const url = `https://api.github.com/repos/${repoFullName}/pulls/${pullNumber}/reviews`;
  const response = await fetch(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` },
  });

  if (!response.ok) {
    console.warn(`⚠️ Couldn't get a list of PR reviewers #${pullNumber}`);
    return "Not assigned";
  }

  const reviews = await response.json();
  const reviewersFromReviews = new Set(
    reviews.map((r) => mapGitHubToTelegram(r.user?.login)).filter(Boolean)
  );

  const requestedUrl = `https://api.github.com/repos/${repoFullName}/pulls/${pullNumber}/requested_reviewers`;
  const requestedResponse = await fetch(requestedUrl, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` },
  });

  if (requestedResponse.ok) {
    const requestedData = await requestedResponse.json();
    requestedData.users.forEach((user) =>
      reviewersFromReviews.add(mapGitHubToTelegram(user.login))
    );
  }

  return reviewersFromReviews.size
    ? [...reviewersFromReviews].join(", ")
    : "Not assigned";
}
