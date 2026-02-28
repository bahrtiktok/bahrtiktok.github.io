// app.js - главный файл приложения, инициализация и навигация

(function() {
    'use strict';

    window.FlumApp = class FlumApp {
        constructor() {
            this.currentPage = 'feed';
            this.pages = new Map();
            this.components = new Map();
            this.isInitialized = false;
            
            // Ссылки на глобальные модули
            this.db = window.flumDb;
            this.auth = window.auth;
            this.utils = window.utils;
            
            console.log('[App] Creating instance');
        }

        // ========== ИНИЦИАЛИЗАЦИЯ ==========

        async init() {
            if (this.isInitialized) return;
            
            console.log('[App] Initializing...');

            try {
                // Ждем загрузки DOM
                if (document.readyState === 'loading') {
                    await new Promise(resolve => {
                        document.addEventListener('DOMContentLoaded', resolve);
                    });
                }

                // Рендерим базовую структуру
                this.renderApp();
                
                // Инициализируем компоненты
                this.initComponents();
                
                // Настраиваем обработчики
                this.setupEventListeners();
                
                // Загружаем начальную страницу
                await this.loadPage('feed');
                
                // Проверяем авторизацию
                this.checkAuth();

                this.isInitialized = true;
                console.log('[App] Initialized successfully');

            } catch (error) {
                console.error('[App] Initialization failed:', error);
                this.showError('Не удалось загрузить приложение');
            }
        }

        // Рендеринг базовой структуры приложения
        renderApp() {
            const app = document.getElementById('app');
            if (!app) {
                console.error('[App] #app element not found');
                return;
            }

            // Получаем шаблон
            const template = document.getElementById('app-template');
            if (!template) {
                console.error('[App] Template not found');
                return;
            }

            // Клонируем и вставляем шаблон
            const content = template.content.cloneNode(true);
            app.innerHTML = '';
            app.appendChild(content);

            // Рендерим модалки
            this.renderModals();
        }

        // Рендеринг модальных окон
        renderModals() {
            const app = document.getElementById('app');
            
            // Модалка комментариев
            const commentTemplate = document.getElementById('comment-modal-template');
            if (commentTemplate) {
                app.appendChild(commentTemplate.content.cloneNode(true));
            }

            // Модалка авторизации
            const authTemplate = document.getElementById('auth-modal-template');
            if (authTemplate) {
                app.appendChild(authTemplate.content.cloneNode(true));
            }
        }

        // Инициализация компонентов
        initComponents() {
            // Инициализируем компоненты страниц
            this.components.set('feed', new FeedComponent());
            this.components.set('profile', new ProfileComponent());
            this.components.set('upload', new UploadComponent());
            this.components.set('discover', new DiscoverComponent());
            this.components.set('inbox', new InboxComponent());
        }

        // ========== НАВИГАЦИЯ ==========

        // Загрузить страницу
        async loadPage(pageId, params = {}) {
            console.log(`[App] Loading page: ${pageId}`, params);

            // Скрываем текущую страницу
            if (this.currentPage) {
                const currentPageEl = document.getElementById(`page-${this.currentPage}`);
                if (currentPageEl) {
                    currentPageEl.classList.remove('active');
                }
            }

            // Показываем новую страницу
            const newPageEl = document.getElementById(`page-${pageId}`);
            if (!newPageEl) {
                console.error(`[App] Page not found: ${pageId}`);
                return;
            }

            newPageEl.classList.add('active');
            this.currentPage = pageId;

            // Обновляем активный пункт в навигации
            this.updateActiveNav(pageId);

            // Обновляем активный таб в шапке
            this.updateActiveTab(pageId);

            // Загружаем данные для страницы
            const component = this.components.get(pageId);
            if (component && typeof component.load === 'function') {
                try {
                    await component.load(params);
                } catch (error) {
                    console.error(`[App] Failed to load component ${pageId}:`, error);
                }
            }

            // Специальная обработка для разных страниц
            switch (pageId) {
                case 'profile':
                    this.loadProfile(params.userId);
                    break;
                case 'upload':
                    this.initUploadPage();
                    break;
            }

            // Обновляем URL
            this.updateUrl(pageId, params);
        }

        // Обновить URL
        updateUrl(pageId, params = {}) {
            const url = new URL(window.location);
            url.searchParams.set('page', pageId);
            
            Object.entries(params).forEach(([key, value]) => {
                if (value) {
                    url.searchParams.set(key, value);
                } else {
                    url.searchParams.delete(key);
                }
            });

            window.history.pushState({ page: pageId, params }, '', url);
        }

        // Обработка навигации по истории
        handleNavigation(event) {
            const params = Object.fromEntries(new URLSearchParams(window.location.search));
            const pageId = params.page || 'feed';
            delete params.page;
            
            this.loadPage(pageId, params);
        }

        // Обновить активный пункт в нижней навигации
        updateActiveNav(pageId) {
            document.querySelectorAll('.nav-item').forEach(item => {
                if (item.dataset.page === pageId) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
        }

        // Обновить активный таб в шапке
        updateActiveTab(pageId) {
            const tabMap = {
                'feed': 'home',
                'discover': 'friends'
            };

            const tabId = tabMap[pageId];
            if (!tabId) return;

            document.querySelectorAll('.tab').forEach(tab => {
                if (tab.dataset.tab === tabId) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });
        }

        // ========== ОБРАБОТЧИКИ СОБЫТИЙ ==========

        setupEventListeners() {
            // Навигация по клику
            document.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const page = item.dataset.page;
                    if (page) {
                        this.loadPage(page);
                    } else if (item.classList.contains('plus-button')) {
                        this.loadPage('upload');
                    }
                });
            });

            // Табы в шапке
            document.querySelectorAll('.tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    const tabId = tab.dataset.tab;
                    if (tabId === 'home') {
                        this.loadPage('feed');
                    } else if (tabId === 'friends') {
                        this.loadPage('discover');
                    }
                });
            });

            // Кнопка поиска
            const searchBtn = document.getElementById('searchBtn');
            if (searchBtn) {
                searchBtn.addEventListener('click', () => {
                    this.showSearch();
                });
            }

            // Кнопка уведомлений
            const notificationsBtn = document.getElementById('notificationsBtn');
            if (notificationsBtn) {
                notificationsBtn.addEventListener('click', () => {
                    this.loadPage('inbox');
                });
            }

            // Кнопка профиля в навигации
            const navProfile = document.getElementById('navProfile');
            if (navProfile) {
                navProfile.addEventListener('click', () => {
                    if (this.auth.isAuthenticated) {
                        this.loadPage('profile', { userId: this.auth.getUserId() });
                    } else {
                        this.auth.showAuthModal();
                    }
                });
            }

            // Обработка истории браузера
            window.addEventListener('popstate', (e) => {
                this.handleNavigation(e);
            });

            // Глобальные обработчики клавиш
            document.addEventListener('keydown', (e) => {
                // Escape закрывает модалки
                if (this.utils.isEscapeKey(e)) {
                    this.closeAllModals();
                }
            });
        }

        // ========== ЗАГРУЗКА СТРАНИЦ ==========

        // Загрузить профиль
        async loadProfile(userId) {
            const targetUserId = userId || this.auth.getUserId();
            
            if (!targetUserId) {
                // Если не авторизован, показываем модалку входа
                this.auth.showAuthModal();
                return;
            }

            const component = this.components.get('profile');
            if (component) {
                await component.load({ userId: targetUserId });
            }
        }

        // Инициализация страницы загрузки
        initUploadPage() {
            if (!this.auth.isAuthenticated) {
                this.auth.showAuthModal().then(() => {
                    this.loadPage('upload');
                }).catch(() => {
                    this.loadPage('feed');
                });
                return;
            }

            const component = this.components.get('upload');
            if (component) {
                component.init();
            }
        }

        // Показать поиск
        showSearch() {
            // Можно реализовать модалку поиска или отдельную страницу
            console.log('[App] Search clicked');
        }

        // ========== АВТОРИЗАЦИЯ ==========

        checkAuth() {
            if (this.auth.isAuthenticated) {
                console.log('[App] User is authenticated:', this.auth.getUsername());
                this.updateUIForAuth();
            } else {
                console.log('[App] User is not authenticated');
            }
        }

        updateUIForAuth() {
            // Обновляем UI после авторизации
            const user = this.auth.getUser();
            if (user) {
                // Можно обновить аватар в шапке и т.д.
            }
        }

        // ========== УПРАВЛЕНИЕ МОДАЛКАМИ ==========

        closeAllModals() {
            document.querySelectorAll('.modal.show').forEach(modal => {
                modal.classList.remove('show');
            });
        }

        // ========== ОБРАБОТКА ОШИБОК ==========

        showError(message) {
            // Показываем уведомление об ошибке
            console.error('[App] Error:', message);
            
            // Можно создать простое уведомление
            const notification = this.utils.createElement('div', {
                className: 'upload-notification error show',
                style: {
                    position: 'fixed',
                    bottom: '20px',
                    left: '16px',
                    right: '16px',
                    zIndex: '9999'
                }
            }, [
                this.utils.createElement('div', { className: 'upload-notification-content' }, [
                    this.utils.createElement('i', { className: 'fas fa-exclamation-circle upload-notification-icon' }),
                    this.utils.createElement('span', { className: 'upload-notification-text' }, message),
                    this.utils.createElement('i', { 
                        className: 'fas fa-times upload-notification-close',
                        onclick: () => notification.remove()
                    })
                ])
            ]);

            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 5000);
        }

        showSuccess(message) {
            const notification = this.utils.createElement('div', {
                className: 'upload-notification success show',
                style: {
                    position: 'fixed',
                    bottom: '20px',
                    left: '16px',
                    right: '16px',
                    zIndex: '9999'
                }
            }, [
                this.utils.createElement('div', { className: 'upload-notification-content' }, [
                    this.utils.createElement('i', { className: 'fas fa-check-circle upload-notification-icon' }),
                    this.utils.createElement('span', { className: 'upload-notification-text' }, message),
                    this.utils.createElement('i', { 
                        className: 'fas fa-times upload-notification-close',
                        onclick: () => notification.remove()
                    })
                ])
            ]);

            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
    };

    // ========== БАЗОВЫЙ КОМПОНЕНТ ==========

    window.BaseComponent = class BaseComponent {
        constructor(name) {
            this.name = name;
            this.element = null;
            this.isLoaded = false;
        }

        async load(params = {}) {
            console.log(`[${this.name}] Loading with params:`, params);
            this.isLoaded = true;
        }

        unload() {
            console.log(`[${this.name}] Unloading`);
            this.isLoaded = false;
        }

        show() {
            if (this.element) {
                this.element.classList.remove('hidden');
            }
        }

        hide() {
            if (this.element) {
                this.element.classList.add('hidden');
            }
        }
    };

    // ========== КОМПОНЕНТЫ СТРАНИЦ ==========

    window.FeedComponent = class FeedComponent extends BaseComponent {
        constructor() {
            super('Feed');
            this.videos = [];
            this.observer = null;
        }

        async load(params = {}) {
            await super.load(params);
            
            const container = document.getElementById('feedContainer');
            if (!container) return;

            // Загружаем видео из Firebase
            this.videos = await window.flumDb.getVideos(10);
            
            // Рендерим ленту
            this.render(container);
        }

        render(container) {
            window.utils.emptyElement(container);
            
            this.videos.forEach(video => {
                // Будет реализовано в feed.js
                const card = document.createElement('div');
                card.className = 'video-card';
                card.dataset.videoId = video.id;
                container.appendChild(card);
            });
        }
    };

    window.ProfileComponent = class ProfileComponent extends BaseComponent {
        constructor() {
            super('Profile');
        }

        async load(params = {}) {
            await super.load(params);
            console.log('[Profile] Loading profile for:', params.userId);
            // Будет реализовано в profile.js
        }
    };

    window.UploadComponent = class UploadComponent extends BaseComponent {
        constructor() {
            super('Upload');
        }

        async load(params = {}) {
            await super.load(params);
            console.log('[Upload] Loading upload page');
        }

        init() {
            console.log('[Upload] Initializing upload page');
            // Будет реализовано в upload.js
        }
    };

    window.DiscoverComponent = class DiscoverComponent extends BaseComponent {
        constructor() {
            super('Discover');
        }

        async load(params = {}) {
            await super.load(params);
            console.log('[Discover] Loading discover page');
        }
    };

    window.InboxComponent = class InboxComponent extends BaseComponent {
        constructor() {
            super('Inbox');
        }

        async load(params = {}) {
            await super.load(params);
            console.log('[Inbox] Loading inbox page');
        }
    };

    // ========== ЗАПУСК ==========

    // Создаем и запускаем приложение
    window.app = new FlumApp();

    // Автоматический запуск
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.app.init();
        });
    } else {
        window.app.init();
    }

    console.log('[App] Script loaded');
})();
