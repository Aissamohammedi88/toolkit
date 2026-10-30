const core = require('@actions/core');
const github = require('@actions/github');
const { OpenAI } = require('openai');
const axios = require('axios');

async function run() {
  try {
    const token = core.getInput('github-token');
    const llmKey = core.getInput('llm-api-key');
    const model = core.getInput('llm-model');
    const failOnCritical = core.getInput('fail-on-critical') === 'true';

    const octokit = github.getOctokit(token);
    const openai = new OpenAI({ apiKey: llmKey });

    const context = github.context;
    const { owner, repo } = context.repo;
    const pull_number = context.payload.pull_request?.number;

    if (!pull_number) {
      core.info('Not a pull request. Exiting.');
      return;
    }

    core.info(`🧠 Analyzing PR #${pull_number}...`);

    // 1. Récupérer les fichiers modifiés
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner, repo, pull_number, per_page: 100
    });

    let diffContent = files
      .filter(f => f.patch)
      .map(f => `File: ${f.filename}\n${f.patch}`)
      .join('\n\n');

    if (!diffContent) {
      core.info('No code changes to analyze.');
      return;
    }

    // 2. Demander à l'IA d'analyser le code
    core.info(`🤖 Asking ${model} to review the code...`);
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are a Senior Security Engineer. Analyze the following git diff. Find logic flaws, security vulnerabilities (OWASP), and architectural issues. Format your response in Markdown. If critical, start with "CRITICAL:".'
        },
        { role: 'user', content: diffContent }
      ],
      temperature: 0.2
    });

    const review = response.choices[0].message.content;

    // 3. Poster le commentaire sur la PR
    await octokit.rest.issues.createComment({
      owner, repo, issue_number: pull_number,
      body: `## 🛡️ Nexus Autonomous Review\n\n${review}`
    });
    core.info('✅ Review posted.');

    // 4. Si critique, demander des changements
    if (failOnCritical && review.includes('CRITICAL:')) {
      core.warning('Critical issue detected. Requesting changes...');
      await octokit.rest.pulls.createReview({
        owner, repo, pull_number,
        event: 'REQUEST_CHANGES',
        body: 'Critical security or logic flaws detected. Please fix before merging.'
      });
    }

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
