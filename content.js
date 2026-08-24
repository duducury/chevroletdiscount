(function () {
    "use strict";

    if (window.chevyBestDiscountRunning) return;
    window.chevyBestDiscountRunning = true;

    const API_PATH =
        "/chevrolet/shopping/api/aec-cp-discovery-api/p/v1/vehicles/search";

    let capturedRequest = null;
    let apiVehicles = [];
    let bestDiscountActive = false;
    let loadingInventory = false;
    let processTimer = null;
    let reorderBusy = false;
    let loadingAllCards = false;

    console.log("🔥 Chevy Best Discount 11.0 iniciado");


    // =========================================================
    // PAGE BRIDGE
    // =========================================================

    function injectPageBridge() {

        if (
            document.getElementById(
                "chevy-best-discount-page-bridge"
            )
        ) {
            return;
        }

        const script =
            document.createElement("script");

        script.id =
            "chevy-best-discount-page-bridge";

        script.src =
            chrome.runtime.getURL(
                "page-bridge.js"
            );

        script.onload =
            () => script.remove();

        (
            document.head ||
            document.documentElement
        ).appendChild(script);
    }

    injectPageBridge();


    // =========================================================
    // STATUS
    // =========================================================

    function updateStatus(text) {

        let el =
            document.getElementById(
                "chevy-best-discount-status"
            );

        if (!el) {

            el =
                document.createElement(
                    "div"
                );

            el.id =
                "chevy-best-discount-status";

            document.body.appendChild(
                el
            );
        }

        el.textContent =
            text;

        el.style.display =
            "block";
    }


    function hideStatus() {

        const el =
            document.getElementById(
                "chevy-best-discount-status"
            );

        if (el) {

            el.style.display =
                "none";
        }
    }


    function money(value) {

        return (
            "$" +
            Number(
                value || 0
            ).toLocaleString(
                "en-US",
                {
                    maximumFractionDigits: 0
                }
            )
        );
    }


    // =========================================================
    // CAPTURAR PAYLOAD DA CHEVROLET
    // =========================================================

    window.addEventListener(
        "message",
        function (event) {

            if (
                event.source !==
                window
            ) {
                return;
            }

            const data =
                event.data;

            if (
                !data ||
                data.source !==
                    "CHEVY_BEST_DISCOUNT_PAGE"
            ) {
                return;
            }

            let payload =
                null;

            if (
                data.type ===
                "SEARCH_CAPTURED"
            ) {

                payload =
                    data.body ||
                    null;
            }

            else if (
                data.type ===
                "CHEVY_SEARCH_PAYLOAD"
            ) {

                payload =
                    data.payload ||
                    null;
            }


            if (
                payload &&
                payload.filters
            ) {

                capturedRequest = {
                    body:
                        payload
                };

                console.log(
                    "🎯 Payload REAL da Chevrolet capturado"
                );

                updateStatus(
                    "✅ Chevrolet API capturada"
                );

                setTimeout(
                    hideStatus,
                    1000
                );


                // Busca automaticamente os carros
                // depois que a API original foi capturada.

                setTimeout(
                    function () {

                        if (
                            !loadingInventory &&
                            !apiVehicles.length
                        ) {

                            fetchAllVehicles()
                                .then(
                                    function () {

                                        renderCards();

                                        if (
                                            bestDiscountActive
                                        ) {

                                            reorderVisibleCards();
                                        }
                                    }
                                )
                                .catch(
                                    function (error) {

                                        console.error(
                                            "❌ Erro buscando API:",
                                            error
                                        );
                                    }
                                );
                        }

                    },
                    300
                );
            }
        }
    );


    // =========================================================
    // REQUEST PAGE
    // =========================================================

    function requestPage(body) {

        return new Promise(
            function (
                resolve,
                reject
            ) {

                const requestId =
                    "chevy_" +
                    Date.now() +
                    "_" +
                    Math.random()
                        .toString(36)
                        .slice(2);

                let finished =
                    false;


                function cleanup() {

                    window.removeEventListener(
                        "message",
                        handler
                    );
                }


                function handler(event) {

                    if (
                        event.source !==
                        window
                    ) {
                        return;
                    }

                    const data =
                        event.data;

                    if (
                        !data ||
                        data.source !==
                            "CHEVY_BEST_DISCOUNT_PAGE"
                    ) {
                        return;
                    }

                    if (
                        data.requestId !==
                        requestId
                    ) {
                        return;
                    }


                    if (
                        data.type ===
                        "PAGE_RESPONSE"
                    ) {

                        if (
                            finished
                        ) {
                            return;
                        }

                        finished =
                            true;

                        cleanup();

                        resolve(
                            data.data
                        );

                        return;
                    }


                    if (
                        data.type ===
                        "PAGE_ERROR"
                    ) {

                        if (
                            finished
                        ) {
                            return;
                        }

                        finished =
                            true;

                        cleanup();

                        reject(
                            new Error(
                                data.error ||
                                "API error"
                            )
                        );
                    }
                }


                window.addEventListener(
                    "message",
                    handler
                );


                window.postMessage(
                    {
                        source:
                            "CHEVY_BEST_DISCOUNT_CONTENT",

                        type:
                            "REQUEST_PAGE",

                        requestId:
                            requestId,

                        body:
                            body
                    },
                    "*"
                );


                setTimeout(
                    function () {

                        if (
                            finished
                        ) {
                            return;
                        }

                        finished =
                            true;

                        cleanup();

                        reject(
                            new Error(
                                "Timeout aguardando resposta da API."
                            )
                        );

                    },
                    30000
                );
            }
        );
    }


    // =========================================================
    // BUSCAR TODOS OS VEÍCULOS
    // =========================================================

    async function fetchAllVehicles() {

        if (
            loadingInventory
        ) {

            return apiVehicles;
        }


        if (
            !capturedRequest ||
            !capturedRequest.body
        ) {

            throw new Error(
                "Ainda não capturei a busca da Chevrolet. Recarregue a página e aguarde o inventário carregar."
            );
        }


        loadingInventory =
            true;

        apiVehicles =
            [];


        try {

            const map =
                new Map();

            let nextPageToken =
                null;

            let page =
                1;


            while (true) {

                updateStatus(
                    `🔄 Buscando inventário... Página ${page}`
                );


                const body =
                    JSON.parse(
                        JSON.stringify(
                            capturedRequest.body
                        )
                    );


                body.pagination =
                    body.pagination ||
                    {};


                body.pagination.size =
                    100;


                if (
                    nextPageToken
                ) {

                    body.pagination.nextPageToken =
                        nextPageToken;

                }

                else {

                    delete
                        body.pagination.nextPageToken;
                }


                console.log(
                    "📡 API página:",
                    page
                );


                const response =
                    await requestPage(
                        body
                    );


                const vehicles =
                    (
                        response &&
                        response.data &&
                        Array.isArray(
                            response.data.hits
                        )
                    )
                        ? response.data.hits

                        : (
                            response &&
                            Array.isArray(
                                response.hits
                            )
                                ? response.hits

                                : (
                                    response &&
                                    response.data &&
                                    response.data.data &&
                                    Array.isArray(
                                        response.data.data.hits
                                    )
                                        ? response.data.data.hits
                                        : []
                                )
                        );


                console.log(
                    `📦 Página ${page}: ${vehicles.length} veículos`
                );


                vehicles.forEach(
                    function (
                        vehicle
                    ) {

                        const cash =
                            vehicle &&
                            vehicle.pricing &&
                            vehicle.pricing.cash;


                        if (
                            !vehicle ||
                            !vehicle.id ||
                            !cash
                        ) {

                            return;
                        }


                        const msrp =
                            Number(
                                cash.msrp &&
                                cash.msrp.value
                            );


                        const dealerPrice =
                            Number(
                                cash.dealerFeaturedPrice &&
                                cash.dealerFeaturedPrice.value
                            );


                        const netPrice =
                            Number(
                                cash.netPrice &&
                                cash.netPrice.value
                            );


                        if (
                            !Number.isFinite(
                                msrp
                            ) ||
                            msrp <= 0
                        ) {

                            return;
                        }


                        const finalPrice =
                            Number.isFinite(
                                dealerPrice
                            ) &&
                            dealerPrice > 0

                                ? dealerPrice

                                : (
                                    Number.isFinite(
                                        netPrice
                                    ) &&
                                    netPrice > 0

                                        ? netPrice
                                        : msrp
                                );


                        /*
                         * Veículos sem preço divulgado (a página
                         * mostra "Contact Dealer" no lugar do
                         * valor) às vezes vêm da API com um preço
                         * "placeholder" bem baixo (ex: $0, $1) em
                         * vez de ausente. Isso fazia o cálculo
                         * msrp - finalPrice parecer um desconto de
                         * quase 100%.
                         *
                         * Nenhum desconto real de concessionária
                         * chega perto disso, então qualquer "preço
                         * final" abaixo de $1.000 ou menor que 40%
                         * do MSRP é tratado como preço não
                         * divulgado — o veículo não entra no
                         * ranking de desconto nem recebe badge.
                         */

                        const looksLikeRealPrice =
                            Number.isFinite(
                                finalPrice
                            ) &&
                            finalPrice >= 1000 &&
                            (
                                finalPrice /
                                msrp
                            ) >= 0.4;


                        if (
                            !looksLikeRealPrice
                        ) {

                            return;
                        }


                        const discount =
                            msrp -
                            finalPrice;


                        const parsed = {

                            vin:
                                String(
                                    vehicle.id
                                ).toUpperCase(),

                            model:
                                vehicle.model ||
                                "",

                            year:
                                vehicle.year ||
                                "",

                            trim:
                                vehicle &&
                                vehicle.variant &&
                                vehicle.variant.name
                                    ? vehicle.variant.name
                                    : "",

                            msrp:
                                msrp,

                            price:
                                finalPrice,

                            discount:
                                discount,

                            discountPercent:
                                msrp > 0
                                    ? (
                                        discount /
                                        msrp
                                    ) *
                                      100
                                    : 0
                        };


                        map.set(
                            parsed.vin,
                            parsed
                        );

                    }
                );


                nextPageToken =
                    response &&
                    response.data &&
                    response.data.pagination &&
                    response.data.pagination.nextPageToken
                        ? response.data.pagination.nextPageToken
                        : null;


                if (
                    !nextPageToken
                ) {

                    break;
                }


                page++;


                if (
                    page > 500
                ) {

                    break;
                }

            }


            apiVehicles =
                Array.from(
                    map.values()
                );


            // Maior desconto primeiro

            apiVehicles.sort(
                function (
                    a,
                    b
                ) {

                    return (
                        b.discount -
                        a.discount
                    );
                }
            );


            console.log(
                `🔥 TOTAL: ${apiVehicles.length} veículos`
            );


            console.table(
                apiVehicles
                    .slice(
                        0,
                        50
                    )
                    .map(
                        function (
                            vehicle,
                            index
                        ) {

                            return {

                                Rank:
                                    index + 1,

                                VIN:
                                    vehicle.vin,

                                Model:
                                    vehicle.model,

                                Trim:
                                    vehicle.trim,

                                MSRP:
                                    vehicle.msrp,

                                Price:
                                    vehicle.price,

                                Discount:
                                    vehicle.discount,

                                Percent:
                                    vehicle.discountPercent.toFixed(
                                        2
                                    ) +
                                    "%"
                            };
                        }
                    )
            );


            hideStatus();


            return apiVehicles;

        }

        finally {

            loadingInventory =
                false;
        }
    }


    // =========================================================
    // CARREGAR TODOS OS CARDS NA PÁGINA (INFINITE SCROLL / "LOAD MORE")
    // =========================================================

    /*
     * A API já traz TODOS os veículos (fetchAllVehicles), mas a
     * Chevrolet só renderiza um lote por vez no DOM (ex: 20 cards)
     * e só carrega mais quando o usuário rola a página ou clica em
     * "Load More". Sem isso, reorderVisibleCards() só enxerga os
     * cards que já estão na tela.
     *
     * Esta função automatiza esse carregamento: clica em qualquer
     * botão de "carregar mais" que encontrar, ou rola a página até
     * o fim para disparar infinite scroll, repetindo até o número
     * de cards no DOM bater com o total da API (ou parar de crescer).
     */

    function wait(ms) {

        return new Promise(
            function (resolve) {

                setTimeout(
                    resolve,
                    ms
                );
            }
        );
    }


    function findLoadMoreControl() {

        const elements =
            Array.from(
                document.querySelectorAll(
                    "button, a, [role=\"button\"]"
                )
            );


        return (
            elements.find(
                function (
                    element
                ) {

                    const text =
                        (
                            element.innerText ||
                            ""
                        )
                            .trim()
                            .toLowerCase();


                    if (!text) {

                        return false;
                    }


                    const looksLikeLoadMore =
                        /^(load|show|view|see)\s+more(\s+(vehicles|cars|results|listings|inventory))?$/.test(
                            text
                        );


                    if (
                        !looksLikeLoadMore
                    ) {

                        return false;
                    }


                    if (
                        element.disabled
                    ) {

                        return false;
                    }


                    const rect =
                        element.getBoundingClientRect();


                    return (
                        rect.width > 0 &&
                        rect.height > 0
                    );
                }
            ) ||
            null
        );
    }


    async function loadAllVisibleCards() {

        if (
            loadingAllCards
        ) {

            return;
        }


        loadingAllCards =
            true;


        try {

            const target =
                apiVehicles.length ||
                null;

            let stableRounds =
                0;

            let lastCount =
                findVehiclesInDOM().length;


            for (
                let round = 0;
                round < 300;
                round++
            ) {

                if (
                    target &&
                    lastCount >= target
                ) {

                    break;
                }


                updateStatus(
                    target
                        ? `🔄 Carregando veículos... (${lastCount}/${target})`
                        : `🔄 Carregando veículos... (${lastCount})`
                );


                const loadMoreButton =
                    findLoadMoreControl();


                if (
                    loadMoreButton
                ) {

                    loadMoreButton.click();

                }

                else {

                    window.scrollTo(
                        0,
                        document.body.scrollHeight
                    );

                }


                await wait(
                    700
                );


                const currentCount =
                    findVehiclesInDOM().length;


                if (
                    currentCount >
                    lastCount
                ) {

                    lastCount =
                        currentCount;

                    stableRounds =
                        0;

                }

                else {

                    stableRounds++;


                    if (
                        stableRounds >= 5
                    ) {

                        break;
                    }
                }
            }


            console.log(
                `📚 Cards carregados no DOM: ${lastCount}` +
                (
                    target
                        ? ` / ${target}`
                        : ""
                )
            );


            window.scrollTo(
                0,
                0
            );


            await wait(
                300
            );

        }

        finally {

            loadingAllCards =
                false;
        }
    }


    // =========================================================
    // LÓGICA DO SEU CÓDIGO ANTIGO
    // =========================================================

    function getVIN(text) {

        const match =
            String(
                text || ""
            ).match(
                /VIN:\s*([A-Z0-9]+)/i
            );


        return match
            ? match[1].toUpperCase()
            : null;
    }


    function findRealCard(element) {

        let current =
            element;


        const candidates =
            [];


        for (
            let i = 0;
            i < 12 &&
            current;
            i++
        ) {

            const text =
                current.innerText ||
                "";


            const rect =
                current.getBoundingClientRect();


            if (
                text.includes(
                    "MSRP:"
                ) &&

                text.includes(
                    "Dealer Price After Offers"
                ) &&

                /VIN:\s*[A-Z0-9]+/i.test(
                    text
                ) &&

                rect.width >= 250 &&
                rect.width <= 550 &&

                rect.height >= 300 &&
                rect.height <= 1000
            ) {

                candidates.push(
                    current
                );
            }


            current =
                current.parentElement;
        }


        candidates.sort(
            function (
                a,
                b
            ) {

                const aRect =
                    a.getBoundingClientRect();


                const bRect =
                    b.getBoundingClientRect();


                return (
                    (
                        aRect.width *
                        aRect.height
                    ) -

                    (
                        bRect.width *
                        bRect.height
                    )
                );
            }
        );


        return (
            candidates[0] ||
            null
        );
    }


    function findVehiclesInDOM() {

        const elements =
            Array.from(
                document.querySelectorAll(
                    "div"
                )
            );


        const vehicleMap =
            new Map();


        elements.forEach(
            function (
                element
            ) {

                const text =
                    element.innerText ||
                    "";


                if (
                    !text.includes(
                        "MSRP:"
                    )
                ) {

                    return;
                }


                if (
                    !text.includes(
                        "Dealer Price After Offers"
                    )
                ) {

                    return;
                }


                const vin =
                    getVIN(
                        text
                    );


                if (!vin) {
                    return;
                }


                if (
                    vehicleMap.has(
                        vin
                    )
                ) {

                    return;
                }


                const card =
                    findRealCard(
                        element
                    );


                if (!card) {

                    return;
                }


                vehicleMap.set(
                    vin,
                    {
                        vin:
                            vin,

                        card:
                            card
                    }
                );

            }
        );


        return Array.from(
            vehicleMap.values()
        );
    }


    // =========================================================
    // BADGE
    // =========================================================

    function removeBadges() {

        document
            .querySelectorAll(
                ".chevy-discount-overlay"
            )
            .forEach(
                function (
                    badge
                ) {

                    badge.remove();
                }
            );
    }


    function addDiscountBadge(
        item
    ) {

        const apiVehicle =
            apiVehicles.find(
                function (
                    vehicle
                ) {

                    return (
                        vehicle.vin ===
                        item.vin
                    );
                }
            );


        if (
            !apiVehicle
        ) {

            return;
        }


        const card =
            item.card;


        card
            .querySelectorAll(
                ".chevy-discount-overlay"
            )
            .forEach(
                function (
                    badge
                ) {

                    badge.remove();
                }
            );


        /*
         * Segunda camada de proteção: se o card mostra
         * "Contact Dealer" (ou variações) no lugar do preço,
         * não mostra desconto nenhum, mesmo que os dados vindos
         * da API por algum motivo tenham passado no filtro de
         * fetchAllVehicles().
         */

        const cardText =
            (
                card.innerText ||
                ""
            ).toLowerCase();


        const priceNotDisclosed =
            cardText.includes(
                "contact dealer"
            ) ||

            cardText.includes(
                "call for price"
            ) ||

            cardText.includes(
                "contact us for price"
            );


        if (
            priceNotDisclosed
        ) {

            return;
        }


        const badge =
            document.createElement(
                "div"
            );


        badge.className =
            "chevy-discount-overlay";


        badge.dataset.chevyVin =
            item.vin;


        if (
            apiVehicle.discount > 0
        ) {

            badge.classList.add(
                "chevy-discount-positive"
            );


            badge.textContent =
                `🔥 ${money(
                    apiVehicle.discount
                )} OFF MSRP`;

        }

        else if (
            apiVehicle.discount < 0
        ) {

            badge.classList.add(
                "chevy-discount-negative"
            );


            badge.textContent =
                `⚠️ ${money(
                    Math.abs(
                        apiVehicle.discount
                    )
                )} OVER MSRP`;

        }

        else {

            badge.classList.add(
                "chevy-discount-zero"
            );


            badge.textContent =
                "MSRP PRICE";
        }


        /*
         * Insere como PRIMEIRO filho, no fluxo normal do
         * documento (sem position:absolute), para nunca
         * sobrepor botões/preço — só empurra o conteúdo do
         * próprio card levemente para baixo.
         */

        card.insertBefore(
            badge,
            card.firstChild
        );


        console.log(
            `🏷️ Desconto mostrado: ${item.vin} → ${money(
                apiVehicle.discount
            )}`
        );
    }


    // =========================================================
    // ENCONTRAR O NÓ REALMENTE ORDENÁVEL
    // =========================================================

    /*
     * findRealCard() retorna o menor elemento que contém o texto
     * do card (MSRP/VIN/etc). Esse elemento normalmente NÃO é
     * filho direto do container flex/grid da Chevrolet — ele fica
     * aninhado dentro de wrappers (imagem, CTA, badges...).
     *
     * Para mover o card de posição no DOM precisamos do ancestral
     * que É filho direto do container, senão parent.children nunca
     * vai encontrar o node (indexOf retorna -1) e a reordenação
     * falha silenciosamente.
     */

    /*
     * Sobe a árvore a partir do primeiro card até achar um
     * ancestral que (a) contenha TODOS os cards que vamos
     * reordenar e (b) seja um container flex/grid.
     *
     * Isso evita cair num wrapper interno errado (ex: uma linha
     * flex de preço+botão dentro de um único card), que satisfaria
     * o antigo teste de "display: flex" mas não é o container que
     * agrupa os cards da listagem.
     */

    function findCardsContainer(
        cards
    ) {

        if (
            !cards.length
        ) {

            return null;
        }


        let candidate =
            cards[0].parentElement;


        for (
            let i = 0;
            i < 10 &&
            candidate;
            i++
        ) {

            const containsAll =
                cards.every(
                    function (
                        card
                    ) {

                        return candidate.contains(
                            card
                        );
                    }
                );


            if (
                containsAll
            ) {

                const display =
                    window.getComputedStyle(
                        candidate
                    ).display;


                if (
                    display ===
                        "grid" ||

                    display ===
                        "flex" ||

                    display ===
                        "inline-flex"
                ) {

                    /*
                     * "containsAll" sozinho não basta: um
                     * ancestral muito acima na árvore (ex: o
                     * wrapper flex de todo o app, que contém o
                     * header, a busca E os cards) também contém
                     * todos os cards e pode ter display flex.
                     *
                     * Só aceitamos esse candidato se cada card
                     * resolver para um filho direto DIFERENTE
                     * dele — ou seja, se for mesmo o container
                     * que repete um item por card, não um wrapper
                     * genérico da página inteira.
                     */

                    const directChildren =
                        cards.map(
                            function (
                                card
                            ) {

                                return findSortableNode(
                                    card,
                                    candidate
                                );
                            }
                        );


                    const allResolved =
                        directChildren.every(
                            function (
                                node
                            ) {

                                return node !==
                                    null;
                            }
                        );


                    const allUnique =
                        allResolved &&
                        (
                            new Set(
                                directChildren
                            ).size ===
                            cards.length
                        );


                    if (
                        allUnique
                    ) {

                        return candidate;
                    }
                }
            }


            candidate =
                candidate.parentElement;
        }


        return null;
    }


    function findSortableNode(
        card,
        container
    ) {

        let node =
            card;


        for (
            let i = 0;
            i < 12 &&
            node &&
            node.parentElement;
            i++
        ) {

            if (
                node.parentElement ===
                container
            ) {

                return node;
            }

            node =
                node.parentElement;
        }


        return null;
    }


    // =========================================================
    // ORDENAR CARDS VISÍVEIS
    // =========================================================

    function reorderVisibleCards() {

        if (
            !bestDiscountActive ||
            reorderBusy ||
            loadingAllCards
        ) {

            return;
        }


        const vehicles =
            findVehiclesInDOM();


        if (
            vehicles.length < 2
        ) {

            return;
        }


        const sorted =
            vehicles
                .filter(
                    function (
                        item
                    ) {

                        return apiVehicles.some(
                            function (
                                apiVehicle
                            ) {

                                return (
                                    apiVehicle.vin ===
                                    item.vin
                                );
                            }
                        );
                    }
                )
                .sort(
                    function (
                        a,
                        b
                    ) {

                        const av =
                            apiVehicles.find(
                                function (
                                    vehicle
                                ) {

                                    return (
                                        vehicle.vin ===
                                        a.vin
                                    );
                                }
                            );


                        const bv =
                            apiVehicles.find(
                                function (
                                    vehicle
                                ) {

                                    return (
                                        vehicle.vin ===
                                        b.vin
                                    );
                                }
                            );


                        return (
                            (
                                bv
                                    ? bv.discount
                                    : 0
                            ) -

                            (
                                av
                                    ? av.discount
                                    : 0
                            )
                        );
                    }
                );


        if (
            sorted.length < 2
        ) {

            return;
        }


        const parent =
            findCardsContainer(
                sorted.map(
                    function (
                        item
                    ) {

                        return item.card;
                    }
                )
            );


        if (
            !parent
        ) {

            console.warn(
                "⚠️ Não encontrei o container comum dos cards. Reordenação abortada."
            );

            return;
        }


        const currentChildren =
            Array.from(
                parent.children
            );


        const sortedNodes =
            sorted
                .map(
                    function (
                        item
                    ) {

                        return findSortableNode(
                            item.card,
                            parent
                        );
                    }
                )
                .filter(
                    function (
                        node
                    ) {

                        return node !==
                            null;
                    }
                );


        if (
            sortedNodes.length < 2
        ) {

            console.warn(
                "⚠️ Não consegui mapear os cards para filhos diretos do container. Reordenação abortada."
            );

            return;
        }


        const cardPositions =
            sortedNodes.map(
                function (
                    node
                ) {

                    return currentChildren.indexOf(
                        node
                    );
                }
            );


        if (
            cardPositions.some(
                function (
                    position
                ) {

                    return position <
                        0;
                }
            )
        ) {

            console.warn(
                "⚠️ Algum nó ordenável não é filho direto do container. Reordenação abortada."
            );

            return;
        }


        const newChildren =
            [
                ...currentChildren
            ];


        const sortedCards =
            sortedNodes;


        const sortedPositions =
            [
                ...cardPositions
            ].sort(
                function (
                    a,
                    b
                ) {

                    return a - b;
                }
            );


        sortedPositions.forEach(
            function (
                position,
                index
            ) {

                newChildren[
                    position
                ] =
                    sortedCards[
                        index
                    ];
            }
        );


        let changed =
            false;


        for (
            let i = 0;
            i < newChildren.length;
            i++
        ) {

            if (
                newChildren[i] !==
                currentChildren[i]
            ) {

                changed =
                    true;

                break;
            }
        }


        if (
            !changed
        ) {

            return;
        }


        reorderBusy =
            true;


        try {

            const fragment =
                document.createDocumentFragment();


            newChildren.forEach(
                function (
                    child
                ) {

                    fragment.appendChild(
                        child
                    );
                }
            );


            parent.appendChild(
                fragment
            );


            console.log(
                "✅ CARROS REORDENADOS POR DESCONTO"
            );

        }

        catch (
            error
        ) {

            console.error(
                "❌ Erro ao reorganizar:",
                error
            );
        }


        setTimeout(
            function () {

                reorderBusy =
                    false;

            },
            500
        );
    }


    // =========================================================
    // RENDER
    // =========================================================

    function renderCards() {

        if (
            !apiVehicles.length
        ) {

            return;
        }


        const vehicles =
            findVehiclesInDOM();


        console.log(
            `🚗 ${vehicles.length} cards encontrados na página`
        );


        removeBadges();


        vehicles.forEach(
            function (
                vehicle
            ) {

                addDiscountBadge(
                    vehicle
                );
            }
        );


        if (
            bestDiscountActive
        ) {

            reorderVisibleCards();
        }
    }


    // =========================================================
    // SORT BY
    // =========================================================

    function createSortControl() {

        if (
            document.getElementById(
                "chevy-best-discount-sort"
            )
        ) {

            return;
        }


        const elements =
            Array.from(
                document.querySelectorAll(
                    "div, span, label"
                )
            );


        const sortLabel =
            elements.find(
                function (
                    element
                ) {

                    return (
                        (
                            element.innerText ||
                            ""
                        ).trim() ===
                        "Sort By"
                    );
                }
            );


        if (
            !sortLabel
        ) {

            return;
        }


        let container =
            sortLabel.parentElement;


        let foundContainer =
            null;


        for (
            let i = 0;
            i < 10 &&
            container;
            i++
        ) {

            const text =
                container.innerText ||
                "";


            const looksLikeSortBox =
                text.includes(
                    "Sort By"
                ) &&

                (
                    text.includes(
                        "Distance"
                    ) ||

                    text.includes(
                        "Price"
                    ) ||

                    text.includes(
                        "Best Match"
                    ) ||

                    text.includes(
                        "Low to High"
                    ) ||

                    text.includes(
                        "High to Low"
                    )
                );


            if (
                looksLikeSortBox
            ) {

                foundContainer =
                    container;

                break;
            }


            container =
                container.parentElement;
        }


        if (
            !foundContainer
        ) {

            return;
        }


        const wrapper =
            document.createElement(
                "div"
            );


        wrapper.id =
            "chevy-best-discount-sort";


        wrapper.innerHTML = `

            <div class="chevy-sort-title">
                Sort By
            </div>

            <select
                id="chevy-sort-select"
            >

                <option value="chevrolet">
                    Chevrolet Sort
                </option>

                <option value="discount">
                    🔥 Best Discount
                </option>

            </select>

        `;


        foundContainer.appendChild(
            wrapper
        );


        const select =
            document.getElementById(
                "chevy-sort-select"
            );


        if (
            !select
        ) {

            return;
        }


select.addEventListener(
    "change",
    async function () {

        if (
            this.value ===
            "discount"
        ) {

            console.log(
                "🔥 BEST DISCOUNT ATIVADO"
            );

            bestDiscountActive =
                true;

            updateStatus(
                "🔄 Organizando por maior desconto..."
            );

            try {

                /*
                 * Se ainda não temos os carros da API,
                 * busca todos primeiro.
                 */

                if (
                    !apiVehicles.length
                ) {

                    await fetchAllVehicles();
                }


                /*
                 * Espera a Chevrolet terminar de
                 * renderizar os cards atuais.
                 */

                await new Promise(
                    function (
                        resolve
                    ) {

                        setTimeout(
                            resolve,
                            1000
                        );

                    }
                );


                /*
                 * Carrega automaticamente todos os cards
                 * (clica em "Load More" / rola a página) até
                 * o DOM ter todos os veículos que a API retornou,
                 * para não precisar o usuário paginar manualmente.
                 */

                await loadAllVisibleCards();


                /*
                 * Adiciona/atualiza os descontos
                 * nos cards atuais.
                 */

                renderCards();


                /*
                 * Espera mais um pouco porque a Chevrolet
                 * pode reconstruir os cards depois do primeiro
                 * render.
                 */

                await new Promise(
                    function (
                        resolve
                    ) {

                        setTimeout(
                            resolve,
                            500
                        );

                    }
                );


                /*
                 * Agora reorganiza.
                 */

                reorderVisibleCards();


                hideStatus();


                console.log(
                    "✅ Best Discount aplicado"
                );

            }

            catch (
                error
            ) {

                hideStatus();

                console.error(
                    "❌ Erro no Best Discount:",
                    error
                );

            }

        }

        else {

            console.log(
                "↩️ Chevrolet Sort"
            );

            bestDiscountActive =
                false;

            location.reload();
        }

    }
);


        console.log(
            "✅ Best Discount instalado no Sort By"
        );
    }


    // =========================================================
    // CSS
    // =========================================================

    function installCSS() {

        if (
            document.getElementById(
                "chevy-best-discount-css"
            )
        ) {

            return;
        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            "chevy-best-discount-css";


        style.textContent = `

            /* =================================================
               DISCOUNT BADGE
            ================================================= */

            .chevy-discount-overlay {

                /*
                 * De propósito NÃO usa position:absolute/fixed.
                 * O card da Chevrolet tem estrutura variável (às
                 * vezes o elemento identificado como "card" não
                 * cobre a área visual inteira), então um badge
                 * posicionado por cima sempre corre o risco de
                 * flutuar sobre botões/preço, ou até escapar para
                 * o topo da página se o ancestral posicionado
                 * errado for usado como referência.
                 *
                 * Em vez disso o badge entra no fluxo normal do
                 * documento como primeiro elemento do card — nunca
                 * sobrepõe nada, só empurra o conteúdo do próprio
                 * card levemente para baixo.
                 */

                display:
                    inline-block !important;

                position:
                    static !important;

                margin:
                    0 0 8px 0 !important;

                max-width:
                    100% !important;

                padding:
                    6px 10px !important;

                border-radius:
                    6px !important;

                font-family:
                    Arial,
                    sans-serif !important;

                font-size:
                    13px !important;

                font-weight:
                    700 !important;

                line-height:
                    1.2 !important;

                white-space:
                    nowrap !important;

                box-sizing:
                    border-box !important;

                box-shadow:
                    0 2px 5px
                    rgba(
                        0,
                        0,
                        0,
                        0.12
                    ) !important;
            }


            /* =================================================
               POSITIVE
            ================================================= */

            .chevy-discount-positive {

                background:
                    #e8f7ed !important;

                color:
                    #08752c !important;

                border:
                    1px solid
                    #19a34a !important;
            }


            /* =================================================
               NEGATIVE
            ================================================= */

            .chevy-discount-negative {

                background:
                    #fff0f0 !important;

                color:
                    #b00000 !important;

                border:
                    1px solid
                    #d90000 !important;
            }


            /* =================================================
               ZERO
            ================================================= */

            .chevy-discount-zero {

                background:
                    #f3f3f3 !important;

                color:
                    #333333 !important;

                border:
                    1px solid
                    #aaaaaa !important;
            }


            /* =================================================
               SORT
            ================================================= */

            #chevy-best-discount-sort {

                display:
                    flex !important;

                align-items:
                    center !important;

                gap:
                    8px !important;

                margin-top:
                    8px !important;

                padding:
                    6px 10px !important;

                background:
                    #ffffff !important;

                border:
                    1px solid
                    #dddddd !important;

                border-radius:
                    4px !important;

                font-family:
                    Arial,
                    sans-serif !important;

                position:
                    relative !important;

                z-index:
                    100 !important;

                box-sizing:
                    border-box !important;
            }


            .chevy-sort-title {

                font-size:
                    12px !important;

                font-weight:
                    600 !important;

                color:
                    #666666 !important;

                white-space:
                    nowrap !important;
            }


            #chevy-sort-select {

                min-width:
                    185px !important;

                height:
                    34px !important;

                padding:
                    5px
                    30px
                    5px
                    10px !important;

                border:
                    1px
                    solid
                    #cccccc !important;

                border-radius:
                    4px !important;

                background:
                    #ffffff !important;

                color:
                    #222222 !important;

                font-family:
                    Arial,
                    sans-serif !important;

                font-size:
                    13px !important;

                font-weight:
                    600 !important;

                cursor:
                    pointer !important;

                box-sizing:
                    border-box !important;
            }


            #chevy-sort-select:hover {

                border-color:
                    #888888 !important;
            }


            #chevy-sort-select:focus {

                outline:
                    2px solid
                    #1976d2 !important;

                outline-offset:
                    1px !important;
            }


            /* =================================================
               STATUS
            ================================================= */

            #chevy-best-discount-status {

                position:
                    fixed !important;

                top:
                    20px !important;

                left:
                    50% !important;

                transform:
                    translateX(-50%) !important;

                z-index:
                    2147483647 !important;

                padding:
                    10px 16px !important;

                border-radius:
                    6px !important;

                background:
                    #ffffff !important;

                color:
                    #222222 !important;

                border:
                    1px solid
                    #cccccc !important;

                box-shadow:
                    0 3px 12px
                    rgba(
                        0,
                        0,
                        0,
                        0.15
                    ) !important;

                font-family:
                    Arial,
                    sans-serif !important;

                font-size:
                    14px !important;

                font-weight:
                    600 !important;

                pointer-events:
                    none !important;
            }

        `;


        (
            document.head ||
            document.documentElement
        ).appendChild(
            style
        );
    }


    // =========================================================
    // PROCESS
    // =========================================================

    function process() {

        if (
            !document.documentElement
        ) {

            return;
        }


        installCSS();

        createSortControl();

        renderCards();
    }


    process();


    let attempts =
        0;


    const timer =
        setInterval(
            function () {

                process();


                attempts++;


                if (
                    attempts >
                    60
                ) {

                    clearInterval(
                        timer
                    );
                }

            },
            1000
        );


    // =========================================================
    // OBSERVER
    // =========================================================

    const observer =
        new MutationObserver(
            function () {

                clearTimeout(
                    processTimer
                );


                processTimer =
                    setTimeout(
                        function () {

                            createSortControl();

                            renderCards();

                        },
                        800
                    );
            }
        );


    if (
        document.body
    ) {

        observer.observe(
            document.body,
            {
                childList:
                    true,

                subtree:
                    true
            }
        );
    }


    console.log(
        "🔥 Chevy Best Discount integrado aos cards"
    );

})();