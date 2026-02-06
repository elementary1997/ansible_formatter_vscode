/**
 * Утилиты для работы с текстом
 */

/**
 * Удаляет ANSI escape коды из строки
 */
export function stripAnsiCodes(text: string): string {
    // Удаляем все ANSI escape последовательности
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
               .replace(/\x1B\][0-9;]*[^\x07]*\x07/g, '')
               .replace(/\[\d+m/g, '')
               .replace(/\[[\d;]+m/g, '')
               .replace(/\[\d+;\d+m/g, '')
               .replace(/\[m/g, '')
               .replace(/\[0m/g, '')
               .replace(/\[1m/g, '')
               .replace(/\[33m/g, '')
               .replace(/\[31m/g, '')
               .replace(/\[32m/g, '')
               .replace(/\[36m/g, '')
               .replace(/\[K/g, '')
               .replace(/\[i/g, '')
               .replace(/\[\/\]/g, '');
}
