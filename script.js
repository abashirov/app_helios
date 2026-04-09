document.addEventListener('DOMContentLoaded', () => {
    // Получаем данные из объекта MAX Bridge
    const webApp = window.WebApp;
    // Ожидается, что данные в webApp.initDataUnsafe или напрямую в webApp
    // В документации указано: initDataUnsafe.start_param с данными из URL
    const initDataUnsafe = webApp?.initDataUnsafe || {};
    // В некоторых случаях webApp.initData напрямую содержит start_param для MAX Apps, но 
    // скорее всего это в initDataUnsafe, или как start_param в объекте startParam.

    // Элементы UI
    const elGreeting = document.getElementById('greeting');
    const elUsername = document.getElementById('username');
    const elUserId = document.getElementById('userId');
    const elStartParam = document.getElementById('startParam');
    const elUserAvatar = document.getElementById('userAvatar');
    const elAvatarPlaceholder = document.getElementById('avatarPlaceholder');

    // Получение данных пользователя
    const user = initDataUnsafe.user;
    let fallbackChar = 'U';

    if (user) {
        const firstName = user.first_name || '';
        const lastName = user.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim() || 'Пользователь';
        fallbackChar = fullName.charAt(0).toUpperCase();

        elGreeting.textContent = `Привет, ${firstName || 'Друг'}!`;
        elUsername.textContent = `@${user.username || 'неизвестно'}`;
        elUserId.textContent = user.id || '-';

        // Обработка аватарки
        if (user.photo_url) {
            elUserAvatar.src = user.photo_url;
            elUserAvatar.style.display = 'block';
            elAvatarPlaceholder.style.display = 'none';
        } else {
            // Заглушка, если нет фото
            elAvatarPlaceholder.textContent = fallbackChar;
        }
    } else {
        elGreeting.textContent = "Добро пожаловать!";
        elUsername.textContent = "Запущено вне MAX";
        elAvatarPlaceholder.textContent = "M";
    }

    // Получение параметра запуска
    // Согласно документации MAX, startapp параметры в initDataUnsafe.start_param
    let startParam = initDataUnsafe.start_param;
    if (!startParam && webApp?.start_param) {
        startParam = webApp.start_param;
    }

    // Если тестируем локально, можем взять из URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (!startParam && urlParams.has('startapp')) {
        startParam = urlParams.get('startapp');
    }

    if (startParam) {
        elStartParam.textContent = startParam;
    } else {
        elStartParam.textContent = "Не задан (пусто)";
    }

    // Временное правило дебага для конкретного пользователя
    const DEBUG_USER_ID = 204603037;
    const API_BASE_URL = 'https://g-ads.pro/api/plug/tracker';
    const MAX_URL_PATTERN = /^https:\/\/max\.ru\/.+/i;

    function parseTrackerParam(rawParam) {
        if (!rawParam) {
            return { baseHash: null, yclid: null, rawParam: null, matchedNewFormat: false };
        }

        const raw = String(rawParam);

        // Известный формат хэша: TL + 12 hex символов
        const hashMatch = raw.match(/^(TL[a-f0-9]{12})/i);
        const baseHash = hashMatch ? hashMatch[1] : raw;

        // Извлекаем yclid если есть где-то в строке
        const yclidMatch = raw.match(/_yclid(\d+)/i);
        const yclid = yclidMatch ? yclidMatch[1] : null;

        return {
            baseHash,
            yclid,
            rawParam: raw,
            matchedNewFormat: hashMatch !== null && raw.length > baseHash.length,
        };
    }

    function renderDebugInfo(debugData) {
        const dashboard = document.getElementById('linksDashboard');
        const container = document.getElementById('linksContainer');
        dashboard.style.display = 'block';

        const rows = [
            ['User ID', debugData.userId ?? '-'],
            ['Raw startapp', debugData.rawStartParam ?? '-'],
            ['Base hash', debugData.baseHash ?? '-'],
            ['YCLID', debugData.yclid ?? '-'],
            ['Cookie', debugData.cookie || '(пусто)'],
            ['API URL найден', debugData.apiUrl ? 'Да' : 'Нет'],
            ['Редирект заблокирован', debugData.redirectBlocked ? 'Да' : 'Нет'],
            ['Ошибка', debugData.error || '-']
        ];

        container.innerHTML = rows.map(([label, value]) => `
            <div class="info-item" style="gap: 6px;">
                <span class="label">${label}</span>
                <span class="val" style="font-size: 0.95rem; word-break: break-word;">${String(value)}</span>
            </div>
        `).join('');
    }

    function escapeHtml(value) {
        return String(value || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function isAllowedMaxUrl(url) {
        return MAX_URL_PATTERN.test(String(url || '').trim());
    }

    function isAllowedRedirectUrl(url) {
        const normalized = String(url || '').trim();
        return normalized.length === 0 || isAllowedMaxUrl(normalized);
    }

    function showLinksManager(channels) {
        const manager = document.getElementById('linksManager');
        const managerBody = document.getElementById('linksManagerBody');
        if (!manager || !managerBody) {
            return;
        }

        const normalizedChannels = Array.isArray(channels)
            ? channels.filter(c => Array.isArray(c.links) && c.links.length > 0)
            : [];

        if (!normalizedChannels.length) {
            manager.style.display = 'none';
            return;
        }

        manager.style.display = 'flex';
        managerBody.innerHTML = normalizedChannels.map((channel) => {
            const channelTitle = escapeHtml(channel.title || `Канал ${channel.mxChannelId}`);
            const currentLink = escapeHtml(channel.channelLink || '');
            const mxChannelId = escapeHtml(channel.mxChannelId || '');
            const linksRows = channel.links.map((link) => {
                const linkName = escapeHtml(link.name || 'Без названия');
                const hash = escapeHtml(link.startappHash || '');
                const redirect = escapeHtml(link.redirect || '');
                const linkId = escapeHtml(link.id || '');
                return `
                    <li class="manager-link-item" data-link-id="${linkId}">
                        <div class="manager-link-top">
                            <span>${linkName}</span>
                            <span>${hash}</span>
                        </div>
                        <label class="manager-label manager-label-small" for="link-redirect-${linkId}">Redirect ссылки (пусто = вести на ссылку канала)</label>
                        <div class="manager-edit-row manager-edit-row-inline">
                            <input id="link-redirect-${linkId}" class="manager-input manager-input-compact" type="url" value="${redirect}" placeholder="https://max.ru/... или пусто" />
                            <button class="manager-save-btn manager-link-save-btn" type="button">Сохранить redirect</button>
                        </div>
                        <div class="manager-status manager-link-status" aria-live="polite"></div>
                    </li>
                `;
            }).join('');

            return `
                <div class="manager-card" data-channel-id="${mxChannelId}">
                    <div class="manager-head">
                        <strong>${channelTitle}</strong>
                        <small>ID: ${mxChannelId}</small>
                    </div>
                    <label class="manager-label" for="channel-link-${mxChannelId}">Ссылка канала (только https://max.ru/*)</label>
                    <div class="manager-edit-row">
                        <input id="channel-link-${mxChannelId}" class="manager-input" type="url" value="${currentLink}" placeholder="https://max.ru/..." />
                        <button class="manager-save-btn" type="button">Сохранить</button>
                    </div>
                    <div class="manager-status" aria-live="polite"></div>
                    <ul class="manager-links-list">${linksRows}</ul>
                </div>
            `;
        }).join('');

        managerBody.querySelectorAll('.manager-card').forEach((card) => {
            const channelId = card.getAttribute('data-channel-id') || '';
            const input = card.querySelector('.manager-input');
            const button = card.querySelector('.manager-save-btn');
            const status = card.querySelector('.manager-status');

            if (!input || !button || !status) {
                return;
            }

            button.addEventListener('click', async () => {
                const nextUrl = String(input.value || '').trim();
                if (!isAllowedMaxUrl(nextUrl)) {
                    status.textContent = 'Разрешены только ссылки формата https://max.ru/*';
                    status.classList.add('error');
                    status.classList.remove('ok');
                    return;
                }

                const initData = webApp?.initData || '';
                if (!initData) {
                    status.textContent = 'Нет initData для авторизации в Mini App.';
                    status.classList.add('error');
                    status.classList.remove('ok');
                    return;
                }

                status.textContent = 'Сохраняем...';
                status.classList.remove('error', 'ok');
                button.disabled = true;
                try {
                    const resp = await fetch(`${API_BASE_URL}/channels/${encodeURIComponent(channelId)}/link`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Telegram-Init-Data': initData,
                        },
                        body: JSON.stringify({ url: nextUrl }),
                    });

                    if (!resp.ok) {
                        const errText = await resp.text();
                        throw new Error(errText || 'Не удалось сохранить ссылку.');
                    }

                    status.textContent = 'Ссылка обновлена.';
                    status.classList.add('ok');
                    status.classList.remove('error');
                } catch (error) {
                    status.textContent = 'Ошибка: ' + (error?.message || 'неизвестно');
                    status.classList.add('error');
                    status.classList.remove('ok');
                } finally {
                    button.disabled = false;
                }
            });

            card.querySelectorAll('.manager-link-item').forEach((linkItem) => {
                const linkId = linkItem.getAttribute('data-link-id') || '';
                const linkInput = linkItem.querySelector('.manager-input-compact');
                const linkButton = linkItem.querySelector('.manager-link-save-btn');
                const linkStatus = linkItem.querySelector('.manager-link-status');

                if (!linkInput || !linkButton || !linkStatus) {
                    return;
                }

                linkButton.addEventListener('click', async () => {
                    const nextRedirect = String(linkInput.value || '').trim();
                    if (!isAllowedRedirectUrl(nextRedirect)) {
                        linkStatus.textContent = 'Разрешены только https://max.ru/* или пустое значение.';
                        linkStatus.classList.add('error');
                        linkStatus.classList.remove('ok');
                        return;
                    }

                    const initData = webApp?.initData || '';
                    if (!initData) {
                        linkStatus.textContent = 'Нет initData для авторизации в Mini App.';
                        linkStatus.classList.add('error');
                        linkStatus.classList.remove('ok');
                        return;
                    }

                    linkStatus.textContent = 'Сохраняем redirect...';
                    linkStatus.classList.remove('error', 'ok');
                    linkButton.disabled = true;
                    try {
                        const resp = await fetch(`${API_BASE_URL}/links/${encodeURIComponent(linkId)}/redirect`, {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Telegram-Init-Data': initData,
                            },
                            body: JSON.stringify({ url: nextRedirect }),
                        });

                        if (!resp.ok) {
                            const errText = await resp.text();
                            throw new Error(errText || 'Не удалось сохранить redirect.');
                        }

                        linkStatus.textContent = nextRedirect
                            ? 'Redirect обновлён.'
                            : 'Redirect очищен, используется ссылка канала.';
                        linkStatus.classList.add('ok');
                        linkStatus.classList.remove('error');
                    } catch (error) {
                        linkStatus.textContent = 'Ошибка: ' + (error?.message || 'неизвестно');
                        linkStatus.classList.add('error');
                        linkStatus.classList.remove('ok');
                    } finally {
                        linkButton.disabled = false;
                    }
                });
            });
        });
    }

    async function loadAdminLinksManager() {
        const initData = webApp?.initData || '';
        if (!initData) {
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/my-links`, {
                method: 'GET',
                headers: {
                    'X-Telegram-Init-Data': initData,
                },
            });
            if (!res.ok) {
                return;
            }

            const data = await res.json();
            showLinksManager(data?.data?.channels || []);
        } catch (error) {
            console.error('Ошибка загрузки панели ссылок:', error);
        }
    }

    // Логика перенаправления
    let targetChannel = null; // Будет загружено динамически

    // Начинаем асинхронную загрузку ссылки или дашборда
    if (startParam && startParam.startsWith('links_')) {
        // Режим дашборда — извлекаем чистый хэш (links_ + 16 hex)
        const linksHash = (startParam.match(/^(links_[a-f0-9]{16})/i) || [])[1] || startParam;
        document.querySelector('.info-section').style.display = 'none';
        document.getElementById('greeting').textContent = 'Статистика';
        document.getElementById('username').textContent = 'Загрузка данных...';

        fetch(`${API_BASE_URL}/links/${linksHash}`)
            .then(res => {
                if (!res.ok) throw new Error("Dashboard not found or token expired");
                return res.json();
            })
            .then(data => {
                document.getElementById('username').textContent = 'Доступ разрешен';
                const dashboard = document.getElementById('linksDashboard');
                const container = document.getElementById('linksContainer');
                dashboard.style.display = 'flex'; // info-section display is flex by default in css usually or block

                const links = data.data.links;
                if (!links || links.length === 0) {
                    container.innerHTML = '<div class="info-item"><span class="val" style="text-align:center; width: 100%;">Нет активных ссылок</span></div>';
                } else {
                    container.innerHTML = links.map(l => `
                        <div class="info-item" style="flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px;">
                            <strong style="color: var(--accent); font-size: 16px;">${l.name}</strong>
                            <div style="font-size: 12px; color: var(--text-muted); font-family: monospace; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 6px; width: 100%; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis;">startapp: https://max.ru/id1655460755_bot?startapp=${l.startapp_hash}</div>
                            <div style="display: flex; gap: 10px; margin-top: 4px;">
                                <span style="background: rgba(129, 140, 248, 0.15); padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: 600;">🖱 ${l.clicks || 0}</span>
                                <span style="background: rgba(52, 211, 153, 0.15); padding: 4px 10px; border-radius: 12px; font-size: 13px; font-weight: 600; color: #34d399;">👥 ${l.subscriptions || 0}</span>
                            </div>
                        </div>
                    `).join('');
                }
            })
            .catch(err => {
                console.error("Ошибка дашборда:", err);
                document.getElementById('greeting').textContent = "Ошибка доступа";
                document.getElementById('username').textContent = "Ссылка устарела или неверна";
            });
    } else if (startParam && startParam.startsWith('stats_')) {
        // Режим статистики — извлекаем чистый хэш (stats_ + 16 hex)
        const statsHash = (startParam.match(/^(stats_[a-f0-9]{16})/i) || [])[1] || startParam;
        document.querySelector('.info-section').style.display = 'none';
        document.getElementById('greeting').textContent = 'Аналитика канала';
        document.getElementById('username').textContent = 'Загрузка данных...';

        fetch(`${API_BASE_URL}/stats/${statsHash}`)
            .then(res => {
                if (!res.ok) throw new Error("Stats not found or token expired");
                return res.json();
            })
            .then(data => {
                document.getElementById('username').textContent = 'Доступ разрешен';
                const dashboard = document.getElementById('linksDashboard');
                const container = document.getElementById('linksContainer');
                dashboard.style.display = 'block';

                const report = data.data.report;
                if (!report || report.length === 0) {
                    container.innerHTML = '<div class="info-item"><span class="val" style="text-align:center; width: 100%;">Нет данных для отчета</span></div>';
                } else {
                    // Функция форматирования интервала PostgreSQL
                    function fmtInterval(val) {
                        if (!val) return '-';
                        // PostgreSQL interval comes as object or string like "1 day 02:30:00"
                        if (typeof val === 'object' && val !== null) {
                            const d = val.days || 0;
                            const h = val.hours || 0;
                            const m = val.minutes || 0;
                            const parts = [];
                            if (d > 0) parts.push(d + ' дн.');
                            if (h > 0) parts.push(h + ' ч.');
                            if (m > 0) parts.push(m + ' мин.');
                            return parts.length > 0 ? parts.join(' ') : '0 сек.';
                        }
                        return String(val);
                    }

                    let html = '<div style="overflow-x: auto; width: 100%;"><table style="width: 100%; border-collapse: collapse; font-size: 12px; min-width: 700px;">';
                    html += '<thead><tr style="background: rgba(129, 140, 248, 0.15);">';
                    const headers = ['Период', 'Подп.', 'Отпис.', 'Актив.', 'Отписки %', 'Свежие отп.', 'Свежие %', 'Актив. (б/св)', 'LT', 'LT отпис.', 'LT отп. (б/св)'];
                    headers.forEach(h => { html += `<th style="padding: 6px 4px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); white-space: nowrap;">${h}</th>`; });
                    html += '</tr></thead><tbody>';

                    report.forEach(r => {
                        html += '<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">';
                        html += `<td style="padding: 5px 4px; text-align: center; white-space: nowrap;">${r.date}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center; color: #34d399; font-weight: 600;">${r.ev_new}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center; color: #f87171; font-weight: 600;">${r.ev_exit}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center; font-weight: 600;">${r.ev_active}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center;">${r.churn_rate}%</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center;">${r.exit_fresh}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center;">${r.churn_fresh}%</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center;">${r.active_no_fresh}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center; font-size: 11px;">${fmtInterval(r.lifetime_cohort)}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center; font-size: 11px;">${fmtInterval(r.lifetime_left)}</td>`;
                        html += `<td style="padding: 5px 4px; text-align: center; font-size: 11px;">${fmtInterval(r.lifetime_left_not_fresh)}</td>`;
                        html += '</tr>';
                    });

                    html += '</tbody></table></div>';
                    container.innerHTML = html;
                }
            })
            .catch(err => {
                console.error("Ошибка статистики:", err);
                document.getElementById('greeting').textContent = "Ошибка доступа";
                document.getElementById('username').textContent = "Ссылка устарела или неверна";
            });
    } else if (startParam && startParam !== "Не задан (пусто)") {
        const parsed = parseTrackerParam(startParam);
        const userId = Number(initDataUnsafe?.user?.id || 0);
        const isDebugUser = userId === DEBUG_USER_ID;
        const cookieValue = typeof document !== 'undefined' ? (document.cookie || '') : '';

        fetch(`${API_BASE_URL}/${encodeURIComponent(parsed.baseHash || startParam)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user: initDataUnsafe.user || null,
                yclid: parsed.yclid || null,
                cookie: cookieValue,
                raw_start_param: parsed.rawParam,
                debug_mode: isDebugUser
            })
        })
            .then(res => {
                if (!res.ok) throw new Error("Tracker link not found");
                return res.json();
            })
            .then(data => {
                targetChannel = data.url;
                if (isDebugUser) {
                    document.querySelector('.info-section').style.display = 'none';
                    document.getElementById('greeting').textContent = 'Debug: трекинг';
                    document.getElementById('username').textContent = 'Редирект отключен для тестового пользователя';
                    renderDebugInfo({
                        userId,
                        rawStartParam: parsed.rawParam,
                        baseHash: parsed.baseHash,
                        yclid: parsed.yclid,
                        cookie: cookieValue,
                        apiUrl: targetChannel,
                        redirectBlocked: true,
                        error: null,
                    });
                    return;
                }

                doRedirect();
            })
            .catch(err => {
                console.error("Ошибка получения ссылки:", err);
                if (isDebugUser) {
                    document.querySelector('.info-section').style.display = 'none';
                    document.getElementById('greeting').textContent = 'Debug: ошибка трекинга';
                    document.getElementById('username').textContent = 'Редирект отключен для тестового пользователя';
                    renderDebugInfo({
                        userId,
                        rawStartParam: parsed.rawParam,
                        baseHash: parsed.baseHash,
                        yclid: parsed.yclid,
                        cookie: cookieValue,
                        apiUrl: null,
                        redirectBlocked: true,
                        error: err.message || 'Unknown error',
                    });
                    return;
                }

                // Фолбэк канал, если API недоступно или код неверен
                targetChannel = "https://max.ru/max_ru";
                doRedirect();
            });
    } else {
        // Нет startapp параметра — показываем info пользователя + функционал бота
        document.querySelector('.info-section').style.display = 'flex';
        const infoSection = document.querySelector('.info-section');
        loadAdminLinksManager();

        const featuresBlock = document.createElement('div');
        featuresBlock.className = 'info-item';
        featuresBlock.innerHTML = `
            <span class="label">Возможности бота</span>
            <span class="val" style="font-size: 0.95rem; line-height: 1.6;">
                — Отслеживание подписок и отписок канала<br>
                — Создание трекинговых ссылок для рекламных кампаний<br>
                — Детальная статистика и аналитика канала<br>
                — Выгрузка отчётов в Excel<br>
                — Управление доступом к боту для команды
            </span>
        `;
        infoSection.appendChild(featuresBlock);

        const startBlock = document.createElement('div');
        startBlock.className = 'info-item highlight';
        startBlock.innerHTML = `
            <span class="label">Начать работу</span>
            <span class="val" style="font-size: 0.95rem; line-height: 1.6;">
                Напишите боту любое сообщение, чтобы открыть главное меню.
            </span>
        `;
        infoSection.appendChild(startBlock);
    }

    // Функция редиректа
    function doRedirect() {
        if (!targetChannel) return; // Защита

        // Внутри MAX — используем нативный метод
        if (webApp && typeof webApp.openMaxLink === 'function') {
            webApp.openMaxLink(targetChannel);
        }
        // Надёжный фолбэк (браузер / GitHub Pages preview)
        window.location.href = targetChannel;
    }

    // Тактильный отклик при загрузке
    if (webApp?.HapticFeedback) {
        try { webApp.HapticFeedback.notificationOccurred('success'); } catch (e) { }
    }

});
