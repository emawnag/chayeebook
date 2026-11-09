/**
 * 國語詞語練習單 - 動態資料與萌典注音載入器
 * Data loader and MoeDict Zhuyin fetcher using jQuery
 */

(function ($) {
    'use strict';

    // 預設資料 (供離線或直接以 file:// 開啟時作為備援)
    const DEFAULT_DATA = {
        title: "國語詞語練習單",
        page: 20,
        words: [
            {
                word: "光輝",
                definition: "光芒、光彩。",
                sentence: "聽聞專家的指導後，他的眼神充滿希望的光輝。"
            },
            {
                word: "恢復",
                definition: "回復到原來的樣子。",
                sentence: "請大家等一下留下來善後，一起恢復場地。"
            },
            {
                word: "尷尬",
                definition: "不好意思、難為情。",
                sentence: "面對難以回答的問題，他只好尷尬的笑了一下，思考如何回應。"
            },
            {
                word: "驕傲",
                definition: "傲慢自大。",
                sentence: "聰明的他因為性格過於驕傲，總是交不到朋友。"
            },
            {
                word: "慈愛",
                definition: "仁慈且富有愛心。多指長輩對晚輩的愛而言。",
                sentence: "母親呵護初生的嬰兒，慈愛的眼神充滿光芒。"
            },
            {
                word: "震撼",
                definition: "震動搖撼。",
                sentence: "這次國際展覽會的內容豐富又多元，讓我大為震撼。"
            }
        ]
    };

    // 注音快取與請求中 Promise，避免重複呼叫萌典 API
    const zhuyinCache = {};
    const pendingRequests = {};

    /**
     * 更新操作列狀態
     * @param {string} text - 顯示文字
     * @param {'pending'|'ready'|'error'} state - 狀態樣式
     */
    function updateStatus(text, state = 'pending') {
        const $dot = $('#status-dot');
        const $text = $('#status-text');
        
        $text.text(text);
        $dot.removeClass('ready error');
        if (state === 'ready') {
            $dot.addClass('ready');
        } else if (state === 'error') {
            $dot.addClass('error');
        }
    }

    /**
     * 從萌典 (https://www.moedict.tw/) 查詢單一字的注音
     * @param {string} char - 單個國字
     * @returns {Promise<string>}
     */
    function fetchSingleCharZhuyin(char) {
        if (!char) return Promise.resolve('');
        if (zhuyinCache[char]) {
            return Promise.resolve(zhuyinCache[char]);
        }
        if (pendingRequests[char]) {
            return pendingRequests[char];
        }

        const url = `https://www.moedict.tw/a/${encodeURIComponent(char)}.json`;
        const promise = new Promise((resolve) => {
            $.ajax({
                url: url,
                dataType: 'json',
                method: 'GET',
                timeout: 5000
            }).done((data) => {
                const b = data?.h?.[0]?.b || '';
                // 去除可能存在的補充註記括號並取第一音
                const cleanB = b.replace(/（[^）]*）|\([^)]*\)/g, '').trim();
                const zhuyin = cleanB.split(/\s+/)[0] || '';
                zhuyinCache[char] = zhuyin;
                resolve(zhuyin);
            }).fail(() => {
                resolve('');
            });
        }).finally(() => {
            delete pendingRequests[char];
        });

        pendingRequests[char] = promise;
        return promise;
    }

    /**
     * 從萌典 (https://www.moedict.tw/) 查詢詞語注音
     * 若複詞存在則優先取得正確詞語讀音；若不存在則退回單字逐一查詢
     * @param {string} word - 詞語 (例如 "光輝")
     * @returns {Promise<string[]>}
     */
    function fetchWordZhuyin(word) {
        if (!word) return Promise.resolve([]);
        if (zhuyinCache[word]) {
            return Promise.resolve(zhuyinCache[word]);
        }
        if (pendingRequests[word]) {
            return pendingRequests[word];
        }

        const chars = Array.from(word);
        const url = `https://www.moedict.tw/a/${encodeURIComponent(word)}.json`;

        const promise = new Promise((resolve) => {
            $.ajax({
                url: url,
                dataType: 'json',
                method: 'GET',
                timeout: 5000
            }).done((data) => {
                const b = data?.h?.[0]?.b || '';
                const cleanB = b.replace(/（[^）]*）|\([^)]*\)/g, '').trim();
                const list = cleanB ? cleanB.split(/\s+/).filter(Boolean) : [];

                if (list.length === chars.length) {
                    zhuyinCache[word] = list;
                    list.forEach((z, idx) => {
                        zhuyinCache[chars[idx]] = zhuyinCache[chars[idx]] || z;
                    });
                    return resolve(list);
                }

                // 長度不符時逐字查詢
                fallbackChars();
            }).fail(() => {
                // 找不到複詞時逐字查詢
                fallbackChars();
            });

            function fallbackChars() {
                const promises = chars.map((ch) => fetchSingleCharZhuyin(ch));
                Promise.all(promises).then((results) => {
                    zhuyinCache[word] = results;
                    resolve(results);
                });
            }
        }).finally(() => {
            delete pendingRequests[word];
        });

        pendingRequests[word] = promise;
        return promise;
    }

    /**
     * 建立單一直行 (Column) 的 DOM 元素
     * @param {Object} item - 詞語資料物件 { word, definition, sentence }
     * @returns {jQuery}
     */
    function createWordColumn(item) {
        const $col = $('<div class="word-col"></div>');

        // 1. 訂正格 (1 格)
        $col.append('<div class="row"><div class="cell-char"></div><div class="cell-zhuyin"></div></div>');

        const chars = item && item.word ? Array.from(item.word) : [];
        const TOTAL_PRACTICE_ROWS = 8; // 語詞練習區固定 8 列，對齊右側「語詞練習」

        // 2. 示範字 (每字 1 列)
        chars.forEach((char) => {
            const $row = $('<div class="row"></div>');
            const $cellChar = $('<div class="cell-char"></div>');
            const $cellZhuyin = $('<div class="cell-zhuyin"></div>');

            $cellChar.append($('<span class="char"></span>').text(char));
            $cellZhuyin.append($('<span class="zhuyin loading"></span>').attr('data-char', char));

            $row.append($cellChar).append($cellZhuyin);
            $col.append($row);
        });

        // 3. 練習格 (剩餘列數填空白十字格)
        const emptyRowsCount = Math.max(0, TOTAL_PRACTICE_ROWS - chars.length);
        for (let i = 0; i < emptyRowsCount; i++) {
            $col.append('<div class="row"><div class="cell-char"></div><div class="cell-zhuyin"></div></div>');
        }

        // 4. 下方解釋與造句
        const $explanation = $('<div class="explanation"></div>');
        if (item) {
            if (item.definition) {
                const $pDef = $('<p></p>');
                $pDef.append('<span class="badge badge-purple">釋</span>');
                $pDef.append(document.createTextNode(item.definition));
                $explanation.append($pDef);
            }
            if (item.sentence) {
                const $pSen = $('<p></p>');
                $pSen.append('<span class="badge badge-pink">句</span>');
                $pSen.append(document.createTextNode(item.sentence));
                $explanation.append($pSen);
            }
        }
        $col.append($explanation);

        // 非同步向萌典查詢注音並動態填入
        if (item && item.word) {
            fetchWordZhuyin(item.word).then((zhuyinList) => {
                $col.find('.zhuyin').each(function (idx) {
                    const zhuyin = zhuyinList[idx] || '';
                    $(this).text(zhuyin).removeClass('loading');
                });
            });
        }

        return $col;
    }

    /**
     * 渲染單一練習頁 (每頁標準 6 欄)
     * @param {Array} words - 該頁的詞語陣列
     * @param {number|string} pageNum - 頁碼
     * @returns {jQuery}
     */
    function renderPage(words, pageNum) {
        const $pageContainer = $('<div class="page-container"></div>');
        const $worksheet = $('<div class="worksheet"></div>');

        // 標準每頁 6 個直欄
        const WORDS_PER_PAGE = 6;
        for (let i = 0; i < WORDS_PER_PAGE; i++) {
            const item = words[i] || null;
            $worksheet.append(createWordColumn(item));
        }

        // 右側側邊欄 (訂正、語詞練習、解釋)
        const $sidebar = $(`
            <div class="sidebar">
                <div class="sb-section sb-dingzheng">訂正</div>
                <div class="sb-section sb-yuchi">語詞練習</div>
                <div class="sb-section sb-jieshi">解釋</div>
            </div>
        `);
        $worksheet.append($sidebar);
        $pageContainer.append($worksheet);

        // 頁尾頁碼
        const $footer = $(`
            <div class="footer">
                <div class="page-num">${pageNum}</div>
                <div class="page-bar"></div>
            </div>
        `);
        $pageContainer.append($footer);

        return $pageContainer;
    }

    /**
     * 載入並渲染完整資料
     * @param {Object|Array} data - JSON 資料
     */
    function renderWorksheets(data) {
        const $container = $('#worksheet-container');
        $container.empty();

        const wordsList = Array.isArray(data) ? data : (data.words || []);
        const basePage = (!Array.isArray(data) && data.page) ? Number(data.page) : 20;

        if (data.title) {
            document.title = data.title;
        }

        // 若無資料時使用預設範例
        const safeWords = wordsList.length > 0 ? wordsList : DEFAULT_DATA.words;

        // 每 6 個詞分為一頁
        const WORDS_PER_PAGE = 6;
        const totalPages = Math.ceil(safeWords.length / WORDS_PER_PAGE);

        for (let p = 0; p < totalPages; p++) {
            const pageWords = safeWords.slice(p * WORDS_PER_PAGE, (p + 1) * WORDS_PER_PAGE);
            const currentPageNum = basePage + p;
            const $page = renderPage(pageWords, currentPageNum);
            $container.append($page);
        }

        // 等待所有注音載入完成後更新操作列狀態
        const allWords = safeWords.map((item) => item.word);
        Promise.all(allWords.map((w) => fetchWordZhuyin(w)))
            .then(() => {
                updateStatus('詞語與萌典注音載入完成', 'ready');
            })
            .catch(() => {
                updateStatus('詞語載入完成 (部分注音載入可能不完整)', 'ready');
            });
    }

    /**
     * 動態載入 JSON 資料 (支援 data/zhtw.json 與根目錄 zhtw.json)
     */
    function loadData() {
        updateStatus('正在載入詞語資料 (zhtw.json)...', 'pending');

        $.ajax({
            url: 'data/zhtw.json',
            dataType: 'json',
            method: 'GET'
        }).done((data) => {
            renderWorksheets(data);
        }).fail(() => {
            // 嘗試載入根目錄 zhtw.json
            $.ajax({
                url: 'zhtw.json',
                dataType: 'json',
                method: 'GET'
            }).done((data) => {
                renderWorksheets(data);
            }).fail((xhr, status, error) => {
                console.warn('無法非同步載入 JSON (可能為本機 file:// 模式限制)，使用內建預設資料：', error);
                renderWorksheets(DEFAULT_DATA);
            });
        });
    }

    // 初始化綁定
    $(function () {
        $('#btn-print').on('click', function () {
            window.print();
        });

        $('#btn-reload').on('click', function () {
            loadData();
        });

        // 載入資料
        loadData();
    });

    // 匯出至全域以利除錯或外部呼叫
    window.chayeebook = {
        zhuyinCache,
        fetchWordZhuyin,
        loadData,
        renderWorksheets,
        DEFAULT_DATA
    };

})(jQuery);
