import fetch from "node-fetch";

/**
 * Получает список элементов проекта.
 *
 * @param {string} projectId - Идентификатор проекта.
 * @param {string} columnFieldId - Идентификатор поля статуса.
 * @param {string} token - Токен для доступа к API GitHub.
 * @returns {Promise<Array>} - Массив элементов проекта.
 * @throws {Error} - Если API возвращает ошибку.
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
                fieldValues(first: 10) {  
                  nodes {
                    __typename
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      optionId
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

  let response;
  try {
    response = await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });
  } catch (networkError) {
    console.error("❌ Ошибка сети при запросе к GitHub API:", networkError);
    throw new Error("Ошибка сети при запросе к GitHub API");
  }

  const responseText = await response.text();
  if (!response.ok) {
    console.error(
      `❌ Ошибка запроса: Статус ${response.status}, Тело ответа: ${responseText}`
    );
    throw new Error(
      `Ошибка запроса: GitHub API вернул статус ${response.status}. Подробности: ${responseText}`
    );
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (jsonError) {
    console.error("❌ Ошибка парсинга JSON ответа:", responseText, jsonError);
    throw new Error("Ошибка парсинга JSON ответа от GitHub API");
  }

  if (data.errors) {
    console.error(
      "❌ Ошибки GraphQL API:",
      JSON.stringify(data.errors, null, 2)
    );
    throw new Error(
      "Ошибка GraphQL API: " + JSON.stringify(data.errors, null, 2)
    );
  }

  return data?.data?.node?.items?.nodes || [];
}

/**
 * Ищет элемент задачи в проекте по номеру.
 *
 * @param {string|number} issueNumber - Номер задачи.
 * @param {string} projectId - Идентификатор проекта.
 * @param {string} columnFieldId - Идентификатор поля статуса.
 * @param {string} token - Токен для доступа к API GitHub.
 * @returns {Promise<Object|null>} - Элемент задачи или null, если не найден.
 */
async function getIssueItemByNumber(
  issueNumber,
  projectId,
  columnFieldId,
  token
) {
  const items = await fetchProjectItems(projectId, columnFieldId, token);
  return (
    items.find((item) => item?.content?.number === Number(issueNumber)) || null
  );
}

/**
 * Обновляет статус задачи в проекте.
 *
 * @param {string} issueId - Идентификатор элемента задачи.
 * @param {string} projectId - Идентификатор проекта.
 * @param {string} columnFieldId - Идентификатор поля статуса.
 * @param {string} inProgressOptionId - Идентификатор опции "IN_PROGRESS".
 * @param {string} token - Токен для доступа к API GitHub.
 * @returns {Promise<boolean>} - Истина при успешном обновлении.
 * @throws {Error} - Если API возвращает ошибку.
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

  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: mutation }),
  });

  if (!response.ok) {
    throw new Error(`GitHub API responded with status: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(
      "Error updating issue status: " + JSON.stringify(data.errors)
    );
  }

  return true;
}

/**
 * Перемещает задачу из статуса TODO в IN_PROGRESS.
 * Перед обновлением проверяет, находится ли задача уже в IN_PROGRESS.
 *
 * @param {string|number} issueNumber - Номер задачи, извлечённый из имени ветки.
 * @returns {Promise<{ issueUrl: string, alreadyInProgress: boolean }>} - Объект с URL задачи и флагом, указывающим, была ли она уже в IN_PROGRESS.
 * @throws {Error} - Если не удалось обновить статус задачи или найти задачу.
 */
async function moveTaskToInProgress(issueNumber) {
  const token = process.env.TOKEN_AUTOMATIZATION;
  const projectId = process.env.ID_PROJECT_SKILLDOR;
  const columnFieldId = process.env.ID_COLUMN_STATUS_SKILLDOR;
  const inProgressOptionId = process.env.ID_COLUMN_STATUS_IN_PROGRESS_SKILLDOR;

  if (!token || !projectId || !columnFieldId || !inProgressOptionId) {
    throw new Error(
      "❌ Отсутствуют необходимые переменные окружения для обновления статуса задачи."
    );
  }

  // Получаем элемент задачи по номеру
  const issueItem = await getIssueItemByNumber(
    issueNumber,
    projectId,
    columnFieldId,
    token
  );

  if (!issueItem) {
    throw new Error(`❌ Задача #${issueNumber} не найдена в проекте.`);
  }

  const issueUrl = issueItem?.content?.url || "нет ссылки";

  // Проверяем, не находится ли задача уже в IN_PROGRESS
  if (issueItem?.fieldValueByFieldId?.optionId === inProgressOptionId) {
    const message = `⚠️ Задача #${issueNumber} уже находится в IN_PROGRESS.\n🔗 Ссылка: ${issueUrl}`;
    console.log(message);
    await sendTelegramMessage(message); // Отправляем в Telegram
    return { issueUrl, alreadyInProgress: true };
  }

  // Обновляем статус задачи на IN_PROGRESS
  await updateIssueStatus(
    issueItem.id,
    projectId,
    columnFieldId,
    inProgressOptionId,
    token
  );

  const successMessage = `✅ Задача #${issueNumber} перемещена в IN_PROGRESS.\n🔗 Ссылка: ${issueUrl}`;
  console.log(successMessage);
  await sendTelegramMessage(successMessage); // Отправляем в Telegram

  return { issueUrl, alreadyInProgress: false };
}

export { moveTaskToInProgress };
