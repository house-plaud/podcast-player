import { spawn } from 'node:child_process';

export interface ClaudeOptions {
  model: string;
  systemPrompt: string;
  schema: object;
}

// 调用本机已登录的 claude CLI 做一次无工具、无会话的结构化输出。
// --setting-sources "" 与 --strict-mcp-config 让它不加载 CLAUDE.md / 插件 / MCP，
// 否则每次调用会多带几万 token 的无关上下文。
export function runClaude(input: string, opts: ClaudeOptions): Promise<unknown> {
  const args = [
    '-p',
    '--model', opts.model,
    '--output-format', 'json',
    '--no-session-persistence',
    '--tools', '',
    '--strict-mcp-config',
    '--setting-sources', '',
    '--system-prompt', opts.systemPrompt,
    '--json-schema', JSON.stringify(opts.schema),
  ];
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => {
      try {
        const out = JSON.parse(stdout) as { is_error?: boolean; result?: string; structured_output?: unknown };
        if (code !== 0 || out.is_error || out.structured_output === undefined) {
          throw new Error(out.result || `exit ${code}`);
        }
        resolve(out.structured_output);
      } catch (err) {
        reject(new Error(`claude -p 失败：${(err as Error).message}${stderr ? `\n${stderr.trim()}` : ''}`));
      }
    });
    child.stdin.end(input);
  });
}
