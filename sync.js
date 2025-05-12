const axios = require("axios");
const Slimbot = require("slimbot");
const isImageUrl = require("is-image-url");

const GIST_SHORT_IDS = process.env.GIST_SHORT_IDS_STR.split(",");
const GITHUB_PAT = process.env.GIST_PAT;
const BOT_TOKEN = process.env.BOT_TOKEN;

const TELEGRAM_CHAT_ID = -1001249449971;
const Login = "SimonAKing";
const REPO = "weibo";

const github = axios.create({
  baseURL: "https://api.github.com/",
  headers: {
    Accept: "application/json",
    Authorization: `bearer ${GITHUB_PAT}`,
  },
});

const slimbot = new Slimbot(BOT_TOKEN);

async function fetchGraphQL(query, variables = {}) {
  if (!GITHUB_PAT) {
    throw new Error(
      "GitHub Personal Access Token (GITHUB_PAT) not found in environment variables."
    );
  }

  try {
    const response = await github.post("/graphql", { query, variables });
    const data = response.data;

    if (data.errors) {
      console.error("GraphQL Errors:", JSON.stringify(data.errors, null, 2));
      throw new Error(
        `GraphQL request failed: ${data.errors
          .map((e) => e.message)
          .join(", ")}`
      );
    }

    return data.data;
  } catch (error) {
    console.error("Error in fetchGraphQL:", error.message);
    throw error;
  }
}

async function getLatestIssues(owner, repo, count = 6) {
  const query = `
  query getIssues($owner: String!, $repo: String!, $count: Int!) {
    repository(owner: $owner, name: $repo) {
      issues(first: $count, orderBy: {field: CREATED_AT, direction: DESC},
        filterBy: {createdBy: $owner, states: OPEN}) {
        nodes {
          title
          body
          createdAt
          url
          labels(first: 10) {
            nodes {
              name
            }
          }
        }
      }
    }
  }
  `;

  console.log(`Fetching latest ${count} issues from ${owner}/${repo}...`);
  const variables = { owner, repo, count };
  const data = await fetchGraphQL(query, variables);

  if (
    data &&
    data.repository &&
    data.repository.issues &&
    data.repository.issues.nodes
  ) {
    const issues = data.repository.issues.nodes;
    console.log(`Found ${issues.length} issues.`);
    return issues.map((issue) => ({
      title: issue.title,
      body: issue.body,
      createdAt: new Date(issue.createdAt),
      url: issue.url,
      labels: issue.labels.nodes.map((label) => label.name),
    }));
  } else {
    console.error("Failed to retrieve issues data.");
    return [];
  }
}

async function updateGistContent(gistId, content, description) {
  try {
    const files = {
      "content.md": {
        content: content,
      },
    };

    console.log(`Updating Gist ${gistId} with new content...`);
    const response = await github.patch(`/gists/${gistId}`, {
      description: description,
      files: files,
    });

    console.log(`Gist ${gistId} updated successfully.`);
    return response.data;
  } catch (error) {
    console.error(`Error updating Gist ${gistId}:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Response data:`, error.response.data);
    }
    return null;
  }
}

function formatIssueContent(issue) {
  const labelsText =
    issue.labels.length > 0 ? `Labels: ${issue.labels.join(", ")}\n\n` : "";

  return `${issue.body}

---
${labelsText}Original post: https://simonaking.com/blog/weibo`;
}

function formatIssueTitle(issue) {
  const date = issue.createdAt.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return `${issue.title} - ${date}`;
}

async function sendToTelegram(issue) {
  if (!BOT_TOKEN || !slimbot) {
    console.log("Telegram bot token not set, skipping Telegram notification");
    return;
  }

  try {
    console.log("Sending issue to Telegram group...");

    const formattedContent = formatIssueContent(issue);

    const telegramMessage = `*${issue.title}*\n\n${formattedContent}`;

    const config = {
      parse_mode: "Markdown",
      disable_web_page_preview: false,
      disable_notification: false,
    };

    await slimbot.sendMessage(TELEGRAM_CHAT_ID, telegramMessage, config);

    const imageRegex = /(?:!\[(.*?)\]\((.*?)\))/g;
    const images = issue.body.match(imageRegex);

    if (images && images.length > 0) {
      console.log(
        `Found ${images.length} images in issue, sending to Telegram...`
      );

      for (const image of images) {
        const url = image.slice(image.indexOf("(") + 1, -1);
        if (isImageUrl(url)) {
          await slimbot.sendPhoto(TELEGRAM_CHAT_ID, url);
        }
      }
    }

    console.log("Successfully sent issue to Telegram");
    return true;
  } catch (error) {
    console.error("Error sending to Telegram:", error.message);
    return false;
  }
}

async function main() {
  if (!GITHUB_PAT) {
    console.error("ERROR: GITHUB_PAT environment variable is not set.");
    return;
  }

  try {
    const issues = await getLatestIssues(Login, REPO);
    if (issues.length === 0) {
      console.error("No issues found. Exiting.");
      return;
    }

    if (issues.length > 0) {
      await sendToTelegram(issues[0]);
    }

    const activeGistIds = GIST_SHORT_IDS.filter(
      (id) => id && !id.startsWith("YOUR_GIST_ID")
    );
    if (activeGistIds.length === 0) {
      console.error(
        "No valid Gist IDs provided. Update the GIST_SHORT_IDS array with your Gist IDs. Exiting."
      );
      return;
    }

    console.log(
      `Updating ${Math.min(
        issues.length,
        activeGistIds.length
      )} Gists with issue content...`
    );

    for (let i = 0; i < Math.min(issues.length, activeGistIds.length); i++) {
      const issue = issues[i];
      const gistId = activeGistIds[i];

      const formattedContent = formatIssueContent(issue);
      const formattedTitle = formatIssueTitle(issue);

      await updateGistContent(gistId, formattedContent, formattedTitle);
    }
  } catch (error) {
    console.error("Error in main execution:", error);
  }
}

main().catch((error) => {
  console.error("Unhandled error in main execution:", error);
});
