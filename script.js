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
    const elCountdown = document.getElementById('countdown');
    const elProgressFill = document.getElementById('progressFill');
    const elJsonPayload = document.getElementById('jsonPayload');

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

    // Логика перенаправления
    const TOTAL_SECONDS = 10;
    let timeLeft = TOTAL_SECONDS;
    let targetChannel = null; // Будет загружено динамически
    let fetchCompleted = false;
    let fetchFailed = false;

    // Начинаем асинхронную загрузку ссылки
    if (startParam && startParam !== "Не задан (пусто)") {
        const payloadObj = { user: initDataUnsafe.user || null };
        if (elJsonPayload) {
            elJsonPayload.textContent = JSON.stringify(payloadObj, null, 2);
        }

        fetch(`https://g-ads.pro/api/plug/tracker/${startParam}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadObj)
        })
            .then(res => {
                if (!res.ok) throw new Error("Tracker link not found");
                return res.json();
            })
            .then(data => {
                targetChannel = data.url;
                fetchCompleted = true;
                checkAndRedirect(); // Пробуем редирект, если время уже вышло
            })
            .catch(err => {
                console.error("Ошибка получения ссылки:", err);
                fetchFailed = true;
                // Фолбэк канал, если API недоступно или код неверен
                targetChannel = "https://max.ru/max_ru";
                fetchCompleted = true;
                checkAndRedirect();
            });
    } else {
        // Если параметра нет, сразу считаем загруженным (фолбэк)
        targetChannel = "https://max.ru/max_ru";
        fetchCompleted = true;
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

    // Проверяем возможность редиректа (таймер + данные)
    function checkAndRedirect() {
        if (timeLeft <= 0 && fetchCompleted) {
            doRedirect();
        }
    }

    // Тактильный отклик при загрузке
    if (webApp?.HapticFeedback) {
        try { webApp.HapticFeedback.notificationOccurred('success'); } catch (e) { }
    }

    // Прогресс-бар: сразу выставляем 100% без анимации, затем включаем transition
    elProgressFill.style.transition = 'none';
    elProgressFill.style.width = '100%';
    // Небольшой таймаут, чтобы браузер применил начальное значение до старта анимации
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            elProgressFill.style.transition = `width ${TOTAL_SECONDS}s linear`;
            elProgressFill.style.width = '0%';
        });
    });

    // Счётчик — обновляем каждую секунду
    const timer = setInterval(() => {
        timeLeft -= 1;
        elCountdown.textContent = timeLeft;

        // Тактильный фидбэк на каждый тик
        if (webApp?.HapticFeedback) {
            try { webApp.HapticFeedback.impactOccurred('light'); } catch (e) { }
        }

        if (timeLeft <= 0) {
            clearInterval(timer);
            checkAndRedirect();
        }
    }, 1000);
});
