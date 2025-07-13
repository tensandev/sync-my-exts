import * as vscode from 'vscode';
import axios, { AxiosError } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { GitHubAuth } from './githubAuth';

interface ExtensionInfo {
    id: string;
    name: string;
    version: string;
    description?: string;
}

interface ExtensionsData {
    extensions: ExtensionInfo[];
    lastUpdated: string;
    vscodeVersion: string;
}

export class ExtensionSync {
    private githubAuth: GitHubAuth;

    constructor(context: vscode.ExtensionContext) {
        this.githubAuth = new GitHubAuth(context);
    }

    private getConfig() {
        const config = vscode.workspace.getConfiguration('syncMyExts');
        return {
            repository: config.get<string>('repository', ''),
            fileName: config.get<string>('fileName', 'extensions.json')
        };
    }

    private async getRepository(): Promise<string> {
        const config = this.getConfig();
        let repository = config.repository;

        if (!repository) {
            // リポジトリ名が設定されていない場合は入力要求
            const inputRepository = await vscode.window.showInputBox({
                prompt: 'GitHubリポジトリ名を入力してください（例: username/repo-name）',
                placeHolder: 'username/repo-name',
                ignoreFocusOut: true
            });

            if (!inputRepository) {
                throw new Error('リポジトリ名が入力されませんでした');
            }

            // 設定を保存
            await vscode.workspace.getConfiguration('syncMyExts').update('repository', inputRepository, vscode.ConfigurationTarget.Global);
            repository = inputRepository;
        }

        return repository;
    }

    private async getGitHubToken(): Promise<string> {
        const token = await this.githubAuth.getStoredToken();
        if (!token) {
            throw new Error('GitHubにログインしてください。サイドバーから「GitHubにログイン」を実行してください。');
        }
        return token;
    }

    private async getInstalledExtensions(): Promise<ExtensionInfo[]> {
        const extensions = vscode.extensions.all;
        return extensions
            .filter(ext => !ext.packageJSON.isBuiltin)
            .map(ext => ({
                id: ext.id,
                name: ext.packageJSON.displayName || ext.packageJSON.name,
                version: ext.packageJSON.version,
                description: ext.packageJSON.description
            }));
    }

    // ユーザー設定ファイルのパスを取得
    private getUserSettingsPath(): string {
        const appData = process.env.APPDATA ||
            (process.platform === 'darwin'
                ? path.join(process.env.HOME || '', 'Library/Application Support')
                : path.join(process.env.HOME || '', '.config'));
        if (process.platform === 'win32') {
            return path.join(appData, 'Code', 'User', 'settings.json');
        } else if (process.platform === 'darwin') {
            return path.join(appData, 'Code', 'User', 'settings.json');
        } else {
            return path.join(appData, 'Code', 'User', 'settings.json');
        }
    }

    // リモート接続時の設定ファイルパスを取得
    private getRemoteSettingsPath(): string | undefined {
        const remoteEnv = process.env['VSCODE_REMOTE_ENV'];
        if (remoteEnv) {
            // 例: /home/xxx/.vscode-server/data/Machine/settings.json
            return path.join(remoteEnv, 'data', 'Machine', 'settings.json');
        }
        // SSHリモートの場合の一般的なパス
        if (process.env.HOME) {
            const sshPath = path.join(process.env.HOME, '.vscode-server', 'data', 'Machine', 'settings.json');
            if (fs.existsSync(sshPath)) {
                return sshPath;
            }
        }
        return undefined;
    }

    // ユーザー設定をGitHubに同期
    async syncSettings(): Promise<void> {
        const config = this.getConfig();
        const userSettingsPath = this.getUserSettingsPath();
        if (!fs.existsSync(userSettingsPath)) {
            throw new Error('ユーザー設定ファイルが見つかりません。');
        }
        const settingsContent = fs.readFileSync(userSettingsPath, 'utf-8');
        await this.createOrUpdateFile(settingsContent, 'settings.json');

        // リモート設定もあれば同期
        const remoteSettingsPath = this.getRemoteSettingsPath();
        if (remoteSettingsPath && fs.existsSync(remoteSettingsPath)) {
            const remoteContent = fs.readFileSync(remoteSettingsPath, 'utf-8');
            await this.createOrUpdateFile(remoteContent, 'remote-settings.json');
        }
    }

    // GitHubからユーザー設定をインポート
    async importSettings(): Promise<void> {
        const config = this.getConfig();
        // settings.json
        const userSettingsContent = await this.getFileContent('settings.json');
        const userSettingsPath = this.getUserSettingsPath();
        fs.writeFileSync(userSettingsPath, userSettingsContent, 'utf-8');
        // remote-settings.json
        try {
            const remoteSettingsContent = await this.getFileContent('remote-settings.json');
            const remoteSettingsPath = this.getRemoteSettingsPath();
            if (remoteSettingsPath) {
                fs.writeFileSync(remoteSettingsPath, remoteSettingsContent, 'utf-8');
            }
        } catch (e) {
            // remote-settings.jsonが無い場合は無視
        }
    }

    private async createOrUpdateFile(content: string, fileName?: string): Promise<void> {
        const config = this.getConfig();
        const targetFile = fileName || config.fileName;
        const token = await this.getGitHubToken();
        const repository = await this.getRepository();
        
        const [owner, repo] = repository.split('/');
        if (!owner || !repo) {
            throw new Error('リポジトリ名の形式が正しくありません。例: username/repo-name');
        }

        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${targetFile}`;
        const headers = {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json'
        };

        try {
            // ファイルが存在するかチェック
            await axios.get(apiUrl, { headers });
            
            // ファイルが存在する場合は更新
            const updateData = {
                message: `Update ${targetFile} - ${new Date().toISOString()}`,
                content: Buffer.from(content).toString('base64'),
                sha: (await axios.get(apiUrl, { headers })).data.sha
            };
            
            await axios.put(apiUrl, updateData, { headers });
        } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                // ファイルが存在しない場合は新規作成
                const createData = {
                    message: `Create ${targetFile} - ${new Date().toISOString()}`,
                    content: Buffer.from(content).toString('base64')
                };
                
                await axios.put(apiUrl, createData, { headers });
            } else {
                throw error;
            }
        }
    }

    private async getFileContent(fileName?: string): Promise<string> {
        const config = this.getConfig();
        const targetFile = fileName || config.fileName;
        const token = await this.getGitHubToken();
        const repository = await this.getRepository();
        
        const [owner, repo] = repository.split('/');
        if (!owner || !repo) {
            throw new Error('リポジトリ名の形式が正しくありません。例: username/repo-name');
        }

        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${targetFile}`;
        const headers = {
            'Authorization': `token ${token}`
        };

        try {
            const response = await axios.get(apiUrl, { headers });
            const content = Buffer.from(response.data.content, 'base64').toString();
            return content;
        } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                throw new Error(`${targetFile} が見つかりません。先に同期を実行してください。`);
            }
            throw error;
        }
    }

    async syncExtensions(): Promise<void> {
        const extensions = await this.getInstalledExtensions();
        const data: ExtensionsData = {
            extensions,
            lastUpdated: new Date().toISOString(),
            vscodeVersion: vscode.version
        };

        const content = JSON.stringify(data, null, 2);
        await this.createOrUpdateFile(content);
    }

    async importExtensions(): Promise<void> {
        const content = await this.getFileContent();
        const data: ExtensionsData = JSON.parse(content);

        // 拡張機能の一覧を表示
        const items = data.extensions.map(ext => ({
            label: ext.name,
            description: ext.id,
            detail: ext.description || '',
            extension: ext
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'インストールする拡張機能を選択してください（複数選択可）',
            canPickMany: true
        });

        if (selected && selected.length > 0) {
            const progressOptions = {
                location: vscode.ProgressLocation.Notification,
                title: '拡張機能をインストール中...',
                cancellable: false
            };

            await vscode.window.withProgress(progressOptions, async (progress) => {
                for (let i = 0; i < selected.length; i++) {
                    const item = selected[i];
                    progress.report({
                        message: `${item.label} をインストール中... (${i + 1}/${selected.length})`
                    });

                    try {
                        await vscode.commands.executeCommand('workbench.extensions.installExtension', item.extension.id);
                    } catch (error) {
                        vscode.window.showWarningMessage(`${item.label} のインストールに失敗しました: ${error}`);
                    }
                }
            });
        }
    }
} 