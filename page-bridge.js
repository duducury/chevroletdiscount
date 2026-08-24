(function () {
    "use strict";

    if (window.__CHEVY_BEST_DISCOUNT_BRIDGE__) {
        return;
    }

    window.__CHEVY_BEST_DISCOUNT_BRIDGE__ = true;

    const API_PART =
        "/chevrolet/shopping/api/aec-cp-discovery-api/p/v1/vehicles/search";


    // =========================================================
    // ÚLTIMA REQUISIÇÃO ORIGINAL DA CHEVROLET
    // =========================================================

    let capturedRequest = null;


    // =========================================================
    // ENVIAR MENSAGEM PARA O CONTENT.JS
    // =========================================================

    function sendMessage(type, data) {

        try {

            window.postMessage(
                {
                    source:
                        "CHEVY_BEST_DISCOUNT_PAGE",

                    type:
                        type,

                    ...data
                },
                "*"
            );

        } catch (error) {

            console.error(
                "❌ Erro enviando mensagem:",
                error
            );

        }

    }


    // =========================================================
    // NORMALIZAR HEADERS
    // =========================================================

    function normalizeHeaders(headers) {

        const result = {};

        if (!headers) {
            return result;
        }


        // Headers como objeto normal

        if (
            typeof headers === "object" &&
            !(
                headers instanceof Headers
            )
        ) {

            try {

                Object.keys(headers).forEach(
                    function (key) {

                        result[
                            key
                        ] =
                            String(
                                headers[key]
                            );

                    }
                );

            } catch (error) {

                console.warn(
                    "⚠️ Erro lendo headers:",
                    error
                );

            }

        }


        // Headers API

        if (
            headers instanceof Headers
        ) {

            headers.forEach(
                function (
                    value,
                    key
                ) {

                    result[
                        key
                    ] =
                        value;

                }
            );

        }


        return result;

    }


    // =========================================================
    // CAPTURAR PAYLOAD + HEADERS
    // =========================================================

    function captureRequest(
        body,
        headers,
        url
    ) {

        if (
            !body ||
            !body.filters
        ) {

            return;

        }


        const normalizedHeaders =
            normalizeHeaders(
                headers
            );


        capturedRequest = {

            url:
                url,

            body:
                body,

            headers:
                normalizedHeaders

        };


        console.log(
            "🔥 CHEVY SEARCH CAPTURADO"
        );

        console.log(
            "📦 Payload:",
            body
        );

        console.log(
            "📋 Headers capturados:",
            normalizedHeaders
        );


        sendMessage(
            "SEARCH_CAPTURED",
            {
                body:
                    body
            }
        );


        sendMessage(
            "CHEVY_SEARCH_PAYLOAD",
            {
                payload:
                    body
            }
        );

    }


    // =========================================================
    // FETCH ORIGINAL
    // =========================================================

    const originalFetch =
        window.fetch;


    // =========================================================
    // INTERCEPTAR FETCH
    // =========================================================

    window.fetch =
        async function (...args) {

            try {

                const request =
                    args[0];

                const options =
                    args[1] || {};


                let url = "";


                if (
                    typeof request ===
                    "string"
                ) {

                    url =
                        request;

                } else if (
                    request &&
                    typeof request.url ===
                    "string"
                ) {

                    url =
                        request.url;

                }


                // =================================================
                // BUSCA DA CHEVROLET
                // =================================================

                if (
                    url.includes(
                        API_PART
                    )
                ) {

                    let body =
                        options.body;


                    // ---------------------------------------------
                    // Request object pode conter o body
                    // ---------------------------------------------

                    if (
                        !body &&
                        request &&
                        request instanceof Request
                    ) {

                        try {

                            body =
                                await request.clone()
                                    .text();

                        } catch (error) {

                            console.warn(
                                "⚠️ Não consegui ler Request.body:",
                                error
                            );

                        }

                    }


                    if (
                        typeof body ===
                        "string"
                    ) {

                        try {

                            const parsed =
                                JSON.parse(
                                    body
                                );


                            captureRequest(
                                parsed,

                                options.headers,

                                url
                            );


                        } catch (error) {

                            console.warn(
                                "⚠️ Body da Chevrolet não é JSON:",
                                error
                            );

                        }

                    }

                }

            } catch (error) {

                console.warn(
                    "⚠️ Erro interceptando fetch:",
                    error
                );

            }


            /*
             * Deixa a Chevrolet continuar normalmente.
             */

            return originalFetch.apply(
                this,
                args
            );

        };


    // =========================================================
    // XMLHttpRequest
    // =========================================================

    const originalOpen =
        XMLHttpRequest.prototype.open;

    const originalSend =
        XMLHttpRequest.prototype.send;

    const originalSetRequestHeader =
        XMLHttpRequest.prototype.setRequestHeader;


    XMLHttpRequest.prototype.open =
        function (
            method,
            url,
            ...rest
        ) {

            this.__chevyUrl =
                String(
                    url
                );

            this.__chevyHeaders =
                {};

            return originalOpen.call(
                this,
                method,
                url,
                ...rest
            );

        };


    XMLHttpRequest.prototype.setRequestHeader =
        function (
            name,
            value
        ) {

            try {

                if (
                    !this.__chevyHeaders
                ) {

                    this.__chevyHeaders =
                        {};

                }

                this.__chevyHeaders[
                    name
                ] =
                    String(
                        value
                    );

            } catch (error) {

                console.warn(
                    "⚠️ Erro capturando header XHR:",
                    error
                );

            }


            return originalSetRequestHeader.call(
                this,
                name,
                value
            );

        };


    XMLHttpRequest.prototype.send =
        function (
            body
        ) {

            try {

                if (
                    this.__chevyUrl &&
                    this.__chevyUrl.includes(
                        API_PART
                    ) &&
                    body
                ) {

                    if (
                        typeof body ===
                        "string"
                    ) {

                        try {

                            const parsed =
                                JSON.parse(
                                    body
                                );


                            captureRequest(
                                parsed,

                                this.__chevyHeaders,

                                this.__chevyUrl
                            );


                        } catch (error) {

                            console.warn(
                                "⚠️ XHR body não é JSON:",
                                error
                            );

                        }

                    }

                }

            } catch (error) {

                console.warn(
                    "⚠️ Erro interceptando XHR:",
                    error
                );

            }


            return originalSend.call(
                this,
                body
            );

        };


    // =========================================================
    // REQUEST_PAGE
    // =========================================================

    window.addEventListener(
        "message",
        async function (
            event
        ) {

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
                    "CHEVY_BEST_DISCOUNT_CONTENT"
            ) {

                return;

            }


            if (
                data.type !==
                "REQUEST_PAGE"
            ) {

                return;

            }


            const requestId =
                data.requestId;


            const body =
                data.body;


            if (
                !body
            ) {

                sendMessage(
                    "PAGE_ERROR",
                    {
                        requestId:
                            requestId,

                        error:
                            "Payload vazio."
                    }
                );

                return;

            }


            try {

                console.log(
                    "📡 Buscando página da Chevrolet:",
                    requestId
                );


                // =================================================
                // USAR HEADERS ORIGINAIS
                // =================================================

                const headers = {};


                if (
                    capturedRequest &&
                    capturedRequest.headers
                ) {

                    Object.assign(
                        headers,
                        capturedRequest.headers
                    );

                }


                /*
                 * O oemId é obrigatório.
                 *
                 * Normalmente ele já está nos headers originais.
                 */

                if (
                    !headers["oemId"] &&
                    !headers["oemid"] &&
                    !headers["OEMID"]
                ) {

                    console.warn(
                        "⚠️ oemId não foi encontrado nos headers capturados."
                    );

                }


                // Garantir headers básicos

                if (
                    !headers["Content-Type"] &&
                    !headers["content-type"]
                ) {

                    headers[
                        "Content-Type"
                    ] =
                        "application/json";

                }


                if (
                    !headers["Accept"] &&
                    !headers["accept"]
                ) {

                    headers[
                        "Accept"
                    ] =
                        "application/json";

                }


                console.log(
                    "📋 Headers usados na próxima página:",
                    headers
                );


                // =================================================
                // REQUISIÇÃO
                // =================================================

                const response =
                    await originalFetch(
                        (
                            capturedRequest &&
                            capturedRequest.url
                        )
                            ? capturedRequest.url
                            : (
                                window.location.origin +
                                API_PART
                            ),
                        {
                            method:
                                "POST",

                            headers:
                                headers,

                            credentials:
                                "include",

                            body:
                                JSON.stringify(
                                    body
                                )
                        }
                    );


                console.log(
                    "📥 Chevrolet respondeu:",
                    response.status
                );


                if (
                    !response.ok
                ) {

                    const text =
                        await response.text();


                    throw new Error(
                        "HTTP " +
                        response.status +
                        " - " +
                        text.substring(
                            0,
                            1000
                        )
                    );

                }


                const json =
                    await response.json();


                console.log(
                    "📦 Página recebida:",
                    json
                );


                sendMessage(
                    "PAGE_RESPONSE",
                    {
                        requestId:
                            requestId,

                        data:
                            json
                    }
                );


            } catch (error) {

                console.error(
                    "❌ Erro buscando página da Chevrolet:",
                    error
                );


                sendMessage(
                    "PAGE_ERROR",
                    {
                        requestId:
                            requestId,

                        error:
                            error.message ||
                            String(
                                error
                            )
                    }
                );

            }

        }
    );


    // =========================================================
    // INSTALADO
    // =========================================================

    console.log(
        "✅ Chevy Best Discount Page Bridge instalado"
    );

})();