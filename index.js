// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const dotenv = require('dotenv');
const path = require('path');
const bodyParser = require('body-parser');

// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
const { BotFrameworkAdapter,
    TranscriptLoggerMiddleware,
    TurnContext } = require('botbuilder');
const { ChatwootAdapter } = require('./chatwoot/chatwootAdapter');

const express = require('express');
const app = express();
app.use(bodyParser.json());

// Import required bot configuration.
const { BotConfiguration } = require('botframework-config');

// This bot's main dialog.
const { MyBot } = require('./bot');

// Middleware
const { HandoverMiddleware, ArrayHandoverProvider } = require('./middleware/handoverMiddleware');
const { CustomLogger } = require('./middleware/CustomLogger');

// Read botFilePath and botFileSecret from .env file
// Note: Ensure you have a .env file and include botFilePath and botFileSecret.
const ENV_FILE = path.join(__dirname, '.env');
dotenv.config({ path: ENV_FILE });

// bot endpoint name as defined in .bot file
// See https://aka.ms/about-bot-file to learn more about .bot file its use and bot configuration.
const DEV_ENVIRONMENT = 'development';

// bot name as defined in .bot file
// See https://aka.ms/about-bot-file to learn more about .bot file its use and bot configuration.
const BOT_CONFIGURATION = (process.env.NODE_ENV || DEV_ENVIRONMENT);

// Create HTTP server
app.use(bodyParser.json());
app.listen(process.env.PORT || 3978, () => {
    // console.log(`\n${ server.name } listening to ${ server.url }`);
    console.log(`bot running on port ${ process.env.PORT || 3978 }`);
    console.log(`\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator`);
    console.log(`\nTo talk to your bot, open handoff.bot file in the Emulator`);
});

// .bot file path
const BOT_FILE = path.join(__dirname, (process.env.botFilePath || ''));

// Read bot configuration from .bot file.
let botConfig;
try {
    botConfig = BotConfiguration.loadSync(BOT_FILE, process.env.botFileSecret);
} catch (err) {
    console.error(`\n Error reading bot file. Please ensure you have valid botFilePath and botFileSecret set for your environment.`);
    console.error(`\n - The botFileSecret is available under appsettings for your Azure Bot Service bot.`);
    console.error(`\n - If you are running this bot locally, consider adding a .env file with botFilePath and botFileSecret.`);
    console.error(`\n - See https://aka.ms/about-bot-file to learn more about .bot file its use and bot configuration.\n\n`);
    process.exit();
}

// Get bot endpoint configuration by service name
const endpointConfig = botConfig.findServiceByNameOrId(BOT_CONFIGURATION);

// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about .bot file its use and bot configuration.
const botAdapter = new BotFrameworkAdapter({
    appId: endpointConfig.appId || process.env.microsoftAppID,
    appPassword: endpointConfig.appPassword || process.env.microsoftAppPassword
});
const chatwootAdapter = new ChatwootAdapter();
const provider = new ArrayHandoverProvider();
// Transcript logger middleware automatically logs incoming and outgoing activities.
const transcriptStore = new CustomLogger();
var transcriptMiddleware = new TranscriptLoggerMiddleware(transcriptStore);
botAdapter.use(transcriptMiddleware);
// handover middleware handles handover requests
const handoverMiddleware = new HandoverMiddleware(provider, botAdapter);
botAdapter.use(handoverMiddleware);
chatwootAdapter.use(handoverMiddleware);

// Catch-all for errors.
botAdapter.onTurnError = async (context, error) => {
    // This check writes out errors to console log .vs. app insights.
    console.error(`\n [onTurnError]: ${ error }`);
    // Send a message to the user
    await context.sendActivity(`Oops. Something went wrong!`);
};

// Create the main dialog.
const myBot = new MyBot();

// Listen for incoming requests.
app.post('/api/messages', (req, res) => {
    botAdapter.processActivity(req, res, async (context) => {
        // Route to main dialog.
        await myBot.onTurn(context);
    });
});

app.post('/', (req, res) => {
    if (req.body && req.body.message_type === 'outgoing') {
        console.log('------------- bot receiving message from chatwoot agent -------------');
        const channelAccount = {
            id: req.body.account.id,
            name: `agent_${ req.body.account.name }`,
            role: 'agent' };
        const conversationAccount = {
            isGroup: false,
            conversationType: '',
            id: req.body.conversation.id,
            name: `agent_${ req.body.account.name }`,
            role: 'agent' };
        const message = {
            id: req.body.id,
            channelData: channelAccount,
            conversation: conversationAccount,
            channelId: 'chatwoot',
            text: req.body.content,
            type: 'message'
        };

        const turnContext = new TurnContext(chatwootAdapter, message);

        chatwootAdapter.runMiddleware(turnContext, async (context) => {
            await myBot.onTurn(context);
        });
    }
});
