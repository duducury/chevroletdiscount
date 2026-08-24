(() => {

    "use strict";

    console.log(
        "🚨🚨🚨 CHEVY CAPTURE.JS EXECUTOU 🚨🚨🚨"
    );


    const SEARCH_URL =
        "/chevrolet/shopping/api/aec-cp-discovery-api/p/v1/vehicles/search";


    const originalFetch =
        window.fetch;


    window.fetch =
        async function (
            input,
            init
        ) {

            const url =
                typeof input === "string"
                    ? input
                    : input?.url || "";


            if (
                url.includes(
                    SEARCH_URL
                )
            ) {

                console.log(
                    "🔥🔥🔥 CHEVROLET SEARCH DETECTADO"
                );


                console.log(
                    "URL:",
                    url
                );


                if (
                    init &&
                    init.body
                ) {

                    try {

                        const body =
                            typeof init.body === "string"
                                ? JSON.parse(
                                    init.body
                                )
                                : init.body;


                        console.log(
                            "🎯🎯🎯 PAYLOAD CHEVROLET:",
                            body
                        );


                        window.postMessage(
                            {
                                source:
                                    "CHEVY_BEST_DISCOUNT",

                                type:
                                    "SEARCH_BODY",

                                data:
                                    body
                            },

                            "*"
                        );

                    }

                    catch (error) {

                        console.error(
                            "❌ Erro lendo Payload:",
                            error
                        );

                    }

                }

            }


            const response =
                await originalFetch.apply(
                    this,
                    arguments
                );


            if (
                url.includes(
                    SEARCH_URL
                )
            ) {

                try {

                    const clone =
                        response.clone();


                    const json =
                        await clone.json();


                    console.log(
                        "📦📦📦 RESPOSTA CHEVROLET:",
                        json
                    );


                    window.postMessage(
                        {
                            source:
                                "CHEVY_BEST_DISCOUNT",

                            type:
                                "SEARCH_RESPONSE",

                            data:
                                json
                        },

                        "*"
                    );

                }

                catch (error) {

                    console.error(
                        "❌ Erro lendo resposta:",
                        error
                    );

                }

            }


            return response;

        };


})();