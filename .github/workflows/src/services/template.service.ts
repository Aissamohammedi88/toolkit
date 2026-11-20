ts
import * as fs from 'fs';
import * as path from 'path';
import * as ejs from 'ejs';

export class TemplateService {
  async render(templateName: string, data: any): Promise<string> {
    const templatePath = path.join(__dirname, '../../templates', templateName);
    const content = await fs.promises.readFile(templatePath, 'utf-8');
    return ejs.render(content, data, { escape: ejs.escapeXML });
  }
}
