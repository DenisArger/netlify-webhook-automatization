import fetch from "node-fetch";

/**
 * Получает список элементов проекта.
 */
async function fetchProjectItems(projectId, token) {
  const graphqlUrl = "https://api.github.com/graphql";
  const query = `
      query { 
        node(id: "${projectId}") {
          ... on ProjectV2 {
            items(first: 100) {
              nodes {
                id
                content {
                  ... on Issue {
                    number
                    title
                    url
                  }
                }
              }
            }
          }
        }
      }
    `;

  try {
    const response = await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error(`❌ Ошибка запроса: ${response.status}`, responseText);
      throw new Error(`Ошибка запроса: ${response.status}`);
    }
    const data = JSON.parse(responseText);

    if (data.errors) {
      console.error(
        "❌ Ошибки GraphQL API:",
        JSON.stringify(data.errors, null, 2)
      );
      throw new Error("Ошибка GraphQL API");
    }

    return data?.data?.node?.items?.nodes || [];
  } catch (error) {
    console.error("❌ Ошибка при получении данных из GitHub API:", error);
    throw error;
  }
}

/**
 * Ищет элемент задачи по номеру.
 */
async function getIssueItemByNumber(issueNumber, projectId, token) {
  const items = await fetchProjectItems(projectId, token);
  return (
    items.find((item) => item?.content?.number === Number(issueNumber)) || null
  );
}

/**
 * Обновляет статус задачи в проекте.
 */
async function updateIssueStatus(
  issueId,
  projectId,
  columnFieldId,
  inProgressOptionId,
  token
) {
  const graphqlUrl = "https://api.github.com/graphql";
  const mutation = `
    mutation {
      updateProjectV2ItemFieldValue(input: {
        projectId: "${projectId}",
        itemId: "${issueId}",
        fieldId: "${columnFieldId}",
        value: { singleSelectOptionId: "${inProgressOptionId}" }
      }) { clientMutationId }
    }
  `;

  try {
    const response = await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: mutation }),
    });

    const data = await response.json();
    if (data.errors) {
      console.error(
        "❌ Ошибка обновления задачи:",
        JSON.stringify(data.errors, null, 2)
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("❌ Ошибка сети при обновлении статуса задачи:", error);
    return false;
  }
}

/**
 * Перемещает задачу в IN_PROGRESS.
 */
async function moveTaskToInProgress(issueNumber) {
  const token = process.env.TOKEN_AUTOMATIZATION;
  const projectId = process.env.ID_PROJECT_SKILLDOR;
  const columnFieldId = process.env.ID_COLUMN_STATUS_SKILLDOR;
  const inProgressOptionId = process.env.ID_COLUMN_STATUS_IN_PROGRESS_SKILLDOR;

  if (!token || !projectId || !columnFieldId || !inProgressOptionId) {
    throw new Error("❌ Отсутствуют необходимые переменные окружения.");
  }

  const issueItem = await getIssueItemByNumber(issueNumber, projectId, token);
  if (!issueItem) {
    throw new Error(`❌ Задача #${issueNumber} не найдена.`);
  }

  const issueUrl = issueItem?.content?.url || "нет ссылки";

  // Обновляем статус
  const success = await updateIssueStatus(
    issueItem.id,
    projectId,
    columnFieldId,
    inProgressOptionId,
    token
  );
  if (!success) {
    throw new Error(`❌ Ошибка при обновлении статуса задачи #${issueNumber}.`);
  }

  console.log(
    `✅ Задача #${issueNumber} перемещена в IN_PROGRESS.\n🔗 ${issueUrl}`
  );
  return { issueUrl, alreadyInProgress: false };
}

export { moveTaskToInProgress };

const GITHUB_API_URL = "https://api.github.com/graphql";
const TOKEN = process.env.TOKEN_AUTOMATIZATION;
const PROJECT_ID = process.env.ID_PROJECT_SKILLDOR;
const STATUS_FIELD_ID = process.env.ID_COLUMN_STATUS_SKILLDOR;
const REVIEW_STATUS_ID = process.env.ID_COLUMN_STATUS_REVIEW_SKILLDOR;
const DONE_STATUS_ID = process.env.ID_COLUMN_STATUS_DONE_SKILLDOR;

export async function moveTaskToInReview(issueNumber) {
  if (!issueNumber) {
    throw new Error("Issue number is required.");
  }

  const query = {
    query: `query {
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
    }`,
  };

  const response = await fetch(GITHUB_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
  });

  const data = await response.json();
  if (data.errors) {
    console.error("GitHub API Error:", data.errors);
    throw new Error("Failed to fetch project tasks.");
  }

  const issueItem = data.data.node.items.nodes.find(
    (item) => item.content?.number == issueNumber
  );

  if (!issueItem) {
    throw new Error(`Issue #${issueNumber} not found in the project.`);
  }

  const issueItemId = issueItem.id;
  const issueUrl = issueItem.content.url;

  const mutation = {
    query: `mutation {
      updateProjectV2ItemFieldValue(input: {
        projectId: "${PROJECT_ID}",
        itemId: "${issueItemId}",
        fieldId: "${STATUS_FIELD_ID}",
        value: { singleSelectOptionId: "${REVIEW_STATUS_ID}" }
      }) {
        clientMutationId
      }
    }`,
  };

  const mutationResponse = await fetch(GITHUB_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mutation),
  });

  const mutationData = await mutationResponse.json();
  if (mutationData.errors) {
    console.error("GitHub API Mutation Error:", mutationData.errors);
    throw new Error("Failed to update issue status to REVIEW.");
  }

  console.log(`✅ Issue #${issueNumber} moved to REVIEW.`);
  return { issueNumber, issueUrl };
}

export async function moveTaskToInDone(issueNumber) {
  if (!issueNumber) {
    throw new Error("Issue number is required.");
  }

  const query = {
    query: `query {
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
    }`,
  };

  const response = await fetch(GITHUB_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
  });

  const data = await response.json();
  if (data.errors) {
    console.error("GitHub API Error:", data.errors);
    throw new Error("Failed to fetch project tasks.");
  }

  const issueItem = data.data.node.items.nodes.find(
    (item) => item.content?.number == issueNumber
  );

  if (!issueItem) {
    throw new Error(`Issue #${issueNumber} not found in the project.`);
  }

  const issueItemId = issueItem.id;
  const issueUrl = issueItem.content.url;

  const mutation = {
    query: `mutation {
      updateProjectV2ItemFieldValue(input: {
        projectId: "${PROJECT_ID}",
        itemId: "${issueItemId}",
        fieldId: "${STATUS_FIELD_ID}",
        value: { singleSelectOptionId: "${DONE_STATUS_ID}" }
      }) {
        clientMutationId
      }
    }`,
  };

  const mutationResponse = await fetch(GITHUB_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mutation),
  });

  const mutationData = await mutationResponse.json();
  if (mutationData.errors) {
    console.error("GitHub API Mutation Error:", mutationData.errors);
    throw new Error("Failed to update issue status to Done.");
  }

  console.log(`✅ Issue #${issueNumber} moved to Done.`);
  return { issueNumber, issueUrl };
}
