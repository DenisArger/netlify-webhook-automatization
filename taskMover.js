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
