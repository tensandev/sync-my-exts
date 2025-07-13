import * as vscode from 'vscode';
import { ExtensionSync } from './extensionSync';
import { GitHubAuth } from './githubAuth';

class SyncTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly command?: vscode.Command,
        public readonly iconPath?: vscode.ThemeIcon
    ) {
        super(label);
        if (command) this.command = command;
        if (iconPath) this.iconPath = iconPath;
    }
}

class SyncTreeDataProvider implements vscode.TreeDataProvider<SyncTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SyncTreeItem | undefined | void> = new vscode.EventEmitter<SyncTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<SyncTreeItem | undefined | void> = this._onDidChangeTreeData.event;
    private githubAuth: GitHubAuth;

    constructor(context: vscode.ExtensionContext) {
        this.githubAuth = new GitHubAuth(context);
    }

    getTreeItem(element: SyncTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SyncTreeItem): Promise<SyncTreeItem[]> {
        if (!element) {
            const isLoggedIn = await this.githubAuth.isLoggedIn();
            
            if (!isLoggedIn) {
                return [
                    new SyncTreeItem('GitHubにログイン', {
                        command: 'sync-my-exts.loginToGitHub',
                        title: 'GitHubにログイン'
                    }, new vscode.ThemeIcon('sign-in'))
                ];
            }

            return [
                new SyncTreeItem('拡張機能一覧をGitHubに同期', {
                    command: 'sync-my-exts.syncExtensions',
                    title: '拡張機能一覧をGitHubに同期'
                }, new vscode.ThemeIcon('cloud-upload')),
                new SyncTreeItem('GitHubから拡張機能一覧をインポート', {
                    command: 'sync-my-exts.importExtensions',
                    title: 'GitHubから拡張機能一覧をインポート'
                }, new vscode.ThemeIcon('cloud-download')),
                new SyncTreeItem('ユーザー設定をGitHubに同期', {
                    command: 'sync-my-exts.syncSettings',
                    title: 'ユーザー設定をGitHubに同期'
                }, new vscode.ThemeIcon('cloud-upload')),
                new SyncTreeItem('GitHubからユーザー設定をインポート', {
                    command: 'sync-my-exts.importSettings',
                    title: 'GitHubからユーザー設定をインポート'
                }, new vscode.ThemeIcon('cloud-download')),
                new SyncTreeItem('GitHubからログアウト', {
                    command: 'sync-my-exts.logoutFromGitHub',
                    title: 'GitHubからログアウト'
                }, new vscode.ThemeIcon('sign-out')),
                new SyncTreeItem('リポジトリ名を変更', {
                    command: 'sync-my-exts.changeRepository',
                    title: 'リポジトリ名を変更'
                }, new vscode.ThemeIcon('gear'))
            ];
        }
        return [];
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}

export function activate(context: vscode.ExtensionContext) {
    const extensionSync = new ExtensionSync(context);
    const githubAuth = new GitHubAuth(context);

    // TreeViewの登録
    const treeDataProvider = new SyncTreeDataProvider(context);
    vscode.window.registerTreeDataProvider('syncMyExtsView', treeDataProvider);

    // GitHubログインコマンド
    const loginCommand = vscode.commands.registerCommand('sync-my-exts.loginToGitHub', async () => {
        const success = await githubAuth.login();
        if (success) {
            treeDataProvider.refresh();
        }
    });

    // GitHubログアウトコマンド
    const logoutCommand = vscode.commands.registerCommand('sync-my-exts.logoutFromGitHub', async () => {
        await githubAuth.logout();
        treeDataProvider.refresh();
    });

    // リポジトリ名変更コマンド
    const changeRepositoryCommand = vscode.commands.registerCommand('sync-my-exts.changeRepository', async () => {
        const newRepository = await vscode.window.showInputBox({
            prompt: '新しいGitHubリポジトリ名を入力してください（例: username/repo-name）',
            placeHolder: 'username/repo-name',
            value: vscode.workspace.getConfiguration('syncMyExts').get<string>('repository', ''),
            ignoreFocusOut: true
        });

        if (newRepository) {
            await vscode.workspace.getConfiguration('syncMyExts').update('repository', newRepository, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`リポジトリ名を変更しました: ${newRepository}`);
        }
    });

    // 設定を開くコマンド
    const openSettingsCommand = vscode.commands.registerCommand('sync-my-exts.openSettings', () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'syncMyExts');
    });

    // 拡張機能一覧をGitHubに同期するコマンド
    const syncCommand = vscode.commands.registerCommand('sync-my-exts.syncExtensions', async () => {
        try {
            await extensionSync.syncExtensions();
            vscode.window.showInformationMessage('拡張機能一覧をGitHubに同期しました！');
        } catch (error) {
            vscode.window.showErrorMessage(`同期に失敗しました: ${error}`);
        }
    });

    // GitHubから拡張機能一覧をインポートするコマンド
    const importCommand = vscode.commands.registerCommand('sync-my-exts.importExtensions', async () => {
        try {
            await extensionSync.importExtensions();
            vscode.window.showInformationMessage('拡張機能一覧をインポートしました！');
        } catch (error) {
            vscode.window.showErrorMessage(`インポートに失敗しました: ${error}`);
        }
    });
    // ユーザー設定をGitHubに同期
    const syncSettingsCommand = vscode.commands.registerCommand('sync-my-exts.syncSettings', async () => {
        try {
            await extensionSync.syncSettings();
            vscode.window.showInformationMessage('ユーザー設定をGitHubに同期しました！');
        } catch (error) {
            vscode.window.showErrorMessage(`設定同期に失敗しました: ${error}`);
        }
    });
    // GitHubからユーザー設定をインポート
    const importSettingsCommand = vscode.commands.registerCommand('sync-my-exts.importSettings', async () => {
        try {
            await extensionSync.importSettings();
            vscode.window.showInformationMessage('ユーザー設定をインポートしました！');
        } catch (error) {
            vscode.window.showErrorMessage(`設定インポートに失敗しました: ${error}`);
        }
    });

    context.subscriptions.push(
        syncCommand, 
        importCommand, 
        syncSettingsCommand, 
        importSettingsCommand,
        loginCommand,
        logoutCommand,
        changeRepositoryCommand
    );
}

export function deactivate() {} 