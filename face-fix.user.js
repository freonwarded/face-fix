// ==UserScript==
// @name         FACE FIX
// @namespace    http://tampermonkey.net/
// @version      4.1.8
// @description  Улучшение интерфейса для работы с FACE
// @author       TOSHA tg: tosha_blyat
// @match        https://dte-bo.pmruservice.com/*
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/freonwarded/face-fix/main/face-fix.user.js
// @downloadURL  https://raw.githubusercontent.com/freonwarded/face-fix/main/face-fix.user.js
// ==/UserScript==

(function() {
    'use strict';

    // =========================================================================
    //                               КОНСТАНТЫ
    // =========================================================================

    const reasonMaps = {
        NPL: {
            '4': 'А/NPL: Неверная марка',
            '5': 'А/NPL: Количество пачек не соответствует заданию',
            '6': 'А/NPL: Невозможно рассмотреть марку',
            '7': 'А/NPL: Некачественное фото',
            '8': 'А/NPL: Вскрыта упаковка',
            '9': 'Недобросовестное фото',
            '0': 'Фото с экрана'
        },
        A: {
            '4': 'А/NPL: Неверная марка',
            '5': 'А/NPL: Количество пачек не соответствует заданию',
            '6': 'А/NPL: Невозможно рассмотреть марку',
            '7': 'А/NPL: Вскрытая упаковка',
            '8': 'A: Синие пачки FIIT',
            '9': 'А/NPL: Недобросовестное фото',
            '0': 'А/NPL: Фото с экрана'
        },
        'В': {
            '4': 'В: Пустые слоты',
            '5': 'В: Марка конкурента',
            '6': 'Оборудование видно не полностью',
            '7': 'В: Проморяд не совпадает с эталонным фото',
            '8': 'В: Отсутствуют марки из обязательного ассортимента',
            '9': 'Недобросовестное фото',
            '0': 'Фото с экрана'
        },
        MS: {
            '4': 'MS: Отсутствует тэйблтокер',
            '5': 'MS: Шкаф открыт',
            '6': 'MS: Нет возможности определить место продажи',
            '7': 'MS: Отсутствует прилавок IQOS',
            '8': 'MS: Оборудование закрыто посторонним предметом',
            '9': 'Недобросовестное фото',
            '0': 'Фото с экрана'
        }
    };

    const reasonHints = {
        NPL: [
            '4 - Неверная марка',
            '5 - Количество пачек не соответствует',
            '6 - Невозможно рассмотреть марку',
            '7 - Некачественное фото',
            '8 - Вскрытая упаковка',
            '9 - Недобросовестное фото',
            '0 - Фото с экрана'
        ],
        A: [
            '4 - Неверная марка',
            '5 - Количество пачек не соответствует',
            '6 - Невозможно рассмотреть марку',
            '7 - Вскрытая упаковка',
            '8 - Синие пачки FIIT',
            '9 - Недобросовестное фото',
            '0 - Фото с экрана'
        ],
        'В': [
            '4 - Пустые слоты',
            '5 - Марка конкурента',
            '6 - Оборудование видно не полностью',
            '7 - Проморяд не совпадает с эталонным фото',
            '8 - Отсутствуют марки из обязательного ассортимента',
            '9 - Недобросовестное фото',
            '0 - Фото с экрана'
        ],
        MS: [
            '4 - Отсутствует тэйблтокер',
            '5 - Шкаф открыт',
            '6 - Нет возможности определить место продажи',
            '7 - Отсутствует прилавок IQOS',
            '8 - Оборудование закрыто посторонним предметом',
            '9 - Недобросовестное фото',
            '0 - Фото с экрана'
        ]
    };

    // Конфигурация для кнопки "Обращение"
    const appealConfig = {
        NPL: {
            mappingUrl: 'https://raw.githubusercontent.com/freonwarded/face-fix/refs/heads/main/npl.txt',
            messageTemplate: (performer, reason, taskSuffix) => 
                `${performer}, выполненная вами фотозадача по Дополнительному фотозаданию: ${taskSuffix} на платформе К!Успеху была отклонена по причине ошибки: ${reason}. Доступно повторное выполнение. Чтобы переделать задание, пройдите в папку «Доступные задания». В случае возникновения вопросов свяжитесь с Центром Поддержки по телефону 8 800 600 80 75 (круглосуточно, звонок бесплатный).`
        },
        В: {
            mappingUrl: 'https://raw.githubusercontent.com/freonwarded/face-fix/refs/heads/main/v',
            messageTemplate: (performer, reason) => 
                `${performer}, выполненная вами фотозадача по Витрине на платформе К!Успеху была отклонена по причине ошибки: ${reason}. Доступно повторное выполнение. Чтобы переделать задание, пройдите в папку «Доступные задания». В случае возникновения вопросов свяжитесь с Центром Поддержки по телефону 8 800 600 80 75 (круглосуточно, звонок бесплатный).`
        }
    };

    let currentPhotoTaskType = 'unknown';
    let processedUrls = new Set();
    let taskInfoProcessed = false;
    let msImagesProcessed = false;
    let msHiddenContainers = new WeakSet();

    // =========================================================================
    //                      СЧЁТЧИК ФОТОЗАДАНИЙ (ПОЛНАЯ ВЕРСИЯ)
    // =========================================================================

    (function initPhotoTaskCounter() {
        const LS_KEY = 'faceFixPhotoTaskCounters';
        const LAST_TYPE_KEY = 'faceFixLastCheckedType';

        function getInitialCounters() {
            let counters = null;
            try {
                counters = JSON.parse(localStorage.getItem(LS_KEY));
            } catch (e) {}
            if (!counters || typeof counters !== 'object') {
                counters = { 'A': 0, 'MS': 0, 'V': 0, 'NPL': 0, 'ИТОГ': 0 };
            }
            return counters;
        }

        window.photoTaskCounters = getInitialCounters();

        function saveCounters() {
            localStorage.setItem(LS_KEY, JSON.stringify(window.photoTaskCounters));
        }

        function incrementCounter() {
            let lastType = localStorage.getItem(LAST_TYPE_KEY);
            if (lastType === 'В') lastType = 'V';
            if (lastType && window.photoTaskCounters && window.photoTaskCounters[lastType] !== undefined) {
                window.photoTaskCounters[lastType]++;
                window.photoTaskCounters['ИТОГ']++;
                localStorage.removeItem(LAST_TYPE_KEY);
                saveCounters();
                if (window.updatePhotoTaskCounterDisplay) {
                    window.updatePhotoTaskCounterDisplay();
                }
                return true;
            }
            return false;
        }

        function updateCounterDisplay() {
            let badge = document.querySelector('.script-active-indicator');
            if (!badge) {
                showScriptActive();
                badge = document.querySelector('.script-active-indicator');
                if (!badge) return;
            }

            let c = window.photoTaskCounters;
            const newText = `A: ${c['A']} | MS: ${c['MS']} | V: ${c['V']} | NPL: ${c['NPL']} | ИТОГ: ${c['ИТОГ']}`;

            const oldCounter = document.querySelector('.face-fix-photo-counter');
            const oldReset = document.querySelector('.face-fix-photo-reset');
            const oldTime = document.querySelector('.face-fix-photo-time');

            if (oldCounter && oldCounter.textContent === newText && oldTime) {
                return;
            }

            if (oldCounter) oldCounter.remove();
            if (oldReset) oldReset.remove();
            if (oldTime) oldTime.remove();

            const counter = document.createElement('span');
            counter.className = 'face-fix-photo-counter';
            counter.style.cssText = `
                margin-right: 8px;
                font-size: 15px;
                color: #333;
                background: #f5f5f5;
                border-radius: 6px;
                padding: 2px 10px;
                vertical-align: middle;
            `;
            counter.textContent = newText;

            const resetBtn = document.createElement('button');
            resetBtn.className = 'face-fix-photo-reset';
            resetBtn.textContent = '⟳';
            resetBtn.title = 'Сбросить счетчик';
            resetBtn.style.cssText = `
                margin-right: 8px;
                font-size: 15px;
                background: #eee;
                border: 1px solid #bbb;
                border-radius: 6px;
                padding: 2px 8px;
                cursor: pointer;
                vertical-align: middle;
                transition: background 0.2s;
            `;
            resetBtn.onmouseover = () => { resetBtn.style.background = '#ddd'; };
            resetBtn.onmouseout = () => { resetBtn.style.background = '#eee'; };
            resetBtn.onclick = () => {
                window.photoTaskCounters = {A:0, MS:0, V:0, NPL:0, ИТОГ:0};
                saveCounters();
                updateCounterDisplay();
            };

            badge.parentNode.insertBefore(resetBtn, badge);
            badge.parentNode.insertBefore(counter, badge);

            addTimeDisplay(counter);
        }

        function addTimeDisplay(counter) {
            const times = {A: 60, MS: 214, V: 285, NPL: 158};

            function formatTime(sec) {
                const h = Math.floor(sec/3600);
                const m = Math.floor((sec%3600)/60);
                const s = sec%60;
                if (h > 0) {
                    return h + ':' + (m<10?'0':'') + m + ':' + (s<10?'0':'') + s;
                } else {
                    return m + ':' + (s<10?'0':'') + s;
                }
            }

            const totalA = window.photoTaskCounters['A'] * times.A;
            const totalMS = window.photoTaskCounters['MS'] * times.MS;
            const totalV = window.photoTaskCounters['V'] * times.V;
            const totalNPL = window.photoTaskCounters['NPL'] * times.NPL;
            const total = totalA + totalMS + totalV + totalNPL;

            const timeText = `A: ${formatTime(totalA)} | MS: ${formatTime(totalMS)} | V: ${formatTime(totalV)} | NPL: ${formatTime(totalNPL)} | ИТОГ: ${formatTime(total)}`;

            const timeDiv = document.createElement('div');
            timeDiv.className = 'face-fix-photo-time';
            timeDiv.style.cssText = `
                font-size: 13px;
                color: #666;
                margin-top: 2px;
                margin-bottom: 2px;
                background: #f9f9f9;
                border-radius: 6px;
                padding: 2px 10px;
                display: inline-block;
            `;
            timeDiv.textContent = timeText;

            counter.parentNode.insertBefore(timeDiv, counter.nextSibling);
        }

        window.updatePhotoTaskCounterDisplay = updateCounterDisplay;
        window.incrementPhotoTaskCounter = incrementCounter;

        function observeConfirmButtonsForType() {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const buttons = node.querySelectorAll ? node.querySelectorAll('button') : [];
                            buttons.forEach(button => {
                                const buttonText = button.textContent.trim();
                                if (buttonText.includes('Подтвердить') ||
                                    buttonText.includes('Оценить') ||
                                    buttonText.includes('Принять')) {
                                    button.removeEventListener('click', handleConfirmClick);
                                    button.addEventListener('click', handleConfirmClick);
                                }
                            });
                        }
                    });
                });
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        function handleConfirmClick() {
            let type = window.faceFixCurrentTaskTypeForCounter;
            if (type === 'В') type = 'V';
            if (type && type !== 'unknown' && type !== 'undefined') {
                localStorage.setItem(LAST_TYPE_KEY, type);
            }
        }

        function observeSuccessEverywhere() {
            const notificationObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const successText = node.textContent || '';
                            if (isSuccessNotification(successText)) {
                                setTimeout(() => {
                                    incrementCounter();
                                }, 100);
                            }
                        }
                    });
                });
            });
            notificationObserver.observe(document.body, { childList: true, subtree: true });

            let lastUrl = window.location.href;
            const urlObserver = new MutationObserver(() => {
                const currentUrl = window.location.href;
                if (currentUrl !== lastUrl) {
                    if (localStorage.getItem(LAST_TYPE_KEY)) {
                        const wasProcessPage = lastUrl.includes('/process/');
                        const nowListPage = currentUrl.includes('/dte-tasks-checking') ||
                                          currentUrl.includes('/participant-report') ||
                                          currentUrl.includes('/pos-report');

                        if (wasProcessPage && nowListPage) {
                            setTimeout(() => {
                                incrementCounter();
                            }, 500);
                        }
                    }
                    lastUrl = currentUrl;
                }
            });
            urlObserver.observe(document, { subtree: true, childList: true });
        }

        function isSuccessNotification(text) {
            const successPatterns = [
                'успешно оценено', 'оценено успешно', 'успешно выполнено',
                'успешно сохранено', 'задание принято', 'принято',
                'success', 'Success', 'оценка завершена', 'завершено'
            ];
            return successPatterns.some(pattern => text.toLowerCase().includes(pattern.toLowerCase()));
        }

        function rememberPhotoTaskTypeForCounter() {
            function setType() {
                if (window.location.href.includes('/process/')) {
                    let type = getPhotoTaskTypeFromTemplate();
                    if (type === 'В') type = 'V';
                    if (type && type !== 'unknown' && type !== 'undefined') {
                        window.faceFixCurrentTaskTypeForCounter = type;
                    }
                }
            }
            setType();
            const observer = new MutationObserver(setType);
            observer.observe(document.body, { childList: true, subtree: true });
        }

        observeConfirmButtonsForType();
        observeSuccessEverywhere();
        rememberPhotoTaskTypeForCounter();
        updateCounterDisplay();

        setInterval(updateCounterDisplay, 2000);
    })();

    // =========================================================================
    //                    ОБРАБОТКА MS ИЗОБРАЖЕНИЙ (ПОЛНАЯ)
    // =========================================================================

    function processMSImages() {
        if (currentPhotoTaskType !== 'MS') return;

        setTimeout(() => {
            const allMSImages = document.querySelectorAll('img.mui-88yf90-image');

            if (allMSImages.length === 0) {
                return;
            }

            const existingContainer = document.querySelector('.ms-main-images-container');
            if (existingContainer) return;

            const msMainContainer = document.createElement('div');
            msMainContainer.className = 'ms-main-images-container';
            msMainContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 15px;
                margin: 20px 0;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 12px;
                border: 2px solid #e0e0e0;
                max-width: 100%;
            `;

            const header = document.createElement('div');
            header.textContent = 'Примеры для MS задания (Прикассовая зона)';
            header.style.cssText = `
                font-size: 16px;
                font-weight: bold;
                color: #333;
                text-align: center;
                margin-bottom: 10px;
                padding: 10px;
                background: #1976d2;
                color: white;
                border-radius: 8px;
            `;
            msMainContainer.appendChild(header);

            const thumbnailsContainer = document.createElement('div');
            thumbnailsContainer.className = 'ms-thumbnails-container';
            thumbnailsContainer.style.cssText = `
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
                justify-content: center;
                align-items: flex-start;
            `;
            msMainContainer.appendChild(thumbnailsContainer);

            allMSImages.forEach((img, index) => {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'ms-image-item';
                imgContainer.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    margin: 5px;
                    padding: 10px;
                    background: white;
                    border-radius: 8px;
                    border: 1px solid #ddd;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    transition: transform 0.2s ease;
                `;

                const caption = document.createElement('div');
                caption.textContent = `Пример ${index + 1}`;
                caption.style.cssText = `
                    font-size: 14px;
                    color: #333;
                    margin-bottom: 8px;
                    font-weight: bold;
                    text-align: center;
                `;

                const clonedImg = img.cloneNode(true);
                clonedImg.style.cssText = `
                    max-width: 250px;
                    max-height: 200px;
                    width: auto;
                    height: auto;
                    object-fit: contain;
                    border: 1px solid #ccc;
                    border-radius: 6px;
                    padding: 5px;
                    background: white;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: block;
                `;

                imgContainer.addEventListener('mouseenter', function() {
                    this.style.transform = 'translateY(-2px)';
                    this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                    clonedImg.style.borderColor = '#1976d2';
                });

                imgContainer.addEventListener('mouseleave', function() {
                    this.style.transform = 'translateY(0)';
                    this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    clonedImg.style.borderColor = '#ccc';
                });

                clonedImg.addEventListener('click', function() {
                    const fullSizeContainer = document.createElement('div');
                    fullSizeContainer.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,0.9);
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        z-index: 10000;
                        cursor: pointer;
                    `;

                    const fullSizeImg = img.cloneNode();
                    fullSizeImg.style.cssText = `
                        max-width: 95%;
                        max-height: 85%;
                        width: auto;
                        height: auto;
                        object-fit: contain;
                        border: 2px solid white;
                        border-radius: 8px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                    `;

                    const closeText = document.createElement('div');
                    closeText.textContent = 'Кликните чтобы закрыть';
                    closeText.style.cssText = `
                        color: white;
                        margin-top: 15px;
                        font-size: 16px;
                        text-align: center;
                    `;

                    fullSizeContainer.appendChild(fullSizeImg);
                    fullSizeContainer.appendChild(closeText);
                    document.body.appendChild(fullSizeContainer);

                    fullSizeContainer.addEventListener('click', function() {
                        document.body.removeChild(this);
                    });
                });

                imgContainer.appendChild(caption);
                imgContainer.appendChild(clonedImg);
                thumbnailsContainer.appendChild(imgContainer);
            });

            const taskInfo = document.querySelector('.mui-qspag7-ItemCard-content') ||
                           document.querySelector('.face-CompositeScreen') ||
                           document.querySelector('main');

            if (taskInfo) {
                taskInfo.parentNode.insertBefore(msMainContainer, taskInfo.nextSibling);
                msImagesProcessed = true;
            }

            hideMSContainers();
        }, 1000);
    }

    function hideMSContainers() {
        const allMSImages = document.querySelectorAll('img.mui-88yf90-image');

        allMSImages.forEach(img => {
            if (img.closest('.ms-main-images-container')) return;
            if (msHiddenContainers.has(img)) return;

            let parentContainer = img.parentElement;
            let foundSuitableContainer = false;

            while (parentContainer && parentContainer !== document.body) {
                const parentRect = parentContainer.getBoundingClientRect();
                const imgRect = img.getBoundingClientRect();

                const hasButtons = parentContainer.querySelector('button') !== null;
                const hasCardClass = parentContainer.classList.contains('MuiCard-root');
                const hasMediaWrapper = parentContainer.querySelector('.mui-1odqcqr-mediaWrapper') !== null;

                if (hasButtons || hasCardClass || hasMediaWrapper) {
                    parentContainer = parentContainer.parentElement;
                    continue;
                }

                if (parentRect.width >= imgRect.width * 0.9 &&
                    parentRect.width <= imgRect.width * 1.5 &&
                    parentRect.height >= imgRect.height * 0.9 &&
                    parentRect.height <= imgRect.height * 1.5) {

                    parentContainer.style.display = 'none';
                    msHiddenContainers.add(img);
                    foundSuitableContainer = true;
                    break;
                }

                parentContainer = parentContainer.parentElement;
            }

            if (!foundSuitableContainer) {
                const imgWrapper = img.closest('div[style*="width"], div[style*="height"], div[class*="image"], div[class*="Image"]');
                if (imgWrapper && !imgWrapper.querySelector('button') && !imgWrapper.classList.contains('MuiCard-root')) {
                    imgWrapper.style.display = 'none';
                    msHiddenContainers.add(img);
                }
            }
        });
    }

    // =========================================================================
    //                   КОПИРОВАНИЕ В БУФЕР ОБМЕНА + УВЕДОМЛЕНИЯ
    // =========================================================================

    function copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);
            return successful;
        } catch (err) {
            document.body.removeChild(textarea);
            return false;
        }
    }

    function showNotification(text, isError = false) {
        const notification = document.createElement('div');
        notification.textContent = text;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${isError ? '#d32f2f' : '#4caf50'};
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            animation: fadeInOut 2s ease-in-out;
            max-width: 300px;
            word-break: break-all;
        `;

        if (!document.querySelector('#face-fix-notification-style')) {
            const style = document.createElement('style');
            style.id = 'face-fix-notification-style';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateY(-10px); }
                    20% { opacity: 1; transform: translateY(0); }
                    80% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-10px); }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 2000);
    }

    // =========================================================================
    //                 ДЕЛАЕМ ЗНАЧЕНИЯ КЛИКАБЕЛЬНЫМИ (ПОЛНАЯ ВЕРСИЯ)
    // =========================================================================

    function makeValuesClickable() {
        const valueElements = document.querySelectorAll('.mui-1s4u51b-value:not(.clipboard-enabled)');

        valueElements.forEach(element => {
            element.classList.add('clipboard-enabled');

            const text = element.textContent.trim();
            const datePattern = /^(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{2}\.\d{2}\.\d{4})$/;
            const match = text.match(datePattern);

            if (match) {
                element.innerHTML = '';
                element.style.cssText += `
                    cursor: default;
                    display: flex;
                    gap: 5px;
                    align-items: center;
                `;

                const date1 = document.createElement('span');
                date1.textContent = match[1];
                date1.style.cssText = `
                    cursor: pointer;
                    transition: all 0.2s ease;
                    padding: 2px 4px;
                    border-radius: 3px;
                `;
                addDateCopyHandler(date1);

                const dash = document.createElement('span');
                dash.textContent = ' - ';
                dash.style.cssText = 'color: #666;';

                const date2 = document.createElement('span');
                date2.textContent = match[2];
                date2.style.cssText = `
                    cursor: pointer;
                    transition: all 0.2s ease;
                    padding: 2px 4px;
                    border-radius: 3px;
                `;
                addDateCopyHandler(date2);

                element.appendChild(date1);
                element.appendChild(dash);
                element.appendChild(date2);
            } else {
                element.style.cssText += `
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                    padding: 2px 4px;
                    border-radius: 3px;
                `;

                element.addEventListener('click', function(e) {
                    e.stopPropagation();

                    const textToCopy = this.textContent.trim();

                    if (copyToClipboard(textToCopy)) {
                        this.style.backgroundColor = '#e8f5e8';
                        this.style.color = '#2e7d32';
                        showNotification(`Скопировано: ${textToCopy}`);
                        setTimeout(() => {
                            this.style.backgroundColor = '';
                            this.style.color = '';
                        }, 1000);
                    } else {
                        this.style.backgroundColor = '#ffebee';
                        this.style.color = '#c62828';
                        setTimeout(() => {
                            this.style.backgroundColor = '';
                            this.style.color = '';
                        }, 1000);
                    }
                });

                element.addEventListener('mouseenter', function() {
                    this.style.backgroundColor = '#f5f5f5';
                });

                element.addEventListener('mouseleave', function() {
                    if (this.style.color !== '#2e7d32' && this.style.color !== '#c62828') {
                        this.style.backgroundColor = '';
                    }
                });

                element.title = 'Кликните чтобы скопировать';
            }
        });
    }

    function addDateCopyHandler(element) {
        element.addEventListener('click', function(e) {
            e.stopPropagation();

            const textToCopy = this.textContent.trim();

            if (copyToClipboard(textToCopy)) {
                this.style.backgroundColor = '#e8f5e8';
                this.style.color = '#2e7d32';
                showNotification(`Скопировано: ${textToCopy}`);
                setTimeout(() => {
                    this.style.backgroundColor = '';
                    this.style.color = '';
                }, 1000);
            } else {
                this.style.backgroundColor = '#ffebee';
                this.style.color = '#c62828';
                setTimeout(() => {
                    this.style.backgroundColor = '';
                    this.style.color = '';
                }, 1000);
            }
        });

        element.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#f5f5f5';
        });

        element.addEventListener('mouseleave', function() {
            if (this.style.color !== '#2e7d32' && this.style.color !== '#c62828') {
                this.style.backgroundColor = '';
            }
        });

        element.title = 'Кликните чтобы скопировать дату';
    }

    // =========================================================================
    //                 ПРЕОБРАЗОВАНИЕ В ДВЕ КОЛОНКИ (ПОЛНАЯ)
    // =========================================================================

    function transformTaskInfoToTwoColumns() {
        if (taskInfoProcessed) return;

        const contentContainers = document.querySelectorAll('.mui-qspag7-ItemCard-content');

        contentContainers.forEach(contentContainer => {
            if (contentContainer.classList.contains('two-columns-processed')) {
                return;
            }

            const hasExceptionData = contentContainer.textContent.includes('Данные об исключениях');
            if (hasExceptionData) {
                return;
            }

            const elementsToMove = [
                'Код задания',
                'Шаблон задачи',
                'Адрес торговой точки',
                'Исполнитель',
                'Дата и время выполнения',
                'Срок действия задачи'
            ];

            const allRows = contentContainer.querySelectorAll('.mui-pwm5fn-root-row');
            const firstColumnRows = [];
            const secondColumnRows = [];

            allRows.forEach(row => {
                const nameElement = row.querySelector('.mui-1insy2n-name');
                if (nameElement && elementsToMove.includes(nameElement.textContent.trim())) {
                    secondColumnRows.push(row);
                } else {
                    firstColumnRows.push(row);
                }
            });

            if (firstColumnRows.length === 0 && secondColumnRows.length === 0) {
                return;
            }

            const twoColumnsContainer = document.createElement('div');
            twoColumnsContainer.className = 'two-columns-container';
            twoColumnsContainer.style.cssText = `
                display: flex;
                gap: 40px;
                width: 100%;
                align-items: flex-start;
            `;

            const firstColumn = document.createElement('div');
            firstColumn.className = 'task-info-column first-column';
            firstColumn.style.cssText = `
                flex: 1;
                min-width: 0;
            `;

            const secondColumn = document.createElement('div');
            secondColumn.className = 'task-info-column second-column';
            secondColumn.style.cssText = `
                flex: 1;
                min-width: 0;
            `;

            firstColumnRows.forEach(row => {
                if (row.parentNode) {
                    firstColumn.appendChild(row.cloneNode(true));
                }
            });

            secondColumnRows.forEach(row => {
                if (row.parentNode) {
                    secondColumn.appendChild(row.cloneNode(true));
                }
            });

            twoColumnsContainer.appendChild(firstColumn);
            twoColumnsContainer.appendChild(secondColumn);

            contentContainer.innerHTML = '';
            contentContainer.appendChild(twoColumnsContainer);
            contentContainer.classList.add('two-columns-processed');

            addTwoColumnsStyles();

            taskInfoProcessed = true;
        });
    }

    function addTwoColumnsStyles() {
        if (document.querySelector('#two-columns-styles')) return;

        const style = document.createElement('style');
        style.id = 'two-columns-styles';
        style.textContent = `
            .two-columns-container {
                display: flex !important;
                gap: 40px !important;
                width: 100% !important;
                align-items: flex-start !important;
            }

            .task-info-column {
                flex: 1 !important;
                min-width: 0 !important;
            }

            .task-info-column .mui-pwm5fn-root-row {
                margin-bottom: 12px !important;
                padding: 8px 12px !important;
                border-radius: 6px !important;
                background: #f8f9fa !important;
                border-left: 3px solid #1976d2 !important;
            }

            .task-info-column .mui-1insy2n-name {
                font-weight: 600 !important;
                color: #333 !important;
                font-size: 13px !important;
                margin-bottom: 4px !important;
            }

            .task-info-column .mui-1s4u51b-value {
                color: #666 !important;
                font-size: 14px !important;
                line-height: 1.4 !important;
                word-break: break-word !important;
            }

            .second-column .mui-pwm5fn-root-row {
                border-left-color: #4caf50 !important;
            }
        `;
        document.head.appendChild(style);
    }

    // =========================================================================
    //                       ПЕРЕМЕЩЕНИЕ ИЗОБРАЖЕНИЯ (ПОЛНАЯ)
    // =========================================================================

    function moveImage() {
        const currentUrl = window.location.href;

        if (processedUrls.has(currentUrl)) {
            return;
        }

        if (currentPhotoTaskType === 'MS') {
            processMSImages();
            processedUrls.add(currentUrl);
            return;
        }

        const exampleImg = document.querySelector('.mui-88yf90-image');
        const targetButton = document.querySelector('button.mui-1odqcqr-mediaWrapper');

        if (exampleImg && targetButton) {
            const cardContainer = targetButton.closest('.MuiCard-root');

            if (cardContainer) {
                const imageContainer = document.createElement('div');
                imageContainer.style.cssText = `
                    margin-left: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    max-width: 300px;
                    max-height: 400px;
                `;

                const clonedImg = exampleImg.cloneNode(true);
                clonedImg.style.cssText = `
                    max-width: 100%;
                    max-height: 100%;
                    width: auto;
                    height: auto;
                    display: block;
                `;

                imageContainer.appendChild(clonedImg);
                cardContainer.parentNode.insertBefore(imageContainer, cardContainer.nextSibling);

                const originalContainer = exampleImg.closest('.mui-4ltfca-ItemCard-root');
                if (originalContainer) {
                    originalContainer.style.display = 'none';
                }

                processedUrls.add(currentUrl);
            }
        }
    }

    // =========================================================================
    //                    УМЕНЬШЕНИЕ УВЕДОМЛЕНИЙ TOASTIFY (ПОЛНАЯ)
    // =========================================================================

    function adjustToastifyNotification() {
        const toastContainer = document.querySelector('.Toastify__toast-container');
        if (toastContainer) {
            Object.assign(toastContainer.style, {
                position: 'fixed',
                top: '5px',
                right: '5px',
                zIndex: '1002',
                padding: '0',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'flex-end'
            });

            document.querySelectorAll('.Toastify__toast').forEach(toast => {
                Object.assign(toast.style, {
                    backgroundColor: 'rgba(76, 175, 80, 0.9)',
                    borderRadius: '6px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    lineHeight: '1',
                    maxWidth: '350px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                    height: '18px',
                    zIndex: '1002'
                });
                toast.querySelector('svg')?.remove();
                toast.querySelector('.Toastify__close-button')?.remove();
            });
        }
    }

    // =========================================================================
    //              ДОБАВЛЕНИЕ КНОПОК НА СТРАНИЦАХ (ПОЛНАЯ)
    // =========================================================================

    function addTasksHeader() {
        if (!window.location.href.includes('participant-report') && !window.location.href.includes('pos-report')) {
            return;
        }

        const tableRows = document.querySelectorAll('.MuiTableBody-root .MuiTableRow-root');
        const tableHead = document.querySelector('.MuiTableHead-root');
        const isPhotoTaskList = tableHead && tableHead.textContent.includes('Код точки');
        const isParticipantPage = window.location.href.includes('/process/');
        const isPosTasksPage = window.location.href.includes('/pos-report/process/');

        tableRows.forEach((row, index) => {
            if (row.querySelector('.custom-tasks-cell')) return;

            const menuButton = row.querySelector('.MuiButtonBase-root.MuiIconButton-root');
            if (!menuButton) return;

            const menuCell = menuButton.closest('.MuiTableCell-root');
            if (!menuCell) return;

            const tasksCell = document.createElement('td');
            tasksCell.className = 'MuiTableCell-root MuiTableCell-body MuiTableCell-alignLeft MuiTableCell-sizeMedium custom-tasks-cell';
            tasksCell.setAttribute('role', 'cell');

            const buttonsContainer = document.createElement('div');
            buttonsContainer.style.cssText = `
                display: flex;
                gap: 8px;
                align-items: center;
            `;

            const openButton = document.createElement('button');
            openButton.style.cssText = `
                color: #1976d2;
                background-color: rgba(25, 118, 210, 0.08);
                cursor: pointer;
                font-weight: 500;
                padding: 8px 16px;
                white-space: nowrap;
                border: 1px solid rgba(25, 118, 210, 0.3);
                border-radius: 20px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 100px;
                text-align: center;
                box-sizing: border-box;
                transition: all 0.2s ease;
                font-size: 14px;
                height: 36px;
            `;

            if (isPhotoTaskList || isPosTasksPage || isParticipantPage) {
                openButton.textContent = 'Открыть';
                openButton.style.minWidth = '100px';
                openButton.style.height = '36px';

                openButton.addEventListener('mouseover', () => {
                    openButton.style.backgroundColor = 'rgba(25, 118, 210, 0.12)';
                    openButton.style.boxShadow = '0 2px 4px rgba(25, 118, 210, 0.2)';
                    openButton.style.borderColor = 'rgba(25, 118, 210, 0.5)';
                });

                openButton.addEventListener('mouseout', () => {
                    openButton.style.backgroundColor = 'rgba(25, 118, 210, 0.08)';
                    openButton.style.boxShadow = 'none';
                    openButton.style.borderColor = 'rgba(25, 118, 210, 0.3)';
                });
            } else {
                openButton.textContent = 'Задания';
                openButton.style.minWidth = '100px';
                openButton.style.height = '36px';

                openButton.addEventListener('mouseover', () => {
                    openButton.style.backgroundColor = 'rgba(25, 118, 210, 0.12)';
                    openButton.style.boxShadow = '0 2px 4px rgba(25, 118, 210, 0.2)';
                    openButton.style.borderColor = 'rgba(25, 118, 210, 0.5)';
                });

                openButton.addEventListener('mouseout', () => {
                    openButton.style.backgroundColor = 'rgba(25, 118, 210, 0.08)';
                    openButton.style.boxShadow = 'none';
                    openButton.style.borderColor = 'rgba(25, 118, 210, 0.3)';
                });

                if (!isParticipantPage && !isPosTasksPage) {
                    const transactionsButton = document.createElement('button');
                    transactionsButton.textContent = 'Транзакции';
                    transactionsButton.style.cssText = `
                        color: #2e7d32;
                        background-color: rgba(46, 125, 50, 0.08);
                        cursor: pointer;
                        font-weight: 500;
                        padding: 8px 16px;
                        white-space: nowrap;
                        border: 1px solid rgba(46, 125, 50, 0.3);
                        border-radius: 20px;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        min-width: 100px;
                        text-align: center;
                        box-sizing: border-box;
                        transition: all 0.2s ease;
                        font-size: 14px;
                        height: 36px;
                    `;

                    transactionsButton.addEventListener('mouseover', () => {
                        transactionsButton.style.backgroundColor = 'rgba(46, 125, 50, 0.12)';
                        transactionsButton.style.boxShadow = '0 2px 4px rgba(46, 125, 50, 0.2)';
                        transactionsButton.style.borderColor = 'rgba(46, 125, 50, 0.5)';
                    });

                    transactionsButton.addEventListener('mouseout', () => {
                        transactionsButton.style.backgroundColor = 'rgba(46, 125, 50, 0.08)';
                        transactionsButton.style.boxShadow = 'none';
                        transactionsButton.style.borderColor = 'rgba(46, 125, 50, 0.3)';
                    });

                    transactionsButton.addEventListener('click', () => {
                        const currentMenuButton = row.querySelector('.MuiButtonBase-root.MuiIconButton-root');
                        if (currentMenuButton) {
                            currentMenuButton.click();

                            setTimeout(() => {
                                const menuItems = document.querySelectorAll('li[role="menuitem"]');
                                const targetMenuItem = Array.from(menuItems).find(item =>
                                    item.textContent.trim() === 'Транзакции'
                                );

                                if (targetMenuItem) {
                                    const menuItemMouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
                                    const menuItemClick = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
                                    targetMenuItem.dispatchEvent(menuItemMouseDown);
                                    targetMenuItem.dispatchEvent(menuItemClick);
                                }
                            }, 200);
                        }
                    });

                    buttonsContainer.appendChild(transactionsButton);
                }
            }

            openButton.addEventListener('click', () => {
                const currentMenuButton = row.querySelector('.MuiButtonBase-root.MuiIconButton-root');
                if (currentMenuButton) {
                    currentMenuButton.click();

                    setTimeout(() => {
                        const menuItems = document.querySelectorAll('li[role="menuitem"]');
                        let targetMenuItem;

                        if (isParticipantPage) {
                            targetMenuItem = Array.from(menuItems).find(item =>
                                item.textContent.trim() === 'Оценка задачи'
                            );
                            if (!targetMenuItem) {
                                targetMenuItem = Array.from(menuItems).find(item =>
                                    item.textContent.trim() === 'Просмотр завершенной задачи'
                                );
                            }
                        } else if (isPosTasksPage) {
                            targetMenuItem = Array.from(menuItems).find(item =>
                                item.textContent.trim() === 'Просмотр задачи'
                            );
                        } else {
                            targetMenuItem = Array.from(menuItems).find(item =>
                                item.textContent.trim() === (isPhotoTaskList ? 'Задачи' : 'Связанные задачи')
                            );
                        }

                        if (targetMenuItem) {
                            const menuItemMouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
                            const menuItemClick = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
                            targetMenuItem.dispatchEvent(menuItemMouseDown);
                            targetMenuItem.dispatchEvent(menuItemClick);
                        }
                    }, 200);
                }
            });

            buttonsContainer.appendChild(openButton);
            tasksCell.appendChild(buttonsContainer);
            row.insertBefore(tasksCell, menuCell);

            Object.assign(menuCell.style, { verticalAlign: 'middle' });
            Object.assign(tasksCell.style, { verticalAlign: 'middle' });

            row.style.height = 'auto';
            row.style.display = 'table-row';

            if (menuButton) {
                menuButton.style.margin = '0';
            }
        });
    }

    // =========================================================================
    //                      ПОДСКАЗКИ ДЛЯ КНОПОК (ПОЛНАЯ)
    // =========================================================================

    function addConfirmButtonHint() {
        const button = document.querySelector('button.mui-nm6qd7-button-inlineButton') ||
                      document.querySelector('button[class*="button-inlineButton"]') ||
                      document.querySelector('button:not([disabled])');

        if (button) {
            const buttonText = button.textContent.trim();
            if ((buttonText === 'Подтвердить' || buttonText === 'Оценить') && !button.querySelector('.space-hint')) {
                const hint = document.createElement('span');
                hint.className = 'space-hint';
                hint.style.cssText = `
                    font-size: 10px;
                    color: rgba(255,255,255,0.7);
                    margin-left: 8px;
                    display: inline-flex;
                    align-items: center;
                    height: 100%;
                `;
                hint.textContent = 'Пробел';
                button.appendChild(hint);
            }
        }
    }

    function addAcceptButtonHint() {
        const buttonsContainer = document.querySelector('.mui-1v8219x-container-containerCenter');
        if (!buttonsContainer) return;

        const acceptButton = buttonsContainer.querySelector('.mui-wt0pxj-item');
        if (!acceptButton) return;

        if (acceptButton.parentElement && acceptButton.parentElement.querySelector('.accept-button-hints')) {
            return;
        }

        const hintsDiv = document.createElement('div');
        hintsDiv.className = 'accept-button-hints';
        hintsDiv.style.cssText = `
            font-size: 12px;
            color: #666;
            margin-top: 4px;
            text-align: center;
            position: absolute;
            left: 0;
            right: 0;
            bottom: -20px;
        `;
        hintsDiv.innerHTML = `<div>Пробел / 1</div>`;

        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            position: relative;
            display: inline-block;
        `;

        acceptButton.parentNode.insertBefore(wrapper, acceptButton);
        wrapper.appendChild(acceptButton);
        wrapper.appendChild(hintsDiv);
    }

    function addSearchButtonHint() {
        const isParticipantReportPage = window.location.href.includes('participant-report');
        const isPosReportPage = window.location.href.includes('pos-report');

        if (!isParticipantReportPage && !isPosReportPage) return;

        const allButtons = document.querySelectorAll('button');
        const searchButton = Array.from(allButtons).find(btn => btn.textContent.trim() === 'Найти');

        if (!searchButton) return;
        if (searchButton.nextElementSibling && searchButton.nextElementSibling.classList.contains('search-button-hints')) return;

        const hintsSpan = document.createElement('span');
        hintsSpan.className = 'search-button-hints';
        hintsSpan.style.cssText = `
            font-size: 11px;
            color: #888;
            margin-left: 8px;
            white-space: nowrap;
            vertical-align: middle;
        `;
        hintsSpan.textContent = 'Пробел / Enter';

        const parent = searchButton.parentElement;
        if (parent) {
            parent.insertBefore(hintsSpan, searchButton.nextSibling);
        }
    }

    function addButtonHints() {
        let panels = Array.from(document.querySelectorAll('.mui-1pxbw4e-ItemCard-labelWrap'));
        if (panels.length === 0) {
            panels = Array.from(document.querySelectorAll('div, label')).filter(el =>
                el.textContent && el.textContent.includes('Причина отклонения')
            );
            if (panels.length === 0) return;
        }

        panels.forEach(panel => {
            let labelContent = panel.querySelector('.mui-dwc2tl-ItemCard-labelContent') || panel;
            if (!labelContent) return;

            const text = labelContent.textContent.trim();

            if (text.includes('Причина отклонения') && !panel.querySelector('.decline-reason-hints')) {
                const hintsDiv = document.createElement('div');
                hintsDiv.className = 'decline-reason-hints';
                hintsDiv.style.cssText = `
                    font-size: 12px;
                    color: #666;
                    margin-top: 4px;
                    padding-left: 20px;
                `;

                const hints = reasonHints[currentPhotoTaskType] || [];
                hintsDiv.innerHTML = hints.map(h => `<div>${h}</div>`).join('');
                labelContent.appendChild(hintsDiv);
            }
        });
    }

    // =========================================================================
    //                         АВТОСКРОЛЛ (ПОЛНАЯ)
    // =========================================================================

    function scrollToBottom() {
        window.scrollTo({
            top: document.body.scrollHeight,
            behavior: 'smooth'
        });
    }

    function addActionButtonListeners() {
        const actionButtons = document.querySelectorAll('div.MuiBox-root[class*="item"]');

        actionButtons.forEach(button => {
            const text = button.textContent.trim();
            if ((text === 'Отклонить' || text === 'Переназначить') && !button.classList.contains('face-fix-scroll-added')) {
                button.classList.add('face-fix-scroll-added');
                button.addEventListener('click', () => {
                    setTimeout(scrollToBottom, 300);
                });
            }
        });
    }

    // =========================================================================
    //                      КЛАВИАТУРНАЯ НАВИГАЦИЯ (ПОЛНАЯ)
    // =========================================================================

    function handleKeyPress(e) {
        if (e.code === 'Space' || e.key === ' ') {
            e.preventDefault();
            e.stopImmediatePropagation();

            if (window.location.href.includes('/participant-report') || window.location.href.includes('/pos-report')) {
                const findButton = Array.from(document.querySelectorAll('button[type="button"]'))
                    .find(button => button.textContent.trim() === 'Найти');
                if (findButton) {
                    findButton.click();
                    return;
                }
            }

            if (window.location.href.includes('/dte-tasks-checking')) {
                const taskItem = document.querySelector('.mui-1p7ca9h-item');
                if (taskItem) {
                    const firstRow = taskItem.querySelector('tr.MuiTableRow-root');
                    if (firstRow) {
                        firstRow.click();
                        return;
                    } else {
                        taskItem.click();
                        return;
                    }
                }
            }

            const hasActionButtons = document.querySelector('div.MuiBox-root[class*="item"]') !== null;

            if (hasActionButtons) {
                const selectedBtn = document.querySelector('div.MuiBox-root[class*="item-selected"]');
                const selectedText = selectedBtn?.textContent.trim();

                const isAccept = selectedText === 'Принять';
                const isDecline = selectedText === 'Отклонить';
                const isReassign = selectedText === 'Переназначить';

                if (isAccept || isDecline || isReassign) {
                    const confirmBtn = document.querySelector('button.mui-nm6qd7-button-inlineButton') ||
                                    document.querySelector('button[class*="button-inlineButton"]') ||
                                    document.querySelector('button:not([disabled])');
                    if (confirmBtn) {
                        confirmBtn.click();
                        return;
                    }
                } else {
                    const acceptBtn = Array.from(document.querySelectorAll('div.MuiBox-root[class*="item"]'))
                        .find(div => div.textContent.trim() === 'Принять' && div.offsetParent !== null);
                    if (acceptBtn) {
                        acceptBtn.click();
                        return;
                    }
                }
            }

            const confirmBtn = document.querySelector('button.mui-nm6qd7-button-inlineButton') ||
                            document.querySelector('button[class*="button-inlineButton"]') ||
                            document.querySelector('button:not([disabled])');
            if (confirmBtn) {
                confirmBtn.click();
                return;
            }
        }

        if (e.key === 'Enter' &&
            (window.location.href.includes('/participant-report') || window.location.href.includes('/pos-report'))) {
            const findButton = Array.from(document.querySelectorAll('button[type="button"]'))
                .find(button => button.textContent.trim() === 'Найти');
            if (findButton) {
                e.preventDefault();
                e.stopImmediatePropagation();
                findButton.click();
                return;
            }
        }

        const hasActionButtons = document.querySelector('div.MuiBox-root[class*="item"]') !== null;
        if ((e.key === '1' || e.key === '2' || e.key === '3') && hasActionButtons) {
            e.preventDefault();
            e.stopImmediatePropagation();

            const buttons = Array.from(document.querySelectorAll('div.MuiBox-root[class*="item"]'))
                .filter(div => div.offsetParent !== null);

            const acceptBtn = buttons.find(div => div.textContent.trim() === 'Принять');
            const declineBtn = buttons.find(div => div.textContent.trim() === 'Отклонить');
            const reassignBtn = buttons.find(div => div.textContent.trim() === 'Переназначить');

            if (e.key === '1' && acceptBtn) {
                acceptBtn.click();
            } else if (e.key === '2' && declineBtn) {
                declineBtn.click();
                setTimeout(() => {
                    addButtonHints();
                    scrollToBottom();
                }, 100);
            } else if (e.key === '3' && reassignBtn) {
                reassignBtn.click();
                setTimeout(() => {
                    addButtonHints();
                    scrollToBottom();
                }, 100);
            }
        }

        if ((e.key >= '4' && e.key <= '9' || e.key === '0') && hasActionButtons) {
            e.preventDefault();
            e.stopImmediatePropagation();

            const selectButton = document.querySelector('div[role="combobox"][aria-haspopup="listbox"].MuiSelect-select');
            if (!selectButton) return;

            const isOpen = document.querySelector('div.MuiPaper-root[role="presentation"]') !== null;

            if (!isOpen) {
                const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
                const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
                selectButton.dispatchEvent(mouseDownEvent);
                selectButton.dispatchEvent(clickEvent);
            }

            setTimeout(() => {
                const listItems = Array.from(document.querySelectorAll('li.MuiMenuItem-root'))
                    .filter(item => item.offsetParent !== null);

                const map = reasonMaps[currentPhotoTaskType] || {};
                const targetText = map[e.key];
                let targetItem = listItems.find(item => item.textContent.trim() === targetText);

                if (!targetItem && targetText) {
                    let keyPhrase = targetText;
                    if (keyPhrase.includes(':')) keyPhrase = keyPhrase.split(':').pop().trim();
                    targetItem = listItems.find(item => item.textContent.trim().includes(keyPhrase));
                }

                if (targetItem) {
                    const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
                    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
                    targetItem.dispatchEvent(mouseDownEvent);
                    targetItem.dispatchEvent(clickEvent);

                    setTimeout(() => {
                        const okButton = document.querySelector('button.mui-i8xh1');
                        if (okButton) {
                            okButton.click();
                        }
                    }, 300);
                }
            }, 100);
        }
    }

    // =========================================================================
    //                  ОПРЕДЕЛЕНИЕ ТИПА ЗАДАЧИ (ПОЛНАЯ)
    // =========================================================================

    function getPhotoTaskTypeFromTemplate() {
        const names = document.querySelectorAll('.mui-1insy2n-name');
        let templateValue = '';
        names.forEach(nameEl => {
            if (nameEl.textContent.trim().toLowerCase().includes('шаблон задачи')) {
                const valueEl = nameEl.nextElementSibling;
                if (valueEl && valueEl.classList.contains('mui-1s4u51b-value')) {
                    templateValue = valueEl.textContent.trim().toLowerCase();
                }
            }
        });
        if (!templateValue) return 'unknown';
        if (templateValue.includes('npl')) return 'NPL';
        if (/\ba[_\-]/.test(templateValue) || templateValue.startsWith('a_')) return 'A';
        if (/\bv[_\-]/.test(templateValue) || templateValue.startsWith('v_')) return 'В';
        if (templateValue.includes('ms')) return 'MS';
        return 'unknown';
    }

    // =========================================================================
    //                 ОТОБРАЖЕНИЕ ИНДИКАТОРА АКТИВНОСТИ (ПОЛНАЯ)
    // =========================================================================

    function showScriptActive() {
        const toolbar = document.querySelector('.mui-3qt5b8-TitleBar-baseToolbar');
        if (toolbar) {
            if (!document.querySelector('.script-active-indicator')) {
                const indicator = document.createElement('div');
                indicator.className = 'script-active-indicator';
                indicator.title = 'FACE FIX v4.1.8 - Накодено с любовью к работе и ненавистью к руководству';
                indicator.style.cssText = `
                    color: #4CAF50;
                    font-size: 0.8em;
                    margin-left: 10px;
                    margin-right: 10px;
                    padding: 2px 8px;
                    border: 1px solid #4CAF50;
                    border-radius: 4px;
                    display: inline-block;
                    cursor: pointer;
                    text-decoration: none;
                `;
                indicator.textContent = 'FACE FIX v4.1.8';
                indicator.onclick = () => {
                    window.open('https://boosty.to/grana/donate', '_blank');
                };

                const title = toolbar.querySelector('h1');
                if (title) {
                    title.parentNode.insertBefore(indicator, title.nextSibling);
                } else {
                    toolbar.appendChild(indicator);
                }
            }
        }
    }

    // =========================================================================
    //                          НОВЫЙ ФУНКЦИОНАЛ
    //                    (КНОПКА "ОБРАЩЕНИЕ" ДЛЯ NPL и V)
    // =========================================================================

    const mappingCache = { NPL: null, В: null };
    const mappingFetchPromise = {};

    function fetchMapping(type) {
        if (mappingCache[type]) return Promise.resolve(mappingCache[type]);
        if (mappingFetchPromise[type]) return mappingFetchPromise[type];

        const url = appealConfig[type].mappingUrl;
        mappingFetchPromise[type] = fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`Не удалось загрузить маппинг для ${type}`);
                return response.text();
            })
            .then(text => {
                const mapping = {};
                text.split('\n').forEach(line => {
                    line = line.trim();
                    if (line && line.includes(' - ')) {
                        const [reason, textPart] = line.split(' - ').map(s => s.trim());
                        mapping[reason] = textPart;
                    }
                });
                mappingCache[type] = mapping;
                delete mappingFetchPromise[type];
                return mapping;
            })
            .catch(err => {
                console.error(`FACE FIX: Ошибка загрузки маппинга для ${type}`, err);
                delete mappingFetchPromise[type];
                return {};
            });
        return mappingFetchPromise[type];
    }

    function addAppealButton() {
        const type = getPhotoTaskTypeFromTemplate();
        if (type !== 'NPL' && type !== 'В') return;

        const reassignButton = Array.from(document.querySelectorAll('div.MuiBox-root'))
            .find(el => el.textContent.trim() === 'Переназначить');
        if (!reassignButton) return;

        const container = reassignButton.parentElement;
        if (!container) return;

        const existing = container.querySelector('.face-fix-appeal-button');
        const isSelected = reassignButton.classList.contains('mui-oukko0-item-selected');

        if (!isSelected) {
            if (existing) existing.remove();
            return;
        }
        if (existing) return;

        const appealButton = document.createElement('div');
        appealButton.className = 'MuiBox-root face-fix-appeal-button';
        appealButton.textContent = 'Обращение';
        appealButton.style.cssText = `
            color: #1976d2;
            background-color: rgba(25, 118, 210, 0.08);
            cursor: pointer;
            font-weight: 500;
            padding: 6px 24px;
            white-space: nowrap;
            border: 1px solid rgba(25, 118, 210, 0.3);
            border-radius: 20px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 120px;
            text-align: center;
            box-sizing: border-box;
            transition: all 0.2s ease;
            font-size: 15px;
            line-height: 24px;
            height: 36px;
            margin-left: 12px;
        `;

        appealButton.addEventListener('mouseenter', () => {
            appealButton.style.backgroundColor = 'rgba(25, 118, 210, 0.12)';
            appealButton.style.boxShadow = '0 2px 4px rgba(25, 118, 210, 0.2)';
            appealButton.style.borderColor = 'rgba(25, 118, 210, 0.5)';
        });
        appealButton.addEventListener('mouseleave', () => {
            appealButton.style.backgroundColor = 'rgba(25, 118, 210, 0.08)';
            appealButton.style.boxShadow = 'none';
            appealButton.style.borderColor = 'rgba(25, 118, 210, 0.3)';
        });

        appealButton.addEventListener('click', (e) => handleAppealClick(e, type));
        reassignButton.insertAdjacentElement('afterend', appealButton);
    }

    async function handleAppealClick(e, type) {
        e.stopPropagation();

        const selectBox = document.querySelector('div[role="combobox"][aria-haspopup="listbox"]');
        if (!selectBox) {
            showNotification('Не найден выбор причины отклонения', true);
            return;
        }

        const selectedRaw = selectBox.textContent.trim();
        if (selectedRaw === 'Выбрать') {
            showNotification('Выбери причину отклонения', true);
            return;
        }

        const mapping = await fetchMapping(type);
        const reasons = selectedRaw.split(',').map(s => s.trim()).filter(Boolean);
        const reasonTexts = reasons.map(r => mapping[r]).filter(Boolean);
        if (reasonTexts.length === 0) {
            showNotification(`Не найден текст для причины: ${selectedRaw}`, true);
            return;
        }

        const combinedReason = reasonTexts.join(', ');

        let performerName = '';
        const performerRow = Array.from(document.querySelectorAll('.mui-1insy2n-name'))
            .find(el => el.textContent.trim().toLowerCase().includes('исполнитель'));
        if (performerRow) {
            const valueEl = performerRow.nextElementSibling;
            if (valueEl && valueEl.classList.contains('mui-1s4u51b-value')) {
                performerName = valueEl.textContent.trim().split(' ')[0];
            }
        }

        let message;
        if (type === 'NPL') {
            let taskSuffix = '';
            const taskNameRow = Array.from(document.querySelectorAll('.mui-1insy2n-name'))
                .find(el => el.textContent.trim().toLowerCase().includes('название задания'));
            if (taskNameRow) {
                const valueEl = taskNameRow.nextElementSibling;
                if (valueEl && valueEl.classList.contains('mui-1s4u51b-value')) {
                    const fullName = valueEl.textContent.trim();
                    const prefix = 'Дополнительное фотозадание';
                    taskSuffix = fullName.startsWith(prefix) ? fullName.substring(prefix.length).trim() : fullName;
                }
            }
            message = appealConfig.NPL.messageTemplate(performerName, combinedReason, taskSuffix);
        } else if (type === 'В') {
            message = appealConfig.В.messageTemplate(performerName, combinedReason);
        }

        if (copyToClipboard(message)) {
            showNotification('Текст скопирован в буфер обмена');
        } else {
            showNotification('Не удалось скопировать текст', true);
        }
    }

    // =========================================================================
    //                       ОСНОВНАЯ ЛОГИКА (ЦИКЛ)
    // =========================================================================

    function checkAndProcess() {
        if (window.location.href.includes('/process/')) {
            const newType = getPhotoTaskTypeFromTemplate();
            if (newType !== currentPhotoTaskType) {
                currentPhotoTaskType = newType;

                if (newType === 'MS') {
                    msImagesProcessed = false;
                    processedUrls.delete(window.location.href);
                }
            }
        }

        moveImage();
        adjustToastifyNotification();
        addConfirmButtonHint();
        addAcceptButtonHint();
        addSearchButtonHint();
        addTasksHeader();
        addActionButtonListeners();

        if (window.location.href.includes('/process/')) {
            transformTaskInfoToTwoColumns();
        }

        makeValuesClickable();
        showScriptActive();

        if (currentPhotoTaskType === 'MS') {
            hideMSContainers();
        }

        if (window.updatePhotoTaskCounterDisplay) {
            window.updatePhotoTaskCounterDisplay();
        }

        addAppealButton();
    }

    // =========================================================================
    //                           ИНИЦИАЛИЗАЦИЯ
    // =========================================================================

    function init() {
        checkAndProcess();
    }

    window.addEventListener('load', init);
    setInterval(checkAndProcess, 2000);

    const observer = new MutationObserver(checkAndProcess);
    observer.observe(document.body, { childList: true, subtree: true });

    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            processedUrls.delete(url);
            taskInfoProcessed = false;
            msImagesProcessed = false;
            msHiddenContainers = new WeakSet();
            setTimeout(checkAndProcess, 500);
        }
    }).observe(document, { subtree: true, childList: true });

    document.addEventListener('keydown', handleKeyPress, true);
})();
