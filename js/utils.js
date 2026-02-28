// utils.js - вспомогательные функции и утилиты

(function() {
    'use strict';

    window.Utils = class Utils {
        constructor() {
            this.cache = new Map();
        }

        // ========== ФОРМАТИРОВАНИЕ ==========

        // Форматирование чисел (просмотры, лайки)
        formatCount(num) {
            if (num === null || num === undefined) return '0';
            if (num >= 1000000) {
                return (num / 1000000).toFixed(1) + 'M';
            }
            if (num >= 1000) {
                return (num / 1000).toFixed(1) + 'K';
            }
            return num.toString();
        }

        // Форматирование времени
        formatDuration(seconds) {
            if (!seconds || seconds < 0) return '0:00';
            
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }

        // Форматирование даты (относительное время)
        formatTimeAgo(dateString) {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDay = Math.floor(diffHour / 24);
            const diffWeek = Math.floor(diffDay / 7);
            const diffMonth = Math.floor(diffDay / 30);
            const diffYear = Math.floor(diffDay / 365);

            if (diffYear > 0) return `${diffYear} г. назад`;
            if (diffMonth > 0) return `${diffMonth} мес. назад`;
            if (diffWeek > 0) return `${diffWeek} нед. назад`;
            if (diffDay > 0) return `${diffDay} дн. назад`;
            if (diffHour > 0) return `${diffHour} ч. назад`;
            if (diffMin > 0) return `${diffMin} мин. назад`;
            if (diffSec > 30) return `${diffSec} сек. назад`;
            return 'только что';
        }

        // Форматирование размера файла
        formatFileSize(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }

        // Обрезать текст
        truncateText(text, maxLength = 100, suffix = '...') {
            if (!text) return '';
            if (text.length <= maxLength) return text;
            return text.substring(0, maxLength) + suffix;
        }

        // ========== ВАЛИДАЦИЯ ==========

        // Проверка email
        isValidEmail(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        }

        // Проверка URL
        isValidUrl(string) {
            try {
                new URL(string);
                return true;
            } catch (_) {
                return false;
            }
        }

        // Проверка имени пользователя
        isValidUsername(username) {
            return /^[a-zA-Z0-9_]{3,30}$/.test(username);
        }

        // Проверка пароля (минимум 6 символов)
        isValidPassword(password) {
            return password && password.length >= 6;
        }

        // ========== РАБОТА С ДАННЫМИ ==========

        // Глубокая копия объекта
        deepCopy(obj) {
            if (obj === null || typeof obj !== 'object') return obj;
            if (obj instanceof Date) return new Date(obj);
            if (obj instanceof Array) return obj.map(item => this.deepCopy(item));
            if (obj instanceof Object) {
                const copied = {};
                Object.keys(obj).forEach(key => {
                    copied[key] = this.deepCopy(obj[key]);
                });
                return copied;
            }
        }

        // Сравнение объектов
        isEqual(obj1, obj2) {
            return JSON.stringify(obj1) === JSON.stringify(obj2);
        }

        // Группировка массива по ключу
        groupBy(array, key) {
            return array.reduce((result, item) => {
                const groupKey = item[key];
                if (!result[groupKey]) {
                    result[groupKey] = [];
                }
                result[groupKey].push(item);
                return result;
            }, {});
        }

        // Уникальные значения
        unique(array) {
            return [...new Set(array)];
        }

        // Перемешать массив
        shuffle(array) {
            const result = [...array];
            for (let i = result.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [result[i], result[j]] = [result[j], result[i]];
            }
            return result;
        }

        // Взять случайные элементы
        randomItems(array, count) {
            const shuffled = this.shuffle(array);
            return shuffled.slice(0, count);
        }

        // ========== РАБОТА С ЦВЕТАМИ ==========

        // Генерация случайного цвета
        randomColor() {
            const letters = '0123456789ABCDEF';
            let color = '#';
            for (let i = 0; i < 6; i++) {
                color += letters[Math.floor(Math.random() * 16)];
            }
            return color;
        }

        // Генерация цвета на основе текста
        colorFromString(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = str.charCodeAt(i) + ((hash << 5) - hash);
            }
            let color = '#';
            for (let i = 0; i < 3; i++) {
                const value = (hash >> (i * 8)) & 0xFF;
                color += ('00' + value.toString(16)).substr(-2);
            }
            return color;
        }

        // ========== РАБОТА С DOM ==========

        // Создать элемент с атрибутами
        createElement(tag, attributes = {}, children = []) {
            const element = document.createElement(tag);
            
            Object.entries(attributes).forEach(([key, value]) => {
                if (key === 'style' && typeof value === 'object') {
                    Object.assign(element.style, value);
                } else if (key === 'className') {
                    element.className = value;
                } else if (key === 'textContent') {
                    element.textContent = value;
                } else if (key.startsWith('on') && typeof value === 'function') {
                    element.addEventListener(key.slice(2).toLowerCase(), value);
                } else {
                    element.setAttribute(key, value);
                }
            });

            children.forEach(child => {
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else if (child instanceof Node) {
                    element.appendChild(child);
                }
            });

            return element;
        }

        // Удалить все дочерние элементы
        emptyElement(element) {
            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }
        }

        // Показать/скрыть элемент
        show(element) {
            if (element) element.classList.remove('hidden');
        }

        hide(element) {
            if (element) element.classList.add('hidden');
        }

        toggle(element) {
            if (element) element.classList.toggle('hidden');
        }

        // Добавить классы
        addClass(element, className) {
            if (element) element.classList.add(className);
        }

        removeClass(element, className) {
            if (element) element.classList.remove(className);
        }

        hasClass(element, className) {
            return element && element.classList.contains(className);
        }

        // ========== АНИМАЦИИ ==========

        // Плавная прокрутка к элементу
        scrollToElement(element, offset = 0, duration = 300) {
            if (!element) return;
            
            const targetPosition = element.getBoundingClientRect().top + window.pageYOffset - offset;
            const startPosition = window.pageYOffset;
            const distance = targetPosition - startPosition;
            let startTime = null;

            function animation(currentTime) {
                if (startTime === null) startTime = currentTime;
                const timeElapsed = currentTime - startTime;
                const progress = Math.min(timeElapsed / duration, 1);
                
                window.scrollTo(0, startPosition + distance * easeInOutCubic(progress));
                
                if (timeElapsed < duration) {
                    requestAnimationFrame(animation);
                }
            }

            function easeInOutCubic(t) {
                return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            }

            requestAnimationFrame(animation);
        }

        // ========== РАБОТА С LOCALSTORAGE ==========

        // Сохранить с временем жизни
        setWithTTL(key, value, ttlMinutes = 60) {
            const item = {
                value: value,
                expires: Date.now() + (ttlMinutes * 60 * 1000)
            };
            localStorage.setItem(key, JSON.stringify(item));
        }

        // Получить с проверкой TTL
        getWithTTL(key) {
            const itemStr = localStorage.getItem(key);
            if (!itemStr) return null;

            try {
                const item = JSON.parse(itemStr);
                if (Date.now() > item.expires) {
                    localStorage.removeItem(key);
                    return null;
                }
                return item.value;
            } catch {
                return null;
            }
        }

        // ========== ДЕБОУНС И ТРОТТЛИНГ ==========

        // Debounce функция
        debounce(func, delay) {
            let timeoutId;
            return function (...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(this, args), delay);
            };
        }

        // Throttle функция
        throttle(func, limit) {
            let inThrottle;
            return function (...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }

        // ========== РАБОТА С ПРОМИСАМИ ==========

        // Задержка
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        // Retry с задержкой
        async retry(fn, maxAttempts = 3, delay = 1000) {
            for (let i = 0; i < maxAttempts; i++) {
                try {
                    return await fn();
                } catch (error) {
                    if (i === maxAttempts - 1) throw error;
                    await this.sleep(delay * Math.pow(2, i)); // exponential backoff
                }
            }
        }

        // ========== ГЕНЕРАЦИЯ ID ==========

        // Генерация короткого ID
        shortId() {
            return Math.random().toString(36).substring(2, 9);
        }

        // Генерация UUID
        uuid() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }

        // ========== РАБОТА С URL ==========

        // Получить параметры URL
        getUrlParams() {
            const params = new URLSearchParams(window.location.search);
            const result = {};
            for (const [key, value] of params) {
                result[key] = value;
            }
            return result;
        }

        // Обновить URL без перезагрузки
        updateUrl(params, replace = false) {
            const url = new URL(window.location);
            Object.entries(params).forEach(([key, value]) => {
                if (value === null || value === undefined) {
                    url.searchParams.delete(key);
                } else {
                    url.searchParams.set(key, value);
                }
            });
            
            if (replace) {
                window.history.replaceState({}, '', url);
            } else {
                window.history.pushState({}, '', url);
            }
        }

        // ========== ОПРЕДЕЛЕНИЕ УСТРОЙСТВА ==========

        // Является ли устройство мобильным
        isMobile() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }

        // Является ли устройство iOS
        isIOS() {
            return /iPad|iPhone|iPod/.test(navigator.userAgent);
        }

        // Является ли устройством Android
        isAndroid() {
            return /Android/.test(navigator.userAgent);
        }

        // Определение браузера
        getBrowser() {
            const ua = navigator.userAgent;
            if (ua.includes('Chrome')) return 'Chrome';
            if (ua.includes('Firefox')) return 'Firefox';
            if (ua.includes('Safari')) return 'Safari';
            if (ua.includes('Edge')) return 'Edge';
            if (ua.includes('MSIE') || ua.includes('Trident/')) return 'Internet Explorer';
            return 'Unknown';
        }

        // ========== КЭШИРОВАНИЕ ==========

        // Кэширование результатов функций
        memoize(fn, keyGenerator = JSON.stringify) {
            return (...args) => {
                const key = keyGenerator(args);
                if (this.cache.has(key)) {
                    return this.cache.get(key);
                }
                const result = fn(...args);
                this.cache.set(key, result);
                return result;
            };
        }

        // Очистить кэш
        clearCache() {
            this.cache.clear();
        }

        // ========== ОБРАБОТКА ОШИБОК ==========

        // Безопасный JSON parse
        safeJsonParse(str, fallback = null) {
            try {
                return JSON.parse(str);
            } catch {
                return fallback;
            }
        }

        // Получить сообщение ошибки
        getErrorMessage(error) {
            if (typeof error === 'string') return error;
            if (error instanceof Error) return error.message;
            if (error && error.message) return error.message;
            return 'Неизвестная ошибка';
        }

        // ========== РАБОТА С КЛАВИАТУРОЙ ==========

        // Проверка, является ли нажатие клавишей Enter
        isEnterKey(event) {
            return event.key === 'Enter' || event.keyCode === 13;
        }

        // Проверка, является ли нажатие клавишей Escape
        isEscapeKey(event) {
            return event.key === 'Escape' || event.keyCode === 27;
        }

        // ========== ИНИЦИАЛИЗАЦИЯ ==========

        // Инициализация всех утилит
        init() {
            console.log('[Utils] Initialized');
        }
    };

    // Создаем глобальный экземпляр
    window.utils = new Utils();
    window.utils.init();

    // Добавляем полезные методы в прототипы
    if (!String.prototype.capitalize) {
        String.prototype.capitalize = function() {
            return this.charAt(0).toUpperCase() + this.slice(1).toLowerCase();
        };
    }

    if (!Array.prototype.last) {
        Array.prototype.last = function() {
            return this[this.length - 1];
        };
    }

    if (!Array.prototype.first) {
        Array.prototype.first = function() {
            return this[0];
        };
    }
})();
