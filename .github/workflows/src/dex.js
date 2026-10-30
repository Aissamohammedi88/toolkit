const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    const token = core.getInput('github-token');
    const llmKey = core.getInput('llm-api-key');
    const model = core.getInput('model');
    const testCmd = core.getInput('test-command');

    const octokit = github.getOctokit(token);
    const openai = new OpenAI({ apiKey: llmKey });
    const { owner, repo } = github.context.repo;

    core.info(`🔍 Running tests to capture failure logs...`);
    
    // 1. Lancer les tests et capturer la sortie
    let stderr = '';
    let exitCode = 0;
    
    const options = {
      listeners: {
        stderr: (data) => { stderr += data.toString(); }
      },
      ignoreReturnCode: true
    };
    
    exitCode = await exec.exec(testCmd, [], options);

    if (exitCode === 0) {
      core.info('✅ Tests passed. No healing needed.');
      return;
    }

    core.warning(`❌ Tests failed (Exit ${exitCode}). Invoking AI to heal...`);

    // 2. Demander à l'IA d'analyser l'erreur et de proposer un correctif
    // On lui donne le log d'erreur et on lui demande de renvoyer un bloc JSON
    const prompt = `
      The following command failed: ${testCmd}
      Error output:
      ${stderr.substring(0, 3000)}
      
      Analyze the error. Identify the file that needs fixing.
      Return a JSON object with:
      { "filepath": "relative/path/to/file", "new_content": "The entire fixed content of the file" }
      Do not include markdown blocks, just the raw JSON.
    `;

    const response = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const fix = JSON.parse(response.choices[0].message.content);

    if (!fix.filepath || !fix.new_content) {
      core.setFailed('AI did not return a valid file fix.');
      return;
    }

    core.info(`🩹 AI proposed a fix for: ${fix.filepath}`);

    // 3. Appliquer le correctif localement
    const targetFile = path.resolve(process.env.GITHUB_WORKSPACE, fix.filepath);
    fs.writeFileSync(targetFile, fix.new_content, 'utf8');
    core.info(`✅ File updated.`);

    // 4. Vérifier que le correctif fonctionne (re-run des tests)
    core.info(`🧪 Re-running tests to verify the fix...`);
    const reTestCode = await exec.exec(testCmd, [], { ignoreReturnCode: true });

    if (reTestCode !== 0) {
      core.setFailed('❌ AI fix did not resolve the test failures. Aborting.');
      return;
    }

    // 5. Créer une branche, commit et ouvrir une PR
    core.info('🚀 Tests passed! Creating Pull Request...');
    const branchName = `nexus-heal-${Date.now()}`;
    
    // Créer la branche via API
    const { data: ref } = await octokit.rest.git.getRef({
      owner, repo, ref: `heads/${github.context.ref.replace('refs/heads/', '')}`
    });
    
    await octokit.rest.git.createRef({
      owner, repo, ref: `refs/heads/${branchName}`, sha: ref.object.sha
    });

    // Mettre à jour le fichier dans la nouvelle branche
    const { data: currentFile } = await octokit.rest.repos.getContent({
      owner, repo, path: fix.filepath, ref: branchName
    });

    await octokit.rest.repos.createOrUpdateFileContents({
      owner, repo, path: fix.filepath, branch: branchName,
      message: `fix: auto-heal by Nexus Agent`,
      content: Buffer.from(fix.new_content).toString('base64'),
      sha: currentFile.sha
    });

    // Ouvrir la PR
    await octokit.rest.pulls.create({
      owner, repo, head: branchName,
      base: github.context.ref.replace('refs/heads/', ''),
      title: `🤖 Auto-Heal: Fix failing tests in ${fix.filepath}`,
      body: `## 🩺 Nexus Self-Healing Agent\n\nThe CI tests failed. The agent analyzed the logs and applied a fix.\n\n**File:** \`${fix.filepath}\`\n\n*This PR was generated automatically.*`
    });

    core.info(`✅ Pull Request created successfully!`);

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
