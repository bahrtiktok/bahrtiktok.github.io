// comments.js - система комментариев

(function() {
    'use strict';

    window.Comments = class Comments {
        constructor() {
            this.currentVideoId = null;
            this.comments = [];
            this.isLoading = false;
            this.modal = null;
            this.observer = null;
            this.hasMore = true;
            this.lastCommentId = null;
        }

        // ========== ОТКРЫТИЕ МОДАЛКИ ==========

        async openForVideo(videoId) {
            this.currentVideoId = videoId;

            // Создаем или получаем модалку
            if (!this.modal) {
                this.createModal();
            }

            // Показываем модалку
            this.modal.classList.add('show');
            document.body.classList.add('modal-open');

            // Загружаем комментарии
            await this.loadComments(videoId);

            // Настраиваем бесконечную прокрутку
            this.setupInfiniteScroll();
        }

        createModal() {
            const template = document.getElementById('comment-modal-template');
            if (!template) {
                console.error('[Comments] Template not found');
                return;
            }

            this.modal = template.content.cloneNode(true).firstElementChild;
            document.body.appendChild(this.modal);

            // Обработчики закрытия
            const closeBtn = this.modal.querySelector('#closeComments');
            closeBtn.addEventListener('click', () => this.close());

            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.close();
                }
            });

            // Обработчик отправки комментария
            const sendBtn = this.modal.querySelector('#sendComment');
            const input = this.modal.querySelector('#commentInput');

            sendBtn.addEventListener('click', () => this.addComment());
            
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.addComment();
                }
            });

            // Сохраняем ссылки на элементы
            this.commentList = this.modal.querySelector('#commentList');
            this.commentInput = input;
            this.commentCountSpan = this.modal.querySelector('#commentCountSpan');
        }

        // ========== ЗАГРУЗКА КОММЕНТАРИЕВ ==========

        async loadComments(videoId, loadMore = false) {
            if (this.isLoading || (!loadMore && this.comments.length > 0)) return;

            this.isLoading = true;

            try {
                let newComments;
                
                if (loadMore) {
                    // Загружаем следующие комментарии (пагинация)
                    newComments = await window.flumDb.getComments(videoId);
                    // В реальном API нужно добавить пагинацию
                } else {
                    newComments = await window.flumDb.getComments(videoId);
                }

                if (loadMore) {
                    this.comments = [...this.comments, ...newComments];
                } else {
                    this.comments = newComments;
                }

                this.renderComments();

                // Обновляем счетчик
                if (this.commentCountSpan) {
                    this.commentCountSpan.textContent = this.comments.length;
                }

            } catch (error) {
                console.error('[Comments] Failed to load:', error);
                this.showError('Не удалось загрузить комментарии');
            } finally {
                this.isLoading = false;
            }
        }

        // ========== РЕНДЕРИНГ ==========

        renderComments() {
            if (!this.commentList) return;

            if (this.comments.length === 0) {
                this.commentList.innerHTML = `
                    <div class="comment-empty">
                        <i class="fa-regular fa-comment-dots"></i>
                        <p>Пока нет комментариев</p>
                        <small>Будьте первым, кто оставит комментарий!</small>
                    </div>
                `;
                return;
            }

            // Очищаем список перед рендерингом (если не подгрузка)
            if (!this.isLoading) {
                this.commentList.innerHTML = '';
            }

            this.comments.forEach(comment => {
                const commentEl = this.createCommentElement(comment);
                this.commentList.appendChild(commentEl);
            });
        }

        createCommentElement(comment) {
            const div = document.createElement('div');
            div.className = 'comment-item';
            div.dataset.commentId = comment.id;

            // Загружаем информацию о пользователе
            window.flumDb.getUserById(comment.userId).then(user => {
                if (user) {
                    this.updateCommentUser(div, user);
                }
            });

            const timeAgo = window.utils.formatTimeAgo(comment.createdAt);

            div.innerHTML = `
                <img class="comment-avatar" src="https://i.pravatar.cc/150?u=${comment.userId}" alt="avatar" loading="lazy">
                <div class="comment-content">
                    <div class="comment-header-row">
                        <span class="comment-name">@user_${comment.userId.substring(0, 5)}</span>
                        <span class="comment-time">${timeAgo}</span>
                    </div>
                    <div class="comment-text">${this.escapeHtml(comment.text)}</div>
                    <div class="comment-actions">
                        <span class="comment-action like-comment" data-action="like">
                            <i class="fa-regular fa-heart"></i>
                            <span class="like-count">${comment.likes || 0}</span>
                        </span>
                        <span class="comment-action reply-comment" data-action="reply">
                            <i class="fa-regular fa-reply"></i> Ответить
                        </span>
                        ${window.auth.isAuthenticated && window.auth.getUserId() === comment.userId ? `
                            <span class="comment-action delete-comment" data-action="delete">
                                <i class="fa-regular fa-trash-can"></i> Удалить
                            </span>
                        ` : ''}
                    </div>
                </div>
            `;

            // Добавляем обработчики
            this.attachCommentHandlers(div, comment);

            return div;
        }

        updateCommentUser(commentEl, user) {
            const avatar = commentEl.querySelector('.comment-avatar');
            const name = commentEl.querySelector('.comment-name');

            if (avatar) avatar.src = user.avatar;
            if (name) name.textContent = `@${user.username}`;
        }

        attachCommentHandlers(commentEl, comment) {
            // Лайк комментария
            const likeBtn = commentEl.querySelector('[data-action="like"]');
            if (likeBtn) {
                likeBtn.addEventListener('click', () => this.likeComment(comment));
            }

            // Ответ на комментарий
            const replyBtn = commentEl.querySelector('[data-action="reply"]');
            if (replyBtn) {
                replyBtn.addEventListener('click', () => this.replyToComment(comment));
            }

            // Удаление комментария
            const deleteBtn = commentEl.querySelector('[data-action="delete"]');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.deleteComment(comment));
            }
        }

        // ========== ДЕЙСТВИЯ С КОММЕНТАРИЯМИ ==========

        async addComment() {
            const text = this.commentInput.value.trim();
            
            if (!text) return;
            if (!window.auth.isAuthenticated) {
                const user = await window.auth.showAuthModal();
                if (!user) return;
            }

            try {
                // Добавляем комментарий в Firebase
                const newComment = await window.flumDb.addComment(
                    window.auth.getUserId(),
                    this.currentVideoId,
                    text
                );

                // Добавляем в начало списка
                this.comments.unshift(newComment);
                
                // Перерендериваем
                this.renderComments();
                
                // Очищаем поле ввода
                this.commentInput.value = '';

                // Обновляем счетчик в видео
                this.updateVideoCommentCount(1);

            } catch (error) {
                console.error('[Comments] Failed to add comment:', error);
                window.app.showError('Не удалось добавить комментарий');
            }
        }

        async likeComment(comment) {
            if (!window.auth.isAuthenticated) {
                const user = await window.auth.showAuthModal();
                if (!user) return;
            }

            try {
                // TODO: добавить лайки комментариев в Firebase
                comment.likes = (comment.likes || 0) + 1;
                
                // Обновляем UI
                const commentEl = document.querySelector(`.comment-item[data-comment-id="${comment.id}"]`);
                if (commentEl) {
                    const likeCount = commentEl.querySelector('.like-count');
                    if (likeCount) {
                        likeCount.textContent = comment.likes;
                    }
                    
                    const likeIcon = commentEl.querySelector('[data-action="like"] i');
                    if (likeIcon) {
                        likeIcon.classList.remove('fa-regular');
                        likeIcon.classList.add('fa-solid', 'liked');
                    }
                }

            } catch (error) {
                console.error('[Comments] Like failed:', error);
            }
        }

        replyToComment(comment) {
            this.commentInput.value = `@${comment.username || 'user'} `;
            this.commentInput.focus();
        }

        async deleteComment(comment) {
            if (!confirm('Удалить комментарий?')) return;

            try {
                await window.flumDb.deleteComment(this.currentVideoId, comment.id);
                
                // Удаляем из списка
                this.comments = this.comments.filter(c => c.id !== comment.id);
                
                // Перерендериваем
                this.renderComments();
                
                // Обновляем счетчик в видео
                this.updateVideoCommentCount(-1);

            } catch (error) {
                console.error('[Comments] Delete failed:', error);
                window.app.showError('Не удалось удалить комментарий');
            }
        }

        // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

        async updateVideoCommentCount(delta) {
            try {
                const video = await window.flumDb.getVideoById(this.currentVideoId);
                if (video) {
                    video.comments = (video.comments || 0) + delta;
                    // TODO: обновить в Firebase
                }
            } catch (error) {
                console.error('[Comments] Failed to update video count:', error);
            }
        }

        setupInfiniteScroll() {
            if (!this.commentList) return;

            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && this.hasMore && !this.isLoading) {
                        this.loadComments(this.currentVideoId, true);
                    }
                });
            }, { root: this.commentList, threshold: 0.1 });

            // Наблюдаем за последним комментарием
            const lastComment = this.commentList.lastElementChild;
            if (lastComment) {
                this.observer.observe(lastComment);
            }
        }

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        showError(message) {
            if (!this.commentList) return;

            this.commentList.innerHTML = `
                <div class="comment-empty">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <p>${message}</p>
                    <button class="comment-send" onclick="window.comments.loadComments('${this.currentVideoId}')">
                        Попробовать снова
                    </button>
                </div>
            `;
        }

        // ========== ЗАКРЫТИЕ ==========

        close() {
            if (this.modal) {
                this.modal.classList.remove('show');
                document.body.classList.remove('modal-open');
                
                // Очищаем данные
                setTimeout(() => {
                    this.currentVideoId = null;
                    this.comments = [];
                    if (this.observer) {
                        this.observer.disconnect();
                        this.observer = null;
                    }
                }, 300);
            }
        }
    };

    // Создаем глобальный экземпляр
    window.comments = new Comments();

    console.log('[Comments] System loaded');
})();
