// yet-integration.js - работа с Yet.js для загрузки файлов

(function() {
    'use strict';

    // Проверяем наличие yet.js (расширение Turbowarp)
    if (typeof Scratch === 'undefined' || !Scratch.extensions.unsandboxed) {
        console.warn('Yet.js extension not detected. Upload functionality will use fallback.');
    }

    window.YetUploader = class YetUploader {
        constructor() {
            this.yyfUrl = window.FLUM_CONFIG.yyfUrl || 'https://yyf.mubilop.com';
            this.uploadStatus = 'idle'; // idle, uploading, success, error
            this.lastUploadResult = null;
            this.uploadProgress = 0;
            
            // Проверяем доступность yet.js
            this.yetAvailable = typeof Scratch !== 'undefined' && 
                               Scratch.extensions && 
                               Scratch.extensions.unsandboxed;
            
            if (this.yetAvailable) {
                console.log('[YetUploader] Yet.js extension detected!');
                // Пытаемся получить экземпляр расширения если он уже зарегистрирован
                this.initYetExtension();
            } else {
                console.warn('[YetUploader] Yet.js not available, using fetch fallback');
            }
        }

        // Инициализация yet.js расширения
        initYetExtension() {
            // Yet.js регистрирует расширение в Scratch.extensions
            // Но мы можем создать свой экземпляр если нужно
            try {
                // Пробуем найти уже зарегистрированное расширение
                const extensions = Scratch.extensions;
                for (let key in extensions) {
                    if (key.toLowerCase().includes('yet') || key.toLowerCase().includes('yeet')) {
                        this.yetExtension = extensions[key];
                        console.log('[YetUploader] Found yet extension:', key);
                        break;
                    }
                }
            } catch (e) {
                console.warn('[YetUploader] Could not initialize yet extension:', e);
            }
        }

        // ========== ОСНОВНЫЕ МЕТОДЫ ЗАГРУЗКИ ==========

        // Загрузить файл через yet.js
        async uploadFile(file, fileName = null) {
            if (!file) {
                throw new Error('No file provided');
            }

            const name = fileName || (file.name || 'file.bin');
            
            this.uploadStatus = 'uploading';
            this.uploadProgress = 0;
            this.lastUploadResult = null;

            try {
                let result;

                if (this.yetAvailable && this.yetExtension) {
                    // Используем yet.js если доступен
                    result = await this.uploadWithYet(file, name);
                } else {
                    // Фолбэк: используем прямой fetch
                    result = await this.uploadWithFetch(file, name);
                }

                this.uploadStatus = 'success';
                this.uploadProgress = 100;
                this.lastUploadResult = result;
                
                console.log('[YetUploader] Upload successful:', result);
                return result;

            } catch (error) {
                this.uploadStatus = 'error';
                console.error('[YetUploader] Upload failed:', error);
                throw error;
            }
        }

        // Загрузка через yet.js
        async uploadWithYet(file, fileName) {
            return new Promise((resolve, reject) => {
                try {
                    // Преобразуем файл в нужный формат
                    const reader = new FileReader();
                    
                    reader.onload = async (e) => {
                        try {
                            const base64Data = e.target.result.split(',')[1] || e.target.result;
                            
                            // Используем API yet.js
                            // В yet.js есть блоки: uploadFile, uploadFileFromUrl, openFileDialog
                            // Но нам нужно вызвать их программно
                            
                            // Пытаемся использовать метод uploadFile если он доступен
                            if (this.yetExtension && this.yetExtension.uploadFile) {
                                const result = await this.yetExtension.uploadFile({
                                    DATA: base64Data,
                                    NAME: fileName
                                });
                                resolve(this.parseYetResult(result));
                            } 
                            // Пробуем через YeetYourFiles если оно зарегистрировано
                            else if (window.YeetYourFiles) {
                                const yet = new window.YeetYourFiles();
                                await yet.uploadFile({
                                    DATA: base64Data,
                                    NAME: fileName
                                });
                                resolve({
                                    fileId: yet.getLastFileId(),
                                    fileUrl: yet.getLastFileUrl(),
                                    shortHash: yet.getLastShortHash(),
                                    fullData: JSON.parse(yet.getLastFullData() || '{}')
                                });
                            }
                            else {
                                // Если нет прямого доступа, используем fetch
                                resolve(await this.uploadWithFetch(file, fileName));
                            }
                        } catch (err) {
                            reject(err);
                        }
                    };

                    reader.onerror = () => reject(new Error('Failed to read file'));
                    
                    // Читаем как DataURL для base64
                    reader.readAsDataURL(file);

                } catch (error) {
                    reject(error);
                }
            });
        }

        // Загрузка через прямой fetch (фолбэк)
        async uploadWithFetch(file, fileName) {
            const formData = new FormData();
            formData.append('file', file, fileName);

            // Симулируем прогресс
            const progressInterval = setInterval(() => {
                if (this.uploadProgress < 90) {
                    this.uploadProgress += 10;
                }
            }, 200);

            try {
                const response = await fetch(`${this.yyfUrl}/api/upload`, {
                    method: 'POST',
                    body: formData
                });

                clearInterval(progressInterval);

                if (!response.ok) {
                    throw new Error(`Upload failed: ${response.status}`);
                }

                const result = await response.json();
                this.uploadProgress = 100;
                
                return {
                    fileId: result.fileId,
                    fileUrl: result.fileUrl,
                    shortHash: result.shortHash,
                    fullData: result
                };

            } catch (error) {
                clearInterval(progressInterval);
                throw error;
            }
        }

        // Загрузить видео по URL
        async uploadFromUrl(url) {
            if (!url) throw new Error('No URL provided');

            this.uploadStatus = 'uploading';
            this.uploadProgress = 0;

            try {
                // Сначала скачиваем файл по URL
                const response = await fetch(url);
                if (!response.ok) throw new Error('Failed to fetch URL');
                
                const blob = await response.blob();
                const fileName = url.split('/').pop() || 'downloaded-file';
                
                // Затем загружаем через стандартный метод
                const result = await this.uploadFile(blob, fileName);
                
                return result;

            } catch (error) {
                this.uploadStatus = 'error';
                throw error;
            }
        }

        // ========== РАБОТА С ФАЙЛАМИ ==========

        // Открыть диалог выбора файла
        openFilePicker(options = {}) {
            return new Promise((resolve, reject) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = options.accept || '*/*';
                input.multiple = options.multiple || false;
                
                input.onchange = (event) => {
                    const files = Array.from(event.target.files);
                    if (files.length === 0) {
                        reject(new Error('No file selected'));
                        return;
                    }
                    
                    if (options.multiple) {
                        resolve(files);
                    } else {
                        resolve(files[0]);
                    }
                };
                
                input.onerror = () => reject(new Error('File picker error'));
                
                input.click();
            });
        }

        // Открыть диалог и сразу загрузить
        async pickAndUpload(options = {}) {
            try {
                const file = await this.openFilePicker({
                    accept: options.accept || 'video/*,image/*',
                    multiple: false
                });
                
                return await this.uploadFile(file);
                
            } catch (error) {
                console.error('[YetUploader] Pick and upload failed:', error);
                throw error;
            }
        }

        // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

        // Парсинг результата от yet.js
        parseYetResult(result) {
            // yet.js может возвращать разные форматы
            if (typeof result === 'string') {
                try {
                    return JSON.parse(result);
                } catch {
                    return { fileUrl: result };
                }
            }
            
            return {
                fileId: result?.fileId || result?.id,
                fileUrl: result?.fileUrl || result?.url,
                shortHash: result?.shortHash || result?.hash,
                fullData: result
            };
        }

        // Получить URL для скачивания
        getDownloadUrl(shortHash) {
            return `${this.yyfUrl}/f/${shortHash}`;
        }

        // Получить прямую ссылку на файл
        getDirectUrl(fileUrl) {
            if (fileUrl.startsWith('http')) {
                return fileUrl;
            }
            return `${this.yyfUrl}${fileUrl}`;
        }

        // Конвертировать файл в base64
        fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
        }

        // Конвертировать base64 в Blob
        base64ToBlob(base64, mimeType = 'application/octet-stream') {
            const byteCharacters = atob(base64.split(',')[1] || base64);
            const byteArrays = [];
            
            for (let offset = 0; offset < byteCharacters.length; offset += 512) {
                const slice = byteCharacters.slice(offset, offset + 512);
                const byteNumbers = new Array(slice.length);
                
                for (let i = 0; i < slice.length; i++) {
                    byteNumbers[i] = slice.charCodeAt(i);
                }
                
                byteArrays.push(new Uint8Array(byteNumbers));
            }
            
            return new Blob(byteArrays, { type: mimeType });
        }

        // ========== СТАТУСЫ И СОСТОЯНИЯ ==========

        // Текущий статус загрузки
        getStatus() {
            return {
                status: this.uploadStatus,
                progress: this.uploadProgress,
                result: this.lastUploadResult,
                isUploading: this.uploadStatus === 'uploading',
                isSuccess: this.uploadStatus === 'success',
                isError: this.uploadStatus === 'error'
            };
        }

        // Сбросить состояние
        reset() {
            this.uploadStatus = 'idle';
            this.uploadProgress = 0;
            this.lastUploadResult = null;
        }

        // Проверить доступность yet.js
        isYetAvailable() {
            return this.yetAvailable;
        }
    };

    // ========== СПЕЦИАЛИЗИРОВАННЫЕ МЕТОДЫ ДЛЯ ТИК ТОКА ==========

    // Загрузчик для видео
    window.VideoUploader = class VideoUploader extends YetUploader {
        constructor() {
            super();
            this.supportedFormats = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
            this.maxSize = 500 * 1024 * 1024; // 500MB
            this.maxDuration = 180; // 3 минуты в секундах
        }

        // Валидация видео
        validateVideo(file) {
            // Проверка формата
            if (!this.supportedFormats.includes(file.type)) {
                throw new Error('Неподдерживаемый формат видео. Используйте MP4, MOV, WebM или MKV');
            }

            // Проверка размера
            if (file.size > this.maxSize) {
                throw new Error('Видео слишком большое. Максимальный размер 500MB');
            }

            return true;
        }

        // Получить длительность видео
        getVideoDuration(file) {
            return new Promise((resolve, reject) => {
                const video = document.createElement('video');
                video.preload = 'metadata';
                
                video.onloadedmetadata = () => {
                    URL.revokeObjectURL(video.src);
                    resolve(video.duration);
                };
                
                video.onerror = () => {
                    URL.revokeObjectURL(video.src);
                    reject(new Error('Failed to load video metadata'));
                };
                
                video.src = URL.createObjectURL(file);
            });
        }

        // Загрузить видео с валидацией
        async uploadVideo(file, caption = '', music = 'оригинальный звук') {
            try {
                // Валидация
                this.validateVideo(file);
                
                // Получаем длительность
                const duration = await this.getVideoDuration(file);
                if (duration > this.maxDuration) {
                    throw new Error(`Видео слишком длинное. Максимум ${this.maxDuration} секунд`);
                }

                // Загружаем файл
                const uploadResult = await this.uploadFile(file, file.name);
                
                // Возвращаем полные данные для сохранения в Firebase
                return {
                    ...uploadResult,
                    duration: Math.round(duration),
                    caption: caption,
                    music: music,
                    originalName: file.name,
                    size: file.size,
                    type: file.type
                };

            } catch (error) {
                console.error('[VideoUploader] Upload failed:', error);
                throw error;
            }
        }
    };

    // Загрузчик для изображений (аватарки)
    window.ImageUploader = class ImageUploader extends YetUploader {
        constructor() {
            super();
            this.supportedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            this.maxSize = 10 * 1024 * 1024; // 10MB
            this.maxDimensions = { width: 1024, height: 1024 };
        }

        // Валидация изображения
        validateImage(file) {
            if (!this.supportedFormats.includes(file.type)) {
                throw new Error('Неподдерживаемый формат изображения. Используйте JPEG, PNG, WebP или GIF');
            }

            if (file.size > this.maxSize) {
                throw new Error('Изображение слишком большое. Максимальный размер 10MB');
            }

            return true;
        }

        // Получить размеры изображения
        getImageDimensions(file) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                
                img.onload = () => {
                    URL.revokeObjectURL(img.src);
                    resolve({
                        width: img.width,
                        height: img.height
                    });
                };
                
                img.onerror = () => {
                    URL.revokeObjectURL(img.src);
                    reject(new Error('Failed to load image'));
                };
                
                img.src = URL.createObjectURL(file);
            });
        }

        // Загрузить изображение
        async uploadImage(file) {
            try {
                this.validateImage(file);
                
                // Опционально: ресайзим изображение если слишком большое
                const dimensions = await this.getImageDimensions(file);
                
                const uploadResult = await this.uploadFile(file, file.name);
                
                return {
                    ...uploadResult,
                    width: dimensions.width,
                    height: dimensions.height,
                    size: file.size,
                    type: file.type
                };

            } catch (error) {
                console.error('[ImageUploader] Upload failed:', error);
                throw error;
            }
        }
    };

    // Создаем глобальные экземпляры
    window.yetUploader = new YetUploader();
    window.videoUploader = new VideoUploader();
    window.imageUploader = new ImageUploader();

    console.log('[YetUploader] Initialized');
})();
