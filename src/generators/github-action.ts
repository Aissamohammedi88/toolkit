ts
import { Injectable } from '@nestjs/common';
import { TemplateService } from '../services/template.service';
import { Pipeline } from '../config/schema';

@Injectable()
export class GithubActionGenerator {
  constructor(private readonly template: TemplateService) {}

  async generate(pipeline: Pipeline): Promise<string> {
    const data = {
      name: pipeline.name,
      jobs: pipeline.stages.reduce((acc, stage, idx) => {
        const jobId = stage${idx + 1};
        acc[jobId] = {
          name: stage.name,
          runs_on: 'ubuntu-latest',
          steps: [
            { name: 'Checkout', uses: 'actions/checkout@v4' },
            { name: 'Use Node', uses: 'actions/setup-node@v4', with: { 'node-version': '20' } },
            ...stage.commands.map((cmd) => ({ name: Run ${cmd}, run: cmd })),
          ],
          if: stage.when,
        };
        return acc;
      }, {} as any),
    };
    return this.template.render('github/workflow.yml.ejs', data);
  }
}
