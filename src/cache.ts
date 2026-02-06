/**
 * Cache.ts - система кэширования результатов линтинга
 *
 * Кэширует результаты проверки файлов на основе их содержимого (hash).
 * Если файл не изменился с последней проверки, используется кэшированный результат.
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { LintError } from './models/lintError';

interface CacheEntry {
    contentHash: string;
    errors: LintError[];
    timestamp: number;
}

interface CacheData {
    [filePath: string]: CacheEntry;
}

export class LintCache {
    private static instance: LintCache;
    private cache: CacheData = {};
    private context: vscode.ExtensionContext | null = null;
    private readonly CACHE_KEY = 'lintCache';
    private readonly MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 часа

    private constructor() {}

    static getInstance(): LintCache {
        if (!LintCache.instance) {
            LintCache.instance = new LintCache();
        }
        return LintCache.instance;
    }

    /**
     * Инициализация кэша с контекстом расширения
     */
    initialize(context: vscode.ExtensionContext): void {
        this.context = context;
        this.loadCache();
    }

    /**
     * Вычислить hash содержимого файла
     */
    private computeHash(content: string): string {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Проверить, есть ли актуальный кэш для файла
     */
    hasValidCache(filePath: string, content: string): boolean {
        const entry = this.cache[filePath];
        if (!entry) {
            return false;
        }

        // Проверяем hash
        const currentHash = this.computeHash(content);
        if (entry.contentHash !== currentHash) {
            return false;
        }

        // Проверяем возраст кэша
        const age = Date.now() - entry.timestamp;
        if (age > this.MAX_CACHE_AGE_MS) {
            return false;
        }

        return true;
    }

    /**
     * Получить кэшированные ошибки для файла
     */
    getCachedErrors(filePath: string): LintError[] | null {
        const entry = this.cache[filePath];
        return entry ? entry.errors : null;
    }

    /**
     * Сохранить результаты в кэш
     */
    setCacheEntry(filePath: string, content: string, errors: LintError[]): void {
        this.cache[filePath] = {
            contentHash: this.computeHash(content),
            errors: errors,
            timestamp: Date.now()
        };
        this.saveCache();
    }

    /**
     * Удалить запись из кэша
     */
    invalidate(filePath: string): void {
        delete this.cache[filePath];
        this.saveCache();
    }

    /**
     * Очистить весь кэш
     */
    clear(): void {
        this.cache = {};
        this.saveCache();
        console.log('[Cache] Cache cleared');
    }

    /**
     * Получить статистику кэша
     */
    getStats(): { cachedFiles: number; totalErrors: number } {
        const files = Object.keys(this.cache);
        const totalErrors = files.reduce((sum, file) => {
            return sum + (this.cache[file]?.errors?.length || 0);
        }, 0);

        return {
            cachedFiles: files.length,
            totalErrors: totalErrors
        };
    }

    /**
     * Загрузить кэш из workspaceState
     */
    private loadCache(): void {
        if (!this.context) return;

        try {
            const saved = this.context.workspaceState.get<CacheData>(this.CACHE_KEY);
            if (saved) {
                // Очищаем устаревшие записи при загрузке
                const now = Date.now();
                this.cache = {};

                for (const [filePath, entry] of Object.entries(saved)) {
                    if (now - entry.timestamp < this.MAX_CACHE_AGE_MS) {
                        this.cache[filePath] = entry;
                    }
                }

                console.log('[Cache] Loaded cache with', Object.keys(this.cache).length, 'entries');
            }
        } catch (error: any) {
            console.error('[Cache] Failed to load cache:', error.message);
            this.cache = {};
        }
    }

    /**
     * Сохранить кэш в workspaceState
     */
    private saveCache(): void {
        if (!this.context) return;

        try {
            this.context.workspaceState.update(this.CACHE_KEY, this.cache);
        } catch (error: any) {
            console.error('[Cache] Failed to save cache:', error.message);
        }
    }
}
