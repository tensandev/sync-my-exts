import * as vscode from 'vscode';
import axios from 'axios';
import { AuthorizationCode } from 'simple-oauth2';

interface GitHubUser {
    login: string;
    id: number;
    avatar_url: string;
    name?: string;
    email?: string;
}

interface GitHubTokenResponse {
    access_token: string;
    token_type: string;
    scope: string;
}

export class GitHubAuth {
    private static readonly REDIRECT_URI = 'http://localhost:3000/callback';
    private static readonly SCOPES = ['repo', 'user'];

    private config: vscode.WorkspaceConfiguration;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.config = vscode.workspace.getConfiguration('syncMyExts');
    }

    private getOAuth2Client() {
        const clientId = this.config.get<string>('clientId', '');
        const clientSecret = this.config.get<string>('clientSecret', '');
        
        if (!clientId || !clientSecret) {
            throw new Error('GitHub OAuth AppのClient IDとClient Secretが設定されていません。');
        }

        return new AuthorizationCode({
            client: {
                id: clientId,
                secret: clientSecret
            },
            auth: {
                tokenHost: 'https://github.com',
                tokenPath: '/login/oauth/access_token',
                authorizeHost: 'https://github.com',
                authorizePath: '/login/oauth/authorize'
            }
        });
    }

    async login(): Promise<boolean> {
        try {
            // 初回設定の確認
            const clientId = this.config.get<string>('clientId', '');
            const clientSecret = this.config.get<string>('clientSecret', '');
            
            if (!clientId || !clientSecret) {
                const setupResult = await this.setupOAuthApp();
                if (!setupResult) {
                    return false;
                }
            }

            const oauth2 = this.getOAuth2Client();
            
            // 認証URLを生成
            const authorizationUri = oauth2.authorizeURL({
                redirect_uri: GitHubAuth.REDIRECT_URI,
                scope: GitHubAuth.SCOPES.join(' '),
                state: this.generateState()
            });

            // ブラウザで認証ページを開く
            await vscode.env.openExternal(vscode.Uri.parse(authorizationUri));

            // ユーザーに認証コードの入力を求める
            const authCode = await vscode.window.showInputBox({
                prompt: 'GitHub認証ページで認証後、表示されたコードを入力してください',
                placeHolder: '認証コードを入力',
                ignoreFocusOut: true
            });

            if (!authCode) {
                throw new Error('認証コードが入力されませんでした');
            }

            // アクセストークンを取得
            const tokenParams = {
                code: authCode,
                redirect_uri: GitHubAuth.REDIRECT_URI
            };

            const accessToken = await oauth2.getToken(tokenParams);
            const token = accessToken.token.access_token as string;

            // ユーザー情報を取得
            const user = await this.getGitHubUser(token);

            // トークンを保存
            await this.saveToken(token, user);

            vscode.window.showInformationMessage(`GitHubにログインしました: ${user.login}`);
            return true;

        } catch (error) {
            vscode.window.showErrorMessage(`GitHubログインに失敗しました: ${error}`);
            return false;
        }
    }

    async logout(): Promise<void> {
        try {
            // 保存されたトークンを削除
            await this.context.secrets.delete('github-token');
            await this.context.secrets.delete('github-user');
            
            vscode.window.showInformationMessage('GitHubからログアウトしました');
        } catch (error) {
            vscode.window.showErrorMessage(`ログアウトに失敗しました: ${error}`);
        }
    }

    async getStoredToken(): Promise<string | undefined> {
        try {
            return await this.context.secrets.get('github-token') || undefined;
        } catch (error) {
            return undefined;
        }
    }

    async isLoggedIn(): Promise<boolean> {
        const token = await this.getStoredToken();
        if (!token) {
            return false;
        }

        try {
            // トークンの有効性を確認
            await this.getGitHubUser(token);
            return true;
        } catch (error) {
            return false;
        }
    }

    private async getGitHubUser(token: string): Promise<GitHubUser> {
        const response = await axios.get('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        return response.data;
    }

    private async saveToken(token: string, user: GitHubUser): Promise<void> {
        // secretsに保存
        await this.context.secrets.store('github-token', token);
        await this.context.secrets.store('github-user', JSON.stringify(user));
    }

    private generateState(): string {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    private async setupOAuthApp(): Promise<boolean> {
        const clientId = await vscode.window.showInputBox({
            prompt: 'GitHub OAuth AppのClient IDを入力してください',
            placeHolder: 'Client ID',
            ignoreFocusOut: true
        });

        if (!clientId) {
            return false;
        }

        const clientSecret = await vscode.window.showInputBox({
            prompt: 'GitHub OAuth AppのClient Secretを入力してください',
            placeHolder: 'Client Secret',
            ignoreFocusOut: true,
            password: true
        });

        if (!clientSecret) {
            return false;
        }

        // 設定を保存
        await this.config.update('clientId', clientId, vscode.ConfigurationTarget.Global);
        await this.config.update('clientSecret', clientSecret, vscode.ConfigurationTarget.Global);

        return true;
    }
} 