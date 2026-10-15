import fs from "node:fs";
import path from "node:path";
import git from "isomorphic-git";

const http = {
  async request({ url, method = "GET", headers = {}, body }) {
    let requestBody;
    if (body) {
      const chunks = [];
      for await (const chunk of body) chunks.push(Buffer.from(chunk));
      requestBody = Buffer.concat(chunks);
    }
    const response = await fetch(url, {
      method,
      headers,
      body: requestBody,
      redirect: "follow",
      signal: AbortSignal.timeout(60_000)
    });
    return {
      url: response.url,
      method,
      statusCode: response.status,
      statusMessage: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: response.body
    };
  }
};

const dir = path.resolve(process.cwd());
const gitdir = path.join(dir, ".site-git");
const remoteUrl = process.env.SITES_GIT_REMOTE;
const token = process.env.SITES_GIT_TOKEN;

if (!remoteUrl || !token) {
  throw new Error("SITES_GIT_REMOTE and SITES_GIT_TOKEN are required for this one-time push.");
}

if (!fs.existsSync(gitdir)) {
  await git.init({ fs, dir, gitdir, defaultBranch: "main" });
}

await git.addRemote({ fs, dir, gitdir, remote: "origin", url: remoteUrl, force: true });
await git.add({ fs, dir, gitdir, filepath: "." });

const matrix = await git.statusMatrix({ fs, dir, gitdir });
for (const [filepath, head, workdir] of matrix) {
  if (head === 1 && workdir === 0) await git.remove({ fs, dir, gitdir, filepath });
}

const sha = await git.commit({
  fs,
  dir,
  gitdir,
  author: { name: "Codex", email: "codex@openai.com" },
  message: "Build Aoupa add-on marketplace"
});

await git.push({
  fs,
  http,
  dir,
  gitdir,
  remote: "origin",
  ref: "main",
  remoteRef: "main",
  headers: { Authorization: `Bearer ${token}` },
  onAuth: () => ({ username: "x-access-token", password: token })
});

process.stdout.write(sha);
