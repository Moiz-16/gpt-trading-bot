// Import the Alpaca and WebSocket libraries
const Alpaca = require('@alpacahq/alpaca-trade-api');
const alpaca = new Alpaca();  // Initialize Alpaca API client
const WebSocket = require('ws');  // Import WebSocket library

// Establish a WebSocket connection to Alpaca's news stream
const wss = new WebSocket("wss://stream.data.alpaca.markets/v1beta1/news");

// Event handler for when the WebSocket connection is opened
wss.on('open', function() {
    console.log("WebSocket Connected!");

    // Send an authentication message to the WebSocket server
    const authMsg = {
        action: 'auth',
        key: process.env.APCA_API_KEY_ID,  // Alpaca API Key ID from environment variables
        secret: process.env.APCA_API_SECRET_KEY,  // Alpaca API Secret Key from environment variables
    };
    wss.send(JSON.stringify(authMsg));  // Send the authentication message

    // Send a subscription message to subscribe to all news events
    const subscribeMsg = {
        action: 'subscribe',
        news: ['*'],  // Subscribe to all news events
    };
    wss.send(JSON.stringify(subscribeMsg));  // Send the subscription message
});

// Event handler for when a message is received on the WebSocket
wss.on("message", async function(message) {
    console.log("Message received: " + message);

    // Parse the incoming message
    const currentEvent = JSON.parse(message)[0];

    // Initialize a variable to hold the impact score of the news event
    let companyImpact = 0;

    // Check if the event is a news event (denoted by "T" field being "n")
    if(currentEvent.T === "n"){
        
        // Prepare a request body for the OpenAI API to analyze the impact of the news headline
        const apiRequestBody = {
            "model": "gpt-3.5-turbo",
            "messages": [
                {role: "system", content: "Only respond with a number 1-100 detailing the impact of the headline."},
                {role: "user", content: "Given the headline '" + currentEvent.headline + "', show me a number 1-100 detailing the impact of this headline."},
            ]
        };

        // Send a request to the OpenAI API to get the impact score
        await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + "",  // OpenAI API Key from environment variables
                "Content-Type": "application/json",
            },
            body: JSON.stringify(apiRequestBody)  // Send the API request with the request body
        })
        .then((data) => data.json())  // Parse the response to JSON
        .then((data) => {
            console.log(data);  // Log the full response
            console.log(data.choices[0].message);  // Log the specific message
            companyImpact = parseInt(data.choices[0].message.content);  // Extract and parse the impact score
        });

        // Extract the first ticker symbol associated with the news event
        const tickerSymbol = currentEvent.symbols[0]; 

        // If the impact score is positive, place a buy order
        if (companyImpact >= 0) {
            let order = await alpaca.createOrder({
                symbol: tickerSymbol,  // The ticker symbol to trade
                qty: 1,  // Quantity of shares to buy
                side: 'buy',  // Buy side order
                type: 'market',  // Market order type
                time_in_force: 'day',  // Order is good for the day
            });

        // If the impact score is low (30 or below), close any existing position
        } else if (companyImpact <= 30) {
            let closedPosition = await alpaca.closePosition(tickerSymbol);  // Close the position for the ticker symbol
        }
    }
});