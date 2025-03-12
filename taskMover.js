import fetch from "node-fetch";

const GITHUB_API_URL = "https://api.github.com/graphql";
const TOKEN = process.env.TOKEN_AUTOMATIZATION;
const PROJECT_ID = process.env.ID_PROJECT;
const STATUS_FIELD_ID = process.env.ID_COLUMN_STATUS;
const STATUS_OPTIONS = {
  IN_PROGRESS: process.env.ID_COLUMN_STATUS_IN_PROGRESS,
  REVIEW: process.env.ID_COLUMN_STATUS_REVIEW,
  DONE: process.env.ID_COLUMN_STATUS_DONE,
};

if (
  !TOKEN ||
  !PROJECT_ID ||
  !STATUS_FIELD_ID ||
  Object.values(STATUS_OPTIONS).includes(undefined)
) {
  throw new Error("❌ Required environment variables are missing.");
}

async function githubRequest(query) {
  try {
    const response = await fetch(GITHUB_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();
    if (data.errors) {
      console.error(
        "❌ GitHub API error:",
        JSON.stringify(data.errors, null, 2)
      );
      throw new Error("GitHub API error");
    }

    return data.data;
  } catch (error) {
    console.error("❌ Error executing request:", error);
    throw error;
  }
}

async function fetchProjectItems() {
  const query = `query {
    node(id: "${PROJECT_ID}") {
      ... on ProjectV2 {
        items(first: 100) {
          nodes {
            id
            content {
              ... on Issue {
                number
                url
              }
            }
          }
        }
      }
    }
  }`;

  const data = await githubRequest(query);
  return data?.node?.items?.nodes || [];
}

async function getIssueItemByNumber(issueNumber) {
  const items = await fetchProjectItems();
  return (
    items.find((item) => item?.content?.number === Number(issueNumber)) || null
  );
}

async function updateIssueStatus(issueId, statusOptionId) {
  const mutation = `mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "${PROJECT_ID}",
      itemId: "${issueId}",
      fieldId: "${STATUS_FIELD_ID}",
      value: { singleSelectOptionId: "${statusOptionId}" }
    }) { clientMutationId }
  }`;

  await githubRequest(mutation);
}

async function moveTaskToStatus(issueNumber, statusKey) {
  const issueItem = await getIssueItemByNumber(issueNumber);
  if (!issueItem) {
    throw new Error(`❌ Issue #${issueNumber} not found.`);
  }

  await updateIssueStatus(issueItem.id, STATUS_OPTIONS[statusKey]);
  return { issueNumber, issueUrl: issueItem.content.url };
}

export const moveTaskToInProgress = (issueNumber) =>
  moveTaskToStatus(issueNumber, "IN_PROGRESS");
export const moveTaskToInReview = (issueNumber) =>
  moveTaskToStatus(issueNumber, "REVIEW");
export const moveTaskToDone = (issueNumber) =>
  moveTaskToStatus(issueNumber, "DONE");
