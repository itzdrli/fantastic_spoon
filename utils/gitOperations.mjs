import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// 获取项目根目录的绝对路径
const projectRoot = path.resolve(process.cwd(), '..');

// git 仓库的相对路径（相对于项目根目录）
const repoLocalPath = '/home/dev/koishi-meme';

// 构建 git 仓库的绝对路径
const repoPath = path.join(projectRoot, repoLocalPath);

async function runGitCommand(command) {
  try {
    const { stdout, stderr } = await execAsync(command, { cwd: repoPath });
    if (stderr && !stderr.includes('warning:')) {
      console.error(`Git 命令错误: ${stderr}`);
      return false;
    }
    return stdout.trim();
  } catch (error) {
    console.error(`执行 Git 命令时出错: ${error.message}`);
    return false;
  }
}

export async function commitAndPushMeme(title, fileName) {
  try {
    // 添加新文件
    await runGitCommand(`git add "${fileName}"`);

    // 提交更改
    const commitMessage = `Add new meme: ${title}`;
    const commitResult = await runGitCommand(`git commit -m "${commitMessage}"`);
    if (!commitResult) {
      throw new Error('提交失败');
    }

    // 拉取最新更改
    const pullResult = await runGitCommand('git pull --rebase');
    if (!pullResult) {
      throw new Error('拉取失败');
    }

    // 推送到远程仓库
    const pushResult = await runGitCommand('git push');
    if (!pushResult) {
      throw new Error('推送失败');
    }

    console.log(`成功提交并推送新的 meme: ${title}`);
    return true;
  } catch (error) {
    console.error(`Meme 提交和推送过程中出错: ${error.message}`);
    return false;
  }
}