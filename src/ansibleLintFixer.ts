/**
 * AnsibleLintFixer - обертка для ansible-lint --fix
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { Executor } from './executor';

export class AnsibleLintFixer {
    
    /**
     * Исправить файл с помощью ansible-lint --fix
     */
    public static async fixFile(
        document: vscode.TextDocument
    ): Promise<boolean> {
        const filePath = document.uri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Workspace folder not found');
            return false;
        }
        
        const workspaceRoot = workspaceFolder.uri.fsPath;
        
        try {
            // Сохраняем документ перед исправлением
            await document.save();
            
            // Показываем прогресс
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Running ansible-lint --fix...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0 });
                
                // Запускаем ansible-lint --fix
                await Executor.runAnsibleLintFix(filePath, workspaceRoot);
                
                progress.report({ increment: 50 });
                
                // Читаем исправленный файл
                const fixedContent = fs.readFileSync(filePath, 'utf8');
                
                // Применяем изменения к документу
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                    0, 0,
                    document.lineCount, 0
                );
                edit.replace(document.uri, fullRange, fixedContent);
                
                const success = await vscode.workspace.applyEdit(edit);
                
                progress.report({ increment: 100 });
                
                if (success) {
                    vscode.window.showInformationMessage('File fixed with ansible-lint --fix');
                }
                
                return success;
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`ansible-lint --fix failed: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Получить TextEdit для замены всего файла
     */
    public static async getFixEdits(
        document: vscode.TextDocument
    ): Promise<vscode.TextEdit[]> {
        const filePath = document.uri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        
        if (!workspaceFolder) {
            return [];
        }
        
        const workspaceRoot = workspaceFolder.uri.fsPath;
        
        try {
            // Сохраняем документ
            await document.save();
            
            // Запускаем ansible-lint --fix
            await Executor.runAnsibleLintFix(filePath, workspaceRoot);
            
            // Читаем исправленный файл
            const fixedContent = fs.readFileSync(filePath, 'utf8');
            
            // Создаем edit для замены всего файла
            const fullRange = new vscode.Range(
                0, 0,
                document.lineCount, 0
            );
            
            return [vscode.TextEdit.replace(fullRange, fixedContent)];
        } catch (error: any) {
            console.error('[AnsibleLintFixer] Failed to get fix edits:', error.message);
            return [];
        }
    }
}
