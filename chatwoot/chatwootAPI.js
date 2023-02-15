/* eslint-disable camelcase */
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const http = require('http');

app.use(bodyParser.json());

// const [source_id, pubsub_token] = await create_contact(chatwoot_host, chatwoot_port, client_id, client_name, inbox_id);
// cookie.source_id = source_id;
// cookie.pubsub_token = pubsub_token;

// const conversation_id = await create_conversation(chatwoot_host, chatwoot_port, client_id, client_name, inbox_id, source_id);
// cookie.conversation_id = conversation_id;

// await create_message(chatwoot_host, chatwoot_port, inbox_id, cookie.source_id, cookie.conversation_id, "Hi, I'm a client");

async function createContact(chatwootHost, chatwootPort, clientId, clientName, inboxId) {
    console.log('------------- creating contact -------------');
    const api = `/public/api/v1/inboxes/${ inboxId }/contacts`;

    const reqBody = {
        'identifier': clientId,
        'identifier_hash': '',
        'email': `${ clientName }@test.de`,
        'name': clientName,
        'phone_number': '',
        'avatar_url': '',
        'custom_attributes': {}
    };
    const resBody = JSON.parse(await chatwootPost(chatwootHost, chatwootPort, api, reqBody));
    return [resBody.source_id, resBody.pubsub_token];
}

async function createConversation(chatwootHost, chatwootPort, clientId, clientName, inboxId, sourceId) {
    console.log('------------- creating conversation -------------');
    const api = `/public/api/v1/inboxes/${ inboxId }/contacts/${ sourceId }/conversations`;

    const reqBody = {
        'identifier': clientId,
        'identifier_hash': '',
        'email': `${ clientName }@test.de`,
        'name': clientName,
        'phone_number': '',
        'avatar_url': '',
        'custom_attributes': {}
    };
    const resBody = JSON.parse(await chatwootPost(chatwootHost, chatwootPort, api, reqBody));
    return resBody.id; // return conversation id
}

async function createMessage(chatwootHost, chatwootPort, inboxId, sourceId, conversationId, msg) {
    console.log('------------- creating message -------------');
    const api = `/public/api/v1/inboxes/${ inboxId }/contacts/${ sourceId }/conversations/${ conversationId }/messages`;

    const reqBody = {
        'content': msg,
        'echo_id': ''
    };
    const resBody = JSON.parse(await chatwootPost(chatwootHost, chatwootPort, api, reqBody));
    return resBody;
}

async function listAllMessage(chatwootHost, chatwootPort, inboxId, sourceId, conversationId) {
    console.log('------------- receiving message -------------');
    const api = `/public/api/v1/inboxes/${ inboxId }/contacts/${ sourceId }/conversations/${ conversationId }/messages`;

    const res_body = await chatwootGet(chatwootHost, chatwootPort, api);
    return res_body;
}

async function chatwootGet(chatwootHost, chatwootPort, api) {
    const options = {
        method: 'GET',
        host: chatwootHost,
        port: chatwootPort,
        path: api,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };

    return new Promise((resolve, reject) => {
        const request = http.get(options, (response) => {
            let body = '';
            console.log('statusCode:', response.statusCode);
            console.log('headers:', response.headers);
            response.on('data', (chunk) => {
                body += chunk;
                console.log(`BODY: ${ chunk }`);
            });
            response.on('end', () => resolve(body));
        }).on('error', reject);

        request.on('error', (e) => {
            console.error(e);
        });
        request.end();
    });
}

function chatwootPost(chatwootHost, chatwootPort, api, reqBody) {
    const options = {
        method: 'POST',
        host: chatwootHost,
        port: chatwootPort,
        path: api,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };

    const payload = JSON.stringify(reqBody);

    return new Promise((resolve, reject) => {
        const request = http.request(options, (response) => {
            console.log('statusCode:', response.statusCode);
            // console.log('headers:', response.headers);
            let body = '';
            response.on('data', (chunk) => {
                body += chunk;
                // console.log(`BODY: ${chunk}`);
            });
            response.on('end', () => resolve(body));
        }).on('error', reject);

        request.on('error', (e) => {
            console.error(e);
        });
        request.write(payload);
        request.end();
    });
}

exports.createContact = createContact;
exports.createConversation = createConversation;
exports.createMessage = createMessage;
exports.listAllMessage = listAllMessage;
