/**
 * QuickFixer - встроенные быстрые исправления для простых ошибок
 */

import * as vscode from 'vscode';
import { LintError } from './models/lintError';

export class QuickFixer {

    /**
     * Проверяет, есть ли быстрое исправление для данного правила
     */
    public static hasQuickFix(rule: string): boolean {
        const quickFixableRules = [
            'trailing-spaces',
            'yaml[trailing-spaces]',
            'too-many-blank-lines',
            'yaml[too-many-blank-lines]',
            'indentation',
            'yaml[indentation]'
        ];

        return quickFixableRules.some(r =>
            rule.includes(r) || r.includes(rule.toLowerCase())
        );
    }

    /**
     * Применяет быстрое исправление для ошибки
     */
    public static applyQuickFix(
        document: vscode.TextDocument,
        error: LintError
    ): vscode.TextEdit | null {
        const rule = error.rule.toLowerCase();

        if (rule.includes('trailing-spaces')) {
            return this.fixTrailingSpaces(document, error.line);
        }

        if (rule.includes('too-many-blank-lines')) {
            return this.fixTooManyBlankLines(document, error.line);
        }

        if (rule.includes('indentation')) {
            return this.fixIndentation(document, error.line, error.column);
        }

        return null;
    }

    /**
     * Исправление trailing spaces
     */
    private static fixTrailingSpaces(
        document: vscode.TextDocument,
        line: number
    ): vscode.TextEdit {
        const lineIndex = line - 1; // VSCode использует 0-based индексы
        const lineText = document.lineAt(lineIndex).text;
        const fixed = lineText.trimEnd();

        return vscode.TextEdit.replace(
            document.lineAt(lineIndex).range,
            fixed
        );
    }

    /**
     * Исправление слишком большого количества пустых строк
     */
    private static fixTooManyBlankLines(
        document: vscode.TextDocument,
        line: number
    ): vscode.TextEdit {
        const lineIndex = line - 1;

        // Удаляем лишнюю пустую строку
        const lineRange = document.lineAt(lineIndex).rangeIncludingLineBreak;

        return vscode.TextEdit.delete(lineRange);
    }

    /**
     * Исправление отступов
     */
    private static fixIndentation(
        document: vscode.TextDocument,
        line: number,
        column?: number
    ): vscode.TextEdit {
        const lineIndex = line - 1;
        const lineText = document.lineAt(lineIndex).text;
        const trimmed = lineText.trim();

        if (trimmed === '') {
            // Пустая строка - удаляем все пробелы
            return vscode.TextEdit.replace(
                document.lineAt(lineIndex).range,
                ''
            );
        }

        // Определяем правильный отступ на основе контекста
        const expectedIndent = this.calculateExpectedIndent(document, lineIndex);
        const fixed = ' '.repeat(expectedIndent) + trimmed;

        return vscode.TextEdit.replace(
            document.lineAt(lineIndex).range,
            fixed
        );
    }

    /**
     * Вычисляет ожидаемый отступ на основе контекста
     */
    private static calculateExpectedIndent(
        document: vscode.TextDocument,
        lineIndex: number
    ): number {
        const currentLine = document.lineAt(lineIndex).text;
        const trimmed = currentLine.trim();

        // Если строка начинается с '---', отступ 0
        if (trimmed === '---') {
            return 0;
        }

        // Если это list item (- name:, - hosts:, и т.д.)
        if (trimmed.startsWith('-')) {
            // Ищем предыдущий list item или блок
            for (let i = lineIndex - 1; i >= 0; i--) {
                const prevLine = document.lineAt(i).text;
                const prevTrimmed = prevLine.trim();

                if (prevTrimmed === '') continue;

                if (prevTrimmed.startsWith('-')) {
                    // Используем отступ предыдущего list item
                    const prevIndent = prevLine.search(/\S/);
                    return prevIndent;
                }

                if (prevTrimmed.endsWith(':')) {
                    // Находимся внутри блока - list item должен иметь отступ +2
                    const prevIndent = prevLine.search(/\S/);
                    return prevIndent + 2;
                }
            }

            // Если это первый list item на верхнем уровне
            return 0;
        }

        // Если строка заканчивается на ':' (ключ YAML)
        if (trimmed.endsWith(':')) {
            // Ищем родительский уровень
            for (let i = lineIndex - 1; i >= 0; i--) {
                const prevLine = document.lineAt(i).text;
                const prevTrimmed = prevLine.trim();

                if (prevTrimmed === '') continue;

                const prevIndent = prevLine.search(/\S/);

                // Если предыдущая строка тоже ключ или list item
                if (prevTrimmed.endsWith(':') || prevTrimmed.startsWith('-')) {
                    // Ключи на том же уровне
                    return prevIndent;
                }
            }

            return 2; // Default для ключей верхнего уровня (после ---)
        }

        // Для обычных значений - используем отступ предыдущей непустой строки + 2
        for (let i = lineIndex - 1; i >= 0; i--) {
            const prevLine = document.lineAt(i).text;
            const prevTrimmed = prevLine.trim();

            if (prevTrimmed === '') continue;

            const prevIndent = prevLine.search(/\S/);

            // Если предыдущая строка - ключ, добавляем отступ
            if (prevTrimmed.endsWith(':')) {
                return prevIndent + 2;
            }

            // Если предыдущая строка - list item
            if (prevTrimmed.startsWith('-')) {
                return prevIndent + 2;
            }

            // Иначе используем тот же отступ
            return prevIndent;
        }

        return 0; // Default
    }

    /**
     * Применяет все возможные быстрые исправления к документу
     */
    public static applyAllQuickFixes(
        document: vscode.TextDocument,
        errors: LintError[]
    ): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];

        for (const error of errors) {
            if (this.hasQuickFix(error.rule)) {
                const edit = this.applyQuickFix(document, error);
                if (edit) {
                    edits.push(edit);
                }
            }
        }

        return edits;
    }
}
